import type { InvestigationContext } from "../types/context";
import type { Hypothesis } from "../types/hypothesis";
import type { Reason } from "../types/reason";
import type { AnomalySignal } from "../types/anomaly";

export function generateResourceSaturationHypotheses(
    context: InvestigationContext
): Hypothesis[] {
    const hypotheses: Hypothesis[] = [];
    const anomalies = context.anomalies || [];

    const resourceAnomalies = anomalies.filter(
        (a) => a.type === "RESOURCE_SATURATION"
    );

    for (const anomaly of resourceAnomalies) {
        const supportingReasons: Reason[] = [
            {
                type: "SUPPORTING",
                causalRole: "CAUSE",
                title: anomaly.title,
                description: anomaly.description,
                strength: Math.max(0.85, anomaly.score),
                evidenceIds: anomaly.evidenceIds,
            },
        ];

        const evidenceIds = Array.from(new Set(anomaly.evidenceIds));

        hypotheses.push({
            id: `resource-saturation:${anomaly.id}`,
            title: anomaly.title,
            description: anomaly.description,
            score: {
                positive: anomaly.score * 2.5,
                negative: 0,
                unknown: 0,
            },
            confidence: Math.round(anomaly.score * 100),
            status: "CANDIDATE",
            supportingReasons,
            contradictingReasons: [],
            missingReasons: [],
            findingIds: [],
            evidenceIds,
            alternativeIds: [],
        });
    }

    return hypotheses;
}
