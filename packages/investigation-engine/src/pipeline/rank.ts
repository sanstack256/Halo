import type { Hypothesis } from "../types/hypothesis";

export function rankHypotheses(
    hypotheses: Hypothesis[]
): Hypothesis[] {
    return [...hypotheses]
        .map(hypothesis => ({
            ...hypothesis,
            confidence:
                calculateConfidence(
                    hypothesis
                ),
        }))
        .sort((a, b) => {
            const causalPriorityDifference =
                causalPriority(b) -
                causalPriority(a);

            if (
                causalPriorityDifference !== 0
            ) {
                return causalPriorityDifference;
            }

            return (
                b.confidence -
                a.confidence
            );
        })
        .map(
            (
                hypothesis,
                index,
                ranked
            ) => ({
                ...hypothesis,

                status:
                    index === 0 &&
                    hypothesis.confidence >=
                        70
                        ? "LEADING"
                        : hypothesis.status,

                alternativeIds:
                    ranked
                        .filter(
                            alternative =>
                                alternative.id !==
                                hypothesis.id
                        )
                        .map(
                            alternative =>
                                alternative.id
                        ),
            })
        );
}

function causalPriority(
    hypothesis: Hypothesis
): number {
    switch (hypothesis.title) {
        case "Shared Dependency Failure":
            return 3;

        case "Infrastructure Failure":
            return 3;

        case "Deployment Regression":
            return 2;

        case "Cross-Service Failure":
            return 1;

        default:
            return 0;
    }
}

function calculateConfidence(
    hypothesis: Hypothesis
): number {
    const positive =
        hypothesis.score.positive;

    const negative =
        hypothesis.score.negative;

    const unknown =
        hypothesis.score.unknown;

    const total =
        positive +
        negative +
        unknown;

    if (total === 0) {
        return 0;
    }

    const evidenceRatio =
        positive / total;

    const contradictionPenalty =
        negative /
        Math.max(
            positive + negative,
            1
        );

    const uncertaintyPenalty =
        unknown /
        Math.max(total, 1);

    const confidence =
        evidenceRatio *
        (1 -
            contradictionPenalty *
                0.5) *
        (1 -
            uncertaintyPenalty *
                0.35);

    return Math.round(
        Math.max(
            0,
            Math.min(
                1,
                confidence
            )
        ) * 100
    );
}