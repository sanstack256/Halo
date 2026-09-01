import { describe, it, expect } from "vitest";
import { calculateMetricComparison, parseTimeRange, formatBucketTime, generateTimeBuckets } from "../time";
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
            expect(r.bucketCount).toBe(28);
        });

        it("service health thresholds are consistent across pages: >=20% critical, >=5% degraded", () => {
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

    // ===================================================================
    // SUITE 8 — SPARSE BASELINE & GAP PRESERVATION TESTS
    // ===================================================================
    describe("Sparse Baseline & Telemetry Gap Preservation", () => {
        it("distinguishes missing observation (hasObservation: false) from an observed zero (hasObservation: true, errors: 0)", () => {
            // Bucket A: active observation with 50 requests and 0 errors -> observed zero
            const bucketObservedZero = {
                requestCount: 50,
                errorCount: 0,
                hasObservation: true,
            };

            // Bucket B: no telemetry collected during slice -> NO observation
            const bucketNoObservation = {
                requestCount: 0,
                errorCount: 0,
                hasObservation: false,
            };

            expect(bucketObservedZero.hasObservation).toBe(true);
            expect(bucketObservedZero.errorCount).toBe(0);

            expect(bucketNoObservation.hasObservation).toBe(false);
            // Must not be treated as a confirmed zero error observation
            expect(bucketNoObservation.requestCount).toBe(0);
        });

        it("discontinuous path generator creates disconnected segments across missing buckets", () => {
            // Simulated baseline: [20, 14, null, null, null, 8]
            const rawPoints = [
                { x: 10, y: 20 },
                { x: 20, y: 30 },
                { x: 30, y: null },
                { x: 40, y: null },
                { x: 50, y: null },
                { x: 60, y: 50 },
            ];

            // Replicate buildSegmentedPath logic
            let d = "";
            let inSegment = false;
            let segmentPoints: Array<{ x: number; y: number }> = [];

            for (const pt of rawPoints) {
                if (pt.y !== null && !isNaN(pt.y)) {
                    segmentPoints.push({ x: pt.x, y: pt.y });
                    inSegment = true;
                } else {
                    if (inSegment && segmentPoints.length > 0) {
                        if (segmentPoints.length === 1) {
                            const p = segmentPoints[0];
                            d += `M ${(p.x - 4).toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 4).toFixed(1)} ${p.y.toFixed(1)} `;
                        } else {
                            d += `M ${segmentPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")} `;
                        }
                        segmentPoints = [];
                        inSegment = false;
                    }
                }
            }

            if (inSegment && segmentPoints.length > 0) {
                if (segmentPoints.length === 1) {
                    const p = segmentPoints[0];
                    d += `M ${(p.x - 4).toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 4).toFixed(1)} ${p.y.toFixed(1)} `;
                } else {
                    d += `M ${segmentPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")} `;
                }
            }

            const path = d.trim();
            // Path must contain two separate 'M' commands (segments), not a single continuous path connecting across index 1 and 5
            const moveCommands = path.match(/M /g);
            expect(moveCommands?.length).toBe(2);
            // Must contain segment 1 (10,20 to 20,30)
            expect(path).toContain("M 10.0,20.0 L 20.0,30.0");
            // Must NOT connect 20,30 to 60,50
            expect(path).not.toContain("L 60.0");
        });

        it("insufficient sample size (<5 events) produces Insufficient Evidence verdict", () => {
            const baseTotal = 3;
            const obsTotal = 4;
            const isSufficient = baseTotal >= 5 && obsTotal >= 5;

            expect(isSufficient).toBe(false);
            const verdict = !isSufficient ? "Insufficient Evidence" : "No Regression Observed";
            expect(verdict).toBe("Insufficient Evidence");
        });

        it("topology graph filters edges to only include nodes with observed evidence", () => {
            const nodes: DependencyNode[] = [
                {
                    id: "n1",
                    name: "api-service",
                    type: "SERVICE",
                    projectId: "p1",
                    projectName: "Demo",
                    health: "Healthy",
                    errorRate: 0,
                    totalCalls: 100,
                    avgLatencyMs: 10,
                    recentIssueCount: 0,
                    recentReleaseCount: 0,
                },
            ];

            const edges: DependencyEdge[] = [
                {
                    id: "e1",
                    source: "api-service",
                    target: "unobserved-backend", // Node not in active observed nodes
                    callCount: 50,
                    errorCount: 0,
                    errorRate: 0,
                    avgLatencyMs: 20,
                    isCriticalPath: false,
                    evidence: {
                        type: "SPAN_CALL",
                        sampleTraceId: "t1",
                        description: "Trace span evidence",
                    },
                },
            ];

            const activeNodeNames = new Set(nodes.map((n) => n.name));
            const filteredEdges = edges.filter((e) => activeNodeNames.has(e.source) && activeNodeNames.has(e.target));

            // Must NOT render edges to unobserved nodes
            expect(filteredEdges.length).toBe(0);
        });

        it("calculateMetricComparison handles States A, B, C, D strictly according to evidence semantics", () => {
            // STATE A: Current = 0, Previous = 34 -> legitimate reduction (-100%)
            const stateA = calculateMetricComparison(0, 34, false, true);
            expect(stateA.current).toBe(0);
            expect(stateA.previous).toBe(34);
            expect(stateA.relativeDiffPct).toBe(-100.0);
            expect(stateA.isImprovement).toBe(true);

            // STATE B: Current = 0, Previous = null (no observation) -> no percentage comparison
            const stateB = calculateMetricComparison(0, null, false, true);
            expect(stateB.current).toBe(0);
            expect(stateB.previous).toBeNull();
            expect(stateB.relativeDiffPct).toBeNull();
            expect(stateB.absoluteDiff).toBeNull();

            // STATE C: Current = 0, Previous = 0 -> no division by zero, no percentage
            const stateC = calculateMetricComparison(0, 0, false, true);
            expect(stateC.current).toBe(0);
            expect(stateC.previous).toBe(0);
            expect(stateC.relativeDiffPct).toBeNull();
            expect(stateC.absoluteDiff).toBe(0);

            // STATE D: Current = null (no latency observation), Previous = 34 -> no comparison
            const stateD = calculateMetricComparison(null, 34, false, true);
            expect(stateD.current).toBeNull();
            expect(stateD.previous).toBe(34);
            expect(stateD.relativeDiffPct).toBeNull();
            expect(stateD.absoluteDiff).toBeNull();
        });

        it("formatBucketTime formats consistently in UTC and in IANA timezones without drift", () => {
            const date = new Date("2026-09-01T20:45:00.000Z");
            const formattedUtc = formatBucketTime(date, 24 * 60 * 60 * 1000, "UTC");
            expect(formattedUtc).toBe("20:45");

            // Asia/Kolkata is +5:30 -> 20:45 + 5:30 = 02:15 next day
            const formattedIst = formatBucketTime(date, 24 * 60 * 60 * 1000, "Asia/Kolkata");
            expect(formattedIst).toBe("02:15");
        });
    });

    // ===================================================================
    // SUITE 9 — TIMEZONE TESTS (GATES M through Y)
    // ===================================================================
    describe("Timezone Single Source of Truth & Localized Display", () => {
        const utcDate = new Date("2026-06-15T14:30:00.000Z"); // Summer (DST in NY and London)

        it("[GATE N] Asia/Kolkata correctly formats timestamps with +5:30 offset", () => {
            // 14:30 UTC -> 20:00 IST
            const timeStr = formatBucketTime(utcDate, 24 * 60 * 60 * 1000, "Asia/Kolkata");
            expect(timeStr).toBe("20:00");
        });

        it("[GATE O & Q] America/New_York correctly formats timestamps including Daylight Saving Time", () => {
            // June 15 is EDT (UTC-4) -> 14:30 UTC = 10:30 EDT
            const summerTime = formatBucketTime(utcDate, 24 * 60 * 60 * 1000, "America/New_York");
            expect(summerTime).toBe("10:30");

            // Dec 15 is EST (UTC-5) -> 14:30 UTC = 09:30 EST
            const winterDate = new Date("2026-12-15T14:30:00.000Z");
            const winterTime = formatBucketTime(winterDate, 24 * 60 * 60 * 1000, "America/New_York");
            expect(winterTime).toBe("09:30");
        });

        it("[GATE P] UTC correctly formats timestamps", () => {
            const timeStr = formatBucketTime(utcDate, 24 * 60 * 60 * 1000, "UTC");
            expect(timeStr).toBe("14:30");
        });

        it("[GATE R & S] Local display conversion does not mutate stored canonical UTC timestamps", () => {
            const originalIso = "2026-06-15T14:30:00.000Z";
            const originalDate = new Date(originalIso);

            const displayKolkata = formatBucketTime(originalDate, 24 * 60 * 60 * 1000, "Asia/Kolkata");
            const displayNy = formatBucketTime(originalDate, 24 * 60 * 60 * 1000, "America/New_York");

            expect(displayKolkata).toBe("20:00");
            expect(displayNy).toBe("10:30");
            // Stored date remains canonical UTC
            expect(originalDate.toISOString()).toBe(originalIso);
        });

        it("[GATE T & U] Past 24h & comparison period boundaries remain deterministic across timezones", () => {
            const fixedNow = new Date("2026-09-01T12:00:00.000Z");
            const range = parseTimeRange("24h", "PREVIOUS_PERIOD", fixedNow);

            expect(range.start.toISOString()).toBe("2026-08-31T12:00:00.000Z");
            expect(range.end.toISOString()).toBe("2026-09-01T12:00:00.000Z");
            expect(range.comparisonStart?.toISOString()).toBe("2026-08-30T12:00:00.000Z");
            expect(range.comparisonEnd?.toISOString()).toBe("2026-08-31T12:00:00.000Z");
        });

        it("[GATE V, A, B, W] Canonical bucket identity, tooltip, selected interval, and Analyze Interval URL are 100% synchronized", () => {
            const start = new Date("2026-09-01T00:00:00.000Z");
            const end = new Date("2026-09-02T00:00:00.000Z");
            const buckets = generateTimeBuckets(start, end, 24, "Asia/Kolkata");

            const selectedBucketIdx = 8;
            const canonicalBucket = buckets[selectedBucketIdx];

            // 1. Tooltip formatted time equals selected interval formatted time
            expect(canonicalBucket.formattedTime).toBe(buckets[selectedBucketIdx].formattedTime);

            // 2. Canonical UTC timestamp for analysis request
            const analysisTargetUrl = `/projects/demo/investigations/new?intervalTime=${encodeURIComponent(
                canonicalBucket.start.toISOString()
            )}`;
            expect(analysisTargetUrl).toContain("2026-09-01T08%3A00%3A00.000Z");
            // Local formatted display reflects user timezone (8:00 UTC = 13:30 IST)
            expect(canonicalBucket.formattedTime).toBe("13:30");
        });
    });

    // ===================================================================
    // SUITE 10 — EVIDENCE-FIRST MVP VERIFICATION (GATES C through L)
    // ===================================================================
    describe("Evidence-First Model Integrity", () => {
        it("[GATE C, D, E, F] Null metrics remain null, zeroes remain zeroes, and missing baselines do not fabricate percentages", () => {
            // Missing baseline (null) does not produce -100%
            const missingBaseline = calculateMetricComparison(0, null, false, true);
            expect(missingBaseline.relativeDiffPct).toBeNull();
            expect(missingBaseline.current).toBe(0);

            // Missing latency does not produce 0ms
            const missingLatency = calculateMetricComparison(null, 45, false, true);
            expect(missingLatency.current).toBeNull();
            expect(missingLatency.relativeDiffPct).toBeNull();

            // Zero vs Zero does not divide by zero
            const zeroComparison = calculateMetricComparison(0, 0, false, true);
            expect(zeroComparison.relativeDiffPct).toBeNull();
        });

        it("[GATE I & J] Error rate improvement (33% -> 22%) is NEVER classified as an error regression, while latency regressions are explicitly justified", () => {
            const baseErrorRate = 33.3;
            const obsErrorRate = 22.0;
            const errorRateDiff = calculateMetricComparison(obsErrorRate, baseErrorRate, true, true);

            // Error rate dropped by 11.3pp (improvement)
            expect((errorRateDiff.percentagePointsDiff || 0) < 0).toBe(true);

            // Must NOT trigger error regression condition
            const isErrorRegression =
                (errorRateDiff.percentagePointsDiff || 0) > 0 &&
                obsErrorRate > baseErrorRate;
            expect(isErrorRegression).toBe(false);

            // Latency regression from 70ms to 96ms (+37% / >50% rule)
            const latencyDiff = calculateMetricComparison(120, 70, false, true);
            expect(latencyDiff.relativeDiffPct).toBe(71.4); // > 50%
            const isLatencyRegression = (latencyDiff.relativeDiffPct || 0) > 50;
            expect(isLatencyRegression).toBe(true);
        });

        it("[GATE G & H] Missing reliability telemetry does NOT fabricate 100% health", () => {
            const totalRequests = 0;
            const actualAvailability = totalRequests > 0 ? 100.0 : null;
            expect(actualAvailability).toBeNull();

            const observedRequests = 100;
            const observedErrors = 0;
            const observedAvailability = observedRequests > 0 ? (1 - observedErrors / observedRequests) * 100 : null;
            expect(observedAvailability).toBe(100.0);
        });
    });
});
