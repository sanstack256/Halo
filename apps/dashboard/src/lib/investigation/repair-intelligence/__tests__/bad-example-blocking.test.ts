/**
 * Section 74 Mandatory Test: Current Bad Example Blocking
 *
 * Specifically verifies that the false-confidence example:
 *   Purchase could not be completed
 *   acme-checkout
 *   index.js:3620
 *   runScenario
 *   await scenario.fn(...)
 *
 * DOES NOT automatically output:
 *   "Add guard check or optional chaining"
 *
 * Unless telemetry establishes that scenario.fn was indeed undefined at runtime.
 * With runtime value NOT_CAPTURED, the system MUST mark REPAIR_UNDERDETERMINED
 * and withhold automated code patches.
 */

import { describe, it, expect } from "vitest";
import type { Evidence, Investigation } from "@halo/investigation-engine";
import { buildCanonicalEvidenceSnapshot } from "../../evidence-snapshot";
import { buildRepairCase } from "../repair-case-builder";
import { evaluateRepairEligibility } from "../repair-eligibility";
import { buildFailureModel } from "../failure-model";
import { analyzeProtections } from "../protection-analyzer";
import { generateEvidenceBoundRecommendation } from "../../recommendation-engine/engine";

function makeMockEvidence(overrides: Partial<Evidence> = {}): Evidence {
    return {
        id: "err-bad-example",
        type: "ERROR",
        timestamp: new Date("2026-09-08T10:00:00Z"),
        source: "backend",
        service: "acme-checkout",
        title: "TypeError: Cannot read properties of undefined (reading 'call')",
        description: "Purchase could not be completed in runScenario",
        severity: "critical",
        confidence: 0.95,
        fingerprint: "fp-scenario-fn",
        payload: {
            stack: "TypeError: Cannot read properties of undefined (reading 'call')\n    at runScenario (index.js:3620:15)",
        },
        metadata: { class: "TypeError" },
        ...overrides,
    };
}

function makeMockInvestigation(evidence: Evidence[]): Investigation {
    return {
        status: "ANALYSIS_COMPLETE",
        evidence,
        graph: { nodes: [], edges: [] },
        timeline: { events: [] },
        changes: [],
        findings: [
            {
                id: "finding-scenario",
                type: "ANOMALY",
                causalRole: "MECHANISM",
                title: "Execution terminated at await scenario.fn(...)",
                description: "Terminal expression in runScenario",
                strength: 0.9,
                evidenceIds: [evidence[0]!.id],
                reasons: [],
            },
        ],
        hypotheses: [
            {
                id: "hypo-runtime-err",
                title: "Purchase could not be completed",
                description: "Failure at runScenario during await scenario.fn(...)",
                status: "VALIDATED",
                score: { positive: 4.0, negative: 0, unknown: 0.2 },
                confidence: 90,
                supportingReasons: [],
                contradictingReasons: [],
                missingReasons: [],
                findingIds: ["finding-scenario"],
                evidenceIds: [evidence[0]!.id],
                alternativeIds: [],
                causalChainId: "chain-scenario",
            },
        ],
        causalChains: [],
        impact: { affectedServices: ["acme-checkout"], blastRadius: "MEDIUM" } as any,
        recommendations: [],
        report: {
            summary: "Purchase could not be completed",
            rootCause: null,
            alternatives: [],
            uncertainties: [],
            nextSteps: [],
        },
        nextInvestigation: null,
    };
}

