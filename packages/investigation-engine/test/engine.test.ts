import { describe, expect, it } from "vitest";

import { investigate } from "../src";
import type { Evidence } from "../src";

describe("Investigation Engine", () => {
    it("detects deployment regression", () => {
        const evidence: Evidence[] = [
            {
                id: "deployment",

                type: "DEPLOYMENT",

                timestamp: new Date(
                    "2026-08-08T13:42:00"
                ),

                source: "vercel",

                service: "payment",

                title: "Deployment",

                description:
                    "Production deployment",

                metadata: {},
            },

            {
                id: "error-1",

                type: "ERROR",

                timestamp: new Date(
                    "2026-08-08T13:42:20"
                ),

                source: "sdk",

                service: "payment",

                title: "Payment timeout",

                description:
                    "Stripe request timed out",

                metadata: {},
            },

            {
                id: "error-2",

                type: "ERROR",

                timestamp: new Date(
                    "2026-08-08T13:42:30"
                ),

                source: "sdk",

                service: "payment",

                title: "Payment timeout",

                description:
                    "Stripe request timed out",

                metadata: {},
            },
        ];

        const investigation =
            investigate(evidence);

        expect(
            investigation.rootCause?.title
        ).toBe(
            "Deployment Regression"
        );

        expect(
            investigation.rootCause?.supportingReasons.length
        ).toBe(4);

        expect(
            investigation.rootCause?.score.positive
        ).toBe(100);
    });

    it("reduces confidence when errors occur in another service", () => {

        const evidence: Evidence[] = [

            {
                id: "deployment",
                type: "DEPLOYMENT",
                timestamp: new Date(),
                source: "vercel",
                service: "payment",
                title: "Deployment",
                metadata: {},
            },

            {
                id: "error",

                type: "ERROR",

                timestamp: new Date(),

                source: "sdk",

                service: "auth",

                title: "Unauthorized",

                metadata: {},
            },

        ];

        const result =
            investigate(evidence);

        expect(
            result.rootCause?.confidence
        ).toBeLessThan(100);

    });
});