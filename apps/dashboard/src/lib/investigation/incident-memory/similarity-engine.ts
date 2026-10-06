/**
 * Historical Incident Similarity Engine for Halo Trace Pillars D & J.
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
 * 5. Negative Learning: Surfacing historical remediations that caused regressions (REGRESSED)
 *    or failed to resolve (NOT_RESOLVED) with explicit cautions.
 * 6. Deterministic Ranking: Historical matches are ranked deterministically by classification tier,
 *    similarity score, outcome relevance, and recency, eliminating database order dependence.
 */

export type SimilarityDimension =
    | "SERVICE"
    | "OPERATION"
    | "ERROR"
    | "CAUSAL_STRUCTURE"
    | "TOPOLOGY"
    | "FAILURE_PROPAGATION"
    | "CHANGE_CHARACTERISTICS"
    | "REMEDIATION_CONTEXT";

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
    historicalOutcome?: string | null; // e.g. "RESOLVED", "REGRESSED", "NOT_RESOLVED", "IMPROVED", "UNKNOWN"
    historicalStrength?: string | null; // e.g. "HIGH", "MEDIUM", "LOW"
    historicalRemediations?: Array<{
        type: string;
        actionSummary: string;
        result?: string;
        strength?: string;
        evidenceReferences?: string[];
    }>;
    historicalCaution?: string | null;
    regressionEvidence?: string | null;
    contradictionsWithCurrent?: string[];
    historicalVerdicts?: any[];
    historicalRecommendations?: any[];
    createdAt?: string;
    observedAt?: string;
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
    changeCharacteristics?: {
        commitSha?: string;
        changeType?: string;
        filesChanged?: string[];
        linesChanged?: number[];
        deploymentLinked?: boolean;
    } | null;
    remediationContext?: {
        types?: string[];
        latestResult?: string;
        latestStrength?: string;
    } | null;
    ownershipContext?: {
        teamName?: string;
        classification?: string;
    } | null;
    verifiedOutcome?: string | null;
    verificationStrength?: string | null;
    historicalRemediations?: Array<{
        type: string;
        actionSummary: string;
        result?: string;
        strength?: string;
        evidenceReferences?: string[];
    }>;
    createdAt?: string | Date;
    observedAt?: string | Date;
}

