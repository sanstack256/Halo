/**
 * Halo Trace — Hypothesis Condition Graph Engine
 *
 * Implements Phase 40 Directive 2:
 * Evaluates causal hypotheses as formal condition graphs.
 * Enforces the strict separation:
 *   DEFECT_EXISTS
 *     != DEFECT_CAN_PRODUCE_FAILURE
 *     != DEFECT_PARTICIPATED_IN_OCCURRENCE
 *     != DEFECT_CAUSED_OCCURRENCE
 *
 * A static defect found in AST NEVER automatically confirms an incident cause.
 * A hypothesis is CONFIRMED only when all necessary conditions are CONFIRMED
 * and causal participation is empirically established.
 */

import type {
    CausalHypothesis,
    HypothesisCondition,
    ConditionStatus,
    CausalEstablishmentTier,
    EngineeringQuestion,
} from "./types";
import { reconcileEvidenceForDecision, type EvidenceItemForDecision } from "./evidence-reconciliation";

export interface EvaluateConditionsOptions {
    hypothesis: CausalHypothesis;
    evidencePool: EvidenceItemForDecision[];
    hasRuntimeTraceParticipation: boolean;
    hasTemporalPrecedence: boolean;
    reproductionConfirmedNecessity?: boolean;
}

function inferEngineeringQuestionForFact(fact: string): EngineeringQuestion {
    const lower = fact.toLowerCase();
    if (
        lower.includes("finally") ||
        lower.includes("ast") ||
        lower.includes("source") ||
        lower.includes("symbol") ||
        lower.includes("class") ||
        lower.includes("method") ||
        lower.includes("implement") ||
        lower.includes("parameter") ||
        lower.includes("block")
    ) {
        return "WHAT_SOURCE_IMPLEMENTS_SYMBOL";
    }
    if (lower.includes("contract") || lower.includes("intended") || lower.includes("spec") || lower.includes("expected")) {
        return "WHAT_BEHAVIOR_IS_INTENDED";
    }
    if (lower.includes("config") || lower.includes("environment") || lower.includes("deployment")) {
        return "WHAT_CONFIG_WAS_ACTIVE";
    }
    if (lower.includes("caused") || lower.includes("commit") || lower.includes("regression")) {
        return "DID_CODE_CHANGE_CAUSE_INCIDENT";
    }
    if (lower.includes("repair") || lower.includes("patch") || lower.includes("post-patch")) {
        return "DID_REPAIR_WORK";
    }
    return "WHAT_ACTUALLY_EXECUTED";
}

export function evaluateHypothesisConditionGraph(
    opts: EvaluateConditionsOptions
): CausalHypothesis {
    const { hypothesis, evidencePool, hasRuntimeTraceParticipation, hasTemporalPrecedence, reproductionConfirmedNecessity } = opts;

    const evaluatedConditions: HypothesisCondition[] = [];
    const supportingIds: string[] = [];
    const contradictingIds: string[] = [];
    const missingDescriptions: string[] = [];

    let hasAnyContradicted = false;
    let allNecessaryConfirmed = true;

    for (const condition of hypothesis.conditions) {
        // Find evidence matching this condition's required fact
        const matchingEvidence = evidencePool.filter((e) =>
            e.claimedFact.toLowerCase().includes(condition.requiredFact.toLowerCase()) ||
            condition.requiredFact.toLowerCase().includes(e.claimedFact.toLowerCase())
        );

        if (matchingEvidence.length === 0) {
            evaluatedConditions.push({
                ...condition,
                status: "UNKNOWN",
                attachedEvidenceIds: [],
                contradictingEvidenceIds: [],
                evaluationRationale: `No evidence currently available for required fact: '${condition.requiredFact}'.`,
            });
            allNecessaryConfirmed = false;
            missingDescriptions.push(condition.requiredFact);
            continue;
        }

        // Reconcile evidence for this specific condition using the decision-specific authority
        const question = inferEngineeringQuestionForFact(condition.requiredFact);
        const recon = reconcileEvidenceForDecision(
            question,
            condition.requiredFact,
            matchingEvidence
        );

        let status: ConditionStatus = "UNKNOWN";
        if (recon.epistemicStatus === "CONFIRMED") {
            status = "CONFIRMED";
            supportingIds.push(...recon.supportingEvidenceIds);
        } else if (recon.epistemicStatus === "CONTRADICTED") {
            status = "CONTRADICTED";
            hasAnyContradicted = true;
            contradictingIds.push(...recon.supportingEvidenceIds);
        } else if (recon.epistemicStatus === "STRONGLY_SUPPORTED") {
            status = "SUPPORTED";
            supportingIds.push(...recon.supportingEvidenceIds);
            allNecessaryConfirmed = false;
        } else {
            status = "UNKNOWN";
            allNecessaryConfirmed = false;
            missingDescriptions.push(condition.requiredFact);
        }

        evaluatedConditions.push({
            ...condition,
            status,
            attachedEvidenceIds: recon.supportingEvidenceIds,
            contradictingEvidenceIds: recon.detectedContradictions.flatMap((c) => c.conflictingEvidence.map((e) => e.evidenceId)),
            evaluationRationale: recon.rationale,
        });
    }

    // Determine the causal tier based on physical evidence
    let causalTier: CausalEstablishmentTier = "DEFECT_EXISTS";

    if (hasAnyContradicted) {
        return {
            ...hypothesis,
            causalEstablishmentTier: "DEFECT_EXISTS",
            conditions: evaluatedConditions,
            supportingEvidenceIds: supportingIds,
            contradictingEvidenceIds: contradictingIds,
            missingEvidenceDescriptions: missingDescriptions,
            status: "CONTRADICTED",
        };
    }

    // 1. Can it produce the failure? (Mechanism fits error classification)
    const canProduce = evaluatedConditions.some((c) => c.status === "CONFIRMED" || c.status === "SUPPORTED");
    if (canProduce) {
        causalTier = "DEFECT_CAN_PRODUCE_FAILURE";
    }

    // 2. Did it participate in this occurrence? (Runtime trace demonstrates execution through defect site)
    if (canProduce && hasRuntimeTraceParticipation) {
        causalTier = "DEFECT_PARTICIPATED_IN_OCCURRENCE";
    }

    // 3. Did it cause this occurrence? (Temporal validity + execution relevance + reproduction/counterfactual proof)
    if (causalTier === "DEFECT_PARTICIPATED_IN_OCCURRENCE" && hasTemporalPrecedence && (allNecessaryConfirmed || reproductionConfirmedNecessity)) {
        causalTier = "DEFECT_CAUSED_OCCURRENCE";
    }

    // Determine final status
    let status: CausalHypothesis["status"] = "PLAUSIBLE";
    if (causalTier === "DEFECT_CAUSED_OCCURRENCE" && allNecessaryConfirmed) {
        status = "CONFIRMED";
    } else if (causalTier === "DEFECT_PARTICIPATED_IN_OCCURRENCE" || allNecessaryConfirmed) {
        status = "STRONGLY_SUPPORTED";
    } else if (missingDescriptions.length > evaluatedConditions.length / 2) {
        status = "UNKNOWN";
    }

    return {
        ...hypothesis,
        causalEstablishmentTier: causalTier,
        conditions: evaluatedConditions,
        supportingEvidenceIds: Array.from(new Set(supportingIds)),
        contradictingEvidenceIds: Array.from(new Set(contradictingIds)),
        missingEvidenceDescriptions: missingDescriptions,
        status,
    };
}
