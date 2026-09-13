import { defineConfig } from "tsup";

export default defineConfig([
    {
        entry: [
            "src/index.ts",
            "src/browser.ts",
            "src/node.ts",
            "src/react.ts",
            "src/nextjs.ts",
            "src/replay.ts",
        ],
        format: ["esm", "cjs"],
        dts: true,
        sourcemap: true,
        clean: true,
        outDir: "dist",
        external: ["react", "react-dom", "next", "rrweb"],
    },
    {
        entry: {
            "halo": "src/browser-bundle.ts",
        },
        format: ["iife"],
        globalName: "HaloBundle",
        sourcemap: true,
        target: "es2020",
        outDir: "dist",
        noExternal: [
            "@halo-trace/sdk-types",
            "@halo-trace/sdk-core",
            "@halo-trace/sdk-browser",
            "@halo-trace/replay",
            "rrweb",
        ],
        external: ["react", "react-dom", "next"],
    },
]);