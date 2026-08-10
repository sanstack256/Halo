import type { Hypothesis } from "../types/hypothesis";
import type { InvestigationContext } from "../types/context";
import type { Recommendation } from "../types/recommendation";

export function generateRecommendations(
    hypotheses: Hypothesis[],
    context: InvestigationContext
): Recommendation[] {
    const recommendations: Recommendation[] = [];

    const leading =
        hypotheses.find(
            hypothesis =>
                hypothesis.status === "VALIDATED"
        ) ??
        hypotheses.find(
            hypothesis =>
                hypothesis.status === "LEADING" ||
                hypothesis.status === "UNCERTAIN"
        ) ??
        hypotheses[0];

    if (!leading) {
        return recommendations;
    }

    for (const reason of leading.missingReasons) {
        recommendations.push({
            id: `investigate:${recommendations.length}`,
            title: reason.title,
            description: reason.description,
            priority: "HIGH",
            confidence: reason.strength,
            evidenceIds: leading.evidenceIds,
        });
    }

    const strongestAlternative =
        hypotheses
            .filter(
                hypothesis =>
                    hypothesis.id !== leading.id
            )
            .sort(
                (a, b) =>
                    b.confidence -
                    a.confidence
            )[0];

    if (
        strongestAlternative &&
        Math.abs(
            leading.confidence -
            strongestAlternative.confidence
        ) < 15
    ) {
        recommendations.push({
            id: "investigate:alternative",

            title:
                `Distinguish ${leading.title} from ${strongestAlternative.title}`,

            description:
                `The leading hypotheses are close in confidence. Find evidence that can distinguish ${leading.title} from ${strongestAlternative.title}.`,

            priority: "HIGH",

            confidence:
                1 -
                Math.abs(
                    leading.confidence -
                    strongestAlternative.confidence
                ) / 100,

            evidenceIds: [
                ...new Set([
                    ...leading.evidenceIds,
                    ...strongestAlternative.evidenceIds,
                ]),
            ],

            question:
                `What evidence would distinguish ${leading.title} from ${strongestAlternative.title}?`,
        });
    }

    if (
        leading.title ===
        "Deployment Regression"
    ) {
        recommendations.push({
            id: "investigate:deployment",
            title:
                "Investigate the deployment",
            description:
                "Review the changes introduced by the suspected deployment and determine how they contributed to the observed failure.",
            priority: "HIGH",
            confidence:
                leading.confidence / 100,
            evidenceIds:
                leading.evidenceIds,
        });

        const hasRecoveryEvidence =
            context.evidence.some(
                evidence =>
                    evidence.type ===
                    "DEPLOYMENT" &&
                    (
                        evidence.title
                            .toLowerCase()
                            .includes("rollback") ||
                        evidence.title
                            .toLowerCase()
                            .includes("revert")
                    )
            );

        if (!hasRecoveryEvidence) {
            recommendations.push({
                id: "investigate:rollback",
                title:
                    "Verify recovery after rollback",
                description:
                    "Determine whether reverting the suspected deployment caused the incident to recover.",
                priority: "HIGH",
                confidence: 0.85,
                evidenceIds:
                    leading.evidenceIds,

                question:
                    "Did the service recover after the suspected deployment was rolled back?",
            });
        }
    }

    if (
        leading.title ===
        "Shared Dependency Failure"
    ) {
        const affectedServices = [
            ...new Set(
                context.errors
                    .filter(
                        error =>
                            leading.evidenceIds.includes(
                                error.id
                            )
                    )
                    .map(
                        error =>
                            error.service
                    )
            ),
        ];

        if (affectedServices.length > 1) {
            recommendations.push({
                id: "investigate:dependency",

                title:
                    "Trace the shared dependency",

                description:
                    `Identify the dependency shared by ${affectedServices.length} affected services and inspect its health during the incident window.`,

                priority: "HIGH",

                confidence: 0.85,

                evidenceIds:
                    leading.evidenceIds,

                question:
                    `Which shared dependency was failing when the affected services began failing?`,
            });
        }
    }

    return deduplicateRecommendations(
        recommendations
    );
}

function deduplicateRecommendations(
    recommendations: Recommendation[]
): Recommendation[] {
    const seen = new Set<string>();

    return recommendations.filter(
        recommendation => {
            const key =
                recommendation.title;

            if (seen.has(key)) {
                return false;
            }

            seen.add(key);

            return true;
        }
    );
}