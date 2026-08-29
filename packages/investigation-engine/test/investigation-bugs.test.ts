import { describe, expect, it } from "vitest";
import { investigate } from "../src";
import type { Evidence } from "../src";

describe("Investigation Bug Fixes & Regression Verification", () => {
    it("handles SyntaxError following GET /dependency-failure HTTP 500 without hardcoding TypeError", () => {
        const evidence: Evidence[] = [
            {
                id: "http-request-1",
                type: "TRACE",
                timestamp: new Date("2026-08-29T12:00:00Z"),
                source: "sdk",
                service: "frontend-client",
                title: "GET /dependency-failure -> 500",
                description: "HTTP request returned 500 Internal Server Error",
                resource: "/dependency-failure",
                operation: "GET /dependency-failure",
                status: 500,
                durationMs: 142,
                traceId: "trace-xyz-123",
                metadata: {
                    durationMs: 142,
                },
            },
            {
                id: "client-error-1",
                type: "ERROR",
                timestamp: new Date("2026-08-29T12:00:00.150Z"),
                source: "sdk",
                service: "browser",
                title: "SyntaxError: Unexpected end of JSON input",
                description: "SyntaxError: Unexpected end of JSON input at JSON.parse (<anonymous>)",
                traceId: "trace-xyz-123",
                metadata: {
                    stack: "SyntaxError: Unexpected end of JSON input\n    at JSON.parse (<anonymous>)\n    at fetchData (http://localhost:3000/app.js:42:15)",
                },
            },
        ];

        const result = investigate(evidence);

        // Status should be ANALYSIS_COMPLETE instead of CONCLUDED (because exact backend cause is unknown)
        expect(result.status).toBe("ANALYSIS_COMPLETE");
        expect(result.rootCause).toBeDefined();

        // Hypothesis should be cascading failure
        expect(result.rootCause?.id).toContain("cascading-failure");

        // The title/description must NOT claim TypeError or 'Cannot read properties'
        expect(result.rootCause?.description).not.toContain("TypeError");
        expect(result.rootCause?.description).not.toContain("Cannot read properties");
        expect(result.rootCause?.description).toContain("SyntaxError: Unexpected end of JSON input");

        // Recommendations should exist and not have hardcoded TypeError strings
        expect(result.recommendations.length).toBeGreaterThan(0);
        const primaryRec = result.recommendations[0];
        expect(primaryRec.verification.steps.join(" ")).not.toContain("Cannot read properties of undefined");
        expect(primaryRec.verification.steps.join(" ")).toContain("SyntaxError: Unexpected end of JSON input");
    });

    it("correctly marks status as UNCERTAIN when no root cause is found", () => {
        const result = investigate([]);
        expect(result.status).toBe("UNCERTAIN");
        expect(result.rootCause).toBeNull();
    });

    it("properly identifies client errors with different error classes in cascading failures", () => {
        const errorClasses = [
            "ReferenceError: x is not defined",
            "URIError: URI malformed",
            "RangeError: Invalid array length",
        ];

        for (const errTitle of errorClasses) {
            const evidence: Evidence[] = [
                {
                    id: "req-1",
                    type: "TRACE",
                    timestamp: new Date("2026-08-29T12:00:00Z"),
                    source: "sdk",
                    service: "browser",
                    title: "POST /api/action -> 502",
                    resource: "/api/action",
                    operation: "POST /api/action",
                    status: 502,
                },
                {
                    id: "err-1",
                    type: "ERROR",
                    timestamp: new Date("2026-08-29T12:00:00.050Z"),
                    source: "sdk",
                    service: "browser",
                    title: errTitle,
                },
            ];

            const result = investigate(evidence);
            expect(result.status).toBe("ANALYSIS_COMPLETE");
            expect(result.rootCause?.id).toContain("cascading-failure");
            expect(result.rootCause?.description).toContain(errTitle);
            expect(result.rootCause?.description).not.toContain("TypeError");
        }
    });
});
