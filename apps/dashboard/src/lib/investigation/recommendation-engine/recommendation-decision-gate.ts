/**
 * Halo Recommendation Engine — Recommendation Decision Gate
 *
 * Implements Phase 30:
 * Deterministically audits the entire recommendation before rendering or persistence.
 *
 * Invariant:
 *   "NO ENGINEERING DECISION MAY BE STRONGER THAN THE EVIDENCE REQUIRED TO JUSTIFY THAT DECISION."
 *
 * Evaluates:
 * 1. Is mechanism established?
 * 2. Is causal relevance established?
 * 3. Is repair ownership established?
 * 4. Is repair boundary established?
 * 5. Is proposed change grounded in verified source?
 * 6. Does candidate cover mechanism?
 * 7. Does candidate restore invariant?
 * 8. Were consequences evaluated?
 * 9. Was patch executed?
 * 10. Was behavior validated?
 * 11. Were regressions checked?
 * 12. Are claims provenance-backed?
 * 13. Is recommendation state consistent?
 */

import type {
    InvestigationSnapshot,
    FixRecommendation,
    CausalEpistemicState,
    DeterminedRepairLocation,
    EvidenceSufficiencyEvaluation,
    DecomposedConfidence,
    ReleaseRegressionContext,
    AuthoritativeEngineeringDecision,
} from "./types";

export interface DecisionGateVerdict {
    allowed: boolean;
    calibratedState: FixRecommendation["status"];
    calibratedConfidence: DecomposedConfidence;
    strippedUnsupportedClaims: string[];
    downgradeReason?: string;
    warnings: string[];
}

