/**
 * Halo Trace — Formal Verified Repair Gate Test Suite (§36, §37, §75, §76)
 */

import { describe, it, expect } from "vitest";
import {
    evaluateVerifiedRepairGate,
    computeProofPayloadHash,
    verifyProofIntegrity,
} from "../verified-repair-gate";
import type {
    VerifiedRepairProofChain,
    SourceProof,
    MechanismProof,
    OwnershipProof,
    BaselineProof,
    CausalProof,
    PatchProof,
    BehaviorProof,
    InvariantProof,
    RegressionProof,
    CounterexampleProof,
} from "../types";

function buildValidProofChain(): VerifiedRepairProofChain {
    const revision = "git-rev-abc1234";
    const issueId = "issue-halo-1001";
    const candidateId = "cand-repair-01";

    const sourceProof: SourceProof = {
        proofId: "proof-src-1",
        proofType: "SOURCE_PROOF",
        status: "VERIFIED",
        timestamp: new Date().toISOString(),
        repositoryRevision: revision,
        sourceRevision: revision,
        targetFile: "src/billing/discount.ts",
        targetSymbol: "calculateDiscount",
        sourceHash: "hash-src-1111",
        symbolResolved: true,
        canonicalRevisionVerified: true,
        evidenceReferences: ["source:src/billing/discount.ts"],
        executionArtifactReferences: [],
        validationDetails: {},
        cryptographicHash: "",
    };
    sourceProof.cryptographicHash = computeProofPayloadHash(sourceProof as any);

    const mechanismProof: MechanismProof = {
        proofId: "proof-mech-1",
        proofType: "MECHANISM_PROOF",
        status: "VERIFIED",
        timestamp: new Date().toISOString(),
        repositoryRevision: revision,
        sourceRevision: revision,
        confirmedMechanism: "NULL_DEREFERENCE",
        violatedInvariant: "Discount policy must not dereference null coupon",
        causalEdges: [{ from: "coupon", to: "dereference", relation: "causes" }],
        epistemicConfidence: "CONFIRMED",
        evidenceReferences: ["mech:null-deref"],
        executionArtifactReferences: [],
        validationDetails: {},
        cryptographicHash: "",
    };
    mechanismProof.cryptographicHash = computeProofPayloadHash(mechanismProof as any);

    const ownershipProof: OwnershipProof = {
        proofId: "proof-owner-1",
        proofType: "OWNERSHIP_PROOF",
        status: "VERIFIED",
        timestamp: new Date().toISOString(),
        repositoryRevision: revision,
        sourceRevision: revision,
        contractOwnerFile: "src/billing/discount.ts",
        contractOwnerSymbol: "calculateDiscount",
        responsibilityBoundary: "CALLEE",
        rationale: "Discount calculator owns parameter validation contract",
        boundaryEvidenceIds: ["file:src/billing/discount.ts"],
        evidenceReferences: ["file:src/billing/discount.ts"],
        executionArtifactReferences: [],
        validationDetails: {},
        cryptographicHash: "",
    };
    ownershipProof.cryptographicHash = computeProofPayloadHash(ownershipProof as any);

    const baselineProof: BaselineProof = {
        proofId: "proof-base-1",
        proofType: "BASELINE_PROOF",
        status: "VERIFIED",
        timestamp: new Date().toISOString(),
        repositoryRevision: revision,
        sourceRevision: revision,
        failureIdentity: {
            exceptionType: "TypeError",
            normalizedMessage: "cannot read properties of undefined (reading 'rate')",
            sourceFile: "src/billing/discount.ts",
            lineNumber: 42,
            symbolName: "calculateDiscount",
            stackDigest: "digest-42-stack",
            failurePhase: "RUNTIME",
            expectedInvariant: "Null-safe discount rate access",
        },
        reproductionCommand: "npm test test/billing.test.ts",
        exitCode: 1,
        stdoutExcerpt: "TypeError: Cannot read properties of undefined (reading 'rate')",
        stderrExcerpt: "at calculateDiscount (src/billing/discount.ts:42:15)",
        durationMs: 420,
        trialsExecuted: 1,
        failureRate: 1.0,
        isProbabilistic: false,
        matchesIncidentFailure: true,
        evidenceReferences: ["error:anchor-01"],
        executionArtifactReferences: ["artifact://baseline.log"],
        validationDetails: {},
        cryptographicHash: "",
    };
    baselineProof.cryptographicHash = computeProofPayloadHash(baselineProof as any);

    const causalProof: CausalProof = {
        proofId: "proof-causal-1",
        proofType: "CAUSAL_PROOF",
        status: "VERIFIED",
        timestamp: new Date().toISOString(),
        repositoryRevision: revision,
        sourceRevision: revision,
        candidateId,
        observedFailureId: "error:anchor-01",
        failureMechanism: "NULL_DEREFERENCE",
        violatedInvariant: "Null-safe discount rate access",
        sourceBehaviorDescription: "Dereferences coupon.rate when coupon is undefined",
        candidateChangeHypothesis: "Check coupon presence before reading rate",
        experimentalCausalityConfirmed: true,
        evidenceReferences: ["error:anchor-01"],
        executionArtifactReferences: [],
        validationDetails: {},
        cryptographicHash: "",
    };
    causalProof.cryptographicHash = computeProofPayloadHash(causalProof as any);

    const patchProof: PatchProof = {
        proofId: "proof-patch-1",
        proofType: "PATCH_PROOF",
        status: "VERIFIED",
        timestamp: new Date().toISOString(),
        repositoryRevision: revision,
        sourceRevision: revision,
        candidateId,
        targetFile: "src/billing/discount.ts",
        originalSourceHash: "hash-orig-1111",
        patchedSourceHash: "hash-patch-2222",
        astTransformationOccurred: true,
        astDiffSummary: "+ if (!coupon) return 0;",
        isCommentOnly: false,
        isWhitespaceOnly: false,
        syntaxValid: true,
        changesAppliedCount: 1,
        evidenceReferences: ["source:src/billing/discount.ts"],
        executionArtifactReferences: [],
        validationDetails: {},
        cryptographicHash: "",
    };
    patchProof.cryptographicHash = computeProofPayloadHash(patchProof as any);

    const behaviorProof: BehaviorProof = {
        proofId: "proof-behav-1",
        proofType: "BEHAVIOR_PROOF",
        status: "VERIFIED",
        timestamp: new Date().toISOString(),
        repositoryRevision: revision,
        sourceRevision: revision,
        candidateId,
        baselineFailureEliminated: true,
        expectedBehaviorAchieved: true,
        unexpectedBehaviorIntroduced: false,
        notSimplySwallowedException: true,
        notSimplyDefaultFallback: true,
        executionLogExcerpt: "All 12 billing tests passed cleanly",
        evidenceReferences: ["baseline:proof-base-1"],
        executionArtifactReferences: [],
        validationDetails: {},
        cryptographicHash: "",
    };
    behaviorProof.cryptographicHash = computeProofPayloadHash(behaviorProof as any);

    const invariantProof: InvariantProof = {
        proofId: "proof-inv-1",
        proofType: "INVARIANT_PROOF",
        status: "VERIFIED",
        timestamp: new Date().toISOString(),
        repositoryRevision: revision,
        sourceRevision: revision,
        invariantStatement: "Discount calculation returns valid rate for all inputs",
        invariantCategory: "NULL_SAFETY",
        observedBefore: { satisfied: false, details: "Crashed on null coupon" },
        observedAfter: { satisfied: true, details: "Returns 0 on null coupon safely" },
        temporallyAware: true,
        typeAware: true,
        restorationConfirmed: true,
        evidenceReferences: ["behavior:proof-behav-1"],
        executionArtifactReferences: [],
        validationDetails: {},
        cryptographicHash: "",
    };
    invariantProof.cryptographicHash = computeProofPayloadHash(invariantProof as any);

    const regressionProof: RegressionProof = {
        proofId: "proof-regr-1",
        proofType: "REGRESSION_PROOF",
        status: "VERIFIED",
        timestamp: new Date().toISOString(),
        repositoryRevision: revision,
        sourceRevision: revision,
        candidateId,
        testsExecutedCount: 45,
        testsPassedCount: 45,
        preexistingFailures: [],
        newlyIntroducedFailures: [],
        regressionAttribution: "CLEAN_NO_REGRESSIONS",
        evidenceReferences: ["candidate:cand-repair-01"],
        executionArtifactReferences: [],
        validationDetails: {},
        cryptographicHash: "",
    };
    regressionProof.cryptographicHash = computeProofPayloadHash(regressionProof as any);

    const counterexampleProof: CounterexampleProof = {
        proofId: "proof-counter-1",
        proofType: "COUNTEREXAMPLE_PROOF",
        status: "VERIFIED",
        timestamp: new Date().toISOString(),
        repositoryRevision: revision,
        sourceRevision: revision,
        candidateId,
        casesTested: [
            {
                caseId: "case-null",
                category: "BOUNDARY_PAYLOAD",
                description: "Evaluates null coupon input",
                inputPayloadOrCondition: "coupon = null",
                survived: true,
                observedBehavior: "Returns 0 without exception",
            },
            {
                caseId: "case-empty",
                category: "MALFORMED_INPUT",
                description: "Evaluates empty coupon object",
                inputPayloadOrCondition: "coupon = {}",
                survived: true,
                observedBehavior: "Returns default rate safely",
            },
        ],
        allCasesSurvived: true,
        failedCaseCount: 0,
        evidenceReferences: ["candidate:cand-repair-01"],
        executionArtifactReferences: [],
        validationDetails: {},
        cryptographicHash: "",
    };
    counterexampleProof.cryptographicHash = computeProofPayloadHash(counterexampleProof as any);

    return {
        chainVersion: "1.0.0",
        issueId,
        repositoryRevision: revision,
        candidateId,
        currentState: "GENERATED",
        sourceProof,
        mechanismProof,
        ownershipProof,
        baselineProof,
        causalProof,
        patchProof,
        behaviorProof,
        invariantProof,
        regressionProof,
        counterexampleProof,
        evaluatedAt: Date.now(),
    };
}

