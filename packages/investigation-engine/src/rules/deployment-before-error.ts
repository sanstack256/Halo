import type { InvestigationContext } from "../types/context";
import type { Finding } from "../types/finding";

export function deploymentBeforeError(
    context: InvestigationContext
): Finding[] {
    const { deployments, errors } = context;

    if (deployments.length === 0 || errors.length === 0) {
        return [];
    }

    const findings: Finding[] = [];

    for (const deployment of deployments) {
        const firstError = errors.find(
            error =>
                error.timestamp.getTime() >
                deployment.timestamp.getTime()
        );

        if (!firstError) {
            continue;
        }

        findings.push({
            id: `temporal:${deployment.id}:${firstError.id}`,
            type: "TEMPORAL",
            causalRole: "TRIGGER",
            title: "Deployment preceded error onset",
            description:
                `Deployment "${deployment.title}" occurred before the first observed error associated with this investigation.`,
            strength: 0.5,
            evidenceIds: [
                deployment.id,
                firstError.id,
            ],
            reasons: [
                {
                    type: "SUPPORTING",
                    causalRole: "TRIGGER",
                    title: "Deployment occurred before the error",
                    description:
                        "The deployment is temporally ordered before the first observed error.",
                    evidenceIds: [
                        deployment.id,
                        firstError.id,
                    ],
                    strength: 0.5,
                },
            ],
        });
    }

    return findings;
}