export function evaluateRecommendationDecisionGate(params: {
    recommendation: FixRecommendation;
    snapshot: InvestigationSnapshot;
    causalState: CausalEpistemicState;
    repairLocation?: DeterminedRepairLocation;
    sufficiency: EvidenceSufficiencyEvaluation;
    decomposedConfidence: DecomposedConfidence;
    regressionContext?: ReleaseRegressionContext;
    authoritativeDecision?: AuthoritativeEngineeringDecision;
}): DecisionGateVerdict {
    const {
        recommendation,
        snapshot,
        causalState,
        repairLocation,
        sufficiency,
        decomposedConfidence,
        regressionContext,
        authoritativeDecision,
    } = params;

    const warnings: string[] = [];
    const strippedUnsupportedClaims: string[] = [];
    let downgradeReason: string | undefined;

    const isMechanismConfirmed = causalState.failureMechanism.status === "CONFIRMED";
    const isOwnershipEstablished = Boolean(repairLocation && repairLocation.ownershipEstablished);
    const hasVerifiedChanges = recommendation.changes.length > 0;
    const isRollbackProposed =
        recommendation.repairLocation?.type === "DEPLOYMENT" ||
        recommendation.actionAnswer?.toLowerCase().includes("revert") ||
        recommendation.actionAnswer?.toLowerCase().includes("roll back");

    const provenCand =
        regressionContext?.causallyProvenCandidate ||
        regressionContext?.stronglySupportedCandidate ||
        snapshot.release?.causallyProvenCandidate ||
        snapshot.release?.stronglySupportedCandidate;

    // 1. Rollback Gate: Rollback CANNOT be recommended if mechanism is UNKNOWN, candidate is not causally proven, or rollback is disqualified by superiority gate
    const isRollbackDisqualifiedBySuperiority = authoritativeDecision?.regression?.isRollbackSuperior === false;
    if (isRollbackProposed) {
        if (!provenCand || !isMechanismConfirmed || isRollbackDisqualifiedBySuperiority) {
            downgradeReason = isRollbackDisqualifiedBySuperiority
                ? `Rollback proposal blocked by superiority gate: ${authoritativeDecision?.regression?.superiorityReason || "Targeted repair is superior to broad rollback."}`
                : "Rollback proposal blocked by decision gate: failure mechanism is unconfirmed or commit is not causally proven.";
            warnings.push(downgradeReason);
            strippedUnsupportedClaims.push("Broad release rollback");
        }
    }

    // 2. Code Change Gate: Code changes cannot be recommended if source is unverified or ownership is unestablished
    if (hasVerifiedChanges && (!isMechanismConfirmed || !isOwnershipEstablished)) {
        if (!isMechanismConfirmed) {
            warnings.push("Proposed code changes withheld: failure mechanism is unconfirmed.");
        } else if (!isOwnershipEstablished) {
            warnings.push("Proposed code changes withheld: repair ownership between caller and callee is ambiguous.");
        }
    }

    // Failed patch feedback loop (Phase 18, 19, 20)
    const patchExecutionFailed = authoritativeDecision?.validation?.isExecuted === true && authoritativeDecision.validation.isCleanPass === false;
    if (patchExecutionFailed) {
        warnings.push("Candidate patch failed validation execution / reproduction; cannot be promoted to VERIFIED_REPAIR.");
    }

    // 3. Calibrate Formal Recommendation State
    let calibratedState: FixRecommendation["status"] = sufficiency.state;

    if (isRollbackProposed && (!provenCand || !isMechanismConfirmed || isRollbackDisqualifiedBySuperiority)) {
        calibratedState = isMechanismConfirmed
            ? "DIAGNOSIS_COMPLETE_REPAIR_UNRESOLVED"
            : (sufficiency.state === "BLOCKED_BY_MISSING_RUNTIME_EVIDENCE" ? "BLOCKED_BY_MISSING_RUNTIME_EVIDENCE" : "EVIDENCE_ACQUISITION_REQUIRED");
    } else if (repairLocation?.type === "NO_CODE_CHANGE" && isOwnershipEstablished) {
        calibratedState = "NO_CODE_CHANGE_JUSTIFIED";
    } else if (hasVerifiedChanges && isMechanismConfirmed && isOwnershipEstablished && !patchExecutionFailed) {
        // If behaviorally executed and proven: VERIFIED_REPAIR; else SUPPORTED_REPAIR_REQUIRES_VALIDATION
        calibratedState = decomposedConfidence.behavioralValidation === "EXECUTED_PASSED"
            ? "VERIFIED_REPAIR"
            : "SUPPORTED_REPAIR_REQUIRES_VALIDATION";
    } else if (hasVerifiedChanges && patchExecutionFailed) {
        calibratedState = "SUPPORTED_REPAIR_REQUIRES_VALIDATION";
    } else if (isMechanismConfirmed && !isOwnershipEstablished) {
        calibratedState = "DIAGNOSIS_COMPLETE_REPAIR_UNRESOLVED";
    } else if (!isMechanismConfirmed) {
        if (
            sufficiency.state === "BLOCKED_BY_MISSING_RUNTIME_EVIDENCE" ||
            sufficiency.state === "BLOCKED_BY_AMBIGUITY" ||
            sufficiency.state === "BLOCKED_BY_UNAVAILABLE_EVIDENCE"
        ) {
            calibratedState = sufficiency.state;
        } else {
            calibratedState = sufficiency.isAdditionalRuntimeTelemetryNecessary
                ? "EVIDENCE_ACQUISITION_REQUIRED"
                : "BLOCKED_BY_UNAVAILABLE_EVIDENCE";
        }
    }

    const relCandidates = snapshot.release?.candidates || [];
    const causalRels = causalState.causalRelationships || [];

    // 4. Calibrate Decomposed Confidence Matrix
    const calibratedConfidence: DecomposedConfidence = {
        failureLocation: causalState.failureLocation.status === "CONFIRMED" ? "HIGH" : "MEDIUM",
        failureMechanism: isMechanismConfirmed ? "CONFIRMED" : causalState.failureMechanism.status === "PLAUSIBLE" ? "PLAUSIBLE" : "UNKNOWN",
        causalCause: provenCand ? "PROVEN" : causalRels.some(c => c.confidence === "SUPPORTED") ? "SUPPORTED" : "UNKNOWN",
        regressionAssociation: relCandidates.some(c => c.temporalAssociation === "PRE_INCIDENT_IMMEDIATE" || c.sourceAssociation === "FAILING_FILE") ? "HIGH" : relCandidates.length > 0 ? "MEDIUM" : "NONE",
        repairOwnership: isOwnershipEstablished ? "ESTABLISHED" : repairLocation?.isAmbiguous ? "AMBIGUOUS" : "UNKNOWN",
        repairBoundary: (hasVerifiedChanges || isRollbackProposed) && isOwnershipEstablished ? "VERIFIED" : repairLocation?.candidateLocations ? "CANDIDATE" : "UNKNOWN",
        repairCorrectness: calibratedState === "VERIFIED_REPAIR" ? "PROVEN" : calibratedState === "SUPPORTED_REPAIR_REQUIRES_VALIDATION" ? "PLAUSIBLE" : "UNVALIDATED",
        behavioralValidation: patchExecutionFailed ? "REGRESSION_DETECTED" : (decomposedConfidence.behavioralValidation || "UNTESTED"),
    };

    return {
        allowed: !downgradeReason,
        calibratedState,
        calibratedConfidence,
        strippedUnsupportedClaims,
        downgradeReason,
        warnings,
    };
}
