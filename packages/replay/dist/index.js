// src/recorder.ts
import { record } from "rrweb";

// src/masker.ts
var DEFAULT_MASK_SELECTORS = [
  'input[type="password"]',
  'input[type="email"]',
  'input[type="tel"]',
  'input[name*="card" i]',
  'input[name*="cvv" i]',
  'input[name*="cvc" i]',
  'input[name*="ssn" i]',
  'input[name*="pass" i]',
  'input[name*="token" i]',
  'input[name*="secret" i]',
  'input[autocomplete*="cc-" i]',
  'input[autocomplete*="password" i]',
  "[data-halo-mask]",
  ".halo-mask"
].join(", ");
var DEFAULT_BLOCK_SELECTORS = [
  "video",
  "canvas",
  "iframe:not([data-halo-record])",
  "[data-halo-block]",
  ".halo-block"
].join(", ");
var DEFAULT_IGNORE_SELECTORS = [
  "[data-halo-ignore]",
  ".halo-ignore"
].join(", ");
function buildMaskerConfig(options) {
  const maskTextSelector = options?.maskTextSelector ? `${DEFAULT_MASK_SELECTORS}, ${options.maskTextSelector}` : DEFAULT_MASK_SELECTORS;
  const blockSelector = options?.blockSelector ? `${DEFAULT_BLOCK_SELECTORS}, ${options.blockSelector}` : DEFAULT_BLOCK_SELECTORS;
  const ignoreSelector = options?.ignoreSelector ? `${DEFAULT_IGNORE_SELECTORS}, ${options.ignoreSelector}` : DEFAULT_IGNORE_SELECTORS;
  return {
    maskAllInputs: true,
    maskInputOptions: {
      password: true,
      email: true,
      tel: true,
      text: true,
      color: false,
      date: false,
      "datetime-local": false,
      file: true,
      image: false,
      month: false,
      number: true,
      range: false,
      search: true,
      time: false,
      url: false,
      week: false,
      textarea: true,
      select: true
    },
    maskTextSelector,
    blockSelector,
    ignoreSelector,
    maskTextFn: (text, element) => {
      if (!text) return text;
      if (options?.maskAllText !== false) {
        return text.replace(/[^\s\n\t]/g, "*");
      }
      if (element && element.matches(maskTextSelector)) {
        return text.replace(/[^\s\n\t]/g, "*");
      }
      return text;
    },
    maskInputFn: (text, element) => {
      if (!text) return text;
      return "*".repeat(Math.min(text.length, 8));
    }
  };
}
var SENSITIVE_QUERY_PARAMS = [
  "token",
  "auth",
  "key",
  "api_key",
  "apiKey",
  "secret",
  "password",
  "pass",
  "access_token",
  "refresh_token",
  "code",
  "sessionId",
  "session_id"
];
function sanitizeUrl(urlStr) {
  if (!urlStr) return urlStr;
  try {
    const parsed = new URL(urlStr, "http://localhost");
    let modified = false;
    for (const param of SENSITIVE_QUERY_PARAMS) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, "[REDACTED]");
        modified = true;
      }
    }
    if (!modified) return urlStr;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return urlStr;
  }
}
function isUrlIgnored(url, ignorePatterns) {
  if (!ignorePatterns || ignorePatterns.length === 0) return false;
  for (const pattern of ignorePatterns) {
    if (typeof pattern === "string") {
      if (url.includes(pattern)) return true;
    } else if (pattern instanceof RegExp) {
      if (pattern.test(url)) return true;
    }
  }
  return false;
}

