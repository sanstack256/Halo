import { describe, it, expect } from "vitest";
import { generateEngineeringRecommendation } from "../engine";
import { buildInvestigationSnapshot } from "../investigation-snapshot";

describe("Halo Trace — Section 88 Autonomous Engineering Core Multi-Hop Test", () => {
    it("correctly separates Stack A/B, Origin C, Contract D, Commit E, and Repair C", async () => {
        // Scenario Architecture (Section 88):
        // - Frame A: `src/repository/persistence.ts:50` throws DB constraint error
        // - Error B: occurs in `persistence.ts`
        // - Bad value Origin C: `src/context/request-context.ts:25` where tenantId was dropped during creation
        // - Contract D: `src/context/request-context.ts` owns the contract requiring tenantId
        // - Commit E: unrelated commit modifying `src/ui/dashboard-nav.tsx` 5 minutes prior
        // - Actual repair: belongs in `src/context/request-context.ts` (Location C)

        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "issue-88",
                title: "DatabaseConstraintError: null value in column tenant_id",
                firstSeen: new Date(),
                lastSeen: new Date(),
                service: "order-service",
                environment: "production",
                release: "v2.0.0",
            },
            rawEvidence: [
                {
                    id: "evt-crash-1",
                    type: "ERROR",
                    title: "DatabaseConstraintError: null value in column tenant_id",
                    timestamp: new Date(),
                    service: "order-service",
                    tags: {
                        stack: `DatabaseConstraintError: null value in column tenant_id
    at OrderPersistence.save (src/repository/persistence.ts:50:11)
    at OrderService.process (src/services/order-service.ts:80:24)
    at RequestContext.create (src/context/request-context.ts:25:5)`,
                        message: "null value in column tenant_id",
                    },
                    metadata: {
                        requestId: "req-123",
                    },
                },
            ],
            stackFrames: [
                {
                    order: 1,
                    rawFilePath: "src/repository/persistence.ts",
                    filePath: "src/repository/persistence.ts",
                    lineNumber: 50,
                    columnNumber: 11,
                    functionName: "save",
                    isInternal: false,
                    isApplication: true,
                    classification: "Application",
                },
                {
                    order: 2,
                    rawFilePath: "src/services/order-service.ts",
                    filePath: "src/services/order-service.ts",
                    lineNumber: 80,
                    columnNumber: 24,
                    functionName: "process",
                    isInternal: false,
                    isApplication: true,
                    classification: "Application",
                },
                {
                    order: 3,
                    rawFilePath: "src/context/request-context.ts",
                    filePath: "src/context/request-context.ts",
                    lineNumber: 25,
                    columnNumber: 5,
                    functionName: "create",
                    isInternal: false,
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/repository/persistence.ts",
                failingLineNumber: 50,
                containingFunction: "save",
                lines: [
                    "export class OrderPersistence {",
                    "  async save(order: Order): Promise<void> {",
                    '    if (!order.tenantId) throw new DatabaseConstraintError("null value in column tenant_id");',
                    "    await db.insert(order);",
                    "  }",
                    "}",
                ],
                resolutionStatus: "exact_file",
                sourceLanguage: "typescript",
                producers: [
                    {
                        producerFile: "src/context/request-context.ts",
                        producerLine: 25,
                        producerSymbol: "create",
                    },
                ],
            },
            release: {
                deployedRelease: "v2.0.0",
                candidates: [
                    {
                        sha: "e1e1e1e1e1",
                        shortSha: "e1e1e1",
                        title: "Update UI dashboard navigation links",
                        author: "frontend-dev",
                        timestamp: new Date().toISOString(),
                        modifiedFiles: ["src/ui/dashboard-nav.tsx"],
                        temporalAssociation: "PRE_INCIDENT_IMMEDIATE",
                        sourceAssociation: "UNRELATED_FILE",
                        executionRelevance: "NOT_ON_EXECUTION_PATH",
                        behavioralRelevance: "NO_SHARED_STATE",
                        mechanismRelevance: "PLAUSIBLE",
                        causalSupport: "COINCIDENTAL",
                        rollbackAudit: {
                            isSafeToRollback: true,
                            affectedFiles: ["src/ui/dashboard-nav.tsx"],
                        },
                    },
                ],
            },
        });

        const result = await generateEngineeringRecommendation({
            snapshot,
            projectId: "proj-1",
            issueId: "issue-88",
            occurrenceId: "occ-multi-hop-88",
        });

        expect(result.authoritativeDecision).toBeDefined();
        const decision = result.authoritativeDecision;

        // 1. Observation Location: persistence.ts (Stack A / Error B)
        expect(decision.separatedLocations?.observationLocation.filePath).toContain("persistence.ts");

        // 2. Value Origin Location: request-context.ts (Origin C)
        expect(decision.separatedLocations?.originLocation?.filePath).toContain("request-context.ts");

        // 3. Repair Location: request-context.ts (Repair C)
        expect(decision.separatedLocations?.repairLocation.filePath).toContain("request-context.ts");

        // 4. Commit E is correctly evaluated as having NO causal association with the crash
        expect(decision.regression.sourceAssociation).toBe("UNRELATED");
        expect(decision.regression.causalSupport).not.toBe("PROVEN");

        // 5. Versioned Reasoning State reached R10
        expect(decision.reasoningVersion).toBe("R10");
        expect(decision.reasoningHistory?.length).toBeGreaterThanOrEqual(5);

        // 6. First Divergence record is populated
        expect(decision.firstDivergence).toBeDefined();
        expect(decision.firstDivergence?.firstDivergenceFile).toContain("request-context.ts");

        // 7. Senior Engineer analysis is populated
        expect(decision.seniorEngineerAnalysis).toBeDefined();
        expect(decision.seniorEngineerAnalysis?.whyNotObviousFix).toContain("The obvious fix is to add optional chaining");

        // 8. Adversarial Challenge evaluated
        expect(decision.adversarialChallenge).toBeDefined();
        expect(decision.adversarialChallenge?.attacksEvaluated.length).toBeGreaterThanOrEqual(3);

        // 9. Prevention recommendation is populated
        expect(decision.preventionRecommendation).toBeDefined();
        expect(decision.preventionRecommendation?.preventionMechanism).toBe("SCHEMA_VALIDATION");
    });
});
