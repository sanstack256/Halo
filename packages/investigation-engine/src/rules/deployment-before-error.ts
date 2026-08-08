import type { Evidence } from "../types/evidence";
import type { RuleResult } from "../types/rule-result";

export function deploymentBeforeError(
    evidence: Evidence[]
): RuleResult[] {

    const deployments = evidence.filter(
        e => e.type === "DEPLOYMENT"
    );

    const errors = evidence.filter(
        e => e.type === "ERROR"
    );

    if (
        deployments.length === 0 ||
        errors.length === 0
    ) {
        return [];
    }

    const firstError = errors[0];

    const results: RuleResult[] = [];

    for (const deployment of deployments) {

        if (
            deployment.timestamp <
            firstError.timestamp
        ) {

            results.push({

                hypothesis:
                    "Deployment Regression",

                reason: {

                    title:
                        "Deployment before first error",

                    description:
                        "Deployment occurred before the first error.",

                    score: 40,

                    evidenceIds: [
                        deployment.id,
                        firstError.id,
                    ],

                },

            });

        }

    }

    return results;
}