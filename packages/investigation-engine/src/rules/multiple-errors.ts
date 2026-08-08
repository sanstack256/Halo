import type { Evidence } from "../types/evidence";
import type { RuleResult } from "../types/rule-result";

export function multipleErrors(
    evidence: Evidence[]
): RuleResult[] {

    const deployments = evidence.filter(
        e => e.type === "DEPLOYMENT"
    );

    if (deployments.length === 0) {
        return [];
    }

    const deployment = deployments[0];

    const errorsAfterDeployment = evidence.filter(
        e =>
            e.type === "ERROR" &&
            e.timestamp > deployment.timestamp
    );

    if (errorsAfterDeployment.length < 2) {
        return [];
    }

    return [
        {
            hypothesis: "Deployment Regression",

            reason: {
                title: "Multiple errors after deployment",

                description: `${errorsAfterDeployment.length} errors occurred after deployment.`,

                score: 20,

                evidenceIds: [
                    deployment.id,
                    ...errorsAfterDeployment.map(
                        e => e.id
                    ),
                ],
            },
        },
    ];
}