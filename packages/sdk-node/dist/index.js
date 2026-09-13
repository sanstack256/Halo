// src/node-client.ts
import { CoreClient } from "@halo-trace/sdk-core";

// src/instrumentations/process.ts
function registerProcessInstrumentation(client, exitOnUncaught = false) {
  if (typeof process === "undefined" || typeof process.on !== "function") return () => {
  };
  const onUncaughtException = async (error) => {
    try {
      client.captureException(error, {
        severity: "FATAL",
        metadata: { fatal: true, uncaughtException: true }
      });
      await client.flush();
    } catch {
    } finally {
      if (exitOnUncaught) {
        process.exit(1);
      }
    }
  };
  const onUnhandledRejection = async (reason) => {
    try {
      const err = reason instanceof Error ? reason : new Error(String(reason));
      client.captureException(err, {
        severity: "ERROR",
        metadata: { unhandledRejection: true }
      });
      await client.flush();
    } catch {
    }
  };
  const onBeforeExit = async () => {
    try {
      await client.flush();
    } catch {
    }
  };
  process.on("uncaughtException", onUncaughtException);
  process.on("unhandledRejection", onUnhandledRejection);
  process.on("beforeExit", onBeforeExit);
  return () => {
    process.removeListener("uncaughtException", onUncaughtException);
    process.removeListener("unhandledRejection", onUnhandledRejection);
    process.removeListener("beforeExit", onBeforeExit);
  };
}

// src/instrumentations/http.ts
import { sanitizeUrl } from "@halo-trace/sdk-core";

// src/context.ts
import { AsyncLocalStorage } from "async_hooks";
var asyncLocalStorage = new AsyncLocalStorage();
function runWithContext(context, fn) {
  return asyncLocalStorage.run(context, fn);
}
function getContext() {
  return asyncLocalStorage.getStore();
}
function getTraceId() {
  return asyncLocalStorage.getStore()?.trace?.traceId;
}
function getRequestId() {
  return asyncLocalStorage.getStore()?.requestId;
}

// src/instrumentations/http.ts
function registerNodeHttpInstrumentation(client, endpoint) {
  if (typeof globalThis.fetch !== "function") return () => {
  };
  const cleanEndpoint = endpoint ? endpoint.replace(/\/$/, "") : "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async function(input, init2) {
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (cleanEndpoint && rawUrl.includes(cleanEndpoint)) {
      return originalFetch.call(this, input, init2);
    }
    const method = (init2?.method || (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
    const sanitized = sanitizeUrl(rawUrl);
    const traceMgr = client.getTraceManager();
    const context = getContext();
    const { spanId } = traceMgr.startSpan(`${method} ${sanitized}`, "http.client");
    const traceId = context?.trace?.traceId || traceMgr.getTraceId();
    const requestId = context?.requestId || traceMgr.getRequestId();
    const headers = new Headers(init2?.headers || (typeof input === "object" && "headers" in input ? input.headers : {}));
    headers.set("traceparent", `00-${traceId}-${spanId}-01`);
    headers.set("x-trace-id", traceId);
    headers.set("x-request-id", requestId);
    const startTime = Date.now();
    client.addBreadcrumb({
      category: "request",
      message: `${method} ${sanitized}`,
      data: { method, url: sanitized, traceId, requestId, spanId }
    });
    try {
      const response = await originalFetch.call(this, input, {
        ...init2,
        headers
      });
      const durationMs = Date.now() - startTime;
      client.addBreadcrumb({
        category: "response",
        message: `${method} ${sanitized} -> ${response.status}`,
        level: response.ok ? "INFO" : "WARNING",
        data: { status: response.status, durationMs, traceId, requestId, ok: response.ok }
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
            requestId
          }
        }
      });
      return response;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      client.addBreadcrumb({
        category: "request",
        message: `${method} ${sanitized} failed: ${err.message}`,
        level: "ERROR",
        data: { error: err.message, durationMs, traceId, requestId }
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
            requestId
          }
        }
      });
      throw err;
    }
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

// src/node-client.ts
var NodeClient = class extends CoreClient {
  teardowns = [];
  constructor(options) {
    const endpoint = options.endpoint || (typeof process !== "undefined" ? process.env?.HALO_ENDPOINT : "http://localhost:3000/api");
    super({ ...options, endpoint }, "@halo-trace/sdk-node", "1.0.0");
    if (this.enabled) {
      this.installNodeInstrumentations(options, endpoint);
    }
  }
  installNodeInstrumentations(options, endpoint) {
    if (options.autoCapture !== false) {
      const unregisterProcess = registerProcessInstrumentation(this);
      this.teardowns.push(unregisterProcess);
    }
    if (options.captureHttp !== false) {
      const unregisterHttp = registerNodeHttpInstrumentation(this, endpoint);
      this.teardowns.push(unregisterHttp);
    }
    if (typeof process !== "undefined") {
      this.scope.setTag("node.version", process.version);
      this.scope.setTag("os.platform", process.platform);
      this.scope.setTag("os.arch", process.arch);
    }
  }
  close() {
    for (const teardown of this.teardowns) {
      try {
        teardown();
      } catch {
      }
    }
    this.teardowns = [];
    super.close();
  }
};

// src/index.ts
export * from "@halo-trace/sdk-core";
var defaultNodeClient = null;
function init(options) {
  if (defaultNodeClient) {
    defaultNodeClient.close();
  }
  defaultNodeClient = new NodeClient(options);
  return defaultNodeClient;
}
function getClient() {
  return defaultNodeClient;
}
export {
  NodeClient,
  getClient,
  getContext,
  getRequestId,
  getTraceId,
  init,
  registerNodeHttpInstrumentation,
  registerProcessInstrumentation,
  runWithContext
};
//# sourceMappingURL=index.js.map