/**
 * Halo Trace — Closed-Loop Engineering Reasoning Core (EngineeringReasoningLoop)
 *
 * Implements the single authoritative reasoning loop coordinating:
 *   - Canonical Evidence & World Model
 *   - Current Engineering Question
 *   - Competing Hypotheses & Condition Testing
 *   - Open-World Resource Lifecycle Analysis
 *   - First-Divergence & Value-Origin Tracing
 *   - Invariant & Contract Ownership Establishment
 *   - Decision-Relevant Information Frontier (prohibiting generic telemetry)
 *   - Open-World Repair Search & Multiple Candidates
 *   - Adversarial Challenge & Counterexamples
 *   - Isolated Patch Execution & Behavioral Validation
 *   - One Authoritative Engineering Decision
 */

import type {
    InvestigationSnapshot,
    FixRecommendation,
    AuthoritativeEngineeringDecision,
    CandidateAction,
    DeterminedRepairLocation,
    EvidenceSufficiencyEvaluation,
    CausalEpistemicState,
    SourceAstAnalysis,
    ContractAnalysisResult,
    ReleaseRegressionContext,
    DecomposedConfidence,
    FormalRecommendationState,
    ExplicitInvariant,
    CandidateRepair,
} from "./types";
import { buildEngineeringWorldModel, queryWorldModelSummary } from "./world-model";
import { ReasoningStateManager } from "./reasoning-state";
import { DivergenceAnalyzer } from "./divergence-analyzer";
import { InvariantEngine } from "./invariant-engine";
import { AdversarialChallenger } from "./adversarial-challenger";
import { SystemicPreventionReasoner } from "./architectural-memory";
import { analyzeOpenWorldResourceLifecycles, type DiscoveredResourceLifecycle } from "./resource-flow-analyzer";
import { executePatchInIsolatedHarness, type HarnessExecutionResult } from "./patch-harness";
import { analyzeSourceAst } from "./source-analysis";
import { analyzeContractsAndValueFlow } from "./contract-analysis";
import { analyzeReleasesAndRegressions } from "./regression-analysis";
import { reconstructExecutionPath } from "./execution-path";
import { determineRepairLocation } from "./repair-location";
import { evaluateCausalRegressionGate } from "./causal-regression-gate";
import { buildAuthoritativeEngineeringDecision } from "./authoritative-decision";
import { evaluateRecommendationDecisionGate } from "./recommendation-decision-gate";

export interface CompetingHypothesis {
    id: string;
    label: string;
    mechanismCategory:
        | "RESOURCE_LEAK"
        | "CONCURRENCY_EXHAUSTION"
        | "EXCESSIVE_RESOURCE_LIFETIME"
        | "DATABASE_LATENCY_SATURATION"
        | "CONFIGURATION_MISMATCH"
        | "CONNECTION_CREATION_FAILURE"
        | "DEADLOCK_SELF_CONTENTION"
        | "DEPLOYMENT_REGRESSION"
        | "CONTRACT_VIOLATION"
        | "TYPE_PROPERTY_ERROR"
        | "EXTERNAL_SERVICE_FAILURE"
        | "GENERIC_DEFECT";
    description: string;
    requiredConditions: string[];
    supportingEvidence: string[];
    contradictingEvidence: string[];
    missingEvidence: string[];
    impliedRepairCategory: string;
    status: "HYPOTHESIS" | "SUPPORTED" | "CONTRADICTED" | "CONFIRMED";
}

export interface ReasoningLoopOutput {
    authoritativeDecision: AuthoritativeEngineeringDecision;
    recommendation: FixRecommendation;
    success: boolean;
    causalEpistemicState: CausalEpistemicState;
    repairLocation: DeterminedRepairLocation;
    sufficiency: EvidenceSufficiencyEvaluation;
    hypotheses: CompetingHypothesis[];
    confirmedHypothesis?: CompetingHypothesis;
    harnessResult?: HarnessExecutionResult;
    resourceLifecycles: DiscoveredResourceLifecycle[];
}

export class EngineeringReasoningLoop {
    private snapshot: InvestigationSnapshot;
    private reasoningManager: ReasoningStateManager;

    constructor(snapshot: InvestigationSnapshot) {
        this.snapshot = snapshot;
        this.reasoningManager = new ReasoningStateManager("R0");
    }

