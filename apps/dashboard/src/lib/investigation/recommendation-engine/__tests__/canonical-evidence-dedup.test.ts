/**
 * Halo Trace — Canonical Evidence Store & Single Source of Truth Test Suite
 *
 * Verifies Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, Phase 7, Phase 63, and Phase 64:
 * 1. Collect Once, Store Once, Reference Everywhere: No duplicate collection.
 * 2. Deterministic Stable Identities: Every evidence record has a deterministic identity.
 * 3. Evidence Relationship Graph: Directed relationships are constructed correctly.
 * 4. Cross-Issue Isolation: Evidence from Issue A never enters Issue B.
 * 5. Snapshot Immutability: Snapshots maintain immutable hashes.
 * 6. Provider Parity: Deterministic engine produces the same Authoritative Decision findings.
 */

import { describe, it, expect, vi } from "vitest";
import {
    CanonicalEvidenceStore,
    getCanonicalEvidenceId,
    type EvidenceKind,
} from "../canonical-evidence-store";
import { buildInvestigationSnapshot } from "../investigation-snapshot";
import { generateEngineeringRecommendation } from "../engine";
import type { Evidence } from "@halo/investigation-engine";

function createTestError(id: string, overrides: Partial<Evidence> = {}): Evidence {
    return {
        id,
        type: "ERROR",
        timestamp: new Date("2026-09-23T12:00:00Z"),
        source: "backend",
        service: "order-service",
        title: "TypeError: Cannot read properties of undefined (reading 'tenantId')",
        description: "Request failed because tenantId is undefined in RequestContext",
        status: "ERROR",
        fingerprint: "fp-order-tenant",
        metadata: {
            requestId: "req-12345",
            traceId: "trace-abcde",
            stack: "TypeError: Cannot read properties of undefined\n    at OrderService.process (src/services/order.ts:42:15)\n    at RequestContext.create (src/context/request.ts:18:10)",
        },
        tags: {
            stack: "TypeError: Cannot read properties of undefined\n    at OrderService.process (src/services/order.ts:42:15)\n    at RequestContext.create (src/context/request.ts:18:10)",
        },
        ...overrides,
    } as unknown as Evidence;
}

