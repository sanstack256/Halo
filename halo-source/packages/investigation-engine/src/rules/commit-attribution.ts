import type { InvestigationContext } from "../types/context";
import type { Finding } from "../types/finding";

export function commitAttribution(
    context: InvestigationContext
): Finding[] {
    const findings: Finding[] = [];

    const deployments =
        context.deployments;

    const commits =
        context.evidence.filter(
            evidence =>
                evidence.type ===
                "COMMIT"
        );

    if (
        deployments.length === 0 ||
        commits.length === 0
    ) {
        return [];
    }

    for (const deployment of deployments) {
        if (!deployment.commit) {
            continue;
        }

        const matchingCommit =
            commits.find(
                commit =>
                    commit.commit ===
                        deployment.commit &&
                    commit.service ===
                        deployment.service
            );

        if (!matchingCommit) {
            continue;
        }

        findings.push({
            id:
                `commit-attribution:${deployment.id}:${matchingCommit.id}`,

            type: "CHANGE_IMPACT",

            causalRole: "TRIGGER",

            title:
                "Deployment is attributed to a source commit",

            description:
                `Deployment "${deployment.title}" is associated with commit "${matchingCommit.commit}", providing source-control attribution for the production change.`,

            strength: 0.8,

            evidenceIds: [
                deployment.id,
                matchingCommit.id,
            ],

            reasons: [
                {
                    type: "SUPPORTING",

                    causalRole: "TRIGGER",

                    title:
                        "Deployment is linked to a source commit",

                    description:
                        `The deployment and commit reference the same commit "${matchingCommit.commit}" for the same service.`,

                    evidenceIds: [
                        deployment.id,
                        matchingCommit.id,
                    ],

                    strength: 0.8,
                },
            ],
        });
    }

    return findings;
}