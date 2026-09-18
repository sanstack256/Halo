/**
 * Halo Trace — Same Symptom Different Repair Test Suite (Phase 33)
 *
 * Verifies that the exact same symptom (TypeError: Cannot read properties of undefined (reading 'x'))
 * maps to the correct repair location across 5 distinct causal origins:
 *
 * Cause 1: Caller violated preconditions -> CALLER
 * Cause 2: Callee internal invariant broken -> CALLEE
 * Cause 3: Missing environment variable / config -> CONFIGURATION
 * Cause 4: Confirmed release regression commit -> DEPLOYMENT
 * Cause 5: External upstream provider timeout / error -> EXTERNAL_INTEGRATION
 */

import { describe, it, expect } from "vitest";
import { buildInvestigationSnapshot } from "../../investigation-snapshot";
import { generateEngineeringRecommendation } from "../../engine";

describe("Phase 33: Same Symptom Different Repair Evaluation Suite", () => {
    const commonSymptom = "TypeError: Cannot read properties of undefined (reading 'x')";

    // -------------------------------------------------------------------------
    // Cause 1: Caller Violated Preconditions -> CALLER
    // -------------------------------------------------------------------------
    it("Cause 1: Caller passes undefined to non-nullable callee -> Recommends CALLER fix", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "same-symptom-cause-1",
                title: commonSymptom,
                firstSeen: new Date("2026-09-18T10:00:00Z"),
                lastSeen: new Date("2026-09-18T10:05:00Z"),
                eventCount: 10,
                environment: "production",
                service: "user-service",
            },
            rawEvidence: [
                {
                    id: "ev-c1",
                    type: "ERROR",
                    title: commonSymptom,
                    timestamp: "2026-09-18T10:00:00Z",
                    service: "user-service",
                    environment: "production",
                    tags: { message: "Cannot read properties of undefined (reading 'x')" },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/math.ts",
                    lineNumber: 10,
                    functionName: "extractX",
                    isApplication: true,
                    classification: "Application",
                },
                {
                    order: 2,
                    filePath: "src/controller.ts",
                    lineNumber: 45,
                    functionName: "handleRequest",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/math.ts",
                failingLineNumber: 10,
                containingFunction: "extractX",
                failingExpression: "point.x",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 9, content: "export function extractX(point: Point) {", isFailingLine: false },
                    { lineNumber: 10, content: "    return point.x;", isFailingLine: true },
                    { lineNumber: 11, content: "}", isFailingLine: false },
                ],
                callers: [
                    {
                        callerFilePath: "src/controller.ts",
                        callerFunction: "handleRequest",
                        callerLineNumber: 45,
                        argumentExpressions: ["undefined"],
                        callStatement: "extractX(undefined)",
                        hasNullCheckBefore: false,
                        isContractViolated: true,
                    },
                ],
            },
            investigation: {
                hypotheses: [
                    {
                        id: "hypo-caller",
                        title: "Caller contract violation in handleRequest",
                        description: "handleRequest invokes extractX without verifying that point object is defined",
                        status: "CONFIRMED",
                        likelihood: "HIGH",
                        confidence: 0.98,
                        supportedEvidence: ["ev-c1"],
                    },
                ],
                findings: [], causalChains: [], rootCause: null,
            },
        });

        const res = await generateEngineeringRecommendation({ snapshot });
        expect(res.repairLocation?.type).toBe("CALLER");
        expect(res.repairLocation?.targetFile).toBe("src/controller.ts");
    });

    // -------------------------------------------------------------------------
    // Cause 2: Callee Internal Invariant Broken -> CALLEE
    // -------------------------------------------------------------------------
    it("Cause 2: Callee internally produced undefined and dereferenced it -> Recommends CALLEE fix", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "same-symptom-cause-2",
                title: commonSymptom,
                firstSeen: new Date("2026-09-18T10:00:00Z"),
                lastSeen: new Date("2026-09-18T10:05:00Z"),
                eventCount: 5,
                environment: "production",
                service: "data-service",
            },
            rawEvidence: [
                {
                    id: "ev-c2",
                    type: "ERROR",
                    title: commonSymptom,
                    timestamp: "2026-09-18T10:00:00Z",
                    service: "data-service",
                    environment: "production",
                    tags: { message: "Cannot read properties of undefined (reading 'x')" },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/transformer.ts",
                    lineNumber: 22,
                    functionName: "transformData",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/transformer.ts",
                failingLineNumber: 22,
                containingFunction: "transformData",
                failingExpression: "item.x",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 20, content: "export function transformData(list: any[]) {", isFailingLine: false },
                    { lineNumber: 21, content: "    const item = list.find(i => i.id === 99);", isFailingLine: false },
                    { lineNumber: 22, content: "    return item.x * 2;", isFailingLine: true },
                    { lineNumber: 23, content: "}", isFailingLine: false },
                ],
            },
            investigation: {
                hypotheses: [
                    {
                        id: "hypo-callee",
                        title: "Callee defect in transformData",
                        description: "transformData assumed list.find always returns an element without verifying id match",
                        status: "CONFIRMED",
                        likelihood: "HIGH",
                        confidence: 0.95,
                        supportedEvidence: ["ev-c2"],
                    },
                ],
                findings: [], causalChains: [], rootCause: null,
            },
        });

        const res = await generateEngineeringRecommendation({ snapshot });
        expect(res.repairLocation?.type).toBe("CALLEE");
        expect(res.repairLocation?.targetFile).toBe("src/transformer.ts");
    });

    // -------------------------------------------------------------------------
    // Cause 3: Missing Config -> CONFIGURATION
    // -------------------------------------------------------------------------
    it("Cause 3: Missing Environment Variable -> Recommends CONFIGURATION repair", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "same-symptom-cause-3",
                title: "ConfigurationError: Required environment variable CONFIG_PAYLOAD is not set",
                firstSeen: new Date("2026-09-18T10:00:00Z"),
                lastSeen: new Date("2026-09-18T10:05:00Z"),
                eventCount: 3,
                environment: "production",
                service: "config-service",
            },
            rawEvidence: [
                {
                    id: "ev-c3",
                    type: "ERROR",
                    title: "ConfigurationError: Required environment variable CONFIG_PAYLOAD is not set",
                    timestamp: "2026-09-18T10:00:00Z",
                    service: "config-service",
                    environment: "production",
                    tags: { message: "Required environment variable CONFIG_PAYLOAD is not set" },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/config.ts",
                    lineNumber: 12,
                    functionName: "loadConfig",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/config.ts",
                failingLineNumber: 12,
                containingFunction: "loadConfig",
                failingExpression: "process.env.CONFIG_PAYLOAD",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 11, content: "export function loadConfig() {", isFailingLine: false },
                    { lineNumber: 12, content: "    if (!process.env.CONFIG_PAYLOAD) throw new Error('missing environment variable CONFIG_PAYLOAD');", isFailingLine: true },
                    { lineNumber: 13, content: "}", isFailingLine: false },
                ],
            },
            investigation: {
                hypotheses: [
                    {
                        id: "hypo-cfg",
                        title: "Deployment environment configuration defect",
                        description: "Application code is correct; CONFIG_PAYLOAD omitted from deployment manifest",
                        status: "CONFIRMED",
                        likelihood: "HIGH",
                        confidence: 0.99,
                        supportedEvidence: ["ev-c3"],
                    },
                ],
                findings: [], causalChains: [], rootCause: null,
            },
        });

        const res = await generateEngineeringRecommendation({ snapshot });
        expect(res.repairLocation?.type).toBe("CONFIGURATION");
    });

    // -------------------------------------------------------------------------
    // Cause 4: Confirmed Release Regression Commit -> DEPLOYMENT
    // -------------------------------------------------------------------------
    it("Cause 4: True Regression Commit -> Recommends DEPLOYMENT rollback", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "same-symptom-cause-4",
                title: commonSymptom,
                firstSeen: new Date("2026-09-18T10:00:00Z"),
                lastSeen: new Date("2026-09-18T10:05:00Z"),
                eventCount: 30,
                environment: "production",
                service: "order-service",
            },
            rawEvidence: [
                {
                    id: "ev-c4",
                    type: "ERROR",
                    title: commonSymptom,
                    timestamp: "2026-09-18T10:00:00Z",
                    service: "order-service",
                    environment: "production",
                    tags: { message: "Cannot read properties of undefined (reading 'x')" },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/order.ts",
                    lineNumber: 18,
                    functionName: "getCoordinates",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/order.ts",
                failingLineNumber: 18,
                containingFunction: "getCoordinates",
                failingExpression: "coord.x",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 17, content: "export function getCoordinates(coord: any) {", isFailingLine: false },
                    { lineNumber: 18, content: "    return coord.x;", isFailingLine: true },
                    { lineNumber: 19, content: "}", isFailingLine: false },
                ],
            },
            release: {
                deployedRelease: "v2.0.4",
                candidates: [
                    {
                        commitSha: "998877665544",
                        shortSha: "9988776",
                        message: "Refactor coordinate extraction in getCoordinates",
                        author: "Alice",
                        commitDate: new Date("2026-09-18T09:50:00Z"),
                        classification: "STRONGLY_SUPPORTED_REGRESSION",
                        changedFiles: ["src/order.ts"],
                        modifiesFailingFile: true,
                        modifiesFailingSymbol: true,
                        directlyModifiesFailingLine: true,
                    },
                ],
            },
        });

        const res = await generateEngineeringRecommendation({ snapshot });
        expect(res.repairLocation?.type).toBe("DEPLOYMENT");
        expect(res.repairLocation?.targetFile).toBe("src/order.ts");
    });

    // -------------------------------------------------------------------------
    // Cause 5: External Upstream Timeout -> EXTERNAL_INTEGRATION
    // -------------------------------------------------------------------------
    it("Cause 5: External Network / Service Outage -> Recommends EXTERNAL_INTEGRATION resilience", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "same-symptom-cause-5",
                title: "FetchError: 504 Gateway Timeout while fetching upstream",
                firstSeen: new Date("2026-09-18T10:00:00Z"),
                lastSeen: new Date("2026-09-18T10:05:00Z"),
                eventCount: 50,
                environment: "production",
                service: "payment-service",
            },
            rawEvidence: [
                {
                    id: "ev-c5",
                    type: "ERROR",
                    title: "FetchError: 504 Gateway Timeout",
                    timestamp: "2026-09-18T10:00:00Z",
                    service: "payment-service",
                    environment: "production",
                    tags: { message: "504 Gateway Timeout from payment gateway" },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/client/paymentClient.ts",
                    lineNumber: 35,
                    functionName: "chargeCard",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/client/paymentClient.ts",
                failingLineNumber: 35,
                containingFunction: "chargeCard",
                failingExpression: "await fetch(url)",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 34, content: "export async function chargeCard(url: string) {", isFailingLine: false },
                    { lineNumber: 35, content: "    const res = await fetch(url);", isFailingLine: true },
                    { lineNumber: 36, content: "    return res.json();", isFailingLine: false },
                    { lineNumber: 37, content: "}", isFailingLine: false },
                ],
            },
        });

        const res = await generateEngineeringRecommendation({ snapshot });
        expect(res.repairLocation?.type).toBe("EXTERNAL_INTEGRATION");
        expect(res.recommendation.isCodeModification).toBe(true);
        expect(res.recommendation.nonCodeRemediationDetails?.type).toBe("APPLICATION_RESILIENCE");
    });
});
