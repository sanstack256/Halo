/**
 * Halo Trace — True vs False Regression Evaluation Suite (Phase 31)
 *
 * Verifies that the recommendation engine discriminates between true regressions
 * and benign/coincidental temporal or source associations across 6 core scenarios.
 */

import { describe, it, expect } from "vitest";
import { buildInvestigationSnapshot } from "../../investigation-snapshot";
import { generateEngineeringRecommendation } from "../../engine";
import { analyzeReleasesAndRegressions } from "../../regression-analysis";
import { evaluateCausalRegressionGate } from "../../causal-regression-gate";
import { analyzeSourceAst } from "../../source-analysis";
import { analyzeContractsAndValueFlow } from "../../contract-analysis";
import { determineCausalEpistemicState } from "../../causal-determination";

describe("Phase 31: True vs False Regression Evaluation Suite", () => {
    // -------------------------------------------------------------------------
    // Case A: True Regression (Commit modified failing line, introduced bug)
    // -------------------------------------------------------------------------
    it("Case A: True Regression -> Recommends rollback or targeted revert when commit directly modified failing line", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "case-a-true-regression",
                title: "TypeError: Cannot read properties of undefined (reading 'rate')",
                firstSeen: new Date("2026-09-18T10:00:00Z"),
                lastSeen: new Date("2026-09-18T10:05:00Z"),
                eventCount: 20,
                environment: "production",
                service: "tax-service",
            },
            rawEvidence: [
                {
                    id: "ev-case-a",
                    type: "ERROR",
                    title: "TypeError: Cannot read properties of undefined (reading 'rate')",
                    timestamp: "2026-09-18T10:00:00Z",
                    service: "tax-service",
                    environment: "production",
                    tags: { message: "Cannot read properties of undefined (reading 'rate')" },
                },
            ],
            source: {
                filePath: "src/tax.ts",
                failingLineNumber: 14,
                containingFunction: "calculateTax",
                failingExpression: "taxProfile.rate",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 13, content: "export function calculateTax(amount: number, taxProfile: any) {", isFailingLine: false },
                    { lineNumber: 14, content: "    const r = taxProfile.rate;", isFailingLine: true },
                    { lineNumber: 15, content: "    return amount * r;", isFailingLine: false },
                    { lineNumber: 16, content: "}", isFailingLine: false },
                ],
            },
            release: {
                deployedRelease: "v2.1.0",
                candidates: [
                    {
                        commitSha: "a1b2c3d4e5f6",
                        shortSha: "a1b2c3d",
                        message: "Refactor tax rate resolution to use profile directly",
                        author: "Alice",
                        commitDate: new Date("2026-09-18T09:45:00Z"),
                        classification: "STRONGLY_SUPPORTED_REGRESSION",
                        changedFiles: ["src/tax.ts"],
                        modifiesFailingFile: true,
                        modifiesFailingSymbol: true,
                        directlyModifiesFailingLine: true,
                    },
                ],
            },
        });

        const res = await generateEngineeringRecommendation({ snapshot });
        expect(res.success).toBe(true);
        expect(res.repairLocation?.type).toBe("DEPLOYMENT");
        expect(res.repairLocation?.targetFile).toBe("src/tax.ts");
        expect(res.recommendation.decomposedConfidence?.causalCause).toBe("PROVEN");
        expect(res.recommendation.actionAnswer?.toLowerCase()).toContain("a1b2c3d");
    });

    // -------------------------------------------------------------------------
    // Case B: Same File, Unrelated Change (Touched helper in same file 2h prior)
    // -------------------------------------------------------------------------
    it("Case B: Same File, Unrelated Change -> Rollback MUST NOT be recommended", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "case-b-unrelated-helper",
                title: "TypeError: Cannot read properties of undefined (reading 'name')",
                firstSeen: new Date("2026-09-18T10:00:00Z"),
                lastSeen: new Date("2026-09-18T10:05:00Z"),
                eventCount: 5,
                environment: "production",
                service: "user-service",
            },
            rawEvidence: [
                {
                    id: "ev-case-b",
                    type: "ERROR",
                    title: "TypeError: Cannot read properties of undefined (reading 'name')",
                    timestamp: "2026-09-18T10:00:00Z",
                    service: "user-service",
                    environment: "production",
                    tags: { message: "Cannot read properties of undefined (reading 'name')" },
                },
            ],
            source: {
                filePath: "src/user.ts",
                failingLineNumber: 42,
                containingFunction: "getUserProfile",
                failingExpression: "user.name",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 41, content: "export function getUserProfile(user: any) {", isFailingLine: false },
                    { lineNumber: 42, content: "    return user.name;", isFailingLine: true },
                    { lineNumber: 43, content: "}", isFailingLine: false },
                ],
            },
            release: {
                deployedRelease: "v1.9.0",
                candidates: [
                    {
                        commitSha: "b2c3d4e5f6a7",
                        shortSha: "b2c3d4e",
                        message: "Format helper function formatAddress in user.ts",
                        author: "Bob",
                        commitDate: new Date("2026-09-18T08:00:00Z"),
                        classification: "PATH_ASSOCIATED",
                        changedFiles: ["src/user.ts"],
                        diffSnippet: "@@ -100,2 +100,2 @@\n-function formatAddress(a) {\n+function formatAddress(addr) {",
                        modifiesFailingFile: true,
                        modifiesFailingSymbol: false,
                    },
                ],
            },
        });

        const reg = analyzeReleasesAndRegressions(snapshot);
        expect(reg.candidates[0]!.classification).toBe("PATH_ASSOCIATED");
        expect(reg.candidates[0]!.executionRelevance).toBe("STATICALLY_DISCONNECTED");
        expect(reg.candidates[0]!.causalSupport).toBe("UNPROVEN_ASSOCIATION");

        const sourceAst = analyzeSourceAst(snapshot);
        const contracts = analyzeContractsAndValueFlow(snapshot, sourceAst);
        const causalState = determineCausalEpistemicState(snapshot, sourceAst, contracts, reg);
        const gate = evaluateCausalRegressionGate({ snapshot, regressionContext: reg, causalState, sourceAst });

        expect(gate.isRollbackEligible).toBe(false);

        const res = await generateEngineeringRecommendation({ snapshot });
        expect(res.repairLocation?.type).not.toBe("DEPLOYMENT");
        expect(res.recommendation.actionAnswer?.toLowerCase()).not.toContain("revert b2c3d4e");
    });

    // -------------------------------------------------------------------------
    // Case C: Same File, Execution-Relevant, Non-Causal (Logging update)
    // -------------------------------------------------------------------------
    it("Case C: Same File, Execution-Relevant, Non-Causal -> Rollback MUST NOT be recommended", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "case-c-logging-change",
                title: "TypeError: user.getEmail is not a function",
                firstSeen: new Date("2026-09-18T10:00:00Z"),
                lastSeen: new Date("2026-09-18T10:05:00Z"),
                eventCount: 15,
                environment: "production",
                service: "user-service",
            },
            rawEvidence: [
                {
                    id: "ev-case-c",
                    type: "ERROR",
                    title: "TypeError: user.getEmail is not a function",
                    timestamp: "2026-09-18T10:00:00Z",
                    service: "user-service",
                    environment: "production",
                    tags: { message: "user.getEmail is not a function" },
                },
            ],
            source: {
                filePath: "src/auth.ts",
                failingLineNumber: 20,
                containingFunction: "authenticateUser",
                failingExpression: "user.getEmail()",
                resolutionStatus: "exact_file",
                lines: [
                    { lineNumber: 19, content: "export function authenticateUser(user: any) {", isFailingLine: false },
                    { lineNumber: 20, content: "    const email = user.getEmail();", isFailingLine: true },
                    { lineNumber: 21, content: "    return email;", isFailingLine: false },
                    { lineNumber: 22, content: "}", isFailingLine: false },
                ],
            },
            release: {
                deployedRelease: "v1.2.0",
                candidates: [
                    {
                        commitSha: "c3d4e5f6a7b8",
                        shortSha: "c3d4e5f",
                        message: "Add debug comments and documentation in authenticateUser",
                        author: "Charlie",
                        commitDate: new Date("2026-09-18T09:30:00Z"),
                        classification: "PATH_ASSOCIATED",
                        changedFiles: ["src/auth.ts"],
                        diffSnippet: "@@ -18,2 +18,3 @@\n+// Authenticate user against verified repository\n+// Logs authentication entry",
                        modifiesFailingFile: true,
                        modifiesFailingSymbol: true,
                    },
                ],
            },
        });

        const reg = analyzeReleasesAndRegressions(snapshot);
        expect(reg.candidates[0]!.behavioralRelevance).toBe("NO_BEHAVIORAL_CHANGE");
        expect(reg.candidates[0]!.mechanismRelevance).toBe("CANNOT_PRODUCE_MECHANISM");
        expect(reg.candidates[0]!.causalSupport).toBe("UNPROVEN_ASSOCIATION");
        expect(reg.candidates[0]!.rollbackAudit?.auditPassed).toBe(false);

        const res = await generateEngineeringRecommendation({ snapshot });
        expect(res.repairLocation?.type).not.toBe("DEPLOYMENT");
    });

    // -------------------------------------------------------------------------
    // Case D: Temporally Close, Unrelated (Deployed 5m prior, touched docs)
    // -------------------------------------------------------------------------
    it("Case D: Temporally Close, Unrelated -> Rollback MUST NOT be recommended", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "case-d-temporally-close",
                title: "Error: Database connection lost",
                firstSeen: new Date("2026-09-18T10:00:00Z"),
                lastSeen: new Date("2026-09-18T10:05:00Z"),
                eventCount: 8,
                environment: "production",
                service: "gateway-service",
            },
            rawEvidence: [
                {
                    id: "ev-case-d",
                    type: "ERROR",
                    title: "Error: Database connection lost",
                    timestamp: "2026-09-18T10:00:00Z",
                    service: "gateway-service",
                    environment: "production",
                    tags: { message: "Database connection lost" },
                },
            ],
            source: {
                filePath: "src/db/client.ts",
                failingLineNumber: 15,
                containingFunction: "connectDb",
                failingExpression: "client.connect()",
                resolutionStatus: "exact_file",
                lines: [{ lineNumber: 15, content: "await client.connect();", isFailingLine: true }],
            },
            release: {
                deployedRelease: "v3.0.1",
                candidates: [
                    {
                        commitSha: "d4e5f6a7b8c9",
                        shortSha: "d4e5f6a",
                        message: "Update README.md architecture diagram",
                        author: "Dave",
                        commitDate: new Date("2026-09-18T09:55:00Z"),
                        classification: "TEMPORALLY_ASSOCIATED",
                        changedFiles: ["README.md", "docs/spec.md"],
                        modifiesFailingFile: false,
                        modifiesFailingSymbol: false,
                    },
                ],
            },
        });

        const reg = analyzeReleasesAndRegressions(snapshot);
        expect(reg.candidates[0]!.sourceAssociation).toBe("UNRELATED");
        expect(reg.candidates[0]!.causalSupport).toBe("UNPROVEN_ASSOCIATION");

        const res = await generateEngineeringRecommendation({ snapshot });
        expect(res.repairLocation?.type).not.toBe("DEPLOYMENT");
    });

    // -------------------------------------------------------------------------
    // Case E: Pre-existing Defect (Deployed recently, but incident started 3 weeks ago)
    // -------------------------------------------------------------------------
    it("Case E: Pre-existing Defect -> Temporally contradicted; rollback MUST NOT be recommended", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "case-e-pre-existing",
                title: "TypeError: Cannot read properties of undefined",
                firstSeen: new Date("2026-08-25T10:00:00Z"), // 3 weeks earlier!
                lastSeen: new Date("2026-09-18T10:05:00Z"),
                eventCount: 350,
                environment: "production",
                service: "order-service",
            },
            rawEvidence: [
                {
                    id: "ev-case-e",
                    type: "ERROR",
                    title: "TypeError: Cannot read properties of undefined",
                    timestamp: "2026-09-18T10:00:00Z",
                    service: "order-service",
                    environment: "production",
                    tags: { message: "Cannot read properties of undefined" },
                },
            ],
            source: {
                filePath: "src/order.ts",
                failingLineNumber: 30,
                containingFunction: "calculateTotal",
                failingExpression: "order.items.length",
                resolutionStatus: "exact_file",
                lines: [{ lineNumber: 30, content: "return order.items.length;", isFailingLine: true }],
            },
            release: {
                deployedRelease: "v2.8.0",
                candidates: [
                    {
                        commitSha: "e5f6a7b8c9d0",
                        shortSha: "e5f6a7b",
                        message: "Modify calculateTotal in order.ts",
                        author: "Eve",
                        commitDate: new Date("2026-09-18T09:00:00Z"), // deployed after firstSeen!
                        changedFiles: ["src/order.ts"],
                        modifiesFailingFile: true,
                        modifiesFailingSymbol: true,
                    },
                ],
            },
        });

        const reg = analyzeReleasesAndRegressions(snapshot);
        expect(reg.candidates[0]!.temporalAssociation).toBe("POST_INCIDENT");
        expect(reg.candidates[0]!.causalSupport).toBe("CONTRADICTED");
        expect(reg.candidates[0]!.classification).toBe("UNRELATED");

        const res = await generateEngineeringRecommendation({ snapshot });
        expect(res.repairLocation?.type).not.toBe("DEPLOYMENT");
    });

    // -------------------------------------------------------------------------
    // Case F: Multiple Commits in Release (None proven causal)
    // -------------------------------------------------------------------------
    it("Case F: Multiple Commits -> Engine does not arbitrarily pick a commit without causal mechanism", async () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "case-f-multiple-commits",
                title: "Error: Unexpected transaction abort",
                firstSeen: new Date("2026-09-18T10:00:00Z"),
                lastSeen: new Date("2026-09-18T10:05:00Z"),
                eventCount: 10,
                environment: "production",
                service: "txn-service",
            },
            rawEvidence: [
                {
                    id: "ev-case-f",
                    type: "ERROR",
                    title: "Error: Unexpected transaction abort",
                    timestamp: "2026-09-18T10:00:00Z",
                    service: "txn-service",
                    environment: "production",
                    tags: { message: "Unexpected transaction abort" },
                },
            ],
            source: {
                filePath: "src/txn.ts",
                failingLineNumber: 50,
                containingFunction: "processTxn",
                failingExpression: "txn.commit()",
                resolutionStatus: "exact_file",
                lines: [{ lineNumber: 50, content: "await txn.commit();", isFailingLine: true }],
            },
            release: {
                deployedRelease: "v4.0.0",
                candidates: [
                    {
                        commitSha: "f11111111111",
                        shortSha: "f111111",
                        message: "Docs update",
                        author: "Frank",
                        commitDate: new Date("2026-09-18T09:30:00Z"),
                        changedFiles: ["README.md"],
                        modifiesFailingFile: false,
                        modifiesFailingSymbol: false,
                    },
                    {
                        commitSha: "f22222222222",
                        shortSha: "f222222",
                        message: "Refactor analytics module",
                        author: "Grace",
                        commitDate: new Date("2026-09-18T09:35:00Z"),
                        changedFiles: ["src/analytics.ts"],
                        modifiesFailingFile: false,
                        modifiesFailingSymbol: false,
                    },
                    {
                        commitSha: "f33333333333",
                        shortSha: "f333333",
                        message: "Update comments in txn.ts",
                        author: "Heidi",
                        commitDate: new Date("2026-09-18T09:40:00Z"),
                        changedFiles: ["src/txn.ts"],
                        modifiesFailingFile: true,
                        modifiesFailingSymbol: false,
                    },
                ],
            },
        });

        const reg = analyzeReleasesAndRegressions(snapshot);
        expect(reg.causallyProvenCandidate).toBeUndefined();

        const res = await generateEngineeringRecommendation({ snapshot });
        expect(res.repairLocation?.type).not.toBe("DEPLOYMENT");
        expect(res.recommendation.actionAnswer?.toLowerCase()).not.toContain("revert f111111");
        expect(res.recommendation.actionAnswer?.toLowerCase()).not.toContain("revert f222222");
        expect(res.recommendation.actionAnswer?.toLowerCase()).not.toContain("revert f333333");
    });
});
