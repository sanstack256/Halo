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
            investigation.rootCause?.status
        ).toBe("VALIDATED");

        expect(
            investigation.rootCause?.supportingReasons.length
        ).toBeGreaterThanOrEqual(3);

        expect(
            investigation.rootCause?.score.positive
        ).toBeGreaterThan(0);

        expect(
            investigation.rootCause?.confidence
        ).toBeGreaterThanOrEqual(70);
    });

    it("does not validate deployment regression when the failure is isolated to another service", () => {
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

        const deploymentHypothesis =
            result.hypotheses.find(
                hypothesis =>
                    hypothesis.title ===
                    "Deployment Regression"
            );

        expect(
            deploymentHypothesis
        ).toBeDefined();

        expect(
            deploymentHypothesis?.confidence
        ).toBeLessThan(70);

        expect(
            deploymentHypothesis?.status
        ).not.toBe("VALIDATED");

        expect(
            result.rootCause
        ).toBeNull();

        expect(
            deploymentHypothesis
                ?.contradictingReasons
                .length
        ).toBeGreaterThan(0);
    });

    it("identifies a shared dependency failure across services", () => {
        const evidence: Evidence[] = [
            {
                id: "deployment",
                type: "DEPLOYMENT",
                timestamp: new Date(
                    "2026-08-08T13:40:00"
                ),
                source: "vercel",
                service: "payment",
                title: "Payment deployment",
                description:
                    "Production deployment",
                release: "v1.2.0",
                metadata: {},
            },

            {
                id: "payment-error",
                type: "ERROR",
                timestamp: new Date(
                    "2026-08-08T13:41:00"
                ),
                source: "sdk",
                service: "payment",
                title: "Payment timeout",
                description:
                    "Database connection timeout",
                resource: "postgres-primary",
                metadata: {},
            },

            {
                id: "checkout-error",
                type: "ERROR",
                timestamp: new Date(
                    "2026-08-08T13:41:05"
                ),
                source: "sdk",
                service: "checkout",
                title: "Checkout failure",
                description:
                    "Database connection timeout",
                resource: "postgres-primary",
                metadata: {},
            },

            {
                id: "auth-error",
                type: "ERROR",
                timestamp: new Date(
                    "2026-08-08T13:41:10"
                ),
                source: "sdk",
                service: "auth",
                title: "Authentication failure",
                description:
                    "Database connection timeout",
                resource: "postgres-primary",
                metadata: {},
            },

            {
                id: "db-metric",
                type: "METRIC",
                timestamp: new Date(
                    "2026-08-08T13:41:15"
                ),
                source: "postgres",
                service: "database",
                title: "Connection exhaustion",
                description:
                    "Database connection pool reached capacity.",
                resource: "postgres-primary",
                value: 100,
                metadata: {},
            },
        ];

        const investigation =
            investigate(evidence);

        const sharedDependency =
            investigation.hypotheses.find(
                hypothesis =>
                    hypothesis.title ===
                    "Shared Dependency Failure"
            );

        expect(
            sharedDependency
        ).toBeDefined();

        expect(
            sharedDependency?.supportingReasons.length
        ).toBeGreaterThan(0);

        expect(
            sharedDependency?.evidenceIds
        ).toContain("payment-error");

        expect(
            sharedDependency?.evidenceIds
        ).toContain("checkout-error");

        expect(
            sharedDependency?.evidenceIds
        ).toContain("auth-error");
    });
    it("prefers a stronger shared dependency explanation over a coincidental deployment", () => {
        const evidence: Evidence[] = [
            {
                id: "deployment",
                type: "DEPLOYMENT",
                timestamp: new Date(
                    "2026-08-08T13:40:00"
                ),
                source: "vercel",
                service: "payment",
                title: "Payment deployment",
                description:
                    "Production deployment",
                release: "v1.3.0",
                metadata: {},
            },

            {
                id: "payment-error",
                type: "ERROR",
                timestamp: new Date(
                    "2026-08-08T13:41:00"
                ),
                source: "sdk",
                service: "payment",
                title: "Payment timeout",
                description:
                    "Database connection timeout",
                resource: "postgres-primary",
                metadata: {},
            },

            {
                id: "checkout-error",
                type: "ERROR",
                timestamp: new Date(
                    "2026-08-08T13:41:02"
                ),
                source: "sdk",
                service: "checkout",
                title: "Checkout failure",
                description:
                    "Database connection timeout",
                resource: "postgres-primary",
                metadata: {},
            },

            {
                id: "auth-error",
                type: "ERROR",
                timestamp: new Date(
                    "2026-08-08T13:41:04"
                ),
                source: "sdk",
                service: "auth",
                title: "Authentication failure",
                description:
                    "Database connection timeout",
                resource: "postgres-primary",
                metadata: {},
            },

            {
                id: "database-error",
                type: "ERROR",
                timestamp: new Date(
                    "2026-08-08T13:41:05"
                ),
                source: "postgres",
                service: "database",
                title: "Connection pool exhausted",
                description:
                    "Postgres connection pool reached capacity.",
                resource: "postgres-primary",
                metadata: {},
            },

            {
                id: "database-metric",
                type: "METRIC",
                timestamp: new Date(
                    "2026-08-08T13:41:06"
                ),
                source: "postgres",
                service: "database",
                title: "Connection exhaustion",
                description:
                    "Database connection pool reached capacity.",
                resource: "postgres-primary",
                value: 100,
                metadata: {},
            },
        ];

        const investigation =
            investigate(evidence);

        const sharedDependency =
            investigation.hypotheses.find(
                hypothesis =>
                    hypothesis.title ===
                    "Shared Dependency Failure"
            );

        expect(
            sharedDependency
        ).toBeDefined();

        expect(
            investigation.hypotheses[0]?.title
        ).toBe(
            "Shared Dependency Failure"
        );

        expect(
            investigation.rootCause?.title
        ).toBe(
            "Shared Dependency Failure"
        );
    });
});