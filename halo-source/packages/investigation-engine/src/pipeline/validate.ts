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

    /*
     * Cross-service failure describes the blast
     * radius of an incident. It is not itself a
     * causal explanation.
     */
    if (
        hypothesis.title ===
        "Cross-Service Failure"
    ) {
        return {
            ...hypothesis,

            status: "CANDIDATE",

            validation: {
                validated: false,
                confidence: Math.min(
                    hypothesis.confidence,
                    69
                ),
                evidenceIds:
                    hypothesis.evidenceIds,
            },
        };
    }

    /*
     * Contradicting evidence must prevent
     * validation.
     */
    if (
        contradictionStrength >=
        supportStrength
    ) {
        return {
            ...hypothesis,

            status:
                hypothesis.status ===
                "VALIDATED"
                    ? "UNCERTAIN"
                    : hypothesis.status,

            validation: {
                validated: false,
                confidence: Math.min(
                    hypothesis.confidence,
                    69
                ),
                evidenceIds:
                    hypothesis.evidenceIds,
            },
        };
    }

    /*
     * A rollback by itself is not proof that the
     * deployment caused the failure.
     *
     * Require actual causal evidence in addition
     * to rollback evidence.
     */
    if (
        hypothesis.title ===
            "Deployment Regression" &&
        hasRollbackEvidence(context) &&
        !hasRecoveryEvidence(
            context,
            hypothesis
        )
    ) {
        return {
            ...hypothesis,

            status:
                isLeading
                    ? "UNCERTAIN"
                    : hypothesis.status,

            validation: {
                validated: false,
                confidence: Math.min(
                    hypothesis.confidence,
                    69
                ),
                evidenceIds:
                    hypothesis.evidenceIds,
            },
        };
    }

    const hasRelevantEvidence =
        hypothesis.evidenceIds.some(
            id =>
                context.evidence.some(
                    evidence =>
                        evidence.id === id
                )
        );

    /*
     * A hypothesis must have actual evidence
     * attached to it.
     */
    if (!hasRelevantEvidence) {
        return {
            ...hypothesis,

            status:
                isLeading
                    ? "UNCERTAIN"
                    : hypothesis.status,

            validation: {
                validated: false,
                confidence: Math.min(
                    hypothesis.confidence,
                    69
                ),
                evidenceIds:
                    hypothesis.evidenceIds,
            },
        };
    }

    /*
     * Missing evidence should reduce certainty,
     * but should not automatically invalidate a
     * strong hypothesis.
     */
    const validated =
        isLeading &&
        hypothesis.confidence >= 70 &&
        supportStrength >
            contradictionStrength &&
        missingStrength <
            supportStrength;

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

function hasRollbackEvidence(
    context: InvestigationContext
): boolean {
    return context.evidence.some(
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
}

function hasRecoveryEvidence(
    context: InvestigationContext,
    hypothesis: Hypothesis
): boolean {
    const hypothesisEvidence =
        new Set(
            hypothesis.evidenceIds
        );

    return context.evidence.some(
        evidence =>
            hypothesisEvidence.has(
                evidence.id
            ) &&
            (
                evidence.title
                    .toLowerCase()
                    .includes("recovery") ||
                evidence.title
                    .toLowerCase()
                    .includes("recovered") ||
                evidence.title
                    .toLowerCase()
                    .includes("resolved") ||
                evidence.title
                    .toLowerCase()
                    .includes("restored")
            )
    );
}