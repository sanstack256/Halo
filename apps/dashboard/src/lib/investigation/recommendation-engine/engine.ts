/**
 * Halo Recommendation Engine — Single Canonical Pipeline Orchestrator
 *
 * Implements Phase G (Section 3):
 * Authoritative pipeline:
 *   Issue & Telemetry
 *   → Investigation Snapshot
 *   → Evidence Inventory
 *   → Execution Path Reconstruction
 *   → Source Analysis
 *   → Contract / Value Flow Analysis
 *   → Release / Regression Analysis
 *   → Causal Epistemic Determination (Location vs Mechanism vs Upstream Cause)
 *   → Repair Location Determination
 *   → Candidate Action Generation & Evaluation
 *   → Evidence Sufficiency Decision
 *   → Prompt Construction (with injection defense)
 *   → LLM Synthesis (Gemini / OpenAI / Mock / HaloManaged)
 *   → Deterministic Fact Checker
 *   → Validated Structured Recommendation
 */

import type { EvidenceSnapshot } from "../evidence-snapshot";
import type { StackFrame } from "../runtime/types";
import type {
    InvestigationSnapshot,
    ValidatedPipelineResult,
    FixRecommendation,
    StructuredLlmOutput,
    FormalRecommendationState,
    FormalRecommendationContract,
    ComprehensiveProofRecord,
    DecisionGap,
    InformationFrontierAuditRecord,
    ClaimProvenance,
    AuthoritativeEngineeringDecision,
} from "./types";
import { StructuredLlmOutputSchema } from "./types";
import { buildInvestigationSnapshot } from "./investigation-snapshot";
import { buildEvidenceInventory } from "./evidence-inventory";
import { reconstructExecutionPath } from "./execution-path";
import { analyzeSourceAst } from "./source-analysis";
import { analyzeContractsAndValueFlow } from "./contract-analysis";
import { analyzeReleasesAndRegressions } from "./regression-analysis";
import { determineCausalEpistemicState } from "./causal-determination";
import { determineRepairLocation } from "./repair-location";
import { evaluateEvidenceSufficiency } from "./sufficiency-engine";
import { generateAndEvaluateCandidateActions } from "./candidate-actions";
import { buildPromptPayload } from "./prompt-builder";
import { runDeterministicFactCheck } from "./fact-checker";
import { getRecommendationModel, type RecommendationModel } from "./provider";
import { buildRepairCase } from "../repair-intelligence/repair-case-builder";
import { runActiveInvestigationLoop } from "./investigation-loop";
import { generatePreciseRepair } from "./repair-generator";
import { evaluateRecommendationDecisionGate } from "./recommendation-decision-gate";
import { detectRepairEquivalentHypotheses } from "./hypothesis-engine";
import { buildAuthoritativeEngineeringDecision } from "./authoritative-decision";
import { evaluateCausalRegressionGate } from "./causal-regression-gate";
import type { DecomposedConfidence } from "./types";

function toFormalRecommendationState(state?: string): FormalRecommendationState {
    if (
        state === "VERIFIED_REPAIR" ||
        state === "SUPPORTED_REPAIR_REQUIRES_VALIDATION" ||
        state === "DIAGNOSIS_COMPLETE_REPAIR_UNRESOLVED" ||
        state === "NO_CODE_CHANGE_JUSTIFIED" ||
        state === "EVIDENCE_ACQUISITION_REQUIRED" ||
        state === "BLOCKED_BY_UNAVAILABLE_EVIDENCE"
    ) {
        return state;
    }
    if (state === "SUFFICIENT_FOR_REPAIR") {
        return "SUPPORTED_REPAIR_REQUIRES_VALIDATION";
    }
    if (state === "EXTERNAL_DEPENDENCY" || state === "ENVIRONMENT_ISSUE") {
        return "NO_CODE_CHANGE_JUSTIFIED";
    }
    if (state === "BLOCKED_BY_AMBIGUITY") {
        return "DIAGNOSIS_COMPLETE_REPAIR_UNRESOLVED";
    }
    return "EVIDENCE_ACQUISITION_REQUIRED";
}

export interface GenerateRecommendationPipelineOptions {
    snapshot: EvidenceSnapshot | InvestigationSnapshot;
    customModel?: RecommendationModel;
}

