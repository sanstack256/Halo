export { HaloErrorBoundary, type HaloErrorBoundaryProps } from "./error-boundary";
export { HaloProvider, useHalo, type HaloProviderProps } from "./context";
export { useHaloUser, useHaloBreadcrumb } from "./hooks";
export { withHaloProfiler } from "./profiler";

export * from "@halo-trace/sdk-browser";
