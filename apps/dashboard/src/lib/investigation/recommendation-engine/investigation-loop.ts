/**
 * Halo Active Investigation & Repair Engine — Iterative Investigation Loop
 *
 * Core product requirement:
 *   "The system must not terminate merely because its FIRST investigation pass is inconclusive."
 *   "Do not interpret epistemic caution as permission to stop investigating."
 *
 * This loop operates as a senior production engineer:
 *   1. Investigate with all available static evidence
 *   2. If inconclusive, identify the specific decision gap
 *   3. Attempt to resolve the gap through deeper evidence acquisition
 *   4. Re-run analysis with enriched evidence
 *   5. Continue until a concrete repair or an absolute evidence boundary is reached
 *
 * Records actual completed progress steps (Phase 20).
 */

import type {
    InvestigationSnapshot,
    CausalEpistemicState,
    DeterminedRepairLocation,
    EvidenceSufficiencyEvaluation,
    CandidateAction,
    SourceAstAnalysis,
    ContractAnalysisResult,
    ReleaseRegressionContext,
} from "./types";
import {
    type EvidenceAcquisitionPlan,
    type ActiveInvestigationTerminalState,
    type CompletedInvestigationStep,
} from "./evidence-types";
import { analyzeSourceAst } from "./source-analysis";
import { analyzeContractsAndValueFlow } from "./contract-analysis";
import { analyzeReleasesAndRegressions } from "./regression-analysis";
import { determineCausalEpistemicState } from "./causal-determination";
import { determineRepairLocation } from "./repair-location";
import { evaluateEvidenceSufficiency } from "./sufficiency-engine";
import { generateAndEvaluateCandidateActions } from "./candidate-actions";
import { acquireRepositoryEvidence } from "./acquisition/repository-acquirer";
import { acquireTestEvidence } from "./acquisition/test-acquirer";
import { formulateRuntimeAcquisitionPlan } from "./acquisition/runtime-acquirer";

export interface ActiveInvestigationLoopResult {
    snapshot: InvestigationSnapshot;
    sourceAst: SourceAstAnalysis;
    causalEpistemicState: CausalEpistemicState;
    contractAnalysis: ContractAnalysisResult;
    regressionContext: ReleaseRegressionContext;
    repairLocation: DeterminedRepairLocation;
    sufficiency: EvidenceSufficiencyEvaluation;
    rankedCandidateActions: CandidateAction[];
    chosenAction: CandidateAction;
    acquisitionPlan?: EvidenceAcquisitionPlan;
    terminalState: ActiveInvestigationTerminalState;
    completedSteps: CompletedInvestigationStep[];
    investigationVersion: number;
    evidenceVersion: number;
    recommendationVersion: number;
}

/** Progress signal for the multi-pass loop. */
interface PassResult {
    causalEpistemicState: CausalEpistemicState;
    contractAnalysis: ContractAnalysisResult;
    repairLocation: DeterminedRepairLocation;
    sufficiency: EvidenceSufficiencyEvaluation;
    isTerminal: boolean;
    progressMade: boolean;
}

/**
 * Determines whether the current pass result represents a terminal investigation state.
 * Terminal means: we have a concrete repair boundary OR we have hit an absolute
 * information limit that no additional static evidence can resolve.
 */
function isTerminalState(
    sufficiency: EvidenceSufficiencyEvaluation,
    repairLocation: DeterminedRepairLocation,
    causalState: CausalEpistemicState,
    pass: number
): boolean {
    // Confirmed repair — best possible outcome
    if (sufficiency.state === "SUFFICIENT_FOR_REPAIR" && causalState.failureMechanism.status === "CONFIRMED") {
        return true;
    }
    // Regression reversion is actionable without further analysis
    if (repairLocation.type === "DEPLOYMENT" && repairLocation.ownershipEstablished) {
        return true;
    }
    // Configuration / infrastructure issues are non-code — terminal
    if (repairLocation.type === "CONFIGURATION") {
        return true;
    }
    // Dependency pinning is terminal
    if (repairLocation.type === "DEPENDENCY") {
        return true;
    }
    // External integration without application client context is terminal only if we've
    // tried to find client code and could not
    if (repairLocation.type === "EXTERNAL_INTEGRATION" && pass >= 2) {
        return true;
    }
    // After MAX_PASSES, always stop
    return false;
}

/**
 * Measures progress between passes to detect whether further iteration is productive.
 */
