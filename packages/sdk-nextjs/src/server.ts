import { init as initNode, getClient as getNodeClient, NodeClient, runWithContext, getContext, getTraceId, getRequestId } from "@halo-trace/sdk-node";
import type { HaloOptions } from "@halo-trace/sdk-types";
import { parseTraceParent, generateTraceId, generateSpanId, generateRequestId } from "@halo-trace/sdk-core";

export { runWithContext, getContext, getTraceId, getRequestId };

export function initServer(options: HaloOptions): NodeClient {
    return initNode(options);
}

export function getServerClient(): NodeClient | null {
    return getNodeClient();
}

/**
 * Higher-order function for Next.js Route Handlers (app/api/.../route.ts).
 * Captures request context, W3C trace context, measures duration, and catches unhandled server exceptions.
 */
export function withHaloRoute<TReq extends Request = Request, TArgs extends any[] = any[]>(
    handler: (req: TReq, ...args: TArgs) => Promise<Response> | Response
) {
    return async function haloRouteHandler(req: TReq, ...args: TArgs): Promise<Response> {
        const client = getServerClient();
        const incomingTrace = req.headers.get("traceparent");
        const parsedTrace = incomingTrace ? parseTraceParent(incomingTrace) : null;

        const traceId = parsedTrace?.traceId || req.headers.get("x-trace-id") || generateTraceId();
        const spanId = generateSpanId();
        const requestId = req.headers.get("x-request-id") || generateRequestId();

        const traceContext = {
            traceId,
            spanId,
            parentSpanId: parsedTrace?.spanId,
            sampled: true,
        };

        const startTime = Date.now();
        const url = req.url || "unknown";
        const method = req.method || "GET";

        return runWithContext(
            {
                trace: traceContext,
                requestId,
                route: url,
                startedAt: startTime,
            },
            async () => {
                try {
                    const response = await handler(req, ...args);
                    const durationMs = Date.now() - startTime;

                    if (client) {
                        client.capturePerformance({
                            title: `${method} ${url}`,
                            durationMs,
                            operation: "http.server",
                            resource: url,
                            status: response.status,
                            metadata: {
                                http: {
                                    method,
                                    status: response.status,
                                    ok: response.ok,
                                    traceId,
                                    requestId,
                                    spanId,
                                },
                            },
                        });
                    }

                    return response;
                } catch (err: any) {
                    const durationMs = Date.now() - startTime;
                    if (client) {
                        client.captureException(err, {
                            severity: "ERROR",
                            requestId,
                            traceId,
                            spanId,
                            operation: "http.server",
                            resource: url,
                            durationMs,
                            metadata: {
                                serverRoute: url,
                                method,
                            },
                        });
                    }
                    throw err;
                }
            }
        );
    };
}

/**
 * Higher-order function for Next.js Server Actions ("use server").
 */
export function withHaloAction<TArgs extends any[], TResult>(
    actionName: string,
    action: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
    return async function haloActionWrapper(...args: TArgs): Promise<TResult> {
        const client = getServerClient();
        const startTime = Date.now();
        const traceId = getTraceId() || generateTraceId();
        const requestId = getRequestId() || generateRequestId();

        try {
            const result = await action(...args);
            const durationMs = Date.now() - startTime;
            if (client) {
                client.capturePerformance({
                    title: `ServerAction: ${actionName}`,
                    durationMs,
                    operation: "server.action",
                    resource: actionName,
                    status: "OK",
                    metadata: { actionName, traceId, requestId },
                });
            }
            return result;
        } catch (err: any) {
            const durationMs = Date.now() - startTime;
            if (client) {
                client.captureException(err, {
                    severity: "ERROR",
                    title: `Server Action Failed: ${actionName}`,
                    operation: "server.action",
                    resource: actionName,
                    durationMs,
                    metadata: { actionName, traceId, requestId },
                });
            }
            throw err;
        }
    };
}
