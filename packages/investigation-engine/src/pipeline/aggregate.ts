import type { RuleResult } from "../types/rule-result";
import type { Hypothesis } from "../types/hypothesis";

export function aggregateHypotheses(
    results: RuleResult[]
): Hypothesis[] {

    const grouped = new Map<
        string,
        Hypothesis
    >();

    for (const result of results) {

        let hypothesis =
            grouped.get(result.hypothesis);

        if (!hypothesis) {

            hypothesis = {

                id: result.hypothesis,

                title: result.hypothesis,

                description: "",

                score: {
                    positive: 0,
                    negative: 0,
                    unknown: 0,
                },

                confidence: 0,

                supportingReasons: [],

                contradictingReasons: [],

                missingReasons: [],

            };

            grouped.set(
                result.hypothesis,
                hypothesis
            );

        }

        hypothesis.supportingReasons.push(
            result.reason
        );

        if (result.reason.score >= 0) {

            hypothesis.score.positive +=
                result.reason.score;

        } else {

            hypothesis.score.negative +=
                Math.abs(result.reason.score);

        }

    }

    for (const hypothesis of grouped.values()) {

        const total =
            hypothesis.score.positive +
            hypothesis.score.negative;

        hypothesis.confidence =
            total === 0
                ? 0
                : Math.round(
                    (hypothesis.score.positive /
                        total) *
                    100
                );

    }

    return [...grouped.values()];
}