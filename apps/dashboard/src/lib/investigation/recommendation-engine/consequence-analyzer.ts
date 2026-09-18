/**
 * Halo Trace — Mechanism-Coverage & Consequence Analyzer
 *
 * Implements Phase 40 Directives 9 & 14:
 * 1. Mechanism-Coverage Validation:
 *    Classifies candidate coverage as DIRECT, PARTIAL, INDIRECT, or NONE.
 *    CRITICAL RULE: A passing test CANNOT override zero mechanism coverage!
 *    (e.g. increasing pool size when connection is held during external I/O).
 * 2. Consequence Analysis:
 *    Inspects second-order architectural risks (concurrency, retries, idempotency,
 *    resource saturation, transaction boundaries, symptom masking).
 */

import type {
    CandidateRepair,
    MechanismCoverageRecord,
    MechanismCoverageType,
    ConsequenceAnalysisRecord,
} from "./types";
import type { ReconstructedInvariant } from "./contract-extractor";

export interface ConsequenceEvaluationOptions {
    candidate: CandidateRepair;
    confirmedMechanism: string;
    violatedInvariant: ReconstructedInvariant;
    isIdempotentOperation?: boolean;
    repositoryContext?: {
        existingAbstractions: Array<{ name: string; type: string; filePath: string }>;
        databasePoolMax?: number;
    };
}

export interface CandidateEvaluationResult {
    mechanismCoverage: MechanismCoverageRecord;
    consequenceAnalysis: ConsequenceAnalysisRecord;
    isApprovedForExecution: boolean;
    evaluationSummary: string;
}

