import type { Evidence } from "@halo/investigation-engine";
import type {
    ReconstructedRequestContext,
    CategorizedBreadcrumb,
    ReconstructedSpanNode,
    ReconstructedRuntimeMetadata,
    ReconstructedSessionContext,
    ContextualExecutionStep,
    RuntimeContextReconstruction,
    ReconstructionProvenance,
    CorrelationBasis,
    SourceContext,
} from "./types";
import { sanitizeHeaders, redactSensitiveData } from "./redaction";
import { detectMaterialGaps } from "./telemetry-gaps";

/**
 * Occurrence-Scoped Runtime Context Collector
 *
 * Collects ONLY telemetry that belongs to the specific anchor occurrence.
 *
 * Correlation hierarchy (strictly enforced):
 *   1. RequestId match  — strongest, exact identity
 *   2. TraceId match    — exact distributed trace membership
 *   3. SessionId match  — same user session (weaker, may include unrelated actions)
 *   4. Temporal         — only when anchor has NO identifiers at all (labeled accordingly)
 *
 * The collector never mixes telemetry from different requests/scenarios
 * merely because they are temporally adjacent.
 */
export function collectRuntimeContext(
    anchorError: Evidence,
    correlatedEvents: Evidence[],
    sourceContext?: SourceContext
): RuntimeContextReconstruction {
    const request = extractRequestContext(anchorError, correlatedEvents);
    const breadcrumbs = extractCategorizedBreadcrumbs(anchorError);
    const spanTree = extractSpanHierarchy(anchorError, correlatedEvents);
    const runtimeMetadata = extractRuntimeMetadata(anchorError);
    const sessionContext = extractSessionContext(anchorError);

    const availableTelemetry: string[] = [];
    if (anchorError.description || anchorError.metadata?.stack) {
        availableTelemetry.push("Exception Stack Trace");
    }
    if (sourceContext?.lines && sourceContext.lines.length > 0) {
        availableTelemetry.push("Repository Source Code");
    }
    if (request) {
        availableTelemetry.push(`HTTP Request (${request.method} ${request.routePath}) [${request.correlationBasis}]`);
    }
    if (breadcrumbs.length > 0) {
        availableTelemetry.push(`Preceding Breadcrumbs (${breadcrumbs.length} signals)`);
    }
    if (anchorError.traceId) {
        availableTelemetry.push(`Distributed Trace ID (${anchorError.traceId.slice(0, 12)}…)`);
    }
    if (anchorError.sessionId) {
        availableTelemetry.push(`Session ID (${anchorError.sessionId.slice(0, 12)}…)`);
    }
    if (runtimeMetadata.release) {
        availableTelemetry.push(`Release Version (${runtimeMetadata.release})`);
    }

    const executionModel = buildContextualExecutionModel(
        anchorError,
        request,
        breadcrumbs,
        sourceContext
    );

    const telemetryGaps = detectMaterialGaps(
        anchorError,
        request,
        breadcrumbs,
        spanTree,
        sourceContext
    );

    return {
        request,
        breadcrumbs,
        spanTree,
        runtimeMetadata,
        sessionContext,
        executionModel,
        availableTelemetry,
        telemetryGaps,
    };
}

/* -------------------------------------------------------------------------- */
/* 1. Request Context — occurrence-scoped                                      */
/* -------------------------------------------------------------------------- */

