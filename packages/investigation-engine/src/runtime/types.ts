/**
 * Runtime Failure and Context Reconstruction Types
 *
 * Provides structured models for:
 * - Feature 1: Exact Runtime Failure Reconstruction
 * - Feature 2: Runtime Context Reconstruction
 *
 * Every element tracks its exact provenance:
 * - Observed: directly captured in verified telemetry
 * - Correlated: matched via shared IDs (session/trace/request)
 * - Inferred: derived through logical deduction
 * - Unavailable: genuinely not captured
 */

export type ReconstructionProvenance = "Observed" | "Correlated" | "Inferred" | "Unavailable";

/**
 * How a piece of correlated telemetry was linked to the anchor occurrence.
 */
export type CorrelationBasis =
    | "Anchor"       // This IS the anchor event
    | "RequestId"    // Exact requestId match
    | "TraceId"      // Exact traceId match
    | "SessionId"    // Same sessionId
    | "Temporal"     // Temporally adjacent only (weakest — only when no identifiers exist)
    | "Derived";     // Derived from anchor metadata fields

/**
 * Frame classification for developer-facing presentation.
 */
export type FrameClassification = "Application" | "Framework" | "Runtime" | "Vendor" | "Native" | "Unknown";

export interface StackFrame {
    order: number;
    functionName: string;
    moduleOrPackage?: string;
    rawFilePath: string;
    filePath: string;
    lineNumber?: number;
    columnNumber?: number;
    isInternal: boolean;
    isApplication: boolean;
    /** Developer-facing classification used to filter the application call chain */
    classification: FrameClassification;
    sourceMapStatus?: "exact" | "not_needed" | "missing_map" | "failed";
    generatedLocation?: { file: string; line?: number; column?: number };
}

export interface SourceContext {
    filePath: string;
    failingLineNumber: number;
    failingColumnNumber?: number;
    startLineNumber: number;
    lines: { lineNumber: number; content: string; isFailingLine: boolean }[];
    containingFunction?: string;
    failingExpression?: string;
    failingStatement?: string;
    resolutionStatus: "exact_file" | "fallback_local" | "source_revision_unavailable" | "file_not_found";
    /**
     * Human-readable reason when source could not be resolved.
     * Never fabricated. Only present when resolutionStatus !== "exact_file".
     */
    unavailabilityReason?: string;
    revision?: string;
}

export interface CallChainStep {
    order: number;
    functionName: string;
    filePath?: string;
    lineNumber?: number;
    isFailingSite: boolean;
    isApplication: boolean;
    classification: FrameClassification;
    failingExpression?: string;
    provenance: ReconstructionProvenance;
}

export interface RuntimeFailureReconstruction {
    exceptionTitle: string;
    exceptionClass: string;
    exceptionMessage: string;
    rawStack: string;
    /** All frames unfiltered — for raw stack view */
    frames: StackFrame[];
    /**
     * Application-only frames in caller→callee order.
     * This is the primary developer-facing chain.
     */
    applicationCallChain: CallChainStep[];
    /**
     * Full chain including framework/runtime frames.
     * Shown in expanded "raw stack" view.
     */
    fullCallChain: CallChainStep[];
    primaryFailingFrame?: StackFrame;
    sourceContext?: SourceContext;
    failingExpression?: string;
    locationProvenance: ReconstructionProvenance;
}

export interface ReconstructedRequestContext {
    method: string;
    url: string;
    routePath: string;
    status?: number | string;
    durationMs?: number;
    requestId?: string;
    traceId?: string;
    queryParams?: Record<string, string>;
    headers?: Record<string, string>;
    bodyExcerpt?: string;
    /** How this request was correlated to the anchor event */
    correlationBasis: CorrelationBasis;
    /** Human-readable explanation, e.g. "Exact requestId match: req-abc-123" */
    correlationExplanation: string;
    provenance: ReconstructionProvenance;
}

export interface CategorizedBreadcrumb {
    timestamp?: Date;
    timeOffsetFormatted: string;
    category: "navigation" | "request" | "database" | "user-action" | "application" | "error" | "other";
    message: string;
    data?: Record<string, unknown>;
    provenance: ReconstructionProvenance;
}

export interface ReconstructedSpanNode {
    id: string;
    name: string;
    service?: string;
    durationMs?: number;
    status?: string | number;
    isFailingSpan: boolean;
    parentSpanId?: string;
    children: ReconstructedSpanNode[];
    provenance: ReconstructionProvenance;
}

export interface ReconstructedRuntimeMetadata {
    runtimeType: "node" | "browser" | "unknown";
    runtimeVersion?: string;
    os?: string;
    architecture?: string;
    environment?: string;
    release?: string;
    service?: string;
    provenance: ReconstructionProvenance;
}

export interface ReconstructedSessionContext {
    sessionId?: string;
    userKey?: string;
    sessionStartedAt?: Date;
    crashedAt?: Date;
    isCrashed: boolean;
    provenance: ReconstructionProvenance;
}

export interface ContextualExecutionStep {
    nodeType: "request" | "input" | "operation" | "function" | "data-access" | "observed-result" | "failing-expression" | "exception";
    label: string;
    detail?: string;
    provenance: ReconstructionProvenance;
}

export interface MaterialTelemetryGap {
    missingSignal: string;
    whyItMatters: string;
    howToCollect: string;
    impactOnConclusion: string;
}

export interface RuntimeContextReconstruction {
    request?: ReconstructedRequestContext;
    breadcrumbs: CategorizedBreadcrumb[];
    spanTree?: ReconstructedSpanNode[];
    runtimeMetadata: ReconstructedRuntimeMetadata;
    sessionContext: ReconstructedSessionContext;
    executionModel: ContextualExecutionStep[];
    availableTelemetry: string[];
    telemetryGaps: MaterialTelemetryGap[];
}

export interface FullRuntimeReconstruction {
    failure: RuntimeFailureReconstruction;
    context: RuntimeContextReconstruction;
    /** Detected runtime of the anchor event — drives narrative (never call Node events "browser exceptions") */
    runtimeOrigin: "node" | "browser" | "unknown";
    /** True when actual source was resolved from disk — gates code patch generation */
    sourceResolved: boolean;
}
