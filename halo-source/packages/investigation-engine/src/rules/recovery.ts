import type { InvestigationContext } from "../types/context";
import type { Finding } from "../types/finding";
import type { Evidence } from "../types/evidence";

function isRollback(evidence: Evidence): boolean {
    const text = [
        evidence.title,
        evidence.description ?? "",
    ]
        .join(" ")
        .toLowerCase();

    return (
        evidence.type === "DEPLOYMENT" &&
        (
            text.includes("rollback") ||
            text.includes("revert")
        )
    );
}

function isRecovery(evidence: Evidence): boolean {
    const text = [
        evidence.title,
        evidence.description ?? "",
        evidence.status?.toString() ?? "",
    ]
        .join(" ")
        .toLowerCase();

    return (
        text.includes("recover") ||
        text.includes("recovery") ||
        text.includes("returned to normal") ||
        text.includes("back to normal") ||
        text.includes("resolved") ||
        text.includes("recovered")
    );
}

export function recovery(
    context: InvestigationContext
): Finding[] {
    const {
        deployments,
        errors,
        evidence,
    } = context;

    if (
        deployments.length === 0 ||
        errors.length === 0
    ) {
        return [];
    }

    const findings: Finding[] = [];

    for (const deployment of deployments) {
        if (isRollback(deployment)) {
            continue;
        }

        const errorsAfterDeployment =
            errors.filter(
                error =>
                    error.timestamp.getTime() >
                    deployment.timestamp.getTime()
            );

        if (
            errorsAfterDeployment.length === 0
        ) {
            continue;
        }

        const firstError =
            errorsAfterDeployment[0];

        const rollback =
            evidence
                .filter(isRollback)
                .find(
                    candidate =>
                        candidate.timestamp.getTime() >
                        firstError.timestamp.getTime() &&
                        candidate.timestamp.getTime() >
                        deployment.timestamp.getTime() &&
                        candidate.service ===
                        deployment.service
                );

        if (!rollback) {
            continue;
        }

        const recoveryEvidence =
            evidence
                .filter(isRecovery)
                .find(
                    candidate =>
                        candidate.timestamp.getTime() >
                        rollback.timestamp.getTime()
                );

        if (!recoveryEvidence) {
            continue;
        }

        const evidenceIds = [
            deployment.id,
            firstError.id,
            rollback.id,
            recoveryEvidence.id,
        ];

        findings.push({
            id:
                `recovery:${deployment.id}:${rollback.id}:${recoveryEvidence.id}`,

            type: "RECOVERY",

            causalRole: "CAUSE",

            title:
                "Failure appeared after deployment and recovered after rollback",

            description:
                "The failure began after the deployment, the deployment was subsequently rolled back, and recovery was observed afterward. This provides strong causal evidence linking the deployment to the failure.",

            strength: 0.95,

            evidenceIds,

            reasons: [
                {
                    type: "SUPPORTING",

                    causalRole: "MECHANISM",

                    title:
                        "Rollback was followed by recovery",

                    description:
                        "The failure appeared after the deployment and recovery followed its rollback, forming a strong change-reversal signal.",

                    evidenceIds,

                    strength: 0.95,
                },
            ],
        });
    }

    return findings;
}