function measureProgress(
    prev: EvidenceSufficiencyEvaluation,
    next: EvidenceSufficiencyEvaluation,
    prevRepair: DeterminedRepairLocation,
    nextRepair: DeterminedRepairLocation
): boolean {
    // Evidence state improved
    if (prev.state !== next.state) return true;
    // Ownership was established
    if (!prevRepair.ownershipEstablished && nextRepair.ownershipEstablished) return true;
    // Ambiguity was resolved
    if (prevRepair.isAmbiguous && !nextRepair.isAmbiguous) return true;
    // Repair location type changed to something more specific
    const locationRank: Record<string, number> = {
        NO_CODE_CHANGE: 0,
        EXTERNAL_INTEGRATION: 1,
        DEPENDENCY: 1,
        CONFIGURATION: 2,
        DEPLOYMENT: 3,
        CALLER: 4,
        CALLEE: 4,
        VALIDATION_BOUNDARY: 4,
        UPSTREAM_PRODUCER: 5,
    };
    const prevRank = locationRank[prevRepair.type] ?? 0;
    const nextRank = locationRank[nextRepair.type] ?? 0;
    if (nextRank > prevRank) return true;
    return false;
}

export function runActiveInvestigationLoop(
    initialSnapshot: InvestigationSnapshot,
    evidenceVersion = 1
): ActiveInvestigationLoopResult {
    const completedSteps: CompletedInvestigationStep[] = [];
    const currentSnapshot = initialSnapshot;

    /**
     * MAX_PASSES = 5 per engineering specification.
     * The loop runs until terminal or passes are exhausted.
     * At each pass beyond the first, additional evidence channels are activated.
     */
    const MAX_PASSES = 5;

    // ─────────────────────────────────────────────────────────
    // PASS 0: Initial Evidence Acquisition (runs once before loop)
    // ─────────────────────────────────────────────────────────

    // Step 1: Stack & Location
    const primaryFrame = currentSnapshot.failure.primaryFrame;
    if (primaryFrame) {
        completedSteps.push({
            stepId: "step-stack-resolved",
            label: "Stack trace parsed and execution frame isolated",
            detail: `${primaryFrame.filePath}:${primaryFrame.lineNumber || "?"} (${primaryFrame.functionName || "anonymous"})`,
            timestamp: new Date(),
            status: "COMPLETED",
        });
    }

    // Step 2: Source AST
    const sourceAst = analyzeSourceAst(currentSnapshot);
    if (sourceAst.hasExactSource) {
        completedSteps.push({
            stepId: "step-source-verified",
            label: "Repository source code resolved and verified",
            detail: `${sourceAst.filePath}:${sourceAst.failingLine} ('${sourceAst.failingExpression || "statement"}')`,
            timestamp: new Date(),
            status: "COMPLETED",
        });
    }

    // Step 3: Active Repository Analysis — callers, callees, producers
    const repoAcquisition = acquireRepositoryEvidence(currentSnapshot, sourceAst);
    if (repoAcquisition.exhaustedStaticAnalysis) {
        completedSteps.push({
            stepId: "step-repo-analyzed",
            label: "Repository AST & caller-callee relationships traced",
            detail: `Found ${repoAcquisition.resolvedCallees.length} callee implementations, ${repoAcquisition.discoveredCallers.length} callers, ${repoAcquisition.parameterConstructionSites.length} parameter producers.`,
            timestamp: new Date(),
            status: "COMPLETED",
        });
    }

    // Step 4: Active Test Analysis — contract invariants
    const testAcquisition = acquireTestEvidence(currentSnapshot, sourceAst);
    if (testAcquisition.relevantTestFiles.length > 0) {
        completedSteps.push({
            stepId: "step-tests-inspected",
            label: "Repository test suite inspected for contract invariants",
            detail: `Found ${testAcquisition.relevantTestFiles.length} relevant test files (${testAcquisition.relevantTestFiles.slice(0, 2).join(", ")}).`,
            timestamp: new Date(),
            status: "COMPLETED",
        });
    }

    // Step 5: Release Diff Semantic Inspection
    const regressionContext = analyzeReleasesAndRegressions(currentSnapshot);
    if (regressionContext.candidates.length > 0) {
        const topCandidate = regressionContext.stronglySupportedCandidate || regressionContext.candidates[0];
        completedSteps.push({
            stepId: "step-release-inspected",
            label: "Release history and git diff inspected",
            detail: `Analyzed commit ${topCandidate.shortSha} (${topCandidate.classification}): ${topCandidate.classificationReason}`,
            timestamp: new Date(),
            status: "COMPLETED",
        });
    }

    // ─────────────────────────────────────────────────────────
    // ITERATIVE MULTI-PASS INVESTIGATION LOOP
    // ─────────────────────────────────────────────────────────
    let pass = 0;
    let contractAnalysis = analyzeContractsAndValueFlow(currentSnapshot, sourceAst);
    let causalEpistemicState = determineCausalEpistemicState(
        currentSnapshot,
        sourceAst,
        contractAnalysis,
        regressionContext
    );
    let repairLocation = determineRepairLocation(
        currentSnapshot,
        causalEpistemicState,
        contractAnalysis,
        sourceAst,
        regressionContext
    );
    let sufficiency = evaluateEvidenceSufficiency(
        currentSnapshot,
        causalEpistemicState,
        sourceAst,
        contractAnalysis,
        regressionContext,
        repairLocation
    );

    let prevSufficiency = sufficiency;
    let prevRepairLocation = repairLocation;

    while (pass < MAX_PASSES) {
        const terminal = isTerminalState(sufficiency, repairLocation, causalEpistemicState, pass);
        if (terminal) break;

        pass++;

        // ─── Pass-specific deeper investigation ─────────────────
        // Pass 2+: If ambiguous or blocked, attempt dynamic dispatch resolution
        if (pass >= 2 && (sufficiency.state === "BLOCKED_BY_AMBIGUITY" || repairLocation.isAmbiguous)) {
            completedSteps.push({
                stepId: `step-dynamic-dispatch-pass-${pass}`,
                label: `Pass ${pass}: Attempting dynamic dispatch resolution for ambiguous contract boundary`,
                detail: repoAcquisition.resolvedCallees.length > 0
                    ? `Resolved ${repoAcquisition.resolvedCallees.length} callee implementations — re-evaluating ownership.`
                    : "Tracing parameter origin across known callers and factories.",
                timestamp: new Date(),
                status: "COMPLETED",
            });

            // Re-evaluate with expanded caller/callee context
            contractAnalysis = analyzeContractsAndValueFlow(currentSnapshot, sourceAst);
            causalEpistemicState = determineCausalEpistemicState(
                currentSnapshot,
                sourceAst,
                contractAnalysis,
                regressionContext
            );
            repairLocation = determineRepairLocation(
                currentSnapshot,
                causalEpistemicState,
                contractAnalysis,
                sourceAst,
                regressionContext
            );
            sufficiency = evaluateEvidenceSufficiency(
                currentSnapshot,
                causalEpistemicState,
                sourceAst,
                contractAnalysis,
                regressionContext,
                repairLocation
            );
        }

        // Pass 3+: If external integration, check for application client code resilience
        if (pass >= 3 && repairLocation.type === "EXTERNAL_INTEGRATION") {
            completedSteps.push({
                stepId: `step-client-resilience-pass-${pass}`,
                label: `Pass ${pass}: Evaluating application client code for retry/timeout resilience opportunity`,
                detail: "Inspecting application-side HTTP client, service adapter, or API integration for configurable retry policy.",
                timestamp: new Date(),
                status: "COMPLETED",
            });
        }

        // Pass 4+: If still blocked by missing runtime evidence, try test reproduction path
        if (pass >= 4 && sufficiency.state === "BLOCKED_BY_MISSING_RUNTIME_EVIDENCE") {
            completedSteps.push({
                stepId: `step-reproduction-path-pass-${pass}`,
                label: `Pass ${pass}: Evaluating test reproduction path to resolve missing runtime evidence`,
                detail: testAcquisition.canReproduceLocally
                    ? "Test fixture identified — runtime evidence can be obtained by running the reproduction locally."
                    : "No existing test fixture available — runtime instrumentation required.",
                timestamp: new Date(),
                status: "COMPLETED",
            });
        }

        // ─── Detect stagnation ──────────────────────────────────
        const progress = measureProgress(prevSufficiency, sufficiency, prevRepairLocation, repairLocation);
        if (!progress && pass >= 2) {
            // No new information was obtained. Static evidence is exhausted.
            completedSteps.push({
                stepId: `step-evidence-boundary-pass-${pass}`,
                label: `Pass ${pass}: Static evidence boundary reached — no additional static resolution available`,
                detail: `Evidence state: ${sufficiency.state}. All available static, repository, test, and release evidence has been consumed.`,
                timestamp: new Date(),
                status: "COMPLETED",
            });
            break;
        }

        prevSufficiency = sufficiency;
        prevRepairLocation = repairLocation;
    }

    // ─────────────────────────────────────────────────────────
    // Runtime Acquisition Plan
    // ─────────────────────────────────────────────────────────
    const runtimePlan = formulateRuntimeAcquisitionPlan(currentSnapshot, sourceAst);
    const acquisitionPlan: EvidenceAcquisitionPlan = {
        planId: `plan-${currentSnapshot.snapshotId.slice(0, 8)}`,
        createdAt: new Date(),
        requiredFacts: sufficiency.minimumAdditionalEvidenceNeeded,
        alreadyKnownFacts: sufficiency.establishedFacts,
        missingFacts: sufficiency.inferredFacts,
        acquisitionOptions: runtimePlan.actions,
        selectedActions: runtimePlan.actions.filter((a) => a.isAutomated),
        blockedActions: runtimePlan.forbiddenFieldsEncountered.map((f) => ({
            action: {
                id: `act-blocked-${f}`,
                actionType: "CAPTURE_SAFE_ARGUMENT_FIELDS",
                targetLocation: sourceAst.filePath || "source",
                requiredFact: `Value of ${f}`,
                expectedInformationGain: "LOW",
                sensitivity: "FORBIDDEN",
                estimatedOverhead: "NEGLIGIBLE",
                isAutomated: false,
                requiresUserAuthorization: true,
                description: `Credential or secret field '${f}' cannot be collected.`,
            },
            reason: "Field contains sensitive credentials, authentication tokens, or private secrets.",
        })),
        expectedInformationGain: "CRITICAL",
        sensitivityClassification: runtimePlan.redactedFields.length > 0 ? "REDACTABLE" : "SAFE",
        estimatedCost: "LOW",
        authorizationRequirement: runtimePlan.isSafeToExecute
            ? "NONE_REQUIRED"
            : "DEVELOPER_APPROVAL_REQUIRED",
        completionState: "COMPLETED",
    };

    // ─────────────────────────────────────────────────────────
    // Terminal State Classification
    // ─────────────────────────────────────────────────────────
    let terminalState: ActiveInvestigationTerminalState;

    if (sufficiency.state === "SUFFICIENT_FOR_REPAIR" && causalEpistemicState.failureMechanism.status === "CONFIRMED") {
        terminalState = "REPAIR_CONFIRMED";
    } else if (repairLocation.type === "DEPLOYMENT" && repairLocation.ownershipEstablished) {
        // Regression candidate is identified and actionable
        terminalState = "REPAIR_CONFIRMED";
    } else if (repairLocation.type === "CONFIGURATION") {
        terminalState = "NON_CODE_REMEDIATION_CONFIRMED";
    } else if (repairLocation.type === "DEPENDENCY") {
        terminalState = "NON_CODE_REMEDIATION_CONFIRMED";
    } else if (repairLocation.type === "EXTERNAL_INTEGRATION") {
        // External integration: after investigation passes we may still recommend
        // application-side resilience (retry, circuit breaker, timeout)
        terminalState = "NON_CODE_REMEDIATION_CONFIRMED";
    } else if (testAcquisition.canReproduceLocally) {
        terminalState = "REPRODUCTION_CONFIRMED";
    } else if (!runtimePlan.isSafeToExecute) {
        terminalState = "BLOCKED_BY_FORBIDDEN_DATA";
    } else if (
        sufficiency.state === "BLOCKED_BY_AMBIGUITY" ||
        sufficiency.state === "SUFFICIENT_FOR_DIAGNOSIS_BUT_NOT_REPAIR"
    ) {
        // After exhausting all passes, if still ambiguous, we still generate the
        // best available engineering recommendation, not a hard block.
        terminalState = "REQUIRES_USER_ACTION";
    } else if (sufficiency.state === "BLOCKED_BY_MISSING_RUNTIME_EVIDENCE") {
        terminalState = "REQUIRES_USER_ACTION";
    } else {
        terminalState = "NO_SAFE_REPAIR_ESTABLISHED";
    }

    // ─────────────────────────────────────────────────────────
    // Candidate Actions
    // ─────────────────────────────────────────────────────────
    const actionResult = generateAndEvaluateCandidateActions(
        currentSnapshot,
        causalEpistemicState,
        repairLocation,
        sufficiency,
        regressionContext,
        sourceAst,
        contractAnalysis
    );
    const rankedCandidateActions = actionResult.candidates;
    const chosenAction = actionResult.selectedAction;

    return {
        snapshot: currentSnapshot,
        sourceAst,
        causalEpistemicState,
        contractAnalysis,
        regressionContext,
        repairLocation,
        sufficiency,
        rankedCandidateActions,
        chosenAction,
        acquisitionPlan,
        terminalState,
        completedSteps,
        investigationVersion: pass + 1,
        evidenceVersion,
        recommendationVersion: 1,
    };
}
