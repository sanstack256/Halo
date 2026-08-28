import type { StackFrame, CallChainStep, FrameClassification } from "./types";

/**
 * Reconstructs two structured execution call chains from a parsed stack.
 *
 * Returns:
 *   applicationCallChain — only application frames, in caller→callee order.
 *                          This is the primary developer-facing chain.
 *   fullCallChain        — all frames in caller→callee order.
 *                          Shown in the "raw stack" expanded view.
 *
 * Both chains are derived entirely from real parsed stack frames.
 * No frames are invented or re-labelled.
 */
export function buildCallChains(
    frames: StackFrame[],
    failingExpression?: string
): {
    applicationCallChain: CallChainStep[];
    fullCallChain: CallChainStep[];
} {
    if (!frames || frames.length === 0) {
        return { applicationCallChain: [], fullCallChain: [] };
    }

    // Identify the index of the failing site:
    // The topmost application frame is the actual failure site (closest to the exception).
    const failingSiteIndex = frames.findIndex((f) => f.isApplication && f.lineNumber);
    const effectiveFailingSiteIndex = failingSiteIndex >= 0 ? failingSiteIndex : 0;

    // Stack frames are ordered top-to-bottom (0 = failing site, N-1 = entry/root caller).
    // We reverse to display in chronological caller→callee order.
    const reversed = [...frames].reverse();
    const reversedFailingSiteIdx = reversed.length - 1 - effectiveFailingSiteIndex;

    // Full chain: all frames in caller→callee order, capped at 20 to avoid extreme noise
    const fullChainFrames = reversed.slice(0, 20);
    const fullCallChain: CallChainStep[] = fullChainFrames.map((frame, i) => ({
        order: i + 1,
        functionName: cleanFunctionName(frame.functionName),
        filePath: frame.filePath,
        lineNumber: frame.lineNumber,
        isFailingSite: i === reversedFailingSiteIdx,
        isApplication: frame.isApplication,
        classification: frame.classification,
        failingExpression: i === reversedFailingSiteIdx ? failingExpression : undefined,
        provenance: "Observed" as const,
    }));

    // Application chain: only application frames, max 8, in caller→callee order.
    // This eliminates runtime noise (processTicksAndRejections, Module._resolveFilename, etc.)
    const appFrames = reversed.filter((f) => f.isApplication).slice(0, 8);
    const appFailingSiteIdx = appFrames.length - 1 - appFrames
        .slice()
        .reverse()
        .findIndex((_, i, arr) => arr[i] === reversed[reversedFailingSiteIdx]);

    const applicationCallChain: CallChainStep[] = appFrames.map((frame, i) => {
        // Re-identify which app frame is the failing site
        const isFailingSite =
            frame === reversed[reversedFailingSiteIdx] ||
            (i === appFrames.length - 1 && effectiveFailingSiteIndex === failingSiteIndex);

        return {
            order: i + 1,
            functionName: cleanFunctionName(frame.functionName),
            filePath: frame.filePath,
            lineNumber: frame.lineNumber,
            isFailingSite,
            isApplication: true,
            classification: frame.classification,
            failingExpression: isFailingSite ? failingExpression : undefined,
            provenance: "Observed" as const,
        };
    });

    return { applicationCallChain, fullCallChain };
}

/**
 * @deprecated Use buildCallChains() instead.
 * Kept for backwards compatibility with any existing callers.
 */
export function buildCallChain(
    frames: StackFrame[],
    failingExpression?: string
): CallChainStep[] {
    return buildCallChains(frames, failingExpression).applicationCallChain;
}

function cleanFunctionName(funcName: string): string {
    if (!funcName || funcName === "<anonymous>") {
        return "anonymous()";
    }

    let clean = funcName;
    if (clean.startsWith("async ")) {
        clean = clean.replace(/^async\s+/, "");
    }
    // Normalize "new ClassName" to "new ClassName()"
    if (clean.startsWith("new ")) {
        clean = clean.replace(/^new\s+/, "new ");
    }

    if (!clean.endsWith(")")) {
        clean = `${clean}()`;
    }

    return clean;
}

/**
 * Classify a stack frame for developer-facing display.
 * Used by the stack parser to set the classification field.
 */
export function classifyFrame(
    filePath: string,
    functionName: string
): FrameClassification {
    if (!filePath) return "Unknown";

    const fp = filePath.toLowerCase();

    // Node.js internals
    if (
        fp.startsWith("node:") ||
        fp.startsWith("node_modules/node:") ||
        fp === "<anonymous>" ||
        fp === "unknown" ||
        /^internal\/.+/.test(fp)
    ) {
        return "Runtime";
    }

    // Native code
    if (fp === "native" || fp.includes("[native code]")) {
        return "Native";
    }

    // node_modules — vendor
    if (fp.includes("node_modules/")) {
        // Check for known frameworks
        const frameworks = [
            "next/", "react/", "react-dom/", "express/", "fastify/",
            "koa/", "hapi/", "nest/", "@nestjs/", "prisma/", "@prisma/",
            "webpack/", "turbopack/", "babel/", "@babel/",
        ];
        if (frameworks.some((f) => fp.includes(f))) return "Framework";
        return "Vendor";
    }

    // webpack/next dist
    if (fp.includes(".next/") || fp.includes("webpack-internal://") || fp.includes("/_next/")) {
        return "Framework";
    }

    // Process tick / timers
    const fn = functionName.toLowerCase();
    if (
        fn.includes("processticks") ||
        fn.includes("runmicrotasks") ||
        fn === "module._resolvefilename" ||
        fn === "module.load" ||
        fn.startsWith("module.require") ||
        fn === "modulejob.run"
    ) {
        return "Runtime";
    }

    return "Application";
}