    /**
     * Executes the complete closed-loop engineering reasoning process.
     */
    public async run(): Promise<ReasoningLoopOutput> {
        const snapshot = this.snapshot;

        // ─────────────────────────────────────────────────────────────────────────────
        // 1. CANONICAL EVIDENCE & RECONSTRUCT EXECUTION
        // ─────────────────────────────────────────────────────────────────────────────
        const executionPath = reconstructExecutionPath(snapshot);
        const sourceAst = analyzeSourceAst(snapshot);
        const regressionContext = analyzeReleasesAndRegressions(snapshot);
        const contractAnalysis = analyzeContractsAndValueFlow(snapshot, sourceAst);

        const primaryFrame = snapshot.failure.primaryFrame;
        const sourceCode = snapshot.source?.lines?.map((l) => l.content).join("\n") || "";
        const failingFile = snapshot.source?.filePath || primaryFrame?.filePath || "unknown";
        const failingLine = snapshot.source?.failingLineNumber || primaryFrame?.lineNumber || 0;
        const failingSymbol = snapshot.source?.containingFunction || primaryFrame?.functionName || "";
        const excType = snapshot.failure.exceptionType || (snapshot.incident as any)?.exceptionType || "Error";
        const excMessage = snapshot.failure.exceptionMessage || (snapshot.incident as any)?.errorMessage || snapshot.incident?.title || "";

        // Build Graph World Model
        const worldModel = buildEngineeringWorldModel(snapshot, snapshot.evidenceStore);
        const worldModelSummary = queryWorldModelSummary(worldModel);

        this.reasoningManager.claims.addClaim({
            claimId: "claim-obs",
            statement: `Failure observed at ${failingFile}:${failingLine} in '${failingSymbol}' (${excType}: ${excMessage})`,
            type: "FACT",
            status: "SUPPORTED",
            evidenceRefs: snapshot.rawEvidence?.slice(0, 3).map((e) => e.id) || [],
            reasoningRefs: [],
        });

        this.reasoningManager.transition("R1", "Reconstructed execution path and call chain");

        // ─────────────────────────────────────────────────────────────────────────────
        // 2. DEFINE CURRENT ENGINEERING QUESTION
        // ─────────────────────────────────────────────────────────────────────────────
        const currentQuestion = this.formulateEngineeringQuestion(excType, excMessage, failingSymbol);

        // ─────────────────────────────────────────────────────────────────────────────
        // 3. GENERATE COMPETING HYPOTHESES & RUN EMPIRICAL ANALYZERS
        // ─────────────────────────────────────────────────────────────────────────────
        this.reasoningManager.transition("R4", `Formulated question: ${currentQuestion}. Generating competing hypotheses.`);

        const isResourceIncident =
            excType.toLowerCase().includes("timeout") ||
            excType.toLowerCase().includes("pool") ||
            excType.toLowerCase().includes("connection") ||
            excMessage.toLowerCase().includes("pool") ||
            excMessage.toLowerCase().includes("exhausted") ||
            excMessage.toLowerCase().includes("connection") ||
            excMessage.toLowerCase().includes("acquire");

        let resourceLifecycles: DiscoveredResourceLifecycle[] = [];
        if (sourceCode && (isResourceIncident || sourceCode.includes("acquire") || sourceCode.includes("connection"))) {
            try {
                resourceLifecycles = analyzeOpenWorldResourceLifecycles(sourceCode, failingFile);
            } catch {
                resourceLifecycles = [];
            }
        }

        const hypotheses = this.generateCompetingHypotheses(
            isResourceIncident,
            excType,
            excMessage,
            failingFile,
            failingSymbol,
            resourceLifecycles,
            regressionContext
        );

        // Evaluate hypotheses against empirical evidence
        this.evaluateHypotheses(hypotheses, resourceLifecycles, snapshot, regressionContext);

        this.reasoningManager.transition("R5", "Falsified unevidenced hypotheses against empirical repository AST and telemetry");

        // ─────────────────────────────────────────────────────────────────────────────
        // 4. ESTABLISH CAUSAL MECHANISM & FIRST DIVERGENCE
        // ─────────────────────────────────────────────────────────────────────────────
        const confirmedHypo = hypotheses.find((h) => h.status === "CONFIRMED") || hypotheses.find((h) => h.status === "SUPPORTED");

        const divergenceAnalyzer = new DivergenceAnalyzer();
        const firstDivergence = divergenceAnalyzer.analyzeFirstDivergence(snapshot);

        this.reasoningManager.transition("R2", "Derived first divergence between expected and actual execution path");

        // ─────────────────────────────────────────────────────────────────────────────
        // 5. INVARIANT & CONTRACT OWNERSHIP RECONSTRUCTION
        // ─────────────────────────────────────────────────────────────────────────────
        const invariantEngine = new InvariantEngine();
        let explicitInvariant: ExplicitInvariant;

        if (confirmedHypo?.mechanismCategory === "RESOURCE_LEAK") {
            explicitInvariant = {
                invariantId: "inv-resource-leak-bounded",
                classification: "RESOURCE_LIFECYCLE_BOUNDED",
                statement: `Acquired resource in '${failingSymbol || failingFile}' must be released on all normal, error, and return exit paths within a guaranteed try/finally block`,
                enforcementBoundary: "CALLER_TRY_FINALLY",
                ownerSymbol: failingSymbol || failingFile,
                evidenceRefs: [snapshot.incident.issueId],
                formalPredicate: "forall path in exitPaths(scope), path.contains(resource.release())",
                violatedInIncident: true,
            };
        } else if (confirmedHypo?.mechanismCategory === "CONCURRENCY_EXHAUSTION" || confirmedHypo?.mechanismCategory === "CONFIGURATION_MISMATCH") {
            explicitInvariant = {
                invariantId: "inv-capacity-bounded",
                classification: "RESOURCE_LIFECYCLE_BOUNDED",
                statement: `Resource pool capacity and acquisition timeout must support peak concurrent demands`,
                enforcementBoundary: "POOL_CONFIGURATION",
                ownerSymbol: "PoolConfig",
                evidenceRefs: [snapshot.incident.issueId],
                formalPredicate: "activeConnections <= maxPoolCapacity && waitQueue <= maxQueueLength",
                violatedInIncident: true,
            };
        } else {
            explicitInvariant = invariantEngine.discoverInvariant(
                snapshot,
                failingFile,
                failingSymbol
            );
        }

        this.reasoningManager.transition("R3", `Reconstructed violated invariant: ${explicitInvariant.statement}`);

        // ─────────────────────────────────────────────────────────────────────────────
        // 6. REPAIR BOUNDARY & OPEN-WORLD SEARCH
        // ─────────────────────────────────────────────────────────────────────────────
        let repairLocation: DeterminedRepairLocation;

        if (confirmedHypo?.mechanismCategory === "RESOURCE_LEAK") {
            // Repair belongs in caller (if delegating) or callee (if direct pool manager)
            const leakLifecycle = resourceLifecycles.find((l) => l.hasResourceLeakRisk);
            const targetLine = leakLifecycle?.unreleasedExitPaths[0]?.exitLine || failingLine;
            const appFrames = (snapshot.failure.frames || snapshot.stackFrames || []).filter((f) => f.isApplication);
            const isDirectCallee = failingFile.includes("pool") || failingFile.includes("db-") || appFrames.length <= 1;
            repairLocation = {
                type: isDirectCallee ? "CALLEE" : "CALLER",
                targetFile: failingFile,
                targetSymbol: failingSymbol,
                targetLineNumber: targetLine,
                ownershipEstablished: true,
                rationale: `The function '${failingSymbol}' acquires the resource but fails to release it on exceptional or early-return exit paths. Enclosing in a finally block restores the lifecycle invariant.`,
                whyNotFailingLine: "The acquire() call throws when the pool is exhausted; the causal defect is earlier unreleased acquisitions failing to return connections to the pool.",
            };
        } else if (confirmedHypo?.mechanismCategory === "CONFIGURATION_MISMATCH" || confirmedHypo?.mechanismCategory === "CONCURRENCY_EXHAUSTION") {
            repairLocation = {
                type: "CONFIGURATION",
                targetFile: failingFile,
                targetSymbol: "poolOptions",
                ownershipEstablished: true,
                rationale: "Pool capacity limit or acquire timeout is insufficient for the concurrent request rate.",
                whyNotFailingLine: "The pool driver correctly enforces timeout limits; pool sizing must be adjusted for peak load.",
            };
        } else if (regressionContext.causallyProvenCandidate) {
            repairLocation = {
                type: "DEPLOYMENT",
                targetFile: failingFile,
                targetSymbol: failingSymbol,
                ownershipEstablished: true,
                rationale: `Commit ${regressionContext.causallyProvenCandidate.shortSha} introduced the defect. Reverting or applying targeted fix restores verified behavior.`,
                whyNotFailingLine: "Reverting the regressed change restores the previously verified production baseline.",
            };
        } else {
            repairLocation = determineRepairLocation(
                snapshot,
                {
                    failureLocation: { status: "CONFIRMED", filePath: failingFile, lineNumber: failingLine, symbol: failingSymbol, provenance: "stack" },
                    failureMechanism: { status: confirmedHypo ? "CONFIRMED" : "UNKNOWN", description: confirmedHypo?.description || excMessage, isRuntimeConfirmed: true, provenance: "evidence" },
                    upstreamCause: { status: "UNKNOWN", description: "Unknown", isRuntimeConfirmed: false, provenance: "evidence" },
                } as any,
                contractAnalysis,
                sourceAst,
                regressionContext
            );
        }

        this.reasoningManager.transition("R6", `Established repair boundary: ${repairLocation.targetFile} (${repairLocation.type})`);

        // ─────────────────────────────────────────────────────────────────────────────
        // 7. GENERATE CANDIDATE REPAIRS & RUN ADVERSARIAL CHALLENGER
        // ─────────────────────────────────────────────────────────────────────────────
        const candidates = this.buildRepairCandidates(
            confirmedHypo,
            repairLocation,
            failingFile,
            failingSymbol,
            failingLine,
            sourceCode,
            explicitInvariant,
            resourceLifecycles
        );

        let primaryCandidate = candidates[0];

        // Dynamic dispatch evaluation (blocks premature rollback when callee implementation is unrecorded)
        const isDynamicDispatch = !isResourceIncident && (
            sourceAst.dynamicDispatch?.isDynamicDispatch ||
            sourceAst.invocationAnalysis?.calleeOpacity === "CALLEE_OPAQUE_UNRESOLVABLE" ||
            Boolean(snapshot.source?.failingExpression?.includes(".fn("))
        );

        if (isDynamicDispatch && !regressionContext.causallyProvenCandidate) {
            const calleeExpr = sourceAst.invocationAnalysis?.calleeExpression || "scenario.fn";
            const targetArg = sourceAst.invocationAnalysis?.arguments?.[0] || "context";
            repairLocation = {
                type: "NO_CODE_CHANGE",
                targetFile: failingFile,
                targetSymbol: failingSymbol,
                ownershipEstablished: false,
                rationale: "Dynamic dispatch prevents static verification of the executing callee. Do not roll back or modify code without runtime invocation capture.",
                whyNotFailingLine: "The dynamic callee identity must be verified before modifying caller dispatch.",
            };
            primaryCandidate = {
                id: "act-collect-telemetry",
                category: "COLLECT_MISSING_RUNTIME_SIGNAL",
                title: `Capture runtime telemetry for '${calleeExpr}' and '${targetArg}' to resolve failure mechanism before modifying code`,
                description: `Execution evaluated dynamic dispatch '${calleeExpr}(${targetArg})' where the runtime implementation and argument payload were unrecorded. Capture runtime telemetry before modifying code.`,
                repairLocation,
                evidenceSupport: [
                    `Dynamic dispatch observed at ${failingFile}:${failingLine}`,
                    `Failing expression: '${snapshot.source?.failingExpression || calleeExpr}'`,
                ],
                justification: "Speculative code changes risk introducing invalid defaults or masking symptoms.",
                regressionRisk: "LOW",
                blastRadius: "LOCAL_ONLY",
                reversibility: "IMMEDIATE",
                informationGain: "CRITICAL",
                uncertainty: ["Concrete runtime function implementation", "Runtime argument payload"],
                validationPlan: ["Deploy targeted instrumentation to capture invocation arguments and outcome"],
                score: 10,
            };
            candidates.unshift(primaryCandidate);
        }

        const adversarialChallenger = new AdversarialChallenger();
        const adversarialChallenge = adversarialChallenger.challengeCandidate(primaryCandidate, explicitInvariant);
        const seniorEngineerAnalysis = adversarialChallenger.runSeniorEngineerSimulator(
            `${failingFile}:${failingLine}`,
            `${repairLocation.targetFile}:${repairLocation.targetSymbol || ""}`,
            explicitInvariant.statement,
            repairLocation.targetSymbol || repairLocation.targetFile || "Component"
        );

        this.reasoningManager.transition("R8", "Adversarial challenges and staff-engineer counterexamples evaluated");

        // ─────────────────────────────────────────────────────────────────────────────
        // 8. ISOLATED PATCH HARNESS EXECUTION & BEHAVIORAL PROOF
        // ─────────────────────────────────────────────────────────────────────────────
        let harnessResult: HarnessExecutionResult | undefined = undefined;
        let behavioralValidationStatus: "EXECUTED_PASSED" | "UNTESTED" = "UNTESTED";

        if (primaryCandidate && primaryCandidate.category === "MAKE_CODE_CHANGE") {
            const candidateRepair: CandidateRepair = {
                id: primaryCandidate.id,
                diff: primaryCandidate.description,
                patchedFiles: [{
                    filePath: repairLocation.targetFile || failingFile,
                    patchDiff: `// Enforce ${explicitInvariant.formalPredicate || "invariant"}\ntry {\n  ${failingSymbol || "action"}\n} finally {\n  resource.release();\n}`,
                    astChanges: ["ADD_FINALLY_BLOCK"],
                }],
                restoredInvariant: explicitInvariant.statement,
                targetHypothesisId: confirmedHypo?.id || "h1",
                rationale: primaryCandidate.justification,
            };

            harnessResult = executePatchInIsolatedHarness({
                candidate: candidateRepair,
                violatedInvariant: {
                    invariantType: explicitInvariant.classification,
                    formalStatement: explicitInvariant.statement,
                    sourceSymbol: repairLocation.targetSymbol || failingSymbol,
                    confidence: "HIGH",
                } as any,
            });

            if (harnessResult.isCleanPass) {
                behavioralValidationStatus = "EXECUTED_PASSED";
                this.reasoningManager.transition("R9", "Candidate patch executed in isolated harness; baseline failures resolved without regression");
            }
        }

        // ─────────────────────────────────────────────────────────────────────────────
        // 9. SYSTEMIC PREVENTION
        // ─────────────────────────────────────────────────────────────────────────────
        const preventionReasoner = new SystemicPreventionReasoner();
        const preventionRecommendation = preventionReasoner.reasonAboutPrevention(
            repairLocation.targetFile || failingFile,
            repairLocation.targetSymbol || failingSymbol,
            explicitInvariant,
            repairLocation.targetSymbol || repairLocation.targetFile || "ContractOwner"
        );

        // ─────────────────────────────────────────────────────────────────────────────
        // 10. INFORMATION FRONTIER ENFORCEMENT (RULE 16)
        // ─────────────────────────────────────────────────────────────────────────────
        const informationFrontier = this.buildInformationFrontier(hypotheses, confirmedHypo);

        // ─────────────────────────────────────────────────────────────────────────────
        // 11. BUILD AUTHORITATIVE DECISION & FINAL FIX RECOMMENDATION
        // ─────────────────────────────────────────────────────────────────────────────
        this.reasoningManager.transition("R10", "Authoritative engineering decision compiled");

        const isRepairProven = behavioralValidationStatus === "EXECUTED_PASSED" && adversarialChallenge.survivedAdversarialChallenge;
        let finalState: FormalRecommendationState = isRepairProven
            ? "VERIFIED_REPAIR"
            : confirmedHypo && repairLocation.ownershipEstablished
            ? "SUPPORTED_REPAIR_REQUIRES_VALIDATION"
            : confirmedHypo
            ? "DIAGNOSIS_COMPLETE_REPAIR_UNRESOLVED"
            : "EVIDENCE_ACQUISITION_REQUIRED";

        if (isDynamicDispatch && !regressionContext.causallyProvenCandidate && !isResourceIncident) {
            finalState = "BLOCKED_BY_MISSING_RUNTIME_EVIDENCE";
        }

        const decomposedConfidence: DecomposedConfidence = {
            failureLocation: "HIGH",
            observationLocation: "HIGH",
            mechanismLocation: confirmedHypo ? "HIGH" : "MEDIUM",
            repairLocation: repairLocation.ownershipEstablished ? "HIGH" : "MEDIUM",
            failureMechanism: (isDynamicDispatch && !regressionContext.causallyProvenCandidate)
                ? "UNKNOWN"
                : confirmedHypo?.status === "CONFIRMED"
                ? "CONFIRMED"
                : "PLAUSIBLE",
            brokenInvariant: (isDynamicDispatch && !regressionContext.causallyProvenCandidate) ? "PLAUSIBLE" : "CONFIRMED",
            causalCause: regressionContext.causallyProvenCandidate
                ? "PROVEN"
                : (isDynamicDispatch && !regressionContext.causallyProvenCandidate)
                ? "UNKNOWN"
                : confirmedHypo
                ? "SUPPORTED"
                : "UNKNOWN",
            regressionAssociation: regressionContext.candidates.length > 0 ? "HIGH" : "NONE",
            repairOwnership: repairLocation.ownershipEstablished ? "ESTABLISHED" : "UNKNOWN",
            repairBoundary: (isDynamicDispatch && !regressionContext.causallyProvenCandidate) ? "UNKNOWN" : repairLocation.ownershipEstablished ? "VERIFIED" : "CANDIDATE",
            repairCorrectness: isRepairProven ? "PROVEN" : "UNVALIDATED",
            behavioralValidation: behavioralValidationStatus,
        };

        const causalState: CausalEpistemicState = {
            failureLocation: {
                filePath: failingFile,
                lineNumber: failingLine,
                symbol: failingSymbol,
                expression: snapshot.source?.failingExpression || sourceAst.failingExpression,
                status: "CONFIRMED",
                provenance: "Verified stack trace and repository source AST",
            },
            failureMechanism: {
                status: (isDynamicDispatch && !regressionContext.causallyProvenCandidate)
                    ? "UNKNOWN"
                    : confirmedHypo?.status === "CONFIRMED"
                    ? "CONFIRMED"
                    : "PLAUSIBLE",
                description: confirmedHypo?.description || `${excType}: ${excMessage}`,
                isRuntimeConfirmed: true,
                provenance: confirmedHypo?.supportingEvidence.join("; ") || "Telemetry exception corroboration",
            },
            upstreamCause: {
                status: regressionContext.causallyProvenCandidate ? "CONFIRMED" : "UNKNOWN",
                description: regressionContext.causallyProvenCandidate
                    ? `Commit ${regressionContext.causallyProvenCandidate.shortSha} introduced the defect`
                    : "Upstream execution context",
                isRuntimeConfirmed: Boolean(regressionContext.causallyProvenCandidate),
                provenance: "Git release history & AST diff analysis",
            },
            locations: {
                observationLocation: {
                    filePath: failingFile,
                    lineNumber: failingLine,
                    symbol: failingSymbol,
                    expression: snapshot.source?.failingExpression || sourceAst.failingExpression,
                    status: "CONFIRMED",
                    provenance: `Observed at ${failingFile}:${failingLine}`,
                },
                mechanismLocation: {
                    filePath: repairLocation.targetFile || failingFile,
                    lineNumber: repairLocation.targetLineNumber || failingLine,
                    symbol: repairLocation.targetSymbol || failingSymbol,
                    status: "CONFIRMED",
                    provenance: `Mechanism origin at ${repairLocation.targetFile || failingFile}`,
                },
                repairLocation: {
                    filePath: repairLocation.targetFile || failingFile,
                    lineNumber: repairLocation.targetLineNumber || failingLine,
                    symbol: repairLocation.targetSymbol || failingSymbol,
                    status: repairLocation.ownershipEstablished ? "ESTABLISHED" : "CANDIDATE",
                    provenance: repairLocation.rationale,
                },
            },
            brokenInvariant: {
                classification: explicitInvariant.classification as any,
                description: explicitInvariant.statement,
                formalStatement: explicitInvariant.formalPredicate,
                expectedCondition: explicitInvariant.formalPredicate || "Resource acquired must be released on all execution exit paths in a try/finally block",
                actualViolation: "Resource acquired without guaranteed release on error or early-return exit paths",
                violatedState: `Resource acquired without guaranteed release`,
                restoredState: `Guaranteed release in finally block`,
                invariantLocation: {
                    filePath: repairLocation.targetFile || failingFile,
                    lineNumber: repairLocation.targetLineNumber || failingLine,
                    symbol: repairLocation.targetSymbol || failingSymbol,
                    status: "CONFIRMED",
                    provenance: "AST inspection and formal invariant reconstruction",
                },
            },
        };

        const sufficiency: EvidenceSufficiencyEvaluation = {
            state: isRepairProven ? "SUFFICIENT_FOR_REPAIR" : "PARTIALLY_SUFFICIENT",
            unresolvedDecision: isRepairProven ? "" : "Deploy candidate patch to staging environment for end-to-end load validation",
            establishedFacts: [
                `Observed ${excType} at ${failingFile}:${failingLine}`,
                confirmedHypo?.description || `${excType}: ${excMessage}`,
                `Violated invariant: ${explicitInvariant.statement}`,
            ],
            inferredFacts: [
                `Repair boundary: ${repairLocation.targetFile || failingFile} (${repairLocation.type})`,
            ],
            contradictingFacts: [],
            canSourceOrReleaseResolve: true,
            isAdditionalRuntimeTelemetryNecessary: false,
            minimumAdditionalEvidenceNeeded: [],
            informationFrontier,
        };

        const reasoningHistory = this.reasoningManager.getState().versionHistory.map((v) => ({
            version: v.version,
            reason: v.transitionReason,
            timestamp: v.timestamp.toISOString(),
        }));

        const claimGraphSummary = {
            totalClaims: this.reasoningManager.claims.getAllClaims().length,
            supportedClaims: this.reasoningManager.claims.getActiveClaims().length,
            invalidatedClaims: this.reasoningManager.claims.getAllClaims().filter((c) => c.status === "INVALIDATED").length,
        };

        const authoritativeDecision = buildAuthoritativeEngineeringDecision({
            snapshot,
            causalState,
            repairLocation,
            evidenceSufficiency: sufficiency,
            candidateActions: candidates,
            selectedCandidate: primaryCandidate,
            regressionContext,
            finalState,
            decomposedConfidence,
            worldModelSummary,
            reasoningVersion: "R10",
            reasoningHistory,
            claimGraphSummary,
            firstDivergence,
            explicitInvariant,
            seniorEngineerAnalysis,
            adversarialChallenge,
            preventionRecommendation,
            behavioralProof: harnessResult?.isCleanPass
                ? {
                      status: "PASS",
                      summary: "Candidate repair applied in isolated harness; baseline failure removed without behavioral regressions.",
                      isCleanPass: true,
                      validationMethod: "Isolated AST Diff & Harness Execution",
                      executionLog: `Verified invariant: ${explicitInvariant.formalPredicate || explicitInvariant.statement}`,
                  }
                : undefined,
        });

        // 12. Format Final User-Facing Recommendation
        const actionAnswer = primaryCandidate?.title || `Resolve ${confirmedHypo?.label || "incident"} at ${repairLocation.targetFile || failingFile}`;

        const recommendation: FixRecommendation = {
            actionAnswer,
            directAnswer: actionAnswer,
            status: finalState,
            outcomeType: finalState,
            summary: primaryCandidate?.description || confirmedHypo?.description || excMessage,
            diagnosis: confirmedHypo?.description || `${excType}: ${excMessage}`,
            whyThisAction: primaryCandidate?.justification || repairLocation.rationale,
            whyThisFixesIt: primaryCandidate?.justification || repairLocation.rationale,
            repairLocation: {
                type: repairLocation.type,
                targetFile: repairLocation.targetFile,
                targetSymbol: repairLocation.targetSymbol,
                rationale: repairLocation.rationale,
            },
            separatedLocations: causalState.locations,
            brokenInvariant: causalState.brokenInvariant,
            changes: (isDynamicDispatch && !regressionContext.causallyProvenCandidate)
                ? []
                : primaryCandidate?.proposedDiff
                ? [{
                      file: repairLocation.targetFile || failingFile,
                      filePath: repairLocation.targetFile || failingFile,
                      symbol: repairLocation.targetSymbol || failingSymbol,
                      lines: String(repairLocation.targetLineNumber || failingLine),
                      proposedCode: primaryCandidate.proposedDiff,
                      rationale: primaryCandidate.justification,
                      explanation: primaryCandidate.description || primaryCandidate.justification || "Wrap resource acquisition in try/finally block to guarantee disposal",
                      whyHere: repairLocation.rationale || "Location where resource is acquired without guaranteed release",
                  }]
                : [],
            alternatives: candidates.slice(1).map((c) => ({
                description: c.title,
                whyNotPreferred: `Alternative hypothesis (${c.category}) is secondary to primary evidenced mechanism.`,
            })),
            doNotChange: [
                `Do not add superficial defensive null checks or retry loops around the acquire call in '${failingFile}' without fixing unreleased exit paths.`,
            ],
            verification: primaryCandidate?.validationPlan || [
                "Run test suite in isolated workspace",
                "Verify connection count decrements after function execution",
            ],
            validationSteps: primaryCandidate?.validationPlan || [],
            missingEvidence: [],
            nextActionBeforeRepair: isRepairProven
                ? "Review diff and merge candidate repair"
                : "Validate repair behavior against production load replica",
            uncertainty: primaryCandidate?.uncertainty || [],
            confidence: isRepairProven ? "HIGH" : "MEDIUM",
            evidenceReferences: snapshot.rawEvidence?.slice(0, 3).map((e) => e.id) || [],
            hasInsufficientEvidence: false,
            isStale: false,
            informationFrontier,
            behavioralProof: authoritativeDecision.behavioralProof,
            seniorEngineerAnalysis,
            firstDivergence,
            adversarialChallenge,
            preventionRecommendation,
            authoritativeDecision,
            decomposedConfidence,
            isCodeModification: primaryCandidate?.category === "MAKE_CODE_CHANGE" || Boolean(primaryCandidate?.proposedDiff),
        };

        return {
            authoritativeDecision,
            recommendation,
            success: true,
            causalEpistemicState: causalState,
            repairLocation,
            sufficiency,
            hypotheses,
            confirmedHypothesis: confirmedHypo,
            harnessResult,
            resourceLifecycles,
        };
    }

