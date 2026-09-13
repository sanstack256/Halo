import type { CoreClient } from "@halo-trace/sdk-core";
import { sanitizeUrl, sanitizeHeaders } from "@halo-trace/sdk-core";

export interface BrowserHttpOptions {
    endpoint?: string;
    ignoreUrls?: (string | RegExp)[];
    allowlistHeaders?: string[];
}

export function registerHttpInstrumentation(
    client: CoreClient,
    options: BrowserHttpOptions = {}
): () => void {
    if (typeof window === "undefined") return () => {};

    const cleanEndpoint = options.endpoint ? options.endpoint.replace(/\/$/, "") : "/api";

    const shouldIgnore = (url: string): boolean => {
        if (!url) return true;
        if (cleanEndpoint && url.includes(cleanEndpoint)) return true;
        if (options.ignoreUrls) {
            for (const pattern of options.ignoreUrls) {
                if (typeof pattern === "string" && url.includes(pattern)) return true;
                if (pattern instanceof RegExp && pattern.test(url)) return true;
            }
        }
        return false;
    };

    // 1. Instrument fetch
    let originalFetch: typeof window.fetch | null = null;
    if (typeof window.fetch === "function") {
        originalFetch = window.fetch;
        window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
            const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
            if (shouldIgnore(rawUrl)) {
                return originalFetch!.call(this, input, init);
            }

            const method = (init?.method || (typeof input === "object" && "method" in input ? (input as Request).method : "GET")).toUpperCase();
            const sanitized = sanitizeUrl(rawUrl);
            const traceMgr = client.getTraceManager();
            const { spanId, parentSpanId } = traceMgr.startSpan(`${method} ${sanitized}`, "http.client");
            const traceId = traceMgr.getTraceId();
            const requestId = traceMgr.getRequestId();

            // Inject W3C Trace Context
            const headers = new Headers(init?.headers || (typeof input === "object" && "headers" in input ? (input as Request).headers : {}));
            traceMgr.injectHeaders({
                set: (k: string, v: string) => headers.set(k, v),
            } as any);
            headers.set("traceparent", `00-${traceId}-${spanId}-01`);
            headers.set("x-trace-id", traceId);
            headers.set("x-request-id", requestId);

            const startTime = performance.now();

            client.addBreadcrumb({
                category: "request",
                message: `${method} ${sanitized}`,
                data: { method, url: sanitized, traceId, requestId, spanId },
            });

            try {
                const response = await originalFetch!.call(this, input, {
                    ...init,
                    headers,
                });

                const durationMs = Math.round(performance.now() - startTime);

                client.addBreadcrumb({
                    category: "response",
                    message: `${method} ${sanitized} -> ${response.status}`,
                    level: response.ok ? "INFO" : "WARNING",
                    data: {
                        status: response.status,
                        durationMs,
                        traceId,
                        requestId,
                        ok: response.ok,
                    },
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
                            spanId,
                            headers: sanitizeHeaders(response.headers, options.allowlistHeaders),
                        },
                    },
                });

                return response;
            } catch (err: any) {
                const durationMs = Math.round(performance.now() - startTime);
                const isAbort = err.name === "AbortError";

                client.addBreadcrumb({
                    category: "request",
                    message: `${method} ${sanitized} failed: ${err.message}`,
                    level: "ERROR",
                    data: {
                        aborted: isAbort,
                        error: err.message,
                        durationMs,
                        traceId,
                        requestId,
                    },
                });

                client.capturePerformance({
                    title: `${method} ${sanitized} (FAILED)`,
                    durationMs,
                    operation: "http.client",
                    resource: sanitized,
                    status: isAbort ? "ABORTED" : "FAILED",
                    metadata: {
                        http: {
                            method,
                            failed: true,
                            aborted: isAbort,
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
    }

    // 2. Instrument XMLHttpRequest
    let originalOpen: any = null;
    let originalSend: any = null;
    if (typeof window.XMLHttpRequest === "function") {
        const proto = XMLHttpRequest.prototype;
        originalOpen = proto.open;
        originalSend = proto.send;

        proto.open = function (method: string, url: string | URL, ...args: any[]) {
            const rawUrl = typeof url === "string" ? url : url.toString();
            (this as any).__halo_req__ = {
                method: method.toUpperCase(),
                url: rawUrl,
                sanitizedUrl: sanitizeUrl(rawUrl),
                ignored: shouldIgnore(rawUrl),
            };
            return originalOpen.apply(this, [method, url, ...args]);
        };

        proto.send = function (...args: any[]) {
            const req = (this as any).__halo_req__;
            if (!req || req.ignored) {
                return originalSend.apply(this, args);
            }

            const traceMgr = client.getTraceManager();
            const { spanId } = traceMgr.startSpan(`${req.method} ${req.sanitizedUrl}`, "http.client");
            const traceId = traceMgr.getTraceId();
            const requestId = traceMgr.getRequestId();

            try {
                this.setRequestHeader("traceparent", `00-${traceId}-${spanId}-01`);
                this.setRequestHeader("x-trace-id", traceId);
                this.setRequestHeader("x-request-id", requestId);
            } catch {
                // Ignore header errors if state invalid
            }

            const startTime = performance.now();

            const onDone = () => {
                const durationMs = Math.round(performance.now() - startTime);
                const status = this.status;
                const ok = status >= 200 && status < 400;

                client.addBreadcrumb({
                    category: "response",
                    message: `XHR ${req.method} ${req.sanitizedUrl} -> ${status}`,
                    level: ok ? "INFO" : "WARNING",
                    data: { status, durationMs, traceId, requestId, ok },
                });

                client.capturePerformance({
                    title: `XHR ${req.method} ${req.sanitizedUrl}`,
                    durationMs,
                    operation: "http.client",
                    resource: req.sanitizedUrl,
                    status,
                    metadata: {
                        http: {
                            method: req.method,
                            status,
                            ok,
                            failed: !ok,
                            url: req.sanitizedUrl,
                            traceId,
                            requestId,
                        },
                    },
                });
            };

            this.addEventListener("load", onDone);
            this.addEventListener("error", onDone);
            this.addEventListener("abort", onDone);

            return originalSend.apply(this, args);
        };
    }

    return () => {
        if (originalFetch) window.fetch = originalFetch;
        if (originalOpen && typeof window.XMLHttpRequest === "function") {
            XMLHttpRequest.prototype.open = originalOpen;
            XMLHttpRequest.prototype.send = originalSend;
        }
    };
}
