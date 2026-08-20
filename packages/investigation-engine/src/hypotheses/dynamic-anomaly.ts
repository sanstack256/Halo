import type { InvestigationContext } from "../types/context";
import type { Hypothesis } from "../types/hypothesis";
import type { Reason } from "../types/reason";

export function generateDynamicAnomalyHypotheses(
    context: InvestigationContext
): Hypothesis[] {
    const hypotheses: Hypothesis[] = [];
    const anomalies = context.anomalies || [];

    // Filter for open-world anomalies (rate bursts, cascading failures, novel patterns)
    const openWorldAnomalies = anomalies.filter((a) =>
        ["RATE_BURST", "CASCADING_FAILURE", "NOVEL_PATTERN", "SILENT_DEGRADATION", "LATENCY_SPIKE"].includes(a.type)
    );

    // Get services already covered by deployments or shared dependencies
    const coveredServices = new Set<string>();
    for (const d of context.deployments) {
        if (d.service) coveredServices.add(d.service);
    }
    for (const tp of context.thirdParty) {
        if (tp.service) coveredServices.add(tp.service);
    }
    for (const infra of context.infrastructure) {
        if (infra.service) coveredServices.add(infra.service);
    }

    for (const anomaly of openWorldAnomalies) {
        if (anomaly.evidenceIds.length < 2) continue;

        // If this service already has a specific deployment/infrastructure/thirdParty change,
        // do not generate competing generic Novel Failure Pattern hypotheses for the same service
        if (anomaly.type === "NOVEL_PATTERN" && coveredServices.has(anomaly.service)) {
            continue;
        }

        const supportingReasons: Reason[] = [
            {
                type: "SUPPORTING",
                causalRole: "CAUSE",
                title: anomaly.title,
                description: anomaly.description,
                strength: Math.min(0.65, anomaly.score),
                evidenceIds: anomaly.evidenceIds,
            },
        ];

        hypotheses.push({
            id: `dynamic-anomaly:${anomaly.id}`,
            title: anomaly.title,
            description: anomaly.description,
            score: {
                positive: anomaly.score * 1.5,
                negative: 0,
                unknown: 0,
            },
            confidence: Math.min(65, Math.round(anomaly.score * 75)),
            status: "CANDIDATE",
            supportingReasons,
            contradictingReasons: [],
            missingReasons: [],
            findingIds: [],
            evidenceIds: anomaly.evidenceIds,
            alternativeIds: [],
        });
    }

    return hypotheses;
}