function extractRequestContext(
    anchorError: Evidence,
    correlatedEvents: Evidence[]
): ReconstructedRequestContext | undefined {
    // Priority 1: Check if the anchor event itself carries HTTP request info in metadata
    const httpMeta = (anchorError.metadata?.http ||
        anchorError.metadata?.request) as Record<string, unknown> | undefined;

    // Priority 2: Find a correlated event with an EXACT requestId match
    let correlatedReq: Evidence | undefined;
    let correlationBasis: CorrelationBasis = "Derived";
    let correlationExplanation = "";

    if (anchorError.requestId) {
        const exactReqMatch = correlatedEvents.find(
            (e) =>
                e.requestId === anchorError.requestId &&
                e.id !== anchorError.id &&
                (e.type === "TRACE" || e.type === "LOG")
        );
        if (exactReqMatch) {
            correlatedReq = exactReqMatch;
            correlationBasis = "RequestId";
            correlationExplanation = `Exact requestId match: ${anchorError.requestId}`;
        }
    }

    // Priority 3: Exact traceId match (if no requestId match found)
    if (!correlatedReq && anchorError.traceId) {
        const exactTraceMatch = correlatedEvents.find(
            (e) =>
                e.traceId === anchorError.traceId &&
                e.id !== anchorError.id &&
                (e.type === "TRACE" || e.type === "LOG")
        );
        if (exactTraceMatch) {
            correlatedReq = exactTraceMatch;
            correlationBasis = "TraceId";
            correlationExplanation = `Trace membership match: traceId ${anchorError.traceId}`;
        }
    }

    // Derive URL and method from multiple sources
    const method =
        (typeof httpMeta?.method === "string" ? httpMeta.method : undefined) ||
        correlatedReq?.operation ||
        anchorError.operation ||
        (anchorError.resource ? "GET" : undefined);

    const url =
        (typeof httpMeta?.url === "string" ? httpMeta.url : undefined) ||
        correlatedReq?.resource ||
        anchorError.resource ||
        "";

    // If neither direct http metadata, nor a correlated request, nor resource field → no request context
    if (!url && !httpMeta && !correlatedReq && !anchorError.operation) {
        return undefined;
    }

    // Determine correlation basis when info comes from the anchor itself
    if (!correlatedReq) {
        if (anchorError.resource || anchorError.operation) {
            correlationBasis = "Derived";
            correlationExplanation = "Derived from anchor event resource/operation fields";
        }
        if (httpMeta) {
            correlationBasis = "Anchor";
            correlationExplanation = "HTTP metadata embedded in the anchor error event";
        }
    }

    let routePath = url;
    try {
        if (url.startsWith("http")) {
            const parsed = new URL(url);
            routePath = parsed.pathname;
        }
    } catch {
        routePath = url;
    }

    const status =
        (httpMeta?.status !== undefined ? (httpMeta.status as number) : undefined) ||
        correlatedReq?.status ||
        anchorError.status;

    const durationMs =
        (typeof httpMeta?.durationMs === "number" ? httpMeta.durationMs : undefined) ||
        correlatedReq?.durationMs ||
        anchorError.durationMs;

    const requestId = anchorError.requestId || correlatedReq?.requestId;
    const traceId = anchorError.traceId || correlatedReq?.traceId;

    const rawHeaders = httpMeta?.headers as Record<string, string> | undefined;
    const sanitizedHeaders = sanitizeHeaders(rawHeaders);

    const queryParams: Record<string, string> = {};
    if (url.includes("?")) {
        try {
            const parsed = new URL(url, "http://localhost");
            parsed.searchParams.forEach((v, k) => {
                queryParams[k] = redactSensitiveData(v) as string;
            });
        } catch {
            // Ignore parse errors
        }
    }

    let bodyExcerpt: string | undefined;
    if (httpMeta?.body) {
        const redactedBody = redactSensitiveData(httpMeta.body);
        bodyExcerpt =
            typeof redactedBody === "string"
                ? redactedBody
                : JSON.stringify(redactedBody).slice(0, 300);
    }

    const provenance: ReconstructionProvenance =
        correlationBasis === "RequestId" || correlationBasis === "Anchor"
            ? "Observed"
            : correlationBasis === "TraceId"
            ? "Correlated"
            : "Inferred";

    return {
        method: (method || "GET").toUpperCase(),
        url,
        routePath,
        status: status ? (isNaN(Number(status)) ? status : Number(status)) : undefined,
        durationMs: durationMs || undefined,
        requestId: requestId || undefined,
        traceId: traceId || undefined,
        queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        headers: sanitizedHeaders,
        bodyExcerpt,
        correlationBasis,
        correlationExplanation,
        provenance,
    };
}

/* -------------------------------------------------------------------------- */
/* 2. Breadcrumb Context — anchor event only                                  */
/* -------------------------------------------------------------------------- */

