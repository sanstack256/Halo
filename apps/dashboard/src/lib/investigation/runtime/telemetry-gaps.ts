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
 * Detects ACTUALLY missing telemetry based on what the incident evidence does and does not contain.
 *
 * Rules:
 *   - Gaps must be derived from actual missing signals — not from Halo features the project
 *     hasn't enabled for unrelated reasons.
 *   - The highest-priority gap for an HTTP 500 incident with no server-side evidence is
 *     the missing server-side execution telemetry (not source code, not traces).
 *   - Source code gaps only appear when source resolution was attempted and failed.
 *   - Session replay gaps only appear when this incident has no session associated.
 *   - Distributed tracing gaps only appear when no trace was captured.
 *   - Database query gaps only appear when the error text explicitly references a database.
 */
export function detectMaterialGaps(
    anchorError: Evidence,
    request?: ReconstructedRequestContext,
    breadcrumbs: CategorizedBreadcrumb[] = [],
    spanTree?: ReconstructedSpanNode[],
    sourceContext?: SourceContext,
    hasServerSideEvidence?: boolean,
): MaterialTelemetryGap[] {
    const gaps: MaterialTelemetryGap[] = [];

    const requestStatus = request?.status ?? null;
    const isHttpErrorStatus = requestStatus != null && String(requestStatus).match(/^[45]/);
    const requestEndpoint = request?.url ?? null;

    // 1. Server-Side Execution Telemetry for HTTP 500/4xx (HIGHEST PRIORITY)
    // This is the most critical gap for dependency-failure style incidents.
    // Without it, the exact backend cause is genuinely Unknown.
    if (isHttpErrorStatus && requestEndpoint && !hasServerSideEvidence) {
        gaps.push({
            missingSignal: `Server-Side Execution Telemetry for ${request?.method ?? "HTTP"} ${requestEndpoint} → ${requestStatus}`,
            whyItMatters:
                `\`${request?.method ?? "REQUEST"} ${requestEndpoint}\` returned HTTP ${requestStatus}, ` +
                `but no server-side exception, stack trace, or execution log was captured for this transaction. ` +
                `Without this evidence, the exact backend cause of the HTTP ${requestStatus} is unknown — ` +
                `Halo cannot determine whether it was a dependency failure, configuration error, validation error, runtime exception, or infrastructure issue.`,
            howToCollect:
                `Instrument the server-side handler for \`${requestEndpoint}\` with the Halo Node.js SDK. ` +
                `Enable \`captureErrors: true\` and wrap the route handler with \`halo.withServerErrors()\`. ` +
                `This will attach server-side stack traces and exception metadata to the same transaction trace.`,
            impactOnConclusion:
                `The exact internal cause of the HTTP ${requestStatus} response is classified as Unknown. ` +
                `The downstream \`${anchorError.title}\` is explained as a consequence, but the root failure cannot be identified.`,
        });
    }

    // 2. Source Code Resolution (only when resolution was attempted and failed)
    if (sourceContext && sourceContext.resolutionStatus !== "exact_file") {
        const statusMessage: Record<string, string> = {
            repository_not_configured: "No GitHub repository is connected to this project.",
            commit_unavailable: "The release/commit SHA for this event could not be determined.",
            file_not_found: `The source file \`${sourceContext.filePath}\` was not found in the connected repository.`,
            source_access_denied: "GitHub access was denied — verify token permissions or grant access to private repositories.",
            rate_limit: "GitHub API rate limit was exceeded when attempting to fetch source.",
            source_revision_unavailable: `The source file \`${sourceContext.filePath}\` could not be retrieved at the event's commit.`,
            github_api_error: "A GitHub API error occurred during source resolution.",
            source_map_unavailable: "A source map is required to resolve the original source but was not found.",
        };
        const friendlyStatus = statusMessage[sourceContext.resolutionStatus] ??
            `Source code resolution status: ${sourceContext.resolutionStatus}.`;

        gaps.push({
            missingSignal: "Source Code Context",
            whyItMatters:
                `${friendlyStatus} Without source code, Halo cannot highlight the exact failing line, ` +
                `extract the containing expression, or show code context around the error location.`,
            howToCollect: sourceContext.resolutionStatus === "repository_not_configured"
                ? "Connect a GitHub repository in Project Settings → Source Control. Halo uses the project's linked repository to fetch source at the event's commit SHA."
                : sourceContext.resolutionStatus === "commit_unavailable"
                ? "Pass `release` or `commitSha` in your Halo SDK initialization (e.g. `Halo.init({ release: 'v1.2.3+abc1234' })`) to enable commit-aware source resolution."
                : "Verify the GitHub repository configuration in Project Settings and ensure the token has read access to the repository and its history.",
            impactOnConclusion:
                "Investigation relies on the raw stack trace string without syntax-level context. " +
                "The failing expression and containing function are derived from stack frame text rather than verified AST analysis.",
        });
    }

    // 3. Distributed Tracing / Backend Span Hierarchy
    // Only add this gap if the anchor has no traceId AND no span tree was provided.
    if (!spanTree && !anchorError.traceId) {
        gaps.push({
            missingSignal: "Distributed Trace & Span Hierarchy",
            whyItMatters:
                "Trace spans were not recorded for this request, preventing inspection of " +
                "downstream service latency, database queries, and intermediate function timing along the causal path.",
            howToCollect:
                "Wrap critical request handlers with OpenTelemetry or Halo's distributed tracing middleware. " +
                "Pass the same trace context header from frontend to backend to link client errors to server spans.",
            impactOnConclusion:
                "Internal service propagation and database query timing cannot be directly visualized as a span tree.",
        });
    }

    // 4. Database Query Telemetry (only when error text EXPLICITLY references a database)
    const hasDbBreadcrumbs = breadcrumbs.some(b => b.category === "database");
    const isDbRelated = /prisma|postgres|sequelize|typeorm|deadlock|unique constraint|P2002|P2024|P2025|connection pool/i.test(
        `${anchorError.title || ""} ${anchorError.description || ""}`
    );
    if (isDbRelated && !hasDbBreadcrumbs) {
        gaps.push({
            missingSignal: "Database Query Logs",
            whyItMatters:
                "The error message references a database operation, but no query parameters or " +
                "execution details were captured in preceding breadcrumbs.",
            howToCollect:
                "Enable query logging in Prisma (`log: ['query', 'error']`) or add database instrumentation middleware.",
            impactOnConclusion:
                "The exact query parameters triggering the database-related failure remain unobserved.",
        });
    }

    // 5. HTTP Request Payload (only for write operations with no captured body)
    if (request && !request.bodyExcerpt && request.method &&
        ["POST", "PUT", "PATCH"].includes(request.method)) {
        gaps.push({
            missingSignal: "HTTP Request Payload",
            whyItMatters:
                `The failing ${request.method} request did not capture the request payload, ` +
                `making it impossible to see the exact input that triggered the error.`,
            howToCollect:
                "Enable `captureHttpPayload` in your Halo SDK configuration with appropriate privacy redactions.",
            impactOnConclusion:
                "Inputs to the failing API route are inferred from URL and breadcrumbs rather than verified payload data.",
        });
    }

    // 6. Session Continuity (only when this incident has no session ID)
    if (!anchorError.sessionId) {
        gaps.push({
            missingSignal: "User Session Continuity",
            whyItMatters:
                "No session ID was attached to this event, preventing reconstruction of preceding user " +
                "actions across multiple pages that may have led to this incident.",
            howToCollect:
                "Ensure the Halo SDK `sessionId` is initialized and attached to events during SDK setup.",
            impactOnConclusion:
                "Telemetry is scoped to this single isolated event without a preceding user journey.",
        });
    }

    return gaps;
}
