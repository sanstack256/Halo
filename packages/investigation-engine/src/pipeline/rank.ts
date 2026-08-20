import type { Hypothesis } from "../types/hypothesis";
import type { Reason } from "../types/reason";

/**
 * Rank hypotheses after evaluation.
 *
 * Ranking answers:
 *
 * "Given the evidence we currently have, which explanations
 * deserve to be investigated first?"
 *
 * Ranking does NOT establish the root cause.
 *
 * Validation is responsible for deciding whether the leading
 * hypothesis is sufficiently supported to become a root cause.
 */
export function rankHypotheses(
    hypotheses: Hypothesis[],
): Hypothesis[] {
    if (hypotheses.length === 0) {
        return [];
    }

    const scored =
        hypotheses.map(
            hypothesis => ({
                ...hypothesis,

                confidence:
                    calculateConfidence(
                        hypothesis,
                    ),
            }),
        );

    /*
     * Evidence strength is the primary ordering mechanism.
     *
     * Causal category is deliberately only a tie-breaker.
     *
     * Example:
     *
     * Deployment Regression: 91
     * Shared Dependency:     64
     *
     * Deployment Regression MUST rank first even though
     * Shared Dependency has a higher causal priority.
     */
    const ranked =
        [...scored].sort(
            compareHypotheses,
        );

    return ranked.map(
        (
            hypothesis,
            index,
            all,
        ) => ({
            ...hypothesis,

            /*
             * "LEADING" means this is currently the strongest
             * candidate. It does NOT mean validated root cause.
             *
             * Validation can still downgrade it later.
             */
            status:
                index === 0 &&
                hypothesis.confidence >=
                    LEADING_THRESHOLD &&
                hypothesis.score.positive >
                    hypothesis.score.negative
                    ? "LEADING"
                    : normalizeRankedStatus(
                        hypothesis,
                    ),

            /*
             * Every other hypothesis is an explicit alternative.
             *
             * Keep ordering deterministic so the UI can reliably
             * explain why alternatives were considered.
             */
            alternativeIds:
                all
                    .filter(
                        alternative =>
                            alternative.id !==
                            hypothesis.id,
                    )
                    .map(
                        alternative =>
                            alternative.id,
                    ),
        }),
    );
}

const LEADING_THRESHOLD = 70;

/**
 * Compare two hypotheses.
 *
 * Ordering:
 *
 * 1. Confidence
 * 2. Net evidence
 * 3. Supporting evidence
 * 4. Contradiction strength
 * 5. Causal priority
 * 6. Stable ID
 *
 * This prevents domain preference from overriding evidence.
 */
function compareHypotheses(
    a: Hypothesis,
    b: Hypothesis,
): number {
    if (
        b.confidence !==
        a.confidence
    ) {
        return (
            b.confidence -
            a.confidence
        );
    }

    const aNet =
        netEvidence(a);

    const bNet =
        netEvidence(b);

    if (
        bNet !== aNet
    ) {
        return (
            bNet -
            aNet
        );
    }

    if (
        b.score.positive !==
        a.score.positive
    ) {
        return (
            b.score.positive -
            a.score.positive
        );
    }

    if (
        a.score.negative !==
        b.score.negative
    ) {
        return (
            a.score.negative -
            b.score.negative
        );
    }

    const causalPriorityDifference =
        causalPriority(b) -
        causalPriority(a);

    if (
        causalPriorityDifference !==
        0
    ) {
        return causalPriorityDifference;
    }

    /*
     * Final deterministic tie-breaker.
     *
     * Never depend on array insertion order.
     */
    return a.id.localeCompare(
        b.id,
    );
}

/**
 * Calculate net evidence.
 *
 * Contradictions count more strongly than missing information
 * because contradiction is actual evidence against a hypothesis.
 */
function netEvidence(
    hypothesis: Hypothesis,
): number {
    return (
        hypothesis.score.positive -
        hypothesis.score.negative * 1.15 -
        hypothesis.score.unknown * 0.65
    );
}

/**
 * Causal category priority.
 *
 * This is intentionally a tie-breaker only.
 *
 * It must never overpower substantially stronger evidence.
 */
function causalPriority(
    hypothesis: Hypothesis,
): number {
    if (
        hypothesis.id.startsWith("resource-saturation:") ||
        hypothesis.id.startsWith("security-incident:")
    ) {
        return 5;
    }

    switch (
        hypothesis.title
    ) {
        case "Shared Dependency Failure":
            return 4;

        case "Infrastructure Failure":
            return 4;

        case "Deployment Regression":
            return 3;

        case "Cross-Service Failure":
            return 1;

        default:
            return 2;
    }
}

