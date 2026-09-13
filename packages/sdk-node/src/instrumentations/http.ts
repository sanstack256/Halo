import type { CoreClient } from "@halo-trace/sdk-core";
import { sanitizeUrl } from "@halo-trace/sdk-core";
import { getContext } from "../context";

export function registerNodeHttpInstrumentation(client: CoreClient, endpoint?: string): () => void {
    if (typeof globalThis.fetch !== "function") return () => {};

    const cleanEndpoint = endpoint ? endpoint.replace(/\/$/, "") : "";
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
        if (cleanEndpoint && rawUrl.includes(cleanEndpoint)) {
            return originalFetch.call(this, input, init);
        }

        const method = (init?.method || (typeof input === "object" && "method" in input ? (input as Request).method : "GET")).toUpperCase();
        const sanitized = sanitizeUrl(rawUrl);
        const traceMgr = client.getTraceManager();
        const context = getContext();

        const { spanId } = traceMgr.startSpan(`${method} ${sanitized}`, "http.client");
        const traceId = context?.trace?.traceId || traceMgr.getTraceId();
        const requestId = context?.requestId || traceMgr.getRequestId();

        const headers = new Headers(init?.headers || (typeof input === "object" && "headers" in input ? (input as Request).headers : {}));
        headers.set("traceparent", `00-${traceId}-${spanId}-01`);
        headers.set("x-trace-id", traceId);
        headers.set("x-request-id", requestId);

        const startTime = Date.now();

        client.addBreadcrumb({
            category: "request",
            message: `${method} ${sanitized}`,
            data: { method, url: sanitized, traceId, requestId, spanId },
        });

        try {
            const response = await originalFetch.call(this, input, {
                ...init,
                headers,
            });

            const durationMs = Date.now() - startTime;
            client.addBreadcrumb({
                category: "response",
                message: `${method} ${sanitized} -> ${response.status}`,
                level: response.ok ? "INFO" : "WARNING",
                data: { status: response.status, durationMs, traceId, requestId, ok: response.ok },
            });

            client.capturePerformance({
                title: `${method} ${sanitized}`,
                durationMs,
                operation: "http.client",
                resource: sanitized,
                status: response.status,
                metadata: {
                    http: {
                        method,
                        status: response.status,
                        ok: response.ok,
                        failed: !response.ok,
                        url: sanitized,
                        traceId,
                        requestId,
                    },
                },
            });

            return response;
        } catch (err: any) {
            const durationMs = Date.now() - startTime;
            client.addBreadcrumb({
                category: "request",
                message: `${method} ${sanitized} failed: ${err.message}`,
                level: "ERROR",
                data: { error: err.message, durationMs, traceId, requestId },
            });

            client.capturePerformance({
                title: `${method} ${sanitized} (FAILED)`,
                durationMs,
                operation: "http.client",
                resource: sanitized,
                status: "FAILED",
                metadata: {
                    http: {
                        method,
                        failed: true,
                        error: err.message,
                        url: sanitized,
                        traceId,
                        requestId,
                    },
                },
            });

            throw err;
        }
    };

    return () => {
        globalThis.fetch = originalFetch;
    };
}
