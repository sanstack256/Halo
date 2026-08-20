import type { InvestigationContext } from "../types/context";
import type { Hypothesis } from "../types/hypothesis";
import type { Reason } from "../types/reason";

export function generateSecurityHypotheses(
    context: InvestigationContext
): Hypothesis[] {
    const hypotheses: Hypothesis[] = [];
    const anomalies = context.anomalies || [];

    const securityAnomalies = anomalies.filter(
        (a) => a.type === "SECURITY_ANOMALY"
    );

    for (const anomaly of securityAnomalies) {
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

        hypotheses.push({
            id: `security-incident:${anomaly.id}`,
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
            evidenceIds: anomaly.evidenceIds,
            alternativeIds: [],
        });
    }

    return hypotheses;
}