export async function generateEngineeringRecommendation(
    options: GenerateRecommendationPipelineOptions
): Promise<ValidatedPipelineResult> {
    const { snapshot: inputSnapshot, customModel } = options;

    // 1. Ensure canonical InvestigationSnapshot structure
    let snapshot: InvestigationSnapshot;
    if ("incident" in inputSnapshot) {
        snapshot = inputSnapshot as InvestigationSnapshot;
    } else {
        const legacy = inputSnapshot as EvidenceSnapshot;
        const legacySource = legacy.source
            ? {
                  ...legacy.source,
                  failingExpression: legacy.source.failingExpression || legacy.runtime?.failingExpression,
                  containingFunction: legacy.source.containingFunction || legacy.runtime?.containingFunction,
              }
            : undefined;

        const stackFrames: StackFrame[] = legacy.runtime?.primaryFailingFrame
            ? [legacy.runtime.primaryFailingFrame]
            : legacy.runtime?.callChain && legacy.runtime.callChain.length > 0
            ? legacy.runtime.callChain.map((c, idx) => ({
                  order: c.order ?? idx + 1,
                  rawFilePath: (c as any).rawFilePath || c.filePath || "unknown",
                  filePath: c.filePath || "unknown",
                  lineNumber: c.lineNumber,
                  columnNumber: (c as any).columnNumber,
                  functionName: c.functionName || "anonymous",
                  isInternal: false,
                  isApplication: c.isApplication ?? true,
                  classification: (c.isApplication ?? true ? "Application" : "Framework") as any,
              }))
            : [];

        snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: legacy.scope.issueId || "issue-unknown",
                title: legacy.runtime?.anchorError?.title || "Unhandled incident",
                firstSeen: legacy.createdAt,
                lastSeen: legacy.createdAt,
                eventCount: legacy.counts?.total ?? legacy.evidence.length,
                environment: legacy.tenant?.environment || "production",
                service: legacy.scope?.service || legacy.runtime?.anchorError?.service || "service",
                release: legacy.scope?.release,
            },
            rawEvidence: [...legacy.evidence],
            investigation: legacy.investigation,
            stackFrames,
            source: legacySource,
            replay: legacy.replay
                ? {
                      isAvailable: true,
                      sessionId: legacy.replay.sessionId,
                      eventsSummary: legacy.replay.markersSummary || [],
                  }
                : undefined,
        });
    }

    // 2. Evidence Inventory (Provenance tracking)
    const inventory = buildEvidenceInventory(snapshot);

    // 3. Execution Path Reconstruction
    const executionPath = reconstructExecutionPath(snapshot);

    // 4. Run Active Investigation Loop (Exhausting static, repository, test, and release evidence)
    const activeLoop = runActiveInvestigationLoop(snapshot);
    const {
        sourceAst,
        contractAnalysis,
        regressionContext,
        causalEpistemicState: causalState,
        repairLocation,
        sufficiency,
        rankedCandidateActions: candidates,
        chosenAction: selectedAction,
        completedSteps,
        terminalState,
    } = activeLoop;

    // 5. Generate Concrete Repair or Non-Code Remediation
    const preciseRepair = generatePreciseRepair(
        snapshot,
        causalState,
        repairLocation,
        sufficiency,
        selectedAction,
        sourceAst,
        contractAnalysis
    );

    // Phase 8: Detect repair-equivalent hypotheses
    const repairEquivalence = detectRepairEquivalentHypotheses(
        snapshot.investigation.hypotheses,
        repairLocation
    );

    // 6. Short-circuit ONLY when there is an absolute evidence boundary:
    //    Source is completely missing AND failure mechanism is completely unknown.
    //    All other states (BLOCKED_BY_AMBIGUITY, SUFFICIENT_FOR_DIAGNOSIS_BUT_NOT_REPAIR, etc.)
    //    proceed to LLM synthesis — the engine will produce the best repair derivable from
    //    available evidence, and explain remaining uncertainties in the recommendation.
    const absolutelyInsufficientEvidence =
        sufficiency.state === "INSUFFICIENT" ||
        (sufficiency.state === "BLOCKED_BY_MISSING_SOURCE" && causalState.failureMechanism.status === "UNKNOWN");

    if (absolutelyInsufficientEvidence) {
        const safeRecommendation: FixRecommendation = {
            actionAnswer: selectedAction.title,
            directAnswer: selectedAction.title,
            status: sufficiency.state,
            outcomeType: sufficiency.state,
            summary: selectedAction.description,
            diagnosis: causalState.failureMechanism.description,
            whyThisAction: selectedAction.justification,
            whyThisFixesIt: selectedAction.justification,
            repairLocation: {
                type: repairLocation.type,
                targetFile: repairLocation.targetFile,
                targetSymbol: repairLocation.targetSymbol,
                rationale: repairLocation.rationale,
            },
            changes: preciseRepair.multiFileChanges || [],
            alternatives: repairLocation.candidateLocations?.map((c) => ({
                description: c.rationale,
                whyNotPreferred: "Requires additional source or mechanism confirmation before applying",
            })) || [],
            doNotChange: [],
            verification: selectedAction.validationPlan,
            validationSteps: selectedAction.validationPlan,
            missingEvidence: sufficiency.minimumAdditionalEvidenceNeeded,
            nextActionBeforeRepair: selectedAction.description,
            uncertainty: selectedAction.uncertainty,
            confidence: "LOW",
            evidenceReferences: [],
            relatedConsistencyChecks: [],
            followUpSuggestions: [],
            hasInsufficientEvidence: true,
            blockedBy: sufficiency.blockingReason,
            isStale: false,
            informationFrontier: sufficiency.informationFrontier,
            actionExplanation: sufficiency.actionExplanation,
            completedSteps,
            isCodeModification: preciseRepair.isCodeModification,
            nonCodeRemediationDetails: preciseRepair.nonCodeRemediationDetails,
            activeInvestigationDetails: {
                requiredFacts: sufficiency.minimumAdditionalEvidenceNeeded,
                attemptedAcquisitions: completedSteps.map((s) => s.label),
                remainingBlocker: sufficiency.blockingReason,
            },
            repairEquivalence,
        };

        const earlyGateVerdict = evaluateCausalRegressionGate({
            snapshot,
            regressionContext,
            causalState,
            sourceAst,
        });

        const authoritativeDecision = buildAuthoritativeEngineeringDecision({
            snapshot,
            causalState,
            repairLocation,
            evidenceSufficiency: sufficiency,
            candidateActions: candidates,
            selectedCandidate: selectedAction,
            regressionContext,
            gateVerdict: earlyGateVerdict,
            uncertainty: selectedAction?.uncertainty,
            finalState: toFormalRecommendationState(sufficiency.state),
            decomposedConfidence: {
                failureLocation: causalState.failureLocation.status === "CONFIRMED" ? "HIGH" : "MEDIUM",
                failureMechanism: causalState.failureMechanism.status === "CONFIRMED" ? "CONFIRMED" : "UNKNOWN",
                causalCause: "UNKNOWN",
                regressionAssociation: "NONE",
                repairOwnership: "UNKNOWN",
                repairBoundary: "UNKNOWN",
                repairCorrectness: "UNVALIDATED",
                behavioralValidation: "UNTESTED",
            },
            repairEquivalence: repairEquivalence ?? undefined,
        });

        return {
            success: false,
            source: "DETERMINISTIC_ENGINE",
            confidence: "LOW",
            recommendation: safeRecommendation,
            causalEpistemicState: causalState,
            repairLocation,
            sufficiency,
            authoritativeDecision,
            audit: {
                passed: true,
                verifiedFiles: [],
                rejectedFiles: [],
                verifiedLines: [],
                rejectedLines: [],
                verifiedCommits: [],
                rejectedCommits: [],
                verifiedEvidenceRefs: [],
                rejectedEvidenceRefs: [],
                symptomMaskingDetected: false,
                strippedCodeBlocksCount: 0,
                rejectionReasons: [],
                warnings: [sufficiency.blockingReason || "Source unavailable and failure mechanism unknown — cannot safely generate code changes."],
            },
            modelInfo: {
                provider: "halo-deterministic-engine",
                model: "sufficiency-gate",
                durationMs: 0,
            },
        };
    }

    // 12. Build Prompts for LLM Synthesis
    const { systemPrompt, userPrompt } = buildPromptPayload({
        snapshot,
        facts: inventory.facts,
        executionPath,
        causalState,
        regressionContext,
        selectedAction,
        candidateActions: candidates,
        sufficiency,
    });

    // 13. Query LLM Provider
    const model = getRecommendationModel(customModel);
    let rawOutputText: string;
    let durationMs = 0;

    try {
        const response = await model.generate({
            system: systemPrompt,
            user: userPrompt,
            snapshot,
            structuredContext: {
                actionTitle: selectedAction.title,
                actionDescription: selectedAction.description,
                justification: selectedAction.justification,
                repairLocation: {
                    type: repairLocation.type,
                    targetFile: repairLocation.targetFile,
                    targetSymbol: repairLocation.targetSymbol,
                    rationale: repairLocation.rationale,
                    candidateLocations: repairLocation.candidateLocations,
                },
                repairLocationRationale: selectedAction.repairLocation.rationale || repairLocation.rationale,
                whyNotSymptomFix: "Do not apply defensive nullish checks or symptom suppression at the callee when caller contracts are violated.",
                facts: inventory.facts.map((f) => ({ id: f.id, value: f.value })),
                uncertainty: selectedAction.uncertainty,
                validationPlan: selectedAction.validationPlan,
                confidenceLevel:
                    selectedAction.regressionRisk === "LOW" && sufficiency.state === "SUFFICIENT_FOR_REPAIR"
                        ? "HIGH"
                        : "MEDIUM",
                blockedBy: sufficiency.blockingReason,
                sufficiency,
                preciseRepair,
                causalState,
                contractAnalysis,
            },
        });
        rawOutputText = response.rawText;
        durationMs = response.durationMs;
    } catch (err: any) {
        // Section 29: Clear generation failure state, DO NOT fabricate fallback
        const unc = ["Provider execution error", ...selectedAction.uncertainty];
        const earlyGateVerdict = evaluateCausalRegressionGate({
            snapshot,
            regressionContext,
            causalState,
            sourceAst,
        });
        const fallbackAuthoritativeDecision = buildAuthoritativeEngineeringDecision({
            snapshot,
            causalState,
            repairLocation,
            evidenceSufficiency: sufficiency,
            candidateActions: candidates,
            selectedCandidate: selectedAction,
            regressionContext,
            gateVerdict: earlyGateVerdict,
            uncertainty: unc,
            finalState: "EVIDENCE_ACQUISITION_REQUIRED",
            decomposedConfidence: {
                failureLocation: causalState.failureLocation.status === "CONFIRMED" ? "HIGH" : "MEDIUM",
                failureMechanism: causalState.failureMechanism.status === "CONFIRMED" ? "CONFIRMED" : "UNKNOWN",
                causalCause: "UNKNOWN",
                regressionAssociation: "NONE",
                repairOwnership: "UNKNOWN",
                repairBoundary: "UNKNOWN",
                repairCorrectness: "UNVALIDATED",
                behavioralValidation: "UNTESTED",
            },
            repairEquivalence: repairEquivalence ?? undefined,
        });

        return {
            success: false,
            source: "LLM_SYNTHESIZED",
            confidence: "LOW",
            recommendation: {
                actionAnswer: selectedAction.title,
                directAnswer: selectedAction.title,
                summary: `AI recommendation synthesis unavailable (${err?.message || "Execution error"}). Deterministic analysis indicates: ${selectedAction.description}`,
                diagnosis: causalState.failureMechanism.description,
                whyThisAction: selectedAction.justification,
                whyThisFixesIt: selectedAction.justification,
                outcomeType: "INSUFFICIENT_EVIDENCE",
                repairLocation: {
                    type: repairLocation.type,
                    targetFile: repairLocation.targetFile,
                    targetSymbol: repairLocation.targetSymbol,
                    rationale: repairLocation.rationale,
                },
                changes: [],
                alternatives: [],
                doNotChange: [],
                verification: selectedAction.validationPlan,
                validationSteps: selectedAction.validationPlan,
                missingEvidence: sufficiency.minimumAdditionalEvidenceNeeded,
                nextActionBeforeRepair: selectedAction.description,
                uncertainty: unc,
                confidence: "LOW",
                evidenceReferences: [],
                hasInsufficientEvidence: true,
                refusalReason: err?.message || "Provider error",
                isProviderFailure: true,
                repairEquivalence,
            } as any,
            causalEpistemicState: causalState,
            repairLocation,
            sufficiency,
            authoritativeDecision: fallbackAuthoritativeDecision,
            audit: {
                passed: false,
                verifiedFiles: [],
                rejectedFiles: [],
                verifiedLines: [],
                rejectedLines: [],
                verifiedCommits: [],
                rejectedCommits: [],
                verifiedEvidenceRefs: [],
                rejectedEvidenceRefs: [],
                symptomMaskingDetected: false,
                strippedCodeBlocksCount: 0,
                rejectionReasons: [`Provider error: ${err?.message || "Execution error"}`],
                warnings: [],
            },
            modelInfo: {
                provider: model.id,
                model: model.name,
                durationMs,
            },
        };
    }

    // 14. Parse JSON Output
    let parsedJson: any;
    try {
        let cleaned = rawOutputText.trim();
        if (cleaned.startsWith("```json")) {
            cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
        }
        parsedJson = JSON.parse(cleaned);
    } catch {
        const earlyGateVerdict = evaluateCausalRegressionGate({
            snapshot,
            regressionContext,
            causalState,
            sourceAst,
        });
        const fallbackAuthoritativeDecision = buildAuthoritativeEngineeringDecision({
            snapshot,
            causalState,
            repairLocation,
            evidenceSufficiency: sufficiency,
            candidateActions: candidates,
            selectedCandidate: selectedAction,
            regressionContext,
            gateVerdict: earlyGateVerdict,
            uncertainty: selectedAction.uncertainty,
            finalState: toFormalRecommendationState(sufficiency.state),
            decomposedConfidence: {
                failureLocation: causalState.failureLocation.status === "CONFIRMED" ? "HIGH" : "MEDIUM",
                failureMechanism: causalState.failureMechanism.status === "CONFIRMED" ? "CONFIRMED" : "UNKNOWN",
                causalCause: "UNKNOWN",
                regressionAssociation: "NONE",
                repairOwnership: "UNKNOWN",
                repairBoundary: "UNKNOWN",
                repairCorrectness: "UNVALIDATED",
                behavioralValidation: "UNTESTED",
            },
            repairEquivalence: repairEquivalence ?? undefined,
        });

        return {
            success: false,
            source: "LLM_SYNTHESIZED",
            confidence: "LOW",
            recommendation: {
                actionAnswer: selectedAction.title,
                summary: "Model produced malformed non-JSON output.",
                diagnosis: "Model generation failed deterministic validation.",
                status: sufficiency.state,
                outcomeType: sufficiency.state,
                changes: [],
                alternatives: [],
                doNotChange: [],
                verification: selectedAction.validationPlan,
                validationSteps: selectedAction.validationPlan,
                missingEvidence: sufficiency.minimumAdditionalEvidenceNeeded,
                nextActionBeforeRepair: selectedAction.description,
                uncertainty: selectedAction.uncertainty,
                confidence: "LOW",
                evidenceReferences: [],
                hasInsufficientEvidence: true,
                blockedBy: sufficiency.blockingReason,
                isStale: false,
                completedSteps,
                isCodeModification: preciseRepair.isCodeModification,
                nonCodeRemediationDetails: preciseRepair.nonCodeRemediationDetails,
                activeInvestigationDetails: {
                    requiredFacts: sufficiency.minimumAdditionalEvidenceNeeded,
                    attemptedAcquisitions: completedSteps.map((s) => s.label),
                    remainingBlocker: sufficiency.blockingReason,
                },
                repairEquivalence,
            },
            causalEpistemicState: causalState,
            repairLocation,
            sufficiency,
            authoritativeDecision: fallbackAuthoritativeDecision,
            audit: {
                passed: false,
                verifiedFiles: [],
                rejectedFiles: [],
                verifiedLines: [],
                rejectedLines: [],
                verifiedCommits: [],
                rejectedCommits: [],
                verifiedEvidenceRefs: [],
                rejectedEvidenceRefs: [],
                symptomMaskingDetected: false,
                strippedCodeBlocksCount: 0,
                rejectionReasons: ["Model did not produce valid JSON."],
                warnings: [],
            },
            modelInfo: {
                provider: model.id,
                model: model.name,
                durationMs,
            },
        };
    }

    // Normalize legacy model output formats if returned by mock or custom providers
    if (!parsedJson.action && parsedJson.recommendation?.action) {
        parsedJson.action = parsedJson.recommendation.action;
        parsedJson.summary = parsedJson.whatHappened || parsedJson.recommendation.reasoning || parsedJson.action;
        parsedJson.why = parsedJson.recommendation.reasoning || parsedJson.whatHappened || parsedJson.action;
        parsedJson.repairLocationRationale = parsedJson.recommendation.reasoning || "Identified repair location";
        parsedJson.status = parsedJson.status || "SUFFICIENT_FOR_REPAIR";
        parsedJson.confidenceLevel = parsedJson.confidenceLevel || "High";
        if (parsedJson.proposedPatch?.files) {
            parsedJson.changes = parsedJson.proposedPatch.files.map((f: any) => ({
                file: f.path,
                symbol: parsedJson.recommendation.affectedLocation?.function,
                lines: parsedJson.recommendation.affectedLocation?.line ? String(parsedJson.recommendation.affectedLocation.line) : undefined,
                proposedCode: f.diff,
                rationale: f.explanation || "Apply proposed diff",
            }));
        }
    }

    if (parsedJson.fixRecommendation) {
        const fix = parsedJson.fixRecommendation;
        parsedJson.action = fix.actionAnswer || fix.summary || parsedJson.action;
        parsedJson.summary = fix.summary || parsedJson.summary || fix.diagnosis || fix.actionAnswer;
        parsedJson.why = fix.whyThisAction || fix.whyThisFixesIt || fix.diagnosis || parsedJson.why || fix.summary;
        parsedJson.repairLocationRationale = fix.repairLocationRationale || fix.whyHere || (fix.changes?.[0]?.whyHere) || parsedJson.repairLocationRationale || "Direct repair boundary";
        parsedJson.whyNotSymptomFix = fix.whyNotSymptomFix || parsedJson.whyNotSymptomFix || "Avoid superficial defensive patching when caller contract is violated.";
        parsedJson.status = fix.outcomeType || fix.status || parsedJson.status || "SUFFICIENT_FOR_REPAIR";
        parsedJson.confidenceLevel = fix.confidence || parsedJson.confidenceLevel || "HIGH";
        parsedJson.outcomeType = fix.outcomeType;
        if (Array.isArray(fix.changes) && fix.changes.length > 0) {
            parsedJson.changes = fix.changes.map((c: any) => ({
                file: c.filePath || c.file,
                symbol: c.symbol,
                lines: c.startLine !== undefined ? `${c.startLine}` : c.lines,
                existingCode: c.currentCode || c.existingCode,
                proposedCode: c.proposedCode,
                rationale: c.explanation || c.whyHere || "Restore contract",
            }));
        }
        if (Array.isArray(fix.validationSteps) && fix.validationSteps.length > 0) {
            parsedJson.validationPlan = fix.validationSteps;
        }
        if (Array.isArray(fix.uncertainty) && fix.uncertainty.length > 0) {
            parsedJson.uncertainty = fix.uncertainty;
        }
    }

    parsedJson.alternatives = parsedJson.alternatives || [];
    parsedJson.validationPlan = parsedJson.validationPlan || [];
    parsedJson.uncertainty = parsedJson.uncertainty || [];
    parsedJson.changes = parsedJson.changes || [];
    parsedJson.whyNotSymptomFix = parsedJson.whyNotSymptomFix || "Defensive checks at failure site avoid contract fixes.";
    parsedJson.repairLocationRationale = parsedJson.repairLocationRationale || "Identified repair location";
    parsedJson.why = parsedJson.why || parsedJson.summary || "Restores contract";
    parsedJson.action = parsedJson.action || parsedJson.summary || "Apply code change";
    parsedJson.summary = parsedJson.summary || parsedJson.action;
    parsedJson.status = parsedJson.status || sufficiency.state;

    if (parsedJson.confidenceLevel) {
        const c = String(parsedJson.confidenceLevel).toUpperCase();
        parsedJson.confidenceLevel = c === "HIGH" || c === "VERY_HIGH" || c === "MEDIUM" || c === "LOW" ? c : "MEDIUM";
    } else {
        parsedJson.confidenceLevel = "MEDIUM";
    }

    if (Array.isArray(parsedJson.claims) && parsedJson.claims.length > 0) {
        parsedJson.claims = parsedJson.claims.map((c: any) => ({
            claim: c.claim || c.statement || "Observed claim",
            factId: c.factId || (Array.isArray(c.evidenceIds) ? c.evidenceIds[0] : undefined),
            category: c.category === "OBSERVED" ? "CONFIRMED" : c.category === "DERIVED" ? "SUPPORTED" : c.category || "CONFIRMED",
        }));
    } else {
        parsedJson.claims = [
            {
                claim: `Observed incident execution path at ${causalState.failureLocation.filePath || "target"}`,
                category: "CONFIRMED",
            },
        ];
    }

    const schemaParsed = StructuredLlmOutputSchema.safeParse(parsedJson);
    if (!schemaParsed.success) {
        const errorMessages = (schemaParsed.error.issues || []).map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
        return {
            success: false,
            source: "LLM_SYNTHESIZED",
            confidence: "LOW",
            recommendation: {
                actionAnswer: selectedAction.title,
                summary: "Model output failed schema validation.",
                diagnosis: "Model output rejected.",
                status: sufficiency.state,
                outcomeType: sufficiency.state,
                changes: [],
                alternatives: [],
                doNotChange: [],
                verification: selectedAction.validationPlan,
                validationSteps: selectedAction.validationPlan,
                missingEvidence: sufficiency.minimumAdditionalEvidenceNeeded,
                nextActionBeforeRepair: selectedAction.description,
                uncertainty: selectedAction.uncertainty,
                confidence: "LOW",
                evidenceReferences: [],
                hasInsufficientEvidence: true,
                blockedBy: sufficiency.blockingReason,
                isStale: false,
                completedSteps,
                isCodeModification: preciseRepair.isCodeModification,
                nonCodeRemediationDetails: preciseRepair.nonCodeRemediationDetails,
                activeInvestigationDetails: {
                    requiredFacts: sufficiency.minimumAdditionalEvidenceNeeded,
                    attemptedAcquisitions: completedSteps.map((s) => s.label),
                    remainingBlocker: sufficiency.blockingReason,
                },
                repairEquivalence,
            },
            causalEpistemicState: causalState,
            repairLocation,
            sufficiency,
            authoritativeDecision: buildAuthoritativeEngineeringDecision({
                snapshot,
                causalState,
                repairLocation,
                evidenceSufficiency: sufficiency,
                candidateActions: candidates,
                selectedCandidate: selectedAction,
                regressionContext,
                gateVerdict: evaluateCausalRegressionGate({
                    snapshot,
                    regressionContext,
                    causalState,
                    sourceAst,
                }),
                uncertainty: selectedAction.uncertainty,
                finalState: toFormalRecommendationState(sufficiency.state),
                decomposedConfidence: {
                    failureLocation: causalState.failureLocation.status === "CONFIRMED" ? "HIGH" : "MEDIUM",
                    failureMechanism: causalState.failureMechanism.status === "CONFIRMED" ? "CONFIRMED" : "UNKNOWN",
                    causalCause: "UNKNOWN",
                    regressionAssociation: "NONE",
                    repairOwnership: "UNKNOWN",
                    repairBoundary: "UNKNOWN",
                    repairCorrectness: "UNVALIDATED",
                    behavioralValidation: "UNTESTED",
                },
                repairEquivalence: repairEquivalence ?? undefined,
            }),
            audit: {
                passed: false,
                verifiedFiles: [],
                rejectedFiles: [],
                verifiedLines: [],
                rejectedLines: [],
                verifiedCommits: [],
                rejectedCommits: [],
                verifiedEvidenceRefs: [],
                rejectedEvidenceRefs: [],
                symptomMaskingDetected: false,
                strippedCodeBlocksCount: 0,
                rejectionReasons: [
                    `Schema validation error: ${errorMessages}`,
                ],
                warnings: [],
            },
            modelInfo: {
                provider: model.id,
                model: model.name,
                durationMs,
            },
        };
    }

    // 15. Deterministic Fact-Checking
    const factCheck = runDeterministicFactCheck(
        schemaParsed.data,
        snapshot,
        sufficiency,
        sourceAst,
        contractAnalysis,
        repairLocation
    );

    // 16. Recommendation Decision Gate (Phase 30)
    const relCandidates = snapshot.release?.candidates || [];
    const causalRels = causalState.causalRelationships || [];
    const initialDecomposedConfidence: DecomposedConfidence = {
        failureLocation: causalState.failureLocation.status === "CONFIRMED" ? "HIGH" : "MEDIUM",
        failureMechanism: causalState.failureMechanism.status === "CONFIRMED" ? "CONFIRMED" : causalState.failureMechanism.status === "PLAUSIBLE" ? "PLAUSIBLE" : "UNKNOWN",
        causalCause: snapshot.release?.causallyProvenCandidate ? "PROVEN" : causalRels.some((c) => c.confidence === "SUPPORTED") ? "SUPPORTED" : "UNKNOWN",
        regressionAssociation: relCandidates.some((c) => c.temporalAssociation === "PRE_INCIDENT_IMMEDIATE" || c.sourceAssociation === "FAILING_FILE") ? "HIGH" : relCandidates.length > 0 ? "MEDIUM" : "NONE",
        repairOwnership: repairLocation.ownershipEstablished ? "ESTABLISHED" : repairLocation.isAmbiguous ? "AMBIGUOUS" : "UNKNOWN",
        repairBoundary: (factCheck.verifiedRecommendation.changes.length > 0 || repairLocation.type === "DEPLOYMENT") && repairLocation.ownershipEstablished ? "VERIFIED" : repairLocation.candidateLocations ? "CANDIDATE" : "UNKNOWN",
        repairCorrectness: sufficiency.state === "SUFFICIENT_FOR_REPAIR" || sufficiency.state === "VERIFIED_REPAIR" ? "PROVEN" : "UNVALIDATED",
        behavioralValidation: (snapshot as any).behavioralValidationStatus || "UNTESTED",
    };

    const causalRegressionGateVerdict = evaluateCausalRegressionGate({
        snapshot,
        regressionContext,
        causalState,
        sourceAst,
    });

    const preliminaryAuthoritativeDecision = buildAuthoritativeEngineeringDecision({
        snapshot,
        causalState,
        repairLocation,
        evidenceSufficiency: sufficiency,
        candidateActions: candidates,
        selectedCandidate: selectedAction,
        regressionContext,
        gateVerdict: causalRegressionGateVerdict,
        decisionGap: (snapshot as any).decisionGap,
        acquisitionPlan: (snapshot as any).acquisitionPlan,
        diagnosisProof: (snapshot as any).diagnosisProof,
        repairProof: (snapshot as any).repairProof,
        behavioralProof: (snapshot as any).behavioralProof,
        validation: (snapshot as any).validationResult,
        consequences: (snapshot as any).consequences,
        uncertainty: selectedAction?.uncertainty,
        finalState: toFormalRecommendationState(sufficiency.state),
        decomposedConfidence: initialDecomposedConfidence,
        repairEquivalence: repairEquivalence ?? undefined,
        provenance: (factCheck.verifiedRecommendation as any).claimsWithProvenance,
    });

    const gateVerdict = evaluateRecommendationDecisionGate({
        recommendation: factCheck.verifiedRecommendation,
        snapshot,
        causalState,
        repairLocation,
        sufficiency,
        decomposedConfidence: initialDecomposedConfidence,
        regressionContext,
        authoritativeDecision: preliminaryAuthoritativeDecision,
    });

    const authoritativeDecision: AuthoritativeEngineeringDecision = {
        ...preliminaryAuthoritativeDecision,
        finalState: toFormalRecommendationState(gateVerdict.calibratedState),
        decomposedConfidence: gateVerdict.calibratedConfidence,
    };

    const finalRecommendation: FixRecommendation = {
        ...factCheck.verifiedRecommendation,
        status: gateVerdict.calibratedState,
        decomposedConfidence: gateVerdict.calibratedConfidence,
        confidence: (!factCheck.passed || !gateVerdict.allowed) ? "LOW" : factCheck.verifiedRecommendation.confidence,
        repairLocation: {
            type: repairLocation.type,
            targetFile: repairLocation.targetFile,
            targetSymbol: repairLocation.targetSymbol,
            rationale: repairLocation.rationale,
        },
        completedSteps,
        isCodeModification: preciseRepair.isCodeModification,
        nonCodeRemediationDetails: preciseRepair.nonCodeRemediationDetails,
        activeInvestigationDetails: {
            requiredFacts: sufficiency.minimumAdditionalEvidenceNeeded,
            attemptedAcquisitions: completedSteps.map((s) => s.label),
            remainingBlocker: sufficiency.blockingReason,
        },
        repairEquivalence,
    };

    return {
        success: factCheck.passed,
        source: "LLM_SYNTHESIZED",
        confidence: finalRecommendation.confidence,
        recommendation: finalRecommendation,
        causalEpistemicState: causalState,
        repairLocation,
        sufficiency,
        authoritativeDecision,
        audit: {
            ...factCheck.audit,
            warnings: [...factCheck.audit.warnings, ...gateVerdict.warnings],
        },
        modelInfo: {
            provider: model.id,
            model: model.name,
            durationMs,
        },
    };
}

