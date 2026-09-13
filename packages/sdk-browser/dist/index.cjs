"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  BrowserClient: () => BrowserClient,
  ReplayBridge: () => ReplayBridge,
  getClient: () => getClient,
  init: () => init,
  registerConsoleInstrumentation: () => registerConsoleInstrumentation,
  registerErrorInstrumentation: () => registerErrorInstrumentation,
  registerHttpInstrumentation: () => registerHttpInstrumentation,
  registerLifecycleInstrumentation: () => registerLifecycleInstrumentation,
  registerPerformanceInstrumentation: () => registerPerformanceInstrumentation,
  registerSpaInstrumentation: () => registerSpaInstrumentation
});
module.exports = __toCommonJS(index_exports);

// src/browser-client.ts
var import_sdk_core4 = require("@halo-trace/sdk-core");

// src/instrumentations/errors.ts
function registerErrorInstrumentation(client, onFatalError) {
  if (typeof window === "undefined") return () => {
  };
  let inErrorHandler = false;
  const errorHandler = (event) => {
    if (inErrorHandler) return;
    inErrorHandler = true;
    try {
      if ("error" in event && event.error) {
        const err = event.error instanceof Error ? event.error : new Error(String(event.error));
        client.captureException(err, {
          metadata: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        });
        onFatalError?.(err);
      } else if ("target" in event && event.target && event.target.tagName) {
        const target = event.target;
        const src = target.getAttribute("src") || target.getAttribute("href") || "";
        client.captureException(new Error(`Failed to load resource: <${target.tagName.toLowerCase()}> ${src}`), {
          severity: "WARNING",
          metadata: {
            resource: src,
            tagName: target.tagName.toLowerCase()
          }
        });
      } else if ("message" in event) {
        client.captureException(new Error(event.message));
      }
    } catch {
    } finally {
      inErrorHandler = false;
    }
  };
  const rejectionHandler = (event) => {
    if (inErrorHandler) return;
    inErrorHandler = true;
    try {
      const reason = event.reason;
      const err = reason instanceof Error ? reason : new Error(typeof reason === "string" ? reason : "Unhandled Promise Rejection");
      client.captureException(err, {
        metadata: {
          unhandledRejection: true
        }
      });
      onFatalError?.(err);
    } catch {
    } finally {
      inErrorHandler = false;
    }
  };
  window.addEventListener("error", errorHandler, true);
  window.addEventListener("unhandledrejection", rejectionHandler);
  return () => {
    window.removeEventListener("error", errorHandler, true);
    window.removeEventListener("unhandledrejection", rejectionHandler);
  };
}

// src/instrumentations/http.ts
var import_sdk_core = require("@halo-trace/sdk-core");
function registerHttpInstrumentation(client, options = {}) {
  if (typeof window === "undefined") return () => {
  };
  const cleanEndpoint = options.endpoint ? options.endpoint.replace(/\/$/, "") : "/api";
  const shouldIgnore = (url) => {
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
  let originalFetch = null;
  if (typeof window.fetch === "function") {
    originalFetch = window.fetch;
    window.fetch = async function(input, init2) {
      const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (shouldIgnore(rawUrl)) {
        return originalFetch.call(this, input, init2);
      }
      const method = (init2?.method || (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
      const sanitized = (0, import_sdk_core.sanitizeUrl)(rawUrl);
      const traceMgr = client.getTraceManager();
      const { spanId, parentSpanId } = traceMgr.startSpan(`${method} ${sanitized}`, "http.client");
      const traceId = traceMgr.getTraceId();
      const requestId = traceMgr.getRequestId();
      const headers = new Headers(init2?.headers || (typeof input === "object" && "headers" in input ? input.headers : {}));
      traceMgr.injectHeaders({
        set: (k, v) => headers.set(k, v)
      });
      headers.set("traceparent", `00-${traceId}-${spanId}-01`);
      headers.set("x-trace-id", traceId);
      headers.set("x-request-id", requestId);
      const startTime = performance.now();
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
            ok: response.ok
          }
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
              headers: (0, import_sdk_core.sanitizeHeaders)(response.headers, options.allowlistHeaders)
            }
          }
        });
        return response;
      } catch (err) {
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
            requestId
          }
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
              requestId
            }
          }
        });
        throw err;
      }
    };
  }
  let originalOpen = null;
  let originalSend = null;
  if (typeof window.XMLHttpRequest === "function") {
    const proto = XMLHttpRequest.prototype;
    originalOpen = proto.open;
    originalSend = proto.send;
    proto.open = function(method, url, ...args) {
      const rawUrl = typeof url === "string" ? url : url.toString();
      this.__halo_req__ = {
        method: method.toUpperCase(),
        url: rawUrl,
        sanitizedUrl: (0, import_sdk_core.sanitizeUrl)(rawUrl),
        ignored: shouldIgnore(rawUrl)
      };
      return originalOpen.apply(this, [method, url, ...args]);
    };
    proto.send = function(...args) {
      const req = this.__halo_req__;
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
          data: { status, durationMs, traceId, requestId, ok }
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
              requestId
            }
          }
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

