/**
 * Halo Trace Explore — Shared Evidence Sufficiency Engine
 * Multi-factor qualitative assessment of evidence sufficiency for investigation analyzers.
 * Never outputs arbitrary confidence percentages. Replaced by explicit capability guarantees.
 */

export type SufficiencyStatus = "SUFFICIENT" | "LIMITED" | "INSUFFICIENT";

export interface EvidenceSufficiencyVerdict {
    status: SufficiencyStatus;
    reasons: string[];
    coverage: number; // 0 to 1
    evidenceIds: string[];
    whatCanBeEstablished: string[];
    whatCannotBeEstablished: string[];
    recommendedNextActions: string[];
}

/**
 * Assess sufficiency for Trace Structural Comparison.
 */
export function assessTraceComparisonSufficiency(params: {
    targetSpanCount: number;
    referenceSpanCount: number;
    hasReference: boolean;
    referenceQuality: "Strong" | "Moderate" | "Limited" | "Unavailable";
    targetEvidenceIds: string[];
    referenceEvidenceIds: string[];
}): EvidenceSufficiencyVerdict {
    const { targetSpanCount, referenceSpanCount, hasReference, referenceQuality, targetEvidenceIds, referenceEvidenceIds } = params;
    const reasons: string[] = [];
    const whatCanBeEstablished: string[] = [];
    const whatCannotBeEstablished: string[] = [];
    const nextActions: string[] = [];
    const allEvidenceIds = [...targetEvidenceIds, ...referenceEvidenceIds];

    if (!hasReference || referenceQuality === "Unavailable") {
        return {
            status: "INSUFFICIENT",
            reasons: ["No comparable reference trace with matching service and operation was found in telemetry."],
            coverage: 0,
            evidenceIds: targetEvidenceIds,
            whatCanBeEstablished: ["Target execution topology and error status."],
            whatCannotBeEstablished: ["Where the failing execution structurally diverges from a successful execution."],
            recommendedNextActions: ["Broaden the time window or manually specify a reference trace ID."],
        };
    }

    if (targetSpanCount <= 1 && referenceSpanCount <= 1) {
        reasons.push("Only one span was captured in each execution.");
        whatCanBeEstablished.push("Root operation and status of both executions.");
        whatCannotBeEstablished.push("Internal downstream divergence (downstream spans were not instrumented or emitted).");
        nextActions.push("Verify distributed tracing instrumentation on downstream service clients.");

        return {
            status: "LIMITED",
            reasons,
            coverage: 0.3,
            evidenceIds: allEvidenceIds,
            whatCanBeEstablished,
            whatCannotBeEstablished,
            recommendedNextActions: nextActions,
        };
    }

    if (referenceQuality === "Limited") {
        reasons.push("Reference trace matches service and operation but differs in environment or release.");
        whatCanBeEstablished.push("Structural span differences between the two traces.");
        whatCannotBeEstablished.push("Whether divergence is caused by release variation or environmental configuration.");
        nextActions.push("Inspect release and environment tags on reference trace.");

        return {
            status: "LIMITED",
            reasons,
            coverage: 0.65,
            evidenceIds: allEvidenceIds,
            whatCanBeEstablished,
            whatCannotBeEstablished,
            recommendedNextActions: nextActions,
        };
    }

    whatCanBeEstablished.push("Earliest observed point where execution paths diverge.");
    whatCanBeEstablished.push("Differences in child span calls, durations, and HTTP/database statuses.");
    whatCannotBeEstablished.push("Root causal attribution without reviewing code or application state.");
    nextActions.push("Inspect the first observed divergence span and correlated logs.");

    return {
        status: "SUFFICIENT",
        reasons: ["Both traces have adequate span depth and matching service/operation/environment."],
        coverage: 1.0,
        evidenceIds: allEvidenceIds,
        whatCanBeEstablished,
        whatCannotBeEstablished,
        recommendedNextActions: nextActions,
    };
}

/**
 * Assess sufficiency for Error Reproduction Condition Analysis.
 */
export function assessErrorReproductionSufficiency(params: {
    failureCount: number;
    comparatorCount: number;
    evidenceIds: string[];
}): EvidenceSufficiencyVerdict {
    const { failureCount, comparatorCount, evidenceIds } = params;
    const reasons: string[] = [];
    const whatCanBeEstablished: string[] = [];
    const whatCannotBeEstablished: string[] = [];
    const nextActions: string[] = [];

    if (failureCount === 0) {
        return {
            status: "INSUFFICIENT",
            reasons: ["No failure occurrences found for this fingerprint or event."],
            coverage: 0,
            evidenceIds: [],
            whatCanBeEstablished: [],
            whatCannotBeEstablished: ["Any execution conditions surrounding the error."],
            recommendedNextActions: ["Select a valid error fingerprint or event ID."],
        };
    }

    if (failureCount === 1) {
        reasons.push("Only 1 failure occurrence observed. A single observation cannot establish necessity or requirement.");
        whatCanBeEstablished.push("The observed environmental attributes of this single failure event.");
        whatCannotBeEstablished.push("Which conditions are required versus incidental to the failure.");
        nextActions.push("Awaiting additional occurrences to observe repeated patterns, or compare against baseline successes.");

        return {
            status: "LIMITED",
            reasons,
            coverage: 0.25,
            evidenceIds,
            whatCanBeEstablished,
            whatCannotBeEstablished,
            recommendedNextActions: nextActions,
        };
    }

    if (comparatorCount === 0) {
        reasons.push("Multiple failure occurrences captured, but no comparable successful executions found in telemetry.");
        whatCanBeEstablished.push("Common conditions observed across repeated failures.");
        whatCannotBeEstablished.push("Whether these conditions are unique to failures or also common in successful requests.");
        nextActions.push("Instrument non-error traces for this route or service to build a comparator population.");

        return {
            status: "LIMITED",
            reasons,
            coverage: 0.6,
            evidenceIds,
            whatCanBeEstablished,
            whatCannotBeEstablished,
            recommendedNextActions: nextActions,
        };
    }

    whatCanBeEstablished.push("Observed condition frequencies across failure occurrences.");
    whatCanBeEstablished.push("Condition divergence between failure and successful execution populations.");
    whatCannotBeEstablished.push("Causal dependency without dynamic reproduction confirmation.");
    nextActions.push("Use the observed reproduction recipe to reproduce the failure in staging.");

    return {
        status: "SUFFICIENT",
        reasons: [`${failureCount} failure occurrences and ${comparatorCount} comparable successes evaluated.`],
        coverage: 1.0,
        evidenceIds,
        whatCanBeEstablished,
        whatCannotBeEstablished,
        recommendedNextActions: nextActions,
    };
}

