import { describe, it, expect } from "vitest";
import {
    buildComprehensiveEvidenceGraph,
    type Evidence,
    type ComprehensiveEvidenceGraph,
} from "../src/index";

describe("Comprehensive Evidence Graph Builder", () => {
    it("constructs an occurrence-specific entity graph connecting error, stack frames, request, and release", () => {
        const errorEvidence: Evidence = {
            id: "err-1",
            type: "ERROR",
            title: "TypeError: Cannot read properties of undefined (reading 'items')",
            description: "at Checkout (app/checkout/page.tsx:45:12)",
            timestamp: new Date("2026-08-30T12:00:00Z"),
            service: "web-frontend",
            traceId: "trace-xyz-123",
            requestId: "req-abc-999",
            sessionId: "sess-user-001",
            release: "v1.4.2",
            metadata: {
                commitSha: "a1b2c3d4e5f67890",
            },
        };

        const requestEvidence: Evidence = {
            id: "req-1",
            type: "REQUEST",
            title: "GET /api/cart/items",
            description: "HTTP 500 Internal Server Error",
            timestamp: new Date("2026-08-30T11:59:59Z"),
            service: "cart-service",
            traceId: "trace-xyz-123",
            requestId: "req-abc-999",
            status: 500,
            durationMs: 140,
            operation: "GET",
            resource: "/api/cart/items",
        };

        const parsedStackFrames = [
            {
                functionName: "Checkout",
                filePath: "app/checkout/page.tsx",
                lineNumber: 45,
                isApplication: true,
            },
            {
                functionName: "renderCart",
                filePath: "app/checkout/cart.tsx",
                lineNumber: 22,
                isApplication: true,
            },
        ];

        const graph: ComprehensiveEvidenceGraph = buildComprehensiveEvidenceGraph({
            evidence: [errorEvidence, requestEvidence],
            incidentAnchorId: "err-1",
            sessionId: "sess-user-001",
            traceId: "trace-xyz-123",
            requestId: "req-abc-999",
            releaseVersion: "v1.4.2",
            commitSha: "a1b2c3d4e5f67890",
            failingLocation: {
                filePath: "app/checkout/page.tsx",
                lineNumber: 45,
                functionName: "Checkout",
            },
            replaySessionId: "replay-999",
            parsedStackFrames,
        });

        // Verify Nodes
        expect(graph.nodes.length).toBeGreaterThan(5);
        const nodeTypes = new Set(graph.nodes.map((n) => n.type));
        expect(nodeTypes.has("EXCEPTION")).toBe(true);
        expect(nodeTypes.has("STACK_FRAME")).toBe(true);
        expect(nodeTypes.has("FUNCTION")).toBe(true);
        expect(nodeTypes.has("SOURCE_FILE")).toBe(true);
        expect(nodeTypes.has("REQUEST")).toBe(true);
        expect(nodeTypes.has("TRACE")).toBe(true);
        expect(nodeTypes.has("RELEASE")).toBe(true);
        expect(nodeTypes.has("COMMIT")).toBe(true);
        expect(nodeTypes.has("USER_SESSION")).toBe(true);

        // Verify Anchor
        const anchorNode = graph.nodes.find((n) => n.isAnchor);
        expect(anchorNode).toBeDefined();
        expect(anchorNode?.id).toBe("exception-err-1");

        // Verify Relationships / Edges
        expect(graph.edges.length).toBeGreaterThan(4);
        const relTypes = new Set(graph.edges.map((e) => e.relationship));
        expect(relTypes.has("CALLED")).toBe(true);
        expect(relTypes.has("DEPENDS_ON")).toBe(true);
        expect(relTypes.has("CAUSED")).toBe(true);
        expect(relTypes.has("CORRELATED_WITH")).toBe(true);
        expect(relTypes.has("DEPLOYED_WITH")).toBe(true);
        expect(relTypes.has("REPRODUCED_BY")).toBe(true);

        // Verify Edge Explanations
        const requestEdge = graph.edges.find((e) => e.from === "request-req-1" && e.to === "exception-err-1");
        expect(requestEdge).toBeDefined();
        expect(requestEdge?.classification).toBe("Observed");
        expect(requestEdge?.explanation).toContain("shares correlation identifiers");

        // Verify Summary
        expect(graph.summary.observedCount).toBeGreaterThan(0);
    });

    it("handles sparse telemetry gracefully without fabricating edges", () => {
        const isolatedError: Evidence = {
            id: "err-sparse",
            type: "ERROR",
            title: "DatabaseConnectionTimeout",
            timestamp: new Date("2026-08-30T12:00:00Z"),
        };

        const graph = buildComprehensiveEvidenceGraph({
            evidence: [isolatedError],
            incidentAnchorId: "err-sparse",
        });

        expect(graph.nodes.length).toBe(1);
        expect(graph.nodes[0].type).toBe("EXCEPTION");
        expect(graph.edges.length).toBe(0);
        expect(graph.summary.totalEdges).toBe(0);
    });
});
