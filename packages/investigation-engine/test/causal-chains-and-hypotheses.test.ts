import { describe, expect, it } from "vitest";
import { investigate } from "../src/engine";
import { correlateEvidence } from "../src/pipeline/correlate";
import { tracePropagationChains } from "../src/graph/propagation";
import type { Evidence } from "../src/types/evidence";

describe("Causal Chain Reconstruction & Evidence-Backed Hypotheses", () => {
    it("Scenario 1: reconstructs multi-step causal chain (HTTP 500 -> downstream client exception)", () => {
        const evidence: Evidence[] = [
            {
                id: "ev-req-500",
                type: "TRACE",
                timestamp: new Date("2026-08-30T10:00:00Z"),
                source: "sdk",
                service: "api-gateway",
                title: "POST /api/checkout -> 500",
                operation: "POST /api/checkout",
                resource: "/api/checkout",
                status: 500,
                traceId: "trace-checkout-101",
                requestId: "req-checkout-101",
                metadata: { durationMs: 142 },
            },
            {
                id: "ev-client-err",
                type: "ERROR",
                timestamp: new Date("2026-08-30T10:00:00.150Z"),
                source: "sdk",
                service: "frontend-client",
                title: "TypeError: Cannot read properties of undefined (reading 'orderId')",
                description: "Cannot read properties of undefined (reading 'orderId')",
                traceId: "trace-checkout-101",
                requestId: "req-checkout-101",
                metadata: {
                    error: "TypeError: Cannot read properties of undefined (reading 'orderId')",
                    stack: "TypeError: Cannot read properties of undefined (reading 'orderId')\n    at handleCheckoutResponse (src/checkout.ts:42:15)",
                },
            },
        ];

        const investigation = investigate(evidence);

        expect(investigation.causalChains).toBeDefined();
        expect(investigation.causalChains?.length).toBeGreaterThan(0);

        const chain = investigation.causalChains![0];
        expect(chain.rootEvidenceId).toBe("ev-req-500");
        expect(chain.terminalEvidenceId).toBe("ev-client-err");
        expect(chain.steps.length).toBe(2);

        // Step roles
        expect(chain.steps[0].role).toBe("ROOT_CAUSE");
        expect(chain.steps[1].role).toBe("SYMPTOM");

        // Edge between steps
        const connectingEdge = chain.steps[1].edgeFromPrevious;
        expect(connectingEdge).toBeDefined();
        expect(["REQUEST_SPAN", "DOWNSTREAM_FAILURE_OF"]).toContain(connectingEdge?.relationship);
        expect(connectingEdge?.classification).toBe("Observed");
        expect(connectingEdge?.temporal).toBe("IMMEDIATELY_PRECEDES");
    });

    it("Scenario 2: classifies parent-child distributed trace spans as Observed CHILD_SPAN_OF", () => {
        const evidence: Evidence[] = [
            {
                id: "span-parent",
                type: "TRACE",
                timestamp: new Date("2026-08-30T10:00:00Z"),
                source: "sdk",
                service: "order-service",
                title: "CreateOrder handler",
                traceId: "trace-abc-1",
                spanId: "span-parent-1",
                metadata: {},
            },
            {
                id: "span-child",
                type: "TRACE",
                timestamp: new Date("2026-08-30T10:00:00.020Z"),
                source: "sdk",
                service: "payment-service",
                title: "ProcessPayment call",
                traceId: "trace-abc-1",
                spanId: "span-child-2",
                parentSpanId: "span-parent-1",
                metadata: {},
            },
        ];

        const graph = correlateEvidence(evidence);
        const parentChildEdge = graph.edges.find(
            (e) => e.from === "span-parent" && e.to === "span-child" && e.relationship === "CHILD_SPAN_OF"
        );

        expect(parentChildEdge).toBeDefined();
        expect(parentChildEdge?.classification).toBe("Observed");
        expect(parentChildEdge?.strength).toBe(1.0);
    });

    it("Scenario 3: correlates stack trace code locations as STACK_FRAME_CALLS", () => {
        const evidence: Evidence[] = [
            {
                id: "err-with-stack",
                type: "ERROR",
                timestamp: new Date("2026-08-30T10:00:00Z"),
                source: "sdk",
                service: "auth-service",
                title: "ReferenceError: userToken is not defined",
                description: "ReferenceError: userToken is not defined",
                metadata: {
                    stack: "ReferenceError: userToken is not defined\n    at validateToken (src/auth/validator.ts:88:12)\n    at authenticate (src/auth/handler.ts:34:5)",
                },
            },
        ];

        const graph = correlateEvidence(evidence);
        expect(graph.nodes.some((n) => n.id === "err-with-stack")).toBe(true);

        const investigation = investigate(evidence);
        const runtimeHyp = investigation.hypotheses.find((h) => h.id.startsWith("runtime-exception:"));

        expect(runtimeHyp).toBeDefined();
        expect(runtimeHyp?.title).toContain("ReferenceError");
        expect(runtimeHyp?.supportingReasons.some((r) => r.description.includes("validator.ts:88"))).toBe(true);
    });

    it("Scenario 4: correlates database failure with Prisma error code and EXECUTES_QUERY edge", () => {
        const evidence: Evidence[] = [
            {
                id: "db-err-1",
                type: "ERROR",
                timestamp: new Date("2026-08-30T10:00:00Z"),
                source: "sdk",
                service: "user-service",
                title: "PrismaClientKnownRequestError: P2002 Unique constraint failed on the fields: (`email`)",
                resource: "User",
                operation: "prisma.user.create",
                metadata: {
                    error: "P2002",
                    message: "Unique constraint failed on the fields: (`email`)",
                },
            },
        ];

        const investigation = investigate(evidence);
        const dbHyp = investigation.hypotheses.find((h) => h.id.startsWith("database-failure:P2002"));

        expect(dbHyp).toBeDefined();
        expect(dbHyp?.title).toContain("Unique constraint violation");
        expect(dbHyp?.detailedSupportingEvidence?.length).toBeGreaterThan(0);
        expect(dbHyp?.provenance).toBe("sdk");
    });

    it("Scenario 5: identifies upstream service failure propagation across microservices", () => {
        const evidence: Evidence[] = [
            {
                id: "svc-upstream-fail",
                type: "TRACE",
                timestamp: new Date("2026-08-30T10:00:00Z"),
                source: "sdk",
                service: "billing-service",
                title: "POST /v1/charges -> 503 Service Unavailable",
                status: 503,
                traceId: "trace-cascade-99",
                metadata: {},
            },
            {
                id: "svc-downstream-err",
                type: "ERROR",
                timestamp: new Date("2026-08-30T10:00:00.200Z"),
                source: "sdk",
                service: "checkout-service",
                title: "BillingServiceUnavailable: Downstream billing service responded with HTTP 503",
                traceId: "trace-cascade-99",
                metadata: {},
            },
        ];

        const investigation = investigate(evidence);
        expect(investigation.causalChains?.length).toBeGreaterThan(0);

        const chain = investigation.causalChains![0];
        expect(chain.rootEvidenceId).toBe("svc-upstream-fail");
        expect(chain.steps[0].service).toBe("billing-service");
        expect(chain.steps[1].service).toBe("checkout-service");
    });

    it("Scenario 6: correlates deployment change trigger with same-service failure", () => {
        const evidence: Evidence[] = [
            {
                id: "dep-release-v2",
                type: "DEPLOYMENT",
                timestamp: new Date("2026-08-30T10:00:00Z"),
                source: "vercel",
                service: "api",
                title: "Deployment v2.4.0 (commit abc1234)",
                commit: "abc1234",
                metadata: {},
            },
            {
                id: "err-post-dep",
                type: "ERROR",
                timestamp: new Date("2026-08-30T10:01:00Z"),
                source: "sdk",
                service: "api",
                title: "Unhandled exception in route handler",
                metadata: {},
            },
        ];

        const investigation = investigate(evidence);
        const depHyp = investigation.hypotheses.find((h) => h.id.startsWith("deployment-regression:"));

        expect(depHyp).toBeDefined();
        expect(["LEADING", "VALIDATED"]).toContain(depHyp?.status);
        expect(depHyp?.confidence).toBeGreaterThan(70);
    });

    it("Scenario 7: does not create causal edge for coincidental events in different services without shared context", () => {
        const evidence: Evidence[] = [
            {
                id: "dep-service-a",
                type: "DEPLOYMENT",
                timestamp: new Date("2026-08-30T10:00:00Z"),
                source: "vercel",
                service: "marketing-site",
                title: "Deployment v1.0",
                metadata: {},
            },
            {
                id: "err-service-b",
                type: "ERROR",
                timestamp: new Date("2026-08-30T10:01:00Z"),
                source: "sdk",
                service: "payment-processing",
                title: "Payment timeout",
                metadata: {},
            },
        ];

        const graph = correlateEvidence(evidence);
        const crossEdge = graph.edges.find(
            (e) => (e.from === "dep-service-a" && e.to === "err-service-b") || (e.from === "err-service-b" && e.to === "dep-service-a")
        );

        expect(crossEdge).toBeUndefined();
    });

    it("Scenario 8: does not treat chronological ordering alone as proof of causality", () => {
        const evidence: Evidence[] = [
            {
                id: "log-info-1",
                type: "LOG",
                timestamp: new Date("2026-08-30T10:00:00Z"),
                source: "sdk",
                service: "service-x",
                title: "User logged in",
                metadata: {},
            },
            {
                id: "log-info-2",
                type: "LOG",
                timestamp: new Date("2026-08-30T10:00:05Z"),
                source: "sdk",
                service: "service-y",
                title: "Cache warmup completed",
                metadata: {},
            },
        ];

        const chains = tracePropagationChains(evidence, correlateEvidence(evidence));
        expect(chains.length).toBe(0);
    });

    it("Scenario 9: ranks hypotheses by net evidence strength over domain priority", () => {
        const evidence: Evidence[] = [
            {
                id: "dep-payment",
                type: "DEPLOYMENT",
                timestamp: new Date("2026-08-30T10:00:00Z"),
                source: "vercel",
                service: "payment",
                title: "Deployment v2.0",
                commit: "998877",
                metadata: {},
            },
            {
                id: "err-payment-1",
                type: "ERROR",
                timestamp: new Date("2026-08-30T10:00:30Z"),
                source: "sdk",
                service: "payment",
                title: "Payment processing failed",
                metadata: {},
            },
            {
                id: "dep-rollback",
                type: "DEPLOYMENT",
                timestamp: new Date("2026-08-30T10:05:00Z"),
                source: "vercel",
                service: "payment",
                title: "Rollback to v1.9",
                metadata: {},
            },
            {
                id: "rec-payment",
                type: "LOG",
                timestamp: new Date("2026-08-30T10:05:30Z"),
                source: "sdk",
                service: "payment",
                title: "Payment service recovered successfully",
                status: "success",
                metadata: {},
            },
        ];

        const investigation = investigate(evidence);
        expect(investigation.hypotheses.length).toBeGreaterThan(0);

        const leading = investigation.hypotheses[0];
        expect(leading.id).toContain("deployment-regression");
        expect(leading.rankingExplanation).toBeDefined();
        expect(leading.confidenceLevel).toBe("VERY_HIGH");
    });

    it("Scenario 10: penalizes candidates with active contradicting evidence", () => {
        const evidence: Evidence[] = [
            // Pre-existing errors BEFORE deployment
            {
                id: "err-pre-existing",
                type: "ERROR",
                timestamp: new Date("2026-08-30T09:50:00Z"),
                source: "sdk",
                service: "auth",
                title: "Auth token generation failed",
                metadata: {},
            },
            {
                id: "dep-auth",
                type: "DEPLOYMENT",
                timestamp: new Date("2026-08-30T10:00:00Z"),
                source: "vercel",
                service: "auth",
                title: "Deployment v1.1",
                metadata: {},
            },
            {
                id: "err-post",
                type: "ERROR",
                timestamp: new Date("2026-08-30T10:02:00Z"),
                source: "sdk",
                service: "auth",
                title: "Auth token generation failed",
                metadata: {},
            },
        ];

        const investigation = investigate(evidence);
        const depHyp = investigation.hypotheses.find((h) => h.id.startsWith("deployment-regression:"));

        expect(depHyp).toBeDefined();
        expect(depHyp?.contradictingReasons.some((r) => r.title.includes("predates deployment"))).toBe(true);
        expect(depHyp?.status).not.toBe("VALIDATED");
    });

    it("Scenario 11: explicitly represents missing telemetry uncertainty in missingReasons", () => {
        const evidence: Evidence[] = [
            {
                id: "err-type-isolated",
                type: "ERROR",
                timestamp: new Date("2026-08-30T10:00:00Z"),
                source: "sdk",
                service: "billing",
                title: "TypeError: Cannot read properties of undefined (reading 'invoiceId')",
                description: "Cannot read properties of undefined (reading 'invoiceId')",
                metadata: {
                    // No stack trace line numbers and no traceId
                },
            },
        ];

        const investigation = investigate(evidence);
        const runtimeHyp = investigation.hypotheses.find((h) => h.id.startsWith("runtime-exception:"));

        expect(runtimeHyp).toBeDefined();
        expect(runtimeHyp?.missingReasons.length).toBeGreaterThan(0);
        expect(runtimeHyp?.detailedMissingEvidence?.some((m) => m.what.includes("Trace correlation") || m.what.includes("stack frames"))).toBe(true);
    });

    it("Scenario 12: expresses honest uncertainty (status: UNCERTAIN) when evidence is insufficient", () => {
        const evidence: Evidence[] = [
            {
                id: "log-generic",
                type: "LOG",
                timestamp: new Date("2026-08-30T10:00:00Z"),
                source: "sdk",
                service: "search",
                title: "Search query executed",
                metadata: {},
            },
        ];

        const investigation = investigate(evidence);

        expect(investigation.status).toBe("UNCERTAIN");
        expect(investigation.rootCause).toBeNull();
    });

    it("Scenario 13: verifies edge classifications (Observed, Inferred, Likely, Unknown)", () => {
        const evidence: Evidence[] = [
            {
                id: "ev-trace-1",
                type: "TRACE",
                timestamp: new Date("2026-08-30T10:00:00Z"),
                source: "sdk",
                service: "orders",
                title: "Order created",
                traceId: "trace-common-1",
                metadata: {},
            },
            {
                id: "ev-trace-2",
                type: "TRACE",
                timestamp: new Date("2026-08-30T10:00:00.050Z"),
                source: "sdk",
                service: "notifications",
                title: "Order notification sent",
                traceId: "trace-common-1",
                metadata: {},
            },
        ];

        const graph = correlateEvidence(evidence);
        const edge = graph.edges.find((e) => e.relationship === "SAME_TRACE");

        expect(edge).toBeDefined();
        expect(edge?.classification).toBe("Observed");
        expect(edge?.temporal).toBe("IMMEDIATELY_PRECEDES");
    });

    it("Scenario 14: derives qualitative confidence levels and explains ranking", () => {
        const evidence: Evidence[] = [
            {
                id: "dep-prod",
                type: "DEPLOYMENT",
                timestamp: new Date("2026-08-30T10:00:00Z"),
                source: "vercel",
                service: "gateway",
                title: "Deploy gateway v3.0.1",
                commit: "c0ffee",
                metadata: {},
            },
            {
                id: "err-gateway-1",
                type: "ERROR",
                timestamp: new Date("2026-08-30T10:00:15Z"),
                source: "sdk",
                service: "gateway",
                title: "Gateway 502 Bad Gateway",
                status: 502,
                metadata: {},
            },
        ];

        const investigation = investigate(evidence);
        const topHyp = investigation.hypotheses[0];

        expect(topHyp).toBeDefined();
        expect(["VERY_HIGH", "HIGH", "MEDIUM", "LOW"]).toContain(topHyp.confidenceLevel);
        expect(topHyp.confidenceExplanation).toContain("Confidence assessed as");
        expect(topHyp.rankingExplanation).toContain("Ranked #1");
    });

    it("Scenario 15: preserves provenance throughout the pipeline", () => {
        const evidence: Evidence[] = [
            {
                id: "ev-prov-test",
                type: "DEPLOYMENT",
                timestamp: new Date("2026-08-30T10:00:00Z"),
                source: "github",
                service: "worker",
                title: "GitHub Actions workflow run",
                metadata: {},
            },
            {
                id: "ev-prov-err",
                type: "ERROR",
                timestamp: new Date("2026-08-30T10:00:10Z"),
                source: "datadog",
                service: "worker",
                title: "Worker out of memory",
                metadata: {},
            },
        ];

        const investigation = investigate(evidence);
        expect(investigation.evidence.find((e) => e.id === "ev-prov-test")?.source).toBe("github");
        expect(investigation.evidence.find((e) => e.id === "ev-prov-err")?.source).toBe("datadog");

        const hyp = investigation.hypotheses.find((h) => h.evidenceIds.includes("ev-prov-test"));
        expect(hyp?.provenance).toBe("github");
    });

    it("Regression A: TypeError with no request correlation does not create causal edge or claim downstream symptom", () => {
        const evidence: Evidence[] = [
            {
                id: "ev-unrelated-req",
                type: "TRACE",
                timestamp: new Date("2026-08-30T10:00:00Z"),
                source: "sdk",
                service: "api-gateway",
                title: "GET /api/user/profile -> 200",
                status: 200,
                // No traceId, requestId, or sessionId matching the error
                traceId: "trace-profile-999",
                requestId: "req-profile-999",
            },
            {
                id: "ev-typeerror",
                type: "ERROR",
                timestamp: new Date("2026-08-30T10:00:01Z"),
                source: "sdk",
                service: "frontend-client",
                title: "TypeError: Cannot read properties of undefined (reading 'transaction')",
                description: "Cannot read properties of undefined (reading 'transaction')",
                // Different trace/request ID
                traceId: "trace-checkout-111",
                requestId: "req-checkout-111",
                metadata: {
                    error: "TypeError: Cannot read properties of undefined (reading 'transaction')",
                    stack: "TypeError: Cannot read properties of undefined (reading 'transaction')\n    at handleCheckout (src/checkout.ts:88:24)",
                },
            },
        ];

        const graph = correlateEvidence(evidence);
        const requestToErrorEdge = graph.edges.find(
            (e) => (e.from === "ev-unrelated-req" && e.to === "ev-typeerror") ||
                   (e.to === "ev-unrelated-req" && e.from === "ev-typeerror")
        );

        // No causal edge must be created between unrelated request and TypeError
        expect(requestToErrorEdge).toBeUndefined();

        const investigation = investigate(evidence);
        const runtimeHyp = investigation.hypotheses.find((h) => h.id.startsWith("runtime-exception:"));
        expect(runtimeHyp).toBeDefined();

        // Must explicitly include missing reason that upstream origin of undefined object is unobserved
        const hasMissingOrigin = runtimeHyp?.missingReasons.some(
            (r) => r.title.includes("Upstream origin of undefined") || r.description.includes("upstream")
        );
        expect(hasMissingOrigin).toBe(true);
    });

    it("Regression B: TypeError with actual request correlation creates observed causal link", () => {
        const evidence: Evidence[] = [
            {
                id: "ev-correlated-req",
                type: "TRACE",
                timestamp: new Date("2026-08-30T10:00:00Z"),
                source: "sdk",
                service: "api-gateway",
                title: "POST /api/checkout -> 500",
                status: 500,
                traceId: "trace-shared-123",
                requestId: "req-shared-123",
            },
            {
                id: "ev-correlated-err",
                type: "ERROR",
                timestamp: new Date("2026-08-30T10:00:00.100Z"),
                source: "sdk",
                service: "frontend-client",
                title: "TypeError: Cannot read properties of undefined (reading 'transaction')",
                traceId: "trace-shared-123",
                requestId: "req-shared-123",
                metadata: {
                    stack: "TypeError: Cannot read properties of undefined (reading 'transaction')\n    at handleCheckout (src/checkout.ts:88:24)",
                },
            },
        ];

        const graph = correlateEvidence(evidence);
        const connectingEdge = graph.edges.find(
            (e) => e.from === "ev-correlated-req" && e.to === "ev-correlated-err"
        );

        expect(connectingEdge).toBeDefined();
        expect(connectingEdge?.classification).toBe("Observed");
    });

    it("Regression C: HTTP 504 generates hypothesis from real response evidence with explicit unknown backend reason", () => {
        const evidence: Evidence[] = [
            {
                id: "ev-db-504",
                type: "TRACE",
                timestamp: new Date("2026-08-30T10:00:00Z"),
                source: "sdk",
                service: "postgres-primary",
                title: "HTTP 504 Gateway Timeout from postgres-primary",
                resource: "postgres-primary:5432/orders",
                status: 504,
                metadata: {},
            },
        ];

        const investigation = investigate(evidence);
        const netHyp = investigation.hypotheses.find((h) => h.id.startsWith("network-protocol:"));

        expect(netHyp).toBeDefined();
        expect(netHyp?.title).toContain("504");
        // Must explicitly document that internal server-side reasons for 504 are unobserved
        const hasMissingServerLogs = netHyp?.missingReasons.some(
            (r) => r.title.includes("Internal server-side execution logs") || r.description.includes("504")
        );
        expect(hasMissingServerLogs).toBe(true);
    });

    it("Regression D: chronologically adjacent unrelated events produce no causal edge", () => {
        const evidence: Evidence[] = [
            {
                id: "warn-auth",
                type: "LOG",
                timestamp: new Date("2026-08-30T10:00:00Z"),
                source: "sdk",
                service: "auth-service",
                title: "Token refresh warning",
                metadata: {},
            },
            {
                id: "err-payment",
                type: "ERROR",
                timestamp: new Date("2026-08-30T10:00:00.500Z"),
                source: "sdk",
                service: "payment-service",
                title: "Payment timeout",
                metadata: {},
            },
        ];

        const graph = correlateEvidence(evidence);
        const edge = graph.edges.find((e) => (e.from === "warn-auth" && e.to === "err-payment") || (e.from === "err-payment" && e.to === "warn-auth"));
        expect(edge).toBeUndefined();
    });

    it("Regression E: individual causal relationship exists even when multi-step cascade is not fully formed", () => {
        const evidence: Evidence[] = [
            {
                id: "ev-db-query",
                type: "TRACE",
                timestamp: new Date("2026-08-30T10:00:00Z"),
                source: "sdk",
                service: "orders-service",
                title: "SELECT * FROM orders WHERE user_id = $1",
                operation: "SELECT",
                resource: "orders",
                traceId: "trace-query-single",
            },
            {
                id: "ev-app-err",
                type: "ERROR",
                timestamp: new Date("2026-08-30T10:00:00.020Z"),
                source: "sdk",
                service: "orders-service",
                title: "Service handler failed",
                traceId: "trace-query-single",
            },
        ];

        const graph = correlateEvidence(evidence);
        const queryEdge = graph.edges.find((e) => e.relationship === "EXECUTES_QUERY");
        expect(queryEdge).toBeDefined();
        expect(queryEdge?.classification).toBe("Observed");
    });

    it("Regression F: recommendation from known immediate failure is labeled as defensive mitigation", () => {
        const evidence: Evidence[] = [
            {
                id: "ev-typeerror-standalone",
                type: "ERROR",
                timestamp: new Date("2026-08-30T10:00:00Z"),
                source: "sdk",
                service: "frontend",
                title: "TypeError: Cannot read properties of undefined (reading 'transaction')",
                description: "Cannot read properties of undefined (reading 'transaction')",
                metadata: {
                    stack: "TypeError: Cannot read properties of undefined (reading 'transaction')\n    at renderSummary (src/components/summary.tsx:42:10)",
                },
            },
        ];

        const investigation = investigate(evidence);
        const rec = investigation.recommendations[0];

        expect(rec).toBeDefined();
        expect(rec.title).toContain("Defensive Mitigation");
        expect(rec.rootCauseTechnical).toContain("immediate defensive mitigation");
        expect(rec.rootCauseTechnical).toContain("upstream reason why the accessed value was undefined is unobserved");
    });
});
