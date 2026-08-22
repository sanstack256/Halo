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
  constructor(maxDurationSeconds = 60) {
    this.buffer = [];
    this.maxDurationMs = maxDurationSeconds * 1e3;
  }
  add(event) {
    this.buffer.push(event);
    this.prune();
  }
  prune() {
    if (this.buffer.length === 0) return;
    const now = Date.now();
    const cutoff = now - this.maxDurationMs;
    let earliestValidIndex = 0;
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      if (this.buffer[i].timestamp < cutoff) {
        if (this.buffer[i].type === 2) {
          earliestValidIndex = i;
          break;
        }
      }
    }
    if (earliestValidIndex > 0) {
      this.buffer = this.buffer.slice(earliestValidIndex);
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
    this.endpoint = options.endpoint.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.sessionId = options.sessionId;
    this.flushIntervalMs = options.flushIntervalMs ?? 5e3;
    this.environment = options.environment;
  }
  addEvents(events) {
    this.queue.push(...events);
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
        browser: typeof navigator !== "undefined" ? navigator.userAgent : void 0,
        os: typeof navigator !== "undefined" ? navigator.platform : void 0,
        url: typeof window !== "undefined" ? window.location.href : void 0,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : void 0,
        viewportWidth: typeof window !== "undefined" ? window.innerWidth : void 0,
        viewportHeight: typeof window !== "undefined" ? window.innerHeight : void 0,
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
      if (isFinal && typeof navigator !== "undefined" && navigator.sendBeacon) {
        const blob = new Blob([bodyStr], { type: "application/json" });
        navigator.sendBeacon(targetUrl, blob);
      } else {
        await fetch(targetUrl, {
          method: "POST",
          headers,
          body: bodyStr,
          keepalive: isFinal
        });
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
    this.options = {
      endpoint: options.endpoint || "/api",
      samplingRate: options.samplingRate ?? 1,
      errorTriggered: options.errorTriggered ?? true,
      preErrorBufferSeconds: options.preErrorBufferSeconds ?? 60,
      postErrorDurationSeconds: options.postErrorDurationSeconds ?? 30,
      maxSessionDurationMinutes: options.maxSessionDurationMinutes ?? 60,
      flushIntervalMs: options.flushIntervalMs ?? 5e3,
      ...options
    };
    this.sessionId = options.sessionId || this.generateSessionId();
    this.startedAt = Date.now();
    this.ringBuffer = new ReplayRingBuffer(this.options.preErrorBufferSeconds);
    this.uploader = new ReplayUploader({
      endpoint: this.options.endpoint,
      apiKey: this.options.apiKey,
      sessionId: this.sessionId,
      flushIntervalMs: this.options.flushIntervalMs,
      environment: this.options.environment
    });
    this.isSampled = Math.random() < (this.options.samplingRate ?? 1);
  }
  generateSessionId() {
    return `hr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
  getSessionId() {
    return this.sessionId;
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
   */
  triggerErrorReplay(errorMeta) {
    if (this.isErrorTriggered) return;
    this.isErrorTriggered = true;
    const preErrorEvents = this.ringBuffer.flush();
    this.uploader.addEvents(preErrorEvents);
    this.isStreaming = true;
    this.uploader.flush(false, {
      errorAt: (/* @__PURE__ */ new Date()).toISOString(),
      ...errorMeta
    });
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
    this.flushAndConclude();
  }
};
export {
  HaloReplay
};
//# sourceMappingURL=index.js.map