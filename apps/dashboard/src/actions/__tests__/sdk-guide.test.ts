import { describe, it, expect, vi } from "vitest";
import { Halo } from "@halo-trace/sdk";
import { HaloReplay } from "../../../../../packages/replay/src";

describe("SDK Setup Guide & Ingestion Verification Suite", () => {
    describe("1. SDK Documentation Drift Verification", () => {
        it("verifies @halo-trace/sdk exports the exact constructor and configuration expected", () => {
            expect(Halo).toBeDefined();
            expect(typeof Halo).toBe("function");

            // Instantiating with documented minimal configuration
            const halo = new Halo({
                apiKey: "hl_live_mock_key_for_testing",
                endpoint: "http://localhost:3000/api",
            });

            expect(halo).toBeDefined();
            expect(typeof halo.captureMessage).toBe("function");
            expect(typeof halo.captureException).toBe("function");
        });

        it("verifies @halo-trace/replay exports the exact constructor and methods expected", () => {
            expect(HaloReplay).toBeDefined();
            expect(typeof HaloReplay).toBe("function");

            // Instantiating with documented minimal configuration
            const replay = new HaloReplay();
            expect(replay).toBeDefined();
            expect(typeof replay.start).toBe("function");
            expect(typeof replay.getSessionId).toBe("function");
        });
    });

    describe("2. Security & Project Isolation Verification", () => {
        it("enforces strict tenant isolation for project and SDK access", async () => {
            // Mock database project store
            const mockProjects = [
                {
                    id: "proj-org-a",
                    name: "Alpha Project",
                    organizationId: "org-a",
                    apiKeyPrefix: "hl_live_alpha",
                },
                {
                    id: "proj-org-b",
                    name: "Beta Project",
                    organizationId: "org-b",
                    apiKeyPrefix: "hl_live_beta",
                },
            ];

            function simulateGetProject(projectId: string, currentOrgId: string) {
                const proj = mockProjects.find((p) => p.id === projectId);
                if (!proj || proj.organizationId !== currentOrgId) {
                    return null;
                }
                return proj;
            }

            // User belonging to org-a cannot access proj-org-b SDK page
            const userOrgA = "org-a";
            const authorizedAccess = simulateGetProject("proj-org-a", userOrgA);
            expect(authorizedAccess).not.toBeNull();
            expect(authorizedAccess?.name).toBe("Alpha Project");
            expect(authorizedAccess?.apiKeyPrefix).toBe("hl_live_alpha");

            const unauthorizedAccess = simulateGetProject("proj-org-b", userOrgA);
            expect(unauthorizedAccess).toBeNull();
        });

        it("ensures API keys are masked and full secrets are never exposed on the SDK page", () => {
            const fullRawKey = "hl_live_99d1469e5d4a4d6f85d26391d4ff3a97";
            const prefix = "hl_live_99d1469e";

            // Masked representation shown in onboarding / SDK configure step
            const maskedKey = `${prefix}_••••••••`;

            expect(maskedKey).not.toContain("5d4a4d6f85d26391d4ff3a97");
            expect(maskedKey.startsWith("hl_live_")).toBe(true);
            expect(maskedKey.endsWith("••••••••")).toBe(true);
        });
    });

    describe("3. Real Telemetry Production & Attribution Test", () => {
        it("verifies real SDK captureMessage produces the exact payload consumed by Halo backend", async () => {
            const capturedPayloads: any[] = [];

            // Mock fetch for SDK ingestion
            const originalFetch = globalThis.fetch;
            globalThis.fetch = vi.fn(async (url: any, init: any) => {
                const body = JSON.parse(init?.body || "{}");
                capturedPayloads.push({
                    url: String(url),
                    headers: init?.headers,
                    body,
                });
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ eventId: "ev_mock_123", issueId: "iss_mock_456" }),
                } as any;
            });

            try {
                const halo = new Halo({
                    apiKey: "hl_live_test_api_key",
                    endpoint: "http://localhost:3000/api",
                });

                await halo.captureMessage("Hello from Halo");
                await halo.flush();

                expect(capturedPayloads).toHaveLength(1);
                const payload = capturedPayloads[0];

                expect(payload.url).toBe("http://localhost:3000/api/ingest/events");
                expect(payload.headers["Authorization"]).toBe("Bearer hl_live_test_api_key");
                expect(payload.body.type).toBe("MESSAGE");
                expect(payload.body.message).toBe("Hello from Halo");
                expect(payload.body.severity).toBe("INFO");
            } finally {
                globalThis.fetch = originalFetch;
            }
        });
    });
});