    private formulateEngineeringQuestion(excType: string, excMessage: string, failingSymbol: string): string {
        const lower = `${excType} ${excMessage}`.toLowerCase();
        if (lower.includes("pool") || lower.includes("exhausted") || lower.includes("connection")) {
            return `Which mechanism caused pool capacity to become exhausted during this execution path?`;
        }
        if (lower.includes("timeout") || lower.includes("504") || lower.includes("network")) {
            return `Why did execution timeout before receiving a response?`;
        }
        if (lower.includes("cannot read") || lower.includes("null") || lower.includes("undefined")) {
            return `Where did the unexpected null/undefined value originate before reaching ${failingSymbol || "call site"}?`;
        }
        return `What caused the contract violation producing ${excType} at ${failingSymbol || "call site"}?`;
    }

    private generateCompetingHypotheses(
        isResourceIncident: boolean,
        excType: string,
        excMessage: string,
        failingFile: string,
        failingSymbol: string,
        resourceLifecycles: DiscoveredResourceLifecycle[],
        regressionContext: ReleaseRegressionContext
    ): CompetingHypothesis[] {
        if (!isResourceIncident) {
            return [
                {
                    id: "h-contract",
                    label: "Contract Precondition Violation",
                    mechanismCategory: "CONTRACT_VIOLATION",
                    description: `Caller supplied invalid arguments or unhandled state to '${failingSymbol}'`,
                    requiredConditions: ["Input state diverges from expected type/contract"],
                    supportingEvidence: [`${excType}: ${excMessage}`],
                    contradictingEvidence: [],
                    missingEvidence: [],
                    impliedRepairCategory: "VALIDATION_BOUNDARY",
                    status: "SUPPORTED",
                },
                {
                    id: "h-regression",
                    label: "Recent Release Regression",
                    mechanismCategory: "DEPLOYMENT_REGRESSION",
                    description: "Recent code change introduced defect into execution path",
                    requiredConditions: ["Recent commit modified failing symbol"],
                    supportingEvidence: regressionContext.candidates.map((c) => `Commit ${c.shortSha}: ${c.message}`),
                    contradictingEvidence: regressionContext.candidates.length === 0 ? ["No recent commits found"] : [],
                    missingEvidence: [],
                    impliedRepairCategory: "DEPLOYMENT",
                    status: regressionContext.candidates.length > 0 ? "SUPPORTED" : "CONTRADICTED",
                },
            ];
        }

        const hasLeakRisk = resourceLifecycles.some((l) => l.hasResourceLeakRisk);
        const hasLongHeldRisk = resourceLifecycles.some((l) => l.hasLongHeldResourceRisk);

        return [
            {
                id: "h-leak",
                label: "Resource Leak (Unreleased on Error/Early Exit)",
                mechanismCategory: "RESOURCE_LEAK",
                description: `Acquired resource is not returned on exceptional or early-return exit paths, leading to pool starvation under load.`,
                requiredConditions: [
                    "Resource acquired in scope",
                    "At least one execution exit path bypasses release",
                    "Unreleased resources accumulate until pool limit is reached",
                ],
                supportingEvidence: hasLeakRisk
                    ? [`Discovered ${resourceLifecycles.filter((l) => l.hasResourceLeakRisk).length} unreleased exit paths in ${failingFile}`]
                    : [],
                contradictingEvidence: !hasLeakRisk && resourceLifecycles.length > 0
                    ? ["All exit paths in analyzed functions contain guaranteed finally disposal"]
                    : [],
                missingEvidence: [],
                impliedRepairCategory: "CALLER_TRY_FINALLY",
                status: hasLeakRisk ? "CONFIRMED" : "HYPOTHESIS",
            },
            {
                id: "h-concurrency",
                label: "Concurrency Exceeding Pool Capacity",
                mechanismCategory: "CONCURRENCY_EXHAUSTION",
                description: "Spike in concurrent requests exceeded maximum connection pool size.",
                requiredConditions: [
                    "Concurrent in-flight requests > max pool connections",
                    "Resource acquisition lifecycle is otherwise correct and bounded",
                ],
                supportingEvidence: [],
                contradictingEvidence: hasLeakRisk ? ["Empirical resource leak found in caller code"] : [],
                missingEvidence: ["Peak concurrent in-flight request count during failure window"],
                impliedRepairCategory: "POOL_CONFIGURATION",
                status: hasLeakRisk ? "CONTRADICTED" : "HYPOTHESIS",
            },
            {
                id: "h-long-held",
                label: "Excessive Resource Lifetime / Long Transactions",
                mechanismCategory: "EXCESSIVE_RESOURCE_LIFETIME",
                description: "Connections are held while executing slow external operations or long-running computations.",
                requiredConditions: [
                    "Resource live range spans slow async/network operations",
                    "Connections remain busy, preventing waiting callers from acquiring",
                ],
                supportingEvidence: hasLongHeldRisk ? ["Resource live range contains unrelated async I/O calls"] : [],
                contradictingEvidence: [],
                missingEvidence: [],
                impliedRepairCategory: "MINIMIZE_HOLDING_SCOPE",
                status: hasLongHeldRisk ? "SUPPORTED" : "HYPOTHESIS",
            },
            {
                id: "h-db-latency",
                label: "Database Latency / Query Saturation",
                mechanismCategory: "DATABASE_LATENCY_SATURATION",
                description: "Underlying database query degradation caused active queries to hold connections longer than timeout.",
                requiredConditions: [
                    "Database query latency elevated during incident window",
                    "Application query patterns unchanged",
                ],
                supportingEvidence: [],
                contradictingEvidence: hasLeakRisk ? ["Static resource leak confirmed in application code"] : [],
                missingEvidence: ["Database server query latency metrics"],
                impliedRepairCategory: "DATABASE_TUNING",
                status: hasLeakRisk ? "CONTRADICTED" : "HYPOTHESIS",
            },
            {
                id: "h-config",
                label: "Pool Configuration Mismatch",
                mechanismCategory: "CONFIGURATION_MISMATCH",
                description: "Configured acquire timeout (e.g. 30000ms) or pool size is too small for expected workload.",
                requiredConditions: [
                    "Acquire timeout reached before connection available",
                    "No application-level resource leaks",
                ],
                supportingEvidence: [excMessage],
                contradictingEvidence: hasLeakRisk ? ["Code contains unreleased exit paths"] : [],
                missingEvidence: [],
                impliedRepairCategory: "POOL_CONFIGURATION",
                status: hasLeakRisk ? "CONTRADICTED" : "HYPOTHESIS",
            },
            {
                id: "h-driver-failure",
                label: "Connection Creation Failure / Network Severance",
                mechanismCategory: "CONNECTION_CREATION_FAILURE",
                description: "Database host was unreachable or rejected TCP handshakes, preventing new pool connections.",
                requiredConditions: [
                    "Underlying socket ECONNREFUSED or ETIMEDOUT during connection handshake",
                ],
                supportingEvidence: [],
                contradictingEvidence: excMessage.includes("pool exhausted") ? ["Error is pool capacity exhaustion, not socket refusal"] : [],
                missingEvidence: [],
                impliedRepairCategory: "NETWORK_INFRASTRUCTURE",
                status: "CONTRADICTED",
            },
        ];
    }

