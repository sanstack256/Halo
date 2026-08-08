import type { Evidence } from "../types/evidence";
import type { RuleResult } from "../types/rule-result";

const TIME_WINDOW_MS = 60 * 1000; // 60 seconds

export function timeWindow(
    evidence: Evidence[]
): RuleResult[] {

    const deployment = evidence.find(
        e => e.type === "DEPLOYMENT"
    );

    if (!deployment) {
        return [];
    }

    const nearbyErrors = evidence.filter(e => {

        if (e.type !== "ERROR") {
            return false;
        }

        const diff =
            e.timestamp.getTime() -
            deployment.timestamp.getTime();

        return (
            diff >= 0 &&
            diff <= TIME_WINDOW_MS
        );

    });

    if (nearbyErrors.length === 0) {
        return [];
    }

    return [
        {
            hypothesis: "Deployment Regression",

            reason: {
                title: "Errors occurred immediately after deployment",

                description:
                    `${nearbyErrors.length} error(s) appeared within 60 seconds of the deployment.`,

                score: 25,

                evidenceIds: [
                    deployment.id,
                    ...nearbyErrors.map(
                        e => e.id
                    ),
                ],
            },
        },
    ];
}