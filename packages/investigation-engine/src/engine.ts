import { normalizeEvidence } from "./pipeline/normalize";
import { correlateEvidence } from "./pipeline/correlate";
import { buildTimeline } from "./pipeline/timeline";
import { buildContext } from "./pipeline/build-context";
import { detectChanges } from "./pipeline/changes";
import { generateHypotheses } from "./pipeline/hypotheses";
import { evaluateHypotheses } from "./pipeline/evaluate";
import { rankHypotheses } from "./pipeline/rank";
import { validateHypotheses } from "./pipeline/validate";
import { generateRecommendations } from "./pipeline/recommend";
import { rules } from "./rules";

import { analyzeImpact } from "./pipeline/impact";
import type { Evidence } from "./types/evidence";
import type { Investigation } from "./types/investigation";

export function investigate(
    evidence: Evidence[]
): Investigation {
    const normalized =
        normalizeEvidence(evidence);

    const changes =
        detectChanges(normalized);

    const graph =
        correlateEvidence(normalized);

    const timeline =
        buildTimeline(graph);

    const initialContext =
        buildContext(
            normalized,
            changes
        );

    const findings =
        rules.flatMap(
            rule => rule(initialContext)
        );

    const context = {
        ...initialContext,
        findings,
    };

    const candidates =
        generateHypotheses(context);

    const evaluatedHypotheses =
        evaluateHypotheses(
            candidates,
            context
        );

    const rankedHypotheses =
        rankHypotheses(
            evaluatedHypotheses
        );

    const hypotheses =
        validateHypotheses(
            rankedHypotheses,
            context
        );

    const recommendations =
        generateRecommendations(
            hypotheses,
            context
        );

    const impact =
        analyzeImpact(normalized);

    const rootCause =
        hypotheses.find(
            hypothesis =>
                hypothesis.status ===
                "VALIDATED"
        ) ?? null;

    return {
        status:
            rootCause
                ? "CONCLUDED"
                : "UNCERTAIN",

        evidence: normalized,

        graph,

        timeline,

        changes,

        findings,

        hypotheses,

        rootCause,

        impact,

        recommendations,
    };
}