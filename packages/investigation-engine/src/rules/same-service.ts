import type { Evidence } from "../types/evidence";
import type { RuleResult } from "../types/rule-result";

export function sameService(
    evidence: Evidence[]
): RuleResult[] {

    const deployment = evidence.find(
        e => e.type === "DEPLOYMENT"
    );

    if (!deployment) {
        return [];
    }

    const matchingErrors = evidence.filter(
        e =>
            e.type === "ERROR" &&
            e.service === deployment.service
    );

    if (matchingErrors.length === 0) {
        return [];
    }

    return [
        {
            hypothesis: "Deployment Regression",

            reason: {
                title: "Same service affected",

                description:
                    `${matchingErrors.length} error(s) occurred in ${deployment.service}.`,

                score: 15,

                evidenceIds: [
                    deployment.id,
                    ...matchingErrors.map(
                        e => e.id
                    ),
                ],
            },
        },
    ];
}