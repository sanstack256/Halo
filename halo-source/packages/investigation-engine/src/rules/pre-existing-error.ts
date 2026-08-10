import type { InvestigationContext } from "../types/context";
import type { Finding } from "../types/finding";

export function preExistingError(
    context: InvestigationContext
): Finding[] {
    const {
        deployments,
        errors,
    } = context;

    if (
        deployments.length === 0 ||
        errors.length === 0
    ) {
        return [];
    }

    const findings: Finding[] = [];

    for (const deployment of deployments) {
        const previousErrors = errors.filter(
            error =>
                error.timestamp.getTime() <
                deployment.timestamp.getTime()
        );

        if (previousErrors.length === 0) {
            continue;
        }

        const sameServiceErrors =
            previousErrors.filter(
                error =>
                    error.service ===
                    deployment.service
            );

        if (
            sameServiceErrors.length === 0
        ) {
            continue;
        }

        const evidenceIds = [
            deployment.id,
            ...sameServiceErrors.map(
                error => error.id
            ),
        ];

        findings.push({
            id:
                `pre-existing-error:${deployment.id}`,

            type: "ANOMALY",

            causalRole: "CONTRADICTION",

            title:
                "Failure existed before deployment",

            description:
                `${sameServiceErrors.length} error(s) were already observed in ${deployment.service} before the deployment occurred.`,

            strength: 0.85,

            evidenceIds,

            reasons: [
                {
                    type: "CONTRADICTING",

                    causalRole:
                        "CONTRADICTION",

                    title:
                        "Error predates deployment",

                    description:
                        "The same service was already experiencing errors before the deployment, weakening the explanation that this deployment introduced the failure.",

                    evidenceIds,

                    strength: 0.85,
                },
            ],
        });
    }

    return findings;
}