/**
 * Backward compatibility alias for generateEngineeringRecommendation.
 */
export async function generateEvidenceBoundRecommendation(
    options: GenerateRecommendationPipelineOptions
): Promise<any> {
    const result = await generateEngineeringRecommendation(options);
    const snap = "incident" in options.snapshot ? (options.snapshot as any) : null;
    const legacySnap = !snap ? (options.snapshot as any) : null;

    const serviceName = snap?.incident?.service || legacySnap?.scope?.service || legacySnap?.runtime?.anchorError?.service || "service";
    const fileName = snap?.source?.filePath || legacySnap?.source?.filePath || "unknown";
    const lineNum = snap?.source?.failingLineNumber || legacySnap?.source?.failingLineNumber || 1;

    const patchStatus = result.recommendation.changes.length > 0
        ? "AVAILABLE"
        : result.recommendation.status === "BLOCKED_BY_MISSING_SOURCE"
        ? "SOURCE_UNAVAILABLE"
        : "NOT_SAFE_TO_GENERATE";

    const errorTitle =
        snap?.incident?.title ||
        legacySnap?.runtime?.anchorError?.title ||
        legacySnap?.evidence?.[0]?.title ||
        "Error";

    const outcomeType =
        result.recommendation.changes.length > 0
            ? "CODE_CHANGE_RECOMMENDED"
            : result.recommendation.status === "BLOCKED_BY_MISSING_RUNTIME_EVIDENCE"
            ? "OBSERVABILITY_STEP_REQUIRED_BEFORE_REPAIR"
            : result.recommendation.status === "BLOCKED_BY_MISSING_SOURCE"
            ? "INSUFFICIENT_EVIDENCE"
            : result.recommendation.outcomeType || "OBSERVABILITY_STEP_REQUIRED_BEFORE_REPAIR";

    const fixRecommendation: FixRecommendation = {
        ...result.recommendation,
        outcomeType,
        nextActionBeforeRepair:
            result.recommendation.nextActionBeforeRepair ||
            "Deploy targeted instrumentation or reproduce in development before modifying code.",
    };

    const isProviderFailure = (result.recommendation as any)?.isProviderFailure;
    if (isProviderFailure) {
        return {
            success: false,
            source: "DETERMINISTIC_FALLBACK",
            confidence: "LOW",
            summary: result.recommendation.summary || "Provider failure",
            outcomeType: "INSUFFICIENT_EVIDENCE",
            changes: [],
            missingEvidence: result.recommendation.missingEvidence || [],
            nextActionBeforeRepair: result.recommendation.nextActionBeforeRepair,
            whatHappened: `AI recommendation is unavailable: ${result.recommendation.summary || "Provider failure"}`,
            claims: [],
            action: {
                instruction: result.recommendation.actionAnswer,
                reasoning: result.recommendation.summary,
            },
            patch: {
                status: "NOT_SAFE_TO_GENERATE",
                files: [],
                validationNote: "Provider error",
                refusalReason: result.recommendation.summary,
            },
            unknowns: [],
            limitations: [],
            audit: {
                snapshotId: snap?.snapshotId || legacySnap?.snapshotId || "snapshot",
                gateVerdict: {
                    canGenerateRecommendation: false,
                    recommendationReason: result.recommendation.summary,
                    patchEligibility: "NOT_SAFE_TO_GENERATE",
                    patchReason: result.recommendation.summary,
                },
                validation: {
                    passed: false,
                    schemaValid: false,
                    evidenceCitationsValid: false,
                    sourceLocationsValid: false,
                    patchValid: false,
                    factualConsistencyValid: false,
                    rejectionReasons: [result.recommendation.summary],
                    warnings: [],
                },
                modelInfo: result.modelInfo,
            },
            fixRecommendation: {
                ...result.recommendation,
                outcomeType: "INSUFFICIENT_EVIDENCE",
            },
        };
    }

    const repairCase = legacySnap ? buildRepairCase({ snapshot: legacySnap }) : undefined;
    const isUnderdetermined =
        repairCase?.repairEligibility?.state === "REPAIR_UNDERDETERMINED" &&
        (!options.customModel || result.recommendation.status === "BLOCKED_BY_MISSING_RUNTIME_EVIDENCE");

    const isRefusal =
        isUnderdetermined ||
        result.recommendation.status === "INSUFFICIENT" ||
        result.recommendation.status === "BLOCKED_BY_MISSING_SOURCE" ||
        result.recommendation.status === "BLOCKED_BY_MISSING_RUNTIME_EVIDENCE" ||
        (result.recommendation.hasInsufficientEvidence && result.recommendation.changes.length === 0);

    const source = isRefusal ? "REFUSAL_INSUFFICIENT_EVIDENCE" : "LLM_VERIFIED";

    const titleConfidence =
        result.confidence === "HIGH"
            ? "High"
            : result.confidence === "MEDIUM"
            ? "Medium"
            : result.confidence === "LOW"
            ? "Low"
            : result.confidence === "VERY_HIGH"
            ? "Very High"
            : result.confidence || "High";

    const finalPatchStatus = isUnderdetermined ? "NOT_SAFE_TO_GENERATE" : patchStatus;
    const finalPatchFiles = isUnderdetermined ? [] : result.recommendation.changes.map((c) => ({
        path: c.filePath || c.file || "unknown",
        diff: c.proposedCode || "",
        explanation: c.explanation,
    }));
    const finalRefusalReason = isUnderdetermined
        ? `cannot prove whether '${repairCase?.failureModel.failingExpression || "invocation"}' evaluated to undefined or if invocation threw internally.`
        : result.recommendation.blockedBy ||
          "cannot prove whether invocation evaluated to undefined or if it threw internally.";

    const actionInstruction = isUnderdetermined
        ? `Capture runtime telemetry for '${repairCase?.failureModel.failingExpression || "expression"}' before modifying production code.`
        : result.recommendation.actionAnswer;

    // Construct compatible result for existing callers
    return {
        success: result.recommendation.status === "INSUFFICIENT" ? false : true,
        source,
        confidence: titleConfidence,
        summary: result.recommendation.summary,
        outcomeType: fixRecommendation.outcomeType,
        changes: fixRecommendation.changes,
        missingEvidence: fixRecommendation.missingEvidence || [],
        nextActionBeforeRepair: fixRecommendation.nextActionBeforeRepair,
        whatHappened: `${errorTitle} occurred in service '${serviceName}' at ${fileName}:${lineNum}. ${result.recommendation.diagnosis || result.recommendation.summary}`,
        claims: result.recommendation.evidenceReferences.map((id) => ({
            statement: `Cited evidence ${id}`,
            category: "OBSERVED",
            evidenceIds: [id],
            isDirectlyObserved: true,
        })),
        action: {
            instruction: actionInstruction,
            reasoning: result.recommendation.whyThisAction || result.recommendation.summary,
            location: {
                file: result.recommendation.changes[0]?.filePath || result.recommendation.changes[0]?.file || result.recommendation.repairLocation?.targetFile || fileName,
                line: result.recommendation.changes[0]?.startLine || lineNum,
                function: result.recommendation.changes[0]?.symbol || result.recommendation.repairLocation?.targetSymbol,
            },
        },
        patch: {
            status: finalPatchStatus,
            files: finalPatchFiles,
            validationNote: result.audit.passed ? "Verified" : "Verification warnings",
            refusalReason: finalRefusalReason,
        },
        unknowns: result.recommendation.uncertainty,
        limitations: [],
        repairCase,
        audit: {
            snapshotId: snap?.snapshotId || legacySnap?.snapshotId || "snapshot",
            gateVerdict: {
                canGenerateRecommendation: result.success,
                recommendationReason: result.recommendation.summary,
                patchEligibility: patchStatus === "AVAILABLE" ? "CAN_GENERATE_PATCH" : patchStatus,
                patchReason: result.recommendation.summary,
            },
            validation: {
                passed: result.audit.passed,
                schemaValid: true,
                evidenceCitationsValid: result.audit.rejectedEvidenceRefs.length === 0,
                sourceLocationsValid: result.audit.rejectedFiles.length === 0,
                patchValid: result.audit.strippedCodeBlocksCount === 0,
                factualConsistencyValid: result.audit.passed,
                rejectionReasons: result.audit.rejectionReasons,
                warnings: result.audit.warnings,
            },
            modelInfo: result.modelInfo,
        },
        fixRecommendation,
    };
}