describe("Halo Trace — Formal Verified Repair Gate (§36, §37, §75, §76)", () => {
    it("approves VERIFIED_REPAIR when all 9 empirical proof objects are valid and verified", () => {
        const chain = buildValidProofChain();
        const result = evaluateVerifiedRepairGate(chain);

        expect(result.isVerified).toBe(true);
        expect(result.achievedState).toBe("VERIFIED_REPAIR");
        expect(result.missingProofs).toHaveLength(0);
        expect(result.failedProofs).toHaveLength(0);
        expect(result.proofChain.currentState).toBe("VERIFIED_REPAIR");
    });

    it("fails closed when any proof is missing (§37)", () => {
        const chain = buildValidProofChain();
        delete (chain as any).counterexampleProof;

        const result = evaluateVerifiedRepairGate(chain);
        expect(result.isVerified).toBe(false);
        expect(result.achievedState).not.toBe("VERIFIED_REPAIR");
        expect(result.missingProofs).toContain("counterexampleProof");
    });

    it("rejects comment-only repairs (§14)", () => {
        const chain = buildValidProofChain();
        const pp = chain.patchProof!;
        pp.isCommentOnly = true;
        pp.cryptographicHash = computeProofPayloadHash(pp as any);

        const result = evaluateVerifiedRepairGate(chain);
        expect(result.isVerified).toBe(false);
        expect(result.achievedState).toBe("SOURCE_VERIFIED");
        expect(result.failedAt).toBe("PATCH_APPLIED");
        expect(result.reason).toContain("REJECTED: candidate only modified comments");
    });

    it("rejects whitespace-only repairs (§14)", () => {
        const chain = buildValidProofChain();
        const pp = chain.patchProof!;
        pp.isWhitespaceOnly = true;
        pp.cryptographicHash = computeProofPayloadHash(pp as any);

        const result = evaluateVerifiedRepairGate(chain);
        expect(result.isVerified).toBe(false);
        expect(result.achievedState).toBe("SOURCE_VERIFIED");
        expect(result.failedAt).toBe("PATCH_APPLIED");
        expect(result.reason).toContain("REJECTED: candidate only modified whitespace");
    });

    it("rejects baseline reproduction mismatch (§8)", () => {
        const chain = buildValidProofChain();
        const bp = chain.baselineProof!;
        bp.matchesIncidentFailure = false;
        bp.cryptographicHash = computeProofPayloadHash(bp as any);

        const result = evaluateVerifiedRepairGate(chain);
        expect(result.isVerified).toBe(false);
        expect(result.achievedState).toBe("PATCH_APPLIED");
        expect(result.failedAt).toBe("BASELINE_REPRODUCED");
        expect(result.reason).toContain("BASELINE_MISMATCH");
    });

    it("rejects exception swallowing / error masking (§17, §47)", () => {
        const chain = buildValidProofChain();
        const bp = chain.behaviorProof!;
        bp.notSimplySwallowedException = false;
        bp.cryptographicHash = computeProofPayloadHash(bp as any);

        const result = evaluateVerifiedRepairGate(chain);
        expect(result.isVerified).toBe(false);
        expect(result.achievedState).toBe("BASELINE_REPRODUCED");
        expect(result.failedAt).toBe("FAILURE_BEHAVIOR_CHANGED");
        expect(result.reason).toContain("REJECTED: patch merely suppressed or swallowed the exception");
    });

    it("rejects patch regression (§22, §23)", () => {
        const chain = buildValidProofChain();
        const rp = chain.regressionProof!;
        rp.regressionAttribution = "PATCH_REGRESSION";
        rp.newlyIntroducedFailures = ["FAIL test/checkout.test.ts"];
        rp.cryptographicHash = computeProofPayloadHash(rp as any);

        const result = evaluateVerifiedRepairGate(chain);
        expect(result.isVerified).toBe(false);
        expect(result.achievedState).toBe("INVARIANT_VALIDATED");
        expect(result.failedAt).toBe("REGRESSION_VALIDATED");
        expect(result.reason).toContain("PATCH_REGRESSION");
    });

    it("rejects counterexample boundary failure (§24-28)", () => {
        const chain = buildValidProofChain();
        const cp = chain.counterexampleProof!;
        cp.allCasesSurvived = false;
        cp.failedCaseCount = 1;
        cp.cryptographicHash = computeProofPayloadHash(cp as any);

        const result = evaluateVerifiedRepairGate(chain);
        expect(result.isVerified).toBe(false);
        expect(result.achievedState).toBe("REGRESSION_VALIDATED");
        expect(result.failedAt).toBe("COUNTEREXAMPLES_VALIDATED");
        expect(result.reason).toContain("COUNTEREXAMPLE_FAILURE");
    });

    it("enforces cryptographic proof immutability and content-addressing (§76)", () => {
        const chain = buildValidProofChain();
        // Tamper with proof content after hash was computed
        chain.patchProof!.status = "FAILED";

        const result = evaluateVerifiedRepairGate(chain);
        expect(result.isVerified).toBe(false);
        expect(result.failedProofs).toContain("PROVENANCE_INTEGRITY");
        expect(result.reason).toContain("Cryptographic integrity failure");
    });

    it("enforces repository revision uniformity across all proofs (§75)", () => {
        const chain = buildValidProofChain();
        chain.sourceProof!.repositoryRevision = "git-rev-different";
        chain.sourceProof!.cryptographicHash = computeProofPayloadHash(chain.sourceProof! as any);

        const result = evaluateVerifiedRepairGate(chain);
        expect(result.isVerified).toBe(false);
        expect(result.failedProofs).toContain("PROVENANCE_INTEGRITY");
        expect(result.reason).toContain("Provenance mismatch");
    });
});
