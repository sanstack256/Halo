/**
 * Halo Repair Case System — Comprehensive Acceptance & Adversarial Test Suite
 *
 * Tests the entire contract intelligence and repair layer against the strict requirements:
 *   1. Zero Hallucination: Refuses to invent files when runtime points to unmapped/vendor code.
 *   2. Cross-File Contract Mismatch: Detects caller omitting required argument for updated callee.
 *   3. Anti-Masking: Rejects symptom-suppression patches (?. or || {}) when caller contract is violated.
 *   4. Already-Fixed Detection: Detects when current repository commit already contains the fix.
 *   5. Ambiguous Cause: Distinguishes confirmed failure mechanism from unresolved upstream origin.
 *   6. Patch Applicability & Validation Failure: Rejects inapplicable or syntax-invalid patches.
 *   7. Machine-Applicable Diff: Computes standard unified diff headers and line mappings.
 */

import { describe, it, expect } from "vitest";
import type { Evidence, Investigation } from "@halo/investigation-engine";
import { buildCanonicalEvidenceSnapshot } from "../../evidence-snapshot";
import { orchestrateRepairCase } from "../repair-orchestrator";
import { analyzeContractMismatch, evaluateAntiMasking } from "../contract-mismatch-engine";
import { generateVerifiedPatch } from "../patch-engine";
import { executeRepairValidation } from "../validation-engine";

function createMockError(overrides: Record<string, any> = {}): Evidence {
    const { errorMessage, ...rest } = overrides;
    return {
        id: "err-repair-test-1",
        type: "ERROR",
        timestamp: new Date("2026-09-13T12:00:00Z"),
        source: "backend",
        service: "billing-service",
        title: "TypeError: Cannot read properties of undefined (reading 'currency')",
        description: errorMessage || "Charge processing failed because currency is undefined",
        status: "ERROR",
        fingerprint: "fp-contract-currency",
        metadata: {
            amount: 5000,
            paymentMethod: "pm_card_visa",
        },
        tags: {},
        ...rest,
    } as unknown as Evidence;
}

function createMockInvestigation(evidence: Evidence[]): Investigation {
    const hypothesis = {
        id: "hypo-contract-currency",
        title: "Missing currency parameter in payment request",
        description: "Payment service was invoked without the required currency attribute.",
        status: "VALIDATED" as const,
        score: { positive: 4, negative: 0, unknown: 0 },
        confidence: 95,
        supportingReasons: [] as any,
        contradictingReasons: [] as any,
        missingReasons: [] as any,
        findingIds: [],
        evidenceIds: [evidence[0]!.id],
        alternativeIds: [],
    };

    return {
        status: "ANALYSIS_COMPLETE",
        evidence,
        graph: { nodes: [], edges: [] },
        timeline: { events: [] },
        changes: [],
        findings: [],
        hypotheses: [hypothesis],
        rootCause: hypothesis as any,
        causalChains: [],
        impact: { affectedServices: ["billing-service"], blastRadius: "LOW" } as unknown as Investigation["impact"],
        recommendations: [],
        report: {
            summary: "Missing currency in payment request contract.",
            rootCause: {
                title: "Contract mismatch on payment invocation",
                confidence: 0.95,
                confidenceLevel: "HIGH",
                explanation: "createPayment expects currency, but caller does not supply it.",
                supportingReasons: [],
                contradictingReasons: [],
                missingReasons: [],
            },
            alternatives: [],
            uncertainties: [],
            nextSteps: [],
        },
        nextInvestigation: null,
    };
}

