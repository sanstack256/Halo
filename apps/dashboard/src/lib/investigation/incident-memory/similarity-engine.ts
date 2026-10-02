/**
 * Historical Incident Similarity Engine for Halo Trace Pillar D.
 *
 * CRITICAL ARCHITECTURAL INVARIANTS:
 * 1. Historical similarity is CONTEXT; current telemetry remains authoritative for current causality.
 * 2. Similarity confidence is strictly separate from root-cause confidence.
 *    A 95% historical structural similarity NEVER modifies or inflates current investigation confidence
 *    or root-cause determination.
 * 3. Similarity must be explainable. Every match breaks down into:
 *    - Matching dimensions (and why)
 *    - Differing dimensions (and why)
 *    - Missing dimensions
 *    - Structured signals referencing actual evidence.
 * 4. Same symptom != same root cause. The engine explicitly flags when symptoms match
 *    but causal chains or root causes diverge.
 */

export type SimilarityDimension =
    | "SERVICE"
    | "OPERATION"
    | "ERROR"
    | "CAUSAL_STRUCTURE"
    | "TOPOLOGY"
    | "FAILURE_PROPAGATION";

export interface SimilaritySignal {
    dimension: SimilarityDimension;
    isMatch: boolean;
    description: string;
    evidenceReference?: string;
}

export type SimilarityClassification =
    | "STRONG_STRUCTURAL_MATCH"
    | "MODERATE_STRUCTURAL_MATCH"
    | "WEAK_PARTIAL_MATCH"
    | "NO_MEANINGFUL_MATCH";

export interface IncidentComparisonResult {
    historicalInvestigationId: string;
    historicalTitle: string;
    score: number; // 0.0 to 100.0 (deterministic formula)
    classification: SimilarityClassification;
    matchingDimensions: SimilarityDimension[];
    differingDimensions: SimilarityDimension[];
    missingDimensions: SimilarityDimension[];
    signals: SimilaritySignal[];
    explanation: string;
    symptomMatchWithDifferentCause: boolean;
    historicalRootCause: string | null;
    currentRootCause: string | null;
    historicalConfidence: number | null;
    currentConfidence: number | null;
    historicalRecommendations?: any[];
    historicalVerdicts?: any[];
}

export interface IncidentComparisonInput {
    id: string;
    title: string;
    primaryService: string;
    primaryOperation?: string | null;
    errorType?: string | null;
    rootCause?: string | null;
    confidenceScore?: number | null;
    affectedServices: string[];
    causalChainSummary?: {
        hops?: number;
        originService?: string;
        propagationPath?: string[];
    } | null;
    topologyEdges?: Array<{ from: string; to: string }> | null;
    evidenceReferences?: string[];
}

const DIMENSION_WEIGHTS: Record<SimilarityDimension, number> = {
    SERVICE: 25,
    OPERATION: 20,
    ERROR: 20,
    CAUSAL_STRUCTURE: 15,
    TOPOLOGY: 10,
    FAILURE_PROPAGATION: 10,
};

/**
 * Deterministically compare a current incident against a historical incident memory record.
 */
