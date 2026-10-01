import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm", "cjs", "iife"],
    globalName: "Halo",
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: "dist",
    noExternal: ["@halo-trace/sdk-core", "@halo-trace/sdk-types"],
    external: ["@halo-trace/replay"],
});
