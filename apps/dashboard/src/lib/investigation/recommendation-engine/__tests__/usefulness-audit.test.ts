/**
 * Halo Trace — Final Engineering Usefulness Audit Test Suite
 *
 * Implements Section 18 Regression Tests:
 *   A. Repository source identifies the concrete callee; runtime arguments are missing
 *   B. Repository identifies the exact error construction; runtime outcome missing
 *   C. Repository cannot identify callee implementation (opaque dynamic dispatch)
 *   D. Multiple implementations exist -> Preserves ambiguity
 *   E. Tests establish contract ownership -> Pre-telemetry dev reproduction
 *   F. Source maps identify source-level origin -> Prefer source over dist
 *   G. Repository evidence resolves the mechanism -> Do not request telemetry
 *   H. Repository evidence cannot resolve runtime state -> Targeted runtime evidence with Information Frontier
 */

import { describe, it, expect } from "vitest";
import { buildInvestigationSnapshot } from "../investigation-snapshot";
import { determineCausalEpistemicState } from "../causal-determination";
import { determineRepairLocation } from "../repair-location";
import { evaluateEvidenceSufficiency } from "../sufficiency-engine";
import { generateAndEvaluateCandidateActions } from "../candidate-actions";
import { analyzeSourceAst } from "../source-analysis";
import { analyzeContractsAndValueFlow } from "../contract-analysis";
import { analyzeReleasesAndRegressions } from "../regression-analysis";
import { generateEngineeringRecommendation } from "../engine";