// src/instrumentations/console.ts
var import_sdk_core2 = require("@halo-trace/sdk-core");
var CONSOLE_LEVELS = ["log", "info", "warn", "error", "debug"];
function registerConsoleInstrumentation(client) {
  if (typeof console === "undefined") return () => {
  };
  const originals = {};
  let isInternal = false;
  for (const level of CONSOLE_LEVELS) {
    if (typeof console[level] === "function") {
      originals[level] = console[level];
      console[level] = function(...args) {
        try {
          originals[level].apply(console, args);
        } catch {
        }
        if (isInternal) return;
        isInternal = true;
        try {
          const message = args.map((arg) => typeof arg === "string" ? arg : JSON.stringify((0, import_sdk_core2.safeSerialize)(arg, 2, 200, 10))).join(" ");
          const safeArgs = args.map((arg) => (0, import_sdk_core2.safeSerialize)(arg, 3, 500, 20));
          client.addBreadcrumb({
            category: "console",
            message: message.slice(0, 1e3),
            level: level === "error" ? "ERROR" : level === "warn" ? "WARNING" : "INFO",
            data: {
              level,
              arguments: safeArgs
            }
          });
        } catch {
        } finally {
          isInternal = false;
        }
      };
    }
  }
  return () => {
    for (const [level, fn] of Object.entries(originals)) {
      console[level] = fn;
    }
  };
}

// src/instrumentations/spa.ts
var import_sdk_core3 = require("@halo-trace/sdk-core");
function registerSpaInstrumentation(client) {
  if (typeof window === "undefined" || !window.history) return () => {
  };
  let currentUrl = (0, import_sdk_core3.sanitizeUrl)(window.location.href);
  const recordNavigation = (toUrl, type) => {
    const sanitizedTo = (0, import_sdk_core3.sanitizeUrl)(toUrl);
    if (sanitizedTo === currentUrl) return;
    const from = currentUrl;
    currentUrl = sanitizedTo;
    client.addBreadcrumb({
      category: "navigation",
      message: `Navigated from ${from} to ${sanitizedTo}`,
      data: {
        from,
        to: sanitizedTo,
        type
      }
    });
  };
  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;
  window.history.pushState = function(...args) {
    const res = originalPushState.apply(this, args);
    try {
      const url = args[2] ? String(args[2]) : window.location.href;
      recordNavigation(url, "pushState");
    } catch {
    }
    return res;
  };
  window.history.replaceState = function(...args) {
    const res = originalReplaceState.apply(this, args);
    try {
      const url = args[2] ? String(args[2]) : window.location.href;
      recordNavigation(url, "replaceState");
    } catch {
    }
    return res;
  };
  const onPopState = () => recordNavigation(window.location.href, "popstate");
  const onHashChange = () => recordNavigation(window.location.href, "hashchange");
  window.addEventListener("popstate", onPopState);
  window.addEventListener("hashchange", onHashChange);
  return () => {
    window.history.pushState = originalPushState;
    window.history.replaceState = originalReplaceState;
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener("hashchange", onHashChange);
  };
}

// src/instrumentations/lifecycle.ts
function registerLifecycleInstrumentation(client) {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {
  };
  const onVisibilityChange = () => {
    const state = document.visibilityState;
    client.addBreadcrumb({
      category: "lifecycle",
      message: `Visibility changed to ${state}`,
      data: { state }
    });
    if (state === "hidden") {
      void client.flush();
    }
  };
  const onPageHide = (e) => {
    client.addBreadcrumb({
      category: "lifecycle",
      message: `Page hide (persisted: ${e.persisted})`,
      data: { persisted: e.persisted }
    });
    void client.flush();
  };
  const onBeforeUnload = () => {
    void client.flush();
  };
  const onFreeze = () => {
    client.addBreadcrumb({
      category: "lifecycle",
      message: "Lifecycle state: frozen (bfcache)"
    });
    void client.flush();
  };
  const onResume = () => {
    client.addBreadcrumb({
      category: "lifecycle",
      message: "Lifecycle state: resumed"
    });
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("beforeunload", onBeforeUnload);
  document.addEventListener("freeze", onFreeze);
  document.addEventListener("resume", onResume);
  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("beforeunload", onBeforeUnload);
    document.removeEventListener("freeze", onFreeze);
    document.removeEventListener("resume", onResume);
  };
}

