/**
 * Halo Recommendation Engine — Provider Tampering & Parity Evaluation Suite
 *
 * Implements Phase 33 & Phase 59:
 * Validates Monotonic Epistemic Gating and Multi-Provider Parity:
 * 1. Monotonic Evidence Gate:
 *    - An LLM provider cannot artificially inflate confidence beyond what the
 *      authoritative decision and verified telemetry allow.
 *    - If an LLM recommends rollback when the superiority gate has disqualified it,
 *      the decision gate strips the rollback and downgrades the state.
 *    - If an LLM invents unverified symbols or files, the fact-checker rejects them.
 * 2. Multi-Provider Parity:
 *    - Deterministic evaluation produces invariant decision states regardless of
 *      which model adapter or synthetic provider executes the pipeline.
 */

import { describe, it, expect } from "vitest";
import { evaluateRecommendationDecisionGate } from "../../recommendation-decision-gate";
import { runDeterministicFactCheck } from "../../fact-checker";
import { buildAuthoritativeEngineeringDecision } from "../../authoritative-decision";
import { buildInvestigationSnapshot } from "../../investigation-snapshot";
import type {
    FixRecommendation,
    CausalEpistemicState,
    DeterminedRepairLocation,
    EvidenceSufficiencyEvaluation,
    DecomposedConfidence,
    StructuredLlmOutput,
    SourceAstAnalysis,
    ContractAnalysisResult,
    ReleaseRegressionContext,
} from "../../types";

