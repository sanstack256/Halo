import type { Hypothesis } from "../types/hypothesis";
import type { InvestigationContext } from "../types/context";

export function validateHypotheses(
    hypotheses: Hypothesis[],
    context: InvestigationContext
): Hypothesis[] {
    return hypotheses.map(
        (hypothesis, index) =>
            validateHypothesis(
                hypothesis,
                index === 0,
                hypotheses,
                context
            )
    );
}

function validateHypothesis(
    hypothesis: Hypothesis,
    isLeading: boolean,
    hypotheses: Hypothesis[],
    context: InvestigationContext
): Hypothesis {
    const contradictionStrength =
        totalStrength(
            hypothesis.contradictingReasons
        );

    const supportStrength =
        totalStrength(
            hypothesis.supportingReasons
        );

    const missingStrength =
        totalStrength(
            hypothesis.missingReasons
        );

    const strongestAlternative =
        hypotheses
            .filter(
                alternative =>
                    alternative.id !==
                    hypothesis.id
            )
            .reduce<Hypothesis | null>(
                (strongest, alternative) => {
                    if (!strongest) {
                        return alternative;
                    }

                    return alternative.confidence >
                        strongest.confidence
                        ? alternative
                        : strongest;
                },
                null
            );

    const alternativeGap =
        strongestAlternative
            ? hypothesis.confidence -
            strongestAlternative.confidence
            : hypothesis.confidence;

    const rankedAboveAlternative =
        !strongestAlternative ||
        hypotheses.indexOf(hypothesis) <
        hypotheses.indexOf(
            strongestAlternative
        );

    const isBareCrossServiceFailure =
        hypothesis.title ===
        "Cross-Service Failure" &&
        hypothesis.supportingReasons.every(
            reason =>
                reason.causalRole ===
                "CONTEXT"
        );


    const validated =
        !isBareCrossServiceFailure &&
        isLeading &&
        hypothesis.confidence >= 70 &&
        supportStrength > contradictionStrength &&
        missingStrength < supportStrength &&
        (
            alternativeGap >= 10 ||
            rankedAboveAlternative
        ) &&
        hasRelevantEvidence(
            hypothesis,
            context
        );

    return {
        ...hypothesis,

        status: validated
            ? "VALIDATED"
            : isLeading
                ? "UNCERTAIN"
                : hypothesis.status,

        validation: {
            validated,

            confidence:
                validated
                    ? hypothesis.confidence
                    : Math.min(
                        hypothesis.confidence,
                        69
                    ),

            evidenceIds:
                hypothesis.evidenceIds,
        },
    };
}

function totalStrength(
    reasons: Hypothesis["supportingReasons"]
): number {
    return reasons.reduce(
        (total, reason) =>
            total + reason.strength,
        0
    );
}

function hasRelevantEvidence(
    hypothesis: Hypothesis,
    context: InvestigationContext
): boolean {
    return hypothesis.evidenceIds.some(
        id =>
            context.evidence.some(
                evidence =>
                    evidence.id === id
            )
    );
}