import type { InvestigationContext } from "../types/context";
import type { Hypothesis, HypothesisMissingEvidence, HypothesisSupportingEvidence } from "../types/hypothesis";
import type { Reason } from "../types/reason";

export function generateNetworkProtocolHypotheses(
    context: InvestigationContext
): Hypothesis[] {
    const hypotheses: Hypothesis[] = [];
    const allEvidence = context.evidence || [];
    const deployments = context.deployments || [];

    for (const ev of allEvidence) {
        const hasRecentDeployment = deployments.some(
            (d) => d.service === ev.service && Math.abs(ev.timestamp.getTime() - d.timestamp.getTime()) <= 30 * 60 * 1000
        );
        if (hasRecentDeployment) {
            continue;
        }

        const text = [
            ev.title || "",
            ev.description || "",
            ev.operation || "",
            ev.resource || "",
            String(ev.status || ""),
            typeof ev.metadata?.error === "string" ? ev.metadata.error : "",
            typeof ev.metadata?.message === "string" ? ev.metadata.message : "",
        ].join(" ");

        const status = String(ev.status || "");
        const is5xx = status.startsWith("5") || /\b(500|502|503|504)\b/.test(text);
        const is4xx = status.startsWith("4") || /\b(400|401|403|404|429)\b/.test(text);
        const isNetworkTimeout = /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|Gateway Timeout|network timeout|AbortError/i.test(text);

        if (is5xx || isNetworkTimeout) {
            const endpoint = ev.resource || ev.operation || "HTTP endpoint";
            const statusCode = status || (/50[0-4]/.exec(text)?.[0] ?? "5xx");

            const supportingReasons: Reason[] = [
                {
                    type: "SUPPORTING",
                    causalRole: "CAUSE",
                    title: `HTTP ${statusCode} Response`,
                    description: `The request returned non-2xx status code (${statusCode}) during transaction execution.`,
                    strength: 0.9,
                    evidenceIds: [ev.id],
                },
            ];

            const detailedSupporting: HypothesisSupportingEvidence[] = [
                {
                    evidenceId: ev.id,
                    reason: `Network request to ${endpoint} returned HTTP ${statusCode}`,
                    role: "Upstream HTTP protocol failure",
                    strength: 0.9,
                },
            ];

            const missingReasons: Reason[] = [];
            const detailedMissing: HypothesisMissingEvidence[] = [];

            if (!ev.traceId) {
                missingReasons.push({
                    type: "MISSING",
                    causalRole: "CONTEXT",
                    title: "Upstream trace headers missing from request",
                    description: "Request does not include a distributed trace ID to correlate with backend downstream spans.",
                    evidenceIds: [ev.id],
                    strength: 0.3,
                });
                detailedMissing.push({
                    what: "Distributed trace headers (W3C traceparent)",
                    why: "Needed to track the request into backend microservices",
                    impact: "Cannot trace root cause across service boundary",
                });
            }

            const hasInternalServerLogs = allEvidence.some(
                e => e.service === ev.service && e.id !== ev.id && (e.type === "ERROR" || e.type === "LOG")
            );
            if (!hasInternalServerLogs) {
                missingReasons.push({
                    type: "MISSING",
                    causalRole: "CONTEXT",
                    title: `Internal server-side execution logs for HTTP ${statusCode} are unobserved`,
                    description: `Telemetry recorded the HTTP ${statusCode} response from ${endpoint}, but internal execution logs, database queries, or server-side traces explaining why ${endpoint} returned ${statusCode} are unobserved.`,
                    evidenceIds: [ev.id],
                    strength: 0.35,
                });
                detailedMissing.push({
                    what: "Server-side execution logs or query telemetry",
                    why: `Required to identify why ${endpoint} returned HTTP ${statusCode} (e.g. database timeout, lock contention, or crash)`,
                    impact: `Exact internal root cause for the HTTP ${statusCode} on ${endpoint} remains Unknown`,
                });
            }

            const positiveScore = supportingReasons.reduce((acc, r) => acc + r.strength, 0);
            const unknownScore = missingReasons.reduce((acc, r) => acc + r.strength, 0);

            hypotheses.push({
                id: `network-protocol:5xx:${ev.id}`,
                title: statusCode === "504" || text.includes("504")
                    ? `HTTP 504 Gateway Timeout on ${endpoint}`
                    : isNetworkTimeout
                    ? `Network Connection Timeout on ${endpoint}`
                    : `Upstream HTTP ${statusCode} Server Failure on ${endpoint}`,
                description: `Network request to ${endpoint} failed with ${statusCode === "504" ? "HTTP 504 Gateway Timeout" : isNetworkTimeout ? "connection timeout/refusal" : `HTTP ${statusCode}`}.`,
                score: {
                    positive: positiveScore,
                    negative: 0,
                    unknown: unknownScore,
                },
                confidence: 0,
                status: "CANDIDATE",
                supportingReasons,
                contradictingReasons: [],
                missingReasons,
                detailedSupportingEvidence: detailedSupporting,
                detailedMissingEvidence: detailedMissing,
                findingIds: [],
                evidenceIds: [ev.id],
                alternativeIds: [],
                provenance: ev.source,
                causalExplanation: `Network communication to ${endpoint} failed with ${statusCode}. Telemetry establishes connection failure or server 5xx response.`,
            });
        } else if (is4xx && /401|403|Unauthorized|Forbidden|JWT|token|CSRF/i.test(text)) {
            const supportingReasons: Reason[] = [
                {
                    type: "SUPPORTING",
                    causalRole: "CAUSE",
                    title: "401/403 Security Response",
                    description: "The authentication filter rejected the request.",
                    strength: 0.85,
                    evidenceIds: [ev.id],
                },
            ];

            hypotheses.push({
                id: `network-protocol:auth:${ev.id}`,
                title: "Authentication or Authorization Rejection",
                description: "Request rejected due to missing, expired, or invalid authorization credentials.",
                score: {
                    positive: 0.85,
                    negative: 0,
                    unknown: 0,
                },
                confidence: 0,
                status: "CANDIDATE",
                supportingReasons,
                contradictingReasons: [],
                missingReasons: [],
                findingIds: [],
                evidenceIds: [ev.id],
                alternativeIds: [],
                provenance: ev.source,
                causalExplanation: `HTTP request rejected with 401/403 status code due to invalid or expired credentials.`,
            });
        } else if (is4xx && /429|rate limit|quota exceeded/i.test(text)) {
            const supportingReasons: Reason[] = [
                {
                    type: "SUPPORTING",
                    causalRole: "CAUSE",
                    title: "Rate limit threshold breached",
                    description: "The remote service returned HTTP 429 Too Many Requests.",
                    strength: 0.85,
                    evidenceIds: [ev.id],
                },
            ];

            hypotheses.push({
                id: `network-protocol:rate-limit:${ev.id}`,
                title: "API Rate Limit or Quota Exhaustion (HTTP 429)",
                description: "API call was throttled by upstream gateway or service rate limiting policies.",
                score: {
                    positive: 0.85,
                    negative: 0,
                    unknown: 0,
                },
                confidence: 0,
                status: "CANDIDATE",
                supportingReasons,
                contradictingReasons: [],
                missingReasons: [],
                findingIds: [],
                evidenceIds: [ev.id],
                alternativeIds: [],
                provenance: ev.source,
                causalExplanation: `HTTP 429 response observed. Telemetry establishes upstream request rate limiting.`,
            });
        }
    }

    return hypotheses;
}
