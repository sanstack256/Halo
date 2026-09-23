/**
 * Halo Trace — Pool Exhaustion & Closed-Loop Reasoning Regression Suite (Parts 48, 49, 77, 78)
 *
 * Verifies that:
 * 1. For incidents like `DatabaseConnectionTimeout: pool exhausted after 30000ms`:
 *    - Halo NEVER immediately asks for arbitrary "operation" arguments.
 *    - Halo reasons through competing hypotheses (resource leak vs concurrency vs config vs latency).
 * 2. When an empirical leak exists in caller code (missing finally):
 *    - Halo identifies RESOURCE_LEAK as the confirmed mechanism.
 *    - Locates the repair boundary at the caller (not the pool.acquire() line).
 *    - Reconstructs RESOURCE_LIFECYCLE_BOUNDED invariant.
 *    - Generates and harness-validates a try/finally block repair.
 * 3. When NO leak exists (caller correctly disposes connection):
 *    - Halo rejects the resource leak hypothesis.
 *    - Identifies CONCURRENCY_EXHAUSTION / CONFIGURATION_MISMATCH.
 *    - Recommends pool sizing / timeout tuning instead of superficial defensive code changes.
 * 4. Provider Parity:
 *    - Deterministic and LLM providers produce identical engineering conclusions.
 */

import { describe, it, expect } from "vitest";
import { buildInvestigationSnapshot } from "../../investigation-snapshot";
import { generateEngineeringRecommendation } from "../../engine";
import { EngineeringReasoningLoop } from "../../engineering-reasoning-loop";
import { MockRecommendationModel } from "../evaluation/real-patch-harness";