const DIMENSION_WEIGHTS: Record<SimilarityDimension, number> = {
    SERVICE: 25,
    OPERATION: 20,
    ERROR: 20,
    CAUSAL_STRUCTURE: 15,
    TOPOLOGY: 10,
    FAILURE_PROPAGATION: 10,
    CHANGE_CHARACTERISTICS: 15,
    REMEDIATION_CONTEXT: 10,
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
    const contradictions: string[] = [];

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

    // 7. CHANGE_CHARACTERISTICS DIMENSION (Weight: 15)
    const currentChange = current.changeCharacteristics;
    const histChange = historical.changeCharacteristics;
    if (!currentChange && !histChange) {
        missing.push("CHANGE_CHARACTERISTICS");
    } else if (!currentChange || !histChange) {
        totalWeightEvaluated += DIMENSION_WEIGHTS.CHANGE_CHARACTERISTICS;
        differing.push("CHANGE_CHARACTERISTICS");
        signals.push({
            dimension: "CHANGE_CHARACTERISTICS",
            isMatch: false,
            description: currentChange
                ? `Current incident has change observation (${currentChange.changeType || "change"}), but historical incident had no recorded changes.`
                : `Historical incident had change observation (${histChange?.changeType || "change"}), but current incident has no recorded changes.`,
        });
    } else {
        totalWeightEvaluated += DIMENSION_WEIGHTS.CHANGE_CHARACTERISTICS;
        const sameType =
            currentChange.changeType &&
            histChange.changeType &&
            currentChange.changeType.toLowerCase() === histChange.changeType.toLowerCase();
        const currentFiles = new Set((currentChange.filesChanged || []).map((f) => f.toLowerCase()));
        const commonFiles = (histChange.filesChanged || []).filter((f) => currentFiles.has(f.toLowerCase()));

        if (sameType && commonFiles.length > 0) {
            earnedWeight += DIMENSION_WEIGHTS.CHANGE_CHARACTERISTICS;
            matching.push("CHANGE_CHARACTERISTICS");
            signals.push({
                dimension: "CHANGE_CHARACTERISTICS",
                isMatch: true,
                description: `Matching change type (${currentChange.changeType}) with overlapping files [${commonFiles.join(", ")}].`,
            });
        } else if (sameType) {
            earnedWeight += DIMENSION_WEIGHTS.CHANGE_CHARACTERISTICS * 0.6;
            matching.push("CHANGE_CHARACTERISTICS");
            signals.push({
                dimension: "CHANGE_CHARACTERISTICS",
                isMatch: true,
                description: `Matching change type (${currentChange.changeType}), though specific changed files differ.`,
            });
        } else if (commonFiles.length > 0) {
            earnedWeight += DIMENSION_WEIGHTS.CHANGE_CHARACTERISTICS * 0.5;
            differing.push("CHANGE_CHARACTERISTICS");
            signals.push({
                dimension: "CHANGE_CHARACTERISTICS",
                isMatch: false,
                description: `Shared changed files [${commonFiles.join(", ")}], but differing change types (current: ${currentChange.changeType}, historical: ${histChange.changeType}).`,
            });
        } else {
            differing.push("CHANGE_CHARACTERISTICS");
            signals.push({
                dimension: "CHANGE_CHARACTERISTICS",
                isMatch: false,
                description: `Differing change characteristics: current is ${currentChange.changeType || "unknown"}, historical was ${histChange.changeType || "unknown"}.`,
            });
        }
    }

    // 8. REMEDIATION_CONTEXT DIMENSION (Weight: 10)
    const currentRem = current.remediationContext;
    const histRem = historical.remediationContext;
    if (!currentRem && !histRem) {
        missing.push("REMEDIATION_CONTEXT");
    } else if (!currentRem || !histRem) {
        missing.push("REMEDIATION_CONTEXT"); // Don't penalize if current remediation has not yet been planned
    } else {
        totalWeightEvaluated += DIMENSION_WEIGHTS.REMEDIATION_CONTEXT;
        const currentTypes = new Set((currentRem.types || []).map((t) => t.toUpperCase()));
        const commonTypes = (histRem.types || []).filter((t) => currentTypes.has(t.toUpperCase()));

        if (commonTypes.length > 0) {
            earnedWeight += DIMENSION_WEIGHTS.REMEDIATION_CONTEXT;
            matching.push("REMEDIATION_CONTEXT");
            signals.push({
                dimension: "REMEDIATION_CONTEXT",
                isMatch: true,
                description: `Matching remediation action types: [${commonTypes.join(", ")}].`,
            });
        } else {
            differing.push("REMEDIATION_CONTEXT");
            signals.push({
                dimension: "REMEDIATION_CONTEXT",
                isMatch: false,
                description: `Different remediation approaches: current [${Array.from(currentTypes).join(", ")}], historical [${(histRem.types || []).join(", ")}].`,
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

    if (causesDiffer) {
        contradictions.push(
            `Root cause divergence: current investigation identified "${current.rootCause}", historical incident recorded "${historical.rootCause}".`
        );
    }

    // Negative Learning & Historical Caution
    let historicalCaution: string | null = null;
    let regressionEvidence: string | null = null;

    const histOutcome = historical.verifiedOutcome || null;
    if (histOutcome === "REGRESSED") {
        historicalCaution =
            "Historical caution: A similar incident remediation previously produced a regression (Result: REGRESSED). Telemetry showed post-change errors or latency degradation.";
        regressionEvidence = "Observed post-change latency spike or new error signature in historical telemetry.";
    } else if (histOutcome === "NOT_RESOLVED") {
        historicalCaution =
            "Historical caution: A similar incident remediation was attempted but did not resolve the failure (Result: NOT_RESOLVED).";
    }

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

    const createdIso = historical.createdAt
        ? (historical.createdAt instanceof Date ? historical.createdAt.toISOString() : String(historical.createdAt))
        : undefined;
    const observedIso = historical.observedAt
        ? (historical.observedAt instanceof Date ? historical.observedAt.toISOString() : String(historical.observedAt))
        : undefined;

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
        historicalOutcome: histOutcome,
        historicalStrength: historical.verificationStrength ?? null,
        historicalRemediations: historical.historicalRemediations || [],
        historicalCaution,
        regressionEvidence,
        contradictionsWithCurrent: contradictions,
        createdAt: createdIso,
        observedAt: observedIso,
    };
}

/**
 * Deterministically rank historical matches according to Section 53:
 * 1. Primary: Classification tier (STRONG > MODERATE > WEAK > NO_MEANINGFUL_MATCH)
 * 2. Secondary: Score descending
 * 3. Tertiary: Verified outcome relevance (RESOLVED = REGRESSED > NOT_RESOLVED > IMPROVED > UNKNOWN > INSUFFICIENT_DATA)
 * 4. Quaternary: Recency (createdAt descending)
 * 5. Tie-break: Deterministic ID comparison
 */
export function rankHistoricalMatches(matches: IncidentComparisonResult[]): IncidentComparisonResult[] {
    const tierOrder: Record<SimilarityClassification, number> = {
        STRONG_STRUCTURAL_MATCH: 4,
        MODERATE_STRUCTURAL_MATCH: 3,
        WEAK_PARTIAL_MATCH: 2,
        NO_MEANINGFUL_MATCH: 1,
    };

    const outcomeWeight: Record<string, number> = {
        RESOLVED: 5,
        REGRESSED: 5, // Negative learning is top relevance for operational safety
        NOT_RESOLVED: 4,
        IMPROVED: 3,
        UNKNOWN: 2,
        INSUFFICIENT_DATA: 1,
    };

    return [...matches].sort((a, b) => {
        // 1. Primary: Classification tier
        const tierA = tierOrder[a.classification] || 0;
        const tierB = tierOrder[b.classification] || 0;
        if (tierA !== tierB) return tierB - tierA;

        // 2. Secondary: Score descending
        if (b.score !== a.score) return b.score - a.score;

        // 3. Tertiary: Verified outcome relevance
        const outA = a.historicalOutcome ? outcomeWeight[a.historicalOutcome] || 0 : 0;
        const outB = b.historicalOutcome ? outcomeWeight[b.historicalOutcome] || 0 : 0;
        if (outA !== outB) return outB - outA;

        // 4. Quaternary: Recency (createdAt descending)
        if (a.createdAt && b.createdAt) {
            const timeA = new Date(a.createdAt).getTime();
            const timeB = new Date(b.createdAt).getTime();
            if (timeA !== timeB) return timeB - timeA;
        }

        // 5. Deterministic tie-breaker on ID
        return a.historicalInvestigationId.localeCompare(b.historicalInvestigationId);
    });
}

/**
 * In-memory tenant-safe cache for incident similarity calculations.
 */
interface CacheEntry {
    data: any;
    expiresAt: number;
}

export const incidentMemoryCache = new Map<string, CacheEntry>();

export function clearIncidentMemoryCache(): void {
    incidentMemoryCache.clear();
}
