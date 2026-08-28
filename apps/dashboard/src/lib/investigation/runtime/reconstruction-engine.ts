import type { Evidence } from "@halo/investigation-engine";
import type {
    FullRuntimeReconstruction,
    RuntimeFailureReconstruction,
} from "./types";
import { parseStackTrace } from "./stack-parser";
import { resolveSourceContext } from "./source-resolver";
import { buildCallChains } from "./call-chain";
import { collectRuntimeContext } from "./context-collector";

/**
 * Main Runtime Reconstruction Engine
 *
 * Orchestrates Feature 1 (Exact Runtime Failure Reconstruction) and
 * Feature 2 (Runtime Context Reconstruction) for an incident anchor event
 * and its occurrence-scoped correlated telemetry evidence.
 *
 * Key guarantees:
 * - runtimeOrigin is detected from actual telemetry (drives narrative: Node events
 *   are never called "browser exceptions")
 * - sourceResolved is true only when actual source was read from disk
 * - applicationCallChain contains only application frames (no runtime noise)
 * - fullCallChain preserves all frames for the raw stack view
 */
export function reconstructRuntimeFailure(
    anchorError: Evidence | undefined,
    correlatedEvents: Evidence[] = [],
    projectRoot?: string
): FullRuntimeReconstruction | undefined {
    if (!anchorError) {
        return undefined;
    }

    // --- Runtime origin detection ---
    const runtimeOrigin = detectRuntimeOrigin(anchorError);

    // --- Stack parsing ---
    const rawStack =
        typeof anchorError.metadata?.stack === "string"
            ? anchorError.metadata.stack
            : anchorError.description || "";

    const frames = parseStackTrace(rawStack);

    // Select primary failing frame: first application frame with a line number
    const applicationFrame = frames.find((f) => f.isApplication && f.lineNumber);
    const primaryFailingFrame = applicationFrame || frames.find((f) => f.lineNumber) || frames[0];

    // --- Source resolution ---
    const sourceContext = resolveSourceContext(
        primaryFailingFrame,
        projectRoot,
        anchorError.release
    );
    const sourceResolved = sourceContext?.resolutionStatus === "exact_file";

    const failingExpression = sourceContext?.failingExpression;

    // --- Call chains ---
    const { applicationCallChain, fullCallChain } = buildCallChains(frames, failingExpression);

    // --- Exception classification ---
    const exceptionClass = extractExceptionClass(anchorError.title, rawStack);
    const exceptionMessage = extractExceptionMessage(anchorError.title, anchorError.description);

    const failure: RuntimeFailureReconstruction = {
        exceptionTitle: anchorError.title,
        exceptionClass,
        exceptionMessage,
        rawStack,
        frames,
        applicationCallChain,
        fullCallChain,
        primaryFailingFrame,
        sourceContext,
        failingExpression,
        locationProvenance: sourceResolved ? "Observed" : "Inferred",
    };

    // --- Context collection (occurrence-scoped) ---
    const context = collectRuntimeContext(anchorError, correlatedEvents, sourceContext);

    return {
        failure,
        context,
        runtimeOrigin,
        sourceResolved,
    };
}

/**
 * Detect the runtime origin from the anchor event's telemetry.
 *
 * We look at sdkName, service, and metadata signals.
 * This determines whether the investigation narrative should use
 * "browser/client" or "node/server/application" language.
 */
function detectRuntimeOrigin(anchorError: Evidence): "node" | "browser" | "unknown" {
    const meta = anchorError.metadata || {};
    const sdkName = String(anchorError.source || meta.sdkName || "").toLowerCase();
    const service = String(anchorError.service || "").toLowerCase();

    // Explicit browser signals
    if (
        sdkName.includes("browser") ||
        sdkName.includes("javascript") ||
        sdkName.includes("js-web") ||
        typeof meta.userAgent === "string" ||
        typeof meta.window === "string" ||
        service === "browser" ||
        service === "frontend" ||
        service === "client"
    ) {
        return "browser";
    }

    // Explicit Node.js signals
    if (
        sdkName.includes("node") ||
        sdkName.includes("server") ||
        typeof meta.nodeVersion === "string" ||
        typeof meta.process === "object" ||
        service === "node" ||
        service === "server" ||
        service === "backend" ||
        service === "api"
    ) {
        return "node";
    }

    // Stack trace heuristic: Node internals present → likely Node
    const rawStack =
        typeof anchorError.metadata?.stack === "string"
            ? anchorError.metadata.stack
            : anchorError.description || "";
    if (
        rawStack.includes("node:internal") ||
        rawStack.includes("processTicksAndRejections") ||
        rawStack.includes("Module._resolveFilename") ||
        rawStack.includes("at async Module")
    ) {
        return "node";
    }

    return "unknown";
}

function extractExceptionClass(title: string, rawStack: string): string {
    const classMatch = (rawStack + " " + title).match(
        /\b([A-Z][a-zA-Z0-9_]*(?:Error|Exception))\b/
    );
    if (classMatch) return classMatch[1];
    return "RuntimeError";
}

function extractExceptionMessage(title: string, description?: string): string {
    if (description && description.length > title.length) {
        const firstLine = description.split("\n")[0].trim();
        return firstLine.replace(/^[A-Za-z0-9_$]+Error:\s*/, "");
    }
    return title.replace(/^[A-Za-z0-9_$]+Error:\s*/, "");
}
