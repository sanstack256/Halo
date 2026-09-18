import { describe, it, expect } from "vitest";
import { reconcileEvidenceForDecision, type EvidenceItemForDecision } from "../../evidence-reconciliation";

describe("Directives 1, 21, 22 — Decision-Specific Contradiction Resolution & Perturbation", () => {
    it("Directive 1 & 22: resolves execution conflict in favor of runtime trace for WHAT_ACTUALLY_EXECUTED", () => {
        const evidencePool: EvidenceItemForDecision[] = [
            {
                evidenceId: "ev_runtime_span",
                sourceType: "RUNTIME_TRACE",
                claimedFact: "Branch B was executed during incident",
                confidence: "OBSERVED",
            },
            {
                evidenceId: "ev_static_ast",
                sourceType: "STATIC_AST",
                claimedFact: "Branch A is the default in AST",
                confidence: "STATICALLY_VERIFIED",
            },
        ];

        const result = reconcileEvidenceForDecision(
            "WHAT_ACTUALLY_EXECUTED",
            "Which branch executed",
            evidencePool
        );

        expect(result.isDefinitivelyResolved).toBe(true);
        expect(result.establishedFact).toBe("Branch B was executed during incident");
        expect(result.dominatingEvidenceId).toBe("ev_runtime_span");
        expect(result.detectedContradictions.length).toBe(1);
        expect(result.detectedContradictions[0].isResolved).toBe(true);
    });

    it("Directive 1 & 22: resolves symbol implementation in favor of verified source for WHAT_SOURCE_IMPLEMENTS_SYMBOL", () => {
        const evidencePool: EvidenceItemForDecision[] = [
            {
                evidenceId: "ev_source_repo",
                sourceType: "VERIFIED_SOURCE",
                claimedFact: "OrderService implements ProcessPayment in src/services/order.ts",
                confidence: "STATICALLY_VERIFIED",
            },
            {
                evidenceId: "ev_caller_guess",
                sourceType: "CODE_CALLERS",
                claimedFact: "MockPaymentGateway implements ProcessPayment",
                confidence: "INFERRED",
            },
        ];

        const result = reconcileEvidenceForDecision(
            "WHAT_SOURCE_IMPLEMENTS_SYMBOL",
            "Implementation of ProcessPayment",
            evidencePool
        );

        expect(result.isDefinitivelyResolved).toBe(true);
        expect(result.establishedFact).toBe("OrderService implements ProcessPayment in src/services/order.ts");
        expect(result.dominatingEvidenceId).toBe("ev_source_repo");
    });

    it("Directive 22: explicitly preserves unresolved contradiction between two primary authorities", () => {
        const evidencePool: EvidenceItemForDecision[] = [
            {
                evidenceId: "ev_runtime_trace_1",
                sourceType: "RUNTIME_TRACE",
                claimedFact: "Method X exited via normal return",
                confidence: "OBSERVED",
            },
            {
                evidenceId: "ev_runtime_trace_2",
                sourceType: "RUNTIME_TRACE",
                claimedFact: "Method X exited via unhandled exception",
                confidence: "OBSERVED",
            },
        ];

        const result = reconcileEvidenceForDecision(
            "WHAT_ACTUALLY_EXECUTED",
            "Exit path of Method X",
            evidencePool
        );

        expect(result.isDefinitivelyResolved).toBe(false);
        expect(result.unresolvedContradictionPreserved).toBe(true);
        expect(result.epistemicStatus).toBe("CONTRADICTED");
        expect(result.rationale).toContain("Irreconcilable contradiction");
    });

    it("Directive 21: evidence perturbation testing — non-critical removal preserves conclusion, critical removal downgrades", () => {
        const fullEvidencePool: EvidenceItemForDecision[] = [
            {
                evidenceId: "ev_primary_trace",
                sourceType: "RUNTIME_TRACE",
                claimedFact: "Connection pool exhausted at 10:45:00",
                confidence: "OBSERVED",
            },
            {
                evidenceId: "ev_metric_span",
                sourceType: "RUNTIME_METRICS",
                claimedFact: "Active connections metric spiked to 10",
                confidence: "OBSERVED",
            },
        ];

        // Step 1: Baseline investigation with both sources
        const baseResult = reconcileEvidenceForDecision(
            "WHAT_ACTUALLY_EXECUTED",
            "Connection pool exhausted",
            fullEvidencePool
        );
        expect(baseResult.epistemicStatus).toBe("CONFIRMED");

        // Step 2: Perturb by removing non-critical secondary source (metric)
        const perturbedNonCritical = fullEvidencePool.filter((e) => e.sourceType !== "RUNTIME_METRICS");
        const nonCriticalResult = reconcileEvidenceForDecision(
            "WHAT_ACTUALLY_EXECUTED",
            "Connection pool exhausted",
            perturbedNonCritical
        );
        // Invariant: Decision remains stable because primary authority is preserved!
        expect(nonCriticalResult.epistemicStatus).toBe("CONFIRMED");
        expect(nonCriticalResult.establishedFact).toBe(baseResult.establishedFact);

        // Step 3: Perturb by removing decision-critical primary source (runtime trace)
        const perturbedCritical = fullEvidencePool.filter((e) => e.sourceType !== "RUNTIME_TRACE");
        const criticalResult = reconcileEvidenceForDecision(
            "WHAT_ACTUALLY_EXECUTED",
            "Connection pool exhausted",
            perturbedCritical
        );
        // Invariant: Conclusion downgrades when critical evidence disappears!
        expect(criticalResult.isDefinitivelyResolved).toBe(false);
        expect(criticalResult.epistemicStatus).toBe("STRONGLY_SUPPORTED");
        expect(criticalResult.rationale).toContain("primary authority required for confirmation");
    });
});
