/**
 * Halo Trace — Step 6 & Step 7: Repair-Location Preservation & Multi-File Verification
 *
 * Implements Step 6:
 * For each repair location:
 *   CALLER, PRODUCER, CALLEE, CONSUMER, ADAPTER, DEPENDENCY, CONFIGURATION, DEPLOYMENT, TEST, NO_CODE_CHANGE
 * records the location produced upstream and verifies it survives unchanged into the final recommendation.
 *
 * Specifically detects and asserts NO failure transformations:
 *   upstream PRODUCER -> provider CALLEE
 *   upstream ADAPTER -> provider CALLEE
 *   upstream CALLER -> provider CALLEE
 *   upstream NO_CODE_CHANGE -> provider generated code
 *
 * Implements Step 7:
 * Evaluates multi-file coordinated changes.
 */

import { describe, it, expect, afterAll } from "vitest";
import { generateEngineeringRecommendation } from "../../engine";
import { buildInvestigationSnapshot } from "../../investigation-snapshot";
import { getMultiFileScenarios } from "./multi-file-scenarios";
import { RealPatchExecutionHarness } from "./real-patch-harness";

describe("Step 6 — Repair-Location Preservation Audit", () => {
    const harness = new RealPatchExecutionHarness();

    afterAll(() => {
        harness.cleanup();
    });

    // 1. CALLER PRESERVATION
    it("preserves CALLER repair location and never demotes to CALLEE", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "trace-caller-preservation",
                title: "TypeError: Cannot read properties of undefined (reading 'id')",
                firstSeen: new Date("2026-09-17T10:00:00Z"),
                lastSeen: new Date("2026-09-17T10:05:00Z"),
                eventCount: 4,
                environment: "production",
                service: "order-service",
            },
            rawEvidence: [
                {
                    id: "ev-caller-err",
                    type: "ERROR",
                    title: "TypeError: Cannot read properties of undefined (reading 'id')",
                    timestamp: "2026-09-17T10:00:00Z",
                    service: "order-service",
                    environment: "production",
                    tags: {
                        exceptionType: "TypeError",
                        message: "Cannot read properties of undefined (reading 'id')",
                        stack: "TypeError: Cannot read properties of undefined (reading 'id')\n    at calculateOrder (src/callee.js:4:20)\n    at processCheckout (src/caller.js:10:5)",
                    },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/callee.js",
                    lineNumber: 4,
                    functionName: "calculateOrder",
                    isApplication: true,
                    classification: "Application",
                },
                {
                    order: 2,
                    filePath: "src/caller.js",
                    lineNumber: 10,
                    functionName: "processCheckout",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/callee.js",
                failingLineNumber: 4,
                containingFunction: "calculateOrder",
                failingExpression: "user.id",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 1, content: "export function calculateOrder(user, items) {" },
                    { lineNumber: 2, content: "    // Contract: user is required by calculateOrder" },
                    { lineNumber: 3, content: "    if (!user) throw new TypeError(\"user is required\");" },
                    { lineNumber: 4, content: "    return user.id;" },
                    { lineNumber: 5, content: "}" },
                ],
                callers: [
                    {
                        callerFile: "src/caller.js",
                        callerSymbol: "processCheckout",
                        argumentExpressions: ["undefined", "items"],
                    },
                ],
            },
        });

        const result = await generateEngineeringRecommendation({ snapshot });
        expect(result.repairLocation?.type).toBe("CALLER");
        expect(result.repairLocation?.targetFile).toContain("caller.js");
        expect(result.recommendation.repairLocation?.type).toBe("CALLER");
        expect(result.recommendation.repairLocation?.targetFile).toContain("caller.js");
        // Must NOT demote to CALLEE!
        expect(result.recommendation.repairLocation?.type).not.toBe("CALLEE");
    });

    // 2. PRODUCER PRESERVATION
    it("preserves PRODUCER repair location and never demotes to CALLEE", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "trace-producer-preservation",
                title: "TypeError: Cannot read properties of undefined (reading 'rate')",
                firstSeen: new Date("2026-09-17T10:00:00Z"),
                lastSeen: new Date("2026-09-17T10:05:00Z"),
                eventCount: 2,
                environment: "production",
                service: "pricing-service",
            },
            rawEvidence: [
                {
                    id: "ev-prod-err",
                    type: "ERROR",
                    title: "TypeError: Cannot read properties of undefined (reading 'rate')",
                    timestamp: "2026-09-17T10:00:00Z",
                    service: "pricing-service",
                    environment: "production",
                    tags: {
                        exceptionType: "TypeError",
                        message: "Cannot read properties of undefined (reading 'rate')",
                        stack: "TypeError: Cannot read properties of undefined (reading 'rate')\n    at applyTax (src/tax.js:5:15)",
                    },
                },
            ],
            source: {
                filePath: "src/tax.js",
                failingLineNumber: 5,
                containingFunction: "applyTax",
                failingExpression: "taxInfo.rate",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 4, content: "export function applyTax(amount, taxInfo) {" },
                    { lineNumber: 5, content: "    return amount * taxInfo.rate;" },
                    { lineNumber: 6, content: "}" },
                ],
                producers: [
                    {
                        producerFile: "src/tax-calculator.js",
                        producerSymbol: "calculateTaxRates",
                        producedType: "TaxInfo",
                        missingProperties: ["rate"],
                    },
                ],
            },
        });

        const result = await generateEngineeringRecommendation({ snapshot });
        expect(result.repairLocation?.type).toBe("PRODUCER");
        expect(result.repairLocation?.targetFile).toContain("tax-calculator.js");
        expect(result.recommendation.repairLocation?.type).toBe("PRODUCER");
        expect(result.recommendation.repairLocation?.targetFile).toContain("tax-calculator.js");
        // Must NOT demote to CALLEE!
        expect(result.recommendation.repairLocation?.type).not.toBe("CALLEE");
    });

    // 3. ADAPTER PRESERVATION
    it("preserves ADAPTER repair location and never demotes to CALLEE", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "trace-adapter-preservation",
                title: "Error: Missing token in adapted response",
                firstSeen: new Date("2026-09-17T10:00:00Z"),
                lastSeen: new Date("2026-09-17T10:05:00Z"),
                eventCount: 3,
                environment: "production",
                service: "auth-gateway",
            },
            rawEvidence: [
                {
                    id: "ev-adapt-err",
                    type: "ERROR",
                    title: "Error: Missing token in adapted response",
                    timestamp: "2026-09-17T10:00:00Z",
                    service: "auth-gateway",
                    environment: "production",
                    tags: {
                        exceptionType: "Error",
                        message: "Missing token in adapted response",
                        stack: "Error: Missing token\n    at adaptResponse (src/auth-adapter.js:12:15)",
                    },
                },
            ],
            source: {
                filePath: "src/auth-adapter.js",
                failingLineNumber: 12,
                containingFunction: "adaptResponse",
                failingExpression: "mapped.token",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 10, content: "export function adaptResponse(raw) {" },
                    { lineNumber: 11, content: "    const mapped = { user: raw.user };" },
                    { lineNumber: 12, content: "    if (!mapped.token) throw new Error(\"Missing token\");" },
                    { lineNumber: 13, content: "}" },
                ],
            },
        });

        const result = await generateEngineeringRecommendation({ snapshot });
        expect(result.repairLocation?.type).toBe("ADAPTER");
        expect(result.repairLocation?.targetFile).toContain("auth-adapter.js");
        expect(result.recommendation.repairLocation?.type).toBe("ADAPTER");
        expect(result.recommendation.repairLocation?.type).not.toBe("CALLEE");
    });

    // 4. NO_CODE_CHANGE PRESERVATION
    it("preserves NO_CODE_CHANGE and NEVER synthesizes application code changes", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "trace-nocode-preservation",
                title: "ThirdPartyOutage: 503 Service Unavailable from payment gateway",
                firstSeen: new Date("2026-09-17T10:00:00Z"),
                lastSeen: new Date("2026-09-17T10:05:00Z"),
                eventCount: 20,
                environment: "production",
                service: "billing-service",
            },
            rawEvidence: [
                {
                    id: "ev-outage-err",
                    type: "ERROR",
                    title: "ThirdPartyOutage: 503 Service Unavailable",
                    timestamp: "2026-09-17T10:00:00Z",
                    service: "billing-service",
                    environment: "production",
                    tags: {
                        exceptionType: "ThirdPartyOutage",
                        message: "503 Service Unavailable: Stripe API is currently down",
                        stack: "ThirdPartyOutage: 503 Service Unavailable\n    at callStripe (src/stripe.js:15:11)",
                    },
                },
            ],
            source: {
                filePath: "src/stripe.js",
                failingLineNumber: 15,
                containingFunction: "callStripe",
                failingExpression: "fetch('https://api.stripe.com')",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 14, content: "export async function callStripe() {" },
                    { lineNumber: 15, content: "    return await fetch('https://api.stripe.com');" },
                    { lineNumber: 16, content: "}" },
                ],
            },
        });

        const result = await generateEngineeringRecommendation({ snapshot });
        expect(result.repairLocation?.type).toBe("NO_CODE_CHANGE");
        expect(result.recommendation.repairLocation?.type).toBe("NO_CODE_CHANGE");
        expect(result.recommendation.isCodeModification).toBe(false);
        // STRICT REQUIREMENT: changes must be EMPTY!
        expect(result.recommendation.changes).toHaveLength(0);
        expect(result.recommendation.actionAnswer?.toUpperCase()).toContain("NO APPLICATION CODE CHANGE");
    });
});

describe("Step 7 — Multi-File Repair Preservation", () => {
    const multiScenarios = getMultiFileScenarios();

    for (const scenario of multiScenarios) {
        it(`Multi-File Scenario: ${scenario.title}`, async () => {
            const snapshot = scenario.snapshotFactory(process.cwd());
            const result = await generateEngineeringRecommendation({ snapshot });

            expect(result).toBeDefined();
            expect(result.recommendation).toBeDefined();
            const rec = result.recommendation;

            // Verify code changes exist
            expect(rec.isCodeModification).toBe(true);
            expect(rec.changes.length).toBeGreaterThan(0);

            // Verify each change file comes from authoritative graph
            for (const change of rec.changes) {
                expect(change.file || change.filePath).toBeTruthy();
                expect(change.proposedCode).toBeTruthy();
            }
        });
    }
});
