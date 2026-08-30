import type { InvestigationContext } from "../types/context";
import type { Hypothesis, HypothesisMissingEvidence, HypothesisSupportingEvidence } from "../types/hypothesis";
import type { Reason } from "../types/reason";

export function generateCascadingFailureHypotheses(
    context: InvestigationContext
): Hypothesis[] {
    const hypotheses: Hypothesis[] = [];
    const evidence = context.evidence || [];
    const deployments = context.deployments || [];
    const graph = context.graph;

    // Find failed HTTP or service requests
    const failedRequests = evidence.filter((e) => {
        const s = String(e.status || "");
        const text = `${e.title} ${e.description || ""} ${e.operation || ""}`;
        return s.startsWith("5") || s.startsWith("4") || /\b(500|502|503|504)\b/.test(text) || (typeof e.status === "number" && e.status >= 400);
    });

    const clientErrors = evidence.filter((e) => {
        if (e.type !== "ERROR") return false;
        const service = (e.service || "").toLowerCase();
        if (service === "browser" || service === "frontend-client" || service === "frontend" || service === "client") {
            return true;
        }
        return /(?:Error|Exception):/i.test(e.title || "");
    });

    for (const req of failedRequests) {
        const reqTime = req.timestamp.getTime();

        const hasRecentDeploymentOnReq = deployments.some(
            (d) => d.service === req.service && Math.abs(reqTime - d.timestamp.getTime()) <= 30 * 60 * 1000
        );
        if (hasRecentDeploymentOnReq) {
            continue;
        }

        for (const clientErr of clientErrors) {
            if (req.id === clientErr.id) continue;

            const errTime = clientErr.timestamp.getTime();
            const deltaMs = errTime - reqTime;

            const isSameSession = Boolean(req.metadata?.sessionId && clientErr.metadata?.sessionId && req.metadata.sessionId === clientErr.metadata.sessionId);
            const isSameTrace = Boolean(req.traceId && clientErr.traceId && req.traceId === clientErr.traceId);
            const isSameRequest = Boolean(req.requestId && clientErr.requestId && req.requestId === clientErr.requestId);

            const hasCausalEdge = graph?.edges?.some(
                (e) => ((e.from === req.id && e.to === clientErr.id) || (e.from === clientErr.id && e.to === req.id)) &&
                       e.relationship !== "TEMPORALLY_PRECEDES"
            );

            // Require concrete correlation evidence — timing alone is insufficient
            if (isSameSession || isSameTrace || isSameRequest || hasCausalEdge) {
                const endpoint = req.resource || req.operation || req.title || "API endpoint";
                const statusCode = String(req.status || "500");

                const supportingReasons: Reason[] = [
                    {
                        type: "SUPPORTING",
                        causalRole: "CAUSE",
                        title: `Upstream Request Failure (${endpoint} -> ${statusCode})`,
                        description: `The network call failed with HTTP ${statusCode} at T+0ms. The downstream client exception occurred at T+${Math.max(0, Math.round(deltaMs))}ms.`,
                        strength: isSameTrace ? 0.95 : isSameSession ? 0.88 : 0.75,
                        evidenceIds: [req.id, clientErr.id],
                    },
                ];

                const detailedSupporting: HypothesisSupportingEvidence[] = [
                    {
                        evidenceId: req.id,
                        reason: `HTTP call returned non-2xx status code (${statusCode})`,
                        role: "Earliest observed upstream failure",
                        strength: 0.9,
                    },
                    {
                        evidenceId: clientErr.id,
                        reason: `Client threw "${clientErr.title}" following the failed network response`,
                        role: "Downstream consequence",
                        strength: 0.85,
                    },
                ];

                const missingReasons: Reason[] = [];
                const detailedMissing: HypothesisMissingEvidence[] = [];

                // If backend telemetry explaining why the 500 occurred is absent, record it explicitly
                const hasBackendSpans = evidence.some(
                    (e) => e.service !== "browser" && e.service !== "frontend-client" && e.service !== "frontend" && (e.traceId === req.traceId || e.requestId === req.requestId)
                );

                if (!hasBackendSpans) {
                    missingReasons.push({
                        type: "MISSING",
                        causalRole: "CONTEXT",
                        title: "Server-side execution trace for 500 response is unavailable",
                        description: "Telemetry captured the HTTP failure status code from the client perspective but lacks backend server logs or traces explaining the internal 500 error.",
                        evidenceIds: [req.id],
                        strength: 0.4,
                    });
                    detailedMissing.push({
                        what: `Server-side telemetry for ${endpoint}`,
                        why: "Needed to diagnose the internal cause behind the HTTP 500 server error",
                        impact: "Exact backend root cause remains unknown, though upstream network failure is confirmed",
                    });
                }

                const positiveScore = supportingReasons.reduce((acc, r) => acc + r.strength, 0);
                const unknownScore = missingReasons.reduce((acc, r) => acc + r.strength, 0);

                hypotheses.push({
                    id: `cascading-failure:${req.id}:${clientErr.id}`,
                    title: `Upstream Network Failure (${endpoint}) Induced Downstream Client Exception`,
                    description: `\`${endpoint}\` returned HTTP ${statusCode}. The downstream client received this non-2xx response and subsequently threw: \`${clientErr.title}\`.`,
                    score: {
                        positive: positiveScore,
                        negative: 0,
                        unknown: unknownScore,
                    },
                    confidence: 0, // Computed deterministically by ranking stage
                    status: "CANDIDATE",
                    supportingReasons,
                    contradictingReasons: [],
                    missingReasons,
                    detailedSupportingEvidence: detailedSupporting,
                    detailedMissingEvidence: detailedMissing,
                    findingIds: [],
                    evidenceIds: [req.id, clientErr.id],
                    alternativeIds: [],
                    provenance: req.source,
                    causalExplanation: `Upstream request ${endpoint} returned HTTP ${statusCode}. Downstream error "${clientErr.title}" was recorded at T+${Math.max(0, Math.round(deltaMs))}ms as a consequence.`,
                });
            }
        }
    }

    return hypotheses;
}
