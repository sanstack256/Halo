/**
 * Halo Trace — Decomposed Confidence & Decision Gate Evaluation Suite (Phase 35)
 *
 * Enforces Epistemic Parity and Invariant:
 * "NO ENGINEERING DECISION MAY BE STRONGER THAN THE EVIDENCE REQUIRED TO JUSTIFY THAT DECISION."
 *
 * Verifies:
 * 1. High location + Unknown mechanism -> blocks VERIFIED_REPAIR, state is BLOCKED or ACQUISITION_REQUIRED.
 * 2. High regression association + Unknown mechanism -> blocks rollback, causalCause is UNKNOWN.
 * 3. Proven mechanism + Ambiguous ownership -> blocks code fix, state is DIAGNOSIS_COMPLETE_REPAIR_UNRESOLVED.
 * 4. Fully verified repair with executed proof -> allows VERIFIED_REPAIR with PROVEN correctness.
 * 5. Decision Gate strips speculative claims and enforces auditability.
 */

import { describe, it, expect } from "vitest";
import { buildInvestigationSnapshot } from "../../investigation-snapshot";
import { generateEngineeringRecommendation } from "../../engine";
import { runActiveInvestigationLoop } from "../../investigation-loop";
import { evaluateRecommendationDecisionGate } from "../../recommendation-decision-gate";
import type {
    InvestigationSnapshot,
    FixRecommendation,
    CausalEpistemicState,
    DeterminedRepairLocation,
    EvidenceSufficiencyEvaluation,
    DecomposedConfidence,
} from "../../types";

