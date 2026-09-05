// src/client.ts
var HaloClient = class {
  constructor(endpoint, apiKey) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
  }
  endpoint;
  apiKey;
  async post(path, body) {
    const response = await fetch(
      `${this.endpoint}${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(
          body
        )
      }
    );
    if (!response.ok) {
      throw new Error(
        `Halo request failed (${response.status})`
      );
    }
    return response.json();
  }
};

// src/capture.ts
function registerGlobalHandlers(halo) {
  if (typeof process !== "undefined" && typeof process.on === "function") {
    process.on(
      "uncaughtException",
      async (error) => {
        try {
          await halo.captureException(
            error
          );
          await halo.flush();
        } finally {
          process.exit(1);
        }
      }
    );
    process.on(
      "unhandledRejection",
      async (reason) => {
        try {
          await halo.captureException(
            reason
          );
          await halo.flush();
        } finally {
          process.exit(1);
        }
      }
    );
  }
  if (typeof window !== "undefined") {
    window.addEventListener(
      "error",
      (event) => {
        void halo.captureException(
          event.error ?? event.message
        ).catch(() => {
        });
      }
    );
    window.addEventListener(
      "unhandledrejection",
      (event) => {
        void halo.captureException(
          event.reason
        ).catch(() => {
        });
      }
    );
  }
}

// src/queue.ts
var EventQueue = class {
  queue = [];
  processing = false;
  upload;
  constructor(upload) {
    this.upload = upload;
  }
  async enqueue(event) {
    this.queue.push(event);
    if (!this.processing) {
      await this.process();
    }
  }
  async flush() {
    while (this.processing || this.queue.length > 0) {
      await new Promise(
        (resolve) => setTimeout(resolve, 10)
      );
    }
  }
  async process() {
    this.processing = true;
    while (this.queue.length > 0) {
      const event = this.queue.shift();
      if (!event) {
        continue;
      }
      try {
        await this.upload(event);
      } catch (error) {
        console.error(
          "[Halo] Failed to upload event:",
          error
        );
      }
    }
    this.processing = false;
  }
};

// src/request-context.ts
var currentContext;
function createRequestContext(values) {
  return {
    requestId: values?.requestId ?? createId("req"),
    traceId: values?.traceId ?? createId("trace"),
    method: values?.method,
    url: values?.url,
    resource: values?.resource,
    startedAt: values?.startedAt ?? Date.now()
  };
}
function getRequestContext() {
  return currentContext;
}
async function runWithRequestContext(context, callback) {
  const previous = currentContext;
  currentContext = context;
  try {
    return await callback();
  } finally {
    currentContext = previous;
  }
}
function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

// src/http.ts
var installed = false;
function registerHttpInstrumentation(halo, options) {
  if (installed) {
    return;
  }
  if (typeof globalThis.fetch !== "function") {
    return;
  }
  const originalFetch = globalThis.fetch.bind(
    globalThis
  );
  const endpoint = normalizeEndpoint(
    options.endpoint
  );
  globalThis.fetch = async (input, init) => {
    const url = getRequestUrl(input);
    if (shouldIgnore(
      url,
      endpoint,
      options.ignoreUrls
    )) {
      return originalFetch(
        input,
        init
      );
    }
    const method = getRequestMethod(
      input,
      init
    );
    const resource = getResource(url);
    const requestContext = createRequestContext({
      method,
      url,
      resource
    });
    return runWithRequestContext(
      requestContext,
      async () => {
        const startedAt = performanceNow();
        const {
          requestId,
          traceId
        } = requestContext;
        halo.addBreadcrumb({
          category: "http",
          message: `${method} ${resource}`,
          data: {
            requestId,
            traceId,
            method,
            resource
          }
        });
        try {
          const response = await originalFetch(
            input,
            init
          );
          const durationMs = Math.max(
            0,
            Math.round(
              performanceNow() - startedAt
            )
          );
          void halo.capturePerformance({
            title: `${method} ${resource}`,
            durationMs,
            operation: method,
            resource,
            status: response.status,
            requestId,
            traceId,
            metadata: {
              http: {
                method,
                status: response.status,
                ok: response.ok,
                failed: response.status >= 400,
                url,
                ...options.captureHeaders ? {
                  headers: getSafeResponseHeaders(
                    response.headers
                  )
                } : {}
              }
            }
          }).catch(() => {
          });
          halo.addBreadcrumb({
            category: "http",
            message: `${method} ${resource} \u2192 ${response.status}`,
            data: {
              requestId,
              traceId,
              method,
              resource,
              status: response.status,
              durationMs
            }
          });
          return response;
        } catch (error) {
          const durationMs = Math.max(
            0,
            Math.round(
              performanceNow() - startedAt
            )
          );
          void halo.capturePerformance({
            title: `${method} ${resource}`,
            durationMs,
            operation: method,
            resource,
            status: "ERROR",
            requestId,
            traceId,
            metadata: {
              http: {
                method,
                url,
                failed: true,
                error: normalizeError(
                  error
                ),
                ...options.captureHeaders ? {
                  requestHeaders: getSafeRequestHeaders(
                    input,
                    init
                  )
                } : {}
              }
            }
          }).catch(() => {
          });
          halo.addBreadcrumb({
            category: "http",
            message: `${method} ${resource} \u2192 network error`,
            data: {
              requestId,
              traceId,
              method,
              resource,
              durationMs
            }
          });
          throw error;
        }
      }
    );
  };
  installed = true;
}
function getRequestUrl(input) {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}
function getRequestMethod(input, init) {
  const method = init?.method ?? (typeof input === "string" || input instanceof URL ? "GET" : input.method) ?? "GET";
  return method.toUpperCase();
}
function getResource(url) {
  try {
    const parsed = new URL(
      url,
      "http://localhost"
    );
    return parsed.pathname;
  } catch {
    return url;
  }
}
function normalizeEndpoint(endpoint) {
  return endpoint.replace(
    /\/+$/,
    ""
  );
}
function shouldIgnore(url, endpoint, ignoreUrls) {
  if (url === endpoint || url.startsWith(
    `${endpoint}/`
  )) {
    return true;
  }
  return ignoreUrls?.some(
    (ignored) => ignored.length > 0 && url.includes(ignored)
  ) ?? false;
}
function performanceNow() {
  if (typeof performance !== "undefined") {
    return performance.now();
  }
  return Date.now();
}
function normalizeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    };
  }
  return {
    message: String(error)
  };
}
var SAFE_HEADERS = /* @__PURE__ */ new Set([
  "accept",
  "content-type",
  "content-length",
  "user-agent",
  "cache-control",
  "accept-language",
  "accept-encoding"
]);
function getSafeRequestHeaders(input, init) {
  const headers = new Headers();
  if (typeof input !== "string" && !(input instanceof URL)) {
    input.headers?.forEach(
      (value, key) => {
        headers.set(
          key,
          value
        );
      }
    );
  }
  if (init?.headers) {
    new Headers(
      init.headers
    ).forEach(
      (value, key) => {
        headers.set(
          key,
          value
        );
      }
    );
  }
  return filterSafeHeaders(
    headers
  );
}
function getSafeResponseHeaders(headers) {
  return filterSafeHeaders(
    headers
  );
}
function filterSafeHeaders(headers) {
  const result = {};
  headers.forEach(
    (value, key) => {
      const normalized = key.toLowerCase();
      if (SAFE_HEADERS.has(
        normalized
      )) {
        result[normalized] = value;
      }
    }
  );
  return result;
}

// src/halo.ts
var SDK_NAME = "@halo/sdk";
var SDK_VERSION = "0.1.0";
function createSessionId() {
  return `hs_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}
var Halo = class {
  client;
  enabled;
  service;
  release;
  environment;
  user;
  queue;
  tags = {};
  breadcrumbs = [];
  sessionId;
  sessionStartedAt;
  maxBreadcrumbs;
  onEventIngested;
  constructor(options) {
    let endpoint = options.endpoint;
    if (!endpoint) {
      if (typeof process !== "undefined" && process.env?.HALO_ENDPOINT) {
        endpoint = process.env.HALO_ENDPOINT;
      } else if (typeof window !== "undefined") {
        endpoint = "/api";
      } else if (process.env?.NODE_ENV !== "production") {
        endpoint = "http://localhost:3000/api";
        console.warn(
          "[Halo] No endpoint specified. Defaulting to 'http://localhost:3000/api' for local development. In production, pass 'endpoint' to Halo options or set HALO_ENDPOINT."
        );
      } else {
        throw new Error(
          "[Halo] 'endpoint' is required when initializing Halo in a production server/runtime environment. Please provide options.endpoint or set HALO_ENDPOINT."
        );
      }
    }
    endpoint = endpoint.replace(/\/$/, "");
    this.client = new HaloClient(
      endpoint,
      options.apiKey
    );
    this.queue = new EventQueue(
      async (event) => {
        const res = await this.client.post(
          "/ingest/events",
          event
        );
        if (res && typeof res === "object") {
          const parsed = res;
          this.onEventIngested?.(parsed);
          if (typeof window !== "undefined" && parsed.issueId) {
            try {
              window.__HALO_REPLAY__?.setIssueId(parsed.issueId);
            } catch {
            }
          }
        }
        return res;
      }
    );
    this.enabled = options.enabled ?? true;
    this.service = options.service;
    this.release = options.release;
    this.environment = options.environment;
    this.maxBreadcrumbs = Math.max(
      1,
      options.maxBreadcrumbs ?? 100
    );
    const globalSessionId = typeof window !== "undefined" ? window.__HALO_SESSION_ID__ : void 0;
    this.sessionId = options.sessionId || globalSessionId || (typeof window !== "undefined" ? createSessionId() : void 0);
    if (this.sessionId) {
      this.sessionStartedAt = (/* @__PURE__ */ new Date()).toISOString();
      if (typeof window !== "undefined") {
        window.__HALO_SESSION_ID__ = this.sessionId;
        window.__HALO_SDK__ = this;
      }
    }
    if (options.autoCapture !== false) {
      registerGlobalHandlers(
        this
      );
      if (options.captureHttp !== false) {
        registerHttpInstrumentation(
          this,
          {
            endpoint,
            captureHeaders: options.captureHttpHeaders,
            ignoreUrls: options.ignoreUrls
          }
        );
      }
    }
  }
  startSession() {
    this.sessionId = createSessionId();
    this.sessionStartedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (typeof window !== "undefined") {
      window.__HALO_SESSION_ID__ = this.sessionId;
      window.__HALO_SDK__ = this;
    }
    return this.sessionId;
  }
  endSession() {
  }
  getSessionId() {
    return this.sessionId;
  }
  setUser(user) {
    this.user = user;
  }
  clearUser() {
    this.user = void 0;
  }
  /**
   * Register a callback that is invoked whenever an event is ingested by the Halo backend.
   */
  onEventIngestedCallback(callback) {
    this.onEventIngested = callback;
  }
  setTag(key, value) {
    this.tags[key] = value;
  }
  removeTag(key) {
    delete this.tags[key];
  }
  addBreadcrumb(breadcrumb) {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: breadcrumb.timestamp ?? (/* @__PURE__ */ new Date()).toISOString()
    });
    while (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }
  clearBreadcrumbs() {
    this.breadcrumbs = [];
  }
  async flush() {
    await this.queue.flush();
  }
  async captureMessage(message) {
    return this.capture({
      type: "MESSAGE",
      title: message,
      message,
      severity: "INFO"
    });
  }
  async captureException(error) {
    const exception = error instanceof Error ? error : new Error(
      String(error)
    );
    const context = getRequestContext();
    if (typeof window !== "undefined" && window.__HALO_REPLAY__) {
      try {
        window.__HALO_REPLAY__.triggerErrorReplay({
          title: exception.message || exception.name,
          stack: exception.stack,
          traceId: context?.traceId,
          requestId: context?.requestId
        });
      } catch {
      }
    }
    return this.capture({
      type: "ERROR",
      title: exception.message || exception.name,
      message: exception.message,
      severity: "ERROR",
      stack: exception.stack,
      requestId: context?.requestId,
      traceId: context?.traceId
    });
  }
  async capturePerformance(options) {
    return this.capture({
      type: "TRACE",
      title: options.title,
      severity: "INFO",
      durationMs: options.durationMs,
      operation: options.operation,
      resource: options.resource,
      status: options.status,
      service: options.service,
      tags: options.tags,
      metadata: options.metadata,
      requestId: options.requestId,
      traceId: options.traceId
    });
  }
  async capture(event) {
    if (!this.enabled) {
      return;
    }
    const context = getRequestContext();
    return this.queue.enqueue({
      type: event.type,
      title: event.title,
      message: event.message,
      severity: event.severity ?? "INFO",
      timestamp: event.timestamp ?? (/* @__PURE__ */ new Date()).toISOString(),
      stack: event.stack,
      fingerprint: event.fingerprint,
      metadata: event.metadata,
      tags: {
        ...this.tags,
        ...event.tags ?? {}
      },
      breadcrumbs: [
        ...this.breadcrumbs,
        ...event.breadcrumbs ?? []
      ],
      user: event.user ?? this.user,
      sessionId: event.sessionId ?? this.sessionId,
      sdkName: SDK_NAME,
      sdkVersion: SDK_VERSION,
      release: this.release,
      environment: this.environment,
      sessionStartedAt: this.sessionStartedAt,
      /*
       * Explicit event context
       * takes priority.
       *
       * Otherwise inherit the
       * active HTTP context.
       */
      requestId: event.requestId ?? context?.requestId,
      traceId: event.traceId ?? context?.traceId,
      service: event.service ?? this.service,
      resource: event.resource,
      operation: event.operation,
      status: event.status,
      durationMs: event.durationMs
    });
  }
};
export {
  Halo
};
//# sourceMappingURL=index.js.map