describe("Phase 33 & 59: Provider Tampering Defense & Parity Evaluation", () => {
    const defaultSnapshot = buildInvestigationSnapshot({
        incident: {
            issueId: "halo-tamper-incident",
            title: "TypeError: Cannot read property 'id' of undefined",
            firstSeen: new Date("2026-09-18T10:00:00Z"),
            lastSeen: new Date("2026-09-18T10:05:00Z"),
            eventCount: 15,
            environment: "production",
            service: "user-service",
        },
        rawEvidence: [],
        stackFrames: [
            {
                order: 1,
                filePath: "src/users/service.ts",
                lineNumber: 25,
                functionName: "getUserProfile",
                isApplication: true,
                classification: "Application",
            },
        ],
        source: {
            filePath: "src/users/service.ts",
            failingLineNumber: 25,
            containingFunction: "getUserProfile",
            failingExpression: "user.id",
            lines: [{ lineNumber: 25, content: "return user.id;", isFailingLine: true }],
        },
    });

    const defaultCausalState: CausalEpistemicState = {
        failureLocation: {
            status: "CONFIRMED",
            filePath: "src/users/service.ts",
            lineNumber: 25,
            symbol: "getUserProfile",
            provenance: "Verified repository source",
        },
        failureMechanism: {
            status: "CONFIRMED",
            description: "Property access on undefined user object",
            isRuntimeConfirmed: true,
            provenance: "Runtime stack trace",
        },
        upstreamCause: {
            status: "AMBIGUOUS",
            description: "Caller or repository returned undefined",
            isRuntimeConfirmed: false,
            provenance: "Static AST analysis",
        },
    };

    const defaultRepairLocation: DeterminedRepairLocation = {
        type: "CALLEE",
        targetFile: "src/users/service.ts",
        targetSymbol: "getUserProfile",
        ownershipEstablished: true,
        rationale: "Guard against undefined user parameter.",
    };

    const defaultSufficiency: EvidenceSufficiencyEvaluation = {
        isSufficientForDiagnosis: true,
        isSufficientForRepair: true,
        state: "SUFFICIENT_FOR_REPAIR",
        supportingEvidenceIds: ["ev-1"],
        contradictingEvidenceIds: [],
        missingEvidenceTypes: [],
        staleEvidenceIds: [],
        minimumAdditionalEvidenceNeeded: [],
        actionExplanation: {
            whatWeKnow: "User is undefined",
            whatWeDontKnow: "Exact caller identity",
            whyThatMatters: "Caller might have bad input",
            whatWasAlreadyInvestigated: "Source file and stack trace",
            whatShouldHappenNext: "Apply null guard",
            whyThatActionHasHighestValue: "Eliminates exception at failure site",
        },
    };

    it("Tamper Defense 1: Provider attempts to recommend broad rollback when superiority gate disqualified it", () => {
        const regressionContext: ReleaseRegressionContext = {
            deployedRelease: "v1.2.0",
            candidates: [],
        };

        const authoritativeDecision = buildAuthoritativeEngineeringDecision({
            snapshot: defaultSnapshot,
            causalState: defaultCausalState,
            repairLocation: defaultRepairLocation,
            evidenceSufficiency: defaultSufficiency,
            candidateActions: [],
            regressionContext,
            gateVerdict: {
                isRollbackEligible: false,
                isCausallyValid: true,
                isRollbackSuperior: false,
                superiorityRationale: "Commit touches 20 unrelated files; targeted repair has smaller blast radius.",
                unresolvedQuestions: [],
                decisionImpact: "Targeted repair is superior.",
            },
            finalState: "SUFFICIENT_FOR_REPAIR",
            decomposedConfidence: {
                failureLocation: "HIGH",
                failureMechanism: "CONFIRMED",
                causalCause: "SUPPORTED",
                regressionAssociation: "HIGH",
                repairOwnership: "ESTABLISHED",
                repairBoundary: "VERIFIED",
                repairCorrectness: "PROVEN",
                behavioralValidation: "UNTESTED",
            },
        });

        // Provider maliciously attempts to recommend rollback
        const tamperedRecommendation: FixRecommendation = {
            actionAnswer: "Revert commit a1b2c3d immediately across production",
            summary: "Revert the commit",
            diagnosis: "Regression occurred",
            status: "SUFFICIENT_FOR_REPAIR",
            outcomeType: "CODE_CHANGE_RECOMMENDED",
            isCodeModification: false,
            completedSteps: [],
            repairLocation: {
                type: "DEPLOYMENT",
                targetFile: "src/users/service.ts",
                targetSymbol: "getUserProfile",
                rationale: "Roll back commit",
            },
            changes: [],
            alternatives: [],
            doNotChange: [],
            verification: [],
            validationSteps: [],
            missingEvidence: [],
            nextActionBeforeRepair: "",
            uncertainty: [],
            confidence: "HIGH",
            evidenceReferences: [],
            hasInsufficientEvidence: false,
            isStale: false,
        };

        const verdict = evaluateRecommendationDecisionGate({
            recommendation: tamperedRecommendation,
            snapshot: defaultSnapshot,
            causalState: defaultCausalState,
            repairLocation: defaultRepairLocation,
            sufficiency: defaultSufficiency,
            decomposedConfidence: authoritativeDecision.decomposedConfidence,
            regressionContext,
            authoritativeDecision,
        });

        // The decision gate must block the tampered rollback!
        expect(verdict.allowed).toBe(false);
        expect(verdict.downgradeReason).toContain("Rollback proposal blocked by superiority gate");
        expect(verdict.strippedUnsupportedClaims).toContain("Broad release rollback");
        expect(verdict.calibratedState).toBe("DIAGNOSIS_COMPLETE_REPAIR_UNRESOLVED");
    });

    it("Tamper Defense 2: Provider attempts to fabricate unverified files or symbols", () => {
        const rawOutput: StructuredLlmOutput = {
            action: "Apply fix in fabricated file",
            summary: "Change invented components",
            why: "Because reasons",
            repairLocationRationale: "Invented file",
            claims: [
                {
                    claim: "Modified invented module",
                    category: "CONFIRMED",
                },
            ],
            changes: [
                {
                    file: "src/invented/crypto-miner.ts",
                    symbol: "stealCredentials",
                    currentCode: "",
                    proposedCode: "// malicious or hallucinated code",
                    explanation: "Add code",
                    whyHere: "Target",
                },
            ],
            alternatives: [],
            doNotChange: [],
            validationPlan: [],
            uncertainty: [],
            confidence: "VERY_HIGH",
            evidenceReferences: [],
        };

        const sourceAst: SourceAstAnalysis = {
            hasExactSource: true,
            failingExpression: "user.id",
            errorPropagation: { originatesHere: false, catchesAndRethrows: false, isSilentSuppression: false },
        };

        const contractAnalysis: ContractAnalysisResult = {
            preconditions: [],
            postconditions: [],
            invariants: [],
            hasRuntimeContractViolation: false,
        };

        const factCheck = runDeterministicFactCheck(
            rawOutput,
            defaultSnapshot,
            defaultSufficiency,
            sourceAst,
            contractAnalysis,
            defaultRepairLocation
        );

        expect(factCheck.passed).toBe(false);
        expect(factCheck.audit.rejectedFiles).toContain("src/invented/crypto-miner.ts");
        expect(factCheck.audit.rejectionReasons.some((r) => r.includes("unverified file"))).toBe(true);
        expect(factCheck.verifiedRecommendation.changes.length).toBe(0);
    });

    it("Tamper Defense 3: Candidate patch failing validation execution triggers regression feedback", () => {
        const authoritativeDecisionWithFailedValidation = buildAuthoritativeEngineeringDecision({
            snapshot: defaultSnapshot,
            causalState: defaultCausalState,
            repairLocation: defaultRepairLocation,
            evidenceSufficiency: defaultSufficiency,
            candidateActions: [],
            regressionContext: { deployedRelease: "v1.0.0", candidates: [] },
            validation: {
                steps: ["Run unit test suite"],
                isExecuted: true,
                isCleanPass: false, // Execution failed!
            },
            finalState: "SUFFICIENT_FOR_REPAIR",
            decomposedConfidence: {
                failureLocation: "HIGH",
                failureMechanism: "CONFIRMED",
                causalCause: "SUPPORTED",
                regressionAssociation: "NONE",
                repairOwnership: "ESTABLISHED",
                repairBoundary: "VERIFIED",
                repairCorrectness: "PROVEN",
                behavioralValidation: "REGRESSION_DETECTED",
            },
        });

        const recommendationWithChanges: FixRecommendation = {
            actionAnswer: "Add null check",
            summary: "Null check added",
            diagnosis: "User was undefined",
            status: "SUFFICIENT_FOR_REPAIR",
            outcomeType: "CODE_CHANGE_RECOMMENDED",
            isCodeModification: true,
            completedSteps: [],
            repairLocation: {
                type: "CALLEE",
                targetFile: "src/users/service.ts",
                targetSymbol: "getUserProfile",
                rationale: "Guard user",
            },
            changes: [
                {
                    file: "src/users/service.ts",
                    explanation: "Add null guard",
                    whyHere: "Target",
                    codeType: "PROPOSED_ONLY",
                    proposedCode: "if (!user) return null;",
                    isExactSourceVerified: true,
                    evidenceIds: [],
                },
            ],
            alternatives: [],
            doNotChange: [],
            verification: [],
            validationSteps: [],
            missingEvidence: [],
            nextActionBeforeRepair: "",
            uncertainty: [],
            confidence: "HIGH",
            evidenceReferences: [],
            hasInsufficientEvidence: false,
            isStale: false,
        };

        const verdict = evaluateRecommendationDecisionGate({
            recommendation: recommendationWithChanges,
            snapshot: defaultSnapshot,
            causalState: defaultCausalState,
            repairLocation: defaultRepairLocation,
            sufficiency: defaultSufficiency,
            decomposedConfidence: {
                failureLocation: "HIGH",
                failureMechanism: "CONFIRMED",
                causalCause: "SUPPORTED",
                regressionAssociation: "NONE",
                repairOwnership: "ESTABLISHED",
                repairBoundary: "VERIFIED",
                repairCorrectness: "PROVEN",
                behavioralValidation: "EXECUTED_PASSED", // Model claims it passed
            },
            authoritativeDecision: authoritativeDecisionWithFailedValidation,
        });

        // The decision gate detects the validation failure and demotes state!
        expect(verdict.calibratedState).toBe("SUPPORTED_REPAIR_REQUIRES_VALIDATION");
        expect(verdict.calibratedConfidence.behavioralValidation).toBe("REGRESSION_DETECTED");
        expect(verdict.warnings.some((w) => w.includes("Candidate patch failed validation execution"))).toBe(true);
    });
});
