/**
 * Halo Trace — Decision-Specific Evidence Reconciliation Engine
 *
 * Implements Phase 40 Directive 1:
 * Replaces universal global evidence hierarchies (e.g. "runtime > AST" or "tests > source")
 * with a decision-specific authority model.
 *
 * Authority is determined strictly relative to the physical fact being evaluated:
 * - "What actually executed?" -> runtime execution trace / telemetry dominates.
 * - "What source implements this symbol?" -> verified repository AST / source provenance dominates.
 * - "What behavior is intended?" -> tests, contracts, schemas, callers, and specifications dominate.
 * - "What configuration was active?" -> deployment & runtime configuration dominates.
 * - "Did this code change cause this incident?" -> temporal validity + execution relevance + causal evidence required.
 * - "Did this repair work?" -> post-patch execution & behavioral validation dominates.
 */

import type {
    EngineeringQuestion,
    DecisionAuthorityRule,
    EvidenceContradiction,
} from "./types";

export interface EvidenceItemForDecision {
    evidenceId: string;
    sourceType:
        | "RUNTIME_TRACE"
        | "VERIFIED_SOURCE"
        | "STATIC_AST"
        | "TESTS_AND_CONTRACTS"
        | "DEPLOYMENT_CONFIG"
        | "TEMPORAL_EVIDENCE"
        | "POST_PATCH_EXECUTION"
        | "CODE_CALLERS"
        | "HISTORICAL_COMMITS"
        | "RUNTIME_METRICS";
    claimedFact: string;
    confidence: "OBSERVED" | "STATICALLY_VERIFIED" | "INFERRED" | "UNPROVEN";
    rawRef?: string;
    metadata?: Record<string, unknown>;
}

export interface DecisionReconciliationResult {
    question: EngineeringQuestion;
    factToEstablish: string;
    establishedFact: string | null;
    isDefinitivelyResolved: boolean;
    dominatingEvidenceId?: string;
    supportingEvidenceIds: string[];
    detectedContradictions: EvidenceContradiction[];
    unresolvedContradictionPreserved: boolean;
    epistemicStatus: "CONFIRMED" | "STRONGLY_SUPPORTED" | "CONTRADICTED" | "AMBIGUOUS_UNRESOLVED";
    rationale: string;
}

/**
 * Standard Decision Authority Rules for Core Engineering Decisions
 */
export const DECISION_AUTHORITY_RULES: Record<EngineeringQuestion, DecisionAuthorityRule> = {
    WHAT_ACTUALLY_EXECUTED: {
        question: "WHAT_ACTUALLY_EXECUTED",
        primaryAuthorities: ["RUNTIME_TRACE"],
        supportingAuthorities: ["RUNTIME_METRICS", "STATIC_AST", "CODE_CALLERS"],
        deterministicResolutionStrategy: "AUTHORITY_DOMINANCE",
    },
    WHAT_SOURCE_IMPLEMENTS_SYMBOL: {
        question: "WHAT_SOURCE_IMPLEMENTS_SYMBOL",
        primaryAuthorities: ["VERIFIED_SOURCE", "STATIC_AST"],
        supportingAuthorities: ["CODE_CALLERS"],
        deterministicResolutionStrategy: "AUTHORITY_DOMINANCE",
    },
    WHAT_BEHAVIOR_IS_INTENDED: {
        question: "WHAT_BEHAVIOR_IS_INTENDED",
        primaryAuthorities: ["TESTS_AND_CONTRACTS"],
        supportingAuthorities: ["CODE_CALLERS", "STATIC_AST"],
        deterministicResolutionStrategy: "CORROBORATION_REQUIRED",
    },
    WHAT_CONFIG_WAS_ACTIVE: {
        question: "WHAT_CONFIG_WAS_ACTIVE",
        primaryAuthorities: ["DEPLOYMENT_CONFIG"],
        supportingAuthorities: ["RUNTIME_TRACE"],
        deterministicResolutionStrategy: "AUTHORITY_DOMINANCE",
    },
    DID_CODE_CHANGE_CAUSE_INCIDENT: {
        question: "DID_CODE_CHANGE_CAUSE_INCIDENT",
        primaryAuthorities: ["TEMPORAL_EVIDENCE", "RUNTIME_TRACE"],
        supportingAuthorities: ["HISTORICAL_COMMITS", "STATIC_AST"],
        deterministicResolutionStrategy: "TEMPORAL_CAUSAL_VALIDATION",
    },
    DID_REPAIR_WORK: {
        question: "DID_REPAIR_WORK",
        primaryAuthorities: ["POST_PATCH_EXECUTION"],
        supportingAuthorities: ["TESTS_AND_CONTRACTS"],
        deterministicResolutionStrategy: "EMPIRICAL_EXECUTION_ONLY",
    },
};

