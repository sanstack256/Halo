/**
 * Halo Trace — Screenshot Incident Reproduction & Proven Variant Test (Phase 32)
 *
 * Reproduces the exact failure mode from the user screenshot:
 * Dynamic dispatch: `await scenario.fn(context)`
 * Commit: `59e0fcd` deployed 15m before incident
 *
 * Verifies that:
 * 1. The engine refuses to recommend rollback when failure mechanism is UNKNOWN.
 * 2. It requests runtime telemetry for scenario.fn and context.
 * 3. Decomposed confidence reflects failureMechanism = UNKNOWN.
 * 4. When causal proof IS provided, rollback is properly promoted.
 */

import { describe, it, expect } from "vitest";
import { buildInvestigationSnapshot } from "../../investigation-snapshot";
import { generateEngineeringRecommendation } from "../../engine";
import { evaluateCausalRegressionGate } from "../../causal-regression-gate";
import { analyzeReleasesAndRegressions } from "../../regression-analysis";
import { analyzeSourceAst } from "../../source-analysis";
import { determineCausalEpistemicState } from "../../causal-determination";
import { analyzeContractsAndValueFlow } from "../../contract-analysis";

describe("Phase 32: Screenshot Incident Reproduction & Epistemic Gate", () => {
    it("Exact Screenshot Incident -> Blocks rollback, preserves commit as association only, requests runtime telemetry", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "screenshot-incident-exact",
                title: "RuntimeError: Purchase could not be completed",
                errorMessage: "Purchase could not be completed",
                exceptionType: "RuntimeError",
                firstSeen: new Date("2026-09-14T08:00:00Z"),
                lastSeen: new Date("2026-09-14T08:05:00Z"),
                eventCount: 42,
                environment: "production",
                service: "checkout-runner",
            },
            rawEvidence: [
                {
                    id: "ev-screenshot-1",
                    type: "ERROR",
                    title: "RuntimeError: Purchase could not be completed",
                    timestamp: "2026-09-14T08:00:00Z",
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
            release: {
                deployedRelease: "v2.14.0",
                deployedCommitSha: "59e0fcd8213794bfa2837264a938e12398471201",
                candidates: [
                    {
                        commitSha: "59e0fcd8213794bfa2837264a938e12398471201",
                        shortSha: "59e0fcd",
                        message: "Update scenario runner config and dependencies",
                        author: "DeployBot",
                        commitDate: new Date("2026-09-14T07:45:00Z"), // 15m before incident
                        classification: "PATH_ASSOCIATED",
                        changedFiles: ["dist/index.js", "package.json"],
                        modifiesFailingFile: true,
                        modifiesFailingSymbol: false,
                    },
                ],
            },
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
                    { lineNumber: 3621, content: "    return { result, duration: Date.now() - startedAt };", isFailingLine: false },
                    { lineNumber: 3622, content: "}", isFailingLine: false },
                ],
            },
        });

        // 1. Evaluate Causal Regression Gate directly
        const sourceAst = analyzeSourceAst(snapshot);
        const regression = analyzeReleasesAndRegressions(snapshot);
        const contracts = analyzeContractsAndValueFlow(snapshot, sourceAst);
        const causalState = determineCausalEpistemicState(snapshot, sourceAst, contracts, regression);

        const gate = evaluateCausalRegressionGate({
            snapshot,
            regressionContext: regression,
            causalState,
            sourceAst,
        });

        expect(gate.isRollbackEligible).toBe(false);
        expect(gate.blockingReason).toBeDefined();
        expect(gate.dynamicDispatchEvaluation?.isDynamicDispatch).toBe(true);

        // 2. Full Engine Recommendation Generation
        const res = await generateEngineeringRecommendation({ snapshot });

        // Must NOT recommend deployment rollback
        expect(res.repairLocation?.type).not.toBe("DEPLOYMENT");
        expect(res.recommendation.changes).toHaveLength(0);

        // Status must be blocked by missing runtime evidence
        expect(res.recommendation.status).toBe("BLOCKED_BY_MISSING_RUNTIME_EVIDENCE");

        // Action answer must request runtime telemetry
        expect(res.recommendation.actionAnswer?.toLowerCase()).toContain("capture runtime");

        // Decomposed confidence check
        const dc = res.recommendation.decomposedConfidence;
        expect(dc).toBeDefined();
        expect(dc?.failureMechanism).toBe("UNKNOWN");
        expect(dc?.causalCause).toBe("UNKNOWN");
    });

    it("Proven Variant -> Promotes to rollback when causal mechanism connecting commit to scenario is confirmed", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "screenshot-incident-proven",
                title: "RuntimeError: Purchase could not be completed",
                errorMessage: "Purchase could not be completed",
                exceptionType: "RuntimeError",
                firstSeen: new Date("2026-09-14T08:00:00Z"),
                lastSeen: new Date("2026-09-14T08:05:00Z"),
                eventCount: 42,
                environment: "production",
                service: "checkout-runner",
            },
            rawEvidence: [
                {
                    id: "ev-screenshot-proven-1",
                    type: "ERROR",
                    title: "RuntimeError: Purchase could not be completed",
                    timestamp: "2026-09-14T08:00:00Z",
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
                    { lineNumber: 3621, content: "    return { result, duration: Date.now() - startedAt };", isFailingLine: false },
                    { lineNumber: 3622, content: "}", isFailingLine: false },
                ],
            },
            investigation: {
                hypotheses: [
                    {
                        id: "hypo-proven-59e0fcd",
                        title: "Strongly supported regression from release v2.14.0",
                        description: "Commit 59e0fcd modified scenario runner configuration schema, removing required credentials expected by purchase scenario",
                        status: "CONFIRMED",
                        likelihood: "HIGH",
                        confidence: 0.99,
                        supportedEvidence: ["ev-screenshot-proven-1"],
                    },
                ],
                findings: [],
                causalChains: [],
                rootCause: null,
            },
            release: {
                deployedRelease: "v2.14.0",
                stronglySupportedCandidate: {
                    commitSha: "59e0fcd8213794bfa2837264a938e12398471201",
                    shortSha: "59e0fcd",
                    message: "Update scenario runner config and dependencies",
                    author: "DeployBot",
                    commitDate: new Date("2026-09-14T07:45:00Z"),
                    classification: "STRONGLY_SUPPORTED_REGRESSION",
                    changedFiles: ["dist/index.js", "package.json"],
                    modifiesFailingFile: true,
                    modifiesFailingSymbol: true,
                    directlyModifiesFailingLine: true,
                },
                candidates: [],
            },
        });

        const res = await generateEngineeringRecommendation({ snapshot });
        expect(res.success).toBe(true);
        expect(res.repairLocation?.type).toBe("DEPLOYMENT");
        expect(res.recommendation.decomposedConfidence?.causalCause).toBe("PROVEN");
        expect(res.recommendation.actionAnswer?.toLowerCase()).toContain("59e0fcd");
    });
});
