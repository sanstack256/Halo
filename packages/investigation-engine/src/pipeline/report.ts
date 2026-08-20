import type { InvestigationReport } from "../types/investigation";
import type { Hypothesis } from "../types/hypothesis";
import type { Recommendation } from "../types/recommendation";
import { getConfidenceLevel } from "../types/confidence";
import { selectRootCause } from "./root-cause";

const MAX_ALTERNATIVES = 3;
const MAX_UNCERTAINTIES = 5;
const MAX_NEXT_STEPS = 5;
const MAX_REASONS = 5;

export function buildReport(
    hypotheses: Hypothesis[],
    recommendations: Recommendation[],
): InvestigationReport {
    const rootCause =
        selectRootCause(hypotheses);

    const alternatives =
        buildAlternatives(
            hypotheses,
            rootCause,
        );

    const uncertainties =
        buildUncertainties(
            hypotheses,
            rootCause,
        );

    const nextSteps =
        buildNextSteps(
            recommendations,
        );

    return {
        summary:
            buildSummary(
                rootCause,
                hypotheses,
            ),

        rootCause: rootCause
            ? buildRootCauseReport(
                  rootCause,
              )
            : null,

        alternatives,

        uncertainties,

        nextSteps,
    };
}

function buildRootCauseReport(
    hypothesis: Hypothesis,
): NonNullable<
    InvestigationReport["rootCause"]
> {
    return {
        title:
            hypothesis.title,

        confidence:
            hypothesis.confidence,

        confidenceLevel:
            getConfidenceLevel(
                hypothesis.confidence,
            ),

        explanation:
            buildExplanation(
                hypothesis,
            ),

        supportingReasons:
            uniqueStrings(
                hypothesis.supportingReasons
                    .slice(
                        0,
                        MAX_REASONS,
                    )
                    .map(
                        reason =>
                            reason.description,
                    ),
            ),

        contradictingReasons:
            uniqueStrings(
                hypothesis.contradictingReasons
                    .slice(
                        0,
                        MAX_REASONS,
                    )
                    .map(
                        reason =>
                            reason.description,
                    ),
            ),

        missingReasons:
            uniqueStrings(
                hypothesis.missingReasons
                    .slice(
                        0,
                        MAX_REASONS,
                    )
                    .map(
                        reason =>
                            reason.description,
                    ),
            ),

        propagationPath: hypothesis.supportingReasons
            .filter((r) => r.causalRole === "CAUSE" || r.causalRole === "TRIGGER" || r.causalRole === "MECHANISM")
            .map((r) => `${r.title}: ${r.description}`)
            .slice(0, 5),
    };
}

function buildAlternatives(
    hypotheses: Hypothesis[],
    rootCause: Hypothesis | null,
): InvestigationReport["alternatives"] {
    return hypotheses
        .filter(
            hypothesis =>
                hypothesis.id !==
                    rootCause?.id &&
                hypothesis.status !==
                    "REJECTED",
        )
        .sort(
            (a, b) =>
                b.confidence -
                a.confidence,
        )
        .slice(
            0,
            MAX_ALTERNATIVES,
        )
        .map(
            hypothesis => ({
                title:
                    hypothesis.title,

                confidence:
                    hypothesis.confidence,

                confidenceLevel:
                    getConfidenceLevel(
                        hypothesis.confidence,
                    ),
            }),
        );
}

function buildUncertainties(
    hypotheses: Hypothesis[],
    rootCause: Hypothesis | null,
): string[] {
    const sources = rootCause
        ? [
              ...rootCause.missingReasons,
              ...rootCause.contradictingReasons,
          ]
        : hypotheses
              .filter(
                  hypothesis =>
                      hypothesis.status ===
                          "UNCERTAIN" ||
                      hypothesis.status ===
                          "CANDIDATE" ||
                      hypothesis.status ===
                          "LEADING",
              )
              .flatMap(
                  hypothesis => [
                      ...hypothesis.missingReasons,
                      ...hypothesis.contradictingReasons,
                  ],
              );

    return uniqueStrings(
        sources
            .filter(
                reason =>
                    reason.description
                        .trim()
                        .length > 0,
            )
            .sort(
                (a, b) =>
                    b.strength -
                    a.strength,
            )
            .slice(
                0,
                MAX_UNCERTAINTIES,
            )
            .map(
                reason =>
                    reason.description,
            ),
    );
}

function buildNextSteps(
    recommendations: Recommendation[],
): string[] {
    return uniqueStrings(
        [...recommendations]
            .sort(
                (a, b) => {
                    const priorityDifference =
                        priorityWeight(
                            b.priority,
                        ) -
                        priorityWeight(
                            a.priority,
                        );

                    if (
                        priorityDifference !==
                        0
                    ) {
                        return priorityDifference;
                    }

                    return (
                        b.confidence -
                        a.confidence
                    );
                },
            )
            .slice(
                0,
                MAX_NEXT_STEPS,
            )
            .map(
                recommendation =>
                    recommendation.title,
            ),
    );
}

function buildSummary(
    rootCause: Hypothesis | null,
    hypotheses: Hypothesis[],
): string {
    if (!rootCause) {
        return "The investigation does not have enough evidence to validate a root cause.";
    }

    const confidenceLevel =
        getConfidenceLevel(
            rootCause.confidence,
        );

    return `The investigation identifies ${rootCause.title} as the most likely explanation with ${formatConfidenceLevel(
        confidenceLevel,
    )} confidence.`;
}

function buildExplanation(
    hypothesis: Hypothesis,
): string {
    const supporting =
        uniqueStrings(
            hypothesis.supportingReasons
                .filter(
                    reason =>
                        reason.description
                            .trim()
                            .length > 0,
                )
                .sort(
                    (a, b) =>
                        b.strength -
                        a.strength,
                )
                .slice(
                    0,
                    3,
                )
                .map(
                    reason =>
                        reason.description,
                ),
        );

    if (
        supporting.length === 0
    ) {
        return (
            hypothesis.description ||
            "The available evidence supports this hypothesis, but there is not enough detail to provide a more specific explanation."
        );
    }

    return supporting.join(" ");
}

function priorityWeight(
    priority: Recommendation["priority"],
): number {
    switch (priority) {
        case "HIGH":
            return 3;

        case "MEDIUM":
            return 2;

        case "LOW":
            return 1;

        default:
            return 0;
    }
}

function formatConfidenceLevel(
    level: ReturnType<
        typeof getConfidenceLevel
    >,
): string {
    switch (level) {
        case "VERY_HIGH":
            return "very high";

        case "HIGH":
            return "high";

        case "MEDIUM":
            return "medium";

        case "LOW":
            return "low";

        default:
            return "low";
    }
}

function uniqueStrings(
    values: string[],
): string[] {
    return [
        ...new Set(
            values
                .map(
                    value =>
                        value.trim(),
                )
                .filter(
                    value =>
                        value.length > 0,
                ),
        ),
    ];
}