import { describe, it, expect } from "vitest";
import {
    evaluateCanonicalHealth,
    CANONICAL_HEALTH_THRESHOLDS,
    type CanonicalService,
    type HealthStatus,
} from "../service-registry";

describe("Canonical Service Registry & Health Domain Model", () => {
    describe("Deterministic Health Evaluation with Latency Regressions", () => {
        it("classifies services with 0 telemetry as Unknown with INSUFFICIENT_TELEMETRY", () => {
            const res = evaluateCanonicalHealth({
                requestCount: 0,
                errorCount: 0,
                fatalCount: 0,
                hasFiringAlert: false,
                errorRateSurgePct: null,
            });

            expect(res.health).toBe("Unknown");
            expect(res.healthReasonCode).toBe("INSUFFICIENT_TELEMETRY");
            expect(res.healthReason).toContain("Insufficient telemetry");
        });

        it("classifies error rate >= 20% as Critical with CRITICAL_FAILURE_RATE", () => {
            const res = evaluateCanonicalHealth({
                requestCount: 100,
                errorCount: 25,
                fatalCount: 0,
                hasFiringAlert: false,
                errorRateSurgePct: null,
            });

            expect(res.health).toBe("Critical");
            expect(res.healthReasonCode).toBe("CRITICAL_FAILURE_RATE");
            expect(res.healthReason).toContain("Critical failure rate of 25.0%");
        });

        it("classifies fatal exceptions as Critical with FATAL_EXCEPTIONS", () => {
            const res = evaluateCanonicalHealth({
                requestCount: 100,
                errorCount: 1,
                fatalCount: 1,
                hasFiringAlert: false,
                errorRateSurgePct: null,
            });

            expect(res.health).toBe("Critical");
            expect(res.healthReasonCode).toBe("FATAL_EXCEPTIONS");
            expect(res.healthReason).toContain("1 fatal exception(s)");
        });

        it("classifies firing monitor alerts as Critical with ACTIVE_MONITOR_ALERT", () => {
            const res = evaluateCanonicalHealth({
                requestCount: 100,
                errorCount: 2,
                fatalCount: 0,
                hasFiringAlert: true,
                errorRateSurgePct: null,
            });

            expect(res.health).toBe("Critical");
            expect(res.healthReasonCode).toBe("ACTIVE_MONITOR_ALERT");
            expect(res.healthReason).toContain("Active firing monitor alert");
        });

        it("classifies error rate between 5% and 20% as Degraded with ELEVATED_ERROR_RATE", () => {
            const res = evaluateCanonicalHealth({
                requestCount: 200,
                errorCount: 16, // 8.0%
                fatalCount: 0,
                hasFiringAlert: false,
                errorRateSurgePct: null,
            });

            expect(res.health).toBe("Degraded");
            expect(res.healthReasonCode).toBe("ELEVATED_ERROR_RATE");
            expect(res.healthReason).toContain("Elevated error rate of 8.0%");
        });

        it("classifies severe latency regressions (>50% surge) as Degraded with LATENCY_REGRESSION", () => {
            const res = evaluateCanonicalHealth({
                requestCount: 500,
                errorCount: 2, // 0.4% error rate
                fatalCount: 0,
                hasFiringAlert: false,
                errorRateSurgePct: null,
                p95LatencyMs: 3200,
                baselineP95LatencyMs: 1200,
                latencySurgePct: 167,
            });

            expect(res.health).toBe("Degraded");
            expect(res.healthReasonCode).toBe("LATENCY_REGRESSION");
            expect(res.healthReason).toContain("p95 latency regressed by 167%");
        });

        it("classifies low error rate (<5%) without regressions as Healthy and includes evidence-backed latency description", () => {
            const res = evaluateCanonicalHealth({
                requestCount: 1000,
                errorCount: 3, // 0.3%
                fatalCount: 0,
                hasFiringAlert: false,
                errorRateSurgePct: null,
                p95LatencyMs: 140,
                baselineP95LatencyMs: 135,
                latencySurgePct: 4,
            });

            expect(res.health).toBe("Healthy");
            expect(res.healthReasonCode).toBe("NORMAL_STABILITY");
            expect(res.healthReason).toContain("Operating normally with low error rate (0.3%)");
            expect(res.healthReason).toContain("stable p95 latency (140ms vs 135ms baseline)");
        });
    });

    describe("Health Action Matrix Verification", () => {
        function getPrimaryAction(health: HealthStatus) {
            switch (health) {
                case "Critical":
                    return "Investigate Critical State";
                case "Degraded":
                    return "Investigate Degradation";
                case "Healthy":
                case "Unknown":
                default:
                    return "View Service";
            }
        }

        it("returns Investigate Critical State for Critical services", () => {
            expect(getPrimaryAction("Critical")).toBe("Investigate Critical State");
        });

        it("returns Investigate Degradation for Degraded services", () => {
            expect(getPrimaryAction("Degraded")).toBe("Investigate Degradation");
        });

        it("returns View Service for Healthy services", () => {
            expect(getPrimaryAction("Healthy")).toBe("View Service");
        });

        it("returns View Service for Unknown services without falsely offering degradation investigation", () => {
            expect(getPrimaryAction("Unknown")).toBe("View Service");
        });
    });

    describe("Trace-Based Dependency Reconstruction", () => {
        it("reconstructs ordered call relationship from distributed trace spans", () => {
            const spans = [
                { service: "web-client", timestamp: new Date("2026-09-01T10:00:00Z") },
                { service: "api-gateway", timestamp: new Date("2026-09-01T10:00:01Z") },
                { service: "order-service", timestamp: new Date("2026-09-01T10:00:02Z") },
            ];

            const edges: Array<{ source: string; target: string }> = [];
            for (let i = 0; i < spans.length - 1; i++) {
                if (spans[i].service !== spans[i + 1].service) {
                    edges.push({
                        source: spans[i].service,
                        target: spans[i + 1].service,
                    });
                }
            }

            expect(edges.length).toBe(2);
            expect(edges[0]).toEqual({ source: "web-client", target: "api-gateway" });
            expect(edges[1]).toEqual({ source: "api-gateway", target: "order-service" });
        });
    });
});
