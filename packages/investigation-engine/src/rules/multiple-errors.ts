import type { InvestigationContext } from "../types/context";
import type { Finding } from "../types/finding";

const ERROR_WINDOW_MS = 5 * 60 * 1000;

export function multipleErrors(
    context: InvestigationContext
): Finding[] {
    const { deployments, errors } = context;

    if (deployments.length === 0 || errors.length < 2) {
        return [];
    }

    const findings: Finding[] = [];

    for (const deployment of deployments) {
        const errorsAfterDeployment = errors.filter(error => {
            const diff =
                error.timestamp.getTime() -
                deployment.timestamp.getTime();

            return diff >= 0 && diff <= ERROR_WINDOW_MS;
        });

        if (errorsAfterDeployment.length < 2) {
            continue;
        }

        const evidenceIds = [
            deployment.id,
            ...errorsAfterDeployment.map(error => error.id),
        ];

        findings.push({
            id: `error-cluster:${deployment.id}`,
            type: "PATTERN",
            causalRole: "CONTRIBUTOR",
            title: "Multiple errors followed deployment",
            description:
                `${errorsAfterDeployment.length} errors occurred within five minutes of the deployment.`,
            strength: 0.65,
            evidenceIds,
            reasons: [
                {
                    type: "SUPPORTING",
                    causalRole: "CONTRIBUTOR",
                    title: "Error cluster followed the deployment",
                    description:
                        "Multiple errors appeared within a short period after the deployment, indicating a possible change-related failure pattern.",
                    evidenceIds,
                    strength: 0.65,
                },
            ],
        });
    }

    return findings;
}