/**
 * Assess sufficiency for Metric Shape Twin Matching.
 */
export function assessMetricShapeSufficiency(params: {
    sampleCount: number;
    minRequiredSamples?: number;
    historicalWindowCount: number;
}): EvidenceSufficiencyVerdict {
    const { sampleCount, minRequiredSamples = 6, historicalWindowCount } = params;

    if (sampleCount < minRequiredSamples) {
        return {
            status: "INSUFFICIENT",
            reasons: [`Current window contains only ${sampleCount} samples (minimum ${minRequiredSamples} required to extract a behavioral shape).`],
            coverage: sampleCount / minRequiredSamples,
            evidenceIds: [],
            whatCanBeEstablished: ["Current metric values at sparse sample points."],
            whatCannotBeEstablished: ["Contour, slope, peak structure, or shape trajectory."],
            recommendedNextActions: ["Select a wider time window or verify telemetry emission frequency."],
        };
    }

    if (historicalWindowCount === 0) {
        return {
            status: "LIMITED",
            reasons: ["Current window has adequate samples, but no historical lookback windows exist in telemetry."],
            coverage: 0.5,
            evidenceIds: [],
            whatCanBeEstablished: ["Current interval shape characteristics (trend, volatility, peak)."],
            whatCannotBeEstablished: ["Whether this shape has been observed historically."],
            recommendedNextActions: ["Allow more telemetry history to accumulate."],
        };
    }

    return {
        status: "SUFFICIENT",
        reasons: [`Adequate sample density (${sampleCount} points) and ${historicalWindowCount} historical windows available.`],
        coverage: 1.0,
        evidenceIds: [],
        whatCanBeEstablished: ["Quantitative shape contour comparison against historical intervals."],
        whatCannotBeEstablished: ["Proof of identical root cause (shape resemblance is not causal proof)."],
        recommendedNextActions: ["Correlate events and deployments active during matched historical intervals."],
    };
}

/**
 * Assess sufficiency for Database Wait Attribution.
 */
export function assessDatabaseWaitSufficiency(params: {
    hasRequestSpan: boolean;
    hasDatabaseSpans: boolean;
    dbSpanCount: number;
    requestDurationMs: number | null;
    totalDbDurationMs: number;
    evidenceIds: string[];
}): EvidenceSufficiencyVerdict {
    const { hasRequestSpan, hasDatabaseSpans, dbSpanCount, requestDurationMs, totalDbDurationMs, evidenceIds } = params;

    if (!hasDatabaseSpans || dbSpanCount === 0) {
        return {
            status: "INSUFFICIENT",
            reasons: ["No database telemetry or SQL spans observed for this request."],
            coverage: 0,
            evidenceIds,
            whatCanBeEstablished: ["Overall request execution duration (if request was captured)."],
            whatCannotBeEstablished: ["Time spent waiting on database operations (telemetry was not captured)."],
            recommendedNextActions: ["Ensure database client or ORM is instrumented with Halo SDK trace hooks."],
        };
    }

    if (!hasRequestSpan || requestDurationMs === null) {
        return {
            status: "LIMITED",
            reasons: ["Database spans were observed, but the outer HTTP request duration was not captured."],
            coverage: 0.5,
            evidenceIds,
            whatCanBeEstablished: ["Observed duration of individual database operations."],
            whatCannotBeEstablished: ["What percentage of overall request time was spent on database operations."],
            recommendedNextActions: ["Instrument ingress HTTP handler to capture request boundaries."],
        };
    }

    const coverage = requestDurationMs > 0 ? Math.min(1.0, totalDbDurationMs / requestDurationMs) : 0;

    return {
        status: "SUFFICIENT",
        reasons: [`${dbSpanCount} database queries and total request duration (${requestDurationMs}ms) captured.`],
        coverage,
        evidenceIds,
        whatCanBeEstablished: [
            "Exact observed database duration vs application processing duration.",
            "Breakdown of individual SQL queries and wait classifications.",
        ],
        whatCannotBeEstablished: [
            "Internal server-side CPU wait within unattributed time gaps.",
        ],
        recommendedNextActions: ["Inspect unattributed time gaps for uninstrumented external network calls."],
    };
}
