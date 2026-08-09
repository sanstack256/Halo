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

    it("weakens deployment regression when the failure extends across services", () => {
        const investigation = investigate([
            {
                id: "deployment-payment",
                type: "DEPLOYMENT",
                title: "Deploy payment service",
                description: "Payment service release",
                timestamp: new Date("2026-01-01T10:00:00Z"),
                service: "payment-service",
                source: "test",
                metadata: {},
            },
            {
                id: "payment-error",
                type: "ERROR",
                title: "Payment failed",
                description: "Payment requests are failing",
                timestamp: new Date("2026-01-01T10:01:00Z"),
                service: "payment-service",
                source: "test",
                metadata: {},
            },
            {
                id: "auth-error",
                type: "ERROR",
                title: "Authentication failed",
                description: "Authentication requests are failing",
                timestamp: new Date("2026-01-01T10:01:30Z"),
                service: "auth-service",
                source: "test",
                metadata: {},
            },
        ]);

        const deploymentHypothesis =
            investigation.hypotheses.find(
                hypothesis =>
                    hypothesis.title ===
                    "Deployment Regression"
            );

        expect(deploymentHypothesis).toBeDefined();

        expect(
            deploymentHypothesis?.contradictingReasons.some(
                reason =>
                    reason.title ===
                    "Cross-service impact weakens an isolated deployment explanation"
            )
        ).toBe(true);

        expect(
            deploymentHypothesis?.confidence
        ).toBeLessThan(70);

        expect(
            investigation.rootCause?.title
        ).not.toBe("Deployment Regression");
    });

    it("does not blame a deployment that occurred after the failure", () => {
        const investigation = investigate([
            {
                id: "payment-error",
                type: "ERROR",
                title: "Payment failed",
                description: "Payment requests are failing",
                timestamp: new Date("2026-01-01T10:00:00Z"),
                service: "payment-service",
                source: "test",
                metadata: {},
            },

            {
                id: "deployment-payment",
                type: "DEPLOYMENT",
                title: "Deploy payment service",
                description: "Payment service release",
                timestamp: new Date("2026-01-01T10:05:00Z"),
                service: "payment-service",
                source: "test",
                metadata: {},
            },
        ]);

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
            deploymentHypothesis?.contradictingReasons.some(
                reason =>
                    reason.title ===
                    "Error predates deployment"
            )
        ).toBe(true);

        expect(
            deploymentHypothesis?.confidence
        ).toBeLessThan(70);

        expect(
            deploymentHypothesis?.status
        ).not.toBe("VALIDATED");

        expect(
            investigation.rootCause?.title
        ).not.toBe("Deployment Regression");
    });

    it("uses rollback and recovery evidence as strong support for deployment regression", () => {
        const investigation = investigate([
            {
                id: "deployment-payment",
                type: "DEPLOYMENT",
                title: "Deploy payment service",
                description: "Payment service release",
                timestamp: new Date("2026-01-01T10:00:00Z"),
                service: "payment-service",
                source: "test",
                metadata: {},
            },

            {
                id: "payment-error",
                type: "ERROR",
                title: "Payment failed",
                description: "Payment requests are failing",
                timestamp: new Date("2026-01-01T10:01:00Z"),
                service: "payment-service",
                source: "test",
                metadata: {},
            },

            {
                id: "rollback-payment",
                type: "DEPLOYMENT",
                title: "Rollback payment service",
                description:
                    "Reverted payment service deployment",
                timestamp: new Date("2026-01-01T10:05:00Z"),
                service: "payment-service",
                source: "test",
                metadata: {},
            },
            {
                id: "payment-recovered",
                type: "LOG",
                title: "Payment service recovered",
                description:
                    "Payment failures stopped after rollback",
                timestamp: new Date("2026-01-01T10:06:00Z"),
                service: "payment-service",
                source: "test",
                status: "success",
                metadata: {},
            },
        ]);

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
            deploymentHypothesis?.supportingReasons.some(
                reason =>
                    reason.causalRole ===
                    "MECHANISM"
            )
        ).toBe(true);

        expect(
            deploymentHypothesis?.missingReasons.some(
                reason =>
                    reason.title ===
                    "Rollback or recovery evidence is unavailable"
            )
        ).toBe(false);

        expect(
            deploymentHypothesis?.confidence
        ).toBeGreaterThanOrEqual(70);

        expect(
            deploymentHypothesis?.status
        ).toBe("VALIDATED");

        expect(
            investigation.rootCause?.title
        ).toBe("Deployment Regression");
    });

    it(
        "does not treat rollback alone as proof of deployment regression",
        () => {
            const investigation = investigate([
                {
                    id: "deployment-payment",
                    type: "DEPLOYMENT",
                    title: "Deploy payment service",
                    description:
                        "Released payment service version 2.4.0",
                    timestamp:
                        new Date("2026-01-01T10:00:00Z"),
                    service: "payment-service",
                    source: "test",
                    metadata: {},
                },

                {
                    id: "payment-error",
                    type: "ERROR",
                    title: "Payment failed",
                    description:
                        "Payment requests are failing",
                    timestamp:
                        new Date("2026-01-01T10:01:00Z"),
                    service: "payment-service",
                    source: "test",
                    status: 500,
                    metadata: {},
                },

                {
                    id: "rollback-payment",
                    type: "DEPLOYMENT",
                    title: "Rollback payment service",
                    description:
                        "Reverted payment service deployment",
                    timestamp:
                        new Date("2026-01-01T10:05:00Z"),
                    service: "payment-service",
                    source: "test",
                    metadata: {},
                },
            ]);

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
                deploymentHypothesis?.supportingReasons.some(
                    reason =>
                        reason.causalRole ===
                        "MECHANISM"
                )
            ).toBe(false);

            expect(
                deploymentHypothesis?.status
            ).not.toBe("VALIDATED");

            expect(
                investigation.rootCause
            ).toBeNull();
        }
    );

    it("does not validate a deployment when strong contradicting evidence exists", () => {
        const deployment: Evidence = {
            id: "deployment-conflict",
            type: "DEPLOYMENT",
            timestamp: new Date("2026-01-01T10:00:00Z"),
            source: "halo-sdk",
            service: "checkout",
            title: "Deploy checkout v2",
            release: "v2",
            environment: "production",
            metadata: {},
        };

        const error1: Evidence = {
            id: "conflict-error-1",
            type: "ERROR",
            timestamp: new Date("2026-01-01T10:02:00Z"),
            source: "halo-sdk",
            service: "checkout",
            title: "Checkout request failed",
            release: "v2",
            environment: "production",
            metadata: {},
        };

        const error2: Evidence = {
            id: "conflict-error-2",
            type: "ERROR",
            timestamp: new Date("2026-01-01T10:03:00Z"),
            source: "halo-sdk",
            service: "checkout",
            title: "Checkout request failed",
            release: "v2",
            environment: "production",
            metadata: {},
        };

        const contradictingEvidence: Evidence = {
            id: "conflict-config",
            type: "CONFIG",
            timestamp: new Date("2026-01-01T09:59:00Z"),
            source: "config-service",
            service: "checkout",
            title: "Database connection pool exhausted",
            description:
                "The checkout service experienced database connection exhaustion before the deployment.",
            environment: "production",
            metadata: {},
        };

        const investigation = investigate([
            deployment,
            error1,
            error2,
            contradictingEvidence,
        ]);

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
            deploymentHypothesis?.status
        ).not.toBe("VALIDATED");

        expect(
            deploymentHypothesis?.contradictingReasons.length
        ).toBeGreaterThan(0);
    });

    it(
        "prefers a strong shared dependency over a strong deployment signal",
        () => {
            const investigation =
                investigate([
                    {
                        id: "deployment-checkout",
                        type: "DEPLOYMENT",
                        timestamp:
                            new Date(
                                "2026-01-01T10:00:00Z"
                            ),
                        source: "github",
                        service: "checkout",
                        title:
                            "Deploy checkout",
                        release: "checkout-42",
                        environment:
                            "production",
                        metadata: {},
                    },

                    {
                        id: "payment-error",
                        type: "ERROR",
                        timestamp:
                            new Date(
                                "2026-01-01T10:02:00Z"
                            ),
                        source: "halo-sdk",
                        service: "payment",
                        title:
                            "Payment request failed",
                        operation:
                            "payment.process",
                        resource:
                            "postgres-primary",
                        environment:
                            "production",
                        metadata: {},
                    },

                    {
                        id: "checkout-error",
                        type: "ERROR",
                        timestamp:
                            new Date(
                                "2026-01-01T10:03:00Z"
                            ),
                        source: "halo-sdk",
                        service: "checkout",
                        title:
                            "Checkout request failed",
                        operation:
                            "checkout.create",
                        resource:
                            "postgres-primary",
                        environment:
                            "production",
                        metadata: {},
                    },
                ]);

            const dependency =
                investigation.hypotheses.find(
                    hypothesis =>
                        hypothesis.title ===
                        "Shared Dependency Failure"
                );

            const deployment =
                investigation.hypotheses.find(
                    hypothesis =>
                        hypothesis.title ===
                        "Deployment Regression"
                );

            expect(dependency).toBeDefined();
            expect(deployment).toBeDefined();

            expect(
                dependency!.confidence
            ).toBeGreaterThan(
                deployment!.confidence
            );

            expect(
                investigation.rootCause?.title
            ).toBe(
                "Shared Dependency Failure"
            );
        }
    );

    it(
        "does not validate a shared dependency when the shared resource is not associated with the failures",
        () => {
            const investigation =
                investigate([
                    {
                        id: "payment-error",
                        type: "ERROR",
                        timestamp:
                            new Date(
                                "2026-01-01T10:02:00Z"
                            ),
                        source: "halo-sdk",
                        service: "payment",
                        title:
                            "Payment request failed",
                        operation:
                            "payment.process",
                        resource:
                            "payment-api",
                        environment:
                            "production",
                        metadata: {},
                    },

                    {
                        id: "checkout-error",
                        type: "ERROR",
                        timestamp:
                            new Date(
                                "2026-01-01T10:03:00Z"
                            ),
                        source: "halo-sdk",
                        service: "checkout",
                        title:
                            "Checkout request failed",
                        operation:
                            "checkout.create",
                        resource:
                            "checkout-api",
                        environment:
                            "production",
                        metadata: {},
                    },

                    {
                        id: "payment-log",
                        type: "LOG",
                        timestamp:
                            new Date(
                                "2026-01-01T10:02:30Z"
                            ),
                        source: "halo-sdk",
                        service: "payment",
                        title:
                            "Request completed",
                        resource:
                            "shared-observability",
                        environment:
                            "production",
                        metadata: {},
                    },

                    {
                        id: "checkout-log",
                        type: "LOG",
                        timestamp:
                            new Date(
                                "2026-01-01T10:03:30Z"
                            ),
                        source: "halo-sdk",
                        service: "checkout",
                        title:
                            "Request completed",
                        resource:
                            "shared-observability",
                        environment:
                            "production",
                        metadata: {},
                    },
                ]);

            const dependency =
                investigation.hypotheses.find(
                    hypothesis =>
                        hypothesis.title ===
                        "Shared Dependency Failure"
                );

            expect(dependency).toBeUndefined();

            expect(
                investigation.rootCause
            ).toBeNull();
        }
    );

    it(
        "does not invent a shared dependency when dependency identity is missing",
        () => {
            const investigation =
                investigate([
                    {
                        id: "payment-error",
                        type: "ERROR",
                        timestamp:
                            new Date(
                                "2026-01-01T10:02:00Z"
                            ),
                        source: "halo-sdk",
                        service: "payment",
                        title:
                            "Payment request failed",
                        environment:
                            "production",
                        metadata: {},
                    },

                    {
                        id: "checkout-error",
                        type: "ERROR",
                        timestamp:
                            new Date(
                                "2026-01-01T10:03:00Z"
                            ),
                        source: "halo-sdk",
                        service: "checkout",
                        title:
                            "Checkout request failed",
                        environment:
                            "production",
                        metadata: {},
                    },

                    {
                        id: "inventory-error",
                        type: "ERROR",
                        timestamp:
                            new Date(
                                "2026-01-01T10:04:00Z"
                            ),
                        source: "halo-sdk",
                        service: "inventory",
                        title:
                            "Inventory request failed",
                        environment:
                            "production",
                        metadata: {},
                    },
                ]);

            const dependency =
                investigation.hypotheses.find(
                    hypothesis =>
                        hypothesis.title ===
                        "Shared Dependency Failure"
                );

            expect(dependency).toBeUndefined();

            const crossService =
                investigation.hypotheses.find(
                    hypothesis =>
                        hypothesis.title ===
                        "Cross-Service Failure"
                );

            expect(
                crossService
            ).toBeDefined();
        }
    );


    it(
        "does not validate a deployment when the affected service provides contradictory evidence",
        () => {
            const investigation =
                investigate([
                    {
                        id: "deployment-api",
                        type: "DEPLOYMENT",
                        timestamp:
                            new Date(
                                "2026-01-01T10:00:00Z"
                            ),
                        source: "github",
                        service: "api",
                        title:
                            "Deploy api",
                        release: "api-42",
                        environment:
                            "production",
                        metadata: {},
                    },

                    {
                        id: "api-error",
                        type: "ERROR",
                        timestamp:
                            new Date(
                                "2026-01-01T10:02:00Z"
                            ),
                        source: "halo-sdk",
                        service: "api",
                        title:
                            "API request failed",
                        operation:
                            "GET /users",
                        environment:
                            "production",
                        metadata: {},
                    },

                    {
                        id: "api-success",
                        type: "LOG",
                        timestamp:
                            new Date(
                                "2026-01-01T10:02:30Z"
                            ),
                        source: "halo-sdk",
                        service: "api",
                        title:
                            "API requests continuing successfully",
                        operation:
                            "GET /users",
                        status: "success",
                        environment:
                            "production",
                        metadata: {},
                    },
                ]);

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
                deploymentHypothesis?.status
            ).not.toBe("VALIDATED");

            expect(
                investigation.rootCause
            ).toBeNull();
        }
    );

    it(
        "recommends investigating a deployment when deployment regression is the root cause",
        () => {
            const investigation =
                investigate([
                    {
                        id: "deployment-api",
                        type: "DEPLOYMENT",
                        timestamp:
                            new Date(
                                "2026-01-01T10:00:00Z"
                            ),
                        source: "github",
                        service: "api",
                        title:
                            "Deploy api",
                        release: "api-42",
                        environment:
                            "production",
                        metadata: {},
                    },

                    {
                        id: "api-error-1",
                        type: "ERROR",
                        timestamp:
                            new Date(
                                "2026-01-01T10:02:00Z"
                            ),
                        source: "halo-sdk",
                        service: "api",
                        title:
                            "API request failed",
                        operation:
                            "GET /users",
                        environment:
                            "production",
                        metadata: {},
                    },

                    {
                        id: "api-error-2",
                        type: "ERROR",
                        timestamp:
                            new Date(
                                "2026-01-01T10:03:00Z"
                            ),
                        source: "halo-sdk",
                        service: "api",
                        title:
                            "API request failed",
                        operation:
                            "GET /users",
                        environment:
                            "production",
                        metadata: {},
                    },

                    {
                        id: "rollback-api",
                        type: "DEPLOYMENT",
                        timestamp:
                            new Date(
                                "2026-01-01T10:05:00Z"
                            ),
                        source: "github",
                        service: "api",
                        title:
                            "Rollback api",
                        release: "api-41",
                        environment:
                            "production",
                        metadata: {},
                    },

                    {
                        id: "api-recovered",
                        type: "LOG",
                        timestamp:
                            new Date(
                                "2026-01-01T10:06:00Z"
                            ),
                        source: "halo-sdk",
                        service: "api",
                        title:
                            "API recovered",
                        status: "success",
                        environment:
                            "production",
                        metadata: {},
                    },
                ]);

            expect(
                investigation.rootCause?.title
            ).toBe(
                "Deployment Regression"
            );

            expect(
                investigation.recommendations.length
            ).toBeGreaterThan(0);
        }
    );

    it(
        "recognizes a failure that returns after a new deployment",
        () => {
            const investigation =
                investigate([
                    {
                        id: "deployment-v1",
                        type: "DEPLOYMENT",
                        timestamp: new Date(
                            "2026-01-01T10:00:00Z"
                        ),
                        source: "github",
                        service: "checkout",
                        title: "Deploy v1",
                        metadata: {},
                    },

                    {
                        id: "error-1",
                        type: "ERROR",
                        timestamp: new Date(
                            "2026-01-01T10:05:00Z"
                        ),
                        source: "halo-sdk",
                        service: "checkout",
                        title: "Checkout failures",
                        description:
                            "Checkout requests are failing.",
                        status: 500,
                        metadata: {},
                    },

                    {
                        id: "rollback-v1",
                        type: "DEPLOYMENT",
                        timestamp: new Date(
                            "2026-01-01T10:10:00Z"
                        ),
                        source: "github",
                        service: "checkout",
                        title: "Rollback v1",
                        metadata: {},
                    },

                    {
                        id: "recovery",
                        type: "METRIC",
                        timestamp: new Date(
                            "2026-01-01T10:12:00Z"
                        ),
                        source: "halo-sdk",
                        service: "checkout",
                        title: "Checkout recovered",
                        value: 0,
                        metadata: {},
                    },

                    {
                        id: "deployment-v2",
                        type: "DEPLOYMENT",
                        timestamp: new Date(
                            "2026-01-01T10:20:00Z"
                        ),
                        source: "github",
                        service: "checkout",
                        title: "Deploy v2",
                        metadata: {},
                    },

                    {
                        id: "error-2",
                        type: "ERROR",
                        timestamp: new Date(
                            "2026-01-01T10:25:00Z"
                        ),
                        source: "halo-sdk",
                        service: "checkout",
                        title: "Checkout failures returned",
                        description:
                            "Checkout requests are failing again.",
                        status: 500,
                        metadata: {},
                    },
                ]);

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
                deploymentHypothesis?.supportingReasons.some(
                    reason =>
                        reason.causalRole ===
                        "MECHANISM" &&
                        reason.title
                            .toLowerCase()
                            .includes("recovery")
                )
            ).toBe(true);
        }
    );


    it(
        "does not blame a deployment when another service owns the failure",
        () => {
            const investigation =
                investigate([
                    {
                        id: "deployment-checkout",
                        type: "DEPLOYMENT",
                        timestamp: new Date(
                            "2026-01-01T10:00:00Z"
                        ),
                        source: "github",
                        service: "checkout",
                        title: "Deploy checkout",
                        metadata: {},
                    },

                    {
                        id: "payment-error",
                        type: "ERROR",
                        timestamp: new Date(
                            "2026-01-01T10:03:00Z"
                        ),
                        source: "halo-sdk",
                        service: "payment",
                        title: "Payment failures",
                        description:
                            "Payment requests are failing.",
                        status: 500,
                        metadata: {},
                    },

                    {
                        id: "payment-error-2",
                        type: "ERROR",
                        timestamp: new Date(
                            "2026-01-01T10:04:00Z"
                        ),
                        source: "halo-sdk",
                        service: "payment",
                        title: "Payment failures continue",
                        description:
                            "Payment requests continue to fail.",
                        status: 500,
                        metadata: {},
                    },
                ]);

            const deploymentHypothesis =
                investigation.hypotheses.find(
                    hypothesis =>
                        hypothesis.title ===
                        "Deployment Regression" &&
                        hypothesis.evidenceIds.includes(
                            "deployment-checkout"
                        )
                );

            expect(
                deploymentHypothesis
            ).toBeDefined();

            expect(
                deploymentHypothesis?.status
            ).not.toBe("VALIDATED");

            expect(
                investigation.rootCause
            ).toBeNull();
        }
    );

    it(
        "prefers a shared dependency when deployments are coincidental",
        () => {
            const investigation =
                investigate([
                    {
                        id: "deployment-checkout",
                        type: "DEPLOYMENT",
                        timestamp: new Date(
                            "2026-01-01T10:00:00Z"
                        ),
                        source: "github",
                        service: "checkout",
                        title: "Deploy checkout",
                        metadata: {},
                    },

                    {
                        id: "deployment-payment",
                        type: "DEPLOYMENT",
                        timestamp: new Date(
                            "2026-01-01T10:01:00Z"
                        ),
                        source: "github",
                        service: "payment",
                        title: "Deploy payment",
                        metadata: {},
                    },

                    {
                        id: "checkout-error",
                        type: "ERROR",
                        timestamp: new Date(
                            "2026-01-01T10:05:00Z"
                        ),
                        source: "halo-sdk",
                        service: "checkout",
                        title: "Checkout database error",
                        description:
                            "Checkout cannot reach the database.",
                        status: 500,
                        resource: "postgres-primary",
                        operation:
                            "checkout.create",
                        metadata: {},
                    },

                    {
                        id: "payment-error",
                        type: "ERROR",
                        timestamp: new Date(
                            "2026-01-01T10:06:00Z"
                        ),
                        source: "halo-sdk",
                        service: "payment",
                        title: "Payment database error",
                        description:
                            "Payment cannot reach the database.",
                        status: 500,
                        resource: "postgres-primary",
                        operation:
                            "payment.process",
                        metadata: {},
                    },
                ]);

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
                investigation.rootCause?.title
            ).toBe(
                "Shared Dependency Failure"
            );
        }
    );


    it(
        "does not infer a shared dependency from simultaneous failures alone",
        () => {
            const investigation =
                investigate([
                    {
                        id: "checkout-error",
                        type: "ERROR",
                        timestamp: new Date(
                            "2026-01-01T10:05:00Z"
                        ),
                        source: "halo-sdk",
                        service: "checkout",
                        title: "Checkout database error",
                        status: 500,
                        resource: "checkout-db",
                        operation:
                            "checkout.create",
                        metadata: {},
                    },

                    {
                        id: "payment-error",
                        type: "ERROR",
                        timestamp: new Date(
                            "2026-01-01T10:05:30Z"
                        ),
                        source: "halo-sdk",
                        service: "payment",
                        title: "Payment database error",
                        status: 500,
                        resource: "payment-db",
                        operation:
                            "payment.process",
                        metadata: {},
                    },
                ]);

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
        }

    );

    it(
        "uses a related error cluster as evidence for a failure hypothesis",
        () => {
            const investigation = investigate([
                {
                    id: "deployment-checkout",
                    type: "DEPLOYMENT",
                    timestamp: new Date(
                        "2026-01-01T09:59:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Checkout deployment",
                    metadata: {},
                },

                {
                    id: "error-1",
                    type: "ERROR",
                    timestamp: new Date(
                        "2026-01-01T10:00:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Database connection failed",
                    operation: "POST /checkout",
                    resource: "checkout-db",
                    status: 500,
                    metadata: {},
                },

                {
                    id: "error-2",
                    type: "ERROR",
                    timestamp: new Date(
                        "2026-01-01T10:00:05Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Database connection failed",
                    operation: "POST /checkout",
                    resource: "checkout-db",
                    status: 500,
                    metadata: {},
                },

                {
                    id: "error-3",
                    type: "ERROR",
                    timestamp: new Date(
                        "2026-01-01T10:00:10Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Database connection failed",
                    operation: "POST /checkout",
                    resource: "checkout-db",
                    status: 500,
                    metadata: {},
                },
            ]);

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
                deploymentHypothesis?.findingIds
            ).toContain(
                "error-cluster:deployment-checkout"
            );

            expect(
                deploymentHypothesis?.evidenceIds
            ).toEqual(
                expect.arrayContaining([
                    "error-1",
                    "error-2",
                    "error-3",
                ])
            );
        }
    );

    it(
        "does not cluster unrelated errors from different services",
        () => {
            const investigation = investigate([
                {
                    id: "error-checkout",
                    type: "ERROR",
                    timestamp: new Date(
                        "2026-01-01T10:00:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Database connection failed",
                    operation: "POST /checkout",
                    resource: "checkout-db",
                    status: 500,
                    metadata: {},
                },

                {
                    id: "error-payment",
                    type: "ERROR",
                    timestamp: new Date(
                        "2026-01-01T10:00:05Z"
                    ),
                    source: "halo-sdk",
                    service: "payment",
                    title: "Payment provider timeout",
                    operation: "POST /payment",
                    resource: "stripe-api",
                    status: 504,
                    metadata: {},
                },
            ]);

            const clusterFinding =
                investigation.hypotheses
                    .flatMap(
                        hypothesis =>
                            hypothesis.findingIds
                    )
                    .find(
                        findingId =>
                            findingId.startsWith(
                                "error-cluster:"
                            )
                    );

            if (clusterFinding) {
                const clusterHypothesis =
                    investigation.hypotheses.find(
                        hypothesis =>
                            hypothesis.findingIds.includes(
                                clusterFinding
                            )
                    );

                expect(
                    clusterHypothesis?.evidenceIds
                ).not.toEqual(
                    expect.arrayContaining([
                        "error-checkout",
                        "error-payment",
                    ])
                );
            }
        }
    );

    it(
        "keeps repeated related errors in a single failure cluster",
        () => {
            const investigation = investigate([
                {
                    id: "error-1",
                    type: "ERROR",
                    timestamp: new Date(
                        "2026-01-01T10:00:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Database connection failed",
                    operation: "POST /checkout",
                    resource: "checkout-db",
                    status: 500,
                    metadata: {},
                },

                {
                    id: "error-2",
                    type: "ERROR",
                    timestamp: new Date(
                        "2026-01-01T10:00:05Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Database connection failed",
                    operation: "POST /checkout",
                    resource: "checkout-db",
                    status: 500,
                    metadata: {},
                },

                {
                    id: "error-3",
                    type: "ERROR",
                    timestamp: new Date(
                        "2026-01-01T10:00:10Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Database connection failed",
                    operation: "POST /checkout",
                    resource: "checkout-db",
                    status: 500,
                    metadata: {},
                },
            ]);

            const clusterFindings =
                investigation.hypotheses
                    .flatMap(
                        hypothesis =>
                            hypothesis.findingIds
                    )
                    .filter(
                        findingId =>
                            findingId.startsWith(
                                "error-cluster:"
                            )
                    );

            expect(
                new Set(clusterFindings).size
            ).toBeLessThanOrEqual(1);
        }
    );

    it(
        "does not cluster identical errors separated by a long time",
        () => {
            const investigation = investigate([
                {
                    id: "error-1",
                    type: "ERROR",
                    timestamp: new Date(
                        "2026-01-01T10:00:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Database connection failed",
                    operation: "POST /checkout",
                    resource: "checkout-db",
                    status: 500,
                    metadata: {},
                },

                {
                    id: "error-2",
                    type: "ERROR",
                    timestamp: new Date(
                        "2026-01-01T18:00:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Database connection failed",
                    operation: "POST /checkout",
                    resource: "checkout-db",
                    status: 500,
                    metadata: {},
                },
            ]);

            const clusterFindings =
                investigation.hypotheses
                    .flatMap(
                        hypothesis =>
                            hypothesis.findingIds
                    )
                    .filter(
                        findingId =>
                            findingId.startsWith(
                                "error-cluster:"
                            )
                    );

            if (clusterFindings.length > 0) {
                const hypotheses =
                    investigation.hypotheses.filter(
                        hypothesis =>
                            hypothesis.findingIds.some(
                                findingId =>
                                    findingId.startsWith(
                                        "error-cluster:"
                                    )
                            )
                    );

                for (const hypothesis of hypotheses) {
                    expect(
                        hypothesis.evidenceIds
                    ).not.toEqual(
                        expect.arrayContaining([
                            "error-1",
                            "error-2",
                        ])
                    );
                }
            }
        }
    );

    it(
        "does not infer a root cause from a metric anomaly alone",
        () => {
            const investigation = investigate([
                {
                    id: "latency-spike",
                    type: "METRIC",
                    timestamp: new Date(
                        "2026-01-01T10:00:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Checkout latency increased",
                    operation: "POST /checkout",
                    resource: "checkout-api",
                    value: 2400,
                    tags: {
                        metric: "latency",
                        unit: "ms",
                    },
                    metadata: {},
                },
            ]);

            expect(
                investigation.rootCause
            ).toBeNull();
        }
    );

    it(
        "uses a metric anomaly to strengthen an existing failure hypothesis",
        () => {
            const investigation = investigate([
                {
                    id: "deployment-checkout",
                    type: "DEPLOYMENT",
                    timestamp: new Date(
                        "2026-01-01T09:59:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Checkout deployment",
                    metadata: {},
                },

                {
                    id: "error-1",
                    type: "ERROR",
                    timestamp: new Date(
                        "2026-01-01T10:00:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Checkout request failed",
                    operation: "POST /checkout",
                    resource: "checkout-api",
                    status: 500,
                    metadata: {},
                },

                {
                    id: "error-2",
                    type: "ERROR",
                    timestamp: new Date(
                        "2026-01-01T10:00:05Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Checkout request failed",
                    operation: "POST /checkout",
                    resource: "checkout-api",
                    status: 500,
                    metadata: {},
                },

                {
                    id: "latency-spike",
                    type: "METRIC",
                    timestamp: new Date(
                        "2026-01-01T10:00:06Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Checkout latency increased",
                    operation: "POST /checkout",
                    resource: "checkout-api",
                    value: 2400,
                    tags: {
                        metric: "latency",
                        unit: "ms",
                    },
                    metadata: {},
                },
            ]);

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
                deploymentHypothesis?.evidenceIds
            ).toEqual(
                expect.arrayContaining([
                    "deployment-checkout",
                    "error-1",
                    "error-2",
                ])
            );
        }
    );

    it(
        "does not use an unrelated metric anomaly to strengthen a deployment",
        () => {
            const investigation = investigate([
                {
                    id: "deployment-checkout",
                    type: "DEPLOYMENT",
                    timestamp: new Date(
                        "2026-01-01T09:59:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Checkout deployment",
                    metadata: {},
                },

                {
                    id: "error-checkout",
                    type: "ERROR",
                    timestamp: new Date(
                        "2026-01-01T10:00:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Checkout request failed",
                    operation: "POST /checkout",
                    resource: "checkout-api",
                    status: 500,
                    metadata: {},
                },

                {
                    id: "latency-payment",
                    type: "METRIC",
                    timestamp: new Date(
                        "2026-01-01T10:00:05Z"
                    ),
                    source: "halo-sdk",
                    service: "payment",
                    title: "Payment latency increased",
                    operation: "POST /payment",
                    resource: "payment-api",
                    value: 2400,
                    tags: {
                        metric: "latency",
                        unit: "ms",
                    },
                    metadata: {},
                },
            ]);

            const deploymentHypothesis =
                investigation.hypotheses.find(
                    hypothesis =>
                        hypothesis.title ===
                        "Deployment Regression"
                );

            if (deploymentHypothesis) {
                expect(
                    deploymentHypothesis.evidenceIds
                ).not.toContain(
                    "latency-payment"
                );
            }
        }
    );

    it(
        "uses a relevant metric anomaly to strengthen a deployment",
        () => {
            const investigation = investigate([
                {
                    id: "deployment-checkout",
                    type: "DEPLOYMENT",
                    timestamp: new Date(
                        "2026-01-01T09:59:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Checkout deployment",
                    metadata: {},
                },

                {
                    id: "error-checkout",
                    type: "ERROR",
                    timestamp: new Date(
                        "2026-01-01T10:00:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Checkout request failed",
                    operation: "POST /checkout",
                    resource: "checkout-api",
                    status: 500,
                    metadata: {},
                },

                {
                    id: "latency-checkout",
                    type: "METRIC",
                    timestamp: new Date(
                        "2026-01-01T10:00:05Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Checkout latency increased",
                    operation: "POST /checkout",
                    resource: "checkout-api",
                    value: 2400,
                    tags: {
                        metric: "latency",
                        unit: "ms",
                    },
                    metadata: {},
                },
            ]);

            const deploymentHypothesis =
                investigation.hypotheses.find(
                    hypothesis =>
                        hypothesis.title ===
                        "Deployment Regression"
                );

            expect(deploymentHypothesis).toBeDefined();

            expect(
                deploymentHypothesis?.evidenceIds
            ).toContain("latency-checkout");
        }
    );

    it(
        "reports the validated root cause",
        () => {
            const investigation = investigate([
                {
                    id: "deployment-checkout",
                    type: "DEPLOYMENT",
                    timestamp: new Date(
                        "2026-01-01T09:59:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Checkout deployment",
                    metadata: {},
                },

                {
                    id: "error-checkout",
                    type: "ERROR",
                    timestamp: new Date(
                        "2026-01-01T10:00:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Checkout request failed",
                    operation: "POST /checkout",
                    resource: "checkout-api",
                    status: 500,
                    metadata: {},
                },
            ]);

            expect(
                investigation.report
            ).toBeDefined();

            expect(
                investigation.report.rootCause
            ).not.toBeNull();

            expect(
                investigation.report.rootCause?.title
            ).toBe("Deployment Regression");

            expect(
                investigation.report.rootCause?.confidence
            ).toBeGreaterThan(0);

            expect(
                investigation.report.rootCause?.explanation
            ).toContain(
                "deployment"
            );
        }
    );

    it(
        "does not report a root cause when evidence is insufficient",
        () => {
            const investigation = investigate([
                {
                    id: "error-checkout",
                    type: "ERROR",
                    timestamp: new Date(
                        "2026-01-01T10:00:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Checkout request failed",
                    operation: "POST /checkout",
                    resource: "checkout-api",
                    status: 500,
                    metadata: {},
                },
            ]);

            expect(
                investigation.report
            ).toBeDefined();

            expect(
                investigation.report.rootCause
            ).toBeNull();

            expect(
                investigation.report.summary
            ).toContain(
                "does not have enough evidence"
            );
        }
    );

    it(
        "includes investigation next steps in the report",
        () => {
            const investigation = investigate([
                {
                    id: "deployment-checkout",
                    type: "DEPLOYMENT",
                    timestamp: new Date(
                        "2026-01-01T09:59:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Checkout deployment",
                    metadata: {},
                },

                {
                    id: "error-checkout",
                    type: "ERROR",
                    timestamp: new Date(
                        "2026-01-01T10:00:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Checkout request failed",
                    operation: "POST /checkout",
                    resource: "checkout-api",
                    status: 500,
                    metadata: {},
                },
            ]);

            expect(
                investigation.recommendations.length
            ).toBeGreaterThan(0);

            expect(
                investigation.report.nextSteps.length
            ).toBeGreaterThan(0);

            expect(
                investigation.report.nextSteps
            ).toEqual(
                expect.arrayContaining(
                    investigation.recommendations
                        .slice(0, 5)
                        .map(
                            recommendation =>
                                recommendation.title
                        )
                )
            );
        }
    );

    it(
        "correlates evidence belonging to the same trace and request",
        () => {
            const investigation = investigate([
                {
                    id: "request-start",
                    type: "TRACE",
                    timestamp: new Date(
                        "2026-01-01T10:00:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Checkout request",
                    traceId: "trace-123",
                    requestId: "request-123",
                    metadata: {},
                },

                {
                    id: "request-error",
                    type: "ERROR",
                    timestamp: new Date(
                        "2026-01-01T10:00:01Z"
                    ),
                    source: "halo-sdk",
                    service: "payment",
                    title: "Payment request failed",
                    traceId: "trace-123",
                    requestId: "request-123",
                    metadata: {},
                },
            ]);

            expect(
                investigation.graph.edges
            ).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        from: "request-start",
                        to: "request-error",
                        relationship: "SAME_TRACE",
                    }),

                    expect.objectContaining({
                        from: "request-start",
                        to: "request-error",
                        relationship: "SAME_REQUEST",
                    }),
                ])
            );
        }
    );

    it(
        "recognizes evidence connected through the same distributed trace",
        () => {
            const investigation = investigate([
                {
                    id: "checkout-trace",
                    type: "TRACE",
                    timestamp: new Date(
                        "2026-01-01T10:00:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Checkout request",
                    traceId: "trace-123",
                    requestId: "request-123",
                    metadata: {},
                },

                {
                    id: "payment-error",
                    type: "ERROR",
                    timestamp: new Date(
                        "2026-01-01T10:00:01Z"
                    ),
                    source: "halo-sdk",
                    service: "payment",
                    title: "Payment request failed",
                    traceId: "trace-123",
                    requestId: "request-123",
                    status: 500,
                    metadata: {},
                },
            ]);

            const finding =
                investigation.findings.find(
                    finding =>
                        finding.id.startsWith(
                            "distributed-trace:SAME_TRACE"
                        )
                );

            expect(finding).toBeDefined();

            expect(
                finding?.type
            ).toBe("RELATIONSHIP");

            expect(
                finding?.causalRole
            ).toBe("CONTEXT");

            expect(
                finding?.evidenceIds
            ).toEqual(
                expect.arrayContaining([
                    "checkout-trace",
                    "payment-error",
                ])
            );
        }
    );

    it(
        "creates a trigger relationship when a deployment immediately precedes an error in the same service",
        () => {
            const investigation =
                investigate([
                    {
                        id: "deployment",
                        type: "DEPLOYMENT",
                        timestamp: new Date(
                            "2026-01-01T10:00:00Z"
                        ),
                        source: "github",
                        service: "checkout",
                        title: "Deploy checkout",
                        metadata: {},
                    },

                    {
                        id: "error",
                        type: "ERROR",
                        timestamp: new Date(
                            "2026-01-01T10:01:00Z"
                        ),
                        source: "halo-sdk",
                        service: "checkout",
                        title: "Checkout failed",
                        metadata: {},
                    },
                ]);

            expect(
                investigation.graph.edges
            ).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        from: "deployment",
                        to: "error",
                        relationship: "TRIGGERS",
                    }),
                ])
            );
        }
    );

    it(
        "does not create a trigger relationship when deployment and error belong to different services",
        () => {
            const investigation =
                investigate([
                    {
                        id: "deployment",
                        type: "DEPLOYMENT",
                        timestamp: new Date(
                            "2026-01-01T10:00:00Z"
                        ),
                        source: "github",
                        service: "checkout",
                        title: "Deploy checkout",
                        metadata: {},
                    },

                    {
                        id: "error",
                        type: "ERROR",
                        timestamp: new Date(
                            "2026-01-01T10:01:00Z"
                        ),
                        source: "halo-sdk",
                        service: "payment",
                        title: "Payment failed",
                        metadata: {},
                    },
                ]);

            expect(
                investigation.graph.edges
            ).not.toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        from: "deployment",
                        to: "error",
                        relationship: "TRIGGERS",
                    }),
                ])
            );
        }
    );

    it(
        "does not treat temporal proximity alone as causality",
        () => {
            const investigation =
                investigate([
                    {
                        id: "error-1",
                        type: "ERROR",
                        timestamp: new Date(
                            "2026-01-01T10:00:00Z"
                        ),
                        source: "halo-sdk",
                        service: "checkout",
                        title: "Checkout failed",
                        metadata: {},
                    },

                    {
                        id: "error-2",
                        type: "ERROR",
                        timestamp: new Date(
                            "2026-01-01T10:00:01Z"
                        ),
                        source: "halo-sdk",
                        service: "checkout",
                        title: "Database failed",
                        metadata: {},
                    },
                ]);

            expect(
                investigation.graph.edges
            ).not.toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        from: "error-1",
                        to: "error-2",
                        relationship: "CAUSES",
                    }),
                ])
            );
        }
    );

    it(
        "uses metric degradation as supporting evidence for a deployment hypothesis",
        () => {
            const investigation =
                investigate([
                    {
                        id: "deployment",
                        type: "DEPLOYMENT",
                        timestamp: new Date(
                            "2026-01-01T10:00:00Z"
                        ),
                        source: "github",
                        service: "checkout",
                        title: "Checkout deployment",
                        metadata: {},
                    },

                    {
                        id: "error",
                        type: "ERROR",
                        timestamp: new Date(
                            "2026-01-01T10:01:00Z"
                        ),
                        source: "halo-sdk",
                        service: "checkout",
                        title: "Checkout failed",
                        metadata: {},
                    },

                    {
                        id: "metric",
                        type: "METRIC",
                        timestamp: new Date(
                            "2026-01-01T10:01:05Z"
                        ),
                        source: "halo-sdk",
                        service: "checkout",
                        title: "Checkout latency increased",
                        value: 2400,
                        metadata: {},
                    },
                ]);

            const hypothesis =
                investigation.hypotheses.find(
                    item =>
                        item.title ===
                        "Deployment Regression"
                );

            expect(hypothesis).toBeDefined();

            expect(
                hypothesis?.evidenceIds
            ).toContain("metric");

            expect(
                hypothesis?.supportingReasons.some(
                    reason =>
                        reason.title ===
                        "Metric degradation aligns with errors"
                )
            ).toBe(true);
        }
    );

    it(
    "creates dependency evidence from a failing third-party service",
    () => {
        const investigation =
            investigate([
                {
                    id: "error",
                    type: "ERROR",
                    timestamp: new Date(
                        "2026-01-01T10:01:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Checkout failed",
                    metadata: {},
                },

                {
                    id: "stripe-timeout",
                    type: "THIRD_PARTY",
                    timestamp: new Date(
                        "2026-01-01T10:01:10Z"
                    ),
                    source: "stripe",
                    service: "checkout",
                    title: "Stripe request timed out",
                    status: "timeout",
                    metadata: {},
                },
            ]);

        expect(
            investigation.findings
        ).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: "DEPENDENCY",
                    title:
                        "Third-party failure coincided with application errors",
                }),
            ])
        );
    }
);

it(
    "treats a configuration change followed by errors as a possible trigger",
    () => {
        const investigation =
            investigate([
                {
                    id: "config",
                    type: "CONFIG",
                    timestamp: new Date(
                        "2026-01-01T10:00:00Z"
                    ),
                    source: "config-service",
                    service: "checkout",
                    title: "Database pool configuration changed",
                    metadata: {},
                },

                {
                    id: "error",
                    type: "ERROR",
                    timestamp: new Date(
                        "2026-01-01T10:01:00Z"
                    ),
                    source: "halo-sdk",
                    service: "checkout",
                    title: "Database connection failed",
                    metadata: {},
                },
            ]);

        expect(
            investigation.findings
        ).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: "CHANGE_IMPACT",
                    causalRole: "TRIGGER",
                    title:
                        "Configuration change preceded failure",
                }),
            ])
        );
    }
);


});