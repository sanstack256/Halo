import { describe, it, expect } from "vitest";
import { ReasoningStateManager, ClaimGraphManager } from "../reasoning-state";

describe("Halo Trace — Versioned Reasoning State & Cascading Invalidation", () => {
    it("transitions through explicit version sequence R0..R10 with audited rationale", () => {
        const manager = new ReasoningStateManager("R0");
        expect(manager.currentVersion).toBe("R0");

        manager.transition("R1", "Reconstructed execution path");
        expect(manager.currentVersion).toBe("R1");

        manager.transition("R2", "First divergence point identified");
        manager.transition("R3", "Violated invariant derived");
        manager.transition("R6", "Causal mechanism confirmed");
        manager.transition("R8", "Adversarial challenges evaluated");
        manager.transition("R10", "Authoritative decision finalized");

        const state = manager.getState();
        expect(state.version).toBe("R10");
        expect(state.versionHistory).toHaveLength(7);
        expect(state.versionHistory[0].version).toBe("R0");
        expect(state.versionHistory[6].version).toBe("R10");
    });

    it("enforces cascading invalidation across the Claim Dependency Graph (Section 8)", () => {
        const manager = new ReasoningStateManager("R0");
        const claims = manager.claims;

        // C1: customerId exists at request boundary
        claims.addClaim({
            claimId: "C1",
            statement: "customerId exists at request boundary",
            type: "FACT",
            status: "SUPPORTED",
            evidenceRefs: ["evt-request-1"],
            reasoningRefs: [],
        });

        // C2: customerId is absent after factory transformation
        claims.addClaim({
            claimId: "C2",
            statement: "customerId is absent after factory transformation",
            type: "FIRST_DIVERGENCE",
            status: "SUPPORTED",
            evidenceRefs: ["span-factory-1"],
            reasoningRefs: ["C1"],
        });

        // C3: factory caused the loss
        claims.addClaim({
            claimId: "C3",
            statement: "factory caused the loss",
            type: "CAUSAL_MECHANISM",
            status: "SUPPORTED",
            evidenceRefs: [],
            reasoningRefs: ["C2"],
        });

        // C4: factory owns the violated producer contract
        claims.addClaim({
            claimId: "C4",
            statement: "factory owns the violated producer contract",
            type: "CONTRACT_OWNERSHIP",
            status: "SUPPORTED",
            evidenceRefs: [],
            reasoningRefs: ["C3"],
        });

        // C5: factory is repair boundary
        claims.addClaim({
            claimId: "C5",
            statement: "factory is repair boundary",
            type: "REPAIR_BOUNDARY",
            status: "SUPPORTED",
            evidenceRefs: [],
            reasoningRefs: ["C4"],
        });

        // C6: candidate patch restores customerId
        claims.addClaim({
            claimId: "C6",
            statement: "candidate patch restores customerId",
            type: "CANDIDATE_CORRECTNESS",
            status: "SUPPORTED",
            evidenceRefs: ["candidate-1"],
            reasoningRefs: ["C5"],
        });

        // Verify all 6 claims are initially SUPPORTED
        expect(claims.getActiveClaims()).toHaveLength(6);

        // Now, suppose new runtime evidence reveals C2 was false (e.g. factory DID output customerId)
        const invalidatedIds = claims.invalidateClaim("C2", "Runtime telemetry proves factory output contained customerId");

        // Verify cascading invalidation: C2, C3, C4, C5, C6 must all be INVALIDATED
        expect(invalidatedIds).toEqual(["C2", "C3", "C4", "C5", "C6"]);

        expect(claims.getClaim("C1")?.status).toBe("SUPPORTED");
        expect(claims.getClaim("C2")?.status).toBe("INVALIDATED");
        expect(claims.getClaim("C3")?.status).toBe("INVALIDATED");
        expect(claims.getClaim("C4")?.status).toBe("INVALIDATED");
        expect(claims.getClaim("C5")?.status).toBe("INVALIDATED");
        expect(claims.getClaim("C6")?.status).toBe("INVALIDATED");

        expect(claims.getActiveClaims()).toHaveLength(1);
        expect(claims.getActiveClaims()[0].claimId).toBe("C1");
    });

    it("evaluates competing hypotheses and eliminates contradicted ones (Sections 22-24)", () => {
        const manager = new ReasoningStateManager("R0");

        manager.addHypothesis({
            hypothesisId: "hyp-connection-leak",
            statement: "Connection leak in transaction handler caused pool exhaustion",
            requiredConditions: [
                "Connections acquired during request",
                "Acquisitions lack matching release",
                "Exhaustion occurs after accumulated leakage",
            ],
            supportingEvidence: ["log-acquired-conn", "log-no-release"],
            contradictingEvidence: [],
            status: "SUPPORTED",
        });

        manager.addHypothesis({
            hypothesisId: "hyp-db-saturation",
            statement: "External database saturation caused latency spike and pool starvation",
            requiredConditions: ["DB CPU at 100%", "Slow query log spikes"],
            supportingEvidence: [],
            contradictingEvidence: [],
            status: "UNKNOWN",
        });

        // Evidence arrives proving DB CPU was normal at 12%
        manager.evaluateHypothesis("hyp-db-saturation", {
            contradictingEvidence: ["metrics-db-cpu-12pct"],
            eliminationReason: "Database CPU was nominal at 12%, refuting external saturation",
        });

        // Correlated exhaustion evidence confirms the connection leak
        manager.evaluateHypothesis("hyp-connection-leak", {
            supportingEvidence: ["trace-exhaustion-correlation"],
        });

        const state = manager.getState();
        const dbHyp = state.hypotheses.find((h) => h.hypothesisId === "hyp-db-saturation");
        const leakHyp = state.hypotheses.find((h) => h.hypothesisId === "hyp-connection-leak");

        expect(dbHyp?.status).toBe("CONTRADICTED");
        expect(leakHyp?.status).toBe("CONFIRMED");
    });
});
