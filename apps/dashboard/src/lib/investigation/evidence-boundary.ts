export type EvidenceSufficiencyLevel = "SUFFICIENT" | "PARTIAL" | "INSUFFICIENT";

export interface ReleaseSufficiencyAssessment {
    sufficiency: EvidenceSufficiencyLevel;
    sufficientForReleaseRegression: boolean;
    sufficientForCausalInference: boolean;
    verdict: "Regression Detected" | "Likely Regression" | "No Regression Observed" | "Insufficient Evidence";
    summaryExplanation: string;
    reasons: string[];
    whatHaloCanEstablish: string[];
    whatHaloCannotEstablish: string[];
    recommendedNextActions: string[];
    metrics: {
        baselineRequests: number;
        baselineErrors: number;
        baselineErrorRate: number;
        baselineAvgLatencyMs: number | null;
        observationRequests: number;
        observationErrors: number;
        observationErrorRate: number;
        observationAvgLatencyMs: number | null;
        errorPpDiff: number | null;
        isErrorRegression: boolean;
        isLatencyRegression: boolean;
    };
}

export interface IntervalSufficiencyAssessment {
    sufficiency: EvidenceSufficiencyLevel;
    sufficientForIntervalConclusion: boolean;
    sufficientForCausalInference: boolean;
    headline: string;
    summaryExplanation: string;
    contextExplanation?: string;
    reasons: string[];
    whatHaloCanEstablish: string[];
    whatHaloCannotEstablish: string[];
    recommendedNextActions: string[];
    metrics: {
        primaryRequests: number;
        primaryErrors: number;
        primaryErrorRate: number;
        primaryAvgLatencyMs: number | null;
        baselineRequests: number;
        baselineErrors: number;
        baselineErrorRate: number;
        baselineAvgLatencyMs: number | null;
        precedingCount: number;
        followingCount: number;
        contextualErrorsCount: number;
    };
}

/**
 * Explicit multi-factor assessment of evidence sufficiency for release impact analysis.
 * Evaluates observation volume, error count, trace/request linkage, baseline comparability,
 * and duration to prevent sparse telemetry from manufacturing false causality or false regressions.
 */