describe("Section 74: Blocking Current False-Confidence Bad Example", () => {
    const badExampleSourceLines = [
        { lineNumber: 3617, content: "async function runScenario(scenario) {", isFailingLine: false },
        { lineNumber: 3618, content: "    if (!scenario) {", isFailingLine: false },
        { lineNumber: 3619, content: "        return;", isFailingLine: false },
        { lineNumber: 3620, content: "    await scenario.fn(context);", isFailingLine: true },
        { lineNumber: 3621, content: "    return { success: true };", isFailingLine: false },
        { lineNumber: 3622, content: "}", isFailingLine: false },
    ];

    it("evaluates runtimeValueStatus as NOT_CAPTURED when telemetry did not record dynamic variable value", () => {
        const anchor = makeMockEvidence();
        const snapshot = buildCanonicalEvidenceSnapshot({
            tenant: { projectId: "proj-acme" },
            scope: { anchorEventId: anchor.id, service: "acme-checkout" },
            rawEvidence: [anchor],
            investigation: makeMockInvestigation([anchor]),
            runtime: {
                anchorError: anchor,
                callChain: [
                    {
                        order: 1,
                        functionName: "runScenario",
                        filePath: "index.js",
                        lineNumber: 3620,
                        isFailingSite: true,
                    },
                ],
                failingExpression: "await scenario.fn(context)",
                containingFunction: "runScenario",
            },
            source: {
                filePath: "index.js",
                failingLineNumber: 3620,
                startLineNumber: 3617,
                lines: badExampleSourceLines,
                resolutionStatus: "exact_file",
            },
        });

        const failureModel = buildFailureModel(snapshot);
        expect(failureModel.runtimeValueStatus).toBe("NOT_CAPTURED");
        expect(failureModel.runtimeValue).toBeUndefined();

        // Must have an explicit UNKNOWN fact documenting this gap
        const unknownFact = failureModel.unknowns.find(u => u.id === "fact-unknown-runtime-value");
        expect(unknownFact).toBeDefined();
        expect(unknownFact?.claim).toContain("NOT captured");
        expect(unknownFact?.whyUnknownMatters).toContain("does not establish whether");
    });


    it("correctly identifies existing guard on 'scenario' as PROTECTION_PRESENT_BUT_INSUFFICIENT for 'scenario.fn'", () => {
        const protections = analyzeProtections({
            source: {
                filePath: "index.js",
                failingLineNumber: 3620,
                startLineNumber: 3617,
                lines: badExampleSourceLines,
                resolutionStatus: "exact_file",
            },
            failingExpression: "await scenario.fn(context)",
            failingLineNumber: 3620,
            containingFunction: "runScenario",
        });

        expect(protections.status).toBe("PROTECTION_PRESENT_BUT_INSUFFICIENT");
        expect(protections.guards.length).toBeGreaterThan(0);
        expect(protections.guards[0]?.protectsSymbol).toBe("scenario");
        expect(protections.guards[0]?.protectsTargetExpression).toBe(false);
        expect(protections.summary).toContain("protects 'scenario', but does NOT protect 'await scenario.fn(context)'");
    });

    it("deterministically classifies repair eligibility as REPAIR_UNDERDETERMINED rather than REPAIR_READY", () => {
        const anchor = makeMockEvidence();
        const snapshot = buildCanonicalEvidenceSnapshot({
            tenant: { projectId: "proj-acme" },
            scope: { anchorEventId: anchor.id, service: "acme-checkout" },
            rawEvidence: [anchor],
            investigation: makeMockInvestigation([anchor]),
            runtime: {
                anchorError: anchor,
                callChain: [
                    {
                        order: 1,
                        functionName: "runScenario",
                        filePath: "index.js",
                        lineNumber: 3620,
                        isFailingSite: true,
                    },
                ],
                failingExpression: "await scenario.fn(context)",
                containingFunction: "runScenario",
            },
            source: {
                filePath: "index.js",
                failingLineNumber: 3620,
                startLineNumber: 3617,
                lines: badExampleSourceLines,
                resolutionStatus: "exact_file",
            },
        });

        const failureModel = buildFailureModel(snapshot);
        const protectionAnalysis = analyzeProtections({
            source: snapshot.source,
            failingExpression: failureModel.failingExpression,
            failingLineNumber: failureModel.failingLineNumber,
            containingFunction: failureModel.containingFunction,
        });

        const eligibility = evaluateRepairEligibility({
            snapshot,
            failureModel,
            protectionAnalysis,
        });

        // SPEC REQUIREMENT: Must be REPAIR_UNDERDETERMINED!
        expect(eligibility.state).toBe("REPAIR_UNDERDETERMINED");
        expect(eligibility.reason).toContain("cannot prove whether 'await scenario.fn(context)' evaluated to undefined or if the invoked function threw");
        expect(eligibility.prerequisitesMet.singleDecisiveRepair).toBe(false);
    });

    it("builds a RepairCase that refuses to declare a single decisive option when underdetermined", () => {
        const anchor = makeMockEvidence();
        const snapshot = buildCanonicalEvidenceSnapshot({
            tenant: { projectId: "proj-acme" },
            scope: { anchorEventId: anchor.id, service: "acme-checkout" },
            rawEvidence: [anchor],
            investigation: makeMockInvestigation([anchor]),
            runtime: {
                anchorError: anchor,
                callChain: [
                    {
                        order: 1,
                        functionName: "runScenario",
                        filePath: "index.js",
                        lineNumber: 3620,
                        isFailingSite: true,
                    },
                ],
                failingExpression: "await scenario.fn(context)",
                containingFunction: "runScenario",
            },
            source: {
                filePath: "index.js",
                failingLineNumber: 3620,
                startLineNumber: 3617,
                lines: badExampleSourceLines,
                resolutionStatus: "exact_file",
            },
        });

        const repairCase = buildRepairCase({ snapshot });

        // State is UNDERDETERMINED
        expect(repairCase.repairEligibility.state).toBe("REPAIR_UNDERDETERMINED");

        // Section 49: No option selected because intended behavior is not established
        expect(repairCase.selectedOptionId).toBeUndefined();

        // Multiple options presented with honest tradeoffs
        expect(repairCase.repairOptions.length).toBeGreaterThanOrEqual(2);

        // Evidence needed to unlock is surfaced
        expect(repairCase.evidenceGaps.evidenceNeededToUnlock.length).toBeGreaterThan(0);
        expect(repairCase.evidenceGaps.evidenceNeededToUnlock[0]).toContain("Capture runtime evaluation of 'await scenario.fn(context)'");
    });

    it("withholds proposed code patch when run through recommendation engine for this scenario", async () => {
        const anchor = makeMockEvidence();
        const snapshot = buildCanonicalEvidenceSnapshot({
            tenant: { projectId: "proj-acme" },
            scope: { anchorEventId: anchor.id, service: "acme-checkout" },
            rawEvidence: [anchor],
            investigation: makeMockInvestigation([anchor]),
            runtime: {
                anchorError: anchor,
                callChain: [
                    {
                        order: 1,
                        functionName: "runScenario",
                        filePath: "index.js",
                        lineNumber: 3620,
                        isFailingSite: true,
                    },
                ],
                failingExpression: "await scenario.fn(context)",
                containingFunction: "runScenario",
            },
            source: {
                filePath: "index.js",
                failingLineNumber: 3620,
                startLineNumber: 3617,
                lines: badExampleSourceLines,
                resolutionStatus: "exact_file",
            },
        });

        const result = await generateEvidenceBoundRecommendation({ snapshot });

        // Must NOT propose an automatic patch as AVAILABLE
        expect(result.patch?.status).toBe("NOT_SAFE_TO_GENERATE");
        expect(result.patch?.files).toHaveLength(0);
        expect(result.patch?.refusalReason).toContain("cannot prove whether 'await scenario.fn(context)' evaluated to undefined");

        // Must NOT instruct developer "Add guard check or optional chaining"
        expect(result.action?.instruction).not.toBe("Add guard check or optional chaining for 'await scenario.fn(context)' before property access in runScenario.");
        expect(result.action?.instruction).toContain("Capture runtime telemetry");

        // Repair case attached and inspectable
        expect(result.repairCase).toBeDefined();
        expect(result.repairCase?.repairEligibility.state).toBe("REPAIR_UNDERDETERMINED");
    });
});
