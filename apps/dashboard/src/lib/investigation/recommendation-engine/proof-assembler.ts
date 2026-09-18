/**
 * Halo Trace — Three-Tier Proof Assembler
 *
 * Implements Phase 40 Directive 10:
 * Assembles and cryptographically seals three independent forms of proof:
 *   1. DIAGNOSIS_PROOF: Proves WHY the incident occurred (epistemic tier DEFECT_CAUSED_OCCURRENCE).
 *   2. REPAIR_PROOF: Proves WHY the selected change eliminates the confirmed mechanism
 *      and restores the violated invariant (DIRECT coverage & consequence approval).
 *   3. BEHAVIORAL_PROOF: Proves the modified system ACTUALLY behaves correctly
 *      via isolated physical execution, baseline failure partitioning, and reproduction.
 *
 * VERIFIED_REPAIR requires ALL THREE proofs to be valid!
 */

import crypto from "crypto";
import type {
    DiagnosisProof,
    RepairProof,
    BehavioralProof,
    ComprehensiveProofRecord,
    CausalHypothesis,
    CandidateRepair,
    OpenRepairBoundary,
    MechanismCoverageRecord,
    ConsequenceAnalysisRecord,
    PostPatchValidationRecord,
    ReproductionRecord,
} from "./types";

export interface AssembleProofOptions {
    incidentId: string;
    hypothesis: CausalHypothesis;
    violatedInvariantStatement: string;
    candidate: CandidateRepair;
    boundary: OpenRepairBoundary;
    mechanismCoverage: MechanismCoverageRecord;
    consequenceApproval: ConsequenceAnalysisRecord;
    postPatchValidation: PostPatchValidationRecord;
    reproductionRecord: ReproductionRecord;
    executionLogExcerpt: string;
}

export function assembleComprehensiveProof(
    opts: AssembleProofOptions
): ComprehensiveProofRecord | null {
    const {
        incidentId,
        hypothesis,
        violatedInvariantStatement,
        candidate,
        boundary,
        mechanismCoverage,
        consequenceApproval,
        postPatchValidation,
        reproductionRecord,
        executionLogExcerpt,
    } = opts;

    // 1. Verify Diagnosis Proof Preconditions
    if (hypothesis.causalEstablishmentTier !== "DEFECT_CAUSED_OCCURRENCE" || hypothesis.status !== "CONFIRMED") {
        return null; // Cannot issue diagnosis proof without verified causal establishment
    }

    const diagnosisPayload = `${incidentId}:${hypothesis.mechanism}:${violatedInvariantStatement}:${hypothesis.supportingEvidenceIds.sort().join(",")}`;
    const diagnosisHash = crypto.createHash("sha256").update(diagnosisPayload).digest("hex");

    const diagnosisProof: DiagnosisProof = {
        incidentId,
        confirmedMechanism: hypothesis.mechanism,
        violatedInvariant: violatedInvariantStatement,
        causalChainEvidenceIds: hypothesis.supportingEvidenceIds,
        epistemicTier: "DEFECT_CAUSED_OCCURRENCE",
        cryptographicHash: diagnosisHash,
    };

    // 2. Verify Repair Proof Preconditions
    if (mechanismCoverage.coverageType !== "DIRECT" || !consequenceApproval.isApprovedForExecution) {
        return null; // Cannot issue repair proof without DIRECT coverage and consequence approval
    }

    const repairPayload = `${candidate.id}:${boundary.id}:${mechanismCoverage.coverageType}:${candidate.modifications.map((m) => m.filePath).sort().join(",")}`;
    const repairHash = crypto.createHash("sha256").update(repairPayload).digest("hex");

    const repairProof: RepairProof = {
        candidateId: candidate.id,
        targetBoundary: boundary,
        mechanismCoverage,
        consequenceApproval,
        architecturalReuseEvidenceIds: candidate.reusedExistingAbstractions.map((a) => a.sourcePath),
        cryptographicHash: repairHash,
    };

    // 3. Verify Behavioral Proof Preconditions
    if (!postPatchValidation.isCleanPass || postPatchValidation.patchIntroducedFailures.length > 0) {
        return null; // Cannot issue behavioral proof if regressions exist or clean pass failed
    }

    const behavioralPayload = `${candidate.id}:${postPatchValidation.isCleanPass}:${reproductionRecord.state}:${executionLogExcerpt.slice(0, 100)}`;
    const behavioralHash = crypto.createHash("sha256").update(behavioralPayload).digest("hex");

    const behavioralProof: BehavioralProof = {
        candidateId: candidate.id,
        postPatchValidation,
        reproductionRecord,
        executionLogExcerpt,
        cryptographicHash: behavioralHash,
    };

    return {
        diagnosisProof,
        repairProof,
        behavioralProof,
        verifiedAt: Date.now(),
    };
}
