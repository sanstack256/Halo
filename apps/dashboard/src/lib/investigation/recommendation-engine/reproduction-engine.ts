/**
 * Halo Trace — Reproduction Engine
 *
 * Implements Phase 40 Directive 5:
 * Manages reproduction as a first-class empirical investigation state:
 *   - REPRODUCED
 *   - NOT_REPRODUCED
 *   - PARTIALLY_REPRODUCED
 *   - UNREPRODUCIBLE_ENVIRONMENT
 *   - REPRODUCTION_CONTRADICTS_HYPOTHESIS
 *
 * Invariant: A failed reproduction MUST NOT automatically eliminate a production hypothesis.
 * Strictly distinguishes:
 *   "the bug does not reproduce" (NOT_REPRODUCED)
 * from:
 *   "the local environment cannot reproduce it" (UNREPRODUCIBLE_ENVIRONMENT).
 * When reproduction contradicts a hypothesis, the result is fed back into condition evaluation.
 */

import type {
    ReproductionState,
    ReproductionRecord,
    CausalHypothesis,
} from "./types";
import { evaluateHypothesisConditionGraph } from "./hypothesis-engine";
import type { EvidenceItemForDecision } from "./evidence-reconciliation";

export interface ExecuteReproductionParams {
    repositoryRevision: string;
    runtimeVersion: string;
    environmentRequirements: string[];
    environmentAvailable: boolean;
    missingEnvironmentDetails?: string;
    executionCommand: string;
    inputPayloadOrArgs: Record<string, unknown>;
    expectedErrorType?: string;
    expectedErrorMessage?: string;
    actualExecution?: {
        exitCode: number;
        stdout: string;
        stderr: string;
        thrownErrorType?: string;
        thrownErrorMessage?: string;
    };
    targetHypothesis?: CausalHypothesis;
    evidencePool?: EvidenceItemForDecision[];
}

export interface ReproductionEngineResult {
    record: ReproductionRecord;
    updatedHypothesis?: CausalHypothesis;
    updatedEvidencePool?: EvidenceItemForDecision[];
}