/**
 * Convert evaluated evidence into an internal confidence score.
 *
 * Numerical confidence is intentionally kept inside the engine.
 *
 * The UI should present qualitative levels:
 *
 * - Low
 * - Medium
 * - High
 * - Very High
 *
 * rather than exposing this raw number as the primary user-facing
 * confidence representation.
 */
function calculateConfidence(
    hypothesis: Hypothesis,
): number {
    const positive =
        clamp(
            hypothesis.score.positive,
        );

    const negative =
        clamp(
            hypothesis.score.negative,
        );

    const unknown =
        clamp(
            hypothesis.score.unknown,
        );

    /*
     * No evidence means no confidence.
     */
    if (
        positive <= 0 &&
        negative <= 0
    ) {
        return 0;
    }

    /*
     * ------------------------------------------------------------
     * SUPPORT
     * ------------------------------------------------------------
     *
     * Positive evidence establishes the initial strength.
     */
    const evidenceBase =
        positive /
        Math.max(
            positive +
                negative,
            1,
        );

    /*
     * ------------------------------------------------------------
     * CONTRADICTION
     * ------------------------------------------------------------
     *
     * Actual contradictory evidence is more damaging than
     * merely missing evidence.
     */
    const contradictionRatio =
        negative /
        Math.max(
            positive +
                negative,
            1,
        );

    const contradictionPenalty =
        Math.min(
            0.65,
            contradictionRatio *
                0.65,
        );

    /*
     * ------------------------------------------------------------
     * UNCERTAINTY
     * ------------------------------------------------------------
     *
     * Missing evidence reduces confidence but does not destroy
     * a hypothesis that already has strong positive evidence.
     */
    const uncertaintyRatio =
        unknown /
        Math.max(
            positive +
                negative +
                unknown,
            1,
        );

    const uncertaintyPenalty =
        Math.min(
            0.4,
            uncertaintyRatio *
                0.4,
        );

    /*
     * ------------------------------------------------------------
     * EVIDENCE DENSITY
     * ------------------------------------------------------------
     *
     * A hypothesis supported by several independent evidence
     * observations should be stronger than one supported by a
     * single observation.
     *
     * We derive this from the reason/evidence relationships,
     * rather than blindly counting reasons.
     */
    const evidenceCount =
        countUniqueEvidence(
            hypothesis.supportingReasons,
        );

    const evidenceDensity =
        evidenceDensityBonus(
            evidenceCount,
        );

    /*
     * ------------------------------------------------------------
     * FINAL SCORE
     * ------------------------------------------------------------
     */
    const raw =
        evidenceBase *
        (
            1 -
            contradictionPenalty
        ) *
        (
            1 -
            uncertaintyPenalty
        ) *
        evidenceDensity;

    /*
     * A hypothesis with stronger contradiction than support
     * should never receive a high confidence score merely because
     * of evidence-density bonuses.
     */
    if (
        negative >= positive &&
        positive > 0
    ) {
        return Math.min(
            49,
            Math.round(
                raw * 100,
            ),
        );
    }

    return Math.round(
        clamp01(raw) * 100,
    );
}

/**
 * Evidence density bonus.
 *
 * We use diminishing returns:
 *
 * 1 independent evidence item → 1.00
 * 2 → 1.04
 * 3 → 1.07
 * 4 → 1.09
 * 5+ → capped at 1.12
 *
 * More evidence helps, but cannot manufacture certainty.
 */
function evidenceDensityBonus(
    count: number,
): number {
    if (count <= 1) {
        return 1;
    }

    return Math.min(
        1.12,
        1 +
            Math.log2(
                count,
            ) *
                0.04,
    );
}

/**
 * Count independent evidence observations.
 *
 * Evidence IDs are the unit of independence, not reasons.
 */
function countUniqueEvidence(
    reasons: Reason[],
): number {
    const ids =
        new Set<string>();

    for (const reason of reasons) {
        for (const evidenceId of
            reason.evidenceIds) {
            ids.add(
                evidenceId,
            );
        }
    }

    return ids.size;
}

function normalizeRankedStatus(
    hypothesis: Hypothesis,
): Hypothesis["status"] {
    /*
     * A previously VALIDATED hypothesis should not be silently
     * downgraded during ranking.
     *
     * Validation owns the final state.
     */
    if (
        hypothesis.status ===
        "VALIDATED"
    ) {
        return "VALIDATED";
    }

    /*
     * Rejected hypotheses remain rejected.
     */
    if (
        hypothesis.status ===
        "REJECTED"
    ) {
        return "REJECTED";
    }

    return "CANDIDATE";
}

function clamp(
    value: number,
): number {
    if (
        !Number.isFinite(value)
    ) {
        return 0;
    }

    return Math.max(
        0,
        value,
    );
}

function clamp01(
    value: number,
): number {
    if (
        !Number.isFinite(value)
    ) {
        return 0;
    }

    return Math.max(
        0,
        Math.min(
            1,
            value,
        ),
    );
}