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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  SDK_PUBLIC_ENDPOINT: () => SDK_PUBLIC_ENDPOINT
});
module.exports = __toCommonJS(index_exports);
var SDK_PUBLIC_ENDPOINT = typeof process !== "undefined" && (process.env?.NEXT_PUBLIC_HALO_ENDPOINT || process.env?.HALO_ENDPOINT) || "https://halo-trace-ten.vercel.app/api";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SDK_PUBLIC_ENDPOINT
});
//# sourceMappingURL=index.cjs.map