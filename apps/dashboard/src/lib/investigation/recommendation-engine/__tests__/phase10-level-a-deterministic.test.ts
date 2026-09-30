import { describe, it, expect, beforeEach } from "vitest";
import { buildInvestigationSnapshot } from "../investigation-snapshot";
import { generateEngineeringRecommendation } from "../engine";
import { buildCompleteVerifiedRepairProofChain } from "../proof-engine";
import {
    registerAuthoritativeCommit,
    clearRegisteredCommits,
    clearSourceCache,
    computeSourceHash,
} from "../../runtime/source-provenance";

describe("Phase 10 — Level A Synthetic Deterministic Unit Fixture (§58, §60)", () => {
    const service = "auth-service-test";
    const commitSha = "a1b2c3d4e5f67890";
    const callerFile = "src/auth/caller_client.ts";
    const calleeFile = "src/auth/callee_client.ts";

    const callerSource = `
import { requireTenant } from "./callee_client.ts";

export function dispatchClient(request: any) {
    const context = {
        userId: request.user?.id || "user-1",
    };
    requireTenant(context);
    return { status: "dispatched", userId: context.userId };
}
`.trim();

    const calleeSource = `
export function requireTenant(context: { tenantId?: string }) {
    if (!context || !context.tenantId) {
        throw new Error("Missing required parameter 'tenantId'");
    }
}
`.trim();

    beforeEach(() => {
        clearRegisteredCommits();
        clearSourceCache();
    });

    it("proves the entire causal source reconstruction and hermetic repair execution chain (§58, §61)", async () => {
        // 1. Register authoritative repository source at exact commit (§7, §8, §14)
        registerAuthoritativeCommit(service, commitSha, {
            [calleeFile]: calleeSource,
            [callerFile]: callerSource,
        });

        // 2. Build deterministic investigation snapshot (§58)
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "inc-level-a-test",
                title: "Error: Missing required parameter 'tenantId'",
                firstSeen: new Date("2026-09-20T10:00:00Z"),
                lastSeen: new Date("2026-09-20T10:05:00Z"),
                eventCount: 3,
                environment: "production",
                service,
            },
            rawEvidence: [
                {
                    id: "ev-level-a-1",
                    type: "ERROR",
                    title: "Error: Missing required parameter 'tenantId'",
                    timestamp: "2026-09-20T10:00:00Z",
                    service,
                    environment: "production",
                    tags: {
                        exceptionType: "Error",
                        message: "Missing required parameter 'tenantId'",
                        stack: `Error: Missing required parameter 'tenantId'\n    at requireTenant (${calleeFile}:3:15)\n    at dispatchClient (${callerFile}:7:5)`,
                    },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    rawFilePath: calleeFile,
                    filePath: calleeFile,
                    lineNumber: 3,
                    functionName: "requireTenant",
                    isInternal: false,
                    isApplication: true,
                    classification: "Application",
                },
                {
                    order: 2,
                    rawFilePath: callerFile,
                    filePath: callerFile,
                    lineNumber: 7,
                    functionName: "dispatchClient",
                    isInternal: false,
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: calleeFile,
                failingLineNumber: 3,
                containingFunction: "requireTenant",
                failingExpression: "requireTenant(context)",
                resolutionStatus: "exact_file",
                gitCommitSha: commitSha,
                lines: [
                    { lineNumber: 1, content: "export function requireTenant(context: { tenantId?: string }) {" },
                    { lineNumber: 2, content: "    if (!context || !context.tenantId) {" },
                    { lineNumber: 3, content: "        throw new Error(\"Missing required parameter 'tenantId'\");" },
                    { lineNumber: 4, content: "    }" },
                    { lineNumber: 5, content: "}" },
                ],
                callers: [callerFile],
            },
        });

        // 3. Generate recommendation via canonical pipeline
        const recResult = await generateEngineeringRecommendation({ snapshot });

        expect(recResult.success).toBe(true);
        const rec = recResult.recommendation;

        // 4. Verify Repair Boundary & Target Location (§25, §26)
        expect(rec.repairLocation?.type).toBe("CALLER");
        expect(rec.changes).toBeDefined();
        expect(rec.changes?.length).toBeGreaterThan(0);

        const change = rec.changes![0];
        expect(change.filePath).toBe(callerFile);
        expect(change.symbol).toBe("dispatchClient");
        expect(change.isExactSourceVerified).toBe(true);
        expect(change.proposedCode).toContain("tenantId:");

        // 5. Execute Complete Verified Repair Proof Chain in Sandbox (§29-§37)
        const chainResult = buildCompleteVerifiedRepairProofChain({
            snapshot,
            changes: rec.changes!,
            candidateId: "cand-level-a-001",
        });

        // 6. Verify Proof Funnel
        expect(chainResult.proofChain.baselineProof?.status).toBe("VERIFIED");
        expect(chainResult.proofChain.patchProof?.status).toBe("VERIFIED");
        expect(chainResult.proofChain.behaviorProof?.status).toBe("VERIFIED");
        expect(chainResult.proofChain.invariantProof?.status).toBe("VERIFIED");
        expect(chainResult.proofChain.regressionProof?.status).toBe("VERIFIED");
        expect(chainResult.proofChain.counterexampleProof?.status).toBe("VERIFIED");

        // 7. Verify Final Recommendation State
        expect(chainResult.gateResult.isVerified).toBe(true);
    });

    it("fails closed when caller source cannot be resolved (§53, §60)", async () => {
        // Do NOT register caller source in repository
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "inc-missing-caller-test",
                title: "Error: Missing required parameter 'tenantId'",
                firstSeen: new Date("2026-09-20T10:00:00Z"),
                lastSeen: new Date("2026-09-20T10:05:00Z"),
                eventCount: 3,
                environment: "production",
                service: "unregistered-service",
            },
            rawEvidence: [
                {
                    id: "ev-missing-1",
                    type: "ERROR",
                    title: "Error: Missing required parameter 'tenantId'",
                    timestamp: "2026-09-20T10:00:00Z",
                    service: "unregistered-service",
                    environment: "production",
                    tags: {
                        exceptionType: "Error",
                        message: "Missing required parameter 'tenantId'",
                        stack: `Error: Missing required parameter 'tenantId'\n    at requireTenant (${calleeFile}:3:15)\n    at dispatchClient (${callerFile}:7:5)`,
                    },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    rawFilePath: calleeFile,
                    filePath: calleeFile,
                    lineNumber: 3,
                    functionName: "requireTenant",
                    isInternal: false,
                    isApplication: true,
                    classification: "Application",
                },
                {
                    order: 2,
                    rawFilePath: callerFile,
                    filePath: callerFile,
                    lineNumber: 7,
                    functionName: "dispatchClient",
                    isInternal: false,
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: calleeFile,
                failingLineNumber: 3,
                containingFunction: "requireTenant",
                lines: [
                    { lineNumber: 1, content: "export function requireTenant(context: { tenantId?: string }) {" },
                    { lineNumber: 2, content: "    if (!context || !context.tenantId) {" },
                    { lineNumber: 3, content: "        throw new Error(\"Missing required parameter 'tenantId'\");" },
                    { lineNumber: 4, content: "    }" },
                    { lineNumber: 5, content: "}" },
                ],
                callers: [callerFile],
            },
        });

        const recResult = await generateEngineeringRecommendation({ snapshot });
        const chainResult = buildCompleteVerifiedRepairProofChain({
            snapshot,
            changes: recResult.recommendation.changes || [],
            candidateId: "cand-missing-caller",
        });

        // Fails closed without caller source
        expect(chainResult.gateResult.isVerified).toBe(false);
    });
});
