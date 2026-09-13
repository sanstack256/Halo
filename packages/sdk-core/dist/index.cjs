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
  BaseTransport: () => BaseTransport,
  BreadcrumbRingBuffer: () => BreadcrumbRingBuffer,
  CoreClient: () => CoreClient,
  EnvelopeBuilder: () => EnvelopeBuilder,
  SamplingEngine: () => SamplingEngine,
  Scope: () => Scope,
  SessionManager: () => SessionManager,
  SessionStateMachine: () => SessionStateMachine,
  TraceContextManager: () => TraceContextManager,
  detectRuntime: () => detectRuntime,
  formatTraceParent: () => formatTraceParent,
  generateEventId: () => generateEventId,
  generateRequestId: () => generateRequestId,
  generateSessionId: () => generateSessionId,
  generateSpanId: () => generateSpanId,
  generateTraceId: () => generateTraceId,
  parseTraceParent: () => parseTraceParent,
  safeSerialize: () => safeSerialize,
  sanitizeHeaders: () => sanitizeHeaders,
  sanitizeObject: () => sanitizeObject,
  sanitizeText: () => sanitizeText,
  sanitizeUrl: () => sanitizeUrl
});
module.exports = __toCommonJS(index_exports);

// src/scope.ts
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

// src/session.ts
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

// src/trace-context.ts
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

// src/ring-buffer.ts
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

// src/sanitizer.ts
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

// src/serializer.ts
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

// src/state-machine.ts
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

// src/sampling.ts
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

// src/transport.ts
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

// src/envelope.ts
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

// src/client.ts
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

// src/index.ts
__reExport(index_exports, require("@halo-trace/sdk-types"), module.exports);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BaseTransport,
  BreadcrumbRingBuffer,
  CoreClient,
  EnvelopeBuilder,
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
  parseTraceParent,
  safeSerialize,
  sanitizeHeaders,
  sanitizeObject,
  sanitizeText,
  sanitizeUrl,
  ...require("@halo-trace/sdk-types")
});
//# sourceMappingURL=index.cjs.map