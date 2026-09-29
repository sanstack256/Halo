/**
 * Halo Trace — Phase 4+ 13 Adversarial Proof & Deceptive Patch Test Suite (§95)
 *
 * Verifies that the Verified Repair Proof Engine correctly REJECTS all 13
 * deceptive/adversarial patch patterns, and ACCEPTS legitimate fixes only
 * after complete empirical proof:
 *
 *  1. Compiles but does not fix the bug
 *  2. Fixes the exception but breaks behavior (swallows error / empty catch)
 *  3. Passes existing tests but violates invariant
 *  4. Fixes the target but causes a regression
 *  5. Modifies the wrong file
 *  6. Modifies the right file but wrong symbol
 *  7. Modifies the right symbol but wrong AST node (comment-only)
 *  8. Fixes one execution path but breaks another
 *  9. Works only because test is too weak
 * 10. Looks semantically perfect but fails under concurrency
 * 11. Fixes local problem but violates upstream contract
 * 12. Fixes symptom but preserves cause
 * 13. Appears correct but depends on stale source
 *
 * In each case: Halo MUST reject it (§95).
 */

import { describe, it, expect } from "vitest";
import {
    stripComments,
    stripWhitespace,
    isCommentOnlyTransformation,
    isWhitespaceOnlyTransformation,
    detectErrorSuppressionMasking,
    computeCandidateSemanticKey,
    buildCompleteVerifiedRepairProofChain,
} from "../../proof-engine";
import { evaluateVerifiedRepairGate, computeProofPayloadHash } from "../../verified-repair-gate";
import { buildInvestigationSnapshot } from "../../investigation-snapshot";

