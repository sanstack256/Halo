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
import { buildReport } from "./pipeline/report";
import { rules } from "./rules";
import { selectRootCause } from "./pipeline/root-cause";

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
            changes,
            graph
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

    /*
     * TEMPORARY DEBUGGING
     *
     * Remove this after we identify the
     * exact stage causing the problem.
     */
    console.log(
        "\n========== HALO INVESTIGATION DEBUG =========="
    );

    console.log(
        "\nEVIDENCE:",
        normalized.map(item => ({
            id: item.id,
            type: item.type,
            title: item.title,
            service: item.service,
            resource: item.resource,
            operation: item.operation,
            timestamp: item.timestamp,
        }))
    );

    console.log(
        "\nFINDINGS:",
        findings.map(finding => ({
            id: finding.id,
            type: finding.type,
            title: finding.title,
            strength: finding.strength,
            evidenceIds:
                finding.evidenceIds,
        }))
    );

    console.log(
        "\nCANDIDATES:",
        candidates.map(hypothesis => ({
            id: hypothesis.id,
            title: hypothesis.title,
            confidence:
                hypothesis.confidence,
            status:
                hypothesis.status,
            findingIds:
                hypothesis.findingIds,
            evidenceIds:
                hypothesis.evidenceIds,
        }))
    );

    console.log(
        "\nEVALUATED:",
        evaluatedHypotheses.map(hypothesis => ({
            id: hypothesis.id,
            title: hypothesis.title,
            confidence:
                hypothesis.confidence,
            score:
                hypothesis.score,
            supporting:
                hypothesis.supportingReasons.length,
            contradicting:
                hypothesis.contradictingReasons.length,
            missing:
                hypothesis.missingReasons.length,
        }))
    );

    console.log(
        "\nRANKED:",
        rankedHypotheses.map(hypothesis => ({
            id: hypothesis.id,
            title: hypothesis.title,
            confidence:
                hypothesis.confidence,
            status:
                hypothesis.status,
        }))
    );

    console.log(
        "\nVALIDATED:",
        hypotheses.map(hypothesis => ({
            id: hypothesis.id,
            title: hypothesis.title,
            confidence:
                hypothesis.confidence,
            status:
                hypothesis.status,
            validation:
                hypothesis.validation,
            score:
                hypothesis.score,
            missing:
                hypothesis.missingReasons,
            contradicting:
                hypothesis.contradictingReasons,
        }))
    );

    const impact =
        analyzeImpact(normalized);

    const rootCause =
        selectRootCause(hypotheses);

    const recommendations =
        generateRecommendations(
            hypotheses,
            context
        );

    const report =
        buildReport(
            hypotheses,
            recommendations
        );

    const nextRecommendation =
        recommendations.find(
            recommendation =>
                recommendation.question
        );

    const nextInvestigation =
        nextRecommendation?.question
            ? {
                  question:
                      nextRecommendation.question,

                  reason:
                      nextRecommendation.description,

                  evidenceIds:
                      nextRecommendation.evidenceIds,
              }
            : undefined;

    console.log(
        "\nROOT CAUSE:",
        rootCause
            ? {
                  id: rootCause.id,
                  title: rootCause.title,
                  confidence:
                      rootCause.confidence,
                  status:
                      rootCause.status,
              }
            : null
    );

    console.log(
        "\n========== END HALO DEBUG ==========\n"
    );

    return {
        status:
            rootCause
                ? "CONCLUDED"
                : "UNCERTAIN",

        evidence:
            normalized,

        graph,

        timeline,

        changes,

        findings,

        hypotheses,

        rootCause,

        impact,

        recommendations,

        report,

        nextInvestigation,
    };
}