// src/ring-buffer.ts
var ReplayRingBuffer = class {
  constructor(maxDurationSeconds = 60, maxEvents = 5e3) {
    this.buffer = [];
    this.maxDurationMs = Math.max(1e3, maxDurationSeconds * 1e3);
    this.maxEvents = Math.max(100, maxEvents);
  }
  add(event) {
    this.buffer.push(event);
    this.prune(event.timestamp);
  }
  /**
   * Prunes events that are older than maxDurationMs or beyond maxEvents,
   * while rigorously ensuring that an initial FullSnapshot (type 2) or Meta (type 4)
   * is preserved at the beginning of the buffer so DOM reconstruction never fails.
   */
  prune(referenceTimestamp) {
    if (this.buffer.length <= 1) return;
    const now = referenceTimestamp ?? (this.buffer[this.buffer.length - 1]?.timestamp || Date.now());
    const cutoff = now - this.maxDurationMs;
    const timeNeedsPrune = this.buffer[0].timestamp < cutoff;
    const countNeedsPrune = this.buffer.length > this.maxEvents;
    if (!timeNeedsPrune && !countNeedsPrune) {
      return;
    }
    let snapshotIndex = -1;
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      const ev = this.buffer[i];
      if (ev.type === 2) {
        if (ev.timestamp <= cutoff || countNeedsPrune && this.buffer.length - i <= this.maxEvents) {
          snapshotIndex = i;
          break;
        }
      }
    }
    if (snapshotIndex > 0) {
      this.buffer = this.buffer.slice(snapshotIndex);
    } else if (countNeedsPrune && this.buffer.length > this.maxEvents) {
      const firstSnapshotIdx = this.buffer.findIndex((e) => e.type === 2);
      if (firstSnapshotIdx >= 0) {
        const snapshot = this.buffer[firstSnapshotIdx];
        const excess = this.buffer.length - this.maxEvents;
        const remaining = this.buffer.slice(firstSnapshotIdx + 1 + excess);
        this.buffer = [snapshot, ...remaining];
      } else {
        this.buffer = this.buffer.slice(this.buffer.length - this.maxEvents);
      }
    }
  }
  flush() {
    const events = [...this.buffer];
    this.buffer = [];
    return events;
  }
  getAll() {
    return [...this.buffer];
  }
  clear() {
    this.buffer = [];
  }
  get length() {
    return this.buffer.length;
  }
};

// src/uploader.ts
var ReplayUploader = class {
  constructor(options) {
    this.sequence = 0;
    this.queue = [];
    this.flushTimer = null;
    this.isUploading = false;
    this.maxQueueEvents = 1e4;
    this.endpoint = options.endpoint.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.projectId = options.projectId;
    this.sessionId = options.sessionId;
    this.flushIntervalMs = options.flushIntervalMs ?? 5e3;
    this.environment = options.environment;
    this.issueId = options.issueId;
  }
  setIssueId(issueId) {
    this.issueId = issueId;
  }
  addEvents(events) {
    this.queue.push(...events);
    if (this.queue.length > this.maxQueueEvents) {
      const firstSnapshot = this.queue.find((e) => e.type === 2);
      const excess = this.queue.length - this.maxQueueEvents;
      const remaining = this.queue.slice(excess);
      this.queue = firstSnapshot ? [firstSnapshot, ...remaining.filter((e) => e !== firstSnapshot)] : remaining;
    }
    this.scheduleFlush();
  }
  scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush(false);
    }, this.flushIntervalMs);
  }
  async flush(isFinal = false, extraMeta) {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.queue.length === 0 && !isFinal) return;
    const eventsToUpload = [...this.queue];
    this.queue = [];
    const startedAt = eventsToUpload.length > 0 ? new Date(eventsToUpload[0].timestamp).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
    const endedAt = eventsToUpload.length > 0 ? new Date(eventsToUpload[eventsToUpload.length - 1].timestamp).toISOString() : (/* @__PURE__ */ new Date()).toISOString();
    const payload = {
      sessionId: this.sessionId,
      sequence: this.sequence++,
      events: eventsToUpload,
      startedAt,
      endedAt,
      meta: {
        projectId: this.projectId,
        browser: typeof navigator !== "undefined" ? navigator.userAgent : void 0,
        os: typeof navigator !== "undefined" ? navigator.platform : void 0,
        url: typeof window !== "undefined" ? window.location.href : void 0,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : void 0,
        viewportWidth: typeof window !== "undefined" ? window.innerWidth : void 0,
        viewportHeight: typeof window !== "undefined" ? window.innerHeight : void 0,
        issueId: this.issueId,
        ...extraMeta
      },
      final: isFinal
    };
    const targetUrl = `${this.endpoint}/ingest/replay`;
    try {
      const headers = {
        "Content-Type": "application/json"
      };
      if (this.apiKey) {
        headers["Authorization"] = `Bearer ${this.apiKey}`;
      }
      const bodyStr = JSON.stringify(payload);
      const res = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: bodyStr,
        keepalive: isFinal
      });
      if (!res.ok && res.status >= 500 && !isFinal) {
        this.queue.unshift(...eventsToUpload);
        this.sequence--;
      }
    } catch (err) {
      console.error("[Halo Replay] Failed to upload chunk:", err);
      if (!isFinal) {
        this.queue.unshift(...eventsToUpload);
        this.sequence--;
      }
    }
  }
};

