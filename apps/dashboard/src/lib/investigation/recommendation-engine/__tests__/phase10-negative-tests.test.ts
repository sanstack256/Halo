import { describe, it, expect, beforeEach } from "vitest";
import {
    registerAuthoritativeCommit,
    clearRegisteredCommits,
    clearSourceCache,
    resolveAuthoritativeSource,
} from "../../runtime/source-provenance";
import {
    parseSourceAst,
    locateCallerCallSite,
    traceArgumentDataFlow,
    generateAuthoritativeCallerPatch,
} from "../causal-source-reconstructor";
import { SnapshotReconstructionEnvironmentProvider } from "../execution-environment-builder";
import { buildInvestigationSnapshot } from "../investigation-snapshot";

describe("Phase 10 — Negative Tests & Fail-Closed Guardrails (§57, §63)", () => {
    beforeEach(() => {
        clearRegisteredCommits();
        clearSourceCache();
    });

    it("fails closed with COMMIT_NOT_IDENTIFIED when commit SHA is absent (§7, §14, §57)", () => {
        const res = resolveAuthoritativeSource({
            repository: "auth-svc",
            filePath: "src/caller.ts",
        });

        expect(res.isAuthoritative).toBe(false);
        expect(res.carrier.provenanceState).toBe("UNVERIFIED");
        expect(res.carrier.unavailabilityReason).toContain("COMMIT_NOT_IDENTIFIED");
    });

    it("fails closed with SOURCE_NOT_FOUND when file does not exist in commit tree (§7, §14, §57)", () => {
        registerAuthoritativeCommit("auth-svc", "commit-abc-123", {
            "src/existing.ts": "export const x = 1;",
        });

        const res = resolveAuthoritativeSource({
            repository: "auth-svc",
            commitSha: "commit-abc-123",
            filePath: "src/non_existent.ts",
        });

        expect(res.isAuthoritative).toBe(false);
        expect(res.carrier.provenanceState).toBe("NOT_FOUND");
        expect(res.carrier.unavailabilityReason).toContain("SOURCE_NOT_FOUND");
    });

    it("fails closed with REVISION_MISMATCH when hash does not match expected (§8, §57)", () => {
        registerAuthoritativeCommit("auth-svc", "commit-abc-123", {
            "src/caller.ts": "export function test() { return 42; }",
        });

        const res = resolveAuthoritativeSource({
            repository: "auth-svc",
            commitSha: "commit-abc-123",
            filePath: "src/caller.ts",
            expectedHash: "invalid_expected_sha256_hash",
        });

        expect(res.isAuthoritative).toBe(false);
        expect(res.carrier.provenanceState).toBe("REVISION_MISMATCH");
        expect(res.carrier.unavailabilityReason).toContain("Source hash mismatch");
    });

    it("returns CALLEE_MISMATCH when callee is never called by caller (§18, §57)", () => {
        const callerSource = `
export function runner() {
    console.log("no callee here");
}
`.trim();

        const callSiteRes = locateCallerCallSite({
            callerSource,
            callerFilePath: "src/caller.ts",
            calleeSymbol: "requireTenant",
        });

        expect(callSiteRes.status).toBe("CALLEE_MISMATCH");
        expect(callSiteRes.callSite).toBeUndefined();
    });

    it("returns CALL_SITE_UNRESOLVED when callee is called multiple times without line hint (§19, §57)", () => {
        const callerSource = `
import { requireTenant } from "./callee.ts";
export function dispatch(req: any) {
    requireTenant(req.first);
    requireTenant(req.second);
}
`.trim();

        const callSiteRes = locateCallerCallSite({
            callerSource,
            callerFilePath: "src/caller.ts",
            calleeSymbol: "requireTenant",
        });

        expect(callSiteRes.status).toBe("CALL_SITE_UNRESOLVED");
        expect(callSiteRes.candidateCount).toBe(2);
    });

    it("fails closed with ARGUMENT_DATAFLOW_UNRESOLVED when argument data flow cannot be statically resolved (§22, §57)", () => {
        const callerSource = `
import { requireTenant } from "./callee.ts";
export function dispatch(req: any) {
    // Dynamically computed argument without local AST definition
    requireTenant(computeExternalPayload());
}
`.trim();

        const callSiteRes = locateCallerCallSite({
            callerSource,
            callerFilePath: "src/caller.ts",
            calleeSymbol: "requireTenant",
        });

        expect(callSiteRes.status).toBe("UNIQUELY_RESOLVED");

        const sourceFile = parseSourceAst(callerSource, "src/caller.ts");
        const dataFlow = traceArgumentDataFlow({
            sourceFile,
            callSite: callSiteRes.callSite!,
            targetProperty: "tenantId",
        });

        expect(dataFlow.status).toBe("ARGUMENT_DATAFLOW_UNRESOLVED");

        const patchRes = generateAuthoritativeCallerPatch({
            callerSource,
            callSite: callSiteRes.callSite!,
            dataFlow,
            contract: { calleeSymbol: "requireTenant", requiredProperty: "tenantId", preconditionCheckExpression: "!context.tenantId" },
            carrier: {
                repository: "test-repo",
                commitSha: "sha-1",
                filePath: "src/caller.ts",
                sourceHash: "hash-1",
                retrievalMethod: "GIT_COMMIT_OBJECT",
                sourceType: "REPOSITORY_SOURCE",
                revisionMatch: true,
                provenanceState: "CONFIRMED_EXACT",
            },
        });

        expect(patchRes.status).toBe("PATCH_TARGET_UNRESOLVED");
    });

    it("fails closed with CALLER_SOURCE_UNAVAILABLE in sandbox environment when caller source is missing (§30, §33, §57)", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "inc-neg-test",
                title: "Error: Missing required parameter 'tenantId'",
                firstSeen: new Date(),
                lastSeen: new Date(),
                service: "unregistered-svc",
            },
            rawEvidence: [
                {
                    id: "ev-neg-1",
                    type: "ERROR",
                    title: "Missing required parameter 'tenantId'",
                    timestamp: "2026-09-30T10:00:00Z",
                    service: "unregistered-svc",
                    environment: "production",
                    tags: {
                        exceptionType: "Error",
                        message: "Missing required parameter 'tenantId'",
                        stack: "Error: Missing required parameter 'tenantId'\n    at requireTenant (src/callee.ts:3:1)\n    at dispatch (src/caller.ts:5:1)",
                    },
                },
            ],
            stackFrames: [
                { order: 1, filePath: "src/callee.ts", lineNumber: 3, functionName: "requireTenant", isApplication: true },
                { order: 2, filePath: "src/caller.ts", lineNumber: 5, functionName: "dispatch", isApplication: true },
            ],
            source: {
                filePath: "src/callee.ts",
                failingLineNumber: 3,
                containingFunction: "requireTenant",
                lines: [{ lineNumber: 3, content: "throw new Error(\"Missing required parameter 'tenantId'\");" }],
                callers: ["src/caller.ts"],
            },
        });

        const provider = new SnapshotReconstructionEnvironmentProvider();
        const env = provider.buildEnvironmentSync(snapshot);

        expect(env.context.readinessState).toBe("BLOCKED");
        expect(env.context.blockingClassification).toBe("CALLER_SOURCE_UNAVAILABLE");
        expect(env.context.reconstructionStatus).toBe("ENVIRONMENT_RECONSTRUCTION_BLOCKED");
        env.cleanup();
    });
});
