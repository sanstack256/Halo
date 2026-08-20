import type { Hypothesis } from "../types/hypothesis";

const MIN_ROOT_CAUSE_CONFIDENCE = 70;

export function selectRootCause(
    hypotheses: Hypothesis[],
): Hypothesis | null {
    const eligible =
        hypotheses.filter(
            hypothesis =>
                isEligibleRootCause(
                    hypothesis,
                ),
        );

    if (
        eligible.length === 0
    ) {
        return null;
    }

    return (
        [...eligible].sort(
            compareRootCauses,
        )[0] ?? null
    );
}

function isEligibleRootCause(
    hypothesis: Hypothesis,
): boolean {
    if (
        hypothesis.status !==
        "VALIDATED"
    ) {
        return false;
    }

    if (
        hypothesis.validation !== undefined &&
        hypothesis.validation.validated === false
    ) {
        return false;
    }

    if (
        hypothesis.confidence <
        MIN_ROOT_CAUSE_CONFIDENCE
    ) {
        return false;
    }

    if (
        hypothesis.title ===
        "Cross-Service Failure"
    ) {
        return false;
    }

    const support =
        totalStrength(
            hypothesis.supportingReasons,
        );

    const contradiction =
        totalStrength(
            hypothesis.contradictingReasons,
        );

    if (
        contradiction > 0 &&
        contradiction >=
        support
    ) {
        return false;
    }

    if (
        hypothesis.evidenceIds
            .length === 0
    ) {
        return false;
    }

    return true;
}

function compareRootCauses(
    a: Hypothesis,
    b: Hypothesis,
): number {
    const confidenceDifference =
        b.confidence -
        a.confidence;

    if (
        confidenceDifference !== 0
    ) {
        return confidenceDifference;
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

    const supportDifference =
        totalStrength(
            b.supportingReasons,
        ) -
        totalStrength(
            a.supportingReasons,
        );

    if (
        supportDifference !== 0
    ) {
        return supportDifference;
    }

    const contradictionDifference =
        totalStrength(
            a.contradictingReasons,
        ) -
        totalStrength(
            b.contradictingReasons,
        );

    if (
        contradictionDifference !== 0
    ) {
        return contradictionDifference;
    }

    return a.id.localeCompare(
        b.id,
    );
}

function causalPriority(
    hypothesis: Hypothesis,
): number {
    if (
        hypothesis.id.startsWith("resource-saturation:") ||
        hypothesis.id.startsWith("security-incident:")
    ) {
        return 4;
    }

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
            return 2;
    }
}

function totalStrength(
    reasons: Hypothesis["supportingReasons"],
): number {
    return reasons.reduce(
        (total, reason) =>
            total +
            clampStrength(
                reason.strength,
            ),
        0,
    );
}

function clampStrength(
    strength: number,
): number {
    if (
        !Number.isFinite(
            strength,
        )
    ) {
        return 0;
    }

    return Math.max(
        0,
        Math.min(
            1,
            strength,
        ),
    );
}