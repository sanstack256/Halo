import { describe, it, expect, beforeEach } from "vitest";
import {
    computeSourceHash,
    isValidCommitSha,
    registerAuthoritativeCommit,
    clearRegisteredCommits,
    clearSourceCache,
    resolveAuthoritativeSource,
    normalizeStackFrames,
} from "../source-provenance";
import type { StackFrame } from "../types";

describe("Phase 10 — Source Provenance & Revision-Verified Resolution (§6-§16, §56, §57)", () => {
    beforeEach(() => {
        clearRegisteredCommits();
        clearSourceCache();
    });

    it("computes deterministic SHA-256 source hashes (§9)", () => {
        const code1 = "export function test() { return 42; }";
        const code2 = "export function test() { return 42; }";
        const code3 = "export function test() { return 43; }";

        expect(computeSourceHash(code1)).toBe(computeSourceHash(code2));
        expect(computeSourceHash(code1)).not.toBe(computeSourceHash(code3));
    });

    it("resolves exact commit source when registered (§56)", () => {
        const code = "export function dispatch(req: any) { return req.user; }";
        const expectedHash = computeSourceHash(code);
        registerAuthoritativeCommit("repo-auth", "c0ffee12345678", {
            "src/auth/caller_client.ts": code,
        });

        const res = resolveAuthoritativeSource({
            repository: "repo-auth",
            commitSha: "c0ffee12345678",
            filePath: "src/auth/caller_client.ts",
            expectedHash,
        });

        expect(res.isAuthoritative).toBe(true);
        expect(res.carrier.provenanceState).toBe("CONFIRMED_EXACT");
        expect(res.carrier.sourceHash).toBe(expectedHash);
        expect(res.carrier.revisionMatch).toBe(true);
        expect(res.content).toBe(code);
    });

    it("rejects wrong commit with NOT_FOUND (§56, §57)", () => {
        registerAuthoritativeCommit("repo-auth", "c0ffee12345678", {
            "src/auth/caller_client.ts": "content",
        });

        const res = resolveAuthoritativeSource({
            repository: "repo-auth",
            commitSha: "deadbeef999999",
            filePath: "src/auth/caller_client.ts",
        });

        expect(res.isAuthoritative).toBe(false);
        expect(res.carrier.provenanceState).toBe("NOT_FOUND");
    });

    it("rejects source hash mismatch with REVISION_MISMATCH (§9, §88)", () => {
        const code = "export function dispatch() {}";
        registerAuthoritativeCommit("repo-auth", "c0ffee12345678", {
            "src/auth/caller_client.ts": code,
        });

        const wrongHash = "0000000000000000000000000000000000000000000000000000000000000000";
        const res = resolveAuthoritativeSource({
            repository: "repo-auth",
            commitSha: "c0ffee12345678",
            filePath: "src/auth/caller_client.ts",
            expectedHash: wrongHash,
        });

        expect(res.isAuthoritative).toBe(false);
        expect(res.carrier.provenanceState).toBe("REVISION_MISMATCH");
        expect(res.carrier.revisionMatch).toBe(false);
        expect(res.carrier.unavailabilityReason).toContain("Source hash mismatch");
    });

    it("fails closed when commit SHA is missing (§10, §57)", () => {
        const res = resolveAuthoritativeSource({
            repository: "repo-auth",
            filePath: "src/auth/caller_client.ts",
        });

        expect(res.isAuthoritative).toBe(false);
        expect(res.carrier.provenanceState).toBe("UNVERIFIED");
        expect(res.carrier.unavailabilityReason).toContain("COMMIT_NOT_IDENTIFIED");
    });

    it("fails closed when file does not exist in commit (§57)", () => {
        registerAuthoritativeCommit("repo-auth", "c0ffee12345678", {
            "src/auth/other.ts": "content",
        });

        const res = resolveAuthoritativeSource({
            repository: "repo-auth",
            commitSha: "c0ffee12345678",
            filePath: "src/auth/caller_client.ts",
        });

        expect(res.isAuthoritative).toBe(false);
        expect(res.carrier.provenanceState).toBe("NOT_FOUND");
    });

    it("normalizes stack frames with THROW_SITE and CALLER roles (§12, §13)", () => {
        const frames: StackFrame[] = [
            {
                order: 1,
                functionName: "requireTenant",
                filePath: "src/auth/callee_client.ts",
                lineNumber: 3,
                isApplication: true,
                classification: "Application",
            },
            {
                order: 2,
                functionName: "dispatchClient",
                filePath: "src/auth/caller_client.ts",
                lineNumber: 12,
                isApplication: true,
                classification: "Application",
            },
            {
                order: 3,
                functionName: "processTicksAndRejections",
                filePath: "node:internal/process/task_queues",
                lineNumber: 95,
                isApplication: false,
                classification: "Runtime",
            },
        ];

        const normalized = normalizeStackFrames(frames, {
            repository: "repo-auth",
            commitSha: "c0ffee12345678",
            service: "auth-client-svc",
        });

        expect(normalized[0].frameRole).toBe("THROW_SITE");
        expect(normalized[0].repository).toBe("repo-auth");
        expect(normalized[1].frameRole).toBe("CALLER");
        expect(normalized[1].filePath).toBe("src/auth/caller_client.ts");
        expect(normalized[2].frameRole).toBe("CALLEE");
    });
});