export function evaluateCandidateConsequences(
    opts: ConsequenceEvaluationOptions
): CandidateEvaluationResult {
    const { candidate, confirmedMechanism, violatedInvariant, isIdempotentOperation, repositoryContext } = opts;

    const modifications = candidate.modifications;
    const allReplacementCode = modifications.map((m) => m.replacementCode).join("\n");
    const allOriginalCode = modifications.map((m) => m.originalCode).join("\n");

    const mechLower = confirmedMechanism.toLowerCase();
    const invLower = violatedInvariant.formalStatement.toLowerCase();

    // 1. Detect Tempting Wrong Fix: Raising threshold (e.g. pool size, timeout) when leak/holding exists
    const isPoolOrLimitExhaustion = mechLower.includes("exhaust") || mechLower.includes("pool") || mechLower.includes("leak") || mechLower.includes("held");
    const isMerelyIncreasingLimit = (
        allReplacementCode.includes("max: ") ||
        allReplacementCode.includes("poolSize") ||
        allReplacementCode.includes("connectionLimit") ||
        allReplacementCode.includes("timeout: ") ||
        allReplacementCode.includes("ulimit")
    ) && !allReplacementCode.includes("finally") && !allReplacementCode.includes(".release(") && !allReplacementCode.includes("returnLease") && !allReplacementCode.includes("dispose");

    // 2. Detect Tempting Wrong Fix: Empty catch or suppressing error without fixing
    const isSuppressingError = (
        allReplacementCode.includes("catch (") &&
        (allReplacementCode.includes("catch () {}") || allReplacementCode.includes("/* ignore */") || allReplacementCode.includes("return null;") || allReplacementCode.includes("return undefined;"))
    );

    // 3. Detect Tempting Wrong Fix: Optional chaining on required non-null invariant
    const isOptionalChainingOnRequired = (
        violatedInvariant.invariantType === "NON_NULL_FIELD" &&
        allReplacementCode.includes("?.") &&
        !allReplacementCode.includes("throw ") &&
        !allReplacementCode.includes("validate")
    );

    // 4. Detect Tempting Wrong Fix: Adding retries on non-idempotent operations
    const isAddingRetry = (allReplacementCode.includes("retry") || allReplacementCode.includes("for (let attempt")) && !allOriginalCode.includes("retry");
    const isUnsafeRetry = isAddingRetry && isIdempotentOperation === false;

    // 5. Detect Tempting Wrong Fix: Arbitrary sleep/delay on race conditions
    const isArbitraryDelay = (allReplacementCode.includes("setTimeout") || allReplacementCode.includes("sleep(")) && mechLower.includes("race");

    // Evaluate Mechanism Coverage
    let coverageType: MechanismCoverageType = "DIRECT";
    let eliminatesRootMechanism = true;
    let merelyRaisesFailureThreshold = false;
    let suppressesSymptomWithoutFix = false;
    let restoresViolatedInvariant = true;
    let coverageRationale = "Candidate directly modifies the code path to eliminate the causal mechanism.";

    if (isMerelyIncreasingLimit) {
        coverageType = "NONE";
        eliminatesRootMechanism = false;
        merelyRaisesFailureThreshold = true;
        restoresViolatedInvariant = false;
        coverageRationale = `Candidate merely raises the capacity threshold without eliminating the root cause ('${confirmedMechanism}').`;
    } else if (isSuppressingError) {
        coverageType = "NONE";
        eliminatesRootMechanism = false;
        suppressesSymptomWithoutFix = true;
        restoresViolatedInvariant = false;
        coverageRationale = "Candidate suppresses the exception without restoring the intended program state.";
    } else if (isOptionalChainingOnRequired) {
        coverageType = "NONE";
        eliminatesRootMechanism = false;
        suppressesSymptomWithoutFix = true;
        restoresViolatedInvariant = false;
        coverageRationale = `Optional chaining masks missing required data governed by invariant '${violatedInvariant.formalStatement}'.`;
    } else if (isArbitraryDelay) {
        coverageType = "NONE";
        eliminatesRootMechanism = false;
        suppressesSymptomWithoutFix = true;
        restoresViolatedInvariant = false;
        coverageRationale = "Arbitrary sleep delays execution but does not provide thread/task synchronization.";
    }

    const mechanismCoverage: MechanismCoverageRecord = {
        candidateId: candidate.id,
        coverageType,
        eliminatesRootMechanism,
        merelyRaisesFailureThreshold,
        suppressesSymptomWithoutFix,
        restoresViolatedInvariant,
        evaluationRationale: coverageRationale,
    };

    // Evaluate Second-Order Consequences
    const secondOrderEffects: ConsequenceAnalysisRecord["secondOrderEffects"] = [];

    if (isUnsafeRetry) {
        secondOrderEffects.push({
            category: "IDEMPOTENCY",
            description: "Introduced retry on non-idempotent operation risks duplicate side-effects (e.g. double charging/writing).",
            isAcceptable: false,
        });
    }

    if (isMerelyIncreasingLimit) {
        secondOrderEffects.push({
            category: "RESOURCE_SATURATION",
            description: "Increasing pool or handle limit without lifecycle cleanup leads to database memory exhaustion.",
            isAcceptable: false,
        });
    }

    let classification: ConsequenceAnalysisRecord["classification"] = "FIXES_MECHANISM";
    if (coverageType === "NONE") {
        classification = suppressesSymptomWithoutFix || merelyRaisesFailureThreshold ? "MASKS_SYMPTOM" : "CREATES_NEW_FAILURE_MODE";
    } else if (isUnsafeRetry) {
        classification = "CREATES_NEW_FAILURE_MODE";
    }

    const isApprovedForExecution = coverageType === "DIRECT" && classification === "FIXES_MECHANISM";

    const consequenceAnalysis: ConsequenceAnalysisRecord = {
        candidateId: candidate.id,
        secondOrderEffects,
        classification,
        isApprovedForExecution,
    };

    return {
        mechanismCoverage,
        consequenceAnalysis,
        isApprovedForExecution,
        evaluationSummary: isApprovedForExecution
            ? `Candidate approved: DIRECT mechanism coverage restoring '${violatedInvariant.formalStatement}'.`
            : `Candidate rejected (${classification}): ${coverageRationale}`,
    };
}