describe("Halo Repair Case System — Acceptance Tests", () => {
    // -------------------------------------------------------------------------
    // Test 1: Zero Hallucination (Section 90 & 126)
    // -------------------------------------------------------------------------
    it("refuses to invent files when runtime stack points to vendor or unmapped bundle (Section 77 & 126)", async () => {
        const error = createMockError({
            tags: { stack: "Error at Object.<anonymous> (vendor.min.js:14:2980)" },
        });

        const snapshot = buildCanonicalEvidenceSnapshot({
            tenant: { projectId: "proj-zero-hallucination" },
            scope: { issueId: "issue-vendor", anchorEventId: error.id },
            rawEvidence: [error],
            investigation: createMockInvestigation([error]),
            runtime: {
                anchorError: error,
                callChain: [],
                failingExpression: "e.min()",
            },
            source: {
                filePath: "vendor.min.js",
                failingLineNumber: 14,
                startLineNumber: 1,
                lines: [{ lineNumber: 14, content: "function min(e){return e.min()}", isFailingLine: true }],
                resolutionStatus: "exact_file",
            },
        });

        const repairCase = await orchestrateRepairCase({ snapshot });

        expect(repairCase.status).toBe("BLOCKED");
        expect(repairCase.outcome).toBe("BLOCKED");
        expect(repairCase.changes.length).toBe(0);
        expect(repairCase.whyItBroke).toContain("vendor.min.js");
        expect(repairCase.whyItBroke).toContain("cannot currently map this bundled frame to repository source");
        expect(repairCase.confidenceLevel).toBe("LOW");
    });

    // -------------------------------------------------------------------------
    // Test 2: Cross-File Contract Mismatch (Section 11 & 127)
    // -------------------------------------------------------------------------
    it("detects cross-file contract mismatch between caller and callee and proposes caller fix (Section 127)", async () => {
        const calleeSourceCode = `export function createPayment(amount: number, paymentMethod: string, currency: string) {
    if (!currency) {
        throw new TypeError("Cannot read properties of undefined (reading 'currency')");
    }
    return { amount, paymentMethod, currency };
}`;

        const callerSourceCode = `import { createPayment } from "./createPayment";

export async function submitOrder(amount: number, paymentMethod: string, currency: string) {
    const result = await createPayment(amount, paymentMethod);
    return result;
}`;

        const error = createMockError();
        const snapshot = buildCanonicalEvidenceSnapshot({
            tenant: { projectId: "proj-contract-e2e" },
            scope: { issueId: "issue-currency-contract", anchorEventId: error.id },
            rawEvidence: [error],
            investigation: createMockInvestigation([error]),
            runtime: {
                anchorError: error,
                callChain: [],
                failingExpression: "currency",
                containingFunction: "createPayment",
            },
            source: {
                filePath: "src/services/createPayment.ts",
                failingLineNumber: 2,
                startLineNumber: 1,
                lines: [
                    { lineNumber: 1, content: "export function createPayment(amount: number, paymentMethod: string, currency: string) {", isFailingLine: false },
                    { lineNumber: 2, content: "    if (!currency) {", isFailingLine: true },
                    { lineNumber: 3, content: "        throw new TypeError(\"Cannot read properties of undefined (reading 'currency')\");", isFailingLine: false },
                    { lineNumber: 4, content: "    }", isFailingLine: false },
                    { lineNumber: 5, content: "    return { amount, paymentMethod, currency };", isFailingLine: false },
                    { lineNumber: 6, content: "}", isFailingLine: false },
                ],
                resolutionStatus: "exact_file",
                revision: "commit-sha-abc1234",
            },
        });

        const callerSourceFile = {
            filePath: "src/components/CheckoutForm.tsx",
            content: callerSourceCode,
            revision: "commit-sha-abc1234",
        };

        const repairCase = await orchestrateRepairCase({
            snapshot,
            callerSourceFile,
        });

        // Verifications
        expect(repairCase.status).toBe("CHANGES_PROPOSED");
        expect(repairCase.outcome).toBe("REPAIRABLE");
        expect(repairCase.confidenceLevel).toBe("VERY_HIGH");
        expect(repairCase.upstreamReasonStatus).toBe("CONFIRMED");

        // Contract boundary verification
        expect(repairCase.brokenBoundary).toBeDefined();
        expect(repairCase.brokenBoundary?.callerFile).toBe("src/components/CheckoutForm.tsx");
        expect(repairCase.brokenBoundary?.calleeFile).toBe("src/services/createPayment.ts");
        expect(repairCase.brokenBoundary?.contractMismatchKind).toBe("FUNCTION_SIGNATURE_MISMATCH");
        expect(repairCase.brokenBoundary?.discrepancyExplanation).toContain("requires 3 arguments");

        // Change targets caller, not callee
        expect(repairCase.changes.length).toBe(1);
        const change = repairCase.changes[0]!;
        expect(change.filePath).toBe("src/components/CheckoutForm.tsx");
        expect(change.afterSnippet).toContain("currency");
        expect(change.unifiedDiff).toContain("+    const result = await createPayment(amount, paymentMethod, currency);");
        expect(change.whyThisFile).toContain("CheckoutForm.tsx");
    });

    // -------------------------------------------------------------------------
    // Test 3: Anti-Masking Rule (Section 17 & 128)
    // -------------------------------------------------------------------------
    it("flags symptom suppression when trying to add defensive optional chaining on a callee with broken caller contract (Section 128)", () => {
        const contractAnalysis = {
            hasMismatch: true,
            recommendedRepairSide: "CALLER" as const,
            isAlreadyFixed: false,
        };

        // Callee tries to add currency?.toUpperCase() or || "USD" fallback
        const suppressionPatch1 = "const cleanCurrency = currency?.toUpperCase();";
        const result1 = evaluateAntiMasking(suppressionPatch1, contractAnalysis);
        expect(result1.isSymptomSuppression).toBe(true);
        expect(result1.warning).toContain("Symptom suppression detected");

        const suppressionPatch2 = "const options = payload || {};";
        const result2 = evaluateAntiMasking(suppressionPatch2, contractAnalysis);
        expect(result2.isSymptomSuppression).toBe(true);

        const suppressionPatch3 = "try { execute(); } catch { return; }";
        const result3 = evaluateAntiMasking(suppressionPatch3, contractAnalysis);
        expect(result3.isSymptomSuppression).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Test 4: Already-Fixed Detection (Section 32 & 129)
    // -------------------------------------------------------------------------
    it("detects when current repository commit already contains the defensive fix (Section 129)", async () => {
        const error = createMockError({
            title: "TypeError: Cannot read properties of undefined (reading 'amount')",
            errorMessage: "Cannot read properties of undefined (reading 'amount')",
        });

        // The current source line ALREADY has ?.amount
        const alreadyFixedSource = {
            filePath: "src/billing.ts",
            failingLineNumber: 10,
            startLineNumber: 1,
            lines: [
                { lineNumber: 9, content: "// Current fixed source", isFailingLine: false },
                { lineNumber: 10, content: "const amount = invoice?.amount ?? 0;", isFailingLine: true },
            ],
            resolutionStatus: "exact_file" as const,
            revision: "commit-head-fixed",
        };

        const snapshot = buildCanonicalEvidenceSnapshot({
            tenant: { projectId: "proj-already-fixed" },
            scope: { issueId: "issue-already-fixed", anchorEventId: error.id },
            rawEvidence: [error],
            investigation: createMockInvestigation([error]),
            runtime: {
                anchorError: error,
                callChain: [],
                failingExpression: "invoice.amount",
            },
            source: alreadyFixedSource,
        });

        const repairCase = await orchestrateRepairCase({ snapshot });

        expect(repairCase.outcome).toBe("ALREADY_FIXED");
        expect(repairCase.changes.length).toBe(0);
        expect(repairCase.whyItBroke).toContain("already contains defensive handling");
        expect(repairCase.confidenceLevel).toBe("VERY_HIGH");
        expect(repairCase.validation.status).toBe("PASSED");
    });

    // -------------------------------------------------------------------------
    // Test 5: Ambiguous Root Cause (Section 31 & 131)
    // -------------------------------------------------------------------------
    it("distinguishes confirmed failure mechanism from unresolved upstream origin when value was not captured (Section 131)", async () => {
        const error = createMockError({
            title: "TypeError: Cannot read properties of undefined (reading 'taxRate')",
            errorMessage: "Cannot read properties of undefined (reading 'taxRate')",
        });

        const snapshot = buildCanonicalEvidenceSnapshot({
            tenant: { projectId: "proj-ambiguous" },
            scope: { issueId: "issue-ambiguous", anchorEventId: error.id },
            rawEvidence: [error],
            investigation: createMockInvestigation([error]),
            runtime: {
                anchorError: error,
                callChain: [],
                failingExpression: "taxProfile.taxRate",
                containingFunction: "calculateTotal",
            },
            source: {
                filePath: "src/tax.ts",
                failingLineNumber: 5,
                startLineNumber: 1,
                lines: [
                    { lineNumber: 4, content: "function calculateTotal(taxProfile: any) {", isFailingLine: false },
                    { lineNumber: 5, content: "    const rate = taxProfile.taxRate;", isFailingLine: true },
                    { lineNumber: 6, content: "    return rate * 100;", isFailingLine: false },
                    { lineNumber: 7, content: "}", isFailingLine: false },
                ],
                resolutionStatus: "exact_file",
            },
        });

        const repairCase = await orchestrateRepairCase({ snapshot });

        // Mechanism is confirmed, but upstream origin is unresolved
        expect(repairCase.failureMechanism).toContain("taxProfile.taxRate");
        expect(repairCase.upstreamReasonStatus).toBe("UNRESOLVED");
        expect(repairCase.upstreamReason).toContain("upstream origin of the missing or invalid value cannot be determined");
    });

    // -------------------------------------------------------------------------
    // Test 6: Patch Applicability & Validation Failure (Section 44 & 130)
    // -------------------------------------------------------------------------
    it("marks status FAILED and VALIDATION_FAILED when patch produces syntax parse error (Section 130)", async () => {
        const targetContent = "function calculate() {\n    return 42;\n}";

        // Patch introduces invalid syntax: missing closing brace / broken expression
        const patchResult = generateVerifiedPatch({
            targetFilePath: "src/math.ts",
            fileContent: targetContent,
            startLine: 2,
            endLine: 2,
            beforeSnippet: "    return 42;",
            proposedSnippet: "    return &&& syntax error;",
            reason: "Bad test patch",
            whyThisFile: "Testing validation",
            evidenceIds: ["err-1"],
        });

        expect(patchResult.syntaxValid).toBe(false);
        expect(patchResult.patch.validationStatus).toBe("REJECTED");

        const validation = await executeRepairValidation({
            patch: patchResult.patch,
            targetFileContent: targetContent,
        });

        expect(validation.status).toBe("FAILED");
        expect(validation.typecheckPassed).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
    });

    // -------------------------------------------------------------------------
    // Test 7: Machine-Applicable Diff Generation (Section 52 & 70)
    // -------------------------------------------------------------------------
    it("generates exact machine-applicable unified diff conforming to repository lines (Section 70)", () => {
        const fileContent = "import { logger } from './logger';\n\nfunction logUser(user: any) {\n    logger.info(user.name);\n}\n";

        const patchResult = generateVerifiedPatch({
            targetFilePath: "src/user-logger.ts",
            fileContent,
            startLine: 4,
            endLine: 4,
            beforeSnippet: "    logger.info(user.name);",
            proposedSnippet: "    if (user?.name) {\n        logger.info(user.name);\n    }",
            reason: "Guard user.name before logging",
            whyThisFile: "Avoid crash when user is undefined",
            evidenceIds: ["err-logger"],
        });

        expect(patchResult.appliesCleanly).toBe(true);
        expect(patchResult.syntaxValid).toBe(true);
        expect(patchResult.patch.unifiedDiff).toContain("--- a/src/user-logger.ts");
        expect(patchResult.patch.unifiedDiff).toContain("+++ b/src/user-logger.ts");
        expect(patchResult.patch.unifiedDiff).toContain("@@ -4,1 +4,3 @@");
        expect(patchResult.patch.unifiedDiff).toContain("-    logger.info(user.name);");
        expect(patchResult.patch.unifiedDiff).toContain("+    if (user?.name) {");
    });
});
