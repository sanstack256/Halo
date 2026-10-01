// ../sdk-types/dist/index.js
var SDK_PUBLIC_ENDPOINT = typeof process !== "undefined" && (process.env?.NEXT_PUBLIC_HALO_ENDPOINT || process.env?.HALO_ENDPOINT) || "https://halo-trace-ten.vercel.app/api";

// ../sdk-core/dist/index.js
var Scope = class _Scope {
  user;
  tags = {};
  contexts = {};
  release;
  environment;
  service;
  deployment;
  baggage = {};
  listeners = [];
  constructor(initial) {
    if (initial) {
      this.user = initial.user ? { ...initial.user } : void 0;
      this.tags = initial.tags ? { ...initial.tags } : {};
      this.contexts = initial.contexts ? { ...initial.contexts } : {};
      this.release = initial.release;
      this.environment = initial.environment;
      this.service = initial.service;
      this.deployment = initial.deployment;
      this.baggage = initial.baggage ? { ...initial.baggage } : {};
    }
  }
  setUser(user) {
    this.user = user ? { ...user } : void 0;
    this.notify();
    return this;
  }
  getUser() {
    return this.user ? { ...this.user } : void 0;
  }
  clearUser() {
    this.user = void 0;
    this.notify();
    return this;
  }
  setTag(key, value) {
    this.tags[key] = value;
    this.notify();
    return this;
  }
  setTags(tags) {
    Object.assign(this.tags, tags);
    this.notify();
    return this;
  }
  removeTag(key) {
    delete this.tags[key];
    this.notify();
    return this;
  }
  getTags() {
    return { ...this.tags };
  }
  setContext(name, data) {
    this.contexts[name] = { ...data };
    this.notify();
    return this;
  }
  setContexts(contexts) {
    for (const [k, v] of Object.entries(contexts)) {
      this.contexts[k] = { ...v };
    }
    this.notify();
    return this;
  }
  getContexts() {
    return JSON.parse(JSON.stringify(this.contexts));
  }
  setRelease(release) {
    this.release = release;
    this.notify();
    return this;
  }
  getRelease() {
    return this.release;
  }
  setEnvironment(environment) {
    this.environment = environment;
    this.notify();
    return this;
  }
  getEnvironment() {
    return this.environment;
  }
  setService(service) {
    this.service = service;
    this.notify();
    return this;
  }
  getService() {
    return this.service;
  }
  setDeployment(deployment) {
    this.deployment = deployment;
    this.notify();
    return this;
  }
  getDeployment() {
    return this.deployment;
  }
  setBaggage(key, value) {
    this.baggage[key] = value;
    this.notify();
    return this;
  }
  getBaggage() {
    return { ...this.baggage };
  }
  clone() {
    const s = new _Scope();
    s.user = this.user ? { ...this.user } : void 0;
    s.tags = { ...this.tags };
    s.contexts = JSON.parse(JSON.stringify(this.contexts));
    s.release = this.release;
    s.environment = this.environment;
    s.service = this.service;
    s.deployment = this.deployment;
    s.baggage = { ...this.baggage };
    return s;
  }
  onScopeChange(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this);
      } catch {
      }
    }
  }
};
function generateSessionId() {
  return `hs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
var SessionManager = class {
  sessionId;
  startedAt;
  lastSeenAt;
  sequence = 0;
  crashed = false;
  constructor(existingSessionId) {
    this.sessionId = existingSessionId || generateSessionId();
    this.startedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.lastSeenAt = this.startedAt;
  }
  getSessionId() {
    return this.sessionId;
  }
  getStartedAt() {
    return this.startedAt;
  }
  getLastSeenAt() {
    return this.lastSeenAt;
  }
  nextSequence() {
    return this.sequence++;
  }
  touch() {
    this.lastSeenAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  markCrashed() {
    this.crashed = true;
    this.touch();
  }
  isCrashed() {
    return this.crashed;
  }
  rotate() {
    this.sessionId = generateSessionId();
    this.startedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.lastSeenAt = this.startedAt;
    this.sequence = 0;
    this.crashed = false;
    return this.sessionId;
  }
};
function generateTraceId() {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[0] = bytes[0] || 1;
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function generateSpanId() {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[0] = bytes[0] || 1;
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
function parseTraceParent(header) {
  if (!header || typeof header !== "string") return null;
  const parts = header.trim().split("-");
  if (parts.length < 4) return null;
  const [version, traceId, spanId, flags] = parts;
  if (version !== "00" && version !== "ff") {
  }
  if (!/^[0-9a-f]{32}$/.test(traceId) || traceId === "00000000000000000000000000000000") {
    return null;
  }
  if (!/^[0-9a-f]{16}$/.test(spanId) || spanId === "0000000000000000") {
    return null;
  }
  return {
    traceId,
    spanId,
    sampled: flags === "01",
    traceFlags: flags
  };
}
function formatTraceParent(context) {
  const flags = context.sampled ? "01" : context.traceFlags || "01";
  return `00-${context.traceId}-${context.spanId}-${flags}`;
}
var TraceContextManager = class {
  currentContext;
  currentRequestId;
  constructor(initialTrace, initialRequestId) {
    this.currentContext = {
      traceId: initialTrace?.traceId || generateTraceId(),
      spanId: initialTrace?.spanId || generateSpanId(),
      parentSpanId: initialTrace?.parentSpanId,
      sampled: initialTrace?.sampled ?? true,
      traceFlags: initialTrace?.traceFlags || "01",
      traceState: initialTrace?.traceState,
      baggage: initialTrace?.baggage ? { ...initialTrace.baggage } : {}
    };
    this.currentRequestId = initialRequestId || generateRequestId();
  }
  getContext() {
    return { ...this.currentContext, baggage: { ...this.currentContext.baggage } };
  }
  getTraceId() {
    return this.currentContext.traceId;
  }
  getSpanId() {
    return this.currentContext.spanId;
  }
  getRequestId() {
    return this.currentRequestId;
  }
  startSpan(name, parentSpanId) {
    const parent = parentSpanId || this.currentContext.spanId;
    const newSpanId = generateSpanId();
    this.currentContext.parentSpanId = parent;
    this.currentContext.spanId = newSpanId;
    return { spanId: newSpanId, parentSpanId: parent };
  }
  injectHeaders(headers) {
    headers["traceparent"] = formatTraceParent(this.currentContext);
    if (this.currentContext.traceState) {
      headers["tracestate"] = this.currentContext.traceState;
    }
    headers["x-trace-id"] = this.currentContext.traceId;
    headers["x-request-id"] = this.currentRequestId;
    return headers;
  }
  extractHeaders(headers) {
    const get = (key) => {
      if (typeof headers?.get === "function") {
        return headers.get(key);
      }
      const record = headers;
      return record[key] || record[key.toLowerCase()] || null;
    };
    const traceparent = get("traceparent");
    if (traceparent) {
      const parsed = parseTraceParent(traceparent);
      if (parsed) {
        this.currentContext = parsed;
      }
    } else {
      const customTraceId = get("x-trace-id");
      if (customTraceId) {
        this.currentContext.traceId = customTraceId;
      }
    }
    const customReqId = get("x-request-id");
    if (customReqId) {
      this.currentRequestId = customReqId;
    }
  }
};
var BreadcrumbRingBuffer = class {
  capacity;
  buffer = [];
  constructor(capacity = 100) {
    this.capacity = Math.max(1, capacity);
  }
  add(breadcrumb) {
    this.buffer.push(breadcrumb);
    if (this.buffer.length > this.capacity) {
      this.buffer.shift();
    }
  }
  getAll() {
    return [...this.buffer];
  }
  clear() {
    this.buffer = [];
  }
  size() {
    return this.buffer.length;
  }
  getCapacity() {
    return this.capacity;
  }
};
var SENSITIVE_QUERY_PARAMS = /* @__PURE__ */ new Set([
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "password",
  "passwd",
  "secret",
  "api_key",
  "apikey",
  "auth",
  "key",
  "code",
  "session",
  "ssn",
  "cvv",
  "cvc",
  "credit_card",
  "card_number"
]);
var SENSITIVE_HEADERS = /* @__PURE__ */ new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "x-api-key",
  "x-halo-api-key"
]);
var SENSITIVE_KEY_REGEX = /(password|passwd|secret|api_?key|token|auth|bearer|cvv|cvc|ssn|credit_?card)/i;
var CREDIT_CARD_REGEX = /\b(?:\d{4}[ -]?){3}\d{4}\b|\b\d{15,16}\b/g;
var BEARER_TOKEN_REGEX = /Bearer\s+[A-Za-z0-9_\-\.=]+/gi;
function sanitizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  try {
    const parsed = new URL(rawUrl, "http://localhost");
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.set(key, "[REDACTED]");
      }
    }
    if (rawUrl.startsWith("/")) {
      return parsed.pathname + parsed.search;
    }
    return parsed.toString();
  } catch {
    return rawUrl.replace(/([?&](?:token|password|secret|key|auth)=)[^&]+/gi, "$1[REDACTED]");
  }
}
function sanitizeHeaders(headers, allowlist) {
  const result = {};
  const allowSet = allowlist ? new Set(allowlist.map((h) => h.toLowerCase())) : null;
  const entries = typeof headers?.entries === "function" ? Array.from(headers.entries()) : Object.entries(headers);
  for (const [k, v] of entries) {
    if (!v) continue;
    const lower = k.toLowerCase();
    if (SENSITIVE_HEADERS.has(lower)) {
      continue;
    }
    if (allowSet && !allowSet.has(lower)) {
      continue;
    }
    result[k] = String(v).replace(BEARER_TOKEN_REGEX, "Bearer [REDACTED]");
  }
  return result;
}
function sanitizeText(text) {
  if (!text || typeof text !== "string") return "";
  return text.replace(BEARER_TOKEN_REGEX, "Bearer [REDACTED]").replace(CREDIT_CARD_REGEX, "[CARD_REDACTED]");
}
function sanitizeObject(obj, maxDepth = 5, currentDepth = 0, seen = /* @__PURE__ */ new WeakSet()) {
  if (obj === null || typeof obj !== "object") {
    if (typeof obj === "string") {
      return sanitizeText(obj);
    }
    return obj;
  }
  if (currentDepth >= maxDepth) {
    return "[DEPTH_LIMIT]";
  }
  if (seen.has(obj)) {
    return "[CIRCULAR]";
  }
  seen.add(obj);
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, maxDepth, currentDepth + 1, seen));
  }
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEY_REGEX.test(key)) {
      cleaned[key] = "[REDACTED]";
    } else {
      cleaned[key] = sanitizeObject(value, maxDepth, currentDepth + 1, seen);
    }
  }
  return cleaned;
}
function safeSerialize(value, maxDepth = 4, maxLength = 1e3, maxKeys = 50, currentDepth = 0, seen = /* @__PURE__ */ new WeakSet()) {
  if (value === null || value === void 0) {
    return value;
  }
  if (typeof value === "string") {
    return value.length > maxLength ? value.slice(0, maxLength) + "\u2026 [TRUNCATED]" : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "bigint") {
    return value.toString() + "n";
  }
  if (typeof value === "symbol") {
    return value.toString();
  }
  if (typeof value === "function") {
    return `[Function: ${value.name || "anonymous"}]`;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ? safeSerialize(value.stack, 1, 2e3, 10, 0, seen) : void 0
    };
  }
  if (typeof value?.nodeType === "number") {
    const el = value;
    return `<${el.tagName ? el.tagName.toLowerCase() : "node"}${el.id ? ` id="${el.id}"` : ""}${el.className ? ` class="${el.className}"` : ""}>`;
  }
  if (currentDepth >= maxDepth) {
    return "[DEPTH_LIMIT]";
  }
  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[CIRCULAR]";
    }
    seen.add(value);
    if (Array.isArray(value)) {
      const arr = value.slice(0, maxKeys);
      const res2 = arr.map((item) => safeSerialize(item, maxDepth, maxLength, maxKeys, currentDepth + 1, seen));
      if (value.length > maxKeys) {
        res2.push(`\u2026 [${value.length - maxKeys} MORE ITEMS]`);
      }
      return res2;
    }
    const res = {};
    const entries = Object.entries(value);
    let count = 0;
    for (const [k, v] of entries) {
      if (count >= maxKeys) {
        res["\u2026"] = `[${entries.length - maxKeys} MORE KEYS]`;
        break;
      }
      res[k] = safeSerialize(v, maxDepth, maxLength, maxKeys, currentDepth + 1, seen);
      count++;
    }
    return res;
  }
  return String(value);
}
var SessionStateMachine = class {
  currentState = "IDLE";
  listeners = [];
  getState() {
    return this.currentState;
  }
  canTransitionTo(next) {
    switch (this.currentState) {
      case "IDLE":
        return next === "INITIALIZING" || next === "RECORDING" || next === "STOPPED";
      case "INITIALIZING":
        return next === "RECORDING" || next === "STOPPED";
      case "RECORDING":
        return next === "ERROR_TRIGGERED" || next === "FLUSHING" || next === "STOPPED";
      case "ERROR_TRIGGERED":
        return next === "POST_ERROR_RECORDING" || next === "FLUSHING" || next === "STOPPED";
      case "POST_ERROR_RECORDING":
        return next === "FLUSHING" || next === "STOPPED";
      case "FLUSHING":
        return next === "RECORDING" || next === "STOPPED" || next === "IDLE";
      case "STOPPED":
        return next === "INITIALIZING" || next === "RECORDING" || next === "IDLE";
      default:
        return false;
    }
  }
  transition(next) {
    if (this.currentState === next) {
      return true;
    }
    if (!this.canTransitionTo(next)) {
      return false;
    }
    const prev = this.currentState;
    this.currentState = next;
    this.notify(next, prev);
    return true;
  }
  onTransition(listener) {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }
  notify(next, prev) {
    for (const listener of this.listeners) {
      try {
        listener(next, prev);
      } catch {
      }
    }
  }
};
var SamplingEngine = class {
  sessionRate;
  traceRate;
  predicate;
  constructor(options) {
    this.sessionRate = typeof options?.samplingRate === "number" ? Math.max(0, Math.min(1, options.samplingRate)) : 1;
    this.traceRate = typeof options?.tracesSampleRate === "number" ? Math.max(0, Math.min(1, options.tracesSampleRate)) : 1;
    this.predicate = options?.targetPredicate;
  }
  shouldSampleSession(context) {
    if (this.predicate && context) {
      try {
        if (!this.predicate(context)) {
          return false;
        }
      } catch {
        return false;
      }
    }
    if (this.sessionRate >= 1) return true;
    if (this.sessionRate <= 0) return false;
    return Math.random() < this.sessionRate;
  }
  shouldSampleTrace() {
    if (this.traceRate >= 1) return true;
    if (this.traceRate <= 0) return false;
    return Math.random() < this.traceRate;
  }
};
var BaseTransport = class {
  endpoint;
  apiKey;
  batchSize;
  flushIntervalMs;
  maxQueueSize;
  maxRetries;
  timeoutMs;
  queue = [];
  timer = null;
  isFlushing = false;
  isClosed = false;
  constructor(options) {
    this.endpoint = options.endpoint.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.batchSize = Math.max(1, options.batchSize || 30);
    this.flushIntervalMs = Math.max(100, options.flushIntervalMs || 2e3);
    this.maxQueueSize = Math.max(10, options.maxQueueSize || 500);
    this.maxRetries = options.maxRetries ?? 3;
    this.timeoutMs = options.timeoutMs || 1e4;
    this.startTimer();
  }
  send(event) {
    if (this.isClosed) return;
    if (this.queue.length >= this.maxQueueSize) {
      const nonErrIdx = this.queue.findIndex((e) => e.eventType !== "ERROR");
      if (nonErrIdx >= 0) {
        this.queue.splice(nonErrIdx, 1);
      } else {
        this.queue.shift();
      }
    }
    this.queue.push(event);
    if (this.queue.length >= this.batchSize || event.eventType === "ERROR") {
      void this.flush();
    }
  }
  async flush() {
    if (this.isFlushing || this.queue.length === 0) return;
    this.isFlushing = true;
    const batch = this.queue.splice(0, this.batchSize);
    try {
      await this.postBatchWithRetry(batch);
    } catch (err) {
      if (!this.isClosed) {
        const space = this.maxQueueSize - this.queue.length;
        if (space > 0) {
          this.queue.unshift(...batch.slice(0, space));
        }
      }
    } finally {
      this.isFlushing = false;
    }
  }
  async postBatchWithRetry(batch) {
    let attempt = 0;
    let delay = 300;
    while (attempt <= this.maxRetries) {
      try {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;
        const url = `${this.endpoint}/ingest/events`;
        const payload = batch.length === 1 ? batch[0] : { events: batch };
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(payload),
          signal: controller ? controller.signal : void 0
        });
        if (timer) clearTimeout(timer);
        if (!res.ok) {
          if (res.status === 401 || res.status === 403 || res.status === 400) {
            const txt = await res.text().catch(() => "");
            throw new Error(`Ingest HTTP ${res.status}: ${txt}`);
          }
          throw new Error(`Ingest HTTP ${res.status}`);
        }
        return await res.json().catch(() => ({}));
      } catch (err) {
        attempt++;
        if (attempt > this.maxRetries || err.message?.includes("HTTP 401") || err.message?.includes("HTTP 403")) {
          throw err;
        }
        const jitter = Math.random() * 200;
        await new Promise((r) => setTimeout(r, delay + jitter));
        delay *= 2;
      }
    }
  }
  flushImmediate(beaconPreferred = false) {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.queue.length);
    const url = `${this.endpoint}/ingest/events`;
    const payload = batch.length === 1 ? batch[0] : { events: batch };
    const data = JSON.stringify(payload);
    if (beaconPreferred && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        const blob = new Blob([data], { type: "application/json" });
      } catch {
      }
    }
    if (typeof fetch === "function") {
      try {
        void fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`
          },
          body: data,
          keepalive: true
        }).catch(() => {
        });
      } catch {
      }
    }
  }
  close() {
    this.isClosed = true;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.flushImmediate();
  }
  startTimer() {
    if (typeof setInterval === "function") {
      this.timer = setInterval(() => {
        void this.flush();
      }, this.flushIntervalMs);
      if (this.timer && typeof this.timer.unref === "function") {
        this.timer.unref();
      }
    }
  }
};
function generateEventId() {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
function detectRuntime() {
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    return {
      name: "browser",
      version: typeof navigator !== "undefined" ? navigator.userAgent : void 0,
      engine: "v8/blink/webkit/gecko",
      platform: typeof navigator !== "undefined" ? navigator.platform : "web"
    };
  }
  if (typeof process !== "undefined" && process.versions?.node) {
    return {
      name: "node",
      version: process.versions.node,
      engine: process.versions.v8,
      platform: process.platform
    };
  }
  return {
    name: "unknown"
  };
}
var EnvelopeBuilder = class {
  sdkName;
  sdkVersion;
  runtimeInfo;
  constructor(sdkName = "@halo-trace/sdk", sdkVersion = "1.0.0") {
    this.sdkName = sdkName;
    this.sdkVersion = sdkVersion;
    this.runtimeInfo = detectRuntime();
  }
  build(options, scope, session, trace) {
    const now = Date.now();
    const iso = options.timestamp || new Date(now).toISOString();
    const traceCtx = trace?.getContext();
    const tags = {
      ...scope.getTags(),
      ...options.tags || {}
    };
    const metadata = sanitizeObject({
      ...scope.getContexts(),
      ...options.metadata || {}
    });
    const envelope = {
      eventId: generateEventId(),
      eventType: options.type || "MESSAGE",
      type: options.type || "MESSAGE",
      timestamp: iso,
      timestampPrecision: "ms",
      sessionId: options.sessionId || session?.getSessionId(),
      sessionStartedAt: options.sessionStartedAt || session?.getStartedAt(),
      traceId: options.traceId || traceCtx?.traceId,
      spanId: options.spanId || traceCtx?.spanId,
      parentSpanId: options.parentSpanId || traceCtx?.parentSpanId,
      requestId: options.requestId || trace?.getRequestId(),
      user: options.user || scope.getUser(),
      environment: scope.getEnvironment(),
      release: scope.getRelease(),
      service: options.service || scope.getService(),
      deployment: scope.getDeployment(),
      sdkName: this.sdkName,
      sdkVersion: this.sdkVersion,
      runtime: this.runtimeInfo,
      platform: this.runtimeInfo.platform || this.runtimeInfo.name,
      clock: {
        clientTimestamp: now,
        clientTimestampIso: iso,
        timezoneOffsetMinutes: (/* @__PURE__ */ new Date()).getTimezoneOffset()
      },
      evidenceStatus: "OBSERVED",
      sequence: session ? session.nextSequence() : void 0,
      title: options.title,
      message: options.message,
      severity: options.severity || "INFO",
      stack: options.stack,
      fingerprint: options.fingerprint,
      durationMs: options.durationMs,
      operation: options.operation,
      resource: options.resource,
      status: options.status,
      tags,
      breadcrumbs: options.breadcrumbs || [],
      metadata,
      data: options.data
    };
    return envelope;
  }
};
var CoreClient = class {
  options;
  scope;
  session;
  trace;
  breadcrumbs;
  envelopeBuilder;
  transport;
  sampling;
  stateMachine;
  enabled;
  constructor(options, sdkName = "@halo-trace/sdk", sdkVersion = "1.0.0") {
    this.options = options;
    this.enabled = options.enabled ?? true;
    this.scope = new Scope();
    if (options.environment) this.scope.setEnvironment(options.environment);
    if (options.release) this.scope.setRelease(options.release);
    if (options.service) this.scope.setService(options.service);
    if (options.deployment) this.scope.setDeployment(options.deployment);
    this.session = new SessionManager(options.sessionId);
    this.trace = new TraceContextManager();
    this.breadcrumbs = new BreadcrumbRingBuffer(options.maxBreadcrumbs || 100);
    this.envelopeBuilder = new EnvelopeBuilder(sdkName, sdkVersion);
    this.stateMachine = new SessionStateMachine();
    this.sampling = new SamplingEngine({
      samplingRate: options.samplingRate,
      tracesSampleRate: options.tracesSampleRate,
      targetPredicate: options.targetPredicate
    });
    if (this.enabled && options.apiKey && options.endpoint) {
      this.transport = new BaseTransport({
        endpoint: options.endpoint,
        apiKey: options.apiKey
      });
      this.stateMachine.transition("RECORDING");
    }
  }
  getScope() {
    return this.scope;
  }
  getSession() {
    return this.session;
  }
  getSessionId() {
    return this.session.getSessionId();
  }
  getTraceManager() {
    return this.trace;
  }
  getTraceContext() {
    return this.trace.getContext();
  }
  getBreadcrumbBuffer() {
    return this.breadcrumbs;
  }
  setUser(user) {
    this.scope.setUser(user);
    return this;
  }
  clearUser() {
    this.scope.clearUser();
    return this;
  }
  setTag(key, value) {
    this.scope.setTag(key, value);
    return this;
  }
  setTags(tags) {
    this.scope.setTags(tags);
    return this;
  }
  setContext(name, data) {
    this.scope.setContext(name, data);
    return this;
  }
  setRelease(release) {
    this.scope.setRelease(release);
    return this;
  }
  setEnvironment(environment) {
    this.scope.setEnvironment(environment);
    return this;
  }
  addBreadcrumb(breadcrumb) {
    const item = {
      timestamp: breadcrumb.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
      category: breadcrumb.category,
      message: breadcrumb.message,
      level: breadcrumb.level,
      data: breadcrumb.data
    };
    this.breadcrumbs.add(item);
  }
  startSpan(name, operation) {
    const span = this.trace.startSpan(name);
    this.addBreadcrumb({
      category: "trace",
      message: `span: ${name} (${operation || "internal"})`,
      data: { spanId: span.spanId, parentSpanId: span.parentSpanId }
    });
    return span;
  }
  capture(options) {
    if (!this.enabled) return null;
    if (options.type !== "ERROR" && !this.sampling.shouldSampleSession({ user: this.scope.getUser() })) {
      return null;
    }
    const breadcrumbs = options.breadcrumbs || this.breadcrumbs.getAll();
    const envelope = this.envelopeBuilder.build(
      { ...options, breadcrumbs },
      this.scope,
      this.session,
      this.trace
    );
    if (this.transport) {
      this.transport.send(envelope);
    }
    return envelope;
  }
  captureException(error, additional) {
    const err = error instanceof Error ? error : new Error(String(error));
    this.session.touch();
    const envelope = this.capture({
      type: "ERROR",
      title: err.message || err.name || "Error",
      message: err.message,
      severity: "ERROR",
      stack: err.stack,
      fingerprint: `${err.name}:${err.message}`,
      ...additional
    });
    return envelope;
  }
  captureMessage(message, severity = "INFO", additional) {
    return this.capture({
      type: "MESSAGE",
      title: message,
      message,
      severity,
      ...additional
    });
  }
  capturePerformance(options) {
    if (!this.sampling.shouldSampleTrace()) return null;
    return this.capture({
      type: "TRACE",
      title: options.title,
      durationMs: options.durationMs,
      operation: options.operation,
      resource: options.resource,
      status: options.status,
      service: options.service,
      metadata: options.metadata,
      tags: options.tags,
      requestId: options.requestId,
      traceId: options.traceId,
      severity: "INFO"
    });
  }
  async flush() {
    if (this.transport) {
      await this.transport.flush();
    }
  }
  close() {
    if (this.transport) {
      this.transport.close();
    }
    this.stateMachine.transition("STOPPED");
  }
};

