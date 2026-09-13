// src/error-boundary.tsx
import { Component } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
var HaloErrorBoundary = class extends Component {
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
      return /* @__PURE__ */ jsxs("div", { style: { padding: 20, fontFamily: "system-ui, sans-serif", color: "#e11d48" }, children: [
        /* @__PURE__ */ jsx("h2", { children: "An application error occurred" }),
        /* @__PURE__ */ jsx("p", { style: { fontSize: 14, color: "#666" }, children: this.state.error.message }),
        /* @__PURE__ */ jsx(
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
import { createContext, useContext } from "react";
import { jsx as jsx2 } from "react/jsx-runtime";
var HaloContext = createContext(null);
var HaloProvider = ({ client, children }) => {
  return /* @__PURE__ */ jsx2(HaloContext.Provider, { value: client, children });
};
function useHalo() {
  const ctx = useContext(HaloContext);
  if (ctx) return ctx;
  if (typeof window !== "undefined" && window.__HALO_SDK__) {
    return window.__HALO_SDK__;
  }
  return null;
}

// src/hooks.ts
import { useEffect } from "react";
function useHaloUser(user) {
  const halo = useHalo();
  useEffect(() => {
    if (!halo || !user) return;
    halo.setUser(user);
  }, [halo, user]);
}
function useHaloBreadcrumb(category, message, data) {
  const halo = useHalo();
  useEffect(() => {
    if (!halo) return;
    halo.addBreadcrumb({
      category,
      message,
      data
    });
  }, [halo, category, message, data]);
}

// src/profiler.tsx
import React3 from "react";
import { jsx as jsx3 } from "react/jsx-runtime";
function withHaloProfiler(WrappedComponent, name = WrappedComponent.displayName || WrappedComponent.name || "Component") {
  return function HaloProfiledComponent(props) {
    const halo = useHalo();
    const start = performance.now();
    React3.useEffect(() => {
      const mountDuration = Math.round(performance.now() - start);
      if (halo) {
        halo.addBreadcrumb({
          category: "performance",
          message: `Component <${name}> mounted in ${mountDuration}ms`,
          data: { component: name, durationMs: mountDuration }
        });
      }
    }, [halo]);
    return /* @__PURE__ */ jsx3(WrappedComponent, { ...props });
  };
}

// src/index.ts
export * from "@halo-trace/sdk-browser";
export {
  HaloErrorBoundary,
  HaloProvider,
  useHalo,
  useHaloBreadcrumb,
  useHaloUser,
  withHaloProfiler
};
//# sourceMappingURL=index.js.map