export function compareIncidents(
    current: IncidentComparisonInput,
    historical: IncidentComparisonInput
): IncidentComparisonResult {
    const signals: SimilaritySignal[] = [];
    const matching: SimilarityDimension[] = [];
    const differing: SimilarityDimension[] = [];
    const missing: SimilarityDimension[] = [];

    let totalWeightEvaluated = 0;
    let earnedWeight = 0;

    // 1. SERVICE DIMENSION (Weight: 25)
    totalWeightEvaluated += DIMENSION_WEIGHTS.SERVICE;
    if (
        current.primaryService &&
        historical.primaryService &&
        current.primaryService.toLowerCase() === historical.primaryService.toLowerCase()
    ) {
        earnedWeight += DIMENSION_WEIGHTS.SERVICE;
        matching.push("SERVICE");
        signals.push({
            dimension: "SERVICE",
            isMatch: true,
            description: `Both incidents originate in service "${current.primaryService}".`,
        });
    } else {
        differing.push("SERVICE");
        signals.push({
            dimension: "SERVICE",
            isMatch: false,
            description: `Primary services differ: current is "${current.primaryService}", historical was "${historical.primaryService}".`,
        });
    }

    // 2. OPERATION DIMENSION (Weight: 20)
    if (!current.primaryOperation && !historical.primaryOperation) {
        missing.push("OPERATION");
    } else {
        totalWeightEvaluated += DIMENSION_WEIGHTS.OPERATION;
        const opCurrent = current.primaryOperation?.trim().toLowerCase();
        const opHistorical = historical.primaryOperation?.trim().toLowerCase();
        if (opCurrent && opHistorical && opCurrent === opHistorical) {
            earnedWeight += DIMENSION_WEIGHTS.OPERATION;
            matching.push("OPERATION");
            signals.push({
                dimension: "OPERATION",
                isMatch: true,
                description: `Matching operation endpoint "${current.primaryOperation}".`,
            });
        } else {
            differing.push("OPERATION");
            signals.push({
                dimension: "OPERATION",
                isMatch: false,
                description: `Operations differ: current is "${current.primaryOperation || "unknown"}", historical was "${historical.primaryOperation || "unknown"}".`,
            });
        }
    }

    // 3. ERROR DIMENSION (Weight: 20)
    if (!current.errorType && !historical.errorType) {
        missing.push("ERROR");
    } else {
        totalWeightEvaluated += DIMENSION_WEIGHTS.ERROR;
        const errCurrent = current.errorType?.trim().toLowerCase();
        const errHistorical = historical.errorType?.trim().toLowerCase();
        if (errCurrent && errHistorical && errCurrent === errHistorical) {
            earnedWeight += DIMENSION_WEIGHTS.ERROR;
            matching.push("ERROR");
            signals.push({
                dimension: "ERROR",
                isMatch: true,
                description: `Matching error classification "${current.errorType}".`,
            });
        } else {
            differing.push("ERROR");
            signals.push({
                dimension: "ERROR",
                isMatch: false,
                description: `Failure types differ: current is "${current.errorType || "unknown"}", historical was "${historical.errorType || "unknown"}".`,
            });
        }
    }

    // 4. CAUSAL_STRUCTURE DIMENSION (Weight: 15)
    const currentChain = current.causalChainSummary;
    const histChain = historical.causalChainSummary;
    if (!currentChain || !histChain) {
        missing.push("CAUSAL_STRUCTURE");
    } else {
        totalWeightEvaluated += DIMENSION_WEIGHTS.CAUSAL_STRUCTURE;
        const sameOrigin =
            currentChain.originService &&
            histChain.originService &&
            currentChain.originService.toLowerCase() === histChain.originService.toLowerCase();
        const sameHopCount = currentChain.hops === histChain.hops;

        if (sameOrigin && sameHopCount) {
            earnedWeight += DIMENSION_WEIGHTS.CAUSAL_STRUCTURE;
            matching.push("CAUSAL_STRUCTURE");
            signals.push({
                dimension: "CAUSAL_STRUCTURE",
                isMatch: true,
                description: `Identical causal chain origin ("${currentChain.originService}") and hop length (${currentChain.hops}).`,
            });
        } else if (sameOrigin) {
            earnedWeight += DIMENSION_WEIGHTS.CAUSAL_STRUCTURE * 0.5;
            differing.push("CAUSAL_STRUCTURE");
            signals.push({
                dimension: "CAUSAL_STRUCTURE",
                isMatch: false,
                description: `Shared causal origin ("${currentChain.originService}"), but different cascade depth (current: ${currentChain.hops ?? "?"}, historical: ${histChain.hops ?? "?"}).`,
            });
        } else {
            differing.push("CAUSAL_STRUCTURE");
            signals.push({
                dimension: "CAUSAL_STRUCTURE",
                isMatch: false,
                description: `Causal chain origins differ: current originates at "${currentChain.originService || "unknown"}", historical at "${histChain.originService || "unknown"}".`,
            });
        }
    }

    // 5. TOPOLOGY DIMENSION (Weight: 10)
    const currentEdges = current.topologyEdges || [];
    const histEdges = historical.topologyEdges || [];
    if (currentEdges.length === 0 && histEdges.length === 0) {
        missing.push("TOPOLOGY");
    } else {
        totalWeightEvaluated += DIMENSION_WEIGHTS.TOPOLOGY;
        const formatEdge = (e: { from: string; to: string }) => `${e.from.toLowerCase()}->${e.to.toLowerCase()}`;
        const currentSet = new Set(currentEdges.map(formatEdge));
        const commonEdges = histEdges.filter((e) => currentSet.has(formatEdge(e)));

        if (commonEdges.length > 0 && commonEdges.length === Math.max(currentEdges.length, histEdges.length)) {
            earnedWeight += DIMENSION_WEIGHTS.TOPOLOGY;
            matching.push("TOPOLOGY");
            signals.push({
                dimension: "TOPOLOGY",
                isMatch: true,
                description: `Identical service dependency path observed across ${commonEdges.length} hops.`,
            });
        } else if (commonEdges.length > 0) {
            earnedWeight += DIMENSION_WEIGHTS.TOPOLOGY * 0.5;
            differing.push("TOPOLOGY");
            signals.push({
                dimension: "TOPOLOGY",
                isMatch: false,
                description: `Partially shared dependency edges (${commonEdges.length} common), but topology structures diverge.`,
            });
        } else {
            differing.push("TOPOLOGY");
            signals.push({
                dimension: "TOPOLOGY",
                isMatch: false,
                description: "No common dependency edges between investigated incidents.",
            });
        }
    }

    // 6. FAILURE_PROPAGATION DIMENSION (Weight: 10)
    const currentAffected = new Set((current.affectedServices || []).map((s) => s.toLowerCase()));
    const histAffected = (historical.affectedServices || []).map((s) => s.toLowerCase());
    const commonServices = histAffected.filter((s) => currentAffected.has(s));

    if (currentAffected.size === 0 && histAffected.length === 0) {
        missing.push("FAILURE_PROPAGATION");
    } else {
        totalWeightEvaluated += DIMENSION_WEIGHTS.FAILURE_PROPAGATION;
        if (commonServices.length > 0 && commonServices.length === Math.max(currentAffected.size, histAffected.length)) {
            earnedWeight += DIMENSION_WEIGHTS.FAILURE_PROPAGATION;
            matching.push("FAILURE_PROPAGATION");
            signals.push({
                dimension: "FAILURE_PROPAGATION",
                isMatch: true,
                description: `Identical downstream blast radius across services [${commonServices.join(", ")}].`,
            });
        } else if (commonServices.length > 0) {
            earnedWeight += DIMENSION_WEIGHTS.FAILURE_PROPAGATION * 0.5;
            differing.push("FAILURE_PROPAGATION");
            signals.push({
                dimension: "FAILURE_PROPAGATION",
                isMatch: false,
                description: `Partially overlapping blast radius [${commonServices.join(", ")}], but failure propagation differs.`,
            });
        } else {
            differing.push("FAILURE_PROPAGATION");
            signals.push({
                dimension: "FAILURE_PROPAGATION",
                isMatch: false,
                description: "Different downstream services impacted.",
            });
        }
    }

    // Compute deterministic score (0.0 to 100.0)
    const rawScore = totalWeightEvaluated > 0 ? (earnedWeight / totalWeightEvaluated) * 100 : 0;
    const score = Math.round(rawScore * 10) / 10;

    let classification: SimilarityClassification = "NO_MEANINGFUL_MATCH";
    if (score >= 75) {
        classification = "STRONG_STRUCTURAL_MATCH";
    } else if (score >= 50) {
        classification = "MODERATE_STRUCTURAL_MATCH";
    } else if (score >= 25) {
        classification = "WEAK_PARTIAL_MATCH";
    }

    // Check for "Same symptom, different cause" invariant
    const hasSymptomMatch = matching.includes("SERVICE") && (matching.includes("OPERATION") || matching.includes("ERROR"));
    const causesDiffer =
        historical.rootCause &&
        current.rootCause &&
        historical.rootCause.toLowerCase() !== current.rootCause.toLowerCase();
    const symptomMatchWithDifferentCause = Boolean(hasSymptomMatch && (causesDiffer || differing.includes("CAUSAL_STRUCTURE")));

    // Build human-readable explanation
    let explanation = "";
    if (classification === "NO_MEANINGFUL_MATCH") {
        explanation = `Low structural overlap (${score}%). Primary failure characteristics diverge significantly.`;
    } else if (symptomMatchWithDifferentCause) {
        explanation = `Shared surface symptom in ${current.primaryService} (${matching.join(", ")}), but causal paths diverge. Historical root cause was "${historical.rootCause || "unresolved"}", whereas current telemetry shows differing causality.`;
    } else {
        explanation = `${classification.replace(/_/g, " ")} (${score}%). Overlapping characteristics in ${matching.join(", ")}.`;
        if (differing.length > 0) {
            explanation += ` Differences observed in: ${differing.join(", ")}.`;
        }
    }

    return {
        historicalInvestigationId: historical.id,
        historicalTitle: historical.title,
        score,
        classification,
        matchingDimensions: matching,
        differingDimensions: differing,
        missingDimensions: missing,
        signals,
        explanation,
        symptomMatchWithDifferentCause,
        historicalRootCause: historical.rootCause ?? null,
        currentRootCause: current.rootCause ?? null,
        historicalConfidence: historical.confidenceScore ?? null,
        currentConfidence: current.confidenceScore ?? null,
    };
}
