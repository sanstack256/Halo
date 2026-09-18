import { describe, it, expect } from "vitest";
import { evaluateDecisionGaps, buildInformationFrontierAuditRecord } from "../../decision-gap-engine";
import { runEvidenceAcquisitionLifecycle } from "../../active-evidence-acquisition";
import type { CausalHypothesis } from "../../types";

describe("Directives 3, 4, 32 — Decision-Gap & Autonomous Acquisition Lifecycle", () => {
    const mockHypothesis: CausalHypothesis = {
        id: "hypo_pool_exhaustion",
        mechanism: "Connection handle not released in exception block",
        causalEstablishmentTier: "DEFECT_EXISTS",
        conditions: [
            {
                id: "cond_1",
                description: "Connection allocated",
                requiredFact: "Connection allocated via pool",
                attachedEvidenceIds: ["ev_alloc_1"],
                contradictingEvidenceIds: [],
                status: "CONFIRMED",
                evaluationRationale: "Observed in trace",
            },
            {
                id: "cond_2",
                description: "Exception path lacks finally release",
                requiredFact: "Finally block missing release invocation",
                attachedEvidenceIds: [],
                contradictingEvidenceIds: [],
                status: "UNKNOWN",
                evaluationRationale: "Source AST not yet inspected",
            },
        ],
        supportingEvidenceIds: ["ev_alloc_1"],
        contradictingEvidenceIds: [],
        missingEvidenceDescriptions: ["Finally block missing release invocation"],
        causalRelationships: [
            {
                upstreamConditionId: "cond_2",
                downstreamEffect: "Pool capacity reaches 0",
                causalLinkType: "NECESSARY",
            },
        ],
        affectedExecutionPath: ["checkout() -> execute()"],
        repairImplications: "Add finally block to invoke release on connection",
        status: "PLAUSIBLE",
    };

    it("constructs general DecisionGap model for unknown decisive conditions", () => {
        const gaps = evaluateDecisionGaps({
            decision: "Determine whether repair boundary is application finally block or pool config",
            currentConclusion: "Leak suspected, awaiting AST finally inspection",
            hypotheses: [mockHypothesis],
            availableEvidenceIds: ["ev_alloc_1"],
            contractBranchesOnArguments: false,
        });

        expect(gaps.length).toBe(1);
        const gap = gaps[0];
        expect(gap.unknown).toBe("Finally block missing release invocation");
        expect(gap.expectedDecisionImpact).toBe("CRITICAL_PATH");
        // Invariant: does not request runtime telemetry when contract does not branch on arguments
        expect(gap.acquisitionMethods.some((m) => m.mechanismType === "TARGETED_RUNTIME_TELEMETRY")).toBe(false);
        // Includes autonomous static code inspection
        expect(gap.acquisitionMethods.some((m) => m.mechanismType === "STATIC_CODE_INSPECTION")).toBe(true);
    });

    it("executes the complete autonomous evidence acquisition lifecycle cleanly", () => {
        const gaps = evaluateDecisionGaps({
            decision: "Verify finally block",
            currentConclusion: "Awaiting inspection",
            hypotheses: [mockHypothesis],
            availableEvidenceIds: ["ev_alloc_1"],
        });

        const gap = gaps[0];
        const result = runEvidenceAcquisitionLifecycle({
            gap,
            affectedHypothesis: mockHypothesis,
            existingEvidencePool: [
                {
                    evidenceId: "ev_alloc_1",
                    sourceType: "RUNTIME_TRACE",
                    claimedFact: "Connection allocated via pool",
                    confidence: "OBSERVED",
                },
            ],
            executeAutonomousInspection: (spec) => ({
                success: true,
                capturedFact: "Finally block missing release invocation",
                evidenceId: "ev_inspected_finally",
                logs: "AST confirmed absence of finally block in checkout()",
            }),
        });

        expect(result.requiresDeveloperIntervention).toBe(false);
        expect(result.record.capabilityStatus).toBe("AUTONOMOUSLY_CAPABLE");
        expect(result.record.temporaryInstrumentationCleanupVerified).toBe(true);
        expect(result.record.graphUpdateCompleted).toBe(true);
        expect(result.updatedEvidencePool.some((e) => e.evidenceId === "ev_inspected_finally")).toBe(true);
        // Hypothesis is updated with new confirmed condition
        expect(result.updatedHypothesis.conditions.find((c) => c.id === "cond_2")?.status).toBe("CONFIRMED");
    });

    it("Directive 32: produces machine-readable InformationFrontierAuditRecord before reaching frontier", () => {
        const audit = buildInformationFrontierAuditRecord({
            decisionsEvaluated: ["Repair boundary location"],
            hypothesesEvaluated: ["Connection leak in handler", "Pool configuration error"],
            repositoryAreasSearched: ["src/repositories/"],
            sourceAreasSearched: ["src/repositories/order.ts"],
            testsInspected: ["tests/order.test.ts"],
            configurationInspected: ["config/database.json"],
            deploymentEvidenceInspected: ["v2.4.1 deployment manifest"],
            reproductionAttempted: true,
            runtimeEvidenceInspected: ["spans 1-100"],
            acquisitionMethodsAttempted: ["STATIC_CODE_INSPECTION", "LOCAL_REPRODUCTION"],
            remainingUnknown: "Internal database engine lock queue state",
            whyUnknownChangesRepairDecision: "Determines whether deadlock occurred inside engine vs application leak",
            whyHaloCannotResolve: "Database engine internals require external database superuser access unavailable to Halo",
        });

        expect(audit.decisionsEvaluated.length).toBeGreaterThan(0);
        expect(audit.remainingUnknown).toBe("Internal database engine lock queue state");
        expect(audit.whyUnknownChangesRepairDecision).toContain("deadlock");
        expect(audit.whyHaloCannotResolve).toContain("superuser");
    });
});
