"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __reExport = (target, mod, secondTarget) => (__copyProps(target, mod, "default"), secondTarget && __copyProps(secondTarget, mod, "default"));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  getServerClient: () => getServerClient,
  initServer: () => initServer,
  withHaloAction: () => withHaloAction,
  withHaloRoute: () => withHaloRoute
});
module.exports = __toCommonJS(index_exports);

// src/client.ts
var client_exports = {};
__reExport(client_exports, require("@halo-trace/sdk-browser"));
__reExport(client_exports, require("@halo-trace/sdk-react"));

// src/index.ts
__reExport(index_exports, client_exports, module.exports);

// src/server.ts
var import_sdk_node = require("@halo-trace/sdk-node");
var import_sdk_core = require("@halo-trace/sdk-core");
function initServer(options) {
  return (0, import_sdk_node.init)(options);
}
function getServerClient() {
  return (0, import_sdk_node.getClient)();
}
function withHaloRoute(handler) {
  return async function haloRouteHandler(req, ...args) {
    const client = getServerClient();
    const incomingTrace = req.headers.get("traceparent");
    const parsedTrace = incomingTrace ? (0, import_sdk_core.parseTraceParent)(incomingTrace) : null;
    const traceId = parsedTrace?.traceId || req.headers.get("x-trace-id") || (0, import_sdk_core.generateTraceId)();
    const spanId = (0, import_sdk_core.generateSpanId)();
    const requestId = req.headers.get("x-request-id") || (0, import_sdk_core.generateRequestId)();
    const traceContext = {
      traceId,
      spanId,
      parentSpanId: parsedTrace?.spanId,
      sampled: true
    };
    const startTime = Date.now();
    const url = req.url || "unknown";
    const method = req.method || "GET";
    return (0, import_sdk_node.runWithContext)(
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
    const traceId = (0, import_sdk_node.getTraceId)() || (0, import_sdk_core.generateTraceId)();
    const requestId = (0, import_sdk_node.getRequestId)() || (0, import_sdk_core.generateRequestId)();
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getServerClient,
  initServer,
  withHaloAction,
  withHaloRoute
});
//# sourceMappingURL=index.cjs.map