describe("Engineering Usefulness Audit — Premature Telemetry Gating Tests", () => {
    // --------------------------------------------------------------------------
    // TEST A: Repository identifies concrete callee; runtime arguments missing
    // --------------------------------------------------------------------------
    it("Test A: Repository source identifies concrete callee -> Uses static callee analysis before requesting telemetry", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-a-concrete-callee",
                title: "TypeError: Invalid order status",
                firstSeen: new Date("2026-09-14T10:00:00Z"),
                lastSeen: new Date("2026-09-14T10:05:00Z"),
                eventCount: 5,
                environment: "production",
                service: "order-service",
            },
            rawEvidence: [
                {
                    id: "ev-ta",
                    type: "ERROR",
                    title: "TypeError: Invalid order status",
                    timestamp: "2026-09-14T10:00:00Z",
                    service: "order-service",
                    environment: "production",
                    tags: { exceptionType: "TypeError", message: "Invalid order status" },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/services/orderService.ts",
                    rawFilePath: "src/services/orderService.ts",
                    lineNumber: 45,
                    functionName: "processOrder",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/services/orderService.ts",
                failingLineNumber: 45,
                containingFunction: "processOrder",
                failingExpression: "validateOrderStatus(order)",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 30, content: "function validateOrderStatus(order: any) {", isFailingLine: false },
                    { lineNumber: 31, content: "    return order.status.toUpperCase();", isFailingLine: false },
                    { lineNumber: 32, content: "}", isFailingLine: false },
                    { lineNumber: 44, content: "export function processOrder(order: any) {", isFailingLine: false },
                    { lineNumber: 45, content: "    validateOrderStatus(order);", isFailingLine: true },
                    { lineNumber: 46, content: "}", isFailingLine: false },
                ],
            },
        });

        const sourceAst = analyzeSourceAst(snapshot);
        expect(sourceAst.invocationAnalysis?.isInvocation).toBe(true);
        expect(sourceAst.invocationAnalysis?.calleeOpacity).toBe("CALLEE_IMPLEMENTATION_IDENTIFIED_ARGUMENTS_UNKNOWN");
        expect(sourceAst.invocationAnalysis?.calleeExpression).toBe("validateOrderStatus");

        const contracts = analyzeContractsAndValueFlow(snapshot, sourceAst);
        const regression = analyzeReleasesAndRegressions(snapshot);
        const causalState = determineCausalEpistemicState(snapshot, sourceAst, contracts, regression);

        // Does NOT collapse into opaque invocation: Recognizes concrete callee
        expect(causalState.failureMechanism.status).toBe("PLAUSIBLE");
        expect(causalState.failureMechanism.description).toContain("Concrete callee implementation identified");
    });

    // --------------------------------------------------------------------------
    // TEST B: Repository identifies exact error construction; runtime outcome missing
    // --------------------------------------------------------------------------
    it("Test B: Repository identifies exact error construction -> Narrows mechanism without fabricating runtime facts", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-b-error-construction",
                title: "RuntimeError: Purchase could not be completed",
                firstSeen: new Date("2026-09-14T10:00:00Z"),
                lastSeen: new Date("2026-09-14T10:05:00Z"),
                eventCount: 8,
                environment: "production",
                service: "checkout-service",
            },
            rawEvidence: [
                {
                    id: "ev-tb",
                    type: "ERROR",
                    title: "RuntimeError: Purchase could not be completed",
                    timestamp: "2026-09-14T10:00:00Z",
                    service: "checkout-service",
                    environment: "production",
                    tags: { exceptionType: "RuntimeError", message: "Purchase could not be completed" },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/services/purchase.ts",
                    rawFilePath: "src/services/purchase.ts",
                    lineNumber: 22,
                    functionName: "executePurchase",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/services/purchase.ts",
                failingLineNumber: 22,
                containingFunction: "executePurchase",
                failingExpression: "throw new RuntimeError(\"Purchase could not be completed\")",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 20, content: "export function executePurchase(cart: any) {", isFailingLine: false },
                    { lineNumber: 21, content: "    if (!cart.isPaid) {", isFailingLine: false },
                    { lineNumber: 22, content: "        throw new RuntimeError(\"Purchase could not be completed\");", isFailingLine: true },
                    { lineNumber: 23, content: "    }", isFailingLine: false },
                    { lineNumber: 24, content: "}", isFailingLine: false },
                ],
            },
        });

        const sourceAst = analyzeSourceAst(snapshot);
        expect(sourceAst.errorPropagation.originatesHere).toBe(true);

        const contracts = analyzeContractsAndValueFlow(snapshot, sourceAst);
        const regression = analyzeReleasesAndRegressions(snapshot);
        const causalState = determineCausalEpistemicState(snapshot, sourceAst, contracts, regression);

        // Mechanism is confirmed because exact throw was located
        expect(causalState.failureMechanism.status).toBe("CONFIRMED");
        expect(causalState.failureMechanism.isRuntimeConfirmed).toBe(true);
        expect(causalState.failureMechanism.description).toContain("Explicit throw statement encountered");
    });

    // --------------------------------------------------------------------------
    // TEST C: Repository cannot identify callee implementation
    // --------------------------------------------------------------------------
    it("Test C: Repository cannot identify callee implementation (dynamic dispatch) -> Requires targeted runtime evidence", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-c-opaque-callee",
                title: "RuntimeError: Purchase could not be completed",
                firstSeen: new Date("2026-09-14T10:00:00Z"),
                lastSeen: new Date("2026-09-14T10:05:00Z"),
                eventCount: 15,
                environment: "production",
                service: "checkout-runner",
            },
            rawEvidence: [
                {
                    id: "ev-tc",
                    type: "ERROR",
                    title: "RuntimeError: Purchase could not be completed",
                    timestamp: "2026-09-14T10:00:00Z",
                    service: "checkout-runner",
                    environment: "production",
                    tags: { exceptionType: "RuntimeError", message: "Purchase could not be completed" },
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
            source: {
                filePath: "dist/index.js",
                failingLineNumber: 3620,
                containingFunction: "runScenario",
                failingExpression: "await scenario.fn(context)",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 3618, content: "async function runScenario(scenario, context) {", isFailingLine: false },
                    { lineNumber: 3619, content: "    const startedAt = Date.now();", isFailingLine: false },
                    { lineNumber: 3620, content: "    const result = await scenario.fn(context);", isFailingLine: true },
                    { lineNumber: 3621, content: "    return result;", isFailingLine: false },
                    { lineNumber: 3622, content: "}", isFailingLine: false },
                ],
            },
        });

        const sourceAst = analyzeSourceAst(snapshot);
        expect(sourceAst.invocationAnalysis?.calleeOpacity).toBe("CALLEE_OPAQUE_UNRESOLVABLE");

        const contracts = analyzeContractsAndValueFlow(snapshot, sourceAst);
        const regression = analyzeReleasesAndRegressions(snapshot);
        const causalState = determineCausalEpistemicState(snapshot, sourceAst, contracts, regression);
        const repairLoc = determineRepairLocation(snapshot, causalState, contracts, sourceAst, regression);
        const suff = evaluateEvidenceSufficiency(snapshot, causalState, sourceAst, contracts, regression, repairLoc);

        expect(suff.state).toBe("BLOCKED_BY_MISSING_RUNTIME_EVIDENCE");
        expect(suff.isAdditionalRuntimeTelemetryNecessary).toBe(true);
        expect(suff.informationFrontier?.runtimeOnly.length).toBeGreaterThan(0);
        expect(suff.actionExplanation?.whatWeDontKnow).toContain("Which concrete implementation was supplied");
    });

    // --------------------------------------------------------------------------
    // TEST D: Multiple implementations exist -> Preserves ambiguity
    // --------------------------------------------------------------------------
    it("Test D: Multiple competing repair locations exist -> Preserves ambiguity", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-d-ambiguity",
                title: "TypeError: Cannot read properties of undefined (reading 'rate')",
                firstSeen: new Date("2026-09-14T10:00:00Z"),
                lastSeen: new Date("2026-09-14T10:05:00Z"),
                eventCount: 3,
                environment: "production",
                service: "pricing-service",
            },
            rawEvidence: [
                {
                    id: "ev-td",
                    type: "ERROR",
                    title: "TypeError: Cannot read properties of undefined (reading 'rate')",
                    timestamp: "2026-09-14T10:00:00Z",
                    service: "pricing-service",
                    environment: "production",
                    tags: { exceptionType: "TypeError", message: "Cannot read properties of undefined (reading 'rate')" },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/services/pricing.ts",
                    rawFilePath: "src/services/pricing.ts",
                    lineNumber: 25,
                    functionName: "calculateTax",
                    isApplication: true,
                    classification: "Application",
                },
                {
                    order: 2,
                    filePath: "src/routers/checkout.ts",
                    rawFilePath: "src/routers/checkout.ts",
                    lineNumber: 90,
                    functionName: "handleCheckout",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/services/pricing.ts",
                failingLineNumber: 25,
                containingFunction: "calculateTax",
                failingExpression: "taxRule.rate",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 24, content: "export function calculateTax(amount: number, taxRule: any) {", isFailingLine: false },
                    { lineNumber: 25, content: "    return amount * taxRule.rate;", isFailingLine: true },
                    { lineNumber: 26, content: "}", isFailingLine: false },
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

        const suff = evaluateEvidenceSufficiency(snapshot, causalState, sourceAst, contracts, regression, repairLoc);
        expect(suff.state).toBe("BLOCKED_BY_AMBIGUITY");
    });

    // --------------------------------------------------------------------------
    // TEST E: Tests establish contract ownership -> Pre-telemetry dev reproduction
    // --------------------------------------------------------------------------
    it("Test E: Test fixture exists in repository -> Prefers local reproduction over production telemetry", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-e-repro-in-dev",
                title: "Error: Unexpected payment status",
                firstSeen: new Date("2026-09-14T10:00:00Z"),
                lastSeen: new Date("2026-09-14T10:05:00Z"),
                eventCount: 4,
                environment: "production",
                service: "payment-worker",
            },
            rawEvidence: [
                {
                    id: "ev-te",
                    type: "ERROR",
                    title: "Error: Unexpected payment status",
                    timestamp: "2026-09-14T10:00:00Z",
                    service: "payment-worker",
                    environment: "production",
                    tags: { exceptionType: "Error", message: "Unexpected payment status" },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/workers/payment.ts",
                    rawFilePath: "src/workers/payment.ts",
                    lineNumber: 12,
                    functionName: "handlePayment",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/workers/payment.ts",
                failingLineNumber: 12,
                containingFunction: "handlePayment",
                failingExpression: "await client.verify(payload)",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 11, content: "export async function handlePayment(payload: any) {", isFailingLine: false },
                    { lineNumber: 12, content: "    const res = await client.verify(payload);", isFailingLine: true },
                    { lineNumber: 13, content: "    return res;", isFailingLine: false },
                    { lineNumber: 14, content: "}", isFailingLine: false },
                ],
            },
            tests: {
                hasRelevantTests: true,
                testFiles: ["test/payment-worker.test.ts"],
                reproductionPossibleInDev: true,
            },
        });

        const sourceAst = analyzeSourceAst(snapshot);
        expect(sourceAst.testsContractEvidence?.reproductionPossibleInDev).toBe(true);

        const contracts = analyzeContractsAndValueFlow(snapshot, sourceAst);
        const regression = analyzeReleasesAndRegressions(snapshot);
        const causalState = determineCausalEpistemicState(snapshot, sourceAst, contracts, regression);
        const repairLoc = determineRepairLocation(snapshot, causalState, contracts, sourceAst, regression);
        const suff = evaluateEvidenceSufficiency(snapshot, causalState, sourceAst, contracts, regression, repairLoc);

        // Crucial requirement: canSourceOrReleaseResolve is TRUE, does NOT require production telemetry!
        expect(suff.canSourceOrReleaseResolve).toBe(true);
        expect(suff.isAdditionalRuntimeTelemetryNecessary).toBe(false);
        expect(suff.minimumAdditionalEvidenceNeeded[0]).toContain("Local test reproduction");
    });

    // --------------------------------------------------------------------------
    // TEST F: Source maps identify source-level origin -> Prefer source over dist
    // --------------------------------------------------------------------------
    it("Test F: Source map identifies source-level origin -> Records source counterpart", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-f-source-maps",
                title: "TypeError: Cannot read properties of undefined",
                firstSeen: new Date("2026-09-14T10:00:00Z"),
                lastSeen: new Date("2026-09-14T10:05:00Z"),
                eventCount: 3,
                environment: "production",
                service: "web-client",
            },
            rawEvidence: [
                {
                    id: "ev-tf",
                    type: "ERROR",
                    title: "TypeError: Cannot read properties of undefined",
                    timestamp: "2026-09-14T10:00:00Z",
                    service: "web-client",
                    environment: "production",
                    tags: { exceptionType: "TypeError", message: "Cannot read properties of undefined" },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "dist/bundle.js",
                    rawFilePath: "dist/bundle.js",
                    lineNumber: 3620,
                    functionName: "renderApp",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "dist/bundle.js",
                failingLineNumber: 3620,
                containingFunction: "renderApp",
                failingExpression: "user.settings.theme",
                resolutionStatus: "exact_file",
                sourceFileCounterpart: "src/components/App.tsx",
                sourceMapAvailable: true,
                lines: [
                    { lineNumber: 3620, content: "const theme = user.settings.theme;", isFailingLine: true },
                ],
            },
        });

        const sourceAst = analyzeSourceAst(snapshot);
        expect(sourceAst.sourceDistMapping?.isGeneratedOrDist).toBe(true);
        expect(sourceAst.sourceDistMapping?.sourceFileCounterpart).toBe("src/components/App.tsx");
        expect(sourceAst.sourceDistMapping?.sourceMapAvailable).toBe(true);
    });

    // --------------------------------------------------------------------------
    // TEST G: Repository evidence resolves mechanism -> Do not request telemetry
    // --------------------------------------------------------------------------
    it("Test G: Repository evidence resolves mechanism -> Does not request telemetry", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-g-resolved-mechanism",
                title: "TypeError: Cannot read properties of undefined (reading 'id')",
                firstSeen: new Date("2026-09-14T10:00:00Z"),
                lastSeen: new Date("2026-09-14T10:05:00Z"),
                eventCount: 6,
                environment: "production",
                service: "cart-service",
            },
            rawEvidence: [
                {
                    id: "ev-tg",
                    type: "ERROR",
                    title: "TypeError: Cannot read properties of undefined (reading 'id')",
                    timestamp: "2026-09-14T10:00:00Z",
                    service: "cart-service",
                    environment: "production",
                    tags: { exceptionType: "TypeError", message: "Cannot read properties of undefined (reading 'id')" },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/cart.ts",
                    rawFilePath: "src/cart.ts",
                    lineNumber: 10,
                    functionName: "getCartId",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/cart.ts",
                failingLineNumber: 10,
                containingFunction: "getCartId",
                failingExpression: "cart.id",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 9, content: "export function getCartId(cart?: { id: string }) {", isFailingLine: false },
                    { lineNumber: 10, content: "    return cart.id;", isFailingLine: true },
                    { lineNumber: 11, content: "}", isFailingLine: false },
                ],
            },
        });

        const sourceAst = analyzeSourceAst(snapshot);
        const contracts = analyzeContractsAndValueFlow(snapshot, sourceAst);
        const regression = analyzeReleasesAndRegressions(snapshot);
        const causalState = determineCausalEpistemicState(snapshot, sourceAst, contracts, regression);
        const repairLoc = determineRepairLocation(snapshot, causalState, contracts, sourceAst, regression);
        const suff = evaluateEvidenceSufficiency(snapshot, causalState, sourceAst, contracts, regression, repairLoc);

        // Mechanism is confirmed, repair location is confirmed (callee optional param), repair is sufficient!
        expect(causalState.failureMechanism.status).toBe("CONFIRMED");
        expect(repairLoc.ownershipEstablished).toBe(true);
        expect(suff.state).toBe("SUFFICIENT_FOR_REPAIR");
        expect(suff.isAdditionalRuntimeTelemetryNecessary).toBe(false);
    });

    // --------------------------------------------------------------------------
    // TEST H: Repository cannot resolve runtime state -> Targeted runtime evidence
    // --------------------------------------------------------------------------
    it("Test H: Repository cannot resolve runtime state -> Requests targeted runtime evidence with Information Frontier", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "test-h-runtime-frontier",
                title: "RuntimeError: Purchase could not be completed",
                firstSeen: new Date("2026-09-14T08:00:00Z"),
                lastSeen: new Date("2026-09-14T08:30:00Z"),
                eventCount: 42,
                environment: "production",
                service: "checkout-worker",
            },
            rawEvidence: [
                {
                    id: "ev-th",
                    type: "ERROR",
                    title: "RuntimeError: Purchase could not be completed",
                    timestamp: "2026-09-14T08:00:00Z",
                    service: "checkout-worker",
                    environment: "production",
                    tags: { exceptionType: "RuntimeError", message: "Purchase could not be completed" },
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
            source: {
                filePath: "dist/index.js",
                failingLineNumber: 3620,
                containingFunction: "runScenario",
                failingExpression: "await scenario.fn(context)",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 3618, content: "async function runScenario(scenario, context) {", isFailingLine: false },
                    { lineNumber: 3619, content: "    const startedAt = Date.now();", isFailingLine: false },
                    { lineNumber: 3620, content: "    const result = await scenario.fn(context);", isFailingLine: true },
                    { lineNumber: 3621, content: "    return result;", isFailingLine: false },
                    { lineNumber: 3622, content: "}", isFailingLine: false },
                ],
            },
        });

        const result = await generateEngineeringRecommendation({
            snapshot,
            customModel: {
                id: "mock",
                name: "Mock Model",
                generate: async () => ({
                    rawText: JSON.stringify({
                        action: "Capture scenario ID and rejection value",
                        summary: "Runtime evidence required",
                        why: "Dynamic dispatch cannot be resolved statically",
                    }),
                    durationMs: 10,
                }),
            },
        });

        expect(result.recommendation.status).toBe("BLOCKED_BY_MISSING_RUNTIME_EVIDENCE");
        expect(result.recommendation.actionExplanation).toBeDefined();
        expect(result.recommendation.actionExplanation?.whatWeKnow).toContain("Failure surfaced at dist/index.js:3620");
        expect(result.recommendation.actionExplanation?.whatWeDontKnow).toContain("Which concrete implementation was supplied");
        expect(result.recommendation.actionExplanation?.whyThatMatters).toContain("Guessing the callee implementation");
        expect(result.recommendation.actionExplanation?.whatShouldHappenNext).toContain("Capture the resolved callee identifier");
        expect(result.recommendation.informationFrontier).toBeDefined();
        expect(result.recommendation.informationFrontier?.runtimeOnly.length).toBeGreaterThan(0);
    });
});