// src/recorder.ts
var HaloReplay = class {
  constructor(options = {}) {
    this.stopFn = null;
    this.isSampled = false;
    this.isStreaming = false;
    this.isErrorTriggered = false;
    this.postErrorTimeout = null;
    this.maxSessionTimeout = null;
    this.originalPushState = null;
    this.originalReplaceState = null;
    this.originalFetch = null;
    this.originalConsoleError = null;
    this.currentUrl = "";
    this.options = {
      endpoint: options.endpoint || "/api",
      samplingRate: options.samplingRate ?? 1,
      errorTriggered: options.errorTriggered ?? true,
      preErrorBufferSeconds: options.preErrorBufferSeconds ?? 60,
      maxBufferEvents: options.maxBufferEvents ?? 5e3,
      postErrorDurationSeconds: options.postErrorDurationSeconds ?? 30,
      maxSessionDurationMinutes: options.maxSessionDurationMinutes ?? 60,
      flushIntervalMs: options.flushIntervalMs ?? 5e3,
      captureNavigation: options.captureNavigation ?? true,
      captureNetwork: options.captureNetwork ?? true,
      captureConsole: options.captureConsole ?? true,
      ...options
    };
    let canonicalId = options.sessionId;
    if (!canonicalId && typeof window !== "undefined") {
      try {
        canonicalId = window.sessionStorage?.getItem("halo_session_id") || void 0;
      } catch {
      }
      if (!canonicalId) {
        canonicalId = window.__HALO_SESSION_ID__;
      }
    }
    if (!canonicalId) {
      canonicalId = this.generateSessionId();
    }
    this.sessionId = canonicalId;
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage?.setItem("halo_session_id", this.sessionId);
      } catch {
      }
      window.__HALO_SESSION_ID__ = this.sessionId;
      window.__HALO_REPLAY__ = this;
      this.currentUrl = window.location.href;
    }
    this.startedAt = Date.now();
    this.ringBuffer = new ReplayRingBuffer(
      this.options.preErrorBufferSeconds,
      this.options.maxBufferEvents
    );
    this.uploader = new ReplayUploader({
      endpoint: this.options.endpoint,
      apiKey: this.options.apiKey,
      projectId: this.options.projectId,
      sessionId: this.sessionId,
      flushIntervalMs: this.options.flushIntervalMs,
      environment: this.options.environment
    });
    this.isSampled = Math.random() < (this.options.samplingRate ?? 1);
  }
  generateSessionId() {
    return `hs_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  }
  getSessionId() {
    return this.sessionId;
  }
  setIssueId(issueId) {
    this.uploader.setIssueId(issueId);
  }
  start() {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }
    if (isUrlIgnored(window.location.href, this.options.privacy?.ignoreUrls)) {
      return;
    }
    const maskerConfig = buildMaskerConfig(this.options.privacy);
    try {
      this.stopFn = record({
        emit: (event) => {
          this.handleEvent(event);
        },
        maskAllInputs: maskerConfig.maskAllInputs,
        maskInputOptions: maskerConfig.maskInputOptions,
        maskTextFn: maskerConfig.maskTextFn,
        maskInputFn: maskerConfig.maskInputFn,
        blockSelector: maskerConfig.blockSelector,
        maskTextSelector: maskerConfig.maskTextSelector,
        ignoreSelector: maskerConfig.ignoreSelector,
        recordCanvas: false,
        inlineImages: false,
        collectFonts: false
      }) || null;
      if (this.options.captureNavigation) {
        this.setupNavigationInstrumentation();
      }
      if (this.options.captureNetwork) {
        this.setupNetworkInstrumentation();
      }
      if (this.options.captureConsole) {
        this.setupConsoleInstrumentation();
      }
      const maxDurationMs = (this.options.maxSessionDurationMinutes ?? 60) * 60 * 1e3;
      this.maxSessionTimeout = setTimeout(() => {
        this.stop();
      }, maxDurationMs);
      if (this.options.errorTriggered) {
        this.setupErrorListeners();
      }
      if (typeof window !== "undefined") {
        window.addEventListener("beforeunload", () => {
          this.flushAndConclude();
        });
      }
    } catch (err) {
      console.error("[Halo Replay] Failed to start recording:", err);
    }
  }
  handleEvent(event) {
    if (this.isStreaming || this.isSampled) {
      this.uploader.addEvents([event]);
    } else {
      this.ringBuffer.add(event);
    }
  }
  /**
   * Records a custom event into the rrweb stream and timeline
   */
  recordCustomEvent(tag, payload) {
    const customEvent = {
      type: 5,
      // Custom in rrweb
      data: {
        tag,
        payload
      },
      timestamp: Date.now()
    };
    this.handleEvent(customEvent);
  }
  setupNavigationInstrumentation() {
    if (typeof window === "undefined" || !window.history) return;
    const notifyNavigation = (toUrl, type) => {
      const sanitized = sanitizeUrl(toUrl);
      const fromSanitized = sanitizeUrl(this.currentUrl);
      this.currentUrl = toUrl;
      this.recordCustomEvent("halo:navigation", {
        from: fromSanitized,
        to: sanitized,
        type
      });
    };
    this.originalPushState = window.history.pushState;
    window.history.pushState = (...args) => {
      const res = this.originalPushState.apply(window.history, args);
      const targetUrl = args[2] ? String(args[2]) : window.location.href;
      notifyNavigation(targetUrl, "pushState");
      return res;
    };
    this.originalReplaceState = window.history.replaceState;
    window.history.replaceState = (...args) => {
      const res = this.originalReplaceState.apply(window.history, args);
      const targetUrl = args[2] ? String(args[2]) : window.location.href;
      notifyNavigation(targetUrl, "replaceState");
      return res;
    };
    window.addEventListener("popstate", () => {
      notifyNavigation(window.location.href, "popstate");
    });
  }
  setupNetworkInstrumentation() {
    if (typeof window === "undefined" || !window.fetch) return;
    this.originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const start = Date.now();
      const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method || "GET").toUpperCase();
      if (urlStr.includes("/api/ingest/")) {
        return this.originalFetch(input, init);
      }
      let traceId;
      let requestId;
      if (init?.headers) {
        const headers = init.headers;
        if (headers instanceof Headers) {
          traceId = headers.get("x-trace-id") || headers.get("traceparent") || void 0;
          requestId = headers.get("x-request-id") || void 0;
        } else if (typeof headers === "object") {
          traceId = headers["x-trace-id"] || headers["traceparent"];
          requestId = headers["x-request-id"];
        }
      }
      try {
        const response = await this.originalFetch(input, init);
        const durationMs = Date.now() - start;
        this.recordCustomEvent("halo:request", {
          method,
          url: sanitizeUrl(urlStr),
          status: response.status,
          durationMs,
          requestId,
          traceId,
          failed: !response.ok
        });
        return response;
      } catch (err) {
        const durationMs = Date.now() - start;
        this.recordCustomEvent("halo:request", {
          method,
          url: sanitizeUrl(urlStr),
          durationMs,
          requestId,
          traceId,
          failed: true
        });
        throw err;
      }
    };
  }
  setupConsoleInstrumentation() {
    if (typeof console === "undefined") return;
    this.originalConsoleError = console.error;
    console.error = (...args) => {
      this.originalConsoleError.apply(console, args);
      const message = args.map((a) => typeof a === "string" ? a : a?.message || JSON.stringify(a)).join(" ");
      this.recordCustomEvent("halo:console", {
        level: "error",
        message: message.slice(0, 1e3)
      });
    };
  }
  setupErrorListeners() {
    if (typeof window === "undefined") return;
    window.addEventListener("error", (e) => {
      this.triggerErrorReplay({
        title: e.message || "Unhandled Error",
        stack: e.error?.stack
      });
    });
    window.addEventListener("unhandledrejection", (e) => {
      const reason = e.reason;
      this.triggerErrorReplay({
        title: typeof reason === "string" ? reason : reason?.message || "Unhandled Promise Rejection",
        stack: reason?.stack
      });
    });
  }
  /**
   * Call when an error is captured (e.g. from Halo.captureException).
   * Supports multiple errors in the same session without timeline destruction.
   */
  triggerErrorReplay(errorMeta) {
    const errorTimestamp = (/* @__PURE__ */ new Date()).toISOString();
    this.recordCustomEvent("halo:error", {
      message: errorMeta?.title || "Unhandled Exception",
      stack: errorMeta?.stack,
      issueId: errorMeta?.issueId,
      traceId: errorMeta?.traceId,
      timestamp: errorTimestamp
    });
    if (!this.isErrorTriggered) {
      this.isErrorTriggered = true;
      const preErrorEvents = this.ringBuffer.flush();
      this.uploader.addEvents(preErrorEvents);
      this.isStreaming = true;
    }
    this.uploader.flush(false, {
      errorAt: errorTimestamp,
      ...errorMeta
    });
    if (this.postErrorTimeout) {
      clearTimeout(this.postErrorTimeout);
    }
    const postDurationMs = (this.options.postErrorDurationSeconds ?? 30) * 1e3;
    this.postErrorTimeout = setTimeout(() => {
      this.flushAndConclude();
    }, postDurationMs);
  }
  flushAndConclude() {
    this.uploader.flush(true);
  }
  stop() {
    if (this.stopFn) {
      this.stopFn();
      this.stopFn = null;
    }
    if (this.postErrorTimeout) clearTimeout(this.postErrorTimeout);
    if (this.maxSessionTimeout) clearTimeout(this.maxSessionTimeout);
    if (this.originalPushState && typeof window !== "undefined" && window.history) {
      window.history.pushState = this.originalPushState;
    }
    if (this.originalReplaceState && typeof window !== "undefined" && window.history) {
      window.history.replaceState = this.originalReplaceState;
    }
    if (this.originalFetch && typeof window !== "undefined") {
      window.fetch = this.originalFetch;
    }
    if (this.originalConsoleError && typeof console !== "undefined") {
      console.error = this.originalConsoleError;
    }
    this.flushAndConclude();
  }
};

// src/index.ts
function initHaloReplay(options = {}) {
  const replay = new HaloReplay(options);
  replay.start();
  return replay;
}
export {
  HaloReplay,
  ReplayRingBuffer,
  buildMaskerConfig,
  initHaloReplay,
  isUrlIgnored,
  sanitizeUrl
};
//# sourceMappingURL=index.js.map