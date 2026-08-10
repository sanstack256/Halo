import type { InvestigationContext } from "../types/context";
import type { Finding } from "../types/finding";

export function differentService(
    context: InvestigationContext
): Finding[] {
    const { deployments, errors } = context;

    if (deployments.length === 0 || errors.length === 0) {
        return [];
    }

    const findings: Finding[] = [];

    for (const deployment of deployments) {
        const differentServiceErrors = errors.filter(
            error => error.service !== deployment.service
        );

        if (differentServiceErrors.length === 0) {
            continue;
        }

        const evidenceIds = [
            deployment.id,
            ...differentServiceErrors.map(error => error.id),
        ];

        findings.push({
            id: `cross-service:${deployment.id}`,
            type: "SCOPE",
            causalRole: "CONTRADICTION",
            title: "Failure extends beyond deployed service",
            description:
                `${differentServiceErrors.length} error(s) were observed in services other than ${deployment.service}.`,
            strength: 0.65,
            evidenceIds,
            reasons: [
                {
                    type: "CONTRADICTING",
                    causalRole: "CONTRADICTION",
                    title: "Cross-service impact weakens an isolated deployment explanation",
                    description:
                        "Errors outside the deployed service suggest that the incident may involve a shared dependency, infrastructure component, or broader failure mechanism.",
                    evidenceIds,
                    strength: 0.65,
                },
            ],
        });
    }

    return findings;
}