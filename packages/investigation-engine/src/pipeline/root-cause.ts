import type { Hypothesis } from "../types/hypothesis";

export function selectRootCause(
    hypotheses: Hypothesis[]
): Hypothesis | null {
    const validated =
        hypotheses.filter(
            hypothesis =>
                hypothesis.status ===
                "VALIDATED"
        );

    if (validated.length === 0) {
        return null;
    }

    return [...validated].sort(
        (a, b) => {
            const confidenceDifference =
                b.confidence -
                a.confidence;

            if (
                confidenceDifference !== 0
            ) {
                return confidenceDifference;
            }

            return (
                causalPriority(b) -
                causalPriority(a)
            );
        }
    )[0] ?? null;
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