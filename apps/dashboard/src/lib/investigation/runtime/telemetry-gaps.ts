import type { Evidence } from "@halo/investigation-engine";
import type {
    ReconstructedRequestContext,
    CategorizedBreadcrumb,
    ReconstructedSpanNode,
    SourceContext,
    MaterialTelemetryGap,
} from "./types";

/**
 * Material Telemetry Gap Detector
 *
 * Distinguishes what is confirmed from what is genuinely missing.
 * Explains why each gap matters and how to instrument it without guessing.
 */
export function detectMaterialGaps(
    anchorError: Evidence,
    request?: ReconstructedRequestContext,
    breadcrumbs: CategorizedBreadcrumb[] = [],
    spanTree?: ReconstructedSpanNode[],
    sourceContext?: SourceContext
): MaterialTelemetryGap[] {
    const gaps: MaterialTelemetryGap[] = [];

    // 1. Source Code Gaps
    if (!sourceContext || sourceContext.resolutionStatus === "file_not_found" || sourceContext.resolutionStatus === "source_revision_unavailable") {
        gaps.push({
            missingSignal: "Repository Source Code Resolution",
            whyItMatters: "Without source code, Halo cannot highlight the exact failing line or extract the containing expression.",
            howToCollect: "Link the GitHub/GitLab repository in Project Settings or provide release source maps during deployment.",
            impactOnConclusion: "Investigation relies solely on the raw stack trace string without syntax context.",
        });
    }

    // 2. HTTP Request Body / Payload Gaps
    if (request && !request.bodyExcerpt && (request.method === "POST" || request.method === "PUT" || request.method === "PATCH")) {
        gaps.push({
            missingSignal: "HTTP Request Payload Excerpt",
            whyItMatters: "The failing HTTP request did not capture the request payload fields, making it impossible to see the exact input parameters that triggered the error.",
            howToCollect: "Enable `captureHttpPayload` in your Halo SDK configuration with privacy redactions.",
            impactOnConclusion: "Inputs to the failing API route are inferred from URL and breadcrumbs rather than verified payload data.",
        });
    }

    // 3. Distributed Tracing / Backend Execution Gaps
    if (!spanTree && !anchorError.traceId) {
        gaps.push({
            missingSignal: "Distributed Trace & Span Hierarchy",
            whyItMatters: "Trace spans were not recorded for this request, preventing inspection of downstream service latency, database queries, and intermediate function timing.",
            howToCollect: "Wrap critical handlers with OpenTelemetry or Halo's distributed tracing middleware.",
            impactOnConclusion: "Internal service propagation cannot be directly visualized as a span tree.",
        });
    }

    // 4. Database Query Telemetry Gaps
    const hasDbBreadcrumbs = breadcrumbs.some(b => b.category === "database");
    const isDbRelated = /prisma|postgres|sql|database|query/i.test(anchorError.title || "");
    if (isDbRelated && !hasDbBreadcrumbs) {
        gaps.push({
            missingSignal: "Database Query Logs",
            whyItMatters: "The error indicates a database operation failed, but query parameters and execution latency were not captured in preceding breadcrumbs.",
            howToCollect: "Enable query logging in Prisma (`log: ['query', 'error']`) or database middleware.",
            impactOnConclusion: "The exact query parameters triggering the database error remain unobserved.",
        });
    }

    // 5. Session Replay Telemetry
    if (!anchorError.sessionId) {
        gaps.push({
            missingSignal: "User Session Continuity",
            whyItMatters: "No session ID was attached to this event, preventing reconstruction of preceding user journeys across multiple pages.",
            howToCollect: "Ensure Halo SDK `sessionId` is passed during initialization.",
            impactOnConclusion: "Telemetry is scoped only to this single isolated event.",
        });
    }

    return gaps;
}
