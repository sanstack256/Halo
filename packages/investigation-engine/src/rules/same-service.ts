import type { InvestigationContext } from "../types/context";
import type { Finding } from "../types/finding";

export function sameService(
    context: InvestigationContext
): Finding[] {
    const { deployments, errors } = context;

    if (deployments.length === 0 || errors.length === 0) {
        return [];
    }

    const findings: Finding[] = [];

    for (const deployment of deployments) {
        const matchingErrors = errors.filter(
            error => error.service === deployment.service
        );

        if (matchingErrors.length === 0) {
            continue;
        }

        const evidenceIds = [
            deployment.id,
            ...matchingErrors.map(error => error.id),
        ];

        findings.push({
            id: `service-scope:${deployment.id}`,
            type: "SCOPE",
            causalRole: "CONTRIBUTOR",
            title: "Deployment and errors affect the same service",
            description:
                `${matchingErrors.length} error(s) were observed in ${deployment.service}, the same service targeted by the deployment.`,
            strength: 0.55,
            evidenceIds,
            reasons: [
                {
                    type: "SUPPORTING",
                    causalRole: "CONTRIBUTOR",
                    title: "Same service is affected",
                    description:
                        "The deployment and observed errors belong to the same service, making the deployment more relevant to the failure.",
                    evidenceIds,
                    strength: 0.55,
                },
            ],
        });
    }

    return findings;
}