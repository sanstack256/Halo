import type { InvestigationContext } from "../types/context";
import type { Hypothesis } from "../types/hypothesis";
import type { Reason } from "../types/reason";

export function generateNetworkProtocolHypotheses(
    context: InvestigationContext
): Hypothesis[] {
    const hypotheses: Hypothesis[] = [];
    const allEvidence = context.evidence || [];
    const deployments = context.deployments || [];

    for (const ev of allEvidence) {
        // If a recent deployment on the same service exists, skip generating standalone network hypothesis
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

            hypotheses.push({
                id: `network-protocol:5xx:${ev.id}`,
                title: isNetworkTimeout
                    ? `Network Connection Timeout on ${endpoint}`
                    : `Upstream HTTP ${statusCode} Server Failure on ${endpoint}`,
                description: `Network request to ${endpoint} failed with ${isNetworkTimeout ? "connection timeout/refusal" : `HTTP ${statusCode}`}.`,
                score: {
                    positive: 2.7,
                    negative: 0,
                    unknown: 0,
                },
                confidence: 92,
                status: "CANDIDATE",
                supportingReasons: [
                    {
                        type: "SUPPORTING",
                        causalRole: "CAUSE",
                        title: `HTTP ${statusCode} Response`,
                        description: `The request returned non-2xx status code (${statusCode}) during transaction execution.`,
                        strength: 0.92,
                        evidenceIds: [ev.id],
                    },
                ],
                contradictingReasons: [],
                missingReasons: [],
                findingIds: [],
                evidenceIds: [ev.id],
                alternativeIds: [],
            });
        } else if (is4xx && /401|403|Unauthorized|Forbidden|JWT|token|CSRF/i.test(text)) {
            hypotheses.push({
                id: `network-protocol:auth:${ev.id}`,
                title: "Authentication or Authorization Rejection",
                description: "Request rejected due to missing, expired, or invalid authorization credentials.",
                score: {
                    positive: 2.6,
                    negative: 0,
                    unknown: 0,
                },
                confidence: 90,
                status: "CANDIDATE",
                supportingReasons: [
                    {
                        type: "SUPPORTING",
                        causalRole: "CAUSE",
                        title: "401/403 Security Response",
                        description: "The authentication filter rejected the request.",
                        strength: 0.9,
                        evidenceIds: [ev.id],
                    },
                ],
                contradictingReasons: [],
                missingReasons: [],
                findingIds: [],
                evidenceIds: [ev.id],
                alternativeIds: [],
            });
        } else if (is4xx && /429|rate limit|quota exceeded/i.test(text)) {
            hypotheses.push({
                id: `network-protocol:rate-limit:${ev.id}`,
                title: "API Rate Limit or Quota Exhaustion (HTTP 429)",
                description: "Request rejected because client or service exceeded inbound API rate limits.",
                score: {
                    positive: 2.6,
                    negative: 0,
                    unknown: 0,
                },
                confidence: 90,
                status: "CANDIDATE",
                supportingReasons: [
                    {
                        type: "SUPPORTING",
                        causalRole: "CAUSE",
                        title: "HTTP 429 Rate Limit",
                        description: "Observed rate limit threshold breach.",
                        strength: 0.9,
                        evidenceIds: [ev.id],
                    },
                ],
                contradictingReasons: [],
                missingReasons: [],
                findingIds: [],
                evidenceIds: [ev.id],
                alternativeIds: [],
            });
        }
    }

    return hypotheses;
}