export function assessReleaseEvidenceSufficiency(params: {
    releaseVersion: string;
    releaseTime: Date;
    baseEvents: any[];
    obsEvents: any[];
    observationWindowDurationMs?: number;
}): ReleaseSufficiencyAssessment {
    const { releaseVersion, baseEvents, obsEvents } = params;

    const baseErrors = baseEvents.filter((e) => e.type === "ERROR").length;
    const baseRequests = baseEvents.length;
    const baseErrorRate = baseRequests > 0 ? (baseErrors / baseRequests) * 100 : 0;
    const baseDurations = baseEvents.map((e) => e.durationMs).filter((d): d is number => typeof d === "number" && d > 0);
    const baseAvgLatencyMs = baseDurations.length > 0 ? baseDurations.reduce((a, b) => a + b, 0) / baseDurations.length : null;

    const obsErrors = obsEvents.filter((e) => e.type === "ERROR").length;
    const obsRequests = obsEvents.length;
    const obsErrorRate = obsRequests > 0 ? (obsErrors / obsRequests) * 100 : 0;
    const obsDurations = obsEvents.map((e) => e.durationMs).filter((d): d is number => typeof d === "number" && d > 0);
    const obsAvgLatencyMs = obsDurations.length > 0 ? obsDurations.reduce((a, b) => a + b, 0) / obsDurations.length : null;

    const obsTraces = obsEvents.filter((e) => e.type === "TRACE" || e.traceId).length;

    // Multi-factor sufficiency checks
    const hasAdequateBaseline = baseRequests >= 5;
    const hasAdequateObservationVolume = obsRequests >= 5;
    const hasStructuralLinkage = obsTraces >= 2 || obsErrors >= 2;

    const sufficientForReleaseRegression = hasAdequateBaseline && hasAdequateObservationVolume;
    const sufficientForCausalInference = hasAdequateObservationVolume && (hasStructuralLinkage || obsErrors > 0);

    const errorPpDiff = sufficientForReleaseRegression ? obsErrorRate - baseErrorRate : null;
    const isErrorRegression = sufficientForReleaseRegression && errorPpDiff !== null && errorPpDiff > 0 && obsErrors > baseErrors && obsErrorRate >= 10;
    const isLatencyRegression = sufficientForReleaseRegression && baseAvgLatencyMs !== null && obsAvgLatencyMs !== null && (obsAvgLatencyMs - baseAvgLatencyMs) / baseAvgLatencyMs > 0.5;

    let verdict: "Regression Detected" | "Likely Regression" | "No Regression Observed" | "Insufficient Evidence" = "No Regression Observed";
    let sufficiency: EvidenceSufficiencyLevel = "SUFFICIENT";
    const reasons: string[] = [];
    const whatHaloCanEstablish: string[] = [];
    const whatHaloCannotEstablish: string[] = [];
    const recommendedNextActions: string[] = [];

    if (!hasAdequateObservationVolume) {
        sufficiency = obsRequests > 0 ? "PARTIAL" : "INSUFFICIENT";
        verdict = "Insufficient Evidence";
        reasons.push(
            obsRequests === 1
                ? `Only 1 post-deployment event was observed, which is insufficient to establish release behavior.`
                : obsRequests === 0
                ? `Zero post-deployment events were observed after release deployment.`
                : `Only ${obsRequests} post-deployment events were observed (minimum 5 required for statistical comparison).`
        );
        if (!hasAdequateBaseline) {
            reasons.push(`Pre-deployment baseline sample size is low (${baseRequests} events).`);
        }

        whatHaloCanEstablish.push(`Baseline error rate was ${baseErrorRate.toFixed(1)}% across ${baseRequests} events.`);
        if (obsRequests > 0) {
            whatHaloCanEstablish.push(`${obsRequests} post-deployment event(s) observed (${obsErrors} errors).`);
        } else {
            whatHaloCanEstablish.push(`No telemetry observed after deployment timestamp.`);
        }

        whatHaloCannotEstablish.push(`Whether release ${releaseVersion} caused or did not cause an operational regression.`);
        whatHaloCannotEstablish.push(`Whether observed post-release error or latency distributions are representative.`);

        recommendedNextActions.push(`Continue observing post-deployment telemetry as traffic accumulates.`);
        recommendedNextActions.push(`Verify telemetry instrumentation and active release tag propagation.`);
    } else if (isErrorRegression || isLatencyRegression) {
        sufficiency = "SUFFICIENT";
        verdict = "Regression Detected";
        if (isErrorRegression) {
            reasons.push(`Error rate increased from ${baseErrorRate.toFixed(1)}% to ${obsErrorRate.toFixed(1)}% (+${errorPpDiff!.toFixed(1)}pp) post-deployment.`);
        }
        if (isLatencyRegression) {
            reasons.push(`Average latency degraded by ${(((obsAvgLatencyMs! - baseAvgLatencyMs!) / baseAvgLatencyMs!) * 100).toFixed(1)}% (${Math.round(baseAvgLatencyMs!)}ms → ${Math.round(obsAvgLatencyMs!)}ms).`);
        }

        whatHaloCanEstablish.push(`Significant regression observed across ${obsRequests} post-deployment events.`);
        whatHaloCannotEstablish.push(`Root cause outside the scope of instrumented services.`);

        recommendedNextActions.push(`Inspect failing endpoints and rollback release ${releaseVersion} if impact is critical.`);
    } else {
        sufficiency = "SUFFICIENT";
        verdict = "No Regression Observed";

        if (obsRequests > baseRequests && baseErrorRate > obsErrorRate) {
            reasons.push(`Traffic increased from ${baseRequests} to ${obsRequests} events. Absolute errors increased (${baseErrors} → ${obsErrors}), but error rate improved (${baseErrorRate.toFixed(1)}% → ${obsErrorRate.toFixed(1)}%).`);
        } else {
            reasons.push(`Operational metrics remained stable before and after deployment (${obsErrorRate.toFixed(1)}% error rate).`);
        }

        whatHaloCanEstablish.push(`Pre/post deployment metrics remained within normal operational thresholds.`);
        whatHaloCannotEstablish.push(`Behavior of edge cases not exercised in post-deployment traffic.`);

        recommendedNextActions.push(`Monitor real-time telemetry in Change Intelligence.`);
    }

    let summaryExplanation = "";
    if (verdict === "Insufficient Evidence") {
        summaryExplanation = `Evaluated ${baseEvents.length + obsEvents.length} total events (${baseRequests} baseline, ${obsRequests} post-deployment). Evidence insufficient to establish release impact.`;
    } else if (isErrorRegression) {
        summaryExplanation = `Error rate increased from ${baseErrorRate.toFixed(1)}% to ${obsErrorRate.toFixed(1)}% (+${errorPpDiff!.toFixed(1)}pp) post-deployment.`;
    } else if (isLatencyRegression) {
        summaryExplanation = `Average latency increased by ${(((obsAvgLatencyMs! - baseAvgLatencyMs!) / baseAvgLatencyMs!) * 100).toFixed(1)}% (${Math.round(baseAvgLatencyMs!)}ms → ${Math.round(obsAvgLatencyMs!)}ms) post-deployment.`;
    } else if (obsRequests > baseRequests && baseErrorRate > obsErrorRate) {
        summaryExplanation = `Traffic increased from ${baseRequests} to ${obsRequests} events. Absolute errors increased (${baseErrors} → ${obsErrors}), but error rate improved (${baseErrorRate.toFixed(1)}% → ${obsErrorRate.toFixed(1)}%). No error regression detected.`;
    } else {
        summaryExplanation = `Operational metrics remained stable before and after deployment (${obsErrorRate.toFixed(1)}% error rate).`;
    }

    return {
        sufficiency,
        sufficientForReleaseRegression,
        sufficientForCausalInference,
        verdict,
        summaryExplanation,
        reasons,
        whatHaloCanEstablish,
        whatHaloCannotEstablish,
        recommendedNextActions,
        metrics: {
            baselineRequests: baseRequests,
            baselineErrors: baseErrors,
            baselineErrorRate: baseErrorRate,
            baselineAvgLatencyMs: baseAvgLatencyMs,
            observationRequests: obsRequests,
            observationErrors: obsErrors,
            observationErrorRate: obsErrorRate,
            observationAvgLatencyMs: obsAvgLatencyMs,
            errorPpDiff,
            isErrorRegression,
            isLatencyRegression,
        },
    };
}