export function evaluateReproductionAttempt(
    params: ExecuteReproductionParams
): ReproductionEngineResult {
    const {
        repositoryRevision,
        runtimeVersion,
        environmentRequirements,
        environmentAvailable,
        missingEnvironmentDetails,
        executionCommand,
        inputPayloadOrArgs,
        expectedErrorType,
        expectedErrorMessage,
        actualExecution,
        targetHypothesis,
        evidencePool = [],
    } = params;

    let state: ReproductionState = "NOT_REPRODUCED";
    let hypothesisImpactRationale = "";

    // 1. Check if environment cannot execute
    if (!environmentAvailable) {
        state = "UNREPRODUCIBLE_ENVIRONMENT";
        hypothesisImpactRationale = `Local environment lacks prerequisites (${missingEnvironmentDetails || "missing external service/env"}); production hypothesis remains plausible.`;

        const record: ReproductionRecord = {
            id: `repro_${Date.now()}`,
            state,
            repositoryRevision,
            runtimeVersion,
            environmentRequirements,
            inputPayloadOrArgs,
            executionCommand,
            observedResult: missingEnvironmentDetails || "Environment unavailable",
            expectedResult: expectedErrorType || "Reproduced failure",
            exitCode: -1,
            stdout: "",
            stderr: missingEnvironmentDetails || "Environment prerequisite check failed",
            evidenceReferences: [],
            hypothesisImpactRationale,
        };

        return { record };
    }

    if (!actualExecution) {
        state = "NOT_REPRODUCED";
        hypothesisImpactRationale = "No execution performed.";
        const record: ReproductionRecord = {
            id: `repro_${Date.now()}`,
            state,
            repositoryRevision,
            runtimeVersion,
            environmentRequirements,
            inputPayloadOrArgs,
            executionCommand,
            observedResult: "No execution result",
            expectedResult: expectedErrorType || "Failure",
            exitCode: 1,
            stdout: "",
            stderr: "",
            evidenceReferences: [],
            hypothesisImpactRationale,
        };
        return { record };
    }

    const { exitCode, stdout, stderr, thrownErrorType, thrownErrorMessage } = actualExecution;

    // 2. Classify execution result
    const hasThrownError = exitCode !== 0 || thrownErrorType || thrownErrorMessage;
    const matchesExpected = Boolean(
        expectedErrorType &&
        thrownErrorType &&
        (thrownErrorType.toLowerCase().includes(expectedErrorType.toLowerCase()) ||
         expectedErrorType.toLowerCase().includes(thrownErrorType.toLowerCase()))
    );

    if (hasThrownError && matchesExpected) {
        state = "REPRODUCED";
        hypothesisImpactRationale = `Failure reproduced identically with error '${thrownErrorType}: ${thrownErrorMessage}'.`;
    } else if (hasThrownError && !matchesExpected) {
        state = "PARTIALLY_REPRODUCED";
        hypothesisImpactRationale = `Execution failed, but observed error '${thrownErrorType}' differs from expected '${expectedErrorType}'.`;
    } else if (!hasThrownError) {
        // Did not fail at all
        if (targetHypothesis) {
            state = "REPRODUCTION_CONTRADICTS_HYPOTHESIS";
            hypothesisImpactRationale = `Reproduction test executed hypothesized failure path successfully without error; refutes hypothesis '${targetHypothesis.mechanism}'.`;
        } else {
            state = "NOT_REPRODUCED";
            hypothesisImpactRationale = "Execution completed with exit code 0; failure did not manifest under tested conditions.";
        }
    }

    const record: ReproductionRecord = {
        id: `repro_${Date.now()}`,
        state,
        repositoryRevision,
        runtimeVersion,
        environmentRequirements,
        inputPayloadOrArgs,
        executionCommand,
        observedResult: thrownErrorType ? `${thrownErrorType}: ${thrownErrorMessage}` : `Exit code ${exitCode}`,
        expectedResult: expectedErrorType || "Expected failure",
        exitCode,
        stdout,
        stderr,
        evidenceReferences: [`repro_run_${Date.now()}`],
        hypothesisImpactRationale,
    };

    // Feed back into hypothesis evaluation if applicable
    let updatedHypothesis = targetHypothesis;
    const updatedEvidencePool = [...evidencePool];

    if (targetHypothesis) {
        if (state === "REPRODUCTION_CONTRADICTS_HYPOTHESIS") {
            const contradictionEvidence: EvidenceItemForDecision = {
                evidenceId: `ev_repro_contradiction_${Date.now()}`,
                sourceType: "POST_PATCH_EXECUTION",
                claimedFact: `Hypothesis path executed successfully without triggering ${expectedErrorType || "failure"}`,
                confidence: "OBSERVED",
            };
            updatedEvidencePool.push(contradictionEvidence);

            updatedHypothesis = evaluateHypothesisConditionGraph({
                hypothesis: targetHypothesis,
                evidencePool: updatedEvidencePool,
                hasRuntimeTraceParticipation: false,
                hasTemporalPrecedence: true,
                reproductionConfirmedNecessity: false,
            });
        } else if (state === "REPRODUCED") {
            const confirmationEvidence: EvidenceItemForDecision = {
                evidenceId: `ev_repro_confirmed_${Date.now()}`,
                sourceType: "POST_PATCH_EXECUTION",
                claimedFact: `Failure confirmed reproducible under identical parameters`,
                confidence: "OBSERVED",
            };
            updatedEvidencePool.push(confirmationEvidence);

            updatedHypothesis = evaluateHypothesisConditionGraph({
                hypothesis: targetHypothesis,
                evidencePool: updatedEvidencePool,
                hasRuntimeTraceParticipation: true,
                hasTemporalPrecedence: true,
                reproductionConfirmedNecessity: true,
            });
        }
    }

    return {
        record,
        updatedHypothesis,
        updatedEvidencePool,
    };
}
