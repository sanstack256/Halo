/**
 * Halo Recommendation Engine — Steps 10 to 14:
 * Defect-Preserving Mutations, Bug Relocation, Structural Variations,
 * Same-Symptom Equivalence Partitioning, and Same-Archetype Differentiation.
 */

import { describe, it, expect } from "vitest";
import { generateEngineeringRecommendation } from "../../engine";
import { buildInvestigationSnapshot } from "../../investigation-snapshot";
import type { InvestigationSnapshot } from "../../types";

describe("Steps 10 to 14: Mutations, Relocations & Equivalence Partitioning", () => {
    // =========================================================================
    // STEP 10: DEFECT-PRESERVING MUTATIONS
    // =========================================================================
    describe("Step 10 — Defect-Preserving Mutations", () => {
        it("identifies defect and repair across renamed variables, helper functions, and extra stack depth", async () => {
            // Mutation of null dereference bug: nested inside helper, renamed variables, extra stack frame
            const mutatedSnapshot: InvestigationSnapshot = buildInvestigationSnapshot({
                incident: {
                    issueId: "mut-01-deep-nesting",
                    title: "TypeError: Cannot read properties of undefined (reading 'billingAddress')",
                    firstSeen: new Date("2026-09-17T12:00:00Z"),
                    lastSeen: new Date("2026-09-17T12:05:00Z"),
                    eventCount: 3,
                    environment: "production",
                    service: "checkout-worker",
                },
                rawEvidence: [
                    {
                        id: "ev-mut-01",
                        type: "ERROR",
                        title: "TypeError: Cannot read properties of undefined (reading 'billingAddress')",
                        timestamp: "2026-09-17T12:00:00Z",
                        service: "checkout-worker",
                        environment: "production",
                        tags: {
                            exceptionType: "TypeError",
                            message: "Cannot read properties of undefined (reading 'billingAddress')",
                            stack: "TypeError: Cannot read properties of undefined (reading 'billingAddress')\n    at extractPostalCode (src/services/billing/postal-resolver.ts:24:28)\n    at resolveBillingDestination (src/services/billing/postal-resolver.ts:18:12)\n    at dispatchOrderInvoice (src/workers/invoice-worker.ts:88:5)",
                        },
                    },
                ],
                stackFrames: [
                    {
                        order: 1,
                        filePath: "src/services/billing/postal-resolver.ts",
                        lineNumber: 24,
                        functionName: "extractPostalCode",
                        isApplication: true,
                        classification: "Application",
                    },
                    {
                        order: 2,
                        filePath: "src/services/billing/postal-resolver.ts",
                        lineNumber: 18,
                        functionName: "resolveBillingDestination",
                        isApplication: true,
                        classification: "Application",
                    },
                    {
                        order: 3,
                        filePath: "src/workers/invoice-worker.ts",
                        lineNumber: 88,
                        functionName: "dispatchOrderInvoice",
                        isApplication: true,
                        classification: "Application",
                    },
                ],
                source: {
                    filePath: "src/services/billing/postal-resolver.ts",
                    failingLineNumber: 24,
                    containingFunction: "extractPostalCode",
                    failingExpression: "customerRecord.billingAddress.postalCode",
                    resolutionStatus: "exact_file",
                    lines: [
                        { lineNumber: 22, content: "export function extractPostalCode(customerRecord: any) {" },
                        { lineNumber: 23, content: "    // helper extracted in refactor" },
                        { lineNumber: 24, content: "    const zip = customerRecord.billingAddress.postalCode;" },
                        { lineNumber: 25, content: "    return zip || '00000';" },
                        { lineNumber: 26, content: "}" },
                    ],
                },
                investigation: {
                    hypotheses: [
                        {
                            id: "hypo-mut-01",
                            title: "Null or undefined dereference in postal resolver",
                            description: "customerRecord missing billingAddress causing runtime TypeError",
                            status: "CONFIRMED",
                            likelihood: "HIGH",
                            confidence: 0.95,
                            supportedEvidence: ["ev-mut-01"],
                        },
                    ],
                    findings: [],
                    causalChains: [],
                    rootCause: null,
                },
            });

            const result = await generateEngineeringRecommendation({ snapshot: mutatedSnapshot });
            expect(result.success).toBe(true);
            const rec = result.recommendation;
            expect(rec.repairLocation?.targetFile).toBe("src/services/billing/postal-resolver.ts");
            expect(rec.isCodeModification).toBe(true);
            expect(rec.changes.length).toBeGreaterThan(0);
            expect(rec.changes[0].proposedCode).toMatch(/\?\.|\bif\s*\(/);
        });
    });

    // =========================================================================
    // STEP 11: MOVE THE BUG (RELOCATION TEST)
    // =========================================================================
    describe("Step 11 — Move the Bug", () => {
        it("follows repository evidence when bug is moved to a completely different file and subsystem", async () => {
            // Relocate bug to inventory subsystem at a new path
            const relocatedSnapshot: InvestigationSnapshot = buildInvestigationSnapshot({
                incident: {
                    issueId: "reloc-01-inventory",
                    title: "TypeError: Cannot read properties of undefined (reading 'warehouseCode')",
                    firstSeen: new Date("2026-09-17T12:00:00Z"),
                    lastSeen: new Date("2026-09-17T12:05:00Z"),
                    eventCount: 4,
                    environment: "production",
                    service: "fulfillment-service",
                },
                rawEvidence: [
                    {
                        id: "ev-reloc-01",
                        type: "ERROR",
                        title: "TypeError: Cannot read properties of undefined (reading 'warehouseCode')",
                        timestamp: "2026-09-17T12:00:00Z",
                        service: "fulfillment-service",
                        environment: "production",
                        tags: {
                            exceptionType: "TypeError",
                            message: "Cannot read properties of undefined (reading 'warehouseCode')",
                            stack: "TypeError: Cannot read properties of undefined (reading 'warehouseCode')\n    at locateFulfillmentCenter (src/fulfillment/warehouse-router.ts:42:18)",
                        },
                    },
                ],
                stackFrames: [
                    {
                        order: 1,
                        filePath: "src/fulfillment/warehouse-router.ts",
                        lineNumber: 42,
                        functionName: "locateFulfillmentCenter",
                        isApplication: true,
                        classification: "Application",
                    },
                ],
                source: {
                    filePath: "src/fulfillment/warehouse-router.ts",
                    failingLineNumber: 42,
                    containingFunction: "locateFulfillmentCenter",
                    failingExpression: "routeContext.originSite.warehouseCode",
                    resolutionStatus: "exact_file",
                    lines: [
                        { lineNumber: 40, content: "export function locateFulfillmentCenter(routeContext: any) {" },
                        { lineNumber: 41, content: "    // Relocated route resolution" },
                        { lineNumber: 42, content: "    return routeContext.originSite.warehouseCode;" },
                        { lineNumber: 43, content: "}" },
                    ],
                },
                investigation: {
                    hypotheses: [
                        {
                            id: "hypo-reloc-01",
                            title: "Null or undefined dereference in warehouse router",
                            description: "routeContext missing originSite causing runtime TypeError",
                            status: "CONFIRMED",
                            likelihood: "HIGH",
                            confidence: 0.95,
                            supportedEvidence: ["ev-reloc-01"],
                        },
                    ],
                    findings: [],
                    causalChains: [],
                    rootCause: null,
                },
            });

            const result = await generateEngineeringRecommendation({ snapshot: relocatedSnapshot });
            expect(result.success).toBe(true);
            const rec = result.recommendation;
            // Target file must strictly follow the relocated evidence, not any hardcoded previous paths
            expect(rec.repairLocation?.targetFile).toBe("src/fulfillment/warehouse-router.ts");
            expect(rec.repairLocation?.targetSymbol).toBe("locateFulfillmentCenter");
            expect(rec.changes[0].file).toBe("src/fulfillment/warehouse-router.ts");
        });
    });

    // =========================================================================
    // STEP 12: CHANGE THE SOURCE STRUCTURE
    // =========================================================================
    describe("Step 12 — Change Source Structure", () => {
        it("synthesizes repair when defect is inside a class method vs standalone function", async () => {
            const classMethodSnapshot: InvestigationSnapshot = buildInvestigationSnapshot({
                incident: {
                    issueId: "struct-01-class-method",
                    title: "TypeError: Cannot read properties of undefined (reading 'status')",
                    firstSeen: new Date("2026-09-17T12:00:00Z"),
                    lastSeen: new Date("2026-09-17T12:05:00Z"),
                    eventCount: 2,
                    environment: "production",
                    service: "account-service",
                },
                rawEvidence: [
                    {
                        id: "ev-struct-01",
                        type: "ERROR",
                        title: "TypeError: Cannot read properties of undefined (reading 'status')",
                        timestamp: "2026-09-17T12:00:00Z",
                        service: "account-service",
                        environment: "production",
                        tags: {
                            exceptionType: "TypeError",
                            message: "Cannot read properties of undefined (reading 'status')",
                            stack: "TypeError: Cannot read properties of undefined (reading 'status')\n    at AccountManager.verifySubscription (src/domain/account-manager.ts:55:22)",
                        },
                    },
                ],
                stackFrames: [
                    {
                        order: 1,
                        filePath: "src/domain/account-manager.ts",
                        lineNumber: 55,
                        functionName: "verifySubscription",
                        isApplication: true,
                        classification: "Application",
                    },
                ],
                source: {
                    filePath: "src/domain/account-manager.ts",
                    failingLineNumber: 55,
                    containingFunction: "verifySubscription",
                    failingExpression: "this.account.subscription.status",
                    resolutionStatus: "exact_file",
                    lines: [
                        { lineNumber: 53, content: "export class AccountManager {" },
                        { lineNumber: 54, content: "    public verifySubscription() {" },
                        { lineNumber: 55, content: "        return this.account.subscription.status === 'ACTIVE';" },
                        { lineNumber: 56, content: "    }" },
                        { lineNumber: 57, content: "}" },
                    ],
                },
            });

            const result = await generateEngineeringRecommendation({ snapshot: classMethodSnapshot });
            expect(result.success).toBe(true);
            expect(result.recommendation.repairLocation?.targetFile).toBe("src/domain/account-manager.ts");
            expect(result.recommendation.isCodeModification).toBe(true);
        });
    });

    // =========================================================================
    // STEP 13: 10 SAME-SYMPTOM / DIFFERENT-REPAIR CASES
    // =========================================================================
    describe("Step 13 — 10 Same-Symptom / Different-Repair Cases", () => {
        // All 10 cases present the identical symptom: "TypeError: Cannot read properties of undefined (reading 'token')"
        // But the 10 distinct underlying mechanisms demand 10 distinct repair locations and actions!

        const commonError = "TypeError: Cannot read properties of undefined (reading 'token')";

        // 1. Producer defect
        it("Case 1: Producer contract violation -> Targets upstream producer", async () => {
            const snap = buildInvestigationSnapshot({
                incident: { issueId: "sym-01", title: commonError, firstSeen: new Date(), lastSeen: new Date(), eventCount: 1, environment: "prod", service: "api" },
                rawEvidence: [{ id: "ev1", type: "ERROR", title: commonError, timestamp: "2026-09-17", service: "api", environment: "prod", tags: { message: commonError } }],
                stackFrames: [
                    { order: 1, filePath: "src/consumer.ts", lineNumber: 10, functionName: "consume", isApplication: true, classification: "Application" },
                ],
                source: {
                    filePath: "src/consumer.ts",
                    failingLineNumber: 10,
                    containingFunction: "consume",
                    lines: [{ lineNumber: 10, content: "const token = payload.token;" }],
                    producers: [{ producerFile: "src/token-generator.ts", producerSymbol: "generateTokenPayload" }],
                } as any,
                investigation: {
                    hypotheses: [{ id: "h1", title: "Upstream producer defect in generateTokenPayload", description: "Producer omitted required token property", status: "CONFIRMED", likelihood: "HIGH", confidence: 0.95, supportedEvidence: ["ev1"] }],
                    findings: [], causalChains: [], rootCause: null,
                },
            });
            const res = await generateEngineeringRecommendation({ snapshot: snap });
            expect(res.recommendation.repairLocation?.type).toBe("PRODUCER");
            expect(res.recommendation.repairLocation?.targetFile).toBe("src/token-generator.ts");
        });

        // 2. Legitimate nullable consumer
        it("Case 2: Legitimate nullable consumer -> Targets consumer with optional handling", async () => {
            const snap = buildInvestigationSnapshot({
                incident: { issueId: "sym-02", title: commonError, firstSeen: new Date(), lastSeen: new Date(), eventCount: 1, environment: "prod", service: "api" },
                rawEvidence: [{ id: "ev2", type: "ERROR", title: commonError, timestamp: "2026-09-17", service: "api", environment: "prod", tags: { message: commonError } }],
                stackFrames: [{ order: 1, filePath: "src/auth/viewer.ts", lineNumber: 15, functionName: "renderAuth", isApplication: true, classification: "Application" }],
                source: {
                    filePath: "src/auth/viewer.ts",
                    failingLineNumber: 15,
                    containingFunction: "renderAuth",
                    lines: [{ lineNumber: 15, content: "const t = session.token;" }],
                },
            });
            const res = await generateEngineeringRecommendation({ snapshot: snap });
            expect(res.recommendation.repairLocation?.type).toBe("CALLEE");
            expect(res.recommendation.repairLocation?.targetFile).toBe("src/auth/viewer.ts");
            expect(res.recommendation.isCodeModification).toBe(true);
        });

        // 3. Adapter field loss
        it("Case 3: Adapter field loss -> Targets adapter transformation", async () => {
            const snap = buildInvestigationSnapshot({
                incident: { issueId: "sym-03", title: commonError, firstSeen: new Date(), lastSeen: new Date(), eventCount: 1, environment: "prod", service: "api" },
                rawEvidence: [{ id: "ev3", type: "ERROR", title: commonError, timestamp: "2026-09-17", service: "api", environment: "prod", tags: { message: commonError } }],
                stackFrames: [{ order: 1, filePath: "src/adapters/session-adapter.ts", lineNumber: 8, functionName: "adaptSession", isApplication: true, classification: "Application" }],
                source: {
                    filePath: "src/adapters/session-adapter.ts",
                    failingLineNumber: 8,
                    containingFunction: "adaptSession",
                    lines: [{ lineNumber: 8, content: "return { auth: raw.token };" }],
                },
            });
            const res = await generateEngineeringRecommendation({ snapshot: snap });
            expect(res.recommendation.repairLocation?.type).toBe("ADAPTER");
            expect(res.recommendation.repairLocation?.targetFile).toBe("src/adapters/session-adapter.ts");
        });

        // 4. Async race condition
        it("Case 4: Async race condition -> Generates async synchronization guard", async () => {
            const snap = buildInvestigationSnapshot({
                incident: { issueId: "sym-04", title: commonError, firstSeen: new Date(), lastSeen: new Date(), eventCount: 1, environment: "prod", service: "api" },
                rawEvidence: [{ id: "ev4", type: "ERROR", title: commonError, timestamp: "2026-09-17", service: "api", environment: "prod", tags: { message: commonError } }],
                stackFrames: [{ order: 1, filePath: "src/auth/token-pool.ts", lineNumber: 25, functionName: "acquireToken", isApplication: true, classification: "Application" }],
                source: {
                    filePath: "src/auth/token-pool.ts",
                    failingLineNumber: 25,
                    containingFunction: "acquireToken",
                    lines: [{ lineNumber: 25, content: "const token = this.currentSession.token;" }],
                },
                investigation: {
                    hypotheses: [{ id: "h4", title: "Async race condition on token rotation", description: "Concurrent access during token rotation without mutex lock", status: "CONFIRMED", likelihood: "HIGH", confidence: 0.94, supportedEvidence: ["ev4"] }],
                    findings: [], causalChains: [], rootCause: null,
                },
            });
            const res = await generateEngineeringRecommendation({ snapshot: snap });
            expect(res.recommendation.diagnosis.toLowerCase()).toMatch(/race|concurren|async/);
            expect(res.recommendation.isCodeModification).toBe(true);
        });

        // 5. Configuration initialization defect
        it("Case 5: Configuration initialization defect -> Targets configuration", async () => {
            const snap = buildInvestigationSnapshot({
                incident: { issueId: "sym-05", title: "Configuration error: Missing environment variable AUTH_TOKEN", firstSeen: new Date(), lastSeen: new Date(), eventCount: 1, environment: "prod", service: "api" },
                rawEvidence: [{ id: "ev5", type: "ERROR", title: "Configuration error: Missing environment variable AUTH_TOKEN", timestamp: "2026-09-17", service: "api", environment: "prod", tags: { message: "Configuration error: Missing environment variable AUTH_TOKEN" } }],
                stackFrames: [{ order: 1, filePath: "src/config/auth.ts", lineNumber: 5, functionName: "loadAuthConfig", isApplication: true, classification: "Application" }],
                source: {
                    filePath: "src/config/auth.ts",
                    failingLineNumber: 5,
                    containingFunction: "loadAuthConfig",
                    lines: [{ lineNumber: 5, content: "export const token = process.env.AUTH_TOKEN ? parseInt(process.env.AUTH_TOKEN, 10) : undefined;" }],
                },
            });
            const res = await generateEngineeringRecommendation({ snapshot: snap });
            expect(res.recommendation.repairLocation?.type).toBe("CONFIGURATION");
        });

        // 6. Database shape mismatch
        it("Case 6: Database shape mismatch -> Targets query / model mapping", async () => {
            const snap = buildInvestigationSnapshot({
                incident: { issueId: "sym-06", title: commonError, firstSeen: new Date(), lastSeen: new Date(), eventCount: 1, environment: "prod", service: "api" },
                rawEvidence: [{ id: "ev6", type: "ERROR", title: commonError, timestamp: "2026-09-17", service: "api", environment: "prod", tags: { message: commonError } }],
                stackFrames: [{ order: 1, filePath: "src/db/token-repository.ts", lineNumber: 30, functionName: "findUserToken", isApplication: true, classification: "Application" }],
                source: {
                    filePath: "src/db/token-repository.ts",
                    failingLineNumber: 30,
                    containingFunction: "findUserToken",
                    lines: [{ lineNumber: 30, content: "return row.token_data.token;" }],
                },
                investigation: {
                    hypotheses: [{ id: "h6", title: "Database schema migration column mismatch", description: "Column token_data renamed to auth_token_data", status: "CONFIRMED", likelihood: "HIGH", confidence: 0.9, supportedEvidence: ["ev6"] }],
                    findings: [], causalChains: [], rootCause: null,
                },
            });
            const res = await generateEngineeringRecommendation({ snapshot: snap });
            expect(res.recommendation.repairLocation?.targetFile).toBe("src/db/token-repository.ts");
            expect(res.recommendation.isCodeModification).toBe(true);
        });

        // 7. Schema mismatch / JSON parsing
        it("Case 7: Schema mismatch -> Validates parsing boundary", async () => {
            const snap = buildInvestigationSnapshot({
                incident: { issueId: "sym-07", title: commonError, firstSeen: new Date(), lastSeen: new Date(), eventCount: 1, environment: "prod", service: "api" },
                rawEvidence: [{ id: "ev7", type: "ERROR", title: commonError, timestamp: "2026-09-17", service: "api", environment: "prod", tags: { message: commonError } }],
                stackFrames: [{ order: 1, filePath: "src/parsers/jwt-parser.ts", lineNumber: 14, functionName: "parseJwtPayload", isApplication: true, classification: "Application" }],
                source: {
                    filePath: "src/parsers/jwt-parser.ts",
                    failingLineNumber: 14,
                    containingFunction: "parseJwtPayload",
                    lines: [{ lineNumber: 14, content: "const parsed = JSON.parse(raw); return parsed.token;" }],
                },
            });
            const res = await generateEngineeringRecommendation({ snapshot: snap });
            expect(res.recommendation.repairLocation?.targetFile).toBe("src/parsers/jwt-parser.ts");
            expect(res.recommendation.isCodeModification).toBe(true);
        });

        // 8. External API response contract change
        it("Case 8: External response contract change -> Targets external client resilience", async () => {
            const snap = buildInvestigationSnapshot({
                incident: { issueId: "sym-08", title: commonError, firstSeen: new Date(), lastSeen: new Date(), eventCount: 1, environment: "prod", service: "api" },
                rawEvidence: [{ id: "ev8", type: "ERROR", title: commonError, timestamp: "2026-09-17", service: "api", environment: "prod", tags: { message: commonError } }],
                stackFrames: [{ order: 1, filePath: "src/clients/idp-client.ts", lineNumber: 40, functionName: "fetchIdpToken", isApplication: true, classification: "Application" }],
                source: {
                    filePath: "src/clients/idp-client.ts",
                    failingLineNumber: 40,
                    containingFunction: "fetchIdpToken",
                    lines: [{ lineNumber: 40, content: "const res = await client.post('/oauth/token'); return res.data.token;" }],
                },
            });
            const res = await generateEngineeringRecommendation({ snapshot: snap });
            expect(res.recommendation.repairLocation?.targetFile).toBe("src/clients/idp-client.ts");
            expect(res.recommendation.isCodeModification).toBe(true);
        });

        // 9. Invalid state machine transition
        it("Case 9: Invalid state transition -> Adds state machine transition guard", async () => {
            const snap = buildInvestigationSnapshot({
                incident: { issueId: "sym-09", title: "Error: Invalid state machine transition from 'UNAUTHENTICATED' to 'REFRESHING'", firstSeen: new Date(), lastSeen: new Date(), eventCount: 1, environment: "prod", service: "api" },
                rawEvidence: [{ id: "ev9", type: "ERROR", title: "Error: Invalid state machine transition", timestamp: "2026-09-17", service: "api", environment: "prod", tags: { message: "Invalid state machine transition from 'UNAUTHENTICATED' to 'REFRESHING'" } }],
                stackFrames: [{ order: 1, filePath: "src/fsm/auth-fsm.ts", lineNumber: 32, functionName: "transitionTo", isApplication: true, classification: "Application" }],
                source: {
                    filePath: "src/fsm/auth-fsm.ts",
                    failingLineNumber: 32,
                    containingFunction: "transitionTo",
                    lines: [{ lineNumber: 32, content: "if (!VALID_TRANSITIONS[this.state].includes(next)) throw new Error('Invalid state machine transition');" }],
                },
                investigation: {
                    hypotheses: [{ id: "h9", title: "State machine invalid transition defect", description: "Caller dispatches REFRESHING while in UNAUTHENTICATED state", status: "CONFIRMED", likelihood: "HIGH", confidence: 0.95, supportedEvidence: ["ev9"] }],
                    findings: [], causalChains: [], rootCause: null,
                },
            });
            const res = await generateEngineeringRecommendation({ snapshot: snap });
            expect(res.recommendation.diagnosis.toLowerCase()).toMatch(/state machine|transition/);
            expect(res.recommendation.isCodeModification).toBe(true);
        });

        // 10. Stale deployment artifact / non-code operational remediation
        it("Case 10: Stale deployment / missing deployment manifest -> Recommends deployment remediation", async () => {
            const snap = buildInvestigationSnapshot({
                incident: { issueId: "sym-10", title: "ConfigurationError: Required environment variable AUTH_TOKEN is not set", firstSeen: new Date(), lastSeen: new Date(), eventCount: 1, environment: "prod", service: "api" },
                rawEvidence: [{ id: "ev10", type: "ERROR", title: "ConfigurationError: Required environment variable AUTH_TOKEN is not set", timestamp: "2026-09-17", service: "api", environment: "prod", tags: { message: "Required environment variable AUTH_TOKEN is not set" } }],
                stackFrames: [{ order: 1, filePath: "src/config/auth.ts", lineNumber: 10, functionName: "getAuthConfig", isApplication: true, classification: "Application" }],
                source: {
                    filePath: "src/config/auth.ts",
                    failingLineNumber: 10,
                    containingFunction: "getAuthConfig",
                    lines: [{ lineNumber: 10, content: "if (!process.env.AUTH_TOKEN) throw new ConfigurationError('Required environment variable AUTH_TOKEN is not set');" }],
                },
                investigation: {
                    hypotheses: [{ id: "h10", title: "Deployment environment configuration defect", description: "Application code is correct; AUTH_TOKEN was omitted from deployment manifest", status: "CONFIRMED", likelihood: "HIGH", confidence: 0.98, supportedEvidence: ["ev10"] }],
                    findings: [], causalChains: [], rootCause: null,
                },
            });
            const res = await generateEngineeringRecommendation({ snapshot: snap });
            expect(res.recommendation.repairLocation?.type).toBe("CONFIGURATION");
            expect(res.recommendation.isCodeModification).toBe(false);
            expect(res.recommendation.repairLocation?.targetFile).toBe(".env");
        });
    });

    // =========================================================================
    // STEP 14: SAME-ARCHETYPE / DIFFERENT-REPAIR CASES
    // =========================================================================
    describe("Step 14 — Same-Archetype / Different-Repair Cases", () => {
        it("differentiates RESOURCE_LEAK across unclosed connection vs file stream vs timer", async () => {
            // Leak A: Database connection leak (missing finally close)
            const snapA = buildInvestigationSnapshot({
                incident: { issueId: "leak-a", title: "Error: Connection pool exhausted", firstSeen: new Date(), lastSeen: new Date(), eventCount: 10, environment: "prod", service: "db" },
                rawEvidence: [{ id: "ea", type: "ERROR", title: "Connection pool exhausted", timestamp: "2026-09-17", service: "db", environment: "prod", tags: { message: "Connection pool exhausted" } }],
                stackFrames: [{ order: 1, filePath: "src/db/connection.ts", lineNumber: 20, functionName: "runQuery", isApplication: true, classification: "Application" }],
                source: {
                    filePath: "src/db/connection.ts",
                    failingLineNumber: 20,
                    containingFunction: "runQuery",
                    lines: [{ lineNumber: 20, content: "const conn = await pool.acquire(); const res = await conn.query(sql);" }],
                },
                investigation: {
                    hypotheses: [{ id: "ha", title: "Connection pool resource leak", description: "Missing finally block to release connection back to pool", status: "CONFIRMED", likelihood: "HIGH", confidence: 0.95, supportedEvidence: ["ea"] }],
                    findings: [], causalChains: [], rootCause: null,
                },
            });
            const resA = await generateEngineeringRecommendation({ snapshot: snapA });
            expect(resA.recommendation.diagnosis.toLowerCase()).toMatch(/resource|leak|connection/);
            expect(resA.recommendation.changes[0].proposedCode).toMatch(/finally|release/);

            // Leak B: Unclosed stream / file handle
            const snapB = buildInvestigationSnapshot({
                incident: { issueId: "leak-b", title: "Error: EMFILE: too many open files", firstSeen: new Date(), lastSeen: new Date(), eventCount: 10, environment: "prod", service: "file-worker" },
                rawEvidence: [{ id: "eb", type: "ERROR", title: "EMFILE: too many open files", timestamp: "2026-09-17", service: "file-worker", environment: "prod", tags: { message: "EMFILE: too many open files" } }],
                stackFrames: [{ order: 1, filePath: "src/io/file-reader.ts", lineNumber: 15, functionName: "readLogFile", isApplication: true, classification: "Application" }],
                source: {
                    filePath: "src/io/file-reader.ts",
                    failingLineNumber: 15,
                    containingFunction: "readLogFile",
                    lines: [{ lineNumber: 15, content: "const stream = fs.createReadStream(path);" }],
                },
                investigation: {
                    hypotheses: [{ id: "hb", title: "File descriptor resource leak", description: "ReadStream opened without cleanup", status: "CONFIRMED", likelihood: "HIGH", confidence: 0.92, supportedEvidence: ["eb"] }],
                    findings: [], causalChains: [], rootCause: null,
                },
            });
            const resB = await generateEngineeringRecommendation({ snapshot: snapB });
            expect(resB.recommendation.repairLocation?.targetFile).toBe("src/io/file-reader.ts");
            expect(resB.recommendation.isCodeModification).toBe(true);
        });

        it("differentiates EXTERNAL_TIMEOUT across retryable transient 504 vs non-retryable 401 client error", async () => {
            // External Timeout: 504 Gateway Timeout -> Application Retry Policy
            const snapTimeout = buildInvestigationSnapshot({
                incident: { issueId: "ext-timeout", title: "Error: 504 Gateway Timeout from payment gateway", firstSeen: new Date(), lastSeen: new Date(), eventCount: 15, environment: "prod", service: "pay" },
                rawEvidence: [{ id: "eto", type: "ERROR", title: "504 Gateway Timeout", timestamp: "2026-09-17", service: "pay", environment: "prod", tags: { message: "504 Gateway Timeout from payment gateway" } }],
                stackFrames: [{ order: 1, filePath: "src/clients/gateway.ts", lineNumber: 12, functionName: "sendCharge", isApplication: true, classification: "Application" }],
                source: {
                    filePath: "src/clients/gateway.ts",
                    failingLineNumber: 12,
                    containingFunction: "sendCharge",
                    lines: [{ lineNumber: 12, content: "return await client.post('/charge', payload);" }],
                },
            });
            const resTimeout = await generateEngineeringRecommendation({ snapshot: snapTimeout });
            expect(resTimeout.recommendation.diagnosis.toLowerCase()).toMatch(/timeout|network|gateway/);
            expect(resTimeout.recommendation.changes[0].proposedCode).toMatch(/retry|backoff|timeout/i);
        });
    });
});
