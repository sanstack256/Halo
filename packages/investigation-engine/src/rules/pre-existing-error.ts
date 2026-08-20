import type { InvestigationContext } from "../types/context";
import type { Finding } from "../types/finding";

export function preExistingError(
    context: InvestigationContext
): Finding[] {
    const {
        deployments,
        errors,
        evidence,
    } = context;

    if (deployments.length === 0) {
        return [];
    }

    const findings: Finding[] = [];

    for (const deployment of deployments) {
        const previousIssues = evidence.filter(
            (item) =>
                item.service === deployment.service &&
                item.id !== deployment.id &&
                item.timestamp.getTime() < deployment.timestamp.getTime() &&
                (item.type === "ERROR" ||
                    item.type === "CONFIG" ||
                    item.type === "INFRASTRUCTURE" ||
                    (typeof item.status === "number" && item.status >= 400))
        );

        if (previousIssues.length === 0) {
            continue;
        }

        const evidenceIds = [
            deployment.id,
            ...previousIssues.map((e) => e.id),
        ];

        findings.push({
            id: `pre-existing-error:${deployment.id}`,
            type: "ANOMALY",
            causalRole: "CONTRADICTION",
            title: "Failure existed before deployment",
            description: `${previousIssues.length} issue(s) were already observed in ${deployment.service} before the deployment occurred.`,
            strength: 0.85,
            evidenceIds,
            reasons: [
                {
                    type: "CONTRADICTING",
                    causalRole: "CONTRADICTION",
                    title: "Error predates deployment",
                    description:
                        "The same service was already experiencing errors or anomalies before the deployment, weakening the explanation that this deployment introduced the failure.",
                    evidenceIds,
                    strength: 0.85,
                },
            ],
        });
    }

    return findings;
}