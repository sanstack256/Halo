/**
 * Runtime Failure and Context Reconstruction Types
 */

export type ReconstructionProvenance = "Observed" | "Correlated" | "Inferred" | "Unavailable";

export type CorrelationBasis =
    | "Anchor"
    | "RequestId"
    | "TraceId"
    | "SessionId"
    | "Temporal"
    | "Derived";

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
    resolutionStatus:
        | "exact_file"
        | "source_revision_unavailable"
        | "file_not_found"
        | "repository_not_configured"
        | "commit_unavailable"
        | "source_access_denied"
        | "rate_limit"
        | "github_api_error"
        | "source_map_unavailable"
        | "no_frame";
    unavailabilityReason?: string;
    revision?: string;
    repositoryFullName?: string;
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
    frames: StackFrame[];
    applicationCallChain: CallChainStep[];
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
    headers?: Record<string, string>;
    queryParams?: Record<string, string>;
    bodyExcerpt?: string;
    requestId?: string;
    traceId?: string;
    correlationBasis: CorrelationBasis;
    correlationExplanation: string;
    provenance: ReconstructionProvenance;
}

export interface CategorizedBreadcrumb {
    timestamp: Date;
    category: "http" | "navigation" | "user_action" | "console" | "database" | "system" | "other";
    message: string;
    data?: Record<string, unknown>;
    level?: string;
    timeOffsetMs?: number;
}

export interface ReconstructedSpanNode {
    id: string;
    parentId?: string;
    name: string;
    service: string;
    durationMs: number;
    startTimeMs: number;
    status: "ok" | "error" | "unset";
    errorMessage?: string;
    attributes?: Record<string, unknown>;
    children: ReconstructedSpanNode[];
    isFailingSpan?: boolean;
}

export interface ReconstructedRuntimeMetadata {
    environment?: string;
    release?: string;
    nodeVersion?: string;
    os?: string;
    sdkName?: string;
    sdkVersion?: string;
    serverHost?: string;
}

export interface ReconstructedSessionContext {
    sessionId?: string;
    userId?: string;
    userEmail?: string;
    deviceType?: string;
    browser?: string;
    ipAddress?: string;
}

export interface ContextualExecutionStep {
    order: number;
    timestamp: Date;
    timeOffsetMs: number;
    category: "request" | "breadcrumb" | "span" | "error" | "reconstruction";
    title: string;
    details?: string;
    provenance: ReconstructionProvenance;
    isAnchor?: boolean;
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
    runtimeOrigin: "node" | "browser" | "unknown";
    sourceResolved: boolean;
}