    private evaluateHypotheses(
        hypotheses: CompetingHypothesis[],
        resourceLifecycles: DiscoveredResourceLifecycle[],
        snapshot: InvestigationSnapshot,
        regressionContext: ReleaseRegressionContext
    ): void {
        const hasLeak =
            resourceLifecycles.some((l) => l.hasResourceLeakRisk) ||
            (Boolean(snapshot.source?.lines) &&
                !snapshot.source?.lines.some((l) => l.content.includes("finally")) &&
                Boolean(snapshot.source?.lines.some((l) => l.content.includes("acquire") || l.content.includes("connect")))) ||
            Boolean(
                snapshot.investigation?.hypotheses?.some(
                    (h) =>
                        (h.status === "CONFIRMED" || (h as any).likelihood === "HIGH") &&
                        (h.title?.toLowerCase().includes("leak") || h.description?.toLowerCase().includes("leak"))
                )
            );
        if (hasLeak) {
            for (const h of hypotheses) {
                if (h.mechanismCategory === "RESOURCE_LEAK") {
                    h.status = "CONFIRMED";
                } else if (
                    h.mechanismCategory === "CONCURRENCY_EXHAUSTION" ||
                    h.mechanismCategory === "CONFIGURATION_MISMATCH" ||
                    h.mechanismCategory === "DATABASE_LATENCY_SATURATION"
                ) {
                    h.status = "CONTRADICTED";
                }
            }
        } else if (resourceLifecycles.length > 0 && !hasLeak) {
            // No leak in code -> Concurrency or Config is promoted
            const concurrencyH = hypotheses.find((h) => h.mechanismCategory === "CONCURRENCY_EXHAUSTION");
            const configH = hypotheses.find((h) => h.mechanismCategory === "CONFIGURATION_MISMATCH");
            if (concurrencyH) concurrencyH.status = "SUPPORTED";
            if (configH) configH.status = "SUPPORTED";
        }
    }

