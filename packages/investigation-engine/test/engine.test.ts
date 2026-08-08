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

    it("strengthens deployment regression when rollback is followed by recovery", () => {
        const evidence: Evidence[] = [
            {
                id: "deployment",
                type: "DEPLOYMENT",
                timestamp: new Date(
                    "2026-08-08T13:40:00"
                ),
                source: "vercel",
                service: "payment",
                title: "Deployment v1.3.0",
                description:
                    "Production deployment",
                release: "v1.3.0",
                metadata: {},
            },

            {
                id: "error-1",
                type: "ERROR",
                timestamp: new Date(
                    "2026-08-08T13:41:00"
                ),
                source: "sdk",
                service: "payment",
                title: "Payment timeout",
                description:
                    "Payment requests are timing out.",
                metadata: {},
            },

            {
                id: "rollback",
                type: "DEPLOYMENT",
                timestamp: new Date(
                    "2026-08-08T13:43:00"
                ),
                source: "vercel",
                service: "payment",
                title: "Rollback v1.3.0",
                description:
                    "Rolled back the production deployment.",
                release: "v1.2.0",
                metadata: {},
            },

            {
                id: "recovery",
                type: "METRIC",
                timestamp: new Date(
                    "2026-08-08T13:44:00"
                ),
                source: "monitoring",
                service: "payment",
                title: "Error rate recovered",
                description:
                    "Payment error rate returned to normal after rollback.",
                value: 0.01,
                metadata: {},
            },
        ];

        const investigation =
            investigate(evidence);

        const deploymentHypothesis =
            investigation.hypotheses.find(
                hypothesis =>
                    hypothesis.title ===
                    "Deployment Regression"
            );

        expect(
            deploymentHypothesis
        ).toBeDefined();

        expect(
            deploymentHypothesis?.confidence
        ).toBeGreaterThanOrEqual(70);

        expect(
            deploymentHypothesis?.supportingReasons.some(
                reason =>
                    reason.causalRole ===
                    "CAUSE" ||
                    reason.causalRole ===
                    "MECHANISM"
            )
        ).toBe(true);

        expect(
            deploymentHypothesis?.evidenceIds
        ).toContain("rollback");

        expect(
            deploymentHypothesis?.evidenceIds
        ).toContain("recovery");

        expect(
            investigation.rootCause?.title
        ).toBe(
            "Deployment Regression"
        );
    });

    it("weakens deployment regression when errors existed before deployment", () => {
        const evidence: Evidence[] = [
            {
                id: "pre-existing-error",
                type: "ERROR",
                timestamp: new Date(
                    "2026-08-08T13:35:00"
                ),
                source: "sdk",
                service: "payment",
                title: "Payment timeout",
                description:
                    "Payment request timed out before the deployment.",
                metadata: {},
            },

            {
                id: "deployment",
                type: "DEPLOYMENT",
                timestamp: new Date(
                    "2026-08-08T13:40:00"
                ),
                source: "vercel",
                service: "payment",
                title: "Deployment v1.3.0",
                description:
                    "Production deployment",
                release: "v1.3.0",
                metadata: {},
            },

            {
                id: "error-1",
                type: "ERROR",
                timestamp: new Date(
                    "2026-08-08T13:41:00"
                ),
                source: "sdk",
                service: "payment",
                title: "Payment timeout",
                description:
                    "Payment request timed out.",
                metadata: {},
            },

            {
                id: "error-2",
                type: "ERROR",
                timestamp: new Date(
                    "2026-08-08T13:42:00"
                ),
                source: "sdk",
                service: "payment",
                title: "Payment timeout",
                description:
                    "Payment request timed out.",
                metadata: {},
            },
        ];

        const investigation =
            investigate(evidence);

        const deploymentHypothesis =
            investigation.hypotheses.find(
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
            investigation.rootCause?.title
        ).not.toBe(
            "Deployment Regression"
        );
    });

    it("recognizes broad cross-service failure without inventing a shared dependency", () => {
        const evidence: Evidence[] = [
            {
                id: "payment-error",
                type: "ERROR",
                timestamp: new Date(
                    "2026-08-08T13:42:10"
                ),
                source: "sdk",
                service: "payment",
                title: "Payment timeout",
                description:
                    "Payment request timed out.",
                metadata: {},
            },

            {
                id: "auth-error",
                type: "ERROR",
                timestamp: new Date(
                    "2026-08-08T13:42:15"
                ),
                source: "sdk",
                service: "auth",
                title: "Authentication failure",
                description:
                    "Authentication requests failed.",
                metadata: {},
            },

            {
                id: "orders-error",
                type: "ERROR",
                timestamp: new Date(
                    "2026-08-08T13:42:20"
                ),
                source: "sdk",
                service: "orders",
                title: "Order creation failed",
                description:
                    "Order creation requests failed.",
                metadata: {},
            },
        ];

        const investigation =
            investigate(evidence);

        expect(
            investigation.hypotheses
                .some(
                    hypothesis =>
                        hypothesis.title ===
                        "Shared Dependency Failure"
                )
        ).toBe(false);

        expect(
            investigation.hypotheses.length
        ).toBeGreaterThan(0);
    });

    it("does not invent a root cause when evidence is insufficient", () => {
        const evidence: Evidence[] = [
            {
                id: "log-1",

                type: "LOG",

                timestamp: new Date(
                    "2026-08-08T13:42:00"
                ),

                source: "sdk",

                service: "payment",

                title: "Request received",

                description:
                    "Payment request received",

                metadata: {},
            },
        ];

        const investigation =
            investigate(evidence);

        expect(
            investigation.hypotheses.length
        ).toBe(0);

        expect(
            investigation.rootCause
        ).toBeNull();

        expect(
            investigation.status
        ).toBe("UNCERTAIN");
    });

    it("does not blame a deployment when no failure follows it", () => {
        const evidence: Evidence[] = [
            {
                id: "deployment",
                type: "DEPLOYMENT",
                timestamp: new Date(
                    "2026-08-08T13:42:00"
                ),
                source: "vercel",
                service: "payment",
                title: "Deployment v1.3.0",
                description:
                    "Successful production deployment",
                metadata: {},
            },

            {
                id: "log-1",
                type: "LOG",
                timestamp: new Date(
                    "2026-08-08T13:45:00"
                ),
                source: "sdk",
                service: "payment",
                title: "Payment request completed",
                description:
                    "Payment request completed successfully",
                status: 200,
                metadata: {},
            },
        ];

        const investigation =
            investigate(evidence);

        const deploymentHypothesis =
            investigation.hypotheses.find(
                hypothesis =>
                    hypothesis.title ===
                    "Deployment Regression"
            );

        expect(
            deploymentHypothesis
        ).toBeUndefined();

        expect(
            investigation.rootCause
        ).toBeNull();

        expect(
            investigation.status
        ).toBe("UNCERTAIN");
    });

    it("does not merge unrelated errors into one explanation", () => {
        const evidence: Evidence[] = [
            {
                id: "payment-error",
                type: "ERROR",
                timestamp: new Date(
                    "2026-08-08T13:42:00"
                ),
                source: "sdk",
                service: "payment",
                title: "Payment timeout",
                description:
                    "Stripe request timed out",
                metadata: {},
            },

            {
                id: "auth-error",
                type: "ERROR",
                timestamp: new Date(
                    "2026-08-08T13:42:05"
                ),
                source: "sdk",
                service: "auth",
                title: "Invalid token",
                description:
                    "Authentication token rejected",
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
        ).toBeUndefined();

        expect(
            investigation.rootCause
        ).toBeNull();
    });

    it("strengthens a shared dependency hypothesis when multiple services fail on the same resource", () => {
        const timestamp =
            new Date("2026-08-08T13:42:00");

        const evidence: Evidence[] = [
            {
                id: "payment-error",
                type: "ERROR",
                timestamp,
                source: "sdk",
                service: "payment",
                title: "Database timeout",
                description:
                    "Payment query timed out",
                resource: "postgres-primary",
                metadata: {},
            },

            {
                id: "auth-error",
                type: "ERROR",
                timestamp: new Date(
                    "2026-08-08T13:42:05"
                ),
                source: "sdk",
                service: "auth",
                title: "Database timeout",
                description:
                    "Authentication query timed out",
                resource: "postgres-primary",
                metadata: {},
            },

            {
                id: "orders-error",
                type: "ERROR",
                timestamp: new Date(
                    "2026-08-08T13:42:10"
                ),
                source: "sdk",
                service: "orders",
                title: "Database timeout",
                description:
                    "Orders query timed out",
                resource: "postgres-primary",
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
            sharedDependency?.evidenceIds
        ).toEqual(
            expect.arrayContaining([
                "payment-error",
                "auth-error",
                "orders-error",
            ])
        );

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

    it("does not inflate confidence from duplicate evidence", () => {
        const evidence: Evidence[] = [
            {
                id: "error-1",
                type: "ERROR",
                timestamp: new Date(
                    "2026-08-08T13:42:00"
                ),
                source: "sdk",
                service: "payment",
                title: "Payment timeout",
                description:
                    "Stripe request timed out",
                metadata: {},
            },

            {
                id: "error-1-duplicate",
                type: "ERROR",
                timestamp: new Date(
                    "2026-08-08T13:42:00"
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

        const hypotheses =
            investigation.hypotheses;

        expect(
            hypotheses.length
        ).toBe(0);

        expect(
            investigation.rootCause
        ).toBeNull();

        expect(
            investigation.status
        ).toBe("UNCERTAIN");
    });

    it("identifies the deployment most closely associated with the failure", () => {
        const evidence: Evidence[] = [
            {
                id: "deployment-old",
                type: "DEPLOYMENT",
                timestamp: new Date(
                    "2026-08-08T13:00:00"
                ),
                source: "vercel",
                service: "payment",
                title: "Deployment v1.1",
                description:
                    "Production deployment",
                metadata: {},
            },

            {
                id: "deployment-middle",
                type: "DEPLOYMENT",
                timestamp: new Date(
                    "2026-08-08T13:20:00"
                ),
                source: "vercel",
                service: "payment",
                title: "Deployment v1.2",
                description:
                    "Production deployment",
                metadata: {},
            },

            {
                id: "deployment-relevant",
                type: "DEPLOYMENT",
                timestamp: new Date(
                    "2026-08-08T13:40:00"
                ),
                source: "vercel",
                service: "payment",
                title: "Deployment v1.3",
                description:
                    "Production deployment",
                metadata: {},
            },

            {
                id: "error-1",
                type: "ERROR",
                timestamp: new Date(
                    "2026-08-08T13:41:00"
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
                    "2026-08-08T13:41:10"
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

        const deploymentHypotheses =
            investigation.hypotheses.filter(
                hypothesis =>
                    hypothesis.title ===
                    "Deployment Regression"
            );

        expect(
            deploymentHypotheses.length
        ).toBeGreaterThan(0);

        console.dir(
            investigation.hypotheses,
            { depth: null }
        );

        expect(
            investigation.rootCause?.title
        ).toBe(
            "Deployment Regression"
        );

        expect(
            investigation.rootCause?.evidenceIds
        ).toContain(
            "deployment-relevant"
        );
    });

});