// src/instrumentations/performance.ts
function registerPerformanceInstrumentation(client) {
  if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") {
    return () => {
    };
  }
  const observers = [];
  const safeObserve = (type, callback) => {
    try {
      if (PerformanceObserver.supportedEntryTypes && !PerformanceObserver.supportedEntryTypes.includes(type)) {
        return;
      }
      const observer = new PerformanceObserver((list) => {
        callback(list.getEntries());
      });
      observer.observe({ type, buffered: true });
      observers.push(observer);
    } catch {
    }
  };
  safeObserve("paint", (entries) => {
    for (const entry of entries) {
      if (entry.name === "first-contentful-paint") {
        client.addBreadcrumb({
          category: "performance",
          message: `First Contentful Paint: ${Math.round(entry.startTime)}ms`,
          data: { fcpMs: Math.round(entry.startTime) }
        });
      }
    }
  });
  safeObserve("largest-contentful-paint", (entries) => {
    const last = entries[entries.length - 1];
    if (last) {
      client.addBreadcrumb({
        category: "performance",
        message: `Largest Contentful Paint: ${Math.round(last.startTime)}ms`,
        data: { lcpMs: Math.round(last.startTime) }
      });
    }
  });
  safeObserve("longtask", (entries) => {
    for (const entry of entries) {
      if (entry.duration >= 100) {
        client.addBreadcrumb({
          category: "performance",
          message: `Long task blocking main thread: ${Math.round(entry.duration)}ms`,
          level: "WARNING",
          data: { durationMs: Math.round(entry.duration), startTime: Math.round(entry.startTime) }
        });
      }
    }
  });
  let clsValue = 0;
  safeObserve("layout-shift", (entries) => {
    for (const entry of entries) {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
      }
    }
    if (clsValue > 0.1) {
      client.addBreadcrumb({
        category: "performance",
        message: `Cumulative Layout Shift: ${clsValue.toFixed(3)}`,
        data: { cls: clsValue }
      });
    }
  });
  return () => {
    for (const obs of observers) {
      try {
        obs.disconnect();
      } catch {
      }
    }
  };
}

// src/replay-bridge.ts
var ReplayBridge = class {
  replayInstance = null;
  client;
  config;
  constructor(client, config) {
    this.client = client;
    this.config = config;
  }
  async initialize(endpoint, apiKey) {
    if (!this.config?.enabled && this.config?.enabled !== void 0) {
      return;
    }
    try {
      let ReplayModule = null;
      if (typeof window !== "undefined" && window.HaloReplayBundle?.HaloReplay) {
        ReplayModule = window.HaloReplayBundle;
      } else {
        try {
          ReplayModule = await import("@halo-trace/replay");
        } catch {
          return;
        }
      }
      if (!ReplayModule?.HaloReplay) return;
      const sessionId = this.client.getSessionId();
      const replay = new ReplayModule.HaloReplay({
        apiKey,
        endpoint,
        sessionId,
        samplingRate: this.config?.samplingRate ?? 1,
        errorTriggered: this.config?.errorTriggered ?? true,
        preErrorBufferSeconds: this.config?.preErrorBufferSeconds,
        postErrorDurationSeconds: this.config?.postErrorDurationSeconds,
        maxBufferEvents: this.config?.maxBufferEvents,
        flushIntervalMs: this.config?.flushIntervalMs,
        recordCanvas: this.config?.recordCanvas ?? false,
        privacy: this.config?.privacy
      });
      replay.start();
      this.replayInstance = replay;
      if (typeof window !== "undefined") {
        window.__HALO_REPLAY__ = replay;
      }
    } catch (err) {
      console.warn("[Halo SDK] Failed to initialize session replay bridge:", err);
    }
  }
  triggerError(error, traceId, requestId) {
    if (this.replayInstance && typeof this.replayInstance.triggerErrorReplay === "function") {
      try {
        this.replayInstance.triggerErrorReplay({
          title: error.message || error.name,
          stack: error.stack,
          traceId,
          requestId
        });
      } catch {
      }
    }
  }
  setIssueId(issueId) {
    if (this.replayInstance && typeof this.replayInstance.setIssueId === "function") {
      try {
        this.replayInstance.setIssueId(issueId);
      } catch {
      }
    }
  }
  openFeedbackModal(options) {
    if (this.replayInstance && typeof this.replayInstance.openFeedbackModal === "function") {
      return this.replayInstance.openFeedbackModal(options);
    }
    return null;
  }
  flush() {
    if (this.replayInstance && typeof this.replayInstance.flushAndConclude === "function") {
      try {
        this.replayInstance.flushAndConclude();
      } catch {
      }
    }
  }
  stop() {
    if (this.replayInstance && typeof this.replayInstance.stop === "function") {
      try {
        this.replayInstance.stop();
      } catch {
      }
    }
  }
  getInstance() {
    return this.replayInstance;
  }
};

