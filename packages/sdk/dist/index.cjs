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
  Halo: () => Halo,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);

// src/halo.ts
var import_sdk_browser = require("@halo-trace/sdk-browser");
var import_sdk_node = require("@halo-trace/sdk-node");
var globalHaloInstance = null;
var Halo = class _Halo {
  client;
  constructor(options) {
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      this.client = new import_sdk_browser.BrowserClient(options);
    } else {
      this.client = new import_sdk_node.NodeClient(options);
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
    const browserClient = this.client instanceof import_sdk_browser.BrowserClient ? this.client : null;
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
    if (this.client instanceof import_sdk_browser.BrowserClient) {
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
__reExport(index_exports, require("@halo-trace/sdk-types"), module.exports);
__reExport(index_exports, require("@halo-trace/sdk-core"), module.exports);
var index_default = Halo;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Halo,
  ...require("@halo-trace/sdk-types"),
  ...require("@halo-trace/sdk-core")
});
//# sourceMappingURL=index.cjs.map