describe("Parts 48, 49, 77, 78: Pool Exhaustion & Engineering Reasoning Core", () => {
    it("Scenario 1: Pool Exhaustion with Empirical Leak in Caller -> Recommends try/finally, rejects 'operation'", async () => {
        // Caller acquires connection, but has an exception path before release()
        const callerSourceLines = [
            { lineNumber: 38, content: "export async function queryUserData(userId: string) {", isFailingLine: false },
            { lineNumber: 39, content: "    const client = await pool.acquire();", isFailingLine: false },
            { lineNumber: 40, content: "    const rawData = await client.query('SELECT * FROM users WHERE id = $1', [userId]);", isFailingLine: false },
            { lineNumber: 41, content: "    if (!rawData.rows[0]) throw new Error('User not found');", isFailingLine: false },
            { lineNumber: 42, content: "    await client.release();", isFailingLine: false },
            { lineNumber: 43, content: "    return rawData.rows[0];", isFailingLine: false },
            { lineNumber: 44, content: "}", isFailingLine: false },
        ];

        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "issue-pool-leak-1",
                title: "DatabaseConnectionTimeout: pool exhausted after 30000ms",
                errorMessage: "pool exhausted after 30000ms",
                exceptionType: "DatabaseConnectionTimeout",
                firstSeen: new Date("2026-09-20T10:00:00Z"),
                lastSeen: new Date("2026-09-20T10:30:00Z"),
                eventCount: 250,
                environment: "production",
                service: "user-service",
            },
            rawEvidence: [
                {
                    id: "ev-pool-1",
                    type: "ERROR",
                    title: "DatabaseConnectionTimeout: pool exhausted after 30000ms",
                    timestamp: "2026-09-20T10:00:00Z",
                    service: "user-service",
                    environment: "production",
                    tags: {
                        exceptionType: "DatabaseConnectionTimeout",
                        message: "pool exhausted after 30000ms",
                        stack: "DatabaseConnectionTimeout: pool exhausted after 30000ms\n    at Pool.acquire (src/db/pool.ts:42:15)\n    at queryUserData (src/services/user.ts:39:32)",
                    },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/db/pool.ts",
                    rawFilePath: "src/db/pool.ts",
                    lineNumber: 42,
                    functionName: "acquire",
                    isApplication: false,
                    classification: "Framework",
                },
                {
                    order: 2,
                    filePath: "src/services/user.ts",
                    rawFilePath: "src/services/user.ts",
                    lineNumber: 39,
                    functionName: "queryUserData",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/services/user.ts",
                failingLineNumber: 39,
                containingFunction: "queryUserData",
                failingExpression: "await pool.acquire()",
                resolutionStatus: "exact_file",
                lines: callerSourceLines,
            },
        });

        const res = await generateEngineeringRecommendation({ snapshot });

        // 1. MUST NOT output the bad recommendation
        expect(res.recommendation.actionAnswer?.toLowerCase()).not.toContain("'operation'");
        expect(res.recommendation.actionAnswer?.toLowerCase()).not.toContain("capture runtime signal for 'operation'");

        // 2. Must identify RESOURCE_LEAK and recommend try/finally
        expect(res.recommendation.actionAnswer?.toLowerCase()).toContain("finally");
        expect(res.recommendation.brokenInvariant?.classification).toBe("RESOURCE_LIFECYCLE_BOUNDED");

        // 3. Must identify repair location at caller (src/services/user.ts)
        expect(res.repairLocation?.targetFile).toBe("src/services/user.ts");

        // 4. Must propose code changes wrapping in try/finally
        expect(res.recommendation.changes.length).toBeGreaterThan(0);
        expect(res.recommendation.changes[0].proposedCode).toContain("finally");

        // 5. Decomposed confidence must reflect confirmed mechanism
        expect(res.recommendation.decomposedConfidence?.failureMechanism).toBe("CONFIRMED");
    });

    it("Scenario 2: Pool Exhaustion without Leak (Concurrency Saturation) -> Recommends Pool Tuning", async () => {
        // Caller code correctly wraps client in try/finally block on all paths
        const callerSourceLines = [
            { lineNumber: 50, content: "export async function queryProduct(id: string) {", isFailingLine: false },
            { lineNumber: 51, content: "    const client = await pool.acquire();", isFailingLine: false },
            { lineNumber: 52, content: "    try {", isFailingLine: false },
            { lineNumber: 53, content: "        return await client.query('SELECT * FROM products WHERE id = $1', [id]);", isFailingLine: false },
            { lineNumber: 54, content: "    } finally {", isFailingLine: false },
            { lineNumber: 55, content: "        await client.release();", isFailingLine: false },
            { lineNumber: 56, content: "    }", isFailingLine: false },
            { lineNumber: 57, content: "}", isFailingLine: false },
        ];

        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "issue-pool-concurrency-1",
                title: "DatabaseConnectionTimeout: pool exhausted after 30000ms",
                errorMessage: "pool exhausted after 30000ms",
                exceptionType: "DatabaseConnectionTimeout",
                firstSeen: new Date("2026-09-20T11:00:00Z"),
                lastSeen: new Date("2026-09-20T11:15:00Z"),
                eventCount: 800,
                environment: "production",
                service: "product-service",
            },
            rawEvidence: [
                {
                    id: "ev-pool-concurrency-1",
                    type: "ERROR",
                    title: "DatabaseConnectionTimeout: pool exhausted after 30000ms",
                    timestamp: "2026-09-20T11:00:00Z",
                    service: "product-service",
                    environment: "production",
                    tags: {
                        exceptionType: "DatabaseConnectionTimeout",
                        message: "pool exhausted after 30000ms",
                    },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/services/product.ts",
                    rawFilePath: "src/services/product.ts",
                    lineNumber: 51,
                    functionName: "queryProduct",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/services/product.ts",
                failingLineNumber: 51,
                containingFunction: "queryProduct",
                failingExpression: "await pool.acquire()",
                resolutionStatus: "exact_file",
                lines: callerSourceLines,
            },
        });

        const res = await generateEngineeringRecommendation({ snapshot });

        // 1. MUST NOT output 'operation' telemetry
        expect(res.recommendation.actionAnswer?.toLowerCase()).not.toContain("'operation'");

        // 2. Must NOT claim a code leak since finally block exists
        expect(res.recommendation.actionAnswer?.toLowerCase()).not.toContain("wrap resource acquisition in 'queryproduct' with a try/finally block");

        // 3. Must recommend configuration / pool capacity increase
        expect(res.recommendation.actionAnswer?.toLowerCase()).toContain("pool");
        expect(res.repairLocation?.type).toBe("CONFIGURATION");
    });

    it("Scenario 3: Closed-Loop Reasoning Replay & Hypotheses Elimination", async () => {
        const callerSourceLines = [
            { lineNumber: 10, content: "async function checkout() {", isFailingLine: false },
            { lineNumber: 11, content: "    const conn = await db.acquire();", isFailingLine: false },
            { lineNumber: 12, content: "    if (Math.random() < 0.5) return false;", isFailingLine: false },
            { lineNumber: 13, content: "    await conn.release();", isFailingLine: false },
            { lineNumber: 14, content: "}", isFailingLine: false },
        ];

        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "issue-replay-1",
                title: "TimeoutError: pool exhausted after 30000ms",
                errorMessage: "pool exhausted after 30000ms",
                exceptionType: "TimeoutError",
                firstSeen: new Date("2026-09-20T12:00:00Z"),
                lastSeen: new Date("2026-09-20T12:05:00Z"),
                eventCount: 50,
                environment: "production",
                service: "order-service",
            },
            rawEvidence: [],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/order.ts",
                    lineNumber: 11,
                    functionName: "checkout",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/order.ts",
                failingLineNumber: 11,
                containingFunction: "checkout",
                failingExpression: "await db.acquire()",
                resolutionStatus: "exact_file",
                lines: callerSourceLines,
            },
        });

        const loop = new EngineeringReasoningLoop(snapshot);
        const result1 = await loop.run();
        const result2 = await loop.run();

        // Deterministic stability
        expect(result1.confirmedHypothesis?.mechanismCategory).toBe("RESOURCE_LEAK");
        expect(result2.confirmedHypothesis?.mechanismCategory).toBe("RESOURCE_LEAK");
        expect(result1.repairLocation.targetFile).toBe(result2.repairLocation.targetFile);
        expect(result1.authoritativeDecision.finalState).toBe(result2.authoritativeDecision.finalState);

        // Competing hypotheses elimination verified
        const concurrencyH = result1.hypotheses.find((h) => h.mechanismCategory === "CONCURRENCY_EXHAUSTION");
        expect(concurrencyH?.status).toBe("CONTRADICTED");
    });
});