// src/browser-client.ts
var BrowserClient = class extends import_sdk_core4.CoreClient {
  replayBridge;
  teardowns = [];
  constructor(options) {
    const endpoint = options.endpoint || (typeof window !== "undefined" ? "/api" : "http://localhost:3000/api");
    super({ ...options, endpoint }, "@halo-trace/sdk-browser", "1.0.0");
    if (typeof window !== "undefined") {
      window.__HALO_SESSION_ID__ = this.session.getSessionId();
      window.__HALO_SDK__ = this;
    }
    this.replayBridge = new ReplayBridge(this, options.replay);
    if (this.enabled) {
      this.installInstrumentations(options, endpoint);
    }
  }
  installInstrumentations(options, endpoint) {
    if (options.autoCapture !== false) {
      const unregisterErrors = registerErrorInstrumentation(this, (err) => {
        this.replayBridge.triggerError(err, this.trace.getTraceId(), this.trace.getRequestId());
      });
      this.teardowns.push(unregisterErrors);
    }
    if (options.captureHttp !== false) {
      const unregisterHttp = registerHttpInstrumentation(this, {
        endpoint,
        ignoreUrls: options.privacy?.ignoreUrls,
        allowlistHeaders: options.privacy?.allowlistHeaders
      });
      this.teardowns.push(unregisterHttp);
    }
    if (options.captureConsole !== false) {
      const unregisterConsole = registerConsoleInstrumentation(this);
      this.teardowns.push(unregisterConsole);
    }
    if (options.captureNavigation !== false) {
      const unregisterSpa = registerSpaInstrumentation(this);
      this.teardowns.push(unregisterSpa);
    }
    const unregisterLifecycle = registerLifecycleInstrumentation(this);
    this.teardowns.push(unregisterLifecycle);
    if (options.capturePerformance !== false) {
      const unregisterPerf = registerPerformanceInstrumentation(this);
      this.teardowns.push(unregisterPerf);
    }
    if (options.apiKey) {
      void this.replayBridge.initialize(endpoint, options.apiKey);
    }
  }
  get replay() {
    return this.replayBridge;
  }
  openFeedbackModal(options) {
    return this.replayBridge.openFeedbackModal(options);
  }
  captureException(error, additional) {
    const err = error instanceof Error ? error : new Error(String(error));
    this.replayBridge.triggerError(err, this.trace.getTraceId(), this.trace.getRequestId());
    return super.captureException(error, additional);
  }
  close() {
    for (const teardown of this.teardowns) {
      try {
        teardown();
      } catch {
      }
    }
    this.teardowns = [];
    this.replayBridge.stop();
    super.close();
  }
};

// src/index.ts
__reExport(index_exports, require("@halo-trace/sdk-core"), module.exports);
var defaultClient = null;
function init(options) {
  if (defaultClient) {
    defaultClient.close();
  }
  defaultClient = new BrowserClient(options);
  return defaultClient;
}
function getClient() {
  return defaultClient;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BrowserClient,
  ReplayBridge,
  getClient,
  init,
  registerConsoleInstrumentation,
  registerErrorInstrumentation,
  registerHttpInstrumentation,
  registerLifecycleInstrumentation,
  registerPerformanceInstrumentation,
  registerSpaInstrumentation,
  ...require("@halo-trace/sdk-core")
});
//# sourceMappingURL=index.cjs.map