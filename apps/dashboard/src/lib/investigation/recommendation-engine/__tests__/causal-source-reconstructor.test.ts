import { describe, it, expect } from "vitest";
import {
    locateCallerCallSite,
    traceArgumentDataFlow,
    extractCalleeContract,
    verifyCallerContractViolation,
    generateAuthoritativeCallerPatch,
    parseSourceAst,
} from "../causal-source-reconstructor";
import { computeSourceHash } from "../../runtime/source-provenance";

describe("Phase 10 — Causal Source Reconstructor & Cross-Frame Call-Site Analyzer (§17 - §28, §56, §57)", () => {
    const callerSourceCode = `
import { requireTenant } from "./callee_client";

export function dispatchClient(request: any) {
    const context = {
        userId: request.user.id
    };
    requireTenant(context);
    return { status: "dispatched" };
}
`.trim();

    const calleeSourceCode = `
export function requireTenant(context: { tenantId?: string }) {
    if (!context || !context.tenantId) {
        throw new Error("Missing required parameter 'tenantId'");
    }
}
`.trim();

    it("identifies the exact AST call site with callee identity verification (§18, §19)", () => {
        const res = locateCallerCallSite({
            callerSource: callerSourceCode,
            callerFilePath: "src/auth/caller_client.ts",
            calleeSymbol: "requireTenant",
        });

        expect(res.status).toBe("UNIQUELY_RESOLVED");
        expect(res.callSite).toBeDefined();
        expect(res.callSite!.callerSymbol).toBe("dispatchClient");
        expect(res.callSite!.calleeSymbol).toBe("requireTenant");
        expect(res.callSite!.line).toBe(7);
        expect(res.callSite!.argumentExpressions).toEqual(["context"]);
    });

    it("fails closed with CALL_SITE_UNRESOLVED when multiple call sites exist without runtime line hint (§18, §91)", () => {
        const ambiguousSource = `
export function process(a: any, b: any) {
    requireTenant(a);
    requireTenant(b);
}
`.trim();

        const res = locateCallerCallSite({
            callerSource: ambiguousSource,
            callerFilePath: "src/ambiguous.ts",
            calleeSymbol: "requireTenant",
        });

        expect(res.status).toBe("CALL_SITE_UNRESOLVED");
        expect(res.candidateCount).toBe(2);
        expect(res.unavailabilityReason).toContain("Multiple matching call sites");
    });

    it("disambiguates multiple call sites when runtime line hint matches (§18)", () => {
        const ambiguousSource = `
export function process(a: any, b: any) {
    requireTenant(a);
    requireTenant(b);
}
`.trim();

        const res = locateCallerCallSite({
            callerSource: ambiguousSource,
            callerFilePath: "src/ambiguous.ts",
            calleeSymbol: "requireTenant",
            lineHint: 2,
        });

        expect(res.status).toBe("UNIQUELY_RESOLVED");
        expect(res.callSite?.line).toBe(2);
    });

    it("detects callee identity mismatch when callee is not called (§19)", () => {
        const res = locateCallerCallSite({
            callerSource: callerSourceCode,
            callerFilePath: "src/auth/caller_client.ts",
            calleeSymbol: "unrelatedFunction",
        });

        expect(res.status).toBe("CALLEE_MISMATCH");
    });

    it("traces backward data flow for object literals and identifies missing tenantId (§20, §21, §74)", () => {
        const callSiteRes = locateCallerCallSite({
            callerSource: callerSourceCode,
            callerFilePath: "src/auth/caller_client.ts",
            calleeSymbol: "requireTenant",
        });
        const sourceFile = parseSourceAst(callerSourceCode, "src/auth/caller_client.ts");

        const dataFlow = traceArgumentDataFlow({
            sourceFile,
            callSite: callSiteRes.callSite!,
            targetProperty: "tenantId",
        });

        expect(dataFlow.status).toBe("CONFIRMED");
        expect(dataFlow.argumentExpression).toBe("context");
        expect(dataFlow.definitionKind).toBe("OBJECT_LITERAL");
        expect(dataFlow.propertyState).toBe("ABSENT");
        expect(dataFlow.targetNodeRange).toBeDefined();
    });

    it("traces backward data flow through aliases (§95)", () => {
        const aliasedSource = `
export function dispatch(request: any) {
    const context = { userId: request.user.id };
    const ctx = context;
    requireTenant(ctx);
}
`.trim();
        const callSiteRes = locateCallerCallSite({
            callerSource: aliasedSource,
            callerFilePath: "src/aliased.ts",
            calleeSymbol: "requireTenant",
        });
        const sourceFile = parseSourceAst(aliasedSource, "src/aliased.ts");

        const dataFlow = traceArgumentDataFlow({
            sourceFile,
            callSite: callSiteRes.callSite!,
            targetProperty: "tenantId",
        });

        expect(dataFlow.status).toBe("CONFIRMED");
        expect(dataFlow.propertyState).toBe("ABSENT");
    });

    it("extracts callee contract precondition checks (§23)", () => {
        const contract = extractCalleeContract(calleeSourceCode, "src/auth/callee_client.ts");

        expect(contract.calleeSymbol).toBe("requireTenant");
        expect(contract.requiredProperty).toBe("tenantId");
        expect(contract.errorMessage).toBe("Missing required parameter 'tenantId'");
    });

    it("proves contract violation and confirms CALLER repair boundary (§24, §25)", () => {
        const callSiteRes = locateCallerCallSite({
            callerSource: callerSourceCode,
            callerFilePath: "src/auth/caller_client.ts",
            calleeSymbol: "requireTenant",
        });
        const sourceFile = parseSourceAst(callerSourceCode, "src/auth/caller_client.ts");

        const dataFlow = traceArgumentDataFlow({
            sourceFile,
            callSite: callSiteRes.callSite!,
            targetProperty: "tenantId",
        });

        const contract = extractCalleeContract(calleeSourceCode, "src/auth/callee_client.ts");
        const comparison = verifyCallerContractViolation(dataFlow, contract);

        expect(comparison.isViolation).toBe(true);
        expect(comparison.repairBoundary).toBe("CALLER");
        expect(comparison.causalProof).toContain("Repair boundary is definitively CALLER");
    });

    it("generates an authoritative source-grounded caller patch with cryptographic provenance (§27, §28)", () => {
        const callSiteRes = locateCallerCallSite({
            callerSource: callerSourceCode,
            callerFilePath: "src/auth/caller_client.ts",
            calleeSymbol: "requireTenant",
        });
        const sourceFile = parseSourceAst(callerSourceCode, "src/auth/caller_client.ts");

        const dataFlow = traceArgumentDataFlow({
            sourceFile,
            callSite: callSiteRes.callSite!,
            targetProperty: "tenantId",
        });

        const contract = extractCalleeContract(calleeSourceCode, "src/auth/callee_client.ts");
        const carrier = {
            repository: "repo-auth",
            commitSha: "c0ffee12345678",
            filePath: "src/auth/caller_client.ts",
            sourceHash: computeSourceHash(callerSourceCode),
            retrievalMethod: "GIT_COMMIT_OBJECT" as const,
            sourceType: "REPOSITORY_SOURCE" as const,
            revisionMatch: true,
            provenanceState: "CONFIRMED_EXACT" as const,
        };

        const patchRes = generateAuthoritativeCallerPatch({
            callerSource: callerSourceCode,
            callSite: callSiteRes.callSite!,
            dataFlow,
            contract,
            carrier,
        });

        expect(patchRes.status).toBe("GENERATED");
        expect(patchRes.patchedSource).toContain("tenantId: request.tenantId");
        expect(patchRes.patchProvenance).toBeDefined();
        expect(patchRes.patchProvenance?.cryptographicHash).toBeDefined();
        expect(patchRes.patchProvenance?.repairSymbol).toBe("dispatchClient");
    });
});