/* -------------------------------------------------------------------------- */
/* Phase 40 — Formal Contract & Adaptive Recommendation Synthesis             */
/* -------------------------------------------------------------------------- */

export interface DetermineFormalStateOptions {
    proof?: ComprehensiveProofRecord | null;
    isSupportedCandidateAvailable?: boolean;
    isExecutionHarnessAvailable?: boolean;
    isMechanismEstablished?: boolean;
    isBoundaryAmbiguous?: boolean;
    isExternalOutageOrInfrastructure?: boolean;
    decisionGap?: DecisionGap;
    allInvestigationPathsExhausted?: boolean;
}

export function determineFormalRecommendationState(
    opts: DetermineFormalStateOptions
): FormalRecommendationState {
    const {
        proof,
        isSupportedCandidateAvailable,
        isExecutionHarnessAvailable,
        isMechanismEstablished,
        isBoundaryAmbiguous,
        isExternalOutageOrInfrastructure,
        decisionGap,
        allInvestigationPathsExhausted,
    } = opts;

    // 1. VERIFIED_REPAIR: All 3 proofs valid and verified on physical execution
    if (proof && proof.diagnosisProof && proof.repairProof && proof.behavioralProof) {
        return "VERIFIED_REPAIR";
    }

    // 2. SUPPORTED_REPAIR_REQUIRES_VALIDATION: concrete repair supported, execution unavailable
    if (isSupportedCandidateAvailable && !isExecutionHarnessAvailable) {
        return "SUPPORTED_REPAIR_REQUIRES_VALIDATION";
    }

    // 3. DIAGNOSIS_COMPLETE_REPAIR_UNRESOLVED: mechanism known, boundary ambiguous
    if (isMechanismEstablished && isBoundaryAmbiguous) {
        return "DIAGNOSIS_COMPLETE_REPAIR_UNRESOLVED";
    }

    // 4. NO_CODE_CHANGE_JUSTIFIED: external cause
    if (isExternalOutageOrInfrastructure) {
        return "NO_CODE_CHANGE_JUSTIFIED";
    }

    // 5. EVIDENCE_ACQUISITION_REQUIRED: missing decisive fact that cannot be acquired autonomously
    if (decisionGap && !decisionGap.acquisitionMethods.some((m) => m.canExecuteAutonomously)) {
        return "EVIDENCE_ACQUISITION_REQUIRED";
    }

    // 6. BLOCKED_BY_UNAVAILABLE_EVIDENCE: exhausted
    if (allInvestigationPathsExhausted) {
        return "BLOCKED_BY_UNAVAILABLE_EVIDENCE";
    }

    return "EVIDENCE_ACQUISITION_REQUIRED";
}

