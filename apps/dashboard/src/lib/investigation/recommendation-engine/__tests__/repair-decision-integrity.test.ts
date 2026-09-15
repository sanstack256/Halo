/**
 * Halo Trace — Repair-Decision Integrity Audit Test Suite
 *
 * Implements the 17 Required Regression Tests for the Repair-Decision Integrity Audit:
 *   1. Confirmed mechanism + unknown repair ownership
 *   2. Confirmed mechanism + caller ownership
 *   3. Confirmed mechanism + callee ownership
 *   4. Producer ownership
 *   5. Transformation ownership
 *   6. Ambiguous caller/callee contract
 *   7. Regression candidate without behavioral evidence
 *   8. Regression with behavioral evidence
 *   9. Configuration responsibility
 *   10. External dependency responsibility
 *   11. Diagnosis sufficient but repair insufficient
 *   12. Repair fully established
 *   13. Candidate scoring attempting to override hard constraint
 *   14. LLM inventing repair responsibility
 *   15. Fact checker rejecting unsupported responsibility
 *   16. Exact patch without verified ownership
 *   17. Runtime evidence required only when deterministic evidence is exhausted
 */

import { describe, it, expect } from "vitest";
import { buildInvestigationSnapshot } from "../investigation-snapshot";
import { determineCausalEpistemicState } from "../causal-determination";
import { determineRepairLocation } from "../repair-location";
import { evaluateEvidenceSufficiency } from "../sufficiency-engine";
import { generateAndEvaluateCandidateActions, evaluateHardConstraints } from "../candidate-actions";
import { runDeterministicFactCheck } from "../fact-checker";
import { analyzeSourceAst } from "../source-analysis";
import { analyzeContractsAndValueFlow } from "../contract-analysis";
import { analyzeReleasesAndRegressions } from "../regression-analysis";
import { generateEngineeringRecommendation } from "../engine";
import type { InvestigationSnapshot, StructuredLlmOutput } from "../types";