function extractCategorizedBreadcrumbs(anchorError: Evidence): CategorizedBreadcrumb[] {
    // Breadcrumbs are ONLY extracted from the anchor event itself.
    // We never merge breadcrumbs from correlated events — they belong to different requests/sessions.
    const rawBreadcrumbs = (anchorError.metadata?.breadcrumbs ||
        anchorError.breadcrumbs ||
        []) as Array<Record<string, unknown>>;
    if (!Array.isArray(rawBreadcrumbs) || rawBreadcrumbs.length === 0) {
        return [];
    }

    const anchorTime = anchorError.timestamp ? new Date(anchorError.timestamp).getTime() : Date.now();

    return rawBreadcrumbs.map((b) => {
        const timestamp = b.timestamp ? new Date(String(b.timestamp)) : undefined;
        const offsetMs = timestamp ? timestamp.getTime() - anchorTime : 0;
        const timeOffsetFormatted = formatTimeOffset(offsetMs);

        const category = categorizeBreadcrumb(
            String(b.category || ""),
            String(b.message || "")
        );
        const data =
            b.data && typeof b.data === "object"
                ? (redactSensitiveData(b.data as Record<string, unknown>) as Record<string, unknown>)
                : undefined;

        return {
            timestamp,
            timeOffsetFormatted,
            category,
            message: String(b.message || "Breadcrumb signal"),
            data,
            provenance: "Observed" as ReconstructionProvenance,
        };
    });
}

function categorizeBreadcrumb(
    rawCat: string,
    message: string
): CategorizedBreadcrumb["category"] {
    const c = rawCat.toLowerCase();
    const m = message.toLowerCase();

    if (c.includes("nav") || m.includes("navigate") || m.includes("route")) return "navigation";
    if (
        c.includes("http") ||
        c.includes("fetch") ||
        c.includes("request") ||
        m.includes("get ") ||
        m.includes("post ")
    )
        return "request";
    if (
        c.includes("db") ||
        c.includes("prisma") ||
        c.includes("sql") ||
        c.includes("query") ||
        m.includes("select ") ||
        m.includes("insert ")
    )
        return "database";
    if (
        c.includes("click") ||
        c.includes("input") ||
        c.includes("user") ||
        m.includes("click") ||
        m.includes("submit")
    )
        return "user-action";
    if (
        c.includes("err") ||
        c.includes("warn") ||
        m.includes("error") ||
        m.includes("failed")
    )
        return "error";

    return "application";
}

function formatTimeOffset(offsetMs: number): string {
    if (Math.abs(offsetMs) < 1000) {
        return `${offsetMs >= 0 ? "+" : ""}${offsetMs}ms`;
    }
    const seconds = Math.round(offsetMs / 1000);
    return `${seconds >= 0 ? "+" : ""}${seconds}s`;
}

/* -------------------------------------------------------------------------- */
/* 3. Trace and Span Hierarchy — occurrence-scoped                            */
/* -------------------------------------------------------------------------- */

function extractSpanHierarchy(
    anchorError: Evidence,
    correlatedEvents: Evidence[]
): ReconstructedSpanNode[] | undefined {
    // Only include spans that share the exact traceId with the anchor.
    // Do not aggregate all TRACE events in the correlated set.
    if (!anchorError.traceId) return undefined;

    const traceEvents = correlatedEvents.filter(
        (e) => e.traceId === anchorError.traceId && (e.type === "TRACE" || e.spanId)
    );
    if (traceEvents.length === 0) return undefined;

    const spanMap = new Map<string, ReconstructedSpanNode>();

    for (const ev of traceEvents) {
        const id = ev.spanId || ev.id;
        spanMap.set(id, {
            id,
            name: ev.title || ev.operation || "Operation",
            service: ev.service,
            durationMs: ev.durationMs,
            status: ev.status,
            isFailingSpan:
                ev.id === anchorError.id || String(ev.status || "").startsWith("5"),
            parentSpanId: ev.parentSpanId,
            children: [],
            provenance: "Observed",
        });
    }

    const roots: ReconstructedSpanNode[] = [];
    for (const span of spanMap.values()) {
        if (span.parentSpanId && spanMap.has(span.parentSpanId)) {
            spanMap.get(span.parentSpanId)!.children.push(span);
        } else {
            roots.push(span);
        }
    }

    return roots.length > 0 ? roots : undefined;
}

