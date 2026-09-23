import { describe, it, expect } from "vitest";
import { AdversarialChallenger } from "../adversarial-challenger";
import type { CandidateAction } from "../types";

describe("Halo Trace — Adversarial Challenger & Senior Engineer Simulator", () => {
    it("destroys symptom-masking patches that add defensive optional chaining (Sections 27, 31, 35)", () => {
        const challenger = new AdversarialChallenger();

        // A superficial patch that masks the symptom by adding `?.` at the crash site
        const symptomMaskingCandidate: CandidateAction = {
            id: "cand-masking-1",
            category: "REPAIR",
            title: "Add optional chaining to order customer",
            description: "Avoid TypeError by checking customerId with ?.",
            justification: "Prevents exception thrown at line 45",
            repairLocation: {
                type: "CODE_MODIFICATION",
                targetFile: "src/repository/order-repo.ts",
                rationale: "Null check at throw site",
            },
            changes: [
                {
                    file: "src/repository/order-repo.ts",
                    original: "order.customer.id",
                    replacement: "order?.customer?.id || {}",
                },
            ],
            confidence: "LOW",
            validationPlan: ["Test with null customer"],
            uncertainty: [],
        };

        const challengeResult = challenger.challengeCandidate(symptomMaskingCandidate);

        expect(challengeResult.symptomMaskingDetected).toBe(true);
        expect(challengeResult.survivedAdversarialChallenge).toBe(false);
        expect(challengeResult.maskingReason).toContain("suppresses failure locally");
        expect(challengeResult.counterexamples.some((c) => c.status === "DISPROVED")).toBe(true);
    });

    it("approves genuine invariant-restoring candidate with minimality verification (Sections 31 & 32)", () => {
        const challenger = new AdversarialChallenger();

        // A genuine repair that restores the missing property forwarding at the producer
        const validCandidate: CandidateAction = {
            id: "cand-producer-fix",
            category: "REPAIR",
            title: "Restore customerId mapping in OrderFactory",
            description: "Include customerId property when building OrderContext payload",
            justification: "Satisfies order contract invariant required by repository",
            repairLocation: {
                type: "CODE_MODIFICATION",
                targetFile: "src/factories/order-factory.ts",
                targetSymbol: "createOrder",
                rationale: "Contract owner responsible for order structure",
            },
            changes: [
                {
                    file: "src/factories/order-factory.ts",
                    original: "const order = { id: req.id };",
                    replacement: "const order = { id: req.id, customerId: req.customerId };",
                },
            ],
            confidence: "HIGH",
            validationPlan: ["Run order factory unit tests"],
            uncertainty: [],
        };

        const challengeResult = challenger.challengeCandidate(validCandidate);

        expect(challengeResult.symptomMaskingDetected).toBe(false);
        expect(challengeResult.minimalityVerified).toBe(true);
        expect(challengeResult.necessityVerified).toBe(true);
        expect(challengeResult.survivedAdversarialChallenge).toBe(true);
    });

    it("generates senior engineer simulator perspective (Sections 34, 49, 50, 51, 52)", () => {
        const challenger = new AdversarialChallenger();

        const analysis = challenger.runSeniorEngineerSimulator(
            "src/repository/order-repo.ts:45",
            "src/factories/order-factory.ts",
            "Order object must contain valid customerId",
            "OrderFactory",
            true
        );

        expect(analysis.whyNotObviousFix).toContain("The obvious fix is to add optional chaining");
        expect(analysis.whatJuniorWouldMiss).toContain("junior engineer might attempt to wrap the call");
        expect(analysis.whatStaffEngineerWouldNotice).toContain("systemic contract boundary gap");
        expect(analysis.whatWouldChangeDecision).toContain("telemetry proved that OrderFactory did in fact emit a valid, complete object");
    });
});