// src/instrumentations/errors.ts
function registerErrorInstrumentation(client, onFatalError, onUnhandledRejection) {
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
      if (onUnhandledRejection) {
        onUnhandledRejection(err);
      } else {
        onFatalError?.(err);
      }
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
      const sanitized = sanitizeUrl(rawUrl);
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
              headers: sanitizeHeaders(response.headers, options.allowlistHeaders)
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
        sanitizedUrl: sanitizeUrl(rawUrl),
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
          const message = args.map((arg) => typeof arg === "string" ? arg : JSON.stringify(safeSerialize(arg, 2, 200, 10))).join(" ");
          const safeArgs = args.map((arg) => safeSerialize(arg, 3, 500, 20));
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
function registerSpaInstrumentation(client) {
  if (typeof window === "undefined" || !window.history) return () => {
  };
  let currentUrl = sanitizeUrl(window.location.href);
  const recordNavigation = (toUrl, type) => {
    const sanitizedTo = sanitizeUrl(toUrl);
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
      if (typeof window !== "undefined" && window.__HALO_REPLAY__) {
        const existing = window.__HALO_REPLAY__;
        if (existing && typeof existing.getCaptureState === "function") {
          const state = existing.getCaptureState();
          if (state !== "DISCARDED" && state !== "DISABLED") {
            this.replayInstance = existing;
            return;
          }
        }
      }
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
      const errorTriggered = this.config?.errorTriggered ?? true;
      const samplingRate = this.config?.samplingRate ?? this.config?.sampleRate ?? (errorTriggered ? 0 : 1);
      const replay = new ReplayModule.HaloReplay({
        apiKey,
        projectId: this.config?.projectId || this.client.options?.projectId,
        endpoint,
        sessionId,
        samplingRate,
        sampleRate: samplingRate,
        errorTriggered,
        triggerOnFrustration: this.config?.triggerOnFrustration ?? true,
        triggerOnNetworkError: this.config?.triggerOnNetworkError ?? true,
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
  capture(options) {
    if (this.replayInstance && typeof this.replayInstance.capture === "function") {
      try {
        this.replayInstance.capture(options);
      } catch {
      }
    }
  }
  getCaptureState() {
    if (this.replayInstance && typeof this.replayInstance.getCaptureState === "function") {
      return this.replayInstance.getCaptureState();
    }
    return "DISABLED";
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
  triggerUnhandledRejection(error, traceId, requestId) {
    if (this.replayInstance && typeof this.replayInstance.triggerCapture === "function") {
      try {
        this.replayInstance.triggerCapture("UNHANDLED_REJECTION", {
          reason: error.message || "Unhandled Promise Rejection",
          error,
          meta: {
            stack: error.stack,
            traceId,
            requestId,
            errorAt: (/* @__PURE__ */ new Date()).toISOString()
          }
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
var BrowserClient = class extends CoreClient {
  replayBridge;
  teardowns = [];
  constructor(options) {
    const endpoint = options.endpoint || (typeof window !== "undefined" ? "/api" : "http://localhost:3000/api");
    let canonicalSessionId = options.sessionId;
    if (!canonicalSessionId && typeof window !== "undefined") {
      try {
        canonicalSessionId = window.sessionStorage?.getItem("halo_session_id") || void 0;
      } catch {
      }
      if (!canonicalSessionId) {
        canonicalSessionId = window.__HALO_SESSION_ID__;
      }
    }
    super({ ...options, endpoint, sessionId: canonicalSessionId }, "@halo-trace/sdk-browser", "1.0.0");
    if (typeof window !== "undefined") {
      const sid = this.session.getSessionId();
      try {
        window.sessionStorage?.setItem("halo_session_id", sid);
      } catch {
      }
      window.__HALO_SESSION_ID__ = sid;
      window.__HALO_SDK__ = this;
    }
    this.replayBridge = new ReplayBridge(this, options.replay);
    if (this.enabled) {
      this.installInstrumentations(options, endpoint);
    }
  }
  installInstrumentations(options, endpoint) {
    if (options.autoCapture !== false) {
      const unregisterErrors = registerErrorInstrumentation(
        this,
        (err) => {
          this.replayBridge.triggerError(err, this.trace.getTraceId(), this.trace.getRequestId());
        },
        (err) => {
          this.replayBridge.triggerUnhandledRejection(err, this.trace.getTraceId(), this.trace.getRequestId());
        }
      );
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
    if (additional?.metadata?.unhandledRejection || additional?.unhandledRejection) {
      this.replayBridge.triggerUnhandledRejection(err, this.trace.getTraceId(), this.trace.getRequestId());
    } else {
      this.replayBridge.triggerError(err, this.trace.getTraceId(), this.trace.getRequestId());
    }
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
export {
  BaseTransport,
  BreadcrumbRingBuffer,
  BrowserClient,
  CoreClient,
  EnvelopeBuilder,
  ReplayBridge,
  SDK_PUBLIC_ENDPOINT,
  SamplingEngine,
  Scope,
  SessionManager,
  SessionStateMachine,
  TraceContextManager,
  detectRuntime,
  formatTraceParent,
  generateEventId,
  generateRequestId,
  generateSessionId,
  generateSpanId,
  generateTraceId,
  getClient,
  init,
  parseTraceParent,
  registerConsoleInstrumentation,
  registerErrorInstrumentation,
  registerHttpInstrumentation,
  registerLifecycleInstrumentation,
  registerPerformanceInstrumentation,
  registerSpaInstrumentation,
  safeSerialize,
  sanitizeHeaders,
  sanitizeObject,
  sanitizeText,
  sanitizeUrl
};
//# sourceMappingURL=index.js.map