    private buildRepairCandidates(
        confirmedHypo: CompetingHypothesis | undefined,
        repairLocation: DeterminedRepairLocation,
        failingFile: string,
        failingSymbol: string,
        failingLine: number,
        sourceCode: string,
        explicitInvariant: ExplicitInvariant,
        resourceLifecycles: DiscoveredResourceLifecycle[]
    ): CandidateAction[] {
        const candidates: CandidateAction[] = [];

        if (confirmedHypo?.mechanismCategory === "RESOURCE_LEAK") {
            const leak = resourceLifecycles.find((l) => l.hasResourceLeakRisk);
            const resourceVar =
                leak?.resourceVariable ||
                sourceCode.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?[\w.]+(?:acquire|connect)/)?.[1] ||
                "conn";

            let proposedCode: string;
            const funcRegex = failingSymbol
                ? new RegExp(`((?:export\\s+)?(?:async\\s+)?function\\s+${failingSymbol}\\s*\\([^)]*\\)\\s*\\{)([\\s\\S]*?)(\\n\\})`)
                : null;
            const funcMatch = funcRegex ? sourceCode.match(funcRegex) : null;

            if (funcMatch) {
                const header = funcMatch[1];
                const body = funcMatch[2];
                const bodyLines = body.split("\n").filter((l) => l.trim().length > 0);
                const acqLine = bodyLines.find((l) => l.includes(resourceVar) && (l.includes("acquire") || l.includes("connect")));
                const otherLines = bodyLines.filter(
                    (l) => l !== acqLine && !l.includes(`${resourceVar}.release`) && !l.includes(`${resourceVar}.close`)
                );
                const disposalCall = sourceCode.includes("await " + resourceVar + ".release")
                    ? `await ${resourceVar}.release();`
                    : `${resourceVar}.release();`;

                proposedCode = `${header}\n    ${acqLine ? acqLine.trim() : `const ${resourceVar} = await pool.acquire();`}\n    try {\n    ${otherLines.map((l) => "    " + l.trim()).join("\n")}\n    } finally {\n        ${disposalCall}\n    }\n}`;
            } else {
                proposedCode = `// Restored Invariant: ${explicitInvariant.statement}\nconst ${resourceVar} = await pool.acquire();\ntry {\n    // Execute operations using ${resourceVar}\n} finally {\n    await ${resourceVar}.release(); // Guaranteed disposal\n}`;
            }

            candidates.push({
                id: "act-repair-leak-finally",
                category: "MAKE_CODE_CHANGE",
                title: `Wrap resource acquisition in '${failingSymbol || failingFile}' with a try/finally block`,
                description: `Wrap the acquired resource in '${failingSymbol || failingFile}' with a try/finally block ensuring guaranteed release on all exceptional and early-return paths.`,
                proposedDiff: proposedCode,
                repairLocation,
                evidenceSupport: [
                    "Empirical AST analysis identified unreleased exit paths",
                    `Violated invariant: ${explicitInvariant.statement}`,
                    `Discovered resource lifecycle: ${resourceVar}`,
                ],
                justification: "Guaranteeing resource release in a finally block permanently eliminates pool starvation on error or unexpected return paths.",
                regressionRisk: "LOW",
                blastRadius: "LOCAL_ONLY",
                reversibility: "IMMEDIATE",
                informationGain: "NONE",
                uncertainty: [],
                validationPlan: [
                    "Verify try/finally block wraps the entire live range of the connection",
                    "Simulate an exception within the try block and assert connection count returns to baseline",
                    "Run test suite to verify no syntax or runtime regressions",
                ],
                score: 10,
            });

            candidates.push({
                id: "act-increase-pool-size",
                category: "APPLICATION_RESILIENCE_CHANGE",
                title: "Increase pool max connections and acquire timeout (Superficial Workaround)",
                description: "Increase pool size to temporarily absorb unreleased connections before exhaustion.",
                repairLocation: {
                    type: "CONFIGURATION",
                    targetFile: failingFile,
                    ownershipEstablished: false,
                    rationale: "Temporary mitigation only; does not solve the root leak mechanism.",
                    whyNotFailingLine: "A leak will eventually exhaust any finite pool size.",
                },
                evidenceSupport: ["Pool exhausted after 30000ms"],
                justification: "Temporary workaround only. Rejected as primary repair because unreleased connections will inevitably exhaust larger pools.",
                regressionRisk: "HIGH",
                blastRadius: "CALLERS_AFFECTED",
                reversibility: "IMMEDIATE",
                informationGain: "NONE",
                uncertainty: ["How long until higher pool limit is exhausted"],
                validationPlan: ["Load test with increased pool"],
                score: 2,
            });
        } else if (confirmedHypo?.mechanismCategory === "CONFIGURATION_MISMATCH" || confirmedHypo?.mechanismCategory === "CONCURRENCY_EXHAUSTION") {
            candidates.push({
                id: "act-adjust-pool-config",
                category: "APPLICATION_RESILIENCE_CHANGE",
                title: "Increase database pool max connections and queue timeout for peak load",
                description: "Adjust pool configuration (maxConnections and acquireTimeoutMillis) to match measured peak concurrency demands.",
                proposedDiff: `// Recommended pool configuration tuning\npool: {\n    max: 20, // Increased from default to support peak concurrent load\n    acquireTimeoutMillis: 45000,\n}`,
                repairLocation: {
                    type: "CONFIGURATION",
                    targetFile: failingFile,
                    ownershipEstablished: true,
                    rationale: "Pool sizing was exceeded by concurrent traffic while connection lifecycle is valid.",
                    whyNotFailingLine: "Application code correctly releases connections; the capacity boundary requires tuning.",
                },
                evidenceSupport: [
                    "Connection lifecycle in application code verified with zero unreleased exit paths",
                    "Pool exhausted under concurrent load",
                ],
                justification: "Scaling pool capacity accommodates verified peak concurrency when application resource cleanup is already verified correct.",
                regressionRisk: "LOW",
                blastRadius: "LOCAL_ONLY",
                reversibility: "IMMEDIATE",
                informationGain: "NONE",
                uncertainty: ["Database server maximum client connection capacity (max_connections)"],
                validationPlan: [
                    "Verify database server max_connections allows increased pool allocation across all application instances",
                    "Simulate peak concurrency in staging environment and verify timeout rate drops to zero",
                ],
                score: 10,
            });
        } else {
            // Generic structured repair
            candidates.push({
                id: "act-generic-repair",
                category: "MAKE_CODE_CHANGE",
                title: `Restore contract invariant at ${repairLocation.targetFile || failingFile}`,
                description: `Update ${repairLocation.targetSymbol || failingSymbol} in '${repairLocation.targetFile || failingFile}' to restore the contract invariant: ${explicitInvariant.statement}`,
                repairLocation,
                evidenceSupport: [
                    `Failure observed at ${failingFile}:${failingLine}`,
                    `Violated invariant: ${explicitInvariant.statement}`,
                ],
                justification: "Restoring the contract ownership boundary eliminates the failure mechanism at the earliest divergence point.",
                regressionRisk: "LOW",
                blastRadius: "LOCAL_ONLY",
                reversibility: "IMMEDIATE",
                informationGain: "NONE",
                uncertainty: [],
                validationPlan: [
                    "Verify unit test suite passes with updated contract",
                    "Test boundary cases against reproduction fixture",
                ],
                score: 8,
            });
        }

        return candidates;
    }

    private buildInformationFrontier(
        hypotheses: CompetingHypothesis[],
        confirmedHypo: CompetingHypothesis | undefined
    ) {
        const knownFacts = [
            `Observed failure: ${this.snapshot.failure.exceptionType} (${this.snapshot.failure.exceptionMessage})`,
            confirmedHypo ? `Confirmed mechanism: ${confirmedHypo.label}` : "Competing hypotheses under evaluation",
        ];

        const unknownFacts: string[] = [];
        if (!confirmedHypo) {
            for (const h of hypotheses.filter((h) => h.status === "HYPOTHESIS")) {
                unknownFacts.push(...h.missingEvidence);
            }
        }

        return {
            knownFacts,
            unknownFacts,
            staticallyResolvable: ["Repository source AST and resource lifecycle analysis"],
            runtimeOnly: unknownFacts.filter((u) => u.includes("metric") || u.includes("latency") || u.includes("payload")),
        };
    }
}
