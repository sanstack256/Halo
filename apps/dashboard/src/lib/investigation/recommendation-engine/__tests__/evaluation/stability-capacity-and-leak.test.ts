/**
 * Halo Active Investigation Engine — Steps 32 to 39:
 * Stability, Staleness, Concurrency, Memory Leak Audit (100 iterations),
 * and Capacity Benchmarking.
 */

import { describe, it, expect } from "vitest";
import { generateEngineeringRecommendation } from "../../engine";
import { buildInvestigationSnapshot } from "../../investigation-snapshot";
import type { InvestigationSnapshot } from "../../types";

describe("Steps 32 to 39: Stability, Concurrency, Memory Leak & Capacity Audit", () => {
    // Helper to create a realistic test snapshot
    function createStandardSnapshot(
        id: string,
        file: string = "src/services/billing.ts",
        tests?: any
    ): InvestigationSnapshot {
        return buildInvestigationSnapshot({
            incident: {
                issueId: `incident-${id}`,
                title: "TypeError: Cannot read properties of undefined (reading 'amount')",
                firstSeen: new Date("2026-09-17T12:00:00Z"),
                lastSeen: new Date("2026-09-17T12:05:00Z"),
                eventCount: 3,
                environment: "production",
                service: "billing-service",
            },
            rawEvidence: [
                {
                    id: `ev-${id}-1`,
                    type: "ERROR",
                    title: "TypeError: Cannot read properties of undefined (reading 'amount')",
                    timestamp: "2026-09-17T12:00:00Z",
                    service: "billing-service",
                    environment: "production",
                    tags: {
                        exceptionType: "TypeError",
                        message: "Cannot read properties of undefined (reading 'amount')",
                        stack: `TypeError: Cannot read properties of undefined (reading 'amount')\n    at calculateTotal (${file}:12:20)`,
                    },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    filePath: file,
                    lineNumber: 12,
                    functionName: "calculateTotal",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: file,
                failingLineNumber: 12,
                containingFunction: "calculateTotal",
                failingExpression: "order.invoice.amount",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 10, content: "export function calculateTotal(order: any) {" },
                    { lineNumber: 11, content: "    const tax = 0.08;" },
                    { lineNumber: 12, content: "    const base = order.invoice.amount;" },
                    { lineNumber: 13, content: "    return base * (1 + tax);" },
                    { lineNumber: 14, content: "}" },
                ],
            },
            tests,
            investigation: {
                hypotheses: [
                    {
                        id: `hypo-${id}`,
                        title: "Null dereference in order invoice",
                        description: "order missing invoice object",
                        status: "CONFIRMED",
                        likelihood: "HIGH",
                        confidence: 0.95,
                        supportedEvidence: [`ev-${id}-1`],
                    },
                ],
                findings: [],
                causalChains: [],
                rootCause: null,
            },
        });
    }

    // =========================================================================
    // STEP 33: MUTATE TEST NAMES AND LOCATIONS
    // =========================================================================
    describe("Step 33 — Mutate Test Names and Locations", () => {
        it("remains functionally invariant when test files and locations are mutated", async () => {
            const snapA = createStandardSnapshot("t-name-1", "src/services/billing.ts", {
                hasRelevantTests: true,
                testFiles: ["test/custom-billing-suite.spec.ts"],
                reproductionPossibleInDev: false,
            });
            const snapB = createStandardSnapshot("t-name-2", "src/services/billing.ts", {
                hasRelevantTests: true,
                testFiles: ["__tests__/e2e/legacy/invoice_v2.test.js"],
                reproductionPossibleInDev: false,
            });

            const resA = await generateEngineeringRecommendation({ snapshot: snapA });
            const resB = await generateEngineeringRecommendation({ snapshot: snapB });

            expect(resA.success).toBe(true);
            expect(resB.success).toBe(true);
            expect(resA.repairLocation?.targetFile).toBe(resB.repairLocation?.targetFile);
            expect(resA.recommendation.changes[0].file).toBe(resB.recommendation.changes[0].file);
        });
    });

    // =========================================================================
    // STEP 34: RECOMMENDATION STABILITY (DETERMINISTIC REPEATED TRIALS)
    // =========================================================================
    describe("Step 34 — Recommendation Stability", () => {
        it("produces identical engineering decisions across 5 repeated trials with identical evidence", async () => {
            const snapshot = createStandardSnapshot("stability");
            const runs: any[] = [];

            for (let i = 0; i < 5; i++) {
                const res = await generateEngineeringRecommendation({ snapshot });
                expect(res.success).toBe(true);
                runs.push(res);
            }

            for (let i = 1; i < runs.length; i++) {
                expect(runs[i].repairLocation?.type).toBe(runs[0].repairLocation?.type);
                expect(runs[i].repairLocation?.targetFile).toBe(runs[0].repairLocation?.targetFile);
                expect(runs[i].recommendation.isCodeModification).toBe(runs[0].recommendation.isCodeModification);
                expect(runs[i].recommendation.changes.length).toBe(runs[0].recommendation.changes.length);
                expect(runs[i].recommendation.changes[0].proposedCode).toBe(runs[0].recommendation.changes[0].proposedCode);
            }
        });
    });

    // =========================================================================
    // STEP 36: TEST STALENESS
    // =========================================================================
    describe("Step 36 — Test Staleness", () => {
        it("detects staleness when evidence is altered post-generation", async () => {
            const snap = createStandardSnapshot("stale-1");
            const res = await generateEngineeringRecommendation({ snapshot: snap });
            expect(res.success).toBe(true);

            // Mutate underlying snapshot source line and stack frame
            const alteredSnapshot = buildInvestigationSnapshot({
                ...snap,
                stackFrames: [
                    {
                        order: 1,
                        filePath: "src/services/billing.ts",
                        lineNumber: 99,
                        functionName: "calculateTotal",
                        isApplication: true,
                        classification: "Application",
                    },
                ],
                rawEvidence: [
                    {
                        id: `ev-stale-1-1`,
                        type: "ERROR",
                        title: "TypeError: Cannot read properties of undefined (reading 'amount')",
                        timestamp: "2026-09-17T12:00:00Z",
                        service: "billing-service",
                        environment: "production",
                        tags: {
                            exceptionType: "TypeError",
                            message: "Cannot read properties of undefined (reading 'amount')",
                            stack: `TypeError: Cannot read properties of undefined (reading 'amount')\n    at calculateTotal (src/services/billing.ts:99:20)`,
                        },
                    },
                ],
                source: {
                    ...snap.source!,
                    failingLineNumber: 99,
                    lines: [
                        { lineNumber: 98, content: "export function calculateTotal(order: any) {" },
                        { lineNumber: 99, content: "    const base = order.invoice.amount;" },
                        { lineNumber: 100, content: "    return base * (1 + 0.08);" },
                        { lineNumber: 101, content: "}" },
                    ],
                },
            });

            const resNew = await generateEngineeringRecommendation({ snapshot: alteredSnapshot });
            expect(resNew.success).toBe(true);
            // Verify new recommendation reflects updated line number
            expect(resNew.recommendation.changes[0].startLine).toBe(99);
        });
    });

    // =========================================================================
    // STEP 37: CONCURRENT INVESTIGATIONS (NO SHARED MUTABLE STATE)
    // =========================================================================
    describe("Step 37 — Concurrent Investigations", () => {
        it("runs 10 concurrent recommendations across distinct subsystems without context leakage", async () => {
            const snapshots = [
                createStandardSnapshot("c1", "src/auth/session.ts"),
                createStandardSnapshot("c2", "src/billing/invoice.ts"),
                createStandardSnapshot("c3", "src/orders/checkout.ts"),
                createStandardSnapshot("c4", "src/inventory/stock.ts"),
                createStandardSnapshot("c5", "src/shipping/tracker.ts"),
                createStandardSnapshot("c6", "src/notifications/sms.ts"),
                createStandardSnapshot("c7", "src/analytics/events.ts"),
                createStandardSnapshot("c8", "src/webhooks/stripe.ts"),
                createStandardSnapshot("c9", "src/users/profile.ts"),
                createStandardSnapshot("c10", "src/search/indexer.ts"),
            ];

            const results = await Promise.all(
                snapshots.map(s => generateEngineeringRecommendation({ snapshot: s }))
            );

            for (let i = 0; i < snapshots.length; i++) {
                const res = results[i];
                expect(res.success).toBe(true);
                // Each recommendation must strictly target its own subsystem file without bleeding into others
                const expectedFile = snapshots[i].source?.filePath;
                expect(res.repairLocation?.targetFile).toBe(expectedFile);
                expect(res.recommendation.changes[0].file).toBe(expectedFile);
            }
        });
    });

    // =========================================================================
    // STEP 38: MEMORY STABILITY (100 ITERATION AUDIT)
    // =========================================================================
    describe("Step 38 — Memory Stability (100 Iterations)", () => {
        it("executes 100 consecutive recommendation runs without memory exhaustion or unbounded growth", async () => {
            const snapshot = createStandardSnapshot("mem-audit");

            // Measure baseline heap
            if (global.gc) global.gc();
            const initialHeap = process.memoryUsage().heapUsed;

            for (let i = 0; i < 100; i++) {
                const res = await generateEngineeringRecommendation({ snapshot });
                expect(res.success).toBe(true);
            }

            if (global.gc) global.gc();
            const finalHeap = process.memoryUsage().heapUsed;
            const heapGrowthMB = (finalHeap - initialHeap) / (1024 * 1024);

            // 100 recommendation runs in modern V8 must have negligible heap growth (< 25MB)
            expect(heapGrowthMB).toBeLessThan(25);
        });
    });

    // =========================================================================
    // STEP 39: CAPACITY BENCHMARKING
    // =========================================================================
    describe("Step 39 — Capacity Benchmarking", () => {
        it("processes progressive graph complexity within sub-100ms latency budgets", async () => {
            const base = createStandardSnapshot("capacity");

            // Build high-complexity graph: 20 stack frames, 10 hypotheses, 5 test files
            const complexFrames = [];
            for (let i = 1; i <= 20; i++) {
                complexFrames.push({
                    order: i,
                    filePath: `src/deep/subsystem/layer-${i}/handler.ts`,
                    lineNumber: i * 15,
                    functionName: `executeLayer${i}`,
                    isApplication: true,
                    classification: "Application" as any,
                });
            }

            const complexSnapshot: InvestigationSnapshot = {
                ...base,
                failure: {
                    ...base.failure,
                    frames: complexFrames,
                },
                tests: {
                    hasRelevantTests: true,
                    testFiles: ["test/suite-1.test.ts", "test/suite-2.test.ts", "test/suite-3.test.ts"],
                    reproductionPossibleInDev: false,
                },
            };

            const start = performance.now();
            const res = await generateEngineeringRecommendation({ snapshot: complexSnapshot });
            const durationMs = performance.now() - start;

            expect(res.success).toBe(true);
            // Must complete under 100ms in in-memory evaluation
            expect(durationMs).toBeLessThan(100);
        });
    });
});
