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
  HaloErrorBoundary: () => HaloErrorBoundary,
  HaloProvider: () => HaloProvider,
  useHalo: () => useHalo,
  useHaloBreadcrumb: () => useHaloBreadcrumb,
  useHaloUser: () => useHaloUser,
  withHaloProfiler: () => withHaloProfiler
});
module.exports = __toCommonJS(index_exports);

// src/error-boundary.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var HaloErrorBoundary = class extends import_react.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    const client = this.props.client || (typeof window !== "undefined" ? window.__HALO_SDK__ : void 0);
    if (client && typeof client.captureException === "function") {
      client.captureException(error, {
        metadata: {
          componentStack: errorInfo.componentStack,
          framework: "react"
        },
        tags: {
          errorSource: "react.error_boundary"
        }
      });
    }
    if (typeof this.props.onError === "function") {
      this.props.onError(error, errorInfo);
    }
  }
  reset = () => {
    this.setState({ hasError: false, error: null });
  };
  render() {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback(this.state.error, this.reset);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: 20, fontFamily: "system-ui, sans-serif", color: "#e11d48" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "An application error occurred" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { fontSize: 14, color: "#666" }, children: this.state.error.message }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            onClick: this.reset,
            style: {
              padding: "8px 16px",
              background: "#0f172a",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer"
            },
            children: "Try Again"
          }
        )
      ] });
    }
    return this.props.children;
  }
};

// src/context.tsx
var import_react2 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var HaloContext = (0, import_react2.createContext)(null);
var HaloProvider = ({ client, children }) => {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(HaloContext.Provider, { value: client, children });
};
function useHalo() {
  const ctx = (0, import_react2.useContext)(HaloContext);
  if (ctx) return ctx;
  if (typeof window !== "undefined" && window.__HALO_SDK__) {
    return window.__HALO_SDK__;
  }
  return null;
}

// src/hooks.ts
var import_react3 = require("react");
function useHaloUser(user) {
  const halo = useHalo();
  (0, import_react3.useEffect)(() => {
    if (!halo || !user) return;
    halo.setUser(user);
  }, [halo, user]);
}
function useHaloBreadcrumb(category, message, data) {
  const halo = useHalo();
  (0, import_react3.useEffect)(() => {
    if (!halo) return;
    halo.addBreadcrumb({
      category,
      message,
      data
    });
  }, [halo, category, message, data]);
}

// src/profiler.tsx
var import_react4 = __toESM(require("react"), 1);
var import_jsx_runtime3 = require("react/jsx-runtime");
function withHaloProfiler(WrappedComponent, name = WrappedComponent.displayName || WrappedComponent.name || "Component") {
  return function HaloProfiledComponent(props) {
    const halo = useHalo();
    const start = performance.now();
    import_react4.default.useEffect(() => {
      const mountDuration = Math.round(performance.now() - start);
      if (halo) {
        halo.addBreadcrumb({
          category: "performance",
          message: `Component <${name}> mounted in ${mountDuration}ms`,
          data: { component: name, durationMs: mountDuration }
        });
      }
    }, [halo]);
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(WrappedComponent, { ...props });
  };
}

// src/index.ts
__reExport(index_exports, require("@halo-trace/sdk-browser"), module.exports);
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  HaloErrorBoundary,
  HaloProvider,
  useHalo,
  useHaloBreadcrumb,
  useHaloUser,
  withHaloProfiler,
  ...require("@halo-trace/sdk-browser")
});
//# sourceMappingURL=index.cjs.map