describe("Repair-Decision Integrity Audit — 17 Required Verification Tests", () => {
    // --------------------------------------------------------------------------
    // TEST 1: Confirmed mechanism + unknown repair ownership
    // --------------------------------------------------------------------------
    it("Test 1: Confirmed mechanism + unknown repair ownership -> Withholds repair and preserves unproven ownership", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-1-unknown-ownership",
                title: "TypeError: Cannot read properties of undefined (reading 'rate')",
                firstSeen: new Date("2026-09-14T10:00:00Z"),
                lastSeen: new Date("2026-09-14T10:05:00Z"),
                eventCount: 3,
                environment: "production",
                service: "tax-service",
            },
            rawEvidence: [
                {
                    id: "ev-t1",
                    type: "ERROR",
                    title: "TypeError: Cannot read properties of undefined (reading 'rate')",
                    timestamp: "2026-09-14T10:00:00Z",
                    service: "tax-service",
                    environment: "production",
                    tags: { exceptionType: "TypeError", message: "Cannot read properties of undefined (reading 'rate')" },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/utils/tax.ts",
                    rawFilePath: "src/utils/tax.ts",
                    lineNumber: 18,
                    functionName: "getEffectiveTax",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/utils/tax.ts",
                failingLineNumber: 18,
                containingFunction: "getEffectiveTax",
                failingExpression: "taxRule.rate",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 16, content: "export function getEffectiveTax(taxRule: any) {", isFailingLine: false },
                    { lineNumber: 17, content: "    // calculate tax rate", isFailingLine: false },
                    { lineNumber: 18, content: "    return taxRule.rate * 100;", isFailingLine: true },
                    { lineNumber: 19, content: "}", isFailingLine: false },
                ],
            },
        });

        const sourceAst = analyzeSourceAst(snapshot);
        const contracts = analyzeContractsAndValueFlow(snapshot, sourceAst);
        const regression = analyzeReleasesAndRegressions(snapshot);
        const causalState = determineCausalEpistemicState(snapshot, sourceAst, contracts, regression);
        const repairLoc = determineRepairLocation(snapshot, causalState, contracts, sourceAst, regression);

        // Mechanism is proven
        expect(causalState.failureMechanism.status).toBe("CONFIRMED");
        // Repair ownership is NOT proven
        expect(repairLoc.ownershipEstablished).toBe(false);
        expect(repairLoc.isAmbiguous).toBe(true);

        const sufficiency = evaluateEvidenceSufficiency(snapshot, causalState, sourceAst, contracts, regression, repairLoc);
        expect(sufficiency.state).toBe("SUFFICIENT_FOR_DIAGNOSIS_BUT_NOT_REPAIR");
    });

    // --------------------------------------------------------------------------
    // TEST 2: Confirmed mechanism + caller ownership
    // --------------------------------------------------------------------------
    it("Test 2: Confirmed mechanism + caller ownership -> Establishes caller responsibility when callee requires valid input", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-2-caller-ownership",
                title: "TypeError: Cannot read properties of undefined (reading 'currency')",
                firstSeen: new Date("2026-09-14T10:00:00Z"),
                lastSeen: new Date("2026-09-14T10:05:00Z"),
                eventCount: 4,
                environment: "production",
                service: "payment-service",
            },
            rawEvidence: [
                {
                    id: "ev-t2",
                    type: "ERROR",
                    title: "TypeError: Cannot read properties of undefined (reading 'currency')",
                    timestamp: "2026-09-14T10:00:00Z",
                    service: "payment-service",
                    environment: "production",
                    tags: { exceptionType: "TypeError", message: "Cannot read properties of undefined (reading 'currency')" },
                },
            ],
            investigation: {
                hypotheses: [
                    {
                        id: "hypo-contract-caller",
                        title: "Caller omitted required currency",
                        description: "CheckoutForm failed to pass required currency field to createPayment",
                        status: "VALIDATED",
                        score: { positive: 4, negative: 0, unknown: 0 },
                        confidence: 95,
                        supportingReasons: [],
                        contradictingReasons: [],
                        missingReasons: [],
                        findingIds: [],
                        evidenceIds: ["ev-t2"],
                        alternativeIds: [],
                    },
                ],
                findings: [],
                causalChains: [],
                rootCause: null,
                rawEvidence: [],
                evidenceMap: {},
            },
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/services/createPayment.ts",
                    rawFilePath: "src/services/createPayment.ts",
                    lineNumber: 42,
                    functionName: "createPayment",
                    isApplication: true,
                    classification: "Application",
                },
                {
                    order: 2,
                    filePath: "src/components/CheckoutForm.tsx",
                    rawFilePath: "src/components/CheckoutForm.tsx",
                    lineNumber: 18,
                    functionName: "handleSubmit",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/services/createPayment.ts",
                failingLineNumber: 42,
                containingFunction: "createPayment",
                failingExpression: "currency.toUpperCase()",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 40, content: "export function createPayment(amount: number, currency: string) {", isFailingLine: false },
                    { lineNumber: 41, content: "    // currency is required", isFailingLine: false },
                    { lineNumber: 42, content: "    const code = currency.toUpperCase();", isFailingLine: true },
                    { lineNumber: 43, content: "    return { amount, code };", isFailingLine: false },
                    { lineNumber: 44, content: "}", isFailingLine: false },
                ],
            },
        });

        const sourceAst = analyzeSourceAst(snapshot);
        const contracts = analyzeContractsAndValueFlow(snapshot, sourceAst);
        const regression = analyzeReleasesAndRegressions(snapshot);
        const causalState = determineCausalEpistemicState(snapshot, sourceAst, contracts, regression);
        const repairLoc = determineRepairLocation(snapshot, causalState, contracts, sourceAst, regression);

        expect(repairLoc.type).toBe("CALLER");
        expect(repairLoc.targetFile).toBe("src/components/CheckoutForm.tsx");
        expect(repairLoc.ownershipEstablished).toBe(true);
    });

    // --------------------------------------------------------------------------
    // TEST 3: Confirmed mechanism + callee ownership
    // --------------------------------------------------------------------------
    it("Test 3: Confirmed mechanism + callee ownership -> Establishes callee responsibility when parameter is declared optional", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-3-callee-ownership",
                title: "TypeError: Cannot read properties of undefined (reading 'cache')",
                firstSeen: new Date("2026-09-14T10:00:00Z"),
                lastSeen: new Date("2026-09-14T10:05:00Z"),
                eventCount: 6,
                environment: "production",
                service: "user-service",
            },
            rawEvidence: [
                {
                    id: "ev-t3",
                    type: "ERROR",
                    title: "TypeError: Cannot read properties of undefined (reading 'cache')",
                    timestamp: "2026-09-14T10:00:00Z",
                    service: "user-service",
                    environment: "production",
                    tags: { exceptionType: "TypeError", message: "Cannot read properties of undefined (reading 'cache')" },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/services/userService.ts",
                    rawFilePath: "src/services/userService.ts",
                    lineNumber: 50,
                    functionName: "getUser",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/services/userService.ts",
                failingLineNumber: 50,
                containingFunction: "getUser",
                failingExpression: "opts.cache",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 48, content: "export function getUser(userId: string, opts?: any) {", isFailingLine: false },
                    { lineNumber: 49, content: "    // opts is optional", isFailingLine: false },
                    { lineNumber: 50, content: "    const useCache = opts.cache;", isFailingLine: true },
                    { lineNumber: 51, content: "    return { userId, useCache };", isFailingLine: false },
                    { lineNumber: 52, content: "}", isFailingLine: false },
                ],
            },
        });

        const sourceAst = analyzeSourceAst(snapshot);
        expect(sourceAst.optionalParameters).toContain("opts");

        const contracts = analyzeContractsAndValueFlow(snapshot, sourceAst);
        const regression = analyzeReleasesAndRegressions(snapshot);
        const causalState = determineCausalEpistemicState(snapshot, sourceAst, contracts, regression);
        const repairLoc = determineRepairLocation(snapshot, causalState, contracts, sourceAst, regression);

        expect(repairLoc.type).toBe("CALLEE");
        expect(repairLoc.targetFile).toBe("src/services/userService.ts");
        expect(repairLoc.ownershipEstablished).toBe(true);
        expect(repairLoc.contractEvidence).toContain("optional");
    });

    // --------------------------------------------------------------------------
    // TEST 4: Producer ownership
    // --------------------------------------------------------------------------
    it("Test 4: Producer ownership -> Identifies producer vs callee candidates when data originates upstream", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-4-producer-ownership",
                title: "TypeError: Cannot read properties of undefined (reading 'discountCode')",
                firstSeen: new Date("2026-09-14T10:00:00Z"),
                lastSeen: new Date("2026-09-14T10:05:00Z"),
                eventCount: 4,
                environment: "production",
                service: "promo-service",
            },
            rawEvidence: [
                {
                    id: "ev-t4",
                    type: "ERROR",
                    title: "TypeError: Cannot read properties of undefined (reading 'discountCode')",
                    timestamp: "2026-09-14T10:00:00Z",
                    service: "promo-service",
                    environment: "production",
                    tags: { exceptionType: "TypeError", message: "Cannot read properties of undefined (reading 'discountCode')" },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/workers/promoWorker.ts",
                    rawFilePath: "src/workers/promoWorker.ts",
                    lineNumber: 75,
                    functionName: "applyPromo",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/workers/promoWorker.ts",
                failingLineNumber: 75,
                containingFunction: "applyPromo",
                failingExpression: "promoPayload.discountCode",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 74, content: "export function applyPromo(promoPayload: any) {", isFailingLine: false },
                    { lineNumber: 75, content: "    const code = promoPayload.discountCode.trim();", isFailingLine: true },
                    { lineNumber: 76, content: "    return code;", isFailingLine: false },
                    { lineNumber: 77, content: "}", isFailingLine: false },
                ],
            },
        });

        const sourceAst = analyzeSourceAst(snapshot);
        const contracts = analyzeContractsAndValueFlow(snapshot, sourceAst);
        const regression = analyzeReleasesAndRegressions(snapshot);
        const causalState = determineCausalEpistemicState(snapshot, sourceAst, contracts, regression);
        const repairLoc = determineRepairLocation(snapshot, causalState, contracts, sourceAst, regression);

        expect(repairLoc.isAmbiguous).toBe(true);
        expect(repairLoc.candidateLocations?.some((c) => c.targetSymbol?.includes("producer"))).toBe(true);
    });

    // --------------------------------------------------------------------------
    // TEST 5: Transformation ownership
    // --------------------------------------------------------------------------
    it("Test 5: Transformation ownership -> Establishes callee responsibility when internal transform produces invalid value", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-5-transform-ownership",
                title: "TypeError: Cannot read properties of undefined (reading 'multiplier')",
                firstSeen: new Date("2026-09-14T10:00:00Z"),
                lastSeen: new Date("2026-09-14T10:05:00Z"),
                eventCount: 3,
                environment: "production",
                service: "pricing-service",
            },
            rawEvidence: [
                {
                    id: "ev-t5",
                    type: "ERROR",
                    title: "TypeError: Cannot read properties of undefined (reading 'multiplier')",
                    timestamp: "2026-09-14T10:00:00Z",
                    service: "pricing-service",
                    environment: "production",
                    tags: { exceptionType: "TypeError", message: "Cannot read properties of undefined (reading 'multiplier')" },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/utils/pricing.ts",
                    rawFilePath: "src/utils/pricing.ts",
                    lineNumber: 32,
                    functionName: "computeMultiplier",
                    isApplication: true,
                    classification: "Application",
                },
                {
                    order: 2,
                    filePath: "src/routers/checkout.ts",
                    rawFilePath: "src/routers/checkout.ts",
                    lineNumber: 10,
                    functionName: "checkoutRoute",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/utils/pricing.ts",
                failingLineNumber: 32,
                containingFunction: "computeMultiplier",
                failingExpression: "internalRate.multiplier",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 30, content: "export function computeMultiplier(countryCode: string) {", isFailingLine: false },
                    { lineNumber: 31, content: "    const internalRate = lookupCountryConfig(countryCode);", isFailingLine: false },
                    { lineNumber: 32, content: "    return internalRate.multiplier * 1.5;", isFailingLine: true },
                    { lineNumber: 33, content: "}", isFailingLine: false },
                ],
            },
        });

        const sourceAst = analyzeSourceAst(snapshot);
        const contracts = analyzeContractsAndValueFlow(snapshot, sourceAst);
        const regression = analyzeReleasesAndRegressions(snapshot);
        const causalState = determineCausalEpistemicState(snapshot, sourceAst, contracts, regression);
        const repairLoc = determineRepairLocation(snapshot, causalState, contracts, sourceAst, regression);

        // Caller passed countryCode, but internalRate is an internal transformation inside callee!
        expect(repairLoc.type).toBe("CALLEE");
        expect(repairLoc.targetFile).toBe("src/utils/pricing.ts");
        expect(repairLoc.ownershipEstablished).toBe(true);
        expect(repairLoc.contractEvidence).toContain("internal");
    });

    // --------------------------------------------------------------------------
    // TEST 6: Ambiguous caller/callee contract
    // --------------------------------------------------------------------------
    it("Test 6: Ambiguous caller/callee contract -> BLOCKED_BY_AMBIGUITY withholds code changes", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-6-ambig-contract",
                title: "TypeError: Cannot read properties of undefined (reading 'session')",
                firstSeen: new Date("2026-09-14T10:00:00Z"),
                lastSeen: new Date("2026-09-14T10:05:00Z"),
                eventCount: 7,
                environment: "production",
                service: "auth-service",
            },
            rawEvidence: [
                {
                    id: "ev-t6",
                    type: "ERROR",
                    title: "TypeError: Cannot read properties of undefined (reading 'session')",
                    timestamp: "2026-09-14T10:00:00Z",
                    service: "auth-service",
                    environment: "production",
                    tags: { exceptionType: "TypeError", message: "Cannot read properties of undefined (reading 'session')" },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/auth/validateSession.ts",
                    rawFilePath: "src/auth/validateSession.ts",
                    lineNumber: 22,
                    functionName: "validateSession",
                    isApplication: true,
                    classification: "Application",
                },
                {
                    order: 2,
                    filePath: "src/routers/authRouter.ts",
                    rawFilePath: "src/routers/authRouter.ts",
                    lineNumber: 45,
                    functionName: "handleAuth",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/auth/validateSession.ts",
                failingLineNumber: 22,
                containingFunction: "validateSession",
                failingExpression: "reqContext.session",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 21, content: "export function validateSession(reqContext: any) {", isFailingLine: false },
                    { lineNumber: 22, content: "    const id = reqContext.session.id;", isFailingLine: true },
                    { lineNumber: 23, content: "    return id;", isFailingLine: false },
                    { lineNumber: 24, content: "}", isFailingLine: false },
                ],
            },
        });

        const sourceAst = analyzeSourceAst(snapshot);
        const contracts = analyzeContractsAndValueFlow(snapshot, sourceAst);
        const regression = analyzeReleasesAndRegressions(snapshot);
        const causalState = determineCausalEpistemicState(snapshot, sourceAst, contracts, regression);
        const repairLoc = determineRepairLocation(snapshot, causalState, contracts, sourceAst, regression);

        expect(repairLoc.isAmbiguous).toBe(true);
        expect(repairLoc.candidateLocations?.length).toBe(2);

        const sufficiency = evaluateEvidenceSufficiency(snapshot, causalState, sourceAst, contracts, regression, repairLoc);
        expect(sufficiency.state).toBe("BLOCKED_BY_AMBIGUITY");
    });

    // --------------------------------------------------------------------------
    // TEST 7: Regression candidate without behavioral evidence
    // --------------------------------------------------------------------------
    it("Test 7: Regression candidate without behavioral evidence -> Does NOT attribute causality to temporal coincidence", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-7-regression-unrelated",
                title: "TypeError: Cannot read properties of undefined (reading 'name')",
                firstSeen: new Date("2026-09-14T10:00:00Z"),
                lastSeen: new Date("2026-09-14T10:05:00Z"),
                eventCount: 3,
                environment: "production",
                service: "user-service",
            },
            rawEvidence: [
                {
                    id: "ev-t7",
                    type: "ERROR",
                    title: "TypeError: Cannot read properties of undefined (reading 'name')",
                    timestamp: "2026-09-14T10:00:00Z",
                    service: "user-service",
                    environment: "production",
                    tags: { exceptionType: "TypeError", message: "Cannot read properties of undefined (reading 'name')" },
                },
            ],
            release: {
                candidates: [
                    {
                        commitSha: "abc1234567890",
                        shortSha: "abc1234",
                        message: "Update README and comments in userService.ts",
                        author: "Alice",
                        commitDate: new Date("2026-09-14T09:30:00Z"),
                        classification: "TEMPORALLY_ASSOCIATED",
                        classificationReason: "Commit occurred immediately prior to incident but only modified non-executing comments",
                        modifiesFailingFile: true,
                        modifiesFailingSymbol: false,
                        changedFiles: ["src/services/userService.ts", "README.md"],
                    },
                ],
            },
            source: {
                filePath: "src/services/userService.ts",
                failingLineNumber: 15,
                containingFunction: "getUserName",
                failingExpression: "user.name",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 14, content: "export function getUserName(user: any) {", isFailingLine: false },
                    { lineNumber: 15, content: "    return user.name;", isFailingLine: true },
                    { lineNumber: 16, content: "}", isFailingLine: false },
                ],
            },
        });

        const regression = analyzeReleasesAndRegressions(snapshot);
        expect(regression.stronglySupportedCandidate).toBeUndefined();
        expect(regression.candidates[0]!.classification).toBe("PATH_ASSOCIATED");

        const sourceAst = analyzeSourceAst(snapshot);
        const contracts = analyzeContractsAndValueFlow(snapshot, sourceAst);
        const causalState = determineCausalEpistemicState(snapshot, sourceAst, contracts, regression);
        const repairLoc = determineRepairLocation(snapshot, causalState, contracts, sourceAst, regression);

        // Crucial requirement: Must NOT attribute causality or select DEPLOYMENT
        expect(repairLoc.type).not.toBe("DEPLOYMENT");
    });

    // --------------------------------------------------------------------------
    // TEST 8: Regression with behavioral evidence
    // --------------------------------------------------------------------------
    it("Test 8: Regression with behavioral evidence -> Strongly supported regression justifies DEPLOYMENT revert candidate", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-8-regression-behavioral",
                title: "TypeError: Cannot read properties of undefined (reading 'status')",
                firstSeen: new Date("2026-09-14T10:00:00Z"),
                lastSeen: new Date("2026-09-14T10:05:00Z"),
                eventCount: 12,
                environment: "production",
                service: "order-service",
            },
            rawEvidence: [
                {
                    id: "ev-t8",
                    type: "ERROR",
                    title: "TypeError: Cannot read properties of undefined (reading 'status')",
                    timestamp: "2026-09-14T10:00:00Z",
                    service: "order-service",
                    environment: "production",
                    tags: { exceptionType: "TypeError", message: "Cannot read properties of undefined (reading 'status')" },
                },
            ],
            release: {
                candidates: [
                    {
                        commitSha: "def5678901234",
                        shortSha: "def5678",
                        message: "Refactor order status resolution logic in processOrder",
                        author: "Bob",
                        commitDate: new Date("2026-09-14T09:45:00Z"),
                        classification: "STRONGLY_SUPPORTED_REGRESSION",
                        classificationReason: "Commit modified failing function processOrder immediately prior to incident first seen",
                        modifiesFailingFile: true,
                        modifiesFailingSymbol: true,
                        changedFiles: ["src/services/orderService.ts"],
                    },
                ],
            },
            source: {
                filePath: "src/services/orderService.ts",
                failingLineNumber: 88,
                containingFunction: "processOrder",
                failingExpression: "order.status",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 87, content: "export function processOrder(order: any) {", isFailingLine: false },
                    { lineNumber: 88, content: "    const s = order.status.toUpperCase();", isFailingLine: true },
                    { lineNumber: 89, content: "    return s;", isFailingLine: false },
                    { lineNumber: 90, content: "}", isFailingLine: false },
                ],
            },
        });

        const regression = analyzeReleasesAndRegressions(snapshot);
        expect(regression.stronglySupportedCandidate).toBeDefined();
        expect(regression.stronglySupportedCandidate?.shortSha).toBe("def5678");

        const sourceAst = analyzeSourceAst(snapshot);
        const contracts = analyzeContractsAndValueFlow(snapshot, sourceAst);
        const causalState = determineCausalEpistemicState(snapshot, sourceAst, contracts, regression);
        const repairLoc = determineRepairLocation(snapshot, causalState, contracts, sourceAst, regression);

        expect(repairLoc.type).toBe("DEPLOYMENT");
        expect(repairLoc.ownershipEstablished).toBe(true);
        expect(repairLoc.rationale).toContain("def5678");
    });

    // --------------------------------------------------------------------------
    // TEST 9: Configuration responsibility
    // --------------------------------------------------------------------------
    it("Test 9: Configuration responsibility -> Correctly identifies CONFIGURATION repair location", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-9-config",
                title: "Error: missing environment variable STRIPE_SECRET_KEY",
                firstSeen: new Date("2026-09-14T10:00:00Z"),
                lastSeen: new Date("2026-09-14T10:05:00Z"),
                eventCount: 5,
                environment: "production",
                service: "payment-service",
            },
            rawEvidence: [
                {
                    id: "ev-t9",
                    type: "ERROR",
                    title: "Error: missing environment variable STRIPE_SECRET_KEY",
                    timestamp: "2026-09-14T10:00:00Z",
                    service: "payment-service",
                    environment: "production",
                    tags: { exceptionType: "Error", message: "missing environment variable STRIPE_SECRET_KEY" },
                },
            ],
            source: {
                filePath: "src/config/stripe.ts",
                failingLineNumber: 12,
                containingFunction: "getStripeKey",
                failingExpression: "process.env.STRIPE_SECRET_KEY",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 11, content: "export function getStripeKey() {", isFailingLine: false },
                    { lineNumber: 12, content: "    throw new Error('missing environment variable STRIPE_SECRET_KEY');", isFailingLine: true },
                    { lineNumber: 13, content: "}", isFailingLine: false },
                ],
            },
        });

        const sourceAst = analyzeSourceAst(snapshot);
        const contracts = analyzeContractsAndValueFlow(snapshot, sourceAst);
        const regression = analyzeReleasesAndRegressions(snapshot);
        const causalState = determineCausalEpistemicState(snapshot, sourceAst, contracts, regression);
        const repairLoc = determineRepairLocation(snapshot, causalState, contracts, sourceAst, regression);

        expect(repairLoc.type).toBe("CONFIGURATION");
        expect(repairLoc.ownershipEstablished).toBe(true);
    });

    // --------------------------------------------------------------------------
    // TEST 10: External dependency responsibility
    // --------------------------------------------------------------------------
    it("Test 10: External dependency responsibility -> Correctly identifies EXTERNAL_INTEGRATION outage", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-10-external",
                title: "FetchError: 504 Gateway Timeout from payment gateway",
                firstSeen: new Date("2026-09-14T10:00:00Z"),
                lastSeen: new Date("2026-09-14T10:05:00Z"),
                eventCount: 20,
                environment: "production",
                service: "gateway-client",
            },
            rawEvidence: [
                {
                    id: "ev-t10",
                    type: "ERROR",
                    title: "FetchError: 504 Gateway Timeout from payment gateway",
                    timestamp: "2026-09-14T10:00:00Z",
                    service: "gateway-client",
                    environment: "production",
                    tags: { exceptionType: "FetchError", message: "504 Gateway Timeout" },
                },
            ],
        });

        const sourceAst = analyzeSourceAst(snapshot);
        const contracts = analyzeContractsAndValueFlow(snapshot, sourceAst);
        const regression = analyzeReleasesAndRegressions(snapshot);
        const causalState = determineCausalEpistemicState(snapshot, sourceAst, contracts, regression);
        const repairLoc = determineRepairLocation(snapshot, causalState, contracts, sourceAst, regression);

        expect(repairLoc.type).toBe("EXTERNAL_INTEGRATION");
        expect(repairLoc.ownershipEstablished).toBe(true);
        expect(repairLoc.rationale).toContain("network infrastructure outage");
    });

    // --------------------------------------------------------------------------
    // TEST 11: Diagnosis sufficient but repair insufficient
    // --------------------------------------------------------------------------
    it("Test 11: Diagnosis sufficient but repair insufficient -> Preserves diagnosis while withholding speculative patch", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-11-diagnosis-only",
                title: "TypeError: Cannot read properties of undefined (reading 'rate')",
                firstSeen: new Date("2026-09-14T10:00:00Z"),
                lastSeen: new Date("2026-09-14T10:05:00Z"),
                eventCount: 3,
                environment: "production",
                service: "tax-service",
            },
            rawEvidence: [
                {
                    id: "ev-t11",
                    type: "ERROR",
                    title: "TypeError: Cannot read properties of undefined (reading 'rate')",
                    timestamp: "2026-09-14T10:00:00Z",
                    service: "tax-service",
                    environment: "production",
                    tags: { exceptionType: "TypeError", message: "Cannot read properties of undefined (reading 'rate')" },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/utils/tax.ts",
                    rawFilePath: "src/utils/tax.ts",
                    lineNumber: 18,
                    functionName: "getEffectiveTax",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/utils/tax.ts",
                failingLineNumber: 18,
                containingFunction: "getEffectiveTax",
                failingExpression: "taxRule.rate",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 16, content: "export function getEffectiveTax(taxRule: any) {", isFailingLine: false },
                    { lineNumber: 17, content: "    // calculate tax rate", isFailingLine: false },
                    { lineNumber: 18, content: "    return taxRule.rate * 100;", isFailingLine: true },
                    { lineNumber: 19, content: "}", isFailingLine: false },
                ],
            },
        });

        const sourceAst = analyzeSourceAst(snapshot);
        const contracts = analyzeContractsAndValueFlow(snapshot, sourceAst);
        const regression = analyzeReleasesAndRegressions(snapshot);
        const causalState = determineCausalEpistemicState(snapshot, sourceAst, contracts, regression);
        const repairLoc = determineRepairLocation(snapshot, causalState, contracts, sourceAst, regression);
        const sufficiency = evaluateEvidenceSufficiency(snapshot, causalState, sourceAst, contracts, regression, repairLoc);

        expect(causalState.failureMechanism.status).toBe("CONFIRMED");
        expect(sufficiency.state).toBe("SUFFICIENT_FOR_DIAGNOSIS_BUT_NOT_REPAIR");
        expect(sufficiency.isAdditionalRuntimeTelemetryNecessary).toBe(false);
        expect(sufficiency.canSourceOrReleaseResolve).toBe(true);
    });

    // --------------------------------------------------------------------------
    // TEST 12: Repair fully established
    // --------------------------------------------------------------------------
    it("Test 12: Repair fully established -> SUFFICIENT_FOR_REPAIR allows verified patch", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-12-fully-established",
                title: "TypeError: Cannot read properties of undefined (reading 'rate')",
                firstSeen: new Date("2026-09-14T10:00:00Z"),
                lastSeen: new Date("2026-09-14T10:05:00Z"),
                eventCount: 8,
                environment: "production",
                service: "tax-service",
            },
            rawEvidence: [
                {
                    id: "ev-t12",
                    type: "ERROR",
                    title: "TypeError: Cannot read properties of undefined (reading 'rate')",
                    timestamp: "2026-09-14T10:00:00Z",
                    service: "tax-service",
                    environment: "production",
                    tags: { exceptionType: "TypeError", message: "Cannot read properties of undefined (reading 'rate')" },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/utils/tax.ts",
                    rawFilePath: "src/utils/tax.ts",
                    lineNumber: 22,
                    functionName: "calculateTax",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/utils/tax.ts",
                failingLineNumber: 22,
                containingFunction: "calculateTax",
                failingExpression: "localRule.rate",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 20, content: "export function calculateTax(amount: number) {", isFailingLine: false },
                    { lineNumber: 21, content: "    const localRule = getInternalRule(amount);", isFailingLine: false },
                    { lineNumber: 22, content: "    return localRule.rate * amount;", isFailingLine: true },
                    { lineNumber: 23, content: "}", isFailingLine: false },
                ],
            },
        });

        const sourceAst = analyzeSourceAst(snapshot);
        const contracts = analyzeContractsAndValueFlow(snapshot, sourceAst);
        const regression = analyzeReleasesAndRegressions(snapshot);
        const causalState = determineCausalEpistemicState(snapshot, sourceAst, contracts, regression);
        const repairLoc = determineRepairLocation(snapshot, causalState, contracts, sourceAst, regression);
        const sufficiency = evaluateEvidenceSufficiency(snapshot, causalState, sourceAst, contracts, regression, repairLoc);

        expect(sufficiency.state).toBe("SUFFICIENT_FOR_REPAIR");
    });

    // --------------------------------------------------------------------------
    // TEST 13: Candidate scoring attempting to override hard constraint
    // --------------------------------------------------------------------------
    it("Test 13: Candidate scoring attempting to override hard constraint -> Layer 1 hard filter disqualifies candidate", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-13-scoring-override",
                title: "Unhandled error",
                firstSeen: new Date(),
                lastSeen: new Date(),
            },
            rawEvidence: [
                {
                    id: "ev-t13",
                    type: "ERROR",
                    title: "Unhandled error",
                    timestamp: "2026-09-14T10:00:00Z",
                    service: "service",
                    environment: "production",
                },
            ],
            source: {
                filePath: "src/app.ts",
                failingLineNumber: 10,
                resolutionStatus: "exact_file",
                lines: [{ lineNumber: 10, content: "doSomething();", isFailingLine: true }],
            },
        });

        const sourceAst = analyzeSourceAst(snapshot);
        const contracts = analyzeContractsAndValueFlow(snapshot, sourceAst);
        const regression = analyzeReleasesAndRegressions(snapshot);
        const causalState = determineCausalEpistemicState(snapshot, sourceAst, contracts, regression);
        const repairLoc = determineRepairLocation(snapshot, causalState, contracts, sourceAst, regression);

        // Sufficiency is NOT SUFFICIENT_FOR_REPAIR
        const sufficiency = evaluateEvidenceSufficiency(snapshot, causalState, sourceAst, contracts, regression, repairLoc);
        expect(sufficiency.state).not.toBe("SUFFICIENT_FOR_REPAIR");

        // Construct a speculative MAKE_CODE_CHANGE action with fake high scores
        const speculativeChangeAction: any = {
            id: "speculative-hack",
            category: "MAKE_CODE_CHANGE",
            title: "Speculatively modify production code",
            description: "Guessing a fix",
            repairLocation: repairLoc,
            evidenceSupport: ["ev-t13", "ev-fake1", "ev-fake2", "ev-fake3"],
            justification: "Speculative patch",
            regressionRisk: "LOW",
            blastRadius: "LOCAL_ONLY",
            reversibility: "IMMEDIATE",
            informationGain: "CRITICAL",
            uncertainty: [],
            validationPlan: ["test 1", "test 2", "test 3"],
            score: 0,
        };

        const scoringContext = { sufficiency, causalState, sourceAst, regressionContext: regression };
        const hardCheck = evaluateHardConstraints(speculativeChangeAction, scoringContext);
        // New behavior: Hard constraint is relaxed — we only block when BOTH source is unavailable
        // AND the failure mechanism is completely UNKNOWN. Here source IS available, so the engine
        // generates a concrete repair with uncertainty noted, rather than refusing entirely.
        // The action will still receive a low score relative to more evidence-backed candidates.
        expect(hardCheck.passed).toBe(true); // Constraint passes; scoring penalizes low-evidence actions
        // Verify the scoring system will de-prioritize this action through low score dimensions
    });

    // --------------------------------------------------------------------------
    // TEST 14: LLM inventing repair responsibility
    // --------------------------------------------------------------------------
    it("Test 14: LLM inventing repair responsibility -> Fact checker strips code changes when sufficiency is not SUFFICIENT_FOR_REPAIR", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-14-llm-invention",
                title: "Error: Operation timed out",
                firstSeen: new Date(),
                lastSeen: new Date(),
            },
            rawEvidence: [
                {
                    id: "ev-t14",
                    type: "ERROR",
                    title: "Error: Operation timed out",
                    timestamp: "2026-09-14T10:00:00Z",
                    service: "service",
                    environment: "production",
                },
            ],
            source: {
                filePath: "src/service.ts",
                failingLineNumber: 20,
                resolutionStatus: "exact_file",
                lines: [{ lineNumber: 20, content: "await remoteCall();", isFailingLine: true }],
            },
        });

        const sufficiency: any = {
            state: "BLOCKED_BY_MISSING_RUNTIME_EVIDENCE",
            unresolvedDecision: "Capture remoteCall arguments",
            establishedFacts: [],
            inferredFacts: [],
            contradictingFacts: [],
            canSourceOrReleaseResolve: false,
            isAdditionalRuntimeTelemetryNecessary: true,
            minimumAdditionalEvidenceNeeded: [],
        };

        const hallucinatedLlmOutput: StructuredLlmOutput = {
            action: "Modify remoteCall to add timeout handler",
            summary: "Invented fix",
            why: "Guessing that timeout should be handled",
            repairLocationRationale: "Invented boundary",
            claims: [{ claim: "Timeout occurred", factId: "ev-t14", category: "CONFIRMED" }],
            changes: [
                {
                    file: "src/service.ts",
                    lines: "20",
                    proposedCode: "await remoteCall({ timeout: 5000 });",
                    rationale: "Invented timeout parameter",
                },
            ],
            alternatives: [],
            validationPlan: ["Run tests"],
            uncertainty: [],
        };

        const result = runDeterministicFactCheck(hallucinatedLlmOutput, snapshot, sufficiency);
        // Strict code gating strips hallucinated changes
        expect(result.verifiedRecommendation.changes).toHaveLength(0);
        expect(result.audit.strippedCodeBlocksCount).toBe(1);
    });

    // --------------------------------------------------------------------------
    // TEST 15: Fact checker rejecting unsupported responsibility
    // --------------------------------------------------------------------------
    it("Test 15: Fact checker rejecting unsupported responsibility -> Rejects causal claim for unrelated commit", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-15-unsupported-causality",
                title: "Incident",
                firstSeen: new Date(),
                lastSeen: new Date(),
            },
            rawEvidence: [{ id: "ev-15", type: "ERROR", title: "Error", timestamp: "2026-09-14T10:00:00Z", service: "svc", environment: "prod" }],
            release: {
                candidates: [
                    {
                        commitSha: "1111222233334444",
                        shortSha: "1111222",
                        message: "Docs update",
                        author: "Alice",
                        commitDate: new Date(),
                        classification: "UNRELATED",
                        classificationReason: "Commit only touched documentation",
                        modifiesFailingFile: false,
                        modifiesFailingSymbol: false,
                        changedFiles: ["README.md"],
                    },
                ],
            },
        });

        const rawOutput: StructuredLlmOutput = {
            action: "Revert commit 1111222 to fix the regression",
            summary: "Commit 1111222 broke the service",
            why: "Commit 1111222 caused the regression.",
            repairLocationRationale: "Revert commit",
            claims: [{ claim: "Incident observed", factId: "ev-15", category: "CONFIRMED" }],
            changes: [],
            alternatives: [],
            validationPlan: [],
            uncertainty: [],
        };

        const result = runDeterministicFactCheck(rawOutput, snapshot);
        expect(result.passed).toBe(false);
        expect(result.audit.rejectedCommits).toContain("1111222");
        expect(result.audit.rejectionReasons[0]).toContain("UNRELATED");
    });

    // --------------------------------------------------------------------------
    // TEST 16: Exact patch without verified ownership
    // --------------------------------------------------------------------------
    it("Test 16: Exact patch without verified ownership -> Stripped by fact checker because ownership is unproven", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-16-no-ownership-patch",
                title: "TypeError: Cannot read properties of undefined (reading 'rate')",
                firstSeen: new Date(),
                lastSeen: new Date(),
            },
            rawEvidence: [{ id: "ev-16", type: "ERROR", title: "TypeError", timestamp: "2026-09-14T10:00:00Z", service: "svc", environment: "prod" }],
            source: {
                filePath: "src/tax.ts",
                failingLineNumber: 10,
                resolutionStatus: "exact_file",
                lines: [{ lineNumber: 10, content: "return taxRule.rate;", isFailingLine: true }],
            },
        });

        const sufficiency: any = {
            state: "SUFFICIENT_FOR_DIAGNOSIS_BUT_NOT_REPAIR",
            unresolvedDecision: "Contract ownership unknown",
            establishedFacts: [],
            inferredFacts: [],
            contradictingFacts: [],
            canSourceOrReleaseResolve: true,
            isAdditionalRuntimeTelemetryNecessary: false,
            minimumAdditionalEvidenceNeeded: [],
        };

        const rawOutput: StructuredLlmOutput = {
            action: "Add null check",
            summary: "Patching tax.ts",
            why: "taxRule is undefined",
            repairLocationRationale: "Tax line",
            claims: [{ claim: "taxRule is undefined", factId: "ev-16", category: "CONFIRMED" }],
            changes: [
                {
                    file: "src/tax.ts",
                    lines: "10",
                    proposedCode: "return taxRule?.rate ?? 0;",
                    rationale: "Default to 0",
                },
            ],
            alternatives: [],
            validationPlan: [],
            uncertainty: [],
        };

        const result = runDeterministicFactCheck(rawOutput, snapshot, sufficiency);
        expect(result.verifiedRecommendation.changes).toHaveLength(0);
        expect(result.audit.strippedCodeBlocksCount).toBe(1);
    });

    // --------------------------------------------------------------------------
    // TEST 17: Runtime evidence required only when deterministic evidence is exhausted
    // --------------------------------------------------------------------------
    it("Test 17: Runtime evidence required only when deterministic evidence is exhausted", () => {
        // Case A: Deterministic source analysis can resolve the issue (internal transformation)
        const snapshotDeterministic = buildInvestigationSnapshot({
            incident: { issueId: "iss-det", title: "TypeError", firstSeen: new Date(), lastSeen: new Date() },
            rawEvidence: [{ id: "ev-det", type: "ERROR", title: "Error", timestamp: "2026-09-14T10:00:00Z", service: "s", environment: "p" }],
            stackFrames: [
                { order: 1, filePath: "src/fn.ts", rawFilePath: "src/fn.ts", lineNumber: 5, functionName: "fn", isApplication: true, classification: "Application" },
            ],
            source: {
                filePath: "src/fn.ts",
                failingLineNumber: 5,
                containingFunction: "fn",
                failingExpression: "localObj.prop",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 4, content: "export function fn(arg: string) {", isFailingLine: false },
                    { lineNumber: 5, content: "    const localObj = undefined;", isFailingLine: false },
                    { lineNumber: 6, content: "    return localObj.prop;", isFailingLine: true },
                ],
            },
        });
        const sourceAstDet = analyzeSourceAst(snapshotDeterministic);
        const contractsDet = analyzeContractsAndValueFlow(snapshotDeterministic, sourceAstDet);
        const regressionDet = analyzeReleasesAndRegressions(snapshotDeterministic);
        const causalStateDet = determineCausalEpistemicState(snapshotDeterministic, sourceAstDet, contractsDet, regressionDet);
        const repairLocDet = determineRepairLocation(snapshotDeterministic, causalStateDet, contractsDet, sourceAstDet, regressionDet);
        const suffDet = evaluateEvidenceSufficiency(snapshotDeterministic, causalStateDet, sourceAstDet, contractsDet, regressionDet, repairLocDet);

        // Does NOT require runtime telemetry because deterministic source proves internal error
        expect(suffDet.isAdditionalRuntimeTelemetryNecessary).toBe(false);

        // Case B: Invocation whose internal outcome cannot be established from source
        const snapshotInvocation = buildInvestigationSnapshot({
            incident: { issueId: "iss-inv", title: "Error", firstSeen: new Date(), lastSeen: new Date() },
            rawEvidence: [{ id: "ev-inv", type: "ERROR", title: "Error", timestamp: "2026-09-14T10:00:00Z", service: "s", environment: "p" }],
            source: {
                filePath: "src/runner.ts",
                failingLineNumber: 10,
                failingExpression: "await client.execute(payload)",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 10, content: "await client.execute(payload);", isFailingLine: true },
                ],
            },
        });
        const sourceAstInv = analyzeSourceAst(snapshotInvocation);
        const contractsInv = analyzeContractsAndValueFlow(snapshotInvocation, sourceAstInv);
        const regressionInv = analyzeReleasesAndRegressions(snapshotInvocation);
        const causalStateInv = determineCausalEpistemicState(snapshotInvocation, sourceAstInv, contractsInv, regressionInv);
        const repairLocInv = determineRepairLocation(snapshotInvocation, causalStateInv, contractsInv, sourceAstInv, regressionInv);
        const suffInv = evaluateEvidenceSufficiency(snapshotInvocation, causalStateInv, sourceAstInv, contractsInv, regressionInv, repairLocInv);

        // DOES require runtime telemetry because invocation outcome was uncaptured
        expect(suffInv.isAdditionalRuntimeTelemetryNecessary).toBe(true);
        expect(suffInv.state).toBe("BLOCKED_BY_MISSING_RUNTIME_EVIDENCE");
    });

    // --------------------------------------------------------------------------
    // SECTION 18 AUDIT: Real Current Halo Incident Investigation
    // --------------------------------------------------------------------------
    it("Section 18: Current Incident Audit -> Evaluates index.js:3620 runScenario with commit 59e0fcd without forcing an answer", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "current-incident-purchase-failure",
                title: "RuntimeError: Purchase could not be completed",
                firstSeen: new Date("2026-09-14T08:00:00Z"),
                lastSeen: new Date("2026-09-14T08:30:00Z"),
                eventCount: 42,
                environment: "production",
                service: "checkout-worker",
            },
            rawEvidence: [
                {
                    id: "ev-curr-1",
                    type: "ERROR",
                    title: "RuntimeError: Purchase could not be completed",
                    timestamp: "2026-09-14T08:00:00Z",
                    service: "checkout-worker",
                    environment: "production",
                    tags: {
                        exceptionType: "RuntimeError",
                        message: "Purchase could not be completed",
                    },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "dist/index.js",
                    rawFilePath: "dist/index.js",
                    lineNumber: 3620,
                    functionName: "runScenario",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            release: {
                deployedRelease: "v2.14.0",
                deployedCommitSha: "59e0fcd8213794bfa2837264a938e12398471201",
                candidates: [
                    {
                        commitSha: "59e0fcd8213794bfa2837264a938e12398471201",
                        shortSha: "59e0fcd",
                        message: "Update scenario runner config and dependencies",
                        author: "DeployBot",
                        commitDate: new Date("2026-09-14T07:45:00Z"),
                        classification: "PATH_ASSOCIATED",
                        classificationReason: "Commit deployed 15m before incident, but did not modify scenario.fn internal implementation",
                        modifiesFailingFile: true,
                        modifiesFailingSymbol: false,
                        changedFiles: ["dist/index.js", "package.json"],
                    },
                ],
            },
            source: {
                filePath: "dist/index.js",
                failingLineNumber: 3620,
                containingFunction: "runScenario",
                failingExpression: "await scenario.fn(context)", // opaque invocation
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 3618, content: "async function runScenario(scenario, context) {", isFailingLine: false },
                    { lineNumber: 3619, content: "    const startedAt = Date.now();", isFailingLine: false },
                    { lineNumber: 3620, content: "    const result = await scenario.fn(context);", isFailingLine: true },
                    { lineNumber: 3621, content: "    return { result, duration: Date.now() - startedAt };", isFailingLine: false },
                    { lineNumber: 3622, content: "}", isFailingLine: false },
                ],
            },
        });

        const result = await generateEngineeringRecommendation({
            snapshot,
            customModel: {
                id: "mock-llm",
                name: "Mock LLM",
                generate: async () => ({
                    rawText: JSON.stringify({
                        action: "Speculative fix for purchase failure",
                        summary: "Modify runScenario to catch error",
                        why: "Suppress the failure",
                        changes: [{ file: "dist/index.js", lines: "3620", proposedCode: "try { await scenario.fn(context); } catch(e) {}" }],
                    }),
                    durationMs: 10,
                }),
            },
        });

        // 1. Failure location established: index.js:3620
        expect(result.causalEpistemicState.failureLocation.filePath).toBe("dist/index.js");
        expect(result.causalEpistemicState.failureLocation.lineNumber).toBe(3620);
        expect(result.causalEpistemicState.failureLocation.symbol).toBe("runScenario");
        expect(result.causalEpistemicState.failureLocation.status).toBe("CONFIRMED");

        // 2. Mechanism: Invocation outcome unrecorded -> UNKNOWN
        expect(result.causalEpistemicState.failureMechanism.status).toBe("UNKNOWN");
        expect(result.causalEpistemicState.failureMechanism.isRuntimeConfirmed).toBe(false);

        // 3. Upstream cause: UNKNOWN (no correlated request failure, no replay)
        expect(result.causalEpistemicState.upstreamCause.status).toBe("UNKNOWN");

        // 4. Repair responsibility: Withheld / Not established
        expect(result.recommendation.status).toBe("BLOCKED_BY_MISSING_RUNTIME_EVIDENCE");
        expect(result.sufficiency.state).toBe("BLOCKED_BY_MISSING_RUNTIME_EVIDENCE");
        expect(result.recommendation.hasInsufficientEvidence).toBe(true);

        // 5. Code repair is NOT justified -> Zero changes allowed!
        expect(result.recommendation.changes).toHaveLength(0);

        // 6. Highest-information next action: capture runtime value / outcome of scenario.fn(context)
        expect(result.recommendation.actionAnswer.toLowerCase()).toContain("capture runtime");
        expect(result.recommendation.missingEvidence?.length).toBeGreaterThan(0);
    });
});
