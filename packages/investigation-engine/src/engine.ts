import { normalizeEvidence } from "./pipeline/normalize";
import { correlateEvidence } from "./pipeline/correlate";
import { buildTimeline } from "./pipeline/timeline";

import { detectChanges } from "./pipeline/changes";
import type { Evidence } from "./types/evidence";
import type { Investigation } from "./types/investigation";
import { generateHypotheses } from "./pipeline/hypotheses";

export function investigate(
    evidence: Evidence[]
): Investigation {

    const normalized =
        normalizeEvidence(evidence);

    const graph =
        correlateEvidence(normalized);

    const timeline =
        buildTimeline(graph);

    const changes =
        detectChanges(normalized);

    const hypotheses =
        generateHypotheses(
            normalized
        );

    return {

        evidence: normalized,

        graph,

        timeline,

        changes,

        hypotheses,

        rootCause:
            hypotheses.length > 0
                ? hypotheses[0]
                : null,

        impact: null,

        recommendations: [],
    };
}