/**
 * Reconciles evidence for a specific engineering question without global hierarchy leakage.
 */
export function reconcileEvidenceForDecision(
    question: EngineeringQuestion,
    factToEstablish: string,
    evidencePool: EvidenceItemForDecision[],
    customRule?: DecisionAuthorityRule
): DecisionReconciliationResult {
    const rule = customRule || DECISION_AUTHORITY_RULES[question];

    // Filter evidence relevant to this decision
    const relevantEvidence = evidencePool.filter((e) =>
        rule.primaryAuthorities.includes(e.sourceType as any) ||
        rule.supportingAuthorities.includes(e.sourceType as any)
    );

    if (relevantEvidence.length === 0) {
        return {
            question,
            factToEstablish,
            establishedFact: null,
            isDefinitivelyResolved: false,
            supportingEvidenceIds: [],
            detectedContradictions: [],
            unresolvedContradictionPreserved: false,
            epistemicStatus: "AMBIGUOUS_UNRESOLVED",
            rationale: `Zero evidence sources available capable of establishing '${factToEstablish}' for question ${question}.`,
        };
    }

    // Categorize into Primary vs Supporting
    const primaryItems = relevantEvidence.filter((e) =>
        rule.primaryAuthorities.includes(e.sourceType as any)
    );
    const supportingItems = relevantEvidence.filter((e) =>
        rule.supportingAuthorities.includes(e.sourceType as any)
    );

    // Contradiction detection across all items
    const detectedContradictions: EvidenceContradiction[] = [];
    const claimBuckets = new Map<string, EvidenceItemForDecision[]>();

    for (const item of relevantEvidence) {
        const normClaim = item.claimedFact.trim().toLowerCase();
        const existing = claimBuckets.get(normClaim) || [];
        existing.push(item);
        claimBuckets.set(normClaim, existing);
    }

    const distinctClaims = Array.from(claimBuckets.keys());

    // If more than one distinct claim exists, we have potential contradiction
    if (distinctClaims.length > 1) {
        const conflictingEvidence = relevantEvidence.map((e) => ({
            source: e.sourceType,
            claim: e.claimedFact,
            evidenceId: e.evidenceId,
        }));

        detectedContradictions.push({
            id: `contradiction_${question}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            question,
            conflictingEvidence,
            isResolved: false,
        });
    }

    // Apply deterministic resolution strategy based on decision authority rule
    switch (rule.deterministicResolutionStrategy) {
        case "AUTHORITY_DOMINANCE": {
            // Primary authority source strictly dominates supporting sources for this specific question
            if (primaryItems.length > 0) {
                // Check if primary items themselves contradict
                const primaryClaims = new Set(primaryItems.map((p) => p.claimedFact.trim().toLowerCase()));
                if (primaryClaims.size === 1) {
                    const dominant = primaryItems[0];
                    if (detectedContradictions.length > 0) {
                        detectedContradictions[0].isResolved = true;
                        detectedContradictions[0].dominatingEvidenceId = dominant.evidenceId;
                        detectedContradictions[0].resolutionExplanation =
                            `Resolved via authority dominance for ${question}: primary authority ${dominant.sourceType} supersedes secondary sources.`;
                    }
                    return {
                        question,
                        factToEstablish,
                        establishedFact: dominant.claimedFact,
                        isDefinitivelyResolved: true,
                        dominatingEvidenceId: dominant.evidenceId,
                        supportingEvidenceIds: primaryItems.map((p) => p.evidenceId),
                        detectedContradictions,
                        unresolvedContradictionPreserved: false,
                        epistemicStatus: "CONFIRMED",
                        rationale: `Fact established by authoritative source (${dominant.sourceType}) for question ${question}.`,
                    };
                } else {
                    // Contradiction among primary authorities themselves cannot be automatically resolved
                    return {
                        question,
                        factToEstablish,
                        establishedFact: null,
                        isDefinitivelyResolved: false,
                        supportingEvidenceIds: primaryItems.map((p) => p.evidenceId),
                        detectedContradictions,
                        unresolvedContradictionPreserved: true,
                        epistemicStatus: "CONTRADICTED",
                        rationale: `Irreconcilable contradiction among primary authorities for ${question}: ${Array.from(primaryClaims).join(" vs ")}.`,
                    };
                }
            } else {
                // Only supporting items exist; cannot be definitively confirmed without primary authority
                const supportingClaim = supportingItems[0]?.claimedFact;
                return {
                    question,
                    factToEstablish,
                    establishedFact: supportingClaim || null,
                    isDefinitivelyResolved: false,
                    supportingEvidenceIds: supportingItems.map((s) => s.evidenceId),
                    detectedContradictions,
                    unresolvedContradictionPreserved: detectedContradictions.length > 0,
                    epistemicStatus: detectedContradictions.length > 0 ? "CONTRADICTED" : "STRONGLY_SUPPORTED",
                    rationale: `Only supporting evidence available (${supportingItems.map((s) => s.sourceType).join(", ")}) for ${question}; primary authority required for confirmation.`,
                };
            }
        }

        case "CORROBORATION_REQUIRED": {
            // Requires alignment between tests, specifications, and callers
            if (distinctClaims.length === 1 && (primaryItems.length > 0 || supportingItems.length >= 2)) {
                return {
                    question,
                    factToEstablish,
                    establishedFact: relevantEvidence[0].claimedFact,
                    isDefinitivelyResolved: true,
                    dominatingEvidenceId: primaryItems[0]?.evidenceId || supportingItems[0]?.evidenceId,
                    supportingEvidenceIds: relevantEvidence.map((e) => e.evidenceId),
                    detectedContradictions: [],
                    unresolvedContradictionPreserved: false,
                    epistemicStatus: "CONFIRMED",
                    rationale: `Corroborated intent across ${relevantEvidence.map((e) => e.sourceType).join(", ")}.`,
                };
            } else {
                return {
                    question,
                    factToEstablish,
                    establishedFact: null,
                    isDefinitivelyResolved: false,
                    supportingEvidenceIds: relevantEvidence.map((e) => e.evidenceId),
                    detectedContradictions,
                    unresolvedContradictionPreserved: detectedContradictions.length > 0,
                    epistemicStatus: "AMBIGUOUS_UNRESOLVED",
                    rationale: `Intended behavior requires corroboration across contracts and callers; conflict or insufficient corroboration detected.`,
                };
            }
        }

        case "TEMPORAL_CAUSAL_VALIDATION": {
            // Requires temporal validity + execution relevance + causal evidence
            const hasTemporal = relevantEvidence.some((e) => e.sourceType === "TEMPORAL_EVIDENCE");
            const hasExecution = relevantEvidence.some((e) => e.sourceType === "RUNTIME_TRACE");
            if (hasTemporal && hasExecution && distinctClaims.length === 1) {
                return {
                    question,
                    factToEstablish,
                    establishedFact: relevantEvidence[0].claimedFact,
                    isDefinitivelyResolved: true,
                    dominatingEvidenceId: relevantEvidence[0].evidenceId,
                    supportingEvidenceIds: relevantEvidence.map((e) => e.evidenceId),
                    detectedContradictions: [],
                    unresolvedContradictionPreserved: false,
                    epistemicStatus: "CONFIRMED",
                    rationale: `Causal relationship verified with both temporal precedence and execution path relevance.`,
                };
            } else {
                return {
                    question,
                    factToEstablish,
                    establishedFact: null,
                    isDefinitivelyResolved: false,
                    supportingEvidenceIds: relevantEvidence.map((e) => e.evidenceId),
                    detectedContradictions,
                    unresolvedContradictionPreserved: detectedContradictions.length > 0,
                    epistemicStatus: "AMBIGUOUS_UNRESOLVED",
                    rationale: `Causal attribution requires both temporal validity and verified runtime execution relevance.`,
                };
            }
        }

        case "EMPIRICAL_EXECUTION_ONLY": {
            // Only post-patch execution can establish repair success
            const executionEvidence = relevantEvidence.find((e) => e.sourceType === "POST_PATCH_EXECUTION");
            if (executionEvidence && executionEvidence.confidence === "OBSERVED") {
                return {
                    question,
                    factToEstablish,
                    establishedFact: executionEvidence.claimedFact,
                    isDefinitivelyResolved: true,
                    dominatingEvidenceId: executionEvidence.evidenceId,
                    supportingEvidenceIds: [executionEvidence.evidenceId],
                    detectedContradictions: [],
                    unresolvedContradictionPreserved: false,
                    epistemicStatus: "CONFIRMED",
                    rationale: `Repair validated via physical post-patch execution on disk.`,
                };
            } else {
                return {
                    question,
                    factToEstablish,
                    establishedFact: null,
                    isDefinitivelyResolved: false,
                    supportingEvidenceIds: relevantEvidence.map((e) => e.evidenceId),
                    detectedContradictions,
                    unresolvedContradictionPreserved: false,
                    epistemicStatus: "AMBIGUOUS_UNRESOLVED",
                    rationale: `Repair cannot be proven without physical post-patch execution evidence.`,
                };
            }
        }
    }
}