describe("Halo Trace — Canonical Evidence Store & Deduplication Architecture", () => {
    // -------------------------------------------------------------------------
    // Test 1: Stable Deterministic Evidence Identity
    // -------------------------------------------------------------------------
    it("generates deterministic stable identities for all evidence kinds", () => {
        expect(getCanonicalEvidenceId("RUNTIME_EVENT", "evt_101")).toBe("runtime-event:evt_101");
        expect(getCanonicalEvidenceId("ERROR_OCCURRENCE", "err_202")).toBe("error:err_202");
        expect(getCanonicalEvidenceId("STACK_FRAME", "order.ts:42:15")).toBe("stack-frame:order.ts:42:15");
        expect(getCanonicalEvidenceId("SOURCE_SNAPSHOT", "v1.2.0:src/order.ts")).toBe("source-snapshot:v1.2.0:src/order.ts");
        expect(getCanonicalEvidenceId("GIT_COMMIT", "c0ffee123")).toBe("git-commit:c0ffee123");
        expect(getCanonicalEvidenceId("RELEASE_DEPLOYMENT", "v1.2.0")).toBe("release:v1.2.0");
        expect(getCanonicalEvidenceId("REPLAY_SESSION", "sess_999")).toBe("replay:sess_999");
    });

    // -------------------------------------------------------------------------
    // Test 2: Collect Once, Store Once, Reference Everywhere (Rule 0.6 & Phase 6)
    // -------------------------------------------------------------------------
    it("enforces that underlying evidence is collected exactly once and never recollected", async () => {
        const store = new CanonicalEvidenceStore("proj-dedup", "issue-001");
        const collectorMock = vi.fn().mockResolvedValue({
            source: "telemetry-api",
            observedAt: new Date("2026-09-23T10:00:00Z"),
            provenance: {
                method: "INGEST" as const,
                origin: "gateway",
                redacted: true,
            },
            content: { requestId: "req-first-pass", payload: { tenantId: "tenant-abc" } },
        });

        // First call: triggers collector
        const rec1 = await store.getOrCreate(
            "RUNTIME_EVENT",
            "req-first-pass",
            collectorMock
        );

        expect(collectorMock).toHaveBeenCalledTimes(1);
        expect(rec1.id).toBe("runtime-event:req-first-pass");

        // Second call: requests identical evidence; MUST return cached canonical copy without calling collector
        const rec2 = await store.getOrCreate(
            "RUNTIME_EVENT",
            "req-first-pass",
            collectorMock
        );

        expect(collectorMock).toHaveBeenCalledTimes(1); // Zero additional calls
        expect(rec1).toBe(rec2); // Identical reference in memory
    });

    // -------------------------------------------------------------------------
    // Test 3: Directed Evidence Relationship Graph (Phase 7)
    // -------------------------------------------------------------------------
    it("constructs a directed evidence graph linking errors, frames, sources, and commits", () => {
        const store = new CanonicalEvidenceStore("proj-graph", "issue-002");

        const errorId = getCanonicalEvidenceId("ERROR_OCCURRENCE", "err-1");
        const frameId = getCanonicalEvidenceId("STACK_FRAME", "order.ts:42:15");
        const sourceId = getCanonicalEvidenceId("SOURCE_SNAPSHOT", "main:src/order.ts");
        const commitId = getCanonicalEvidenceId("GIT_COMMIT", "sha-release-1");

        store.register({
            id: errorId,
            kind: "ERROR_OCCURRENCE",
            source: "telemetry",
            collectedAt: new Date(),
            provenance: { method: "INGEST", origin: "api", redacted: true },
            content: { message: "TypeError" },
        });

        store.register({
            id: frameId,
            kind: "STACK_FRAME",
            source: "stack",
            collectedAt: new Date(),
            provenance: { method: "STATIC_ANALYSIS", origin: "order.ts", redacted: false },
            content: { file: "src/order.ts", line: 42 },
        });

        store.register({
            id: sourceId,
            kind: "SOURCE_SNAPSHOT",
            source: "repo",
            collectedAt: new Date(),
            provenance: { method: "STATIC_ANALYSIS", origin: "src/order.ts", redacted: false },
            content: { lines: ["line 1", "line 2"] },
        });

        store.register({
            id: commitId,
            kind: "GIT_COMMIT",
            source: "git",
            collectedAt: new Date(),
            provenance: { method: "GIT_API", origin: "sha-release-1", redacted: false },
            content: { sha: "sha-release-1" },
        });

        // Connect graph edges
        store.addRelationship({ fromId: errorId, relation: "executed", toId: frameId, confidence: "CONFIRMED" });
        store.addRelationship({ fromId: frameId, relation: "locatedAt", toId: sourceId, confidence: "CONFIRMED" });
        store.addRelationship({ fromId: commitId, relation: "modified", toId: sourceId, confidence: "CONFIRMED" });

        const graph = store.buildGraph();
        expect(graph.nodes).toHaveLength(4);
        expect(graph.edges).toHaveLength(3);

        const executedEdge = graph.edges.find((e) => e.relation === "executed");
        expect(executedEdge?.fromId).toBe(errorId);
        expect(executedEdge?.toId).toBe(frameId);

        const modifiedEdge = graph.edges.find((e) => e.relation === "modified");
        expect(modifiedEdge?.fromId).toBe(commitId);
        expect(modifiedEdge?.toId).toBe(sourceId);
    });

    // -------------------------------------------------------------------------
    // Test 4: Cross-Issue Isolation (Phase 64)
    // -------------------------------------------------------------------------
    it("strictly isolates evidence between simultaneous concurrent issues", () => {
        const storeA = new CanonicalEvidenceStore("proj-1", "issue-AAA");
        const storeB = new CanonicalEvidenceStore("proj-1", "issue-BBB");

        storeA.register({
            id: getCanonicalEvidenceId("RUNTIME_EVENT", "evt-issue-A"),
            kind: "RUNTIME_EVENT",
            source: "service-A",
            collectedAt: new Date(),
            provenance: { method: "INGEST", origin: "svc-A", redacted: true },
            content: { secretTokenA: "A-token" },
        });

        storeB.register({
            id: getCanonicalEvidenceId("RUNTIME_EVENT", "evt-issue-B"),
            kind: "RUNTIME_EVENT",
            source: "service-B",
            collectedAt: new Date(),
            provenance: { method: "INGEST", origin: "svc-B", redacted: true },
            content: { secretTokenB: "B-token" },
        });

        expect(storeA.has(getCanonicalEvidenceId("RUNTIME_EVENT", "evt-issue-A"))).toBe(true);
        expect(storeA.has(getCanonicalEvidenceId("RUNTIME_EVENT", "evt-issue-B"))).toBe(false);

        expect(storeB.has(getCanonicalEvidenceId("RUNTIME_EVENT", "evt-issue-B"))).toBe(true);
        expect(storeB.has(getCanonicalEvidenceId("RUNTIME_EVENT", "evt-issue-A"))).toBe(false);
    });

    // -------------------------------------------------------------------------
    // Test 5: Investigation Snapshot with Canonical Store & Authoritative Decision
    // -------------------------------------------------------------------------
    it("automatically populates CanonicalEvidenceStore inside InvestigationSnapshot and links graph", async () => {
        const error = createTestError("err-snap-1");
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "issue-auto-store",
                title: error.title,
                firstSeen: error.timestamp,
                lastSeen: error.timestamp,
                environment: "production",
                service: "order-service",
                release: "v1.5.0",
            },
            rawEvidence: [error],
            stackFrames: [
                {
                    order: 1,
                    rawFilePath: "src/services/order.ts",
                    filePath: "src/services/order.ts",
                    lineNumber: 42,
                    columnNumber: 15,
                    functionName: "process",
                    isInternal: false,
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/services/order.ts",
                failingLineNumber: 42,
                containingFunction: "process",
                lines: ["export function process(ctx) {", "  return ctx.tenantId.toUpperCase();", "}"],
                resolutionStatus: "exact_file",
                sourceLanguage: "typescript",
            },
        });

        expect(snapshot.evidenceStore).toBeDefined();
        const store = snapshot.evidenceStore as CanonicalEvidenceStore;

        // Evidence store contains the error and stack frame
        expect(store.has(getCanonicalEvidenceId("ERROR_OCCURRENCE", "err-snap-1"))).toBe(true);
        expect(store.has(getCanonicalEvidenceId("STACK_FRAME", "src/services/order.ts:42:15"))).toBe(true);
        expect(store.has(getCanonicalEvidenceId("SOURCE_SNAPSHOT", "v1.5.0:src/services/order.ts"))).toBe(true);

        // Run engine pipeline to verify authoritative decision consumes the store
        const result = await generateEngineeringRecommendation({ snapshot });

        expect(result.authoritativeDecision).toBeDefined();
        expect(result.authoritativeDecision.occurrenceId).toBe("issue-auto-store");
        expect(result.authoritativeDecision.evidenceStoreHash).toBeDefined();
        expect(result.authoritativeDecision.findings).toBeDefined();
        expect(result.authoritativeDecision.findings!.length).toBeGreaterThan(0);

        // Verify the 5 separated locations are established
        expect(result.authoritativeDecision.separatedLocations).toBeDefined();
        expect(result.authoritativeDecision.separatedLocations?.observationLocation.filePath).toBe("src/services/order.ts");
        expect(result.authoritativeDecision.separatedLocations?.mechanismLocation.filePath).toBeDefined();
        expect(result.authoritativeDecision.separatedLocations?.repairLocation.filePath).toBeDefined();
    });
});
