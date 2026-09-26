/**
 * Halo Recommendation Engine — Dual-Gate Rollback & Superiority Evaluation Suite
 *
 * Implements Phase 14 & Phase 15:
 * Validates the Dual-Gate Rollback Architecture:
 *   Gate 1: Causal Verification Gate (Is the commit causally proven to introduce the failure mechanism?)
 *   Gate 2: Safety and Superiority Gate (Is broad rollback superior to a targeted repair at the failure site?)
 *
 * Requirements:
 * 1. Causality is necessary but NOT sufficient for rollback.
 * 2. High blast-radius commits (e.g. multi-feature PRs) must be disqualified from rollback
 *    even when proven causal, preferring targeted repair.
 * 3. Commits with database/schema migrations must be disqualified from rollback.
 * 4. Association-only commits must be blocked at Gate 1.
 */

import { describe, it, expect } from "vitest";
import { evaluateCausalRegressionGate } from "../../causal-regression-gate";
import { determineRepairLocation } from "../../repair-location";
import { buildInvestigationSnapshot } from "../../investigation-snapshot";
import type { CausalEpistemicState, SourceAstAnalysis, ReleaseRegressionContext } from "../../types";

describe("Phase 14 & 15: Dual-Gate Rollback & Superiority Evaluation", () => {
    const defaultCausalState: CausalEpistemicState = {
        failureLocation: {
            status: "CONFIRMED",
            filePath: "src/billing/tax.ts",
            lineNumber: 40,
            symbol: "calculateSurcharge",
            provenance: "Verified repository source",
        },
        failureMechanism: {
            status: "CONFIRMED",
            description: "Function calculateSurcharge removed but call site retained",
            isRuntimeConfirmed: true,
            provenance: "Runtime stack trace and repository diff",
        },
        upstreamCause: {
            status: "CONFIRMED",
            description: "Release commit modified tax.ts directly",
            isRuntimeConfirmed: true,
            provenance: "Git release log",
        },
    };

    const defaultSourceAst: SourceAstAnalysis = {
        hasExactSource: true,
        failingExpression: "calculateSurcharge(amount)",
        errorPropagation: {
            originatesHere: false,
            catchesAndRethrows: false,
            isSilentSuppression: false,
        },
    };

    it("Gate 1 + Gate 2 PASS: Localized regression with minimal blast radius permits rollback", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "halo-rollback-pass",
                title: "ReferenceError: calculateSurcharge is not defined",
                firstSeen: new Date("2026-09-18T10:00:00Z"),
                lastSeen: new Date("2026-09-18T10:05:00Z"),
                eventCount: 10,
                environment: "production",
                service: "billing-service",
            },
            rawEvidence: [],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/billing/tax.ts",
                    lineNumber: 40,
                    functionName: "computeTotalTax",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/billing/tax.ts",
                failingLineNumber: 40,
                containingFunction: "computeTotalTax",
                failingExpression: "calculateSurcharge(amount)",
                lines: [{ lineNumber: 40, content: "calculateSurcharge(amount);", isFailingLine: true }],
            },
        });

        const regressionContext: ReleaseRegressionContext = {
            deployedRelease: "v2.1.0",
            causallyProvenCandidate: {
                commitSha: "a1b2c3d4e5f67890123456789012345678901234",
                shortSha: "a1b2c3d",
                message: "Refactor tax computation",
                author: "Dev",
                commitDate: new Date("2026-09-18T09:50:00Z"),
                classification: "CONFIRMED_REGRESSION",
                changedFiles: ["src/billing/tax.ts"],
                modifiesFailingFile: true,
                modifiesFailingSymbol: true,
                directlyModifiesFailingLine: true,
                diffSnippet: "- function calculateSurcharge\n+ // removed",
                rollbackAudit: {
                    behaviorIntroducedProven: true,
                    rollbackRemovesBehavior: true,
                    previousRevisionHealthy: true,
                    touchesOnlyFailingFile: true,
                    unrelatedChangesBlastRadius: "MINIMAL",
                    invariantRestored: true,
                    reintroducesKnownDefect: false,
                    safeForDeploymentState: true,
                    targetedRepairSmallerBlastRadius: false,
                    behaviorallyValidated: true,
                    auditPassed: true,
                },
            },
            candidates: [],
        };

        const verdict = evaluateCausalRegressionGate({
            snapshot,
            regressionContext,
            causalState: defaultCausalState,
            sourceAst: defaultSourceAst,
        });

        expect(verdict.isCausallyValid).toBe(true);
        expect(verdict.isRollbackSuperior).toBe(true);
        expect(verdict.isRollbackEligible).toBe(true);
        expect(verdict.superiorityRationale).toContain("safe, clean, and directly restores");

        const repairLoc = determineRepairLocation(snapshot, defaultCausalState, {} as any, defaultSourceAst, regressionContext);
        expect(repairLoc.type).toBe("DEPLOYMENT");
    });

    it("Gate 2 DISQUALIFICATION: Causally proven commit with HIGH blast radius prefers targeted repair over rollback", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "halo-rollback-high-blast",
                title: "ReferenceError: calculateSurcharge is not defined",
                firstSeen: new Date("2026-09-18T10:00:00Z"),
                lastSeen: new Date("2026-09-18T10:05:00Z"),
                eventCount: 10,
                environment: "production",
                service: "billing-service",
            },
            rawEvidence: [],
            stackFrames: [
                {
                    order: 1,
                    filePath: "src/billing/tax.ts",
                    lineNumber: 40,
                    functionName: "computeTotalTax",
                    isApplication: true,
                    classification: "Application",
                },
            ],
            source: {
                filePath: "src/billing/tax.ts",
                failingLineNumber: 40,
                containingFunction: "computeTotalTax",
                failingExpression: "calculateSurcharge(amount)",
                lines: [{ lineNumber: 40, content: "calculateSurcharge(amount);", isFailingLine: true }],
            },
        });

        const regressionContext: ReleaseRegressionContext = {
            deployedRelease: "v2.2.0",
            causallyProvenCandidate: {
                commitSha: "e9f8d7c6b5a43210987654321098765432109876",
                shortSha: "e9f8d7c",
                message: "Massive quarterly release (15 features across 42 files)",
                author: "Team",
                commitDate: new Date("2026-09-18T09:40:00Z"),
                classification: "CONFIRMED_REGRESSION",
                changedFiles: [
                    "src/billing/tax.ts",
                    "src/auth/jwt.ts",
                    "src/dashboard/stats.ts",
                    "src/users/avatar.ts",
                    "src/notifications/slack.ts",
                ],
                modifiesFailingFile: true,
                modifiesFailingSymbol: true,
                directlyModifiesFailingLine: true,
                diffSnippet: "- function calculateSurcharge",
                rollbackAudit: {
                    behaviorIntroducedProven: true,
                    rollbackRemovesBehavior: true,
                    previousRevisionHealthy: true,
                    touchesOnlyFailingFile: false,
                    unrelatedChangesBlastRadius: "HIGH",
                    invariantRestored: true,
                    reintroducesKnownDefect: false,
                    safeForDeploymentState: true,
                    targetedRepairSmallerBlastRadius: true,
                    behaviorallyValidated: true,
                    auditPassed: false,
                    refusalReason: "Targeted code fix preferred: commit contains broad unrelated changes that would be reverted unnecessarily.",
                },
            },
            candidates: [],
        };

        const verdict = evaluateCausalRegressionGate({
            snapshot,
            regressionContext,
            causalState: defaultCausalState,
            sourceAst: defaultSourceAst,
        });

        // Causality is proven!
        expect(verdict.isCausallyValid).toBe(true);
        // But rollback is disqualified by the superiority gate!
        expect(verdict.isRollbackSuperior).toBe(false);
        expect(verdict.isRollbackEligible).toBe(false);
        expect(verdict.superiorityRationale).toContain("broad rollback is disqualified because it contains unrelated changes with high blast radius");

        // The repair location engine must select targeted code fix (CALLEE), NOT DEPLOYMENT!
        const repairLoc = determineRepairLocation(snapshot, defaultCausalState, {} as any, defaultSourceAst, regressionContext);
        expect(repairLoc.type).toBe("CALLEE");
        expect(repairLoc.targetFile).toBe("src/billing/tax.ts");
        expect(repairLoc.rationale).toContain("targeted repair is selected over rollback");
    });

    it("Gate 2 DISQUALIFICATION: Commit with database migration blocks rollback", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "halo-rollback-migration",
                title: "ReferenceError: calculateSurcharge is not defined",
                firstSeen: new Date("2026-09-18T10:00:00Z"),
                lastSeen: new Date("2026-09-18T10:05:00Z"),
                eventCount: 10,
                environment: "production",
                service: "billing-service",
            },
            rawEvidence: [],
            stackFrames: [],
            source: {
                filePath: "src/billing/tax.ts",
                failingLineNumber: 40,
                containingFunction: "computeTotalTax",
                failingExpression: "calculateSurcharge(amount)",
                lines: [{ lineNumber: 40, content: "calculateSurcharge(amount);", isFailingLine: true }],
            },
        });

        const regressionContext: ReleaseRegressionContext = {
            deployedRelease: "v2.3.0",
            causallyProvenCandidate: {
                commitSha: "c1c2c3c4c5c67890123456789012345678901234",
                shortSha: "c1c2c3c",
                message: "Update tax rates and add ledger table migration",
                author: "DBAdmin",
                commitDate: new Date("2026-09-18T09:30:00Z"),
                classification: "CONFIRMED_REGRESSION",
                changedFiles: ["src/billing/tax.ts", "prisma/migrations/20260918_ledger.sql"],
                modifiesFailingFile: true,
                modifiesFailingSymbol: true,
                directlyModifiesFailingLine: true,
                diffSnippet: "- function calculateSurcharge",
                rollbackAudit: {
                    behaviorIntroducedProven: true,
                    rollbackRemovesBehavior: true,
                    previousRevisionHealthy: true,
                    touchesOnlyFailingFile: false,
                    unrelatedChangesBlastRadius: "MODERATE",
                    invariantRestored: true,
                    reintroducesKnownDefect: false,
                    safeForDeploymentState: false,
                    targetedRepairSmallerBlastRadius: true,
                    behaviorallyValidated: true,
                    auditPassed: false,
                    refusalReason: "Rollback withheld: commit includes database migrations or schema alterations; rollback requires manual data remediation.",
                } as any,
            },
            candidates: [],
        };

        // Attach migrationOrDataImplications
        (regressionContext.causallyProvenCandidate!.rollbackAudit as any).migrationOrDataImplications = true;

        const verdict = evaluateCausalRegressionGate({
            snapshot,
            regressionContext,
            causalState: defaultCausalState,
            sourceAst: defaultSourceAst,
        });

        expect(verdict.isCausallyValid).toBe(true);
        expect(verdict.isRollbackSuperior).toBe(false);
        expect(verdict.isRollbackEligible).toBe(false);
        expect(verdict.superiorityRationale).toContain("database migrations");
    });

    it("Gate 1 DISQUALIFICATION: Unproven association commit is blocked before reaching superiority gate", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "halo-rollback-unproven",
                title: "ReferenceError: calculateSurcharge is not defined",
                firstSeen: new Date("2026-09-18T10:00:00Z"),
                lastSeen: new Date("2026-09-18T10:05:00Z"),
                eventCount: 10,
                environment: "production",
                service: "billing-service",
            },
            rawEvidence: [],
            stackFrames: [],
            source: {
                filePath: "src/billing/tax.ts",
                failingLineNumber: 40,
                containingFunction: "computeTotalTax",
                failingExpression: "calculateSurcharge(amount)",
                lines: [{ lineNumber: 40, content: "calculateSurcharge(amount);", isFailingLine: true }],
            },
        });

        const regressionContext: ReleaseRegressionContext = {
            deployedRelease: "v2.0.0",
            candidates: [
                {
                    commitSha: "9988776655443322110099887766554433221100",
                    shortSha: "9988776",
                    message: "Update README and CI workflow",
                    author: "DocsBot",
                    commitDate: new Date("2026-09-18T09:00:00Z"),
                    classification: "TEMPORALLY_ASSOCIATED",
                    changedFiles: ["README.md", ".github/workflows/ci.yml"],
                    modifiesFailingFile: false,
                    modifiesFailingSymbol: false,
                    directlyModifiesFailingLine: false,
                    executionRelevance: "UNKNOWN",
                    behavioralRelevance: "NO_BEHAVIORAL_CHANGE",
                },
            ],
        };

        const verdict = evaluateCausalRegressionGate({
            snapshot,
            regressionContext,
            causalState: defaultCausalState,
            sourceAst: defaultSourceAst,
        });

        expect(verdict.isCausallyValid).toBe(false);
        expect(verdict.isRollbackSuperior).toBe(false);
        expect(verdict.isRollbackEligible).toBe(false);
        expect(verdict.blockingReason).toContain("withheld rollback");
    });
});
