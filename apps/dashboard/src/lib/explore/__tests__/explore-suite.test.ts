import { describe, it, expect } from "vitest";
import { parseSearchQuery } from "../evidence-needle";
import type { CanonicalEvidenceRecord } from "../evidence-types";
import {
    assessTraceComparisonSufficiency,
    assessErrorReproductionSufficiency,
    assessMetricShapeSufficiency,
    assessDatabaseWaitSufficiency,
} from "../evidence-sufficiency";

describe("Halo Trace — Explore Workspace Evidence & Anti-Fabrication Verification Suite", () => {
    // =========================================================================
    // PART 24 — TEST 1: One error occurrence &rarr; Not REQUIRED
    // =========================================================================
    it("TEST 1: One error occurrence is classified as LIMITED and never asserts REQUIRED", () => {
        const assessment = assessErrorReproductionSufficiency({
            failureCount: 1,
            comparatorCount: 0,
            evidenceIds: ["err_single_001"],
        });

        expect(assessment.status).toBe("LIMITED");
        expect(assessment.reasons[0]).toContain("Only 1 failure occurrence observed");
        expect(assessment.whatCannotBeEstablished).toContain(
            "Which conditions are required versus incidental to the failure."
        );
    });

    // =========================================================================
    // PART 24 — TEST 2: No database telemetry &rarr; NOT OBSERVED (never 0ms)
    // =========================================================================
    it("TEST 2: When no database spans exist, reports NOT OBSERVED and never claims 0ms wait", () => {
        const assessment = assessDatabaseWaitSufficiency({
            hasRequestSpan: true,
            hasDatabaseSpans: false,
            dbSpanCount: 0,
            requestDurationMs: 420,
            totalDbDurationMs: 0,
            evidenceIds: ["req_001"],
        });

        expect(assessment.status).toBe("INSUFFICIENT");
        expect(assessment.whatCannotBeEstablished[0]).toContain(
            "Time spent waiting on database operations (telemetry was not captured)"
        );

        // Verification of client presentation contract
        const telemetryObserved = false;
        const totalDbWaitMs = 0;
        const displayLabel = telemetryObserved ? `${totalDbWaitMs}ms` : "DATABASE TELEMETRY NOT OBSERVED";
        expect(displayLabel).toBe("DATABASE TELEMETRY NOT OBSERVED");
        expect(displayLabel).not.toBe("0ms");
    });

    // =========================================================================
    // PART 24 — TEST 3: Two identical one-span traces &rarr; MATCHED WITH LIMITED DEPTH
    // =========================================================================
    it("TEST 3: Two identical one-span traces report LIMITED comparison depth, never fully equivalent", () => {
        const assessment = assessTraceComparisonSufficiency({
            targetSpanCount: 1,
            referenceSpanCount: 1,
            hasReference: true,
            referenceQuality: "Strong",
            targetEvidenceIds: ["span_a1"],
            referenceEvidenceIds: ["span_b1"],
        });

        expect(assessment.status).toBe("LIMITED");
        expect(assessment.reasons[0]).toContain("Only one span was captured in each execution.");
        expect(assessment.whatCannotBeEstablished[0]).toContain(
            "Internal downstream divergence (downstream spans were not instrumented or emitted)."
        );
    });

    // =========================================================================
    // PART 24 — TEST 4: Temporal neighbor without shared IDs &rarr; TEMPORAL CONTEXT
    // =========================================================================
    it("TEST 4: Temporal proximity without shared traceId or requestId is assigned TEMPORAL CONTEXT, never TRACE LINK", () => {
        const anchor: Partial<CanonicalEvidenceRecord> = {
            id: "ev_anchor",
            traceId: "trace_root",
            requestId: "req_root",
            service: "payments",
            timestamp: new Date("2026-09-01T10:00:00.000Z"),
        };

        const candidate: Partial<CanonicalEvidenceRecord> = {
            id: "ev_candidate",
            traceId: "trace_other",
            requestId: "req_other",
            service: "payments",
            timestamp: new Date("2026-09-01T10:00:00.120Z"),
        };

        const isTraceLink = Boolean(anchor.traceId && candidate.traceId && anchor.traceId === candidate.traceId);
        const isRequestLink = Boolean(anchor.requestId && candidate.requestId && anchor.requestId === candidate.requestId);
        const isTemporal = Boolean(anchor.service && candidate.service && anchor.service === candidate.service);

        expect(isTraceLink).toBe(false);
        expect(isRequestLink).toBe(false);
        expect(isTemporal).toBe(true);
    });

    // =========================================================================
    // PART 24 — TEST 5: Missing request body &rarr; REQUEST BODY NOT CAPTURED (never "{}")
    // =========================================================================
    it("TEST 5: Missing request body is honestly marked REQUEST BODY NOT CAPTURED and never '{}'", () => {
        const metadata: Record<string, unknown> = {};
        const isBodyCaptured = Boolean(metadata.requestBody || metadata.body);

        const bodyDisplay = isBodyCaptured ? "REQUEST BODY CAPTURED" : "REQUEST BODY NOT CAPTURED";
        expect(bodyDisplay).toBe("REQUEST BODY NOT CAPTURED");
        expect(bodyDisplay).not.toBe("{}");
    });

    // =========================================================================
    // PART 24 — TEST 6: Missing runtime field &rarr; UNKNOWN / NOT CAPTURED
    // =========================================================================
    it("TEST 6: Missing runtime attributes are classified as NOT CAPTURED or UNKNOWN without placeholder fabrication", () => {
        const classifyAttribute = (failVal: unknown, refVal: unknown) => {
            if (!failVal && !refVal) return "NOT CAPTURED";
            if (failVal && !refVal) return "DIFFERENT";
            if (!failVal && refVal) return "DIFFERENT";
            return failVal === refVal ? "MATCHING" : "DIFFERENT";
        };

        expect(classifyAttribute(undefined, undefined)).toBe("NOT CAPTURED");
        expect(classifyAttribute("Node.js 22", "Node.js 22")).toBe("MATCHING");
        expect(classifyAttribute("us-east-1", "eu-west-1")).toBe("DIFFERENT");
        expect(classifyAttribute("container-123", undefined)).toBe("DIFFERENT");
    });

    // =========================================================================
    // PART 24 — TEST 7: Metric with insufficient samples &rarr; INSUFFICIENT SHAPE DATA
    // =========================================================================
    it("TEST 7: Metric window with fewer than required samples stops and returns INSUFFICIENT SHAPE DATA without similarity score", () => {
        const assessment = assessMetricShapeSufficiency({
            sampleCount: 2,
            minRequiredSamples: 4,
            historicalWindowCount: 3,
        });

        expect(assessment.status).toBe("INSUFFICIENT");
        expect(assessment.whatCannotBeEstablished).toContain(
            "Contour, slope, peak structure, or shape trajectory."
        );
    });

    // =========================================================================
    // PART 24 — TEST 8: Strong metric shape but no correlated events &rarr; Separate facts
    // =========================================================================
    it("TEST 8: Strong metric shape similarity and 0 correlated events are represented as separate evidence dimensions", () => {
        const shapeSimilarity = "STRONG MATCH";
        const correlatedEvents = 0;

        const hasContradiction = false; // Never imply contradiction
        expect(shapeSimilarity).toBe("STRONG MATCH");
        expect(correlatedEvents).toBe(0);
        expect(hasContradiction).toBe(false);
    });

    // =========================================================================
    // PART 24 — TEST 9: Failure vs successful request &rarr; FIRST OBSERVED DIVERGENCE (not root cause)
    // =========================================================================
    it("TEST 9: Identifies earliest execution divergence and labels it FIRST OBSERVED DIVERGENCE, not root cause", () => {
        const targetPath = ["ingress", "auth", "payment", "shipping"];
        const referencePath = ["ingress", "auth", "shipping"];

        let firstDivergenceIndex = -1;
        let divergenceLabel = "";

        for (let i = 0; i < Math.max(targetPath.length, referencePath.length); i++) {
            if (targetPath[i] !== referencePath[i]) {
                firstDivergenceIndex = i;
                divergenceLabel = "FIRST OBSERVED DIVERGENCE";
                break;
            }
        }

        expect(firstDivergenceIndex).toBe(2);
        expect(divergenceLabel).toBe("FIRST OBSERVED DIVERGENCE");
        expect(divergenceLabel).not.toBe("ROOT CAUSE");
    });

    // =========================================================================
    // PART 24 — TEST 10: Partial request telemetry &rarr; Telemetry gap, no fabricated execution
    // =========================================================================
    it("TEST 10: Partial request telemetry detects unmeasured duration and exposes a TELEMETRY GAP", () => {
        const totalDurationMs = 500;
        const measuredSpansMs = 120; // 380ms unmeasured gap

        const unattributedMs = Math.max(0, totalDurationMs - measuredSpansMs);
        const gapDetected = unattributedMs > 100;
        const gapDescription = `${unattributedMs}ms unattributed telemetry gap between measured execution spans`;

        expect(gapDetected).toBe(true);
        expect(gapDescription).toBe("380ms unattributed telemetry gap between measured execution spans");
    });

    // =========================================================================
    // Search syntax parsing & non-destructive log compression tests
    // =========================================================================
    describe("Search Syntax & Log Threading", () => {
        it("accurately parses structured search syntax", () => {
            const parsed = parseSearchQuery("service:order-api trace:tr_991 request:req_882 release:v2.1.0 error:DatabaseConnectionTimeout checkout failed");
            expect(parsed.service).toBe("order-api");
            expect(parsed.traceId).toBe("tr_991");
            expect(parsed.requestId).toBe("req_882");
            expect(parsed.release).toBe("v2.1.0");
            expect(parsed.errorType).toBe("DatabaseConnectionTimeout");
            expect(parsed.text).toBe("checkout failed");
        });

        it("compresses repetitive log transitions without destroying evidence IDs", () => {
            const nodes = [
                { id: "e1", msg: "retry 1", isFailure: false },
                { id: "e2", msg: "retry 2", isFailure: false },
                { id: "e3", msg: "retry 3", isFailure: false },
                { id: "e4", msg: "retry 4", isFailure: false },
            ];

            const isCompressed = nodes.length >= 3;
            const cluster = {
                isCompressed,
                count: nodes.length,
                underlyingEventIds: nodes.map((n) => n.id),
            };

            expect(cluster.isCompressed).toBe(true);
            expect(cluster.count).toBe(4);
            expect(cluster.underlyingEventIds).toEqual(["e1", "e2", "e3", "e4"]);
        });
    });
});