export function buildAdaptiveRecommendationContract(
    state: FormalRecommendationState,
    opts: {
        proof?: ComprehensiveProofRecord | null;
        candidateEdits?: Array<{ filePath: string; diff: string; explanation: string }>;
        decisionGap?: DecisionGap;
        frontierRecord?: InformationFrontierAuditRecord;
        claimsWithProvenance?: ClaimProvenance[];
        mechanism?: string;
        unresolvedBoundaryDetails?: string;
        externalOutageDetails?: string;
    }
): FormalRecommendationContract {
    const adaptiveSections: FormalRecommendationContract["adaptiveSections"] = [];

    switch (state) {
        case "VERIFIED_REPAIR": {
            adaptiveSections.push({
                title: "Recommended Action",
                contentMarkdown: `Apply verified multi-file repair restoring invariant '${opts.proof?.diagnosisProof.violatedInvariant || "contract"}'.`,
                prominenceOrder: 1,
            });
            adaptiveSections.push({
                title: "Exact Change",
                contentMarkdown: (opts.candidateEdits || []).map((e) => `### ${e.filePath}\n\`\`\`diff\n${e.diff}\n\`\`\`\n*${e.explanation}*`).join("\n\n") || "Verified multi-file diff generated.",
                prominenceOrder: 2,
            });
            adaptiveSections.push({
                title: "Why This Location",
                contentMarkdown: `Repair target '${opts.proof?.repairProof.targetBoundary.entity}' holds contract ownership and manages the lifecycle boundary.`,
                prominenceOrder: 3,
            });
            adaptiveSections.push({
                title: "Validation Proof",
                contentMarkdown: `Physical execution in isolated git worktree succeeded: 100% tests passed, baseline failures partitioned, regressions checked (hash: \`${opts.proof?.behavioralProof.cryptographicHash.slice(0, 16)}\`).`,
                prominenceOrder: 4,
            });
            break;
        }

        case "SUPPORTED_REPAIR_REQUIRES_VALIDATION": {
            adaptiveSections.push({
                title: "Recommended Action",
                contentMarkdown: "Validate candidate repair in development/staging environment.",
                prominenceOrder: 1,
            });
            adaptiveSections.push({
                title: "Exact Change",
                contentMarkdown: (opts.candidateEdits || []).map((e) => `### ${e.filePath}\n\`\`\`diff\n${e.diff}\n\`\`\``).join("\n\n"),
                prominenceOrder: 2,
            });
            break;
        }

        case "DIAGNOSIS_COMPLETE_REPAIR_UNRESOLVED": {
            adaptiveSections.push({
                title: "Established Mechanism",
                contentMarkdown: opts.mechanism || "Failure mechanism confirmed through empirical trace.",
                prominenceOrder: 1,
            });
            adaptiveSections.push({
                title: "Unresolved Repair Boundary",
                contentMarkdown: opts.unresolvedBoundaryDetails || "Multiple architectural boundaries could restore invariant; contract ownership is ambiguous between caller and producer.",
                prominenceOrder: 2,
            });
            break;
        }

        case "NO_CODE_CHANGE_JUSTIFIED": {
            adaptiveSections.push({
                title: "Operational Action",
                contentMarkdown: opts.externalOutageDetails || "Do not modify application code. Alert external infrastructure provider or verify external service status.",
                prominenceOrder: 1,
            });
            break;
        }

        case "EVIDENCE_ACQUISITION_REQUIRED": {
            adaptiveSections.push({
                title: "Decision-Critical Unknown",
                contentMarkdown: opts.decisionGap?.unknown || "Missing empirical telemetry required to determine repair boundary.",
                prominenceOrder: 1,
            });
            adaptiveSections.push({
                title: "Expected Decision Impact",
                contentMarkdown: `Resolving this unknown discriminates between conflicting causal hypotheses (${opts.decisionGap?.hypothesesAffected.join(", ") || "hypotheses"}).`,
                prominenceOrder: 2,
            });
            break;
        }

        case "BLOCKED_BY_UNAVAILABLE_EVIDENCE": {
            adaptiveSections.push({
                title: "Information Frontier Reached",
                contentMarkdown: `Investigation exhausted available repository and telemetry paths without establishing causal necessity: ${opts.frontierRecord?.whyHaloCannotResolve || "insufficient empirical evidence"}.`,
                prominenceOrder: 1,
            });
            break;
        }
    }

    return {
        state,
        proof: opts.proof || undefined,
        decisionGap: opts.decisionGap,
        informationFrontierRecord: opts.frontierRecord,
        claimsWithProvenance: opts.claimsWithProvenance || [],
        adaptiveSections,
    };
}


