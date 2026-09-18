import { describe, it, expect } from "vitest";
import { evaluateCandidateConsequences } from "../../consequence-analyzer";
import type { CandidateRepair } from "../../types";
import type { ReconstructedInvariant } from "../../contract-extractor";

describe("Directives 9, 14, 20 — Semantic Rejection of Tempting Wrong Fixes", () => {
    it("rejects increasing pool size when connection is held or leaked across external I/O (coverage NONE)", () => {
        const candidate: CandidateRepair = {
            id: "cand_increase_pool",
            boundaryId: "boundary_pool_config",
            targetedMechanism: "Connection held during external I/O exhausts connection pool",
            restoredInvariant: "Connection must be released immediately after query",
            evidenceSupportingRelationship: ["ev_pool_1"],
            modifications: [
                {
                    filePath: "src/config/database.ts",
                    symbol: "poolConfig",
                    startLine: 12,
                    endLine: 12,
                    originalCode: "poolSize: 10,",
                    replacementCode: "poolSize: 50,",
                },
            ],
            reusedExistingAbstractions: [],
        };

        const invariant: ReconstructedInvariant = {
            id: "inv_holding_scope",
            invariantType: "RESOURCE_HOLDING_SCOPE",
            governingEntity: "OrderRepository",
            formalStatement: "Connection must be released immediately after query execution",
            derivedFrom: "RUNTIME_GUARD",
            isViolatedInIncident: true,
            evidenceId: "ev_inv_1",
        };

        const result = evaluateCandidateConsequences({
            candidate,
            confirmedMechanism: "Connection held during external I/O exhausts connection pool",
            violatedInvariant: invariant,
        });

        expect(result.isApprovedForExecution).toBe(false);
        expect(result.mechanismCoverage.coverageType).toBe("NONE");
        expect(result.mechanismCoverage.merelyRaisesFailureThreshold).toBe(true);
        expect(result.consequenceAnalysis.classification).toBe("MASKS_SYMPTOM");
        expect(result.evaluationSummary).toContain("merely raises the capacity threshold");
    });

    it("rejects unbounded retries on non-idempotent operation (creates new failure mode)", () => {
        const candidate: CandidateRepair = {
            id: "cand_retry_loop",
            boundaryId: "boundary_payment_client",
            targetedMechanism: "Payment service timeout",
            restoredInvariant: "Payment charge must complete or fail with verified status",
            evidenceSupportingRelationship: ["ev_pay_1"],
            modifications: [
                {
                    filePath: "src/services/payment.ts",
                    symbol: "chargeCard",
                    startLine: 30,
                    endLine: 35,
                    originalCode: "return await client.charge(amount);",
                    replacementCode: "for (let attempt = 0; attempt < 5; attempt++) { try { return await client.charge(amount); } catch {} }",
                },
            ],
            reusedExistingAbstractions: [],
        };

        const invariant: ReconstructedInvariant = {
            id: "inv_idempotency",
            invariantType: "IDEMPOTENCY",
            governingEntity: "PaymentService",
            formalStatement: "Credit card charges must be idempotent without duplicate captures",
            derivedFrom: "API_PRECONDITION",
            isViolatedInIncident: true,
            evidenceId: "ev_inv_pay",
        };

        const result = evaluateCandidateConsequences({
            candidate,
            confirmedMechanism: "Payment service timeout",
            violatedInvariant: invariant,
            isIdempotentOperation: false,
        });

        expect(result.isApprovedForExecution).toBe(false);
        expect(result.consequenceAnalysis.isApprovedForExecution).toBe(false);
        expect(result.consequenceAnalysis.classification).toBe("CREATES_NEW_FAILURE_MODE");
    });

    it("rejects optional chaining on required non-null schema field (symptom masking)", () => {
        const candidate: CandidateRepair = {
            id: "cand_optional_chaining",
            boundaryId: "boundary_order_consumer",
            targetedMechanism: "Missing customerId on order record throws null pointer in database write",
            restoredInvariant: "Order record must contain non-null customerId",
            evidenceSupportingRelationship: ["ev_schema_1"],
            modifications: [
                {
                    filePath: "src/models/order.ts",
                    symbol: "saveOrder",
                    startLine: 45,
                    endLine: 45,
                    originalCode: "const id = order.customer.id;",
                    replacementCode: "const id = order?.customer?.id;",
                },
            ],
            reusedExistingAbstractions: [],
        };

        const invariant: ReconstructedInvariant = {
            id: "inv_customer_required",
            invariantType: "NON_NULL_FIELD",
            governingEntity: "Order.customer.id",
            formalStatement: "Order record must contain non-null customerId",
            derivedFrom: "TYPESCRIPT_TYPE_SYSTEM",
            isViolatedInIncident: true,
            evidenceId: "ev_inv_cust",
        };

        const result = evaluateCandidateConsequences({
            candidate,
            confirmedMechanism: "Missing customerId",
            violatedInvariant: invariant,
        });

        expect(result.isApprovedForExecution).toBe(false);
        expect(result.mechanismCoverage.coverageType).toBe("NONE");
        expect(result.mechanismCoverage.suppressesSymptomWithoutFix).toBe(true);
        expect(result.consequenceAnalysis.classification).toBe("MASKS_SYMPTOM");
    });

    it("approves genuine invariant-restoring fix with DIRECT coverage", () => {
        const candidate: CandidateRepair = {
            id: "cand_finally_release",
            boundaryId: "boundary_order_repo",
            targetedMechanism: "Connection handle not released in exception block",
            restoredInvariant: "Connection must be returned to pool in finally block",
            evidenceSupportingRelationship: ["ev_conn_release"],
            modifications: [
                {
                    filePath: "src/repositories/order.ts",
                    symbol: "findOrder",
                    startLine: 20,
                    endLine: 28,
                    originalCode: "const conn = await pool.acquire(); return await conn.query();",
                    replacementCode: "const conn = await pool.acquire(); try { return await conn.query(); } finally { await conn.release(); }",
                },
            ],
            reusedExistingAbstractions: [],
        };

        const invariant: ReconstructedInvariant = {
            id: "inv_lifecycle",
            invariantType: "LIFECYCLE_CLEANUP",
            governingEntity: "OrderRepository",
            formalStatement: "Connection must be returned to pool in finally block",
            derivedFrom: "RUNTIME_GUARD",
            isViolatedInIncident: true,
            evidenceId: "ev_inv_conn",
        };

        const result = evaluateCandidateConsequences({
            candidate,
            confirmedMechanism: "Connection handle not released in exception block",
            violatedInvariant: invariant,
        });

        expect(result.isApprovedForExecution).toBe(true);
        expect(result.mechanismCoverage.coverageType).toBe("DIRECT");
        expect(result.mechanismCoverage.restoresViolatedInvariant).toBe(true);
        expect(result.consequenceAnalysis.classification).toBe("FIXES_MECHANISM");
    });
});
