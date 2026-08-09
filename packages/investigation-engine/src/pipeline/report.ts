import type { InvestigationReport } from "../types/investigation";
import type { Hypothesis } from "../types/hypothesis";
import type { Recommendation } from "../types/recommendation";

export function buildReport(
    hypotheses: Hypothesis[],
    recommendations: Recommendation[]
): InvestigationReport {
    const rootCause =
        hypotheses.find(
            hypothesis =>
                hypothesis.status === "VALIDATED"
        ) ?? null;

    const alternatives = hypotheses
        .filter(
            hypothesis =>
                hypothesis.id !==
                rootCause?.id
        )
        .slice(0, 3)
        .map(hypothesis => ({
            title: hypothesis.title,
            confidence: hypothesis.confidence,
        }));

    const uncertainties = rootCause
        ? rootCause.missingReasons.map(
              reason => reason.description
          )
        : hypotheses
              .filter(
                  hypothesis =>
                      hypothesis.status ===
                      "UNCERTAIN"
              )
              .flatMap(
                  hypothesis =>
                      hypothesis.missingReasons.map(
                          reason =>
                              reason.description
                      )
              );

    const nextSteps = recommendations
        .slice(0, 5)
        .map(
            recommendation =>
                recommendation.title
        );

    return {
        summary: buildSummary(
            rootCause,
            hypotheses
        ),

        rootCause: rootCause
            ? {
                  title:
                      rootCause.title,
                  confidence:
                      rootCause.confidence,
                  explanation:
                      buildExplanation(
                          rootCause
                      ),
              }
            : null,

        alternatives,

        uncertainties: [
            ...new Set(uncertainties),
        ],

        nextSteps: [
            ...new Set(nextSteps),
        ],
    };
}

function buildSummary(
    rootCause: Hypothesis | null,
    hypotheses: Hypothesis[]
): string {
    if (!rootCause) {
        if (hypotheses.length === 0) {
            return "The investigation does not have enough evidence to identify a likely cause.";
        }

        return "The investigation has identified candidate explanations, but the available evidence is not strong enough to validate a root cause.";
    }

    return `The investigation indicates ${rootCause.title} as the most likely explanation with ${rootCause.confidence}% confidence.`;
}

function buildExplanation(
    hypothesis: Hypothesis
): string {
    const supporting =
        hypothesis.supportingReasons
            .slice(0, 3)
            .map(
                reason =>
                    reason.description
            );

    if (supporting.length === 0) {
        return hypothesis.description;
    }

    return supporting.join(" ");
}