describe("Phase 35: Decomposed Confidence & Decision Gate Evaluation Suite", () => {

    // -------------------------------------------------------------------------
    // Test 1: High Location + Unknown Mechanism
    // -------------------------------------------------------------------------
    it("High location + Unknown mechanism -> blocks VERIFIED_REPAIR, state is BLOCKED or ACQUISITION_REQUIRED", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "decomposed-gate-1",
                title: "RuntimeError: Dynamic dispatch failed during handler execution",
                firstSeen: new Date("2026-09-18T11:00:00Z"),
                lastSeen: new Date("2026-09-18T11:05:00Z"),
                eventCount: 15,
                environment: "production",
                service: "auth-service",
            },
            rawEvidence: [
                {
                    id: "ev-gate-1",
                    type: "ERROR",
                    title: "RuntimeError: Dynamic dispatch failed during handler execution",
                    timestamp: new Date("2026-09-18T11:00:00Z"),
                    service: "auth-service",
                    environment: "production",
                    source: "runtime",
                    metadata: {},
                    tags: { exceptionType: "RuntimeError", message: "Dynamic dispatch failed during handler execution" },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    rawFilePath: "src/auth/session.ts",
                    filePath: "src/auth/session.ts",
                    lineNumber: 42,
                    functionName: "loadSession",
                    isApplication: true,
                    isInternal: false,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/auth/session.ts",
                startLineNumber: 41,
                failingLineNumber: 42,
                containingFunction: "loadSession",
                failingExpression: "await handler.execute(context)",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 41, content: "export async function loadSession(handler: any, context: any) {", isFailingLine: false },
                    { lineNumber: 42, content: "    return await handler.execute(context);", isFailingLine: true },
                    { lineNumber: 43, content: "}", isFailingLine: false },
                ],
            },
            // Zero confirmed hypotheses, missing runtime variable telemetry
            investigation: {
                hypotheses: [
                    {
                        id: "hypo-unconfirmed",
                        title: "Dynamic handler might fail during execute invocation",
                        description: "Telemetry lacks runtime variable dump for handler parameter",
                        status: "PROPOSED",
                        likelihood: "UNKNOWN",
                        confidence: 0.3,
                        supportedEvidence: [],
                    },
                ],
                findings: [],
                causalChains: [],
                rootCause: null,
            },
        });

        const res = await generateEngineeringRecommendation({ snapshot });

        // Invariant: Cannot be VERIFIED_REPAIR or emit high-certainty patch without confirmed mechanism
        expect(res.recommendation.status).not.toBe("VERIFIED_REPAIR");
        expect(res.recommendation.status).toMatch(/BLOCKED|EVIDENCE_ACQUISITION_REQUIRED/);

        // Decomposed Confidence Matrix Verification
        const conf = res.recommendation.decomposedConfidence;
        expect(conf).toBeDefined();
        // Location is precisely known from stack trace and AST
        expect(conf?.failureLocation).toBe("HIGH");
        // Mechanism is not confirmed due to lack of runtime telemetry
        expect(conf?.failureMechanism).toBe("UNKNOWN");
        // Correctness cannot be proven without validated mechanism
        expect(conf?.repairCorrectness).toBe("UNVALIDATED");

        // Action recommended should be to acquire missing telemetry, NOT mutate code
        const loop = runActiveInvestigationLoop(snapshot);
        expect(loop.chosenAction?.category).toBe("COLLECT_MISSING_RUNTIME_SIGNAL");
    });

    // -------------------------------------------------------------------------
    // Test 2: High Regression Association + Unknown Mechanism
    // -------------------------------------------------------------------------
    it("High regression association + Unknown mechanism -> blocks rollback, causalCause is UNKNOWN", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "decomposed-gate-2",
                title: "Error: Unexpected worker termination",
                firstSeen: new Date("2026-09-18T11:15:00Z"),
                lastSeen: new Date("2026-09-18T11:20:00Z"),
                eventCount: 8,
                environment: "production",
                service: "worker-service",
            },
            rawEvidence: [
                {
                    id: "ev-gate-2",
                    type: "ERROR",
                    title: "Error: Unexpected worker termination",
                    timestamp: new Date("2026-09-18T11:15:00Z"),
                    service: "worker-service",
                    environment: "production",
                    source: "runtime",
                    metadata: {},
                    tags: { message: "Unexpected worker termination" },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    rawFilePath: "src/worker/pool.ts",
                    filePath: "src/worker/pool.ts",
                    lineNumber: 88,
                    functionName: "dispatchWorker",
                    isApplication: true,
                    isInternal: false,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/worker/pool.ts",
                startLineNumber: 87,
                failingLineNumber: 88,
                containingFunction: "dispatchWorker",
                failingExpression: "worker.terminate()",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 87, content: "function dispatchWorker(worker: Worker) {", isFailingLine: false },
                    { lineNumber: 88, content: "    worker.terminate();", isFailingLine: true },
                    { lineNumber: 89, content: "}", isFailingLine: false },
                ],
            },
            // Release commit deployed immediately prior, but modified docs and comments
            release: {
                candidates: [
                    {
                        commitSha: "88a91b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a",
                        shortSha: "88a91b2",
                        author: "Alice",
                        commitMessage: "docs: update worker architecture guide and inline comments",
                        deployedAt: "2026-09-18T11:13:00Z",
                        temporalAssociation: "PRE_INCIDENT_IMMEDIATE",
                        sourceAssociation: "UNRELATED" as any,
                        executionRelevance: "UNREACHABLE" as any,
                        behavioralRelevance: "CORRELATED_ONLY" as any,
                        mechanismRelevance: "UNKNOWN" as any,
                        causalSupport: "UNSUPPORTED" as any,
                        classification: "BENIGN_CONCURRENT_CHANGE" as any,
                        changedFiles: ["docs/workers.md", "src/worker/README.md"],
                        modifiesFailingFile: false,
                        modifiesFailingSymbol: false,
                        directlyModifiesFailingLine: false,
                    } as any,
                ],
            },
            investigation: {
                hypotheses: [],
                findings: [],
                causalChains: [],
                rootCause: null,
            },
        });

        const res = await generateEngineeringRecommendation({ snapshot });

        // Invariant: Rollback must NOT be recommended when commit is benign and mechanism is unproven
        expect(res.repairLocation?.type).not.toBe("DEPLOYMENT");
        expect(res.recommendation.actionAnswer?.toLowerCase()).not.toContain("revert 88a91b2");
        expect(res.recommendation.actionAnswer?.toLowerCase()).not.toContain("roll back 88a91b2");

        // Decomposed Confidence Matrix Verification
        const conf = res.recommendation.decomposedConfidence;
        expect(conf).toBeDefined();
        // High temporal association because deployment occurred 2 minutes prior
        expect(conf?.regressionAssociation).toBe("HIGH");
        // But causal cause is completely UNKNOWN
        expect(conf?.causalCause).toBe("UNKNOWN");
        // Mechanism is UNKNOWN
        expect(conf?.failureMechanism).toBe("UNKNOWN");
    });

    // -------------------------------------------------------------------------
    // Test 3: Proven Mechanism + Ambiguous Ownership
    // -------------------------------------------------------------------------
    it("Proven mechanism + Ambiguous ownership -> blocks code fix, state is DIAGNOSIS_COMPLETE_REPAIR_UNRESOLVED", async () => {
        // Direct unit test of evaluateRecommendationDecisionGate
        const mockSnapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "decomposed-gate-3",
                title: "TypeError: Cannot read properties of undefined (reading 'rate')",
                firstSeen: new Date("2026-09-18T11:30:00Z"),
                lastSeen: new Date("2026-09-18T11:35:00Z"),
                eventCount: 4,
                environment: "production",
                service: "tax-service",
            },
            rawEvidence: [],
            stackFrames: [
                {
                    order: 1,
                    rawFilePath: "src/callee.ts",
                    filePath: "src/callee.ts",
                    lineNumber: 10,
                    functionName: "computeTax",
                    isApplication: true,
                    isInternal: false,
                    classification: "Application",
                },
                {
                    order: 2,
                    rawFilePath: "src/caller.ts",
                    filePath: "src/caller.ts",
                    lineNumber: 25,
                    functionName: "processOrder",
                    isApplication: true,
                    isInternal: false,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/callee.ts",
                startLineNumber: 9,
                failingLineNumber: 10,
                containingFunction: "computeTax",
                failingExpression: "options.rate",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 9, content: "export function computeTax(amount: number, options: any) {", isFailingLine: false },
                    { lineNumber: 10, content: "    return amount * options.rate;", isFailingLine: true },
                    { lineNumber: 11, content: "}", isFailingLine: false },
                ],
            },
        });

        const causalState: CausalEpistemicState = {
            failureLocation: {
                filePath: "src/callee.ts",
                lineNumber: 10,
                symbol: "computeTax",
                status: "CONFIRMED",
                provenance: "Exact file match at src/callee.ts:10",
            },
            failureMechanism: {
                description: "Unguarded property access 'rate' on undefined parameter 'options'",
                status: "CONFIRMED",
                isRuntimeConfirmed: true,
                provenance: "Confirmed by evaluation",
            },
            upstreamCause: {
                status: "UNKNOWN",
                description: "Unknown caller behavior",
                isRuntimeConfirmed: false,
                provenance: "Hypothesis unconfirmed",
            },
            causalRelationships: [],
        };

        const ambiguousRepairLocation: DeterminedRepairLocation = {
            type: "CALLEE",
            targetFile: "src/callee.ts",
            targetSymbol: "computeTax",
            ownershipEstablished: false,
            isAmbiguous: true,
            candidateLocations: [
                { type: "CALLER", targetFile: "src/caller.ts", targetSymbol: "processOrder", rationale: "Caller omitted options object" },
                { type: "CALLEE", targetFile: "src/callee.ts", targetSymbol: "computeTax", rationale: "Callee did not guard against missing options" },
            ],
            rationale: "Ambiguous contract boundary between caller and callee",
            whyNotFailingLine: "Ownership is unresolved without contract specification",
        };

        const mockRecommendation: FixRecommendation = {
            status: "BLOCKED_BY_AMBIGUITY",
            confidence: "MEDIUM",
            summary: "Resolve contract ownership between processOrder and computeTax",
            outcomeType: "BLOCKED_BY_AMBIGUITY",
            diagnosis: "Options parameter was not provided by caller",
            actionType: "PROPOSE_CODE_FIX" as any,
            actionAnswer: "Add guard in computeTax or require options in processOrder",
            whyActionChosenOverOthers: "Both caller and callee remain plausible fix locations",
            whyAlternativeActionsDisqualified: "Single-sided patch risks masking architecture contract",
            remediationCategory: "CODE_CHANGE",
            changes: [
                {
                    file: "src/callee.ts",
                    filePath: "src/callee.ts",
                    symbol: "computeTax",
                    startLine: 10,
                    endLine: 10,
                    codeType: "EXISTING_AND_PROPOSED",
                    explanation: "Add nullish coalescing guard",
                    whyHere: "Callee boundary",
                    proposedCode: "    return amount * (options?.rate ?? 0);",
                    isExactSourceVerified: true,
                    evidenceIds: [],
                },
            ],
            isCodeModification: true,
            validationSteps: [],
        } as any;

        const sufficiency: EvidenceSufficiencyEvaluation = {
            state: "BLOCKED_BY_AMBIGUITY",
            isDiagnosisSufficient: true,
            isRepairLocationEstablished: false,
            isProposedChangeGroundedInVerifiedSource: true,
            isAdditionalRuntimeTelemetryNecessary: false,
            blockageReasons: ["Ambiguous ownership between caller and callee"],
            missingEvidenceTypes: [],
            requiredQuestionsForSufficiency: ["Which boundary owns the optionality contract?"],
        } as any;

        const decomposedConfidence: DecomposedConfidence = {
            failureLocation: "HIGH",
            failureMechanism: "CONFIRMED",
            causalCause: "SUPPORTED",
            regressionAssociation: "NONE",
            repairOwnership: "AMBIGUOUS",
            repairBoundary: "CANDIDATE",
            repairCorrectness: "UNVALIDATED",
            behavioralValidation: "UNTESTED",
        };

        const verdict = evaluateRecommendationDecisionGate({
            recommendation: mockRecommendation,
            snapshot: mockSnapshot,
            causalState,
            repairLocation: ambiguousRepairLocation,
            sufficiency,
            decomposedConfidence,
        });

        // Decision Gate Calibration
        expect(verdict.calibratedState).toBe("DIAGNOSIS_COMPLETE_REPAIR_UNRESOLVED");
        expect(verdict.calibratedConfidence.failureMechanism).toBe("CONFIRMED");
        expect(verdict.calibratedConfidence.repairOwnership).toBe("AMBIGUOUS");
        expect(verdict.calibratedConfidence.repairCorrectness).toBe("UNVALIDATED");
        expect(verdict.warnings.some(w => w.includes("ownership between caller and callee is ambiguous"))).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Test 4: Fully Verified Repair with Executed Proof
    // -------------------------------------------------------------------------
    it("Fully verified repair with executed proof -> allows VERIFIED_REPAIR with PROVEN correctness", () => {
        const mockSnapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "decomposed-gate-4",
                title: "RangeError: Invalid array length",
                firstSeen: new Date("2026-09-18T12:00:00Z"),
                lastSeen: new Date("2026-09-18T12:05:00Z"),
                eventCount: 3,
                environment: "production",
                service: "data-service",
            },
            rawEvidence: [],
        });

        const causalState: CausalEpistemicState = {
            failureLocation: {
                filePath: "src/buffer.ts",
                lineNumber: 15,
                symbol: "allocBuffer",
                status: "CONFIRMED",
                provenance: "Exact file match at src/buffer.ts:15",
            },
            failureMechanism: {
                description: "Negative size passed to Array constructor",
                status: "CONFIRMED",
                isRuntimeConfirmed: true,
                provenance: "Proven by stack trace and test",
            },
            upstreamCause: {
                status: "CONFIRMED",
                description: "Negative size parameter computed in caller",
                isRuntimeConfirmed: true,
                provenance: "Traced to input data",
            },
            causalRelationships: [{ from: "size", to: "Array constructor", confidence: "PROVEN" }],
        };

        const verifiedRepairLocation: DeterminedRepairLocation = {
            type: "CALLEE",
            targetFile: "src/buffer.ts",
            targetSymbol: "allocBuffer",
            ownershipEstablished: true,
            rationale: "Callee allocBuffer must guard against negative size",
            whyNotFailingLine: "Targeting entrypoint guard in buffer.ts",
        };

        const mockRecommendation: FixRecommendation = {
            status: "VERIFIED_REPAIR",
            confidence: "HIGH",
            summary: "Clamp negative buffer allocation size to zero",
            outcomeType: "VERIFIED_REPAIR",
            diagnosis: "Negative size passed to Array constructor",
            actionType: "PROPOSE_CODE_FIX" as any,
            actionAnswer: "Add Math.max(0, size) guard in allocBuffer",
            whyActionChosenOverOthers: "Verified local fix with passing unit test",
            whyAlternativeActionsDisqualified: "No other component is involved",
            remediationCategory: "CODE_CHANGE",
            changes: [
                {
                    file: "src/buffer.ts",
                    filePath: "src/buffer.ts",
                    symbol: "allocBuffer",
                    startLine: 15,
                    endLine: 15,
                    codeType: "EXISTING_AND_PROPOSED",
                    explanation: "Clamp size",
                    whyHere: "Entrypoint",
                    proposedCode: "    const safeSize = Math.max(0, size);",
                    isExactSourceVerified: true,
                    evidenceIds: [],
                },
            ],
            isCodeModification: true,
            validationSteps: ["Ran vitest allocBuffer tests: PASS"],
        } as any;

        const sufficiency: EvidenceSufficiencyEvaluation = {
            state: "VERIFIED_REPAIR",
            isDiagnosisSufficient: true,
            isRepairLocationEstablished: true,
            isProposedChangeGroundedInVerifiedSource: true,
            isAdditionalRuntimeTelemetryNecessary: false,
            blockageReasons: [],
            missingEvidenceTypes: [],
            requiredQuestionsForSufficiency: [],
        } as any;

        const decomposedConfidence: DecomposedConfidence = {
            failureLocation: "HIGH",
            failureMechanism: "CONFIRMED",
            causalCause: "PROVEN",
            regressionAssociation: "NONE",
            repairOwnership: "ESTABLISHED",
            repairBoundary: "VERIFIED",
            repairCorrectness: "PROVEN",
            behavioralValidation: "EXECUTED_PASSED",
        };

        const verdict = evaluateRecommendationDecisionGate({
            recommendation: mockRecommendation,
            snapshot: mockSnapshot,
            causalState,
            repairLocation: verifiedRepairLocation,
            sufficiency,
            decomposedConfidence,
        });

        expect(verdict.allowed).toBe(true);
        expect(verdict.calibratedState).toBe("VERIFIED_REPAIR");
        expect(verdict.calibratedConfidence.failureLocation).toBe("HIGH");
        expect(verdict.calibratedConfidence.failureMechanism).toBe("CONFIRMED");
        expect(verdict.calibratedConfidence.repairOwnership).toBe("ESTABLISHED");
        expect(verdict.calibratedConfidence.repairBoundary).toBe("VERIFIED");
        expect(verdict.calibratedConfidence.repairCorrectness).toBe("PROVEN");
        expect(verdict.calibratedConfidence.behavioralValidation).toBe("EXECUTED_PASSED");
    });
});