/* -------------------------------------------------------------------------- */
/* 4. Runtime Metadata                                                        */
/* -------------------------------------------------------------------------- */

function extractRuntimeMetadata(anchorError: Evidence): ReconstructedRuntimeMetadata {
    const meta = anchorError.metadata || {};
    const sdkName = String(anchorError.source || meta.sdkName || "").toLowerCase();

    const isBrowser =
        sdkName.includes("browser") ||
        meta.userAgent !== undefined ||
        meta.window !== undefined;
    const runtimeType = isBrowser ? "browser" : "node";

    return {
        runtimeType,
        runtimeVersion:
            typeof meta.runtimeVersion === "string"
                ? meta.runtimeVersion
                : typeof meta.nodeVersion === "string"
                ? meta.nodeVersion
                : undefined,
        os:
            typeof meta.os === "string"
                ? meta.os
                : typeof meta.platform === "string"
                ? meta.platform
                : undefined,
        architecture: typeof meta.arch === "string" ? meta.arch : undefined,
        environment: anchorError.environment,
        release: anchorError.release,
        service: anchorError.service !== "unknown" ? anchorError.service : undefined,
        provenance: "Observed",
    };
}

/* -------------------------------------------------------------------------- */
/* 5. Session Context                                                         */
/* -------------------------------------------------------------------------- */

function extractSessionContext(anchorError: Evidence): ReconstructedSessionContext {
    const meta = anchorError.metadata || {};

    return {
        sessionId: anchorError.sessionId,
        userKey:
            anchorError.user?.id ||
            anchorError.user?.email ||
            (typeof meta.userId === "string" ? meta.userId : undefined),
        sessionStartedAt: meta.sessionStartedAt
            ? new Date(String(meta.sessionStartedAt))
            : undefined,
        crashedAt: meta.crashedAt ? new Date(String(meta.crashedAt)) : undefined,
        isCrashed: Boolean(meta.crashedAt || meta.isFatal),
        provenance: anchorError.sessionId ? "Observed" : "Unavailable",
    };
}

/* -------------------------------------------------------------------------- */
/* 6. Contextual Execution Model                                              */
/* -------------------------------------------------------------------------- */

function buildContextualExecutionModel(
    anchorError: Evidence,
    request?: ReconstructedRequestContext,
    breadcrumbs: CategorizedBreadcrumb[] = [],
    sourceContext?: SourceContext
): ContextualExecutionStep[] {
    const steps: ContextualExecutionStep[] = [];

    // 1. Request entry point
    if (request) {
        steps.push({
            nodeType: "request",
            label: `${request.method} ${request.routePath}`,
            detail: request.status ? `Returned HTTP ${request.status}` : undefined,
            provenance: request.provenance,
        });
    }

    // 2. Preceding user action (from anchor breadcrumbs only)
    const userAction = breadcrumbs.find((b) => b.category === "user-action");
    if (userAction) {
        steps.push({
            nodeType: "operation",
            label: userAction.message,
            provenance: "Observed",
        });
    }

    // 3. Containing function (from actual source)
    if (sourceContext?.containingFunction) {
        steps.push({
            nodeType: "function",
            label: `${sourceContext.containingFunction}()`,
            detail: `In ${sourceContext.filePath.split("/").pop()}:${sourceContext.failingLineNumber}`,
            provenance: "Observed",
        });
    }

    // 4. Failing expression (from actual source parsing)
    if (sourceContext?.failingExpression) {
        steps.push({
            nodeType: "failing-expression",
            label: sourceContext.failingExpression,
            detail: `At line ${sourceContext.failingLineNumber}`,
            provenance: "Observed",
        });
    }

    // 5. Exception
    steps.push({
        nodeType: "exception",
        label: anchorError.title,
        detail: anchorError.service !== "unknown" ? `in ${anchorError.service}` : undefined,
        provenance: "Observed",
    });

    return steps;
}
