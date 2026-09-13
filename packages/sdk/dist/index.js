// src/halo.ts
import { BrowserClient } from "@halo-trace/sdk-browser";
import { NodeClient } from "@halo-trace/sdk-node";
var globalHaloInstance = null;
var Halo = class _Halo {
  client;
  constructor(options) {
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      this.client = new BrowserClient(options);
    } else {
      this.client = new NodeClient(options);
    }
    globalHaloInstance = this;
  }
  static init(options) {
    if (globalHaloInstance) {
      globalHaloInstance.close();
    }
    globalHaloInstance = new _Halo(options);
    return globalHaloInstance;
  }
  static getClient() {
    return globalHaloInstance?.client || null;
  }
  getClientInstance() {
    return this.client;
  }
  captureException(error, additional) {
    return this.client.captureException(error, additional);
  }
  captureMessage(message, severity = "INFO", additional) {
    return this.client.captureMessage(message, severity, additional);
  }
  capturePerformance(options) {
    return this.client.capturePerformance(options);
  }
  capture(event) {
    return this.client.capture(event);
  }
  addBreadcrumb(breadcrumb) {
    this.client.addBreadcrumb(breadcrumb);
  }
  setUser(user) {
    this.client.setUser(user);
    return this;
  }
  clearUser() {
    this.client.clearUser();
    return this;
  }
  setTag(key, value) {
    this.client.setTag(key, value);
    return this;
  }
  setTags(tags) {
    this.client.setTags(tags);
    return this;
  }
  setContext(name, data) {
    this.client.setContext(name, data);
    return this;
  }
  setRelease(release) {
    this.client.setRelease(release);
    return this;
  }
  setEnvironment(environment) {
    this.client.setEnvironment(environment);
    return this;
  }
  startSpan(name, operation) {
    return this.client.startSpan(name, operation);
  }
  getSessionId() {
    return this.client.getSessionId();
  }
  getTraceContext() {
    return this.client.getTraceContext();
  }
  get replay() {
    const browserClient = this.client instanceof BrowserClient ? this.client : null;
    return {
      start: () => {
      },
      stop: () => {
        browserClient?.replay.stop();
      },
      flush: () => {
        browserClient?.replay.flush();
      },
      openFeedbackModal: (options) => {
        return browserClient?.openFeedbackModal(options);
      },
      getSessionId: () => {
        return this.getSessionId();
      }
    };
  }
  get feedback() {
    return {
      open: (options) => {
        return this.openFeedbackModal(options);
      }
    };
  }
  openFeedbackModal(options) {
    if (this.client instanceof BrowserClient) {
      return this.client.openFeedbackModal(options);
    }
    return null;
  }
  async flush() {
    await this.client.flush();
  }
  close() {
    this.client.close();
  }
  // Static helpers for global convenience
  static captureException(error, additional) {
    return globalHaloInstance?.captureException(error, additional);
  }
  static captureMessage(message, severity, additional) {
    return globalHaloInstance?.captureMessage(message, severity, additional);
  }
  static addBreadcrumb(breadcrumb) {
    globalHaloInstance?.addBreadcrumb(breadcrumb);
  }
  static setUser(user) {
    globalHaloInstance?.setUser(user);
  }
  static clearUser() {
    globalHaloInstance?.clearUser();
  }
  static setTag(key, value) {
    globalHaloInstance?.setTag(key, value);
  }
  static setContext(name, data) {
    globalHaloInstance?.setContext(name, data);
  }
  static getSessionId() {
    return globalHaloInstance?.getSessionId();
  }
  static getTraceContext() {
    return globalHaloInstance?.getTraceContext();
  }
  static async flush() {
    await globalHaloInstance?.flush();
  }
  static close() {
    globalHaloInstance?.close();
  }
};

// src/index.ts
export * from "@halo-trace/sdk-types";
export * from "@halo-trace/sdk-core";
var index_default = Halo;
export {
  Halo,
  index_default as default
};
//# sourceMappingURL=index.js.map