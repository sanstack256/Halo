import type { Evidence } from "../types/evidence";
import type { RuleResult } from "../types/rule-result";

export function differentService(
    evidence: Evidence[]
): RuleResult[] {

    const deployment = evidence.find(
        e => e.type === "DEPLOYMENT"
    );

    if (!deployment) {
        return [];
    }

    const errors = evidence.filter(
        e => e.type === "ERROR"
    );

    if (errors.length === 0) {
        return [];
    }

    const different = errors.filter(
        e => e.service !== deployment.service
    );

    if (different.length === 0) {
        return [];
    }

    return [
        {
            hypothesis: "Deployment Regression",

            reason: {
                title: "Errors occurred in another service",

                description:
                    `${different.length} error(s) occurred outside ${deployment.service}.`,

                score: -30,

                evidenceIds: [
                    deployment.id,
                    ...different.map(e => e.id),
                ],
            },
        },
    ];
}