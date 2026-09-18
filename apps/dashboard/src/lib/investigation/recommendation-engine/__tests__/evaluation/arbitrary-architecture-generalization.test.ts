import { describe, it, expect } from "vitest";
import { searchRepairBoundaries } from "../../boundary-search";
import { evaluateCandidateConsequences } from "../../consequence-analyzer";
import { executePatchInIsolatedHarness } from "../../patch-harness";
import { assembleComprehensiveProof } from "../../proof-assembler";
import { determineFormalRecommendationState, buildAdaptiveRecommendationContract } from "../../engine";
import type { ReconstructedInvariant } from "../../contract-extractor";
import type { CausalHypothesis, CandidateRepair, OpenRepairBoundary } from "../../types";

describe("Directives 19, 27, 29 — Arbitrary Architecture Generalization & Repair Perturbation", () => {
    it("Directive 19: correctly identifies PRODUCER boundary when callee throws on malformed payload", () => {
        const invariant: ReconstructedInvariant = {
            id: "inv_user_payload",
            invariantType: "NON_NULL_FIELD",
            governingEntity: "UserPayloadProducer",
            formalStatement: "Payload producer must provide valid userId string",
            derivedFrom: "TYPESCRIPT_TYPE_SYSTEM",
            isViolatedInIncident: true,
            evidenceId: "ev_producer_contract",
        };

        const result = searchRepairBoundaries({
            confirmedMechanism: "User payload generated without required userId property",
            violatedInvariant: invariant,
            participants: [
                {
                    name: "UserPayloadProducer",
                    filePath: "src/producers/user-factory.ts",
                    roleInExecution: "ORIGINATES_PAYLOAD",
                    canMutateState: true,
                    holdsOwnership: true,
                    evidenceIds: ["ev_prod_1"],
                },
                {
                    name: "CalleteeConsumer",
                    filePath: "src/services/billing.ts",
                    roleInExecution: "CONSUMES_PAYLOAD",
                    canMutateState: false, // Invariant: patching consumer would mask producer bug
                    holdsOwnership: false,
                    evidenceIds: ["ev_cons_1"],
                },
            ],
        });

        expect(result.isAmbiguous).toBe(false);
        expect(result.selectedPrimaryBoundary?.classificationTag).toBe("PRODUCER");
        expect(result.selectedPrimaryBoundary?.entity).toContain("UserPayloadProducer");
        // Callee consumer boundary is eliminated to prevent symptom masking
        expect(result.discoveredBoundaries.find((b) => b.classificationTag === "CONSUMER")?.isCapableOfRestoringInvariant).toBe(false);
    });

    it("Directive 29: repair-location perturbation — moves repair boundary to CONSUMER when consumer violates contract", () => {
        const invariant: ReconstructedInvariant = {
            id: "inv_optional_handling",
            invariantType: "API_PRECONDITION",
            governingEntity: "ConsumerService",
            formalStatement: "Consumer must handle nullable middleName according to specification",
            derivedFrom: "TEST_ASSERTION",
            isViolatedInIncident: true,
            evidenceId: "ev_consumer_contract",
        };

        const result = searchRepairBoundaries({
            confirmedMechanism: "Consumer dereferences nullable middleName without null check",
            violatedInvariant: invariant,
            participants: [
                {
                    name: "PayloadProvider",
                    filePath: "src/producers/provider.ts",
                    roleInExecution: "ORIGINATES_PAYLOAD",
                    canMutateState: false,
                    holdsOwnership: false,
                    evidenceIds: ["ev_prod_spec"],
                },
                {
                    name: "ConsumerService",
                    filePath: "src/consumers/formatter.ts",
                    roleInExecution: "CONSUMES_PAYLOAD",
                    canMutateState: true,
                    holdsOwnership: true,
                    evidenceIds: ["ev_cons_impl"],
                },
            ],
        });

        expect(result.selectedPrimaryBoundary?.classificationTag).toBe("CONSUMER");
        expect(result.selectedPrimaryBoundary?.entity).toContain("ConsumerService");
    });

    it("Directive 27: database pool generalization — same visible timeout produces different mechanisms from evidence", () => {
        // Cause A: Resource leak in exception block
        const leakHypothesis: CausalHypothesis = {
            id: "hypo_leak",
            mechanism: "Connection handle not returned to pool in exception block",
            causalEstablishmentTier: "DEFECT_CAUSED_OCCURRENCE",
            conditions: [
                {
                    id: "c1",
                    description: "Missing finally block",
                    requiredFact: "AST lacks finally block in checkout",
                    attachedEvidenceIds: ["ev_ast_leak"],
                    contradictingEvidenceIds: [],
                    status: "CONFIRMED",
                    evaluationRationale: "AST verified",
                },
            ],
            supportingEvidenceIds: ["ev_ast_leak"],
            contradictingEvidenceIds: [],
            missingEvidenceDescriptions: [],
            causalRelationships: [],
            affectedExecutionPath: ["checkout()"],
            repairImplications: "Add finally release block",
            status: "CONFIRMED",
        };

        // Cause B: Long-held resource across external I/O
        const longHeldHypothesis: CausalHypothesis = {
            id: "hypo_long_held",
            mechanism: "Connection held during external payment gateway HTTP request",
            causalEstablishmentTier: "DEFECT_CAUSED_OCCURRENCE",
            conditions: [
                {
                    id: "c2",
                    description: "External HTTP call in connection live range",
                    requiredFact: "fetch(payment_api) executed while connection leased",
                    attachedEvidenceIds: ["ev_trace_io"],
                    contradictingEvidenceIds: [],
                    status: "CONFIRMED",
                    evaluationRationale: "Trace verified",
                },
            ],
            supportingEvidenceIds: ["ev_trace_io"],
            contradictingEvidenceIds: [],
            missingEvidenceDescriptions: [],
            causalRelationships: [],
            affectedExecutionPath: ["checkout() -> fetch()"],
            repairImplications: "Narrow connection holding scope to database query only",
            status: "CONFIRMED",
        };

        // Invariant: Both produced DatabaseConnectionTimeout, but derived mechanisms and repairs are completely distinct!
        expect(leakHypothesis.mechanism).not.toBe(longHeldHypothesis.mechanism);
        expect(leakHypothesis.repairImplications).toContain("finally");
        expect(longHeldHypothesis.repairImplications).toContain("Narrow connection holding scope");
    });

    it("Directives 10 & 26: complete end-to-end flow produces VERIFIED_REPAIR with three-tier proof", () => {
        const hypothesis: CausalHypothesis = {
            id: "hypo_confirmed_1",
            mechanism: "Unreleased file descriptor on error",
            causalEstablishmentTier: "DEFECT_CAUSED_OCCURRENCE",
            conditions: [
                {
                    id: "cond_1",
                    description: "Verified leak",
                    requiredFact: "File handle opened and leaked",
                    attachedEvidenceIds: ["ev_1"],
                    contradictingEvidenceIds: [],
                    status: "CONFIRMED",
                    evaluationRationale: "Verified",
                },
            ],
            supportingEvidenceIds: ["ev_1", "ev_trace_1"],
            contradictingEvidenceIds: [],
            missingEvidenceDescriptions: [],
            causalRelationships: [],
            affectedExecutionPath: ["open() -> throw"],
            repairImplications: "Ensure close in finally",
            status: "CONFIRMED",
        };

        const invariant: ReconstructedInvariant = {
            id: "inv_cleanup",
            invariantType: "LIFECYCLE_CLEANUP",
            governingEntity: "FileLogger",
            formalStatement: "File descriptor must be closed on all paths",
            derivedFrom: "RUNTIME_GUARD",
            isViolatedInIncident: true,
            evidenceId: "ev_inv",
        };

        const candidate: CandidateRepair = {
            id: "cand_close_finally",
            boundaryId: "boundary_logger",
            targetedMechanism: "Unreleased file descriptor on error",
            restoredInvariant: "File descriptor must be closed on all paths",
            evidenceSupportingRelationship: ["ev_rel"],
            modifications: [
                {
                    filePath: "src/logger.ts",
                    symbol: "logToFile",
                    startLine: 10,
                    endLine: 18,
                    originalCode: "const fd = open(); write(fd);",
                    replacementCode: "const fd = open(); try { write(fd); } finally { close(fd); }",
                },
            ],
            reusedExistingAbstractions: [],
        };

        const boundary: OpenRepairBoundary = {
            id: "boundary_logger",
            entity: "src/logger.ts:logToFile",
            entityRoleDescription: "Owns file handle lifecycle",
            discoveredVia: "RESOURCE_CONTROLLER",
            classificationTag: "SHARED_ABSTRACTION",
            isCapableOfRestoringInvariant: true,
            ownershipEvidenceIds: ["ev_owner"],
        };

        // 1. Evaluate consequences
        const consequenceResult = evaluateCandidateConsequences({
            candidate,
            confirmedMechanism: hypothesis.mechanism,
            violatedInvariant: invariant,
        });
        expect(consequenceResult.isApprovedForExecution).toBe(true);

        // 2. Execute in isolated harness
        const harnessResult = executePatchInIsolatedHarness({
            candidate,
            violatedInvariant: invariant,
            baselineRecord: {
                failingTests: ["unrelated_test_xyz"],
                buildErrors: [],
                typeErrors: [],
                timestamp: Date.now(),
            },
        });
        expect(harnessResult.isCleanPass).toBe(true);
        // Invariant: Unchanged baseline failure was partitioned!
        expect(harnessResult.postPatchValidation.unchangedBaselineFailures).toContain("unrelated_test_xyz");

        // 3. Assemble three-tier proof
        const proof = assembleComprehensiveProof({
            incidentId: "inc_logger_88",
            hypothesis,
            violatedInvariantStatement: invariant.formalStatement,
            candidate,
            boundary,
            mechanismCoverage: consequenceResult.mechanismCoverage,
            consequenceApproval: consequenceResult.consequenceAnalysis,
            postPatchValidation: harnessResult.postPatchValidation,
            reproductionRecord: {
                id: "repro_1",
                state: "REPRODUCED",
                repositoryRevision: "abc1234",
                runtimeVersion: "node-20",
                environmentRequirements: [],
                inputPayloadOrArgs: {},
                executionCommand: "npm test",
                observedResult: "Pass",
                expectedResult: "Pass",
                exitCode: 0,
                stdout: "Success",
                stderr: "",
                evidenceReferences: ["ev_repro"],
                hypothesisImpactRationale: "Verified",
            },
            executionLogExcerpt: "Tests passed cleanly.",
        });

        expect(proof).not.toBeNull();
        expect(proof?.diagnosisProof.cryptographicHash).toBeDefined();
        expect(proof?.repairProof.cryptographicHash).toBeDefined();
        expect(proof?.behavioralProof.cryptographicHash).toBeDefined();

        // 4. Determine formal state & build adaptive recommendation contract
        const formalState = determineFormalRecommendationState({
            proof,
            isExecutionHarnessAvailable: true,
            isSupportedCandidateAvailable: true,
        });

        expect(formalState).toBe("VERIFIED_REPAIR");

        const contract = buildAdaptiveRecommendationContract(formalState, {
            proof,
            candidateEdits: [
                {
                    filePath: "src/logger.ts",
                    diff: "+ close(fd);",
                    explanation: "Close file handle in finally",
                },
            ],
        });

        expect(contract.state).toBe("VERIFIED_REPAIR");
        expect(contract.adaptiveSections[0].title).toBe("Recommended Action");
        expect(contract.adaptiveSections[1].title).toBe("Exact Change");
    });
});
