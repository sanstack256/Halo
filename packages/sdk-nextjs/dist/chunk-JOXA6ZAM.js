// src/server.ts
import { init as initNode, getClient as getNodeClient, runWithContext, getContext, getTraceId, getRequestId } from "@halo-trace/sdk-node";
import { parseTraceParent, generateTraceId, generateSpanId, generateRequestId } from "@halo-trace/sdk-core";
function initServer(options) {
  return initNode(options);
}
function getServerClient() {
  return getNodeClient();
}
function withHaloRoute(handler) {
  return async function haloRouteHandler(req, ...args) {
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
      sampled: true
    };
    const startTime = Date.now();
    const url = req.url || "unknown";
    const method = req.method || "GET";
    return runWithContext(
      {
        trace: traceContext,
        requestId,
        route: url,
        startedAt: startTime
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
                  spanId
                }
              }
            });
          }
          return response;
        } catch (err) {
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
                method
              }
            });
          }
          throw err;
        }
      }
    );
  };
}
function withHaloAction(actionName, action) {
  return async function haloActionWrapper(...args) {
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
          metadata: { actionName, traceId, requestId }
        });
      }
      return result;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      if (client) {
        client.captureException(err, {
          severity: "ERROR",
          title: `Server Action Failed: ${actionName}`,
          operation: "server.action",
          resource: actionName,
          durationMs,
          metadata: { actionName, traceId, requestId }
        });
      }
      throw err;
    }
  };
}

export {
  runWithContext,
  getContext,
  getTraceId,
  getRequestId,
  initServer,
  getServerClient,
  withHaloRoute,
  withHaloAction
};
//# sourceMappingURL=chunk-JOXA6ZAM.js.map