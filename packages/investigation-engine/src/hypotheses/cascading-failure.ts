import type { InvestigationContext } from "../types/context";
import type { Hypothesis } from "../types/hypothesis";
import type { Reason } from "../types/reason";

export function generateCascadingFailureHypotheses(
    context: InvestigationContext
): Hypothesis[] {
    const hypotheses: Hypothesis[] = [];
    const evidence = context.evidence || [];
    const deployments = context.deployments || [];

    // Find failed HTTP or service requests
    const failedRequests = evidence.filter((e) => {
        const s = String(e.status || "");
        const text = `${e.title} ${e.description || ""} ${e.operation || ""}`;
        return s.startsWith("5") || s.startsWith("4") || /\b(500|502|503|504)\b/.test(text);
    });

    // Find client-side exceptions.
    // Any ERROR event from a browser/frontend service is a potential downstream exception.
    // Do NOT restrict to TypeError — SyntaxError, ReferenceError, and other runtime
    // exceptions are equally valid downstream consequences of a failed HTTP request.
    const clientErrors = evidence.filter((e) => {
        if (e.type !== "ERROR") return false;
        const service = (e.service || "").toLowerCase();
        // Explicit browser/frontend service tag — always eligible
        if (service === "browser" || service === "frontend-client" || service === "frontend" || service === "client") {
            return true;
        }
        // Catch-all: any runtime error class in the title is eligible
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
            const errTime = clientErr.timestamp.getTime();
            const deltaMs = errTime - reqTime;

            // Cascading sequence: Request precedes Error within 15 seconds
            const isSameSession = req.sessionId && clientErr.sessionId && req.sessionId === clientErr.sessionId;
            const isSameTrace = req.traceId && clientErr.traceId && req.traceId === clientErr.traceId;
            const isTemporallyLinked = deltaMs >= 0 && deltaMs <= 15000;

            if ((isSameSession || isSameTrace || isTemporallyLinked) && req.id !== clientErr.id) {
                const endpoint = req.resource || req.operation || "API endpoint";
                const statusCode = req.status || "500";

                const supportingReasons: Reason[] = [
                    {
                        type: "SUPPORTING",
                        causalRole: "CAUSE",
                        title: `Upstream Request Failure (${endpoint} → ${statusCode})`,
                        description: `The network call failed with HTTP ${statusCode} at T+0ms. The client exception occurred at T+${deltaMs}ms as a downstream consequence.`,
                        strength: 0.96,
                        evidenceIds: [req.id, clientErr.id],
                    },
                ];

                hypotheses.push({
                    id: `cascading-failure:${req.id}:${clientErr.id}`,
                    title: `Upstream Network Failure (${endpoint}) Induced Downstream Client Exception`,
                    // Description derives from actual error event — never hardcode TypeError semantics.
                    description: `\`${endpoint}\` returned HTTP ${statusCode}. The downstream client received this non-2xx response and subsequently threw: \`${clientErr.title}\`.`,
                    score: {
                        positive: 3.0,
                        negative: 0,
                        unknown: 0,
                    },
                    confidence: 96,
                    status: "CANDIDATE",
                    supportingReasons,
                    contradictingReasons: [],
                    missingReasons: [],
                    findingIds: [],
                    evidenceIds: [req.id, clientErr.id],
                    alternativeIds: [],
                });
            }
        }
    }

    return hypotheses;
}
