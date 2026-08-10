import type { InvestigationContext } from "../types/context";
import type { Finding } from "../types/finding";

const MAX_WINDOW_MS = 5 * 60 * 1000;

export function timeWindow(
    context: InvestigationContext
): Finding[] {
    const { deployments, errors } = context;

    if (deployments.length === 0 || errors.length === 0) {
        return [];
    }

    const findings: Finding[] = [];

    for (const deployment of deployments) {
        const nearbyErrors = errors
            .map(error => ({
                error,
                diff:
                    error.timestamp.getTime() -
                    deployment.timestamp.getTime(),
            }))
            .filter(
                ({ diff }) =>
                    diff >= 0 &&
                    diff <= MAX_WINDOW_MS
            );

        if (nearbyErrors.length === 0) {
            continue;
        }

        const closestError = nearbyErrors.reduce(
            (closest, current) =>
                current.diff < closest.diff
                    ? current
                    : closest
        );

        const strength =
            1 -
            closestError.diff / MAX_WINDOW_MS;

        const evidenceIds = [
            deployment.id,
            ...nearbyErrors.map(
                ({ error }) => error.id
            ),
        ];

        findings.push({
            id: `temporal-proximity:${deployment.id}`,
            type: "TEMPORAL",
            causalRole: "TRIGGER",
            title: "Errors followed deployment closely",
            description:
                `${nearbyErrors.length} error(s) occurred within five minutes of the deployment.`,
            strength,
            evidenceIds,
            reasons: [
                {
                    type: "SUPPORTING",
                    causalRole: "TRIGGER",
                    title: "Strong temporal proximity",
                    description:
                        "The failure occurred shortly after the deployment, increasing its relevance as a possible contributing change.",
                    evidenceIds,
                    strength,
                },
            ],
        });
    }

    return findings;
}