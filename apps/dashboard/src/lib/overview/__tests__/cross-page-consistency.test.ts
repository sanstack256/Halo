import { describe, it, expect } from "vitest";
import { calculateErrorRate, isFailedStatus } from "../../metrics/calculations";
import { CANONICAL_HEALTH_THRESHOLDS } from "../../services/service-registry";

describe("Cross-Page Telemetry Semantic & Mathematical Consistency", () => {
    describe("RULE 2 & PART X: Error Rate & Event Consistency", () => {
        it("strictly defines Error Rate as failed requests / observed requests", () => {
            // Given a population of:
            const requests = 100;
            const failedRequests = 20;
            const capturedErrorEvents = 30;

            const res = calculateErrorRate(requests, failedRequests, capturedErrorEvents);

            // Error rate MUST be 20.0% (failed requests / total requests)
            expect(res.value).toBe(20.0);
            expect(res.state).toBe("OBSERVED_VALUE");

            // The 30 captured error events must NEVER alter the request error rate to 30%
            expect(res.value).not.toBe(30.0);
        });

        it("never converts 0/0 requests into 100% or 0% error rate (RULE 11)", () => {
            // When zero requests are observed
            const resNoTelemetry = calculateErrorRate(0, 0, 0, false);
            expect(resNoTelemetry.value).toBeNull();
            expect(resNoTelemetry.state).toBe("NO_TELEMETRY");

            // Even if telemetry is present but zero requests captured
            const resZeroRequests = calculateErrorRate(0, 0, 0, true);
            expect(resZeroRequests.value).toBeNull();
            expect(resZeroRequests.state).toBe("NO_TELEMETRY");
        });

        it("classifies 0 requests with error events as undefined denominator (never 0% error)", () => {
            const res = calculateErrorRate(0, 0, 15, true);
            expect(res.value).toBeNull();
            expect(res.state).toBe("INVALID_DENOMINATOR");
            expect(res.label).toContain("Undefined");
        });

        it("faithfully reports observed zero when requests > 0 and 0 failures", () => {
            const res = calculateErrorRate(150, 0, 0, true);
            expect(res.value).toBe(0.0);
            expect(res.state).toBe("OBSERVED_ZERO");
        });
    });

    describe("RULE 2 & RULE 3: Shared Failure Status Semantics", () => {
        it("identifies HTTP 5xx and 4xx status codes consistently across all components", () => {
            expect(isFailedStatus("500")).toBe(true);
            expect(isFailedStatus("502")).toBe(true);
            expect(isFailedStatus("503")).toBe(true);
            expect(isFailedStatus("504")).toBe(true);
            expect(isFailedStatus("404")).toBe(true);
            expect(isFailedStatus("400")).toBe(true);
            expect(isFailedStatus("error")).toBe(true);
            expect(isFailedStatus("failed")).toBe(true);
            expect(isFailedStatus("timeout")).toBe(true);

            // Success codes
            expect(isFailedStatus("200")).toBe(false);
            expect(isFailedStatus("201")).toBe(false);
            expect(isFailedStatus("204")).toBe(false);
            expect(isFailedStatus("304")).toBe(false);
            expect(isFailedStatus(null)).toBe(false);
            expect(isFailedStatus(undefined)).toBe(false);
        });
    });

    describe("RULE 2 & PART X: Canonical Health Threshold Alignment", () => {
        it("aligns service health classifications across Services and Overview", () => {
            // Canonical thresholds:
            // CRITICAL: >= 20%
            // DEGRADED: >= 5%
            // HEALTHY: < 5%
            expect(CANONICAL_HEALTH_THRESHOLDS.CRITICAL_ERROR_RATE_PCT).toBe(20);
            expect(CANONICAL_HEALTH_THRESHOLDS.DEGRADED_ERROR_RATE_PCT).toBe(5);

            const evalHealth = (errorRate: number): "Critical" | "Degraded" | "Healthy" => {
                if (errorRate >= CANONICAL_HEALTH_THRESHOLDS.CRITICAL_ERROR_RATE_PCT) return "Critical";
                if (errorRate >= CANONICAL_HEALTH_THRESHOLDS.DEGRADED_ERROR_RATE_PCT) return "Degraded";
                return "Healthy";
            };

            expect(evalHealth(25.0)).toBe("Critical");
            expect(evalHealth(20.0)).toBe("Critical");
            expect(evalHealth(19.9)).toBe("Degraded");
            expect(evalHealth(5.0)).toBe("Degraded");
            expect(evalHealth(4.9)).toBe("Healthy");
            expect(evalHealth(0.0)).toBe("Healthy");
        });
    });
});