/**
 * Explicit multi-factor assessment of evidence sufficiency for temporal interval analysis.
 * Strictly separates the primary interval from preceding and following context windows.
 */
export function assessIntervalEvidenceSufficiency(params: {
    primaryEvents: any[];
    precedingEvents: any[];
    followingEvents: any[];
    baselineEvents: any[];
    releases: any[];
}): IntervalSufficiencyAssessment {
    const { primaryEvents, precedingEvents, followingEvents, baselineEvents, releases } = params;

    const primaryErrors = primaryEvents.filter((e) => e.type === "ERROR").length;
    const primaryRequests = primaryEvents.length;
    const primaryErrorRate = primaryRequests > 0 ? (primaryErrors / primaryRequests) * 100 : 0;
    const primaryDurations = primaryEvents.map((e) => e.durationMs).filter((d): d is number => typeof d === "number" && d > 0);
    const primaryAvgLatencyMs = primaryDurations.length > 0 ? primaryDurations.reduce((a, b) => a + b, 0) / primaryDurations.length : null;

    const baselineErrors = baselineEvents.filter((e) => e.type === "ERROR").length;
    const baselineRequests = baselineEvents.length;
    const baselineErrorRate = baselineRequests > 0 ? (baselineErrors / baselineRequests) * 100 : 0;
    const baselineDurations = baselineEvents.map((e) => e.durationMs).filter((d): d is number => typeof d === "number" && d > 0);
    const baselineAvgLatencyMs = baselineDurations.length > 0 ? baselineDurations.reduce((a, b) => a + b, 0) / baselineDurations.length : null;

    const contextualErrors = [...precedingEvents, ...followingEvents].filter((e) => e.type === "ERROR");

    const sufficientForIntervalConclusion = primaryRequests > 0;
    const sufficientForCausalInference = primaryRequests >= 3 || primaryErrors > 0;

    let sufficiency: EvidenceSufficiencyLevel = "SUFFICIENT";
    let headline = "";
    let summaryExplanation = "";
    let contextExplanation: string | undefined;
    const reasons: string[] = [];
    const whatHaloCanEstablish: string[] = [];
    const whatHaloCannotEstablish: string[] = [];
    const recommendedNextActions: string[] = [];

    if (primaryRequests === 0) {
        sufficiency = "INSUFFICIENT";
        headline = "Insufficient Telemetry Observed in Selected Interval";
        summaryExplanation = "No request or error events were observed inside the selected interval.";
        reasons.push("Zero telemetry events recorded within the exact primary interval bounds.");

        whatHaloCanEstablish.push("0 request or error events were recorded inside the primary interval.");

        if (contextualErrors.length > 0) {
            contextExplanation = `${contextualErrors.length} contextual error event(s) observed in the surrounding window outside the primary interval.`;
            whatHaloCanEstablish.push(`Contextual telemetry found outside the interval (${contextualErrors.length} nearby error event(s)).`);
            recommendedNextActions.push("Expand the interval in System Explorer to encompass the nearby contextual events.");
        } else {
            whatHaloCannotEstablish.push("System operational state during this interval due to absence of recorded telemetry.");
            recommendedNextActions.push("Check if the application service was idle or uninstrumented during this timeframe.");
        }
    } else if (primaryErrors > 0) {
        sufficiency = primaryRequests >= 5 ? "SUFFICIENT" : "PARTIAL";
        headline = `Error Surge of ${primaryErrors} Failures (${primaryErrorRate.toFixed(1)}% error rate)`;
        summaryExplanation = `Evaluated ${primaryRequests} requests (${primaryErrors} errors, ${primaryErrorRate.toFixed(1)}% error rate). Baseline: ${baselineErrorRate.toFixed(1)}% error rate.`;
        reasons.push(`${primaryErrors} failures observed during the primary interval.`);
        whatHaloCanEstablish.push(`${primaryErrors} error events recorded across ${primaryRequests} requests.`);
        if (releases.length > 0) {
            whatHaloCanEstablish.push(`Correlated with nearby release ${releases[0].version}.`);
        }
        recommendedNextActions.push("Inspect the failing endpoint stack traces and upstream service dependencies.");
    } else {
        sufficiency = "SUFFICIENT";
        headline = `Stable Operational Interval (${primaryRequests} requests, 0 errors)`;
        summaryExplanation = `Evaluated ${primaryRequests} requests with 0 recorded errors during the selected interval.`;
        reasons.push("Operational telemetry observed zero failures inside the selected interval.");
        whatHaloCanEstablish.push(`All ${primaryRequests} observed requests completed successfully without errors.`);
        recommendedNextActions.push("Return to System Explorer or inspect other operational intervals.");
    }

    return {
        sufficiency,
        sufficientForIntervalConclusion,
        sufficientForCausalInference,
        headline,
        summaryExplanation,
        contextExplanation,
        reasons,
        whatHaloCanEstablish,
        whatHaloCannotEstablish,
        recommendedNextActions,
        metrics: {
            primaryRequests,
            primaryErrors,
            primaryErrorRate,
            primaryAvgLatencyMs,
            baselineRequests,
            baselineErrors,
            baselineErrorRate,
            baselineAvgLatencyMs,
            precedingCount: precedingEvents.length,
            followingCount: followingEvents.length,
            contextualErrorsCount: contextualErrors.length,
        },
    };
}