describe("Halo Trace — Phase 4+ 13 Adversarial Proof Tests (§95)", () => {
    // 1. A patch that compiles but does not fix the bug
    it("Adversarial 1: rejects a patch that compiles but does not fix the bug", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "adv-01",
                title: "TypeError: Cannot read properties of undefined (reading 'token')",
                firstSeen: new Date(),
                lastSeen: new Date(),
            },
            rawEvidence: [],
            stackFrames: [{ filePath: "src/auth/session.ts", lineNumber: 25, functionName: "validateSession" }],
        });

        // Patch modifies variable assignment unrelated to token check
        const changes = [{
            filePath: "src/auth/session.ts",
            currentCode: "const session = getSession();",
            proposedCode: "const session = getSession(); const unused = 123;",
            explanation: "Assign unused variable",
        }];

        const { gateResult } = buildCompleteVerifiedRepairProofChain({
            snapshot,
            changes,
        });

        // Must reject because baseline failure was not eliminated
        expect(gateResult.isVerified).toBe(false);
    });

    // 2. A patch that fixes the exception but breaks behavior (swallows error)
    it("Adversarial 2: rejects a patch that catches exception and returns default / empty catch (§17, §47)", () => {
        const proposedCode = `
try {
    return processPayment(order);
} catch (e) {
    return null; // Swallows payment failure!
}
        `.trim();

        const masking = detectErrorSuppressionMasking(proposedCode);
        expect(masking.isMasked).toBe(true);
        expect(masking.reason).toContain("Catch block returns default value suppressing failure");
    });

    // 3. A patch that passes existing tests but violates invariant
    it("Adversarial 3: rejects a patch that passes tests but violates invariant", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "adv-03",
                title: "InvariantViolation: Resource connection leaked",
                firstSeen: new Date(),
                lastSeen: new Date(),
            },
            rawEvidence: [],
            stackFrames: [{ filePath: "src/db/pool.ts", lineNumber: 80, functionName: "acquireConnection" }],
        });

        const changes = [{
            filePath: "src/db/pool.ts",
            currentCode: "return connection;",
            proposedCode: "return connection; // omit release",
            explanation: "Passes naive test without release",
        }];

        const { gateResult } = buildCompleteVerifiedRepairProofChain({
            snapshot,
            changes,
        });

        expect(gateResult.isVerified).toBe(false);
    });

    // 4. A patch that fixes target but causes a regression
    it("Adversarial 4: rejects a patch that introduces a regression in another test (§22, §23)", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "adv-04",
                title: "Error: Order discount not applied",
                firstSeen: new Date(),
                lastSeen: new Date(),
            },
            rawEvidence: [],
            stackFrames: [{ filePath: "src/billing/discount.ts", lineNumber: 10, functionName: "getDiscount" }],
        });

        const changes = [{
            filePath: "src/billing/discount.ts",
            currentCode: "return rate * 100;",
            proposedCode: "return 0; // fixes zero-coupon edge case but breaks standard discount",
            explanation: "Forces zero discount",
        }];

        const { proofChain } = buildCompleteVerifiedRepairProofChain({
            snapshot,
            changes,
        });

        // Ensure earlier stages pass so the gate reaches regression validation
        proofChain.behaviorProof!.status = "VERIFIED";
        proofChain.behaviorProof!.baselineFailureEliminated = true;
        proofChain.behaviorProof!.expectedBehaviorAchieved = true;
        proofChain.behaviorProof!.notSimplySwallowedException = true;
        proofChain.behaviorProof!.notSimplyDefaultFallback = true;
        proofChain.behaviorProof!.cryptographicHash = computeProofPayloadHash(proofChain.behaviorProof! as any);

        proofChain.invariantProof!.status = "VERIFIED";
        proofChain.invariantProof!.restorationConfirmed = true;
        proofChain.invariantProof!.observedAfter = { satisfied: true, details: "Invariant restored" };
        proofChain.invariantProof!.cryptographicHash = computeProofPayloadHash(proofChain.invariantProof! as any);

        // Simulate patch introducing a regression
        proofChain.regressionProof!.status = "FAILED";
        proofChain.regressionProof!.regressionAttribution = "PATCH_REGRESSION";
        proofChain.regressionProof!.newlyIntroducedFailures = ["FAIL test/standard-discount.test.ts"];
        proofChain.regressionProof!.cryptographicHash = computeProofPayloadHash(proofChain.regressionProof! as any);

        const result = evaluateVerifiedRepairGate(proofChain);
        expect(result.isVerified).toBe(false);
        expect(result.failedAt).toBe("REGRESSION_VALIDATED");
        expect(result.reason).toContain("PATCH_REGRESSION");
    });

    // 5. A patch that modifies the wrong file
    it("Adversarial 5: rejects a patch that modifies the wrong file", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "adv-05",
                title: "TypeError: user.profile is undefined",
                firstSeen: new Date(),
                lastSeen: new Date(),
            },
            rawEvidence: [],
            stackFrames: [{ filePath: "src/users/profile.ts", lineNumber: 50, functionName: "getProfile" }],
        });

        const changes = [{
            filePath: "src/unrelated/logger.ts", // WRONG FILE
            currentCode: "console.log();",
            proposedCode: "console.log('patched');",
            explanation: "Log in unrelated file",
        }];

        const { gateResult } = buildCompleteVerifiedRepairProofChain({
            snapshot,
            changes,
        });

        expect(gateResult.isVerified).toBe(false);
    });

    // 6. A patch that modifies the right file but wrong symbol
    it("Adversarial 6: rejects a patch that modifies the right file but wrong symbol", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "adv-06",
                title: "TypeError: Cannot read properties of undefined (reading 'permissions')",
                firstSeen: new Date(),
                lastSeen: new Date(),
            },
            rawEvidence: [],
            stackFrames: [{ filePath: "src/auth/rbac.ts", lineNumber: 120, functionName: "checkPermissions" }],
        });

        const { proofChain } = buildCompleteVerifiedRepairProofChain({
            snapshot,
            changes: [{
                filePath: "src/auth/rbac.ts",
                symbol: "formatUserName", // WRONG SYMBOL
                currentCode: "return name.trim();",
                proposedCode: "return name ? name.trim() : '';",
                explanation: "Fixes wrong function in same file",
            }],
        });

        proofChain.sourceProof!.symbolResolved = false;
        proofChain.sourceProof!.targetSymbol = "formatUserName";
        proofChain.sourceProof!.cryptographicHash = computeProofPayloadHash(proofChain.sourceProof! as any);

        const result = evaluateVerifiedRepairGate(proofChain);
        expect(result.isVerified).toBe(false);
        expect(result.failedAt).toBe("SOURCE_VERIFIED");
    });

    // 7. A patch that modifies the right symbol but wrong AST node (comment-only)
    it("Adversarial 7: rejects a patch that is comment-only or whitespace-only (§14)", () => {
        const original = `
function calculateTax(subtotal) {
    return subtotal * 0.08;
}
        `.trim();

        const commentOnlyPatch = `
function calculateTax(subtotal) {
    // Check if subtotal is defined here
    return subtotal * 0.08;
}
        `.trim();

        const whitespaceOnlyPatch = `
function calculateTax( subtotal ) {
    return subtotal * 0.08 ;
}
        `.trim();

        expect(isCommentOnlyTransformation(original, commentOnlyPatch)).toBe(true);
        expect(isWhitespaceOnlyTransformation(original, whitespaceOnlyPatch)).toBe(true);
    });

    // 8. A patch that fixes one execution path but breaks another
    it("Adversarial 8: rejects a patch that fixes one execution path but breaks another", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "adv-08",
                title: "TypeError: items.reduce is not a function",
                firstSeen: new Date(),
                lastSeen: new Date(),
            },
            rawEvidence: [],
            stackFrames: [{ filePath: "src/cart/total.ts", lineNumber: 15, functionName: "calculateTotal" }],
        });

        const { proofChain } = buildCompleteVerifiedRepairProofChain({
            snapshot,
            changes: [{
                filePath: "src/cart/total.ts",
                proposedCode: "if (!items) return 0; // fixes null path, but crashes on empty array or non-array",
                explanation: "Partial null guard",
            }],
        });

        // Ensure earlier stages pass so the gate reaches counterexamples
        proofChain.behaviorProof!.status = "VERIFIED";
        proofChain.behaviorProof!.baselineFailureEliminated = true;
        proofChain.behaviorProof!.expectedBehaviorAchieved = true;
        proofChain.behaviorProof!.notSimplySwallowedException = true;
        proofChain.behaviorProof!.notSimplyDefaultFallback = true;
        proofChain.behaviorProof!.cryptographicHash = computeProofPayloadHash(proofChain.behaviorProof! as any);

        proofChain.invariantProof!.status = "VERIFIED";
        proofChain.invariantProof!.restorationConfirmed = true;
        proofChain.invariantProof!.observedAfter = { satisfied: true, details: "Invariant restored" };
        proofChain.invariantProof!.cryptographicHash = computeProofPayloadHash(proofChain.invariantProof! as any);

        proofChain.regressionProof!.status = "VERIFIED";
        proofChain.regressionProof!.newlyIntroducedFailures = [];
        proofChain.regressionProof!.regressionAttribution = "CLEAN_NO_REGRESSIONS";
        proofChain.regressionProof!.cryptographicHash = computeProofPayloadHash(proofChain.regressionProof! as any);

        // Counterexample fails on non-array input
        proofChain.counterexampleProof!.allCasesSurvived = false;
        proofChain.counterexampleProof!.failedCaseCount = 1;
        proofChain.counterexampleProof!.cryptographicHash = computeProofPayloadHash(proofChain.counterexampleProof! as any);

        const result = evaluateVerifiedRepairGate(proofChain);
        expect(result.isVerified).toBe(false);
        expect(result.failedAt).toBe("COUNTEREXAMPLES_VALIDATED");
    });

    // 9. A patch that works only because the test is too weak
    it("Adversarial 9: rejects a patch that passes weak tests but fails boundary counterexamples (§24-28)", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "adv-09",
                title: "Error: User contract violation",
                firstSeen: new Date(),
                lastSeen: new Date(),
            },
            rawEvidence: [],
            stackFrames: [{ filePath: "src/users/contract.ts", lineNumber: 30, functionName: "assertValidUser" }],
        });

        const { proofChain } = buildCompleteVerifiedRepairProofChain({
            snapshot,
            changes: [{
                filePath: "src/users/contract.ts",
                proposedCode: "return true; // naive mock that passes test",
                explanation: "Trivial bypass",
            }],
        });

        // Boundary counterexamples catch the invariant violation
        proofChain.counterexampleProof!.allCasesSurvived = false;
        proofChain.counterexampleProof!.failedCaseCount = 2;
        proofChain.counterexampleProof!.cryptographicHash = computeProofPayloadHash(proofChain.counterexampleProof! as any);

        const result = evaluateVerifiedRepairGate(proofChain);
        expect(result.isVerified).toBe(false);
    });

    // 10. A patch that looks semantically perfect but fails under concurrency
    it("Adversarial 10: rejects a patch that fails under concurrent execution (§26)", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "adv-10",
                title: "RaceCondition: Balance updated concurrently without lock",
                firstSeen: new Date(),
                lastSeen: new Date(),
            },
            rawEvidence: [],
            stackFrames: [{ filePath: "src/wallet/balance.ts", lineNumber: 44, functionName: "debit" }],
        });

        const { proofChain } = buildCompleteVerifiedRepairProofChain({
            snapshot,
            changes: [{
                filePath: "src/wallet/balance.ts",
                proposedCode: "balance -= amount; // Non-atomic update",
                explanation: "Direct subtraction without lock",
            }],
        });

        // Ensure earlier stages pass so the gate reaches counterexamples
        proofChain.behaviorProof!.status = "VERIFIED";
        proofChain.behaviorProof!.baselineFailureEliminated = true;
        proofChain.behaviorProof!.expectedBehaviorAchieved = true;
        proofChain.behaviorProof!.notSimplySwallowedException = true;
        proofChain.behaviorProof!.notSimplyDefaultFallback = true;
        proofChain.behaviorProof!.cryptographicHash = computeProofPayloadHash(proofChain.behaviorProof! as any);

        proofChain.invariantProof!.status = "VERIFIED";
        proofChain.invariantProof!.restorationConfirmed = true;
        proofChain.invariantProof!.observedAfter = { satisfied: true, details: "Invariant restored" };
        proofChain.invariantProof!.cryptographicHash = computeProofPayloadHash(proofChain.invariantProof! as any);
        proofChain.regressionProof!.status = "VERIFIED";
        proofChain.regressionProof!.newlyIntroducedFailures = [];
        proofChain.regressionProof!.regressionAttribution = "CLEAN_NO_REGRESSIONS";
        proofChain.regressionProof!.cryptographicHash = computeProofPayloadHash(proofChain.regressionProof! as any);

        proofChain.counterexampleProof!.casesTested = [{
            caseId: "concurrency-race",
            category: "CONCURRENCY_INTERLEAVING",
            description: "Concurrent balance mutation",
            inputPayloadOrCondition: "2 concurrent requests",
            survived: false,
            observedBehavior: "Balance underflowed to negative",
        }];
        proofChain.counterexampleProof!.allCasesSurvived = false;
        proofChain.counterexampleProof!.failedCaseCount = 1;
        proofChain.counterexampleProof!.cryptographicHash = computeProofPayloadHash(proofChain.counterexampleProof! as any);

        const result = evaluateVerifiedRepairGate(proofChain);
        expect(result.isVerified).toBe(false);
        expect(result.failedAt).toBe("COUNTEREXAMPLES_VALIDATED");
    });

    // 11. A patch that fixes local problem but violates upstream contract
    it("Adversarial 11: rejects a patch that violates upstream contract", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "adv-11",
                title: "ContractError: API response format violated",
                firstSeen: new Date(),
                lastSeen: new Date(),
            },
            rawEvidence: [],
            stackFrames: [{ filePath: "src/api/handler.ts", lineNumber: 60, functionName: "handleRequest" }],
        });

        const { proofChain } = buildCompleteVerifiedRepairProofChain({
            snapshot,
            changes: [{
                filePath: "src/api/handler.ts",
                proposedCode: "return { success: false }; // Breaks { data: ..., error: ... } contract",
                explanation: "Returns alternative response structure",
            }],
        });

        // Ensure earlier stages pass so the gate reaches invariant validation
        proofChain.behaviorProof!.status = "VERIFIED";
        proofChain.behaviorProof!.baselineFailureEliminated = true;
        proofChain.behaviorProof!.expectedBehaviorAchieved = true;
        proofChain.behaviorProof!.notSimplySwallowedException = true;
        proofChain.behaviorProof!.notSimplyDefaultFallback = true;
        proofChain.behaviorProof!.cryptographicHash = computeProofPayloadHash(proofChain.behaviorProof! as any);

        proofChain.invariantProof!.restorationConfirmed = false;
        proofChain.invariantProof!.cryptographicHash = computeProofPayloadHash(proofChain.invariantProof! as any);

        const result = evaluateVerifiedRepairGate(proofChain);
        expect(result.isVerified).toBe(false);
        expect(result.failedAt).toBe("INVARIANT_VALIDATED");
    });

    // 12. A patch that fixes symptom but preserves cause
    it("Adversarial 12: rejects a patch that merely fixes symptom with optional chaining when value is required (§48)", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "adv-12",
                title: "TypeError: Cannot read properties of undefined (reading 'id')",
                firstSeen: new Date(),
                lastSeen: new Date(),
            },
            rawEvidence: [],
            stackFrames: [{ filePath: "src/orders/process.ts", lineNumber: 90, functionName: "processOrder" }],
        });

        // Symptom fix: optional chaining on mandatory field
        const proposedCode = "const orderId = order?.id ?? 'UNKNOWN';";
        const masking = detectErrorSuppressionMasking(proposedCode);

        // When contract specifies order.id is mandatory, default-fallback or symptom mask is rejected
        const { proofChain } = buildCompleteVerifiedRepairProofChain({
            snapshot,
            changes: [{
                filePath: "src/orders/process.ts",
                proposedCode,
                explanation: "Add optional chaining",
            }],
        });

        proofChain.behaviorProof!.notSimplyDefaultFallback = false;
        proofChain.behaviorProof!.cryptographicHash = computeProofPayloadHash(proofChain.behaviorProof! as any);

        const result = evaluateVerifiedRepairGate(proofChain);
        expect(result.isVerified).toBe(false);
        expect(result.failedAt).toBe("FAILURE_BEHAVIOR_CHANGED");
    });

    // 13. A patch that appears correct but depends on stale source
    it("Adversarial 13: rejects a patch that depends on stale source revision (§15, §61)", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "adv-13",
                title: "TypeError: Stale dependency",
                firstSeen: new Date(),
                lastSeen: new Date(),
            },
            rawEvidence: [],
            source: {
                gitCommitSha: "current-rev-8888",
            },
            stackFrames: [{ filePath: "src/config/app.ts", lineNumber: 10, functionName: "loadConfig" }],
        });

        const { proofChain } = buildCompleteVerifiedRepairProofChain({
            snapshot,
            changes: [{
                filePath: "src/config/app.ts",
                proposedCode: "export const config = {};",
                explanation: "Valid patch but stale hash",
            }],
        });

        // Patch was generated against stale revision
        proofChain.sourceProof!.repositoryRevision = "stale-rev-0000";
        proofChain.sourceProof!.cryptographicHash = computeProofPayloadHash(proofChain.sourceProof! as any);

        const result = evaluateVerifiedRepairGate(proofChain);
        expect(result.isVerified).toBe(false);
        expect(result.failedProofs).toContain("PROVENANCE_INTEGRITY");
    });

    // Deduplication test (§30)
    it("Candidate Deduplication: deduplicates syntactically different but semantically identical repairs (§30)", () => {
        const candA = {
            targetFile: "src/billing.ts",
            invariantCategory: "NULL_SAFETY",
            changes: [{
                filePath: "src/billing.ts",
                proposedCode: "if (!user) return 0; // check user\n",
            }],
        };

        const candB = {
            targetFile: "src/billing.ts",
            invariantCategory: "NULL_SAFETY",
            changes: [{
                filePath: "src/billing.ts",
                proposedCode: "/* different comment */ if ( !user ) return 0 ;",
            }],
        };

        const keyA = computeCandidateSemanticKey(candA as any);
        const keyB = computeCandidateSemanticKey(candB as any);

        expect(keyA).toBe(keyB);
    });
});
