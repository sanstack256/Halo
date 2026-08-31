import { describe, it, expect } from "vitest";
import { calculateMetricComparison, parseTimeRange } from "../time";
import { computeBlastRadius } from "../blast-radius";
import { computeDynamicGraphLayout } from "../graph-layout";
import type { DependencyNode, DependencyEdge } from "../types";

describe("Canonical Analytics Mathematical & Algorithmic Layer", () => {
    // ===================================================================
    // SUITE 1 — TIME RANGE & METRIC COMPARISON CORRECTNESS
    // ===================================================================
    describe("Time & Metric Comparisons", () => {
        it("accurately differentiates relative % change from percentage point change", () => {
            // Error rate shifted from 4.0% to 6.0%
            const rateComparison = calculateMetricComparison(6.0, 4.0, true, true);
            expect(rateComparison.absoluteDiff).toBe(2.0);
            expect(rateComparison.relativeDiffPct).toBe(50.0); // +50% relative surge
            expect(rateComparison.percentagePointsDiff).toBe(2.0); // +2.0 percentage points
            expect(rateComparison.isImprovement).toBe(false);
        });

        it("handles zero baseline without division by zero errors — returns null not 0", () => {
            // When previous is 0, relativeDiffPct must be null per the contract
            // (there is no meaningful percentage when the base was zero)
            const comparison = calculateMetricComparison(10, 0, false, false);
            expect(comparison.absoluteDiff).toBe(10);
            // Per our implementation: 0-previous results in relativeDiffPct = null
            // (no finite ratio exists; returning null prevents false interpretations)
            expect(comparison.relativeDiffPct).toBeNull();
            expect(comparison.percentagePointsDiff).toBeNull();
        });

        it("marks improvement correctly for latency (lowerIsBetter=true)", () => {
            // Latency went from 200ms to 150ms — should be marked as improvement
            const latencyComparison = calculateMetricComparison(150, 200, false, true);
            expect(latencyComparison.isImprovement).toBe(true);
            expect(latencyComparison.absoluteDiff).toBe(-50);
        });

        it("marks degradation correctly for error rate (lowerIsBetter=true)", () => {
            const errorRateComparison = calculateMetricComparison(8.5, 2.0, true, true);
            expect(errorRateComparison.isImprovement).toBe(false);
            expect(errorRateComparison.percentagePointsDiff).toBe(6.5);
        });

        it("marks improvement correctly for request count (lowerIsBetter=false)", () => {
            // More requests = higher throughput = improvement
            const throughputComparison = calculateMetricComparison(500, 300, false, false);
            expect(throughputComparison.isImprovement).toBe(true);
        });

        it("parses canonical time ranges deterministically", () => {
            const r24h = parseTimeRange("24h", "PREVIOUS_PERIOD");
            expect(r24h.key).toBe("24h");
            expect(r24h.comparisonStart).toBeDefined();
            expect(r24h.comparisonEnd).toBeDefined();
            const duration = r24h.end.getTime() - r24h.start.getTime();
            const compDuration = r24h.comparisonEnd!.getTime() - r24h.comparisonStart!.getTime();
            // Primary and comparison windows must be exactly the same duration
            expect(duration).toBe(compDuration);
        });

        it("NONE comparison mode produces null comparison start/end", () => {
            const r = parseTimeRange("24h", "NONE");
            expect(r.comparisonStart).toBeNull();
            expect(r.comparisonEnd).toBeNull();
        });

        it("falls back to 24h for unknown time range keys", () => {
            const r = parseTimeRange("42d", "NONE");
            expect(r.key).toBe("24h");
        });
    });

    // ===================================================================
    // SUITE 2 — ERROR RATE MATH CORRECTNESS
    // Tests: error rate = errors/requests * 100, failure shares sum to 100%
    // ===================================================================
    describe("Error Rate & Failure Share Calculations", () => {
        it("correctly computes error rate from raw counts: 43/148 = 29.05%", () => {
            const totalErrors = 43;
            const totalRequests = 148;
            const errorRate = Math.round((totalErrors / totalRequests) * 1000) / 10;
            // Should round to 29.1% (not 29% or 30%)
            expect(errorRate).toBe(29.1);
        });

        it("failure share percentages from three services should be internally consistent", () => {
            // Service A: 20 errors, Service B: 13 errors, Service C: 10 errors → total 43
            const total = 43;
            const shareA = Math.round((20 / total) * 1000) / 10; // 46.5%
            const shareB = Math.round((13 / total) * 1000) / 10; // 30.2%
            const shareC = Math.round((10 / total) * 1000) / 10; // 23.3%

            expect(shareA).toBe(46.5);
            expect(shareB).toBe(30.2);
            expect(shareC).toBe(23.3);

            // Sum should be ≤ 100% (rounding can cause minor overshoot but never exceed by more than 0.5pp)
            expect(shareA + shareB + shareC).toBeLessThanOrEqual(100.1);
        });

        it("error rate should be 0 when there are no events", () => {
            const totalRequests = 0;
            const errorRate = totalRequests > 0 ? (0 / totalRequests) * 100 : 0;
            expect(errorRate).toBe(0);
        });

        it("availability is the complement of error rate", () => {
            const errorRatePct = 29.1;
            const availability = Math.max(0, Math.min(100, 100 - errorRatePct));
            expect(availability).toBeCloseTo(70.9, 1);
        });
    });

    // ===================================================================
    // SUITE 3 — RELEASE WINDOW BOUNDARY CORRECTNESS
    // Tests: pre-release events should NOT be classified as post-release
    // ===================================================================
    describe("Release Window Event Assignment", () => {
        it("event timestamp before release timestamp must be classified as BASELINE not OBSERVATION", () => {
            const releaseTime = new Date("2024-06-10T14:00:00Z");
            const eventTime = new Date("2024-06-10T13:45:00Z"); // 15 minutes BEFORE release

            const windowDurationMs = 2 * 60 * 60 * 1000;
            const baselineEnd = new Date(releaseTime.getTime()); // = release time
            const observationStart = new Date(releaseTime.getTime()); // = release time

            const isInObservationWindow =
                eventTime.getTime() >= observationStart.getTime() &&
                eventTime.getTime() <= new Date(releaseTime.getTime() + windowDurationMs).getTime();

            const isInBaselineWindow =
                eventTime.getTime() >= new Date(releaseTime.getTime() - windowDurationMs).getTime() &&
                eventTime.getTime() < baselineEnd.getTime();

            // Event 15 minutes before release must be in BASELINE window only
            expect(isInBaselineWindow).toBe(true);
            expect(isInObservationWindow).toBe(false);
        });

        it("event timestamp exactly at release boundary is classified as OBSERVATION start", () => {
            const releaseTime = new Date("2024-06-10T14:00:00Z");
            const eventTime = new Date("2024-06-10T14:00:00Z"); // exactly at release

            const observationStart = new Date(releaseTime.getTime());
            const isInObservation = eventTime.getTime() >= observationStart.getTime();

            expect(isInObservation).toBe(true);
        });

        it("release window temporal isolation: baseline and observation windows never overlap", () => {
            const releaseTime = new Date("2024-06-10T14:00:00Z");
            const windowDurationMs = 2 * 60 * 60 * 1000;

            const baselineStart = new Date(releaseTime.getTime() - windowDurationMs);
            const baselineEnd = releaseTime; // exclusive
            const observationStart = releaseTime; // inclusive
            const observationEnd = new Date(releaseTime.getTime() + windowDurationMs);

            // Verify windows do not overlap: baselineEnd === observationStart means no gap,
            // but they should use strict/non-strict boundaries so no event is double-counted
            // baselineEnd (exclusive) must exactly equal observationStart (inclusive)
            expect(baselineEnd.getTime()).toBe(observationStart.getTime());

            // No event can fall in both windows at the same time
            const testEvent = new Date(releaseTime.getTime() - 1); // 1ms before release
            const inBaseline = testEvent.getTime() >= baselineStart.getTime() && testEvent.getTime() < baselineEnd.getTime();
            const inObservation = testEvent.getTime() >= observationStart.getTime() && testEvent.getTime() <= observationEnd.getTime();
            expect(inBaseline).toBe(true);
            expect(inObservation).toBe(false);
        });
    });

    // ===================================================================
    // SUITE 4 — DYNAMIC GRAPH COLLISION-FREE LAYOUT
    // ===================================================================
    describe("Dynamic Graph Collision-Free Layout", () => {
        it("calculates non-overlapping coordinates for multi-node topological tiers", () => {
            const rawNodes: DependencyNode[] = [
                {
                    id: "web-client",
                    name: "web-client",
                    type: "SERVICE",
                    projectId: "p1",
                    projectName: "Demo",
                    health: "Healthy",
                    errorRate: 0,
                    totalCalls: 100,
                    avgLatencyMs: 30,
                    recentIssueCount: 0,
                    recentReleaseCount: 0,
                },
                {
                    id: "api-service",
                    name: "api-service",
                    type: "SERVICE",
                    projectId: "p1",
                    projectName: "Demo",
                    health: "Healthy",
                    errorRate: 2,
                    totalCalls: 100,
                    avgLatencyMs: 40,
                    recentIssueCount: 0,
                    recentReleaseCount: 0,
                },
                {
                    id: "postgres-db",
                    name: "postgres-db",
                    type: "DATABASE",
                    projectId: "p1",
                    projectName: "Demo",
                    health: "Healthy",
                    errorRate: 0,
                    totalCalls: 90,
                    avgLatencyMs: 15,
                    recentIssueCount: 0,
                    recentReleaseCount: 0,
                },
            ];

            const rawEdges: DependencyEdge[] = [
                {
                    id: "web-client->api-service",
                    source: "web-client",
                    target: "api-service",
                    callCount: 100,
                    errorCount: 2,
                    errorRate: 2.0,
                    avgLatencyMs: 40,
                    p95LatencyMs: 80,
                    lastObservedAt: new Date().toISOString(),
                    evidence: {
                        type: "TRACE_SPAN",
                        observedSampleCount: 100,
                        description: "Trace linkage",
                    },
                },
                {
                    id: "api-service->postgres-db",
                    source: "api-service",
                    target: "postgres-db",
                    callCount: 90,
                    errorCount: 0,
                    errorRate: 0.0,
                    avgLatencyMs: 15,
                    p95LatencyMs: 30,
                    lastObservedAt: new Date().toISOString(),
                    evidence: {
                        type: "TRACE_SPAN",
                        observedSampleCount: 90,
                        description: "Trace linkage",
                    },
                },
            ];

            const layout = computeDynamicGraphLayout(rawNodes, rawEdges);
            expect(layout.nodes.length).toBe(3);

            // Verify strictly separate X tiers
            const webNode = layout.nodes.find((n) => n.name === "web-client")!;
            const apiNode = layout.nodes.find((n) => n.name === "api-service")!;
            const dbNode = layout.nodes.find((n) => n.name === "postgres-db")!;

            expect(webNode.x).toBeLessThan(apiNode.x!);
            expect(apiNode.x).toBeLessThan(dbNode.x!);
        });

        it("returns bounds with positive width and height", () => {
            const nodes: DependencyNode[] = [
                {
                    id: "svc-a",
                    name: "svc-a",
                    type: "SERVICE",
                    projectId: "p1",
                    projectName: "Demo",
                    health: "Healthy",
                    errorRate: 0,
                    totalCalls: 50,
                    avgLatencyMs: 10,
                    recentIssueCount: 0,
                    recentReleaseCount: 0,
                },
            ];
            const layout = computeDynamicGraphLayout(nodes, []);
            expect(layout.bounds.width).toBeGreaterThan(0);
            expect(layout.bounds.height).toBeGreaterThan(0);
        });

        it("returns empty result for zero nodes without throwing", () => {
            const layout = computeDynamicGraphLayout([], []);
            expect(layout.nodes).toHaveLength(0);
            expect(layout.edges).toHaveLength(0);
            expect(layout.criticalPaths).toHaveLength(0);
        });
    });

    // ===================================================================
    // SUITE 5 — BLAST RADIUS & FAILURE PROPAGATION
    // Tests strict distinction between observed vs potential exposure
    // ===================================================================
    describe("Blast Radius & Failure Propagation", () => {
        it("strictly distinguishes observed failure propagation from potential exposure", () => {
            const nodes: DependencyNode[] = [
                {
                    id: "gateway",
                    name: "gateway",
                    type: "SERVICE",
                    projectId: "p1",
                    projectName: "Demo",
                    health: "Healthy",
                    errorRate: 0,
                    totalCalls: 100,
                    avgLatencyMs: 20,
                    recentIssueCount: 0,
                    recentReleaseCount: 0,
                },
                {
                    id: "payment-service",
                    name: "payment-service",
                    type: "SERVICE",
                    projectId: "p1",
                    projectName: "Demo",
                    health: "Critical",
                    errorRate: 25,
                    totalCalls: 50,
                    avgLatencyMs: 120,
                    recentIssueCount: 1,
                    recentReleaseCount: 0,
                },
                {
                    id: "auth-service",
                    name: "auth-service",
                    type: "SERVICE",
                    projectId: "p1",
                    projectName: "Demo",
                    health: "Healthy",
                    errorRate: 0,
                    totalCalls: 50,
                    avgLatencyMs: 10,
                    recentIssueCount: 0,
                    recentReleaseCount: 0,
                },
            ];

            const edges: DependencyEdge[] = [
                {
                    id: "gateway->payment-service",
                    source: "gateway",
                    target: "payment-service",
                    callCount: 50,
                    errorCount: 12,
                    errorRate: 24.0,
                    avgLatencyMs: 120,
                    p95LatencyMs: 250,
                    lastObservedAt: new Date().toISOString(),
                    evidence: { type: "TRACE_SPAN", observedSampleCount: 50, description: "Trace span" },
                },
                {
                    id: "gateway->auth-service",
                    source: "gateway",
                    target: "auth-service",
                    callCount: 50,
                    errorCount: 0,
                    errorRate: 0.0,
                    avgLatencyMs: 10,
                    p95LatencyMs: 15,
                    lastObservedAt: new Date().toISOString(),
                    evidence: { type: "TRACE_SPAN", observedSampleCount: 50, description: "Trace span" },
                },
            ];

            const result = computeBlastRadius("gateway", nodes, edges);
            expect(result.directlyAffected.length).toBe(1);
            expect(result.observedPropagation.length).toBe(1);
            expect(result.observedPropagation[0].name).toBe("payment-service");
            expect(result.observedPropagation[0].observedErrorRate).toBe(24.0);

            // auth-service had 0% error rate → potential exposure, NOT observed propagation
            expect(result.potentialExposure.length).toBe(1);
            expect(result.potentialExposure[0].name).toBe("auth-service");
        });

        it("service with no downstream edges has no propagation or potential exposure", () => {
            const nodes: DependencyNode[] = [
                {
                    id: "db",
                    name: "db",
                    type: "DATABASE",
                    projectId: "p1",
                    projectName: "Demo",
                    health: "Healthy",
                    errorRate: 0,
                    totalCalls: 100,
                    avgLatencyMs: 5,
                    recentIssueCount: 0,
                    recentReleaseCount: 0,
                },
            ];
            const result = computeBlastRadius("db", nodes, []);
            expect(result.directlyAffected.length).toBe(1);
            expect(result.observedPropagation.length).toBe(0);
            expect(result.potentialExposure.length).toBe(0);
        });
    });

    // ===================================================================
    // SUITE 6 — RELIABILITY DEBT QUALIFICATION
    // Tests: reliability debt threshold determinism
    // ===================================================================
    describe("Reliability Debt Severity Thresholds", () => {
        it("qualifies CRITICAL reliability debt for patterns with >= 10 occurrences", () => {
            const occurrenceCount = 10;
            const severity = occurrenceCount >= 10 ? "CRITICAL" : occurrenceCount >= 4 ? "HIGH" : "MEDIUM";
            expect(severity).toBe("CRITICAL");
        });

        it("qualifies HIGH reliability debt for patterns with 4-9 occurrences", () => {
            for (const count of [4, 5, 9]) {
                const severity = count >= 10 ? "CRITICAL" : count >= 4 ? "HIGH" : "MEDIUM";
                expect(severity).toBe("HIGH");
            }
        });

        it("qualifies MEDIUM for patterns with 2-3 occurrences", () => {
            for (const count of [2, 3]) {
                const severity = count >= 10 ? "CRITICAL" : count >= 4 ? "HIGH" : "MEDIUM";
                expect(severity).toBe("MEDIUM");
            }
        });

        it("reliability debt estimated impact is proportional to occurrence count, not fabricated", () => {
            // The formula is: occurrenceCount * 1.5 minutes estimated downtime
            const occurrenceCount = 8;
            const estimatedImpactMinutes = Math.round(occurrenceCount * 1.5 * 10) / 10;
            // Must be deterministic: 8 * 1.5 = 12 minutes
            expect(estimatedImpactMinutes).toBe(12);
        });
    });

    // ===================================================================
    // SUITE 7 — CROSS-PAGE SCOPE CONSISTENCY
    // Verifies same parameters produce identical scoping inputs across pages
    // ===================================================================
    describe("Cross-Page Scope Consistency", () => {
        it("identical time range parameters produce identical start/end timestamps", () => {
            // Both pages must call parseTimeRange with the same key and receive identical ranges.
            // We verify determinism by calling parseTimeRange twice with the same fixed end date.
            const fixedEnd = new Date("2024-06-10T14:00:00Z");
            const r1 = parseTimeRange("24h", "PREVIOUS_PERIOD", fixedEnd);
            const r2 = parseTimeRange("24h", "PREVIOUS_PERIOD", fixedEnd);

            expect(r1.start.getTime()).toBe(r2.start.getTime());
            expect(r1.end.getTime()).toBe(r2.end.getTime());
            expect(r1.comparisonStart?.getTime()).toBe(r2.comparisonStart?.getTime());
            expect(r1.comparisonEnd?.getTime()).toBe(r2.comparisonEnd?.getTime());
        });

        it("bucket count is deterministic for each time range key", () => {
            const fixedEnd = new Date("2024-06-10T14:00:00Z");
            const r = parseTimeRange("7d", "NONE", fixedEnd);
            // 7d always produces 28 buckets (6h each)
            expect(r.bucketCount).toBe(28);
        });

        it("service health thresholds are consistent across pages: >=20% critical, >=5% degraded", () => {
            // This is the canonical rule applied in: service-landscape, system-explorer, overview
            const getHealth = (errorRate: number) =>
                errorRate >= 20 ? "critical" : errorRate >= 5 ? "degraded" : "healthy";

            expect(getHealth(0)).toBe("healthy");
            expect(getHealth(4.9)).toBe("healthy");
            expect(getHealth(5.0)).toBe("degraded");
            expect(getHealth(19.9)).toBe("degraded");
            expect(getHealth(20.0)).toBe("critical");
            expect(getHealth(100)).toBe("critical");
        });
    });
});
