import { describe, it, expect } from "vitest";
import { ArchitecturalMemoryStore, SystemicPreventionReasoner } from "../architectural-memory";
import type { ExplicitInvariant } from "../types";

describe("Halo Trace — Architectural Memory & Systemic Prevention", () => {
    it("indexes verified repairs by structural fingerprint and never error strings (Sections 43 & 44)", () => {
        const store = new ArchitecturalMemoryStore();

        store.recordVerifiedRepair({
            experienceId: "exp-1",
            failureStructure: "Missing required contract property in downstream persistence",
            executionStructure: "Gateway -> Controller -> Factory -> Repository",
            mechanismPattern: "Dropped property during object destructuring in factory",
            invariantPattern: "Required property must be present before DB call",
            contractOwnershipPattern: "Factory owns output shape",
            successfulRepairBoundary: "src/factories/order-factory.ts#createOrder",
        });

        // Retrieve by invariant pattern and ownership
        const matches = store.findStructuralExperiences("Required property must be present", "Factory");
        expect(matches).toHaveLength(1);
        expect(matches[0].successfulRepairBoundary).toBe("src/factories/order-factory.ts#createOrder");
        expect(matches[0].relevanceCount).toBe(1);

        // Recording identical structural experience increments relevanceCount
        store.recordVerifiedRepair({
            experienceId: "exp-2",
            failureStructure: "Missing required contract property in downstream persistence",
            executionStructure: "Gateway -> Controller -> Factory -> Repository",
            mechanismPattern: "Dropped property during object destructuring in factory",
            invariantPattern: "Required property must be present before DB call",
            contractOwnershipPattern: "Factory owns output shape",
            successfulRepairBoundary: "src/factories/order-factory.ts#createOrder",
        });

        expect(store.getAllExperiences()).toHaveLength(1);
        expect(store.getAllExperiences()[0].relevanceCount).toBe(2);
    });

    it("detects systemic defects when multiple incidents share invariant violations (Section 45)", () => {
        const reasoner = new SystemicPreventionReasoner();

        const historicalIncidents = [
            {
                occurrenceId: "occ-101",
                invariant: "Required tenantId property must exist on RequestContext",
                boundary: "src/context/request-context.ts",
            },
            {
                occurrenceId: "occ-102",
                invariant: "Required tenantId property must exist on RequestContext",
                boundary: "src/context/request-context.ts",
            },
        ];

        const systemicDefects = reasoner.detectSystemicDefects(
            "Required tenantId property must exist on RequestContext",
            "src/context/request-context.ts",
            historicalIncidents
        );

        expect(systemicDefects).toHaveLength(1);
        expect(systemicDefects[0].defectClusterId).toBe("systemic:src/context/request-context.ts");
        expect(systemicDefects[0].affectedOccurrencesCount).toBe(3);
        expect(systemicDefects[0].systemicRecommendation).toContain("Consolidate contract validation");
    });

    it("distinguishes immediate repair from systemic prevention (Sections 47 & 48)", () => {
        const reasoner = new SystemicPreventionReasoner();

        const mockInvariant: ExplicitInvariant = {
            invariantId: "inv-order-1",
            statement: "Order must contain customerId",
            scope: "src/factories/order-factory.ts",
            preconditions: [],
            expectedState: {},
            violatedState: {},
            evidenceRefs: [],
            ownerCandidates: ["OrderFactory"],
            enforcementPoints: ["src/factories/order-factory.ts"],
            violationPoint: "src/repository/order-repo.ts:45",
            restorationCandidates: [],
        };

        const result = reasoner.reasonAboutPrevention(
            "src/factories/order-factory.ts",
            "createOrder",
            mockInvariant,
            "OrderFactory"
        );

        expect(result.immediateRepair).toContain("Restore invariant property forwarding in createOrder");
        expect(result.systemicPrevention).toContain("Enforce contract schema validation at the request ingress boundary");
        expect(result.preventionMechanism).toBe("SCHEMA_VALIDATION");
    });
});
