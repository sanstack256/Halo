import { describe, it, expect } from "vitest";
import { formatDeterministicDateTime, formatDeterministicTime } from "../../date-format";
import {
    assessIntervalEvidenceSufficiency,
    assessReleaseEvidenceSufficiency,
} from "../evidence-boundary";
import { investigate } from "@halo/investigation-engine";

describe("Analyze Interval & Analyze Release Evidence Correctness Matrix", () => {
    describe("Test A: Empty primary interval + contextual exception", () => {
        it("strictly identifies primary interval as empty and classifies nearby error as contextual", () => {
            const primaryEvents: any[] = [];
            const precedingEvents: any[] = [];
            const followingEvents: any[] = [
                {
                    id: "evt-follow-err",
                    type: "ERROR",
                    title: "TypeError: Failed to fetch client token",
                    timestamp: new Date("2026-08-31T20:35:00.000Z"),
                    service: "web-client",
                },
            ];
            const baselineEvents: any[] = [];
            const releases: any[] = [];

            const assessment = assessIntervalEvidenceSufficiency({
                primaryEvents,
                precedingEvents,
                followingEvents,
                baselineEvents,
                releases,
            });

            expect(assessment.sufficiency).toBe("INSUFFICIENT");
            expect(assessment.sufficientForIntervalConclusion).toBe(false);
            expect(assessment.headline).toBe("Insufficient Telemetry Observed in Selected Interval");
            expect(assessment.summaryExplanation).toContain("No request or error events were observed inside the selected interval");
            expect(assessment.contextExplanation).toContain("1 contextual error event(s) observed in the surrounding window");
            expect(assessment.metrics.primaryRequests).toBe(0);
            expect(assessment.metrics.primaryErrors).toBe(0);
            expect(assessment.metrics.contextualErrorsCount).toBe(1);
        });
    });

    describe("Test B: Completely empty interval", () => {
        it("evaluates 0 requests, 0 errors, and produces no fabricated health metrics", () => {
            const assessment = assessIntervalEvidenceSufficiency({
                primaryEvents: [],
                precedingEvents: [],
                followingEvents: [],
                baselineEvents: [],
                releases: [],
            });

            expect(assessment.sufficiency).toBe("INSUFFICIENT");
            expect(assessment.metrics.primaryRequests).toBe(0);
            expect(assessment.metrics.primaryErrors).toBe(0);
            expect(assessment.metrics.primaryErrorRate).toBe(0);
            expect(assessment.metrics.primaryAvgLatencyMs).toBeNull();
            expect(assessment.whatHaloCanEstablish).toContain("0 request or error events were recorded inside the primary interval.");
        });
    });

    describe("Test C: Release 138 baseline / 1 post-deployment (Benchmark 4.0.0)", () => {
        it("returns Insufficient Evidence and disallows false root cause or 100% confidence", () => {
            const baseEvents = Array.from({ length: 138 }, (_, i) => ({
                id: `base-evt-${i}`,
                type: i < 34 ? "ERROR" : "TRACE",
                title: i < 34 ? "DatabaseTimeout: pool exhausted" : "GET /orders",
                timestamp: new Date(`2026-08-30T19:${String(i % 60).padStart(2, "0")}:00.000Z`),
                service: "order-service",
            }));

            const obsEvents = [
                {
                    id: "obs-evt-1",
                    type: "TRACE",
                    title: "GET /shipping/healthy",
                    timestamp: new Date("2026-08-30T20:00:04.111Z"),
                    service: "shipping-service",
                },
            ];

            const assessment = assessReleaseEvidenceSufficiency({
                releaseVersion: "halo-investigation-benchmark-4.0.0",
                releaseTime: new Date("2026-08-30T20:00:04.111Z"),
                baseEvents,
                obsEvents,
            });

            expect(assessment.verdict).toBe("Insufficient Evidence");
            expect(assessment.sufficiency).toBe("PARTIAL");
            expect(assessment.sufficientForReleaseRegression).toBe(false);
            expect(assessment.sufficientForCausalInference).toBe(false);
            expect(assessment.reasons).toContain(
                "Only 1 post-deployment event was observed, which is insufficient to establish release behavior."
            );
            expect(assessment.whatHaloCanEstablish).toContain("Baseline error rate was 24.6% across 138 events.");
            expect(assessment.whatHaloCannotEstablish).toContain(
                "Whether release halo-investigation-benchmark-4.0.0 caused or did not cause an operational regression."
            );

            // Engine execution with post-deployment evidence only
            const investigation = investigate([
                {
                    id: "obs-evt-1",
                    type: "TRACE",
                    source: "sdk",
                    service: "shipping-service",
                    title: "GET /shipping/healthy",
                    timestamp: new Date("2026-08-30T20:00:04.111Z"),
                    metadata: {},
                },
            ]);

            expect(investigation.status).toBe("UNCERTAIN");
            expect(investigation.rootCause).toBeNull();
            expect(investigation.causalChains?.length ?? 0).toBe(0);
        });
    });

    describe("Test D: Structural relationship is not causal proof", () => {
        it("assigns STRUCTURAL_CONTEXT rather than ROOT_CAUSE to query/database trace spans", () => {
            const investigation = investigate([
                {
                    id: "query-span",
                    type: "TRACE",
                    source: "sdk",
                    service: "order-service",
                    title: "Database orders.list",
                    timestamp: new Date("2026-08-30T20:00:00.000Z"),
                    metadata: {},
                },
                {
                    id: "health-span",
                    type: "TRACE",
                    source: "sdk",
                    service: "health-service",
                    title: "GET /health",
                    timestamp: new Date("2026-08-30T20:00:01.000Z"),
                    metadata: {},
                },
            ]);

            // Database query must NOT be selected as ROOT CAUSE
            expect(investigation.rootCause).toBeNull();
            if (investigation.causalChains && investigation.causalChains.length > 0) {
                const dbStep = investigation.causalChains[0].steps.find((s) => s.evidenceId === "query-span");
                if (dbStep) {
                    expect(dbStep.role).not.toBe("ROOT_CAUSE");
                }
            }
        });
    });

    describe("Test E & Test G: Confidence integrity for uncertain hypotheses", () => {
        it("does not allow an UNCERTAIN hypothesis to communicate Very High 100% confidence", () => {
            const investigation = investigate([
                {
                    id: "err-1",
                    type: "ERROR",
                    source: "sdk",
                    service: "svc-a",
                    title: "Error A",
                    timestamp: new Date("2026-08-30T20:00:00.000Z"),
                    metadata: {},
                },
            ]);

            for (const h of investigation.hypotheses) {
                if (h.status === "UNCERTAIN") {
                    expect(h.confidence).toBeLessThanOrEqual(50);
                    expect(h.confidenceLevel).not.toBe("VERY_HIGH");
                }
            }
        });
    });

    describe("Test H & Test I: Release Traffic Increase Semantics (Benchmark 3.0.0)", () => {
        it("distinguishes absolute error count increase (15 -> 61) from error rate improvement (33.3% -> 22.3%)", () => {
            const baseEvents = Array.from({ length: 45 }, (_, i) => ({
                id: `base-${i}`,
                type: i < 15 ? "ERROR" : "TRACE",
                title: i < 15 ? "Timeout error" : "GET /items",
                timestamp: new Date("2026-08-30T19:00:00.000Z"),
                service: "api-service",
            }));

            const obsEvents = Array.from({ length: 273 }, (_, i) => ({
                id: `obs-${i}`,
                type: i < 61 ? "ERROR" : "TRACE",
                title: i < 61 ? "Timeout error" : "GET /items",
                timestamp: new Date("2026-08-30T20:30:00.000Z"),
                service: "api-service",
            }));

            const assessment = assessReleaseEvidenceSufficiency({
                releaseVersion: "halo-investigation-benchmark-3.0.0",
                releaseTime: new Date("2026-08-30T20:00:00.000Z"),
                baseEvents,
                obsEvents,
            });

            expect(assessment.verdict).toBe("No Regression Observed");
            expect(assessment.sufficientForReleaseRegression).toBe(true);
            expect(assessment.metrics.isErrorRegression).toBe(false);
            expect(assessment.summaryExplanation).toContain(
                "Traffic increased from 45 to 273 events. Absolute errors increased (15 → 61), but error rate improved (33.3% → 22.3%). No error regression detected."
            );
        });
    });

    describe("Timezone & Invariant Persistence", () => {
        it("preserves canonical UTC timestamps across IANA display zones", () => {
            const canonicalUtcStr = "2026-09-01T08:00:00.000Z";
            const date = new Date(canonicalUtcStr);

            expect(formatDeterministicTime(date, "Asia/Kolkata")).toBe("13:30:00 IST");
            expect(formatDeterministicTime(date, "America/New_York")).toBe("04:00:00 EDT");
            expect(date.toISOString()).toBe(canonicalUtcStr);
        });
    });
});
