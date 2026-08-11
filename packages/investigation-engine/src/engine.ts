import type { Evidence } from "./types/evidence";
import type { Finding } from "./types/finding";
import type { Investigation } from "./types/investigation";
import type { InvestigationContext } from "./types/context";

import { normalizeEvidence } from "./pipeline/normalize";
import { detectChanges } from "./pipeline/changes";
import { correlateEvidence } from "./pipeline/correlate";
import { buildTimeline } from "./pipeline/timeline";
import { buildContext } from "./pipeline/build-context";
import { generateHypotheses } from "./pipeline/hypotheses";
import { evaluateHypotheses } from "./pipeline/evaluate";
import { rankHypotheses } from "./pipeline/rank";
import { validateHypotheses } from "./pipeline/validate";
import { selectRootCause } from "./pipeline/root-cause";
import { analyzeImpact } from "./pipeline/impact";
import { generateRecommendations } from "./pipeline/recommend";
import { buildReport } from "./pipeline/report";
import { rules } from "./rules";

export function investigate(
    evidence: Evidence[],
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
            graph,
        );

    const findings =
        collectFindings(
            initialContext,
        );

    const context: InvestigationContext = {
        ...initialContext,
        findings,
    };

    const candidates =
        generateHypotheses(
            context,
        );

    const evaluated =
        evaluateHypotheses(
            candidates,
            context,
        );

    const ranked =
        rankHypotheses(
            evaluated,
        );

    const hypotheses =
        validateHypotheses(
            ranked,
            context,
        );

    const rootCause =
        selectRootCause(
            hypotheses,
        );

    const impact =
        analyzeImpact(
            normalized,
        );

    const recommendations =
        generateRecommendations(
            hypotheses,
            context,
        );

    const nextInvestigation =
        buildNextInvestigation(
            recommendations,
        );

    const report =
        buildReport(
            hypotheses,
            recommendations,
        );

    const status =
        rootCause !== null
            ? "CONCLUDED"
            : "UNCERTAIN";

    return {
        status,
        evidence: normalized,
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

function collectFindings(
    context: InvestigationContext,
): Finding[] {
    const findings =
        rules.flatMap(
            rule =>
                rule(context),
        );

    return deduplicateFindings(
        findings,
    );
}

function deduplicateFindings(
    findings: Finding[],
): Finding[] {
    const seen =
        new Set<string>();

    const result: Finding[] = [];

    for (const finding of findings) {
        if (
            !finding.id ||
            seen.has(finding.id)
        ) {
            continue;
        }

        seen.add(finding.id);
        result.push(finding);
    }

    return result;
}

function buildNextInvestigation(
    recommendations: InvestigationRecommendation[],
): Investigation["nextInvestigation"] {
    const recommendation =
        recommendations.find(
            item =>
                typeof item.question ===
                    "string" &&
                item.question.trim()
                    .length > 0,
        );

    if (!recommendation?.question) {
        return null;
    }

    return {
        question:
            recommendation.question.trim(),

        reason:
            recommendation.description,

        evidenceIds:
            uniqueStrings(
                recommendation.evidenceIds,
            ),
    };
}

type InvestigationRecommendation = {
    question?: string;
    description: string;
    evidenceIds: string[];
};

function uniqueStrings(
    values: string[],
): string[] {
    const seen =
        new Set<string>();

    const result: string[] = [];

    for (const value of values) {
        if (
            typeof value !== "string" ||
            value.length === 0 ||
            seen.has(value)
        ) {
            continue;
        }

        seen.add(value);
        result.push(value);
    }

    return result;
}