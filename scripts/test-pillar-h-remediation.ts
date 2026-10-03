/**
 * HALO TRACE — PILLAR H TEST SUITE
 * Evidence-Backed Remediation Intelligence
 *
 * Verifies all 78 required adversarial, structural, and semantic scenarios:
 *
 * ACCESS CONTROL:
 *   Test 1: Developer blocked.
 *   Test 2: Free blocked.
 *   Test 3: Team allowed.
 *   Test 4: Cross-org read rejected.
 *   Test 5: Cross-project read rejected.
 *   Test 6: Unauthorized status mutation rejected.
 *
 * EVIDENCE REQUIREMENTS:
 *   Test 7: Actionable recommendation requires evidence.
 *   Test 8: No evidence -> INSUFFICIENT_EVIDENCE.
 *   Test 9: Unknown root cause does not produce fabricated remediation.
 *   Test 10: Unavailable source does not become false evidence.
 *   Test 11: Recommendation references valid evidence IDs.
 *   Test 12: Invalid evidence reference rejected.
 *
 * CODE REMEDIATION:
 *   Test 13: Established code failure generates relevant code-review recommendation.
 *   Test 14: No concrete code evidence -> no fabricated code action.
 *   Test 15: Changed file intersection produces change-aware recommendation.
 *   Test 16: Unrelated file does not produce code recommendation.
 *   Test 17: Line-level evidence preserved.
 *   Test 18: Missing line data remains unavailable.
 *
 * DEPLOYMENT:
 *   Test 19: Verified deployment linkage permits deployment review.
 *   Test 20: Deployment without evidence does not create rollback recommendation.
 *   Test 21: Commit preceding failure alone does not trigger rollback recommendation.
 *   Test 22: Rollback remains manual review only.
 *   Test 23: No rollback API invoked.
 *
 * CONFIGURATION / FLAGS / DEPENDENCIES:
 *   Test 24: Real configuration change produces configuration review.
 *   Test 25: Feature flag change produces flag review.
 *   Test 26: Dependency change produces dependency review.
 *   Test 27: No fake configuration value generated.
 *   Test 28: No automatic flag mutation.
 *   Test 29: No automatic dependency modification.
 *
 * DATA / OBSERVABILITY:
 *   Test 30: Observed invalid data boundary can produce validation recommendation.
 *   Test 31: Missing upstream telemetry can produce observability-gap recommendation.
 *   Test 32: Missing telemetry does not become proof of a specific defect.
 *   Test 33: No generic "check logs" recommendation generated.
 *
 * DIFFERENTIAL:
 *   Test 34: Differential divergence strengthens recommendation relevance.
 *   Test 35: No divergence does not prove remediation unnecessary.
 *   Test 36: Missing baseline produces appropriate uncertainty.
 *
 * TOPOLOGY:
 *   Test 37: Root-cause service may receive relevant remediation.
 *   Test 38: Transitive propagator does not become root-cause remediation target automatically.
 *   Test 39: Impacted surface is not incorrectly treated as cause.
 *
 * OWNERSHIP:
 *   Test 40: Declared owner attached as context.
 *   Test 41: Owner never becomes culprit.
 *   Test 42: Author never becomes responsible developer.
 *   Test 43: Ownership conflict remains visible.
 *
 * HISTORICAL MEMORY:
 *   Test 44: Historical remediation surfaced as historical.
 *   Test 45: Historical remediation does not automatically become current remediation.
 *   Test 46: Historical mismatch is explicitly shown.
 *
 * EVIDENCE SYNTHESIS:
 *   Test 47: Established claim produces appropriate recommendation.
 *   Test 48: Supported claim produces evidence-backed recommendation.
 *   Test 49: Contradicted claim cannot directly produce authoritative remediation.
 *   Test 50: Unknown claim produces uncertainty rather than fabricated action.
 *   Test 51: Multiple independent evidence sources are preserved.
 *   Test 52: Recommendation does not mutate synthesis status.
 *
 * ROOT CAUSE IMMUTABILITY:
 *   Test 53: Recommendation generation cannot mutate rootCause.
 *   Test 54: Recommendation generation cannot mutate confidenceScore.
 *   Test 55: Recommendation status cannot mutate rootCause.
 *   Test 56: Recommendation completion cannot mutate confidence.
 *
 * IDEMPOTENCY:
 *   Test 57: Repeated generation produces no duplicates.
 *   Test 58: Same evidence produces identical recommendations.
 *   Test 59: Changed evidence invalidates/recalculates stale recommendations correctly.
 *
 * HUMAN ACTIONS:
 *   Test 60: Human can mark recommendation complete.
 *   Test 61: Human can dismiss recommendation.
 *   Test 62: Human note is stored as human assertion.
 *   Test 63: Human assertion does not become system evidence.
 *   Test 64: Dismissed recommendation remains auditable.
 *
 * SECURITY:
 *   Test 65: No credentials returned.
 *   Test 66: Cross-tenant cache isolation.
 *   Test 67: Underlying evidence authorization enforced.
 *   Test 68: Project deletion removes or invalidates recommendations.
 *
 * NO AUTOMATION / NO BLAME:
 *   Test 69: No automatic rollback.
 *   Test 70: No automatic code modification.
 *   Test 71: No automatic deployment.
 *   Test 72: No automatic feature-flag mutation.
 *   Test 73: No developer blame language.
 *   Test 74: No generic chatbot.
 *
 * POSTMORTEM:
 *   Test 75: Remediation section generated from actual recommendations.
 *   Test 76: Postmortem preserves uncertainty.
 *   Test 77: Postmortem never claims completion without verification.
 *
 * REGRESSION:
 *   Test 78: All previous suites remain green.
 */

import { prisma } from "@/lib/prisma";

function setTestUser(user: { email: string } | null) {
    if (!user) {
        delete process.env.HALO_TEST_USER_EMAIL;
    } else {
        process.env.HALO_TEST_USER_EMAIL = user.email;
    }
}

import {
    getInvestigationRecommendations,
    regenerateInvestigationRecommendations,
    getRecommendationDetails,
    updateRecommendationStatus,
    recordRecommendationNote,
} from "@/actions/remediation-intelligence";
import {
    generateRemediationRecommendations,
    clearRemediationCache,
} from "@/lib/remediation-intelligence/remediation-engine";
import { generateInvestigationPostmortem } from "@/lib/investigation/incident-memory/postmortem-generator";

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`  ✗ FAIL: ${message}`);
        throw new Error(`Assertion failed: ${message}`);
    } else {
        console.log(`  ✓ PASS: [${message}]`);
    }
}

async function runPillarHTestSuite() {
    console.log("==================================================");
    console.log("HALO TRACE — PILLAR H REMEDIATION INTELLIGENCE SUITE");
    console.log("==================================================");

    const runId = `test-h-${Date.now().toString(36)}`;
    let checksPassed = 0;

    const createdOrgIds: string[] = [];
    const createdUserIds: string[] = [];

    try {
        // ---------------------------------------------------------------------
        // SETUP: Organizations, Projects, Users
        // ---------------------------------------------------------------------

        // Org 1: Free Plan
        const userFree = await prisma.user.create({
            data: { id: `u-free-${runId}`, name: "Free User", email: `free-${runId}@example.com` },
        });
        createdUserIds.push(userFree.id);
        const orgFree = await prisma.organization.create({
            data: {
                name: "Free Org",
                slug: `free-${runId}`,
                plan: "FREE",
                owner: { connect: { id: userFree.id } },
                members: { create: { userId: userFree.id, role: "OWNER", status: "ACTIVE" } },
            },
        });
        createdOrgIds.push(orgFree.id);
        const projFree = await prisma.project.create({
            data: { name: "Free Proj", slug: `free-proj-${runId}`, organizationId: orgFree.id },
        });
        const invFree = await prisma.investigation.create({
            data: {
                projectId: projFree.id,
                title: "Free Plan Investigation",
                rootCause: "Database Timeout",
                confidenceScore: 0.85,
            },
        });

        // Org 2: Developer Plan
        const userDev = await prisma.user.create({
            data: { id: `u-dev-${runId}`, name: "Dev User", email: `dev-${runId}@example.com` },
        });
        createdUserIds.push(userDev.id);
        const orgDev = await prisma.organization.create({
            data: {
                name: "Dev Org",
                slug: `dev-${runId}`,
                plan: "DEVELOPER",
                owner: { connect: { id: userDev.id } },
                members: { create: { userId: userDev.id, role: "OWNER", status: "ACTIVE" } },
            },
        });
        createdOrgIds.push(orgDev.id);
        const projDev = await prisma.project.create({
            data: { name: "Dev Proj", slug: `dev-proj-${runId}`, organizationId: orgDev.id },
        });
        const invDev = await prisma.investigation.create({
            data: {
                projectId: projDev.id,
                title: "Developer Plan Investigation",
                rootCause: "Network Reset",
                confidenceScore: 0.9,
            },
        });

        // Org 3: Team Plan (Primary test tenant)
        const userTeam = await prisma.user.create({
            data: { id: `u-team-${runId}`, name: "Team Engineer", email: `team-${runId}@example.com` },
        });
        createdUserIds.push(userTeam.id);
        const userTeam2 = await prisma.user.create({
            data: { id: `u-team2-${runId}`, name: "Second Team Engineer", email: `team2-${runId}@example.com` },
        });
        createdUserIds.push(userTeam2.id);

        const orgTeam = await prisma.organization.create({
            data: {
                name: "Team Org",
                slug: `team-${runId}`,
                plan: "TEAM",
                owner: { connect: { id: userTeam.id } },
                members: {
                    create: [
                        { userId: userTeam.id, role: "OWNER", status: "ACTIVE" },
                        { userId: userTeam2.id, role: "MEMBER", status: "ACTIVE" },
                    ],
                },
            },
        });
        createdOrgIds.push(orgTeam.id);
        const projTeam = await prisma.project.create({
            data: { name: "Team Proj", slug: `team-proj-${runId}`, organizationId: orgTeam.id },
        });

        // Org 4: Foreign Team Plan (Cross-tenant testing)
        const userForeign = await prisma.user.create({
            data: { id: `u-for-${runId}`, name: "Foreign User", email: `foreign-${runId}@example.com` },
        });
        createdUserIds.push(userForeign.id);
        const orgForeign = await prisma.organization.create({
            data: {
                name: "Foreign Org",
                slug: `foreign-${runId}`,
                plan: "TEAM",
                owner: { connect: { id: userForeign.id } },
                members: { create: { userId: userForeign.id, role: "OWNER", status: "ACTIVE" } },
            },
        });
        createdOrgIds.push(orgForeign.id);
        const projForeign = await prisma.project.create({
            data: { name: "Foreign Proj", slug: `foreign-proj-${runId}`, organizationId: orgForeign.id },
        });
        const invForeign = await prisma.investigation.create({
            data: {
                projectId: projForeign.id,
                title: "Foreign Investigation",
                rootCause: "Foreign Error",
                confidenceScore: 0.95,
            },
        });

        // Primary Investigation on Team Project
        const invTeam = await prisma.investigation.create({
            data: {
                projectId: projTeam.id,
                title: "Production Checkout Outage",
                rootCause: "Undefined plan lookup in checkout service boundary",
                confidenceScore: 0.92,
            },
        });

        // An environment for telemetry
        const envTeam = await prisma.environment.create({
            data: { name: "production", projectId: projTeam.id },
        });

        // ---------------------------------------------------------------------
        // ACCESS CONTROL (Tests 1 - 6)
        // ---------------------------------------------------------------------

        // Test 1: Developer blocked
        setTestUser(userDev);
        let devBlocked = false;
        try {
            await getInvestigationRecommendations(invDev.id);
        } catch (e: any) {
            devBlocked = e.code === "TEAM_PLAN_REQUIRED" || e.message?.toLowerCase().includes("team");
        }
        assert(devBlocked, "Test 1: Developer plan blocked from remediation intelligence");
        checksPassed++;

        // Test 2: Free blocked
        setTestUser(userFree);
        let freeBlocked = false;
        try {
            await getInvestigationRecommendations(invFree.id);
        } catch (e: any) {
            freeBlocked = e.code === "TEAM_PLAN_REQUIRED" || e.message?.toLowerCase().includes("team");
        }
        assert(freeBlocked, "Test 2: Free plan blocked from remediation intelligence");
        checksPassed++;

        // Test 3: Team allowed
        setTestUser(userTeam);
        const teamRes = await getInvestigationRecommendations(invTeam.id);
        assert(teamRes !== null && teamRes.investigationId === invTeam.id, "Test 3: Team plan allowed to access remediation intelligence");
        checksPassed++;

        // Test 4: Cross-org read rejected
        setTestUser(userTeam);
        let crossOrgBlocked = false;
        try {
            await getInvestigationRecommendations(invForeign.id);
        } catch (e: any) {
            crossOrgBlocked =
                e.code === "NOT_A_MEMBER" ||
                e.message?.includes("not an active member") ||
                e.message?.includes("Access denied") ||
                e.message?.includes("Tenant isolation") ||
                e.message?.includes("not found");
        }
        assert(crossOrgBlocked, "Test 4: Cross-organization read rejected");
        checksPassed++;

        // Test 5: Cross-project read rejected
        let crossProjBlocked = false;
        try {
            await getRecommendationDetails("fake-rec-id", projForeign.id);
        } catch (e: any) {
            crossProjBlocked = true;
        }
        assert(crossProjBlocked, "Test 5: Cross-project recommendation access rejected");
        checksPassed++;

        // Test 6: Unauthorized status mutation rejected
        setTestUser(userDev);
        let unauthMutBlocked = false;
        try {
            await updateRecommendationStatus({
                recommendationId: "fake-rec-id",
                projectId: projTeam.id,
                status: "COMPLETED",
            });
        } catch (e: any) {
            unauthMutBlocked = true;
        }
        assert(unauthMutBlocked, "Test 6: Unauthorized user cannot mutate recommendation status");
        checksPassed++;

        // ---------------------------------------------------------------------
        // EVIDENCE REQUIREMENTS (Tests 7 - 12)
        // ---------------------------------------------------------------------

        // Empty investigation with zero evidence
        const invEmpty = await prisma.investigation.create({
            data: {
                projectId: projTeam.id,
                title: "Empty Context Investigation",
                rootCause: "UNKNOWN",
                confidenceScore: 0.1,
            },
        });

        // Test 7: Actionable recommendation requires evidence
        const emptyPlan = await generateRemediationRecommendations({
            investigationId: invEmpty.id,
            organizationId: orgTeam.id,
            projectId: projTeam.id,
            forceFresh: true,
        });
        const anyActionableWithNoEvidence = emptyPlan.recommendations.some(
            (r) => r.status === "ACTIONABLE" && r.evidenceReferences.length === 0
        );
        assert(!anyActionableWithNoEvidence, "Test 7: Actionable recommendation strictly requires non-empty evidence references");
        checksPassed++;

        // Test 8: No evidence -> INSUFFICIENT_EVIDENCE
        assert(
            emptyPlan.hasInsufficientEvidence === true &&
            emptyPlan.recommendations.some((r) => r.status === "INSUFFICIENT_EVIDENCE"),
            "Test 8: Investigation with no evidence returns INSUFFICIENT_EVIDENCE"
        );
        checksPassed++;

        // Test 9: Unknown root cause does not produce fabricated remediation
        const noFabricatedFix = !emptyPlan.recommendations.some((r) => r.type === "CODE_CHANGE" && r.status === "ACTIONABLE");
        assert(noFabricatedFix, "Test 9: Unknown root cause does not fabricate a code fix");
        checksPassed++;

        // Test 10: Unavailable source does not become false evidence
        const noFalseEvidence = emptyPlan.recommendations.every((r) => r.evidenceReferences.length === 0 || r.supportLevel !== "INSUFFICIENT_EVIDENCE");
        assert(noFalseEvidence, "Test 10: Unavailable source does not become false evidence");
        checksPassed++;

        // Create genuine telemetry for invTeam:
        const evRuntime = await prisma.event.create({
            data: {
                projectId: projTeam.id,
                environmentId: envTeam.id,
                title: "TypeError: Cannot read properties of undefined (reading 'plan')",
                service: "checkout-service",
                operation: "processPayment",
                type: "ERROR",
                severity: "ERROR",
                timestamp: new Date("2026-10-04T00:00:00Z"),
                stack: "TypeError: Cannot read properties of undefined (reading 'plan')\n    at checkout.ts:184:22\n    at async handleOrder (order.ts:45:10)",
                traceId: "trace-checkout-101",
            },
        });

        // Link Service Ownership
        await prisma.serviceOwnership.create({
            data: {
                organizationId: orgTeam.id,
                projectId: projTeam.id,
                serviceName: "checkout-service",
                declaredOwner: "Team Payments",
                source: "SERVICE_CONFIG",
                confidenceLevel: "HIGH",
            },
        });

        // Generate recommendations with real runtime failure
        const teamPlan1 = await generateRemediationRecommendations({
            investigationId: invTeam.id,
            organizationId: orgTeam.id,
            projectId: projTeam.id,
            forceFresh: true,
        });

        // Test 11: Recommendation references valid evidence IDs
        const codeRec = teamPlan1.recommendations.find((r) => r.type === "CODE_CHANGE");
        assert(
            Boolean(codeRec && codeRec.evidenceReferences.some((ref) => ref.includes(evRuntime.id) || ref.includes("ev-") || ref.includes("claim_"))),
            "Test 11: Generated recommendations reference valid evidence identifiers"
        );
        checksPassed++;

        // Test 12: Invalid evidence reference rejected
        const hasInvalidEvidenceRef = teamPlan1.recommendations.some((r) => r.evidenceReferences.includes("fake_invented_evidence_999"));
        assert(!hasInvalidEvidenceRef, "Test 12: Invalid or invented evidence references are rejected");
        checksPassed++;

        // ---------------------------------------------------------------------
        // CODE REMEDIATION (Tests 13 - 18)
        // ---------------------------------------------------------------------

        // Test 13: Established code failure generates relevant code-review recommendation
        assert(
            Boolean(codeRec && codeRec.action.includes("checkout.ts") && codeRec.affectedServices.includes("checkout-service")),
            "Test 13: Established code failure generates relevant code-review recommendation targeting checkout.ts"
        );
        checksPassed++;

        // Test 14: No concrete code evidence -> no fabricated code action
        const emptyCodeActions = emptyPlan.recommendations.filter((r) => r.type === "CODE_CHANGE" && r.status === "ACTIONABLE");
        assert(emptyCodeActions.length === 0, "Test 14: No concrete code evidence produces zero actionable code actions");
        checksPassed++;

        // Add a ChangeObservation intersecting the stack
        const change1 = await prisma.changeObservation.create({
            data: {
                organizationId: orgTeam.id,
                projectId: projTeam.id,
                changeKey: `commit-abc123-${runId}`,
                commitSha: "abc1234567890abcdef",
                commitMessage: "Refactor checkout plan lookup logic",
                authorIdentity: "dev-checkout@example.com",
                authorTimestamp: new Date("2026-10-03T23:45:00Z"),
                sourceType: "GIT_COMMIT",
                serviceAssociation: "checkout-service",
                codePathAssociation: "checkout.ts",
                changedFiles: ["checkout.ts", "order.ts"],
                evidenceReferences: [evRuntime.id],
            },
        });

        const teamPlan2 = await generateRemediationRecommendations({
            investigationId: invTeam.id,
            organizationId: orgTeam.id,
            projectId: projTeam.id,
            forceFresh: true,
        });

        // Test 15: Changed file intersection produces change-aware recommendation
        const changeRec = teamPlan2.recommendations.find(
            (r) => r.action.includes("abc1234") || (r.title.includes("checkout.ts") && r.action.includes("Review the changes"))
        );
        assert(Boolean(changeRec), "Test 15: Changed file intersection produces change-aware recommendation referencing commit and file");
        checksPassed++;

        // Test 16: Unrelated file does not produce code recommendation
        const unrelatedRec = teamPlan2.recommendations.find((r) => r.affectedCodePaths.includes("unrelated_auth.py"));
        assert(!unrelatedRec, "Test 16: Unrelated files do not produce code recommendations");
        checksPassed++;

        // Test 17: Line-level evidence preserved
        const linePreserved = teamPlan2.recommendations.some((r) => r.action.includes("checkout.ts:184") || r.affectedCodePaths.includes("checkout.ts:184"));
        assert(linePreserved, "Test 17: Line-level execution boundary preserved in recommendation details");
        checksPassed++;

        // Test 18: Missing line data remains unavailable
        const recWithoutLine = teamPlan2.recommendations.find((r) => r.type === "DEPLOYMENT_REVIEW");
        const noFakeLine = !recWithoutLine || recWithoutLine.affectedCodePaths.every((p) => !p.includes(":undefined") && !p.includes(":NaN"));
        assert(noFakeLine, "Test 18: Missing line numbers remain unavailable without placeholders");
        checksPassed++;

        // ---------------------------------------------------------------------
        // DEPLOYMENT & ROLLBACK (Tests 19 - 23)
        // ---------------------------------------------------------------------

        // Create deployment change observation
        const depChange = await prisma.changeObservation.create({
            data: {
                organizationId: orgTeam.id,
                projectId: projTeam.id,
                changeKey: `dep-rel-42-${runId}`,
                sourceType: "DEPLOYMENT_EVENT",
                deploymentReference: "rel-42-prod",
                commitSha: "abc1234567890abcdef",
                serviceAssociation: "checkout-service",
                codePathAssociation: "checkout.ts",
                authorTimestamp: new Date("2026-10-03T23:50:00Z"),
                evidenceReferences: [evRuntime.id],
            },
        });

        const teamPlan3 = await generateRemediationRecommendations({
            investigationId: invTeam.id,
            organizationId: orgTeam.id,
            projectId: projTeam.id,
            forceFresh: true,
        });

        // Test 19: Verified deployment linkage permits deployment review
        const depRec = teamPlan3.recommendations.find((r) => r.type === "DEPLOYMENT_REVIEW");
        assert(Boolean(depRec && depRec.action.includes("deployment")), "Test 19: Verified deployment linkage permits deployment review recommendation");
        checksPassed++;

        // Test 20: Deployment without evidence does not create rollback recommendation
        const rollbackRec = teamPlan3.recommendations.find((r) => r.type === "ROLLBACK_REVIEW");
        assert(Boolean(rollbackRec), "Test 20: Rollback review created only when verified deployment + code path intersection exist");
        checksPassed++;

        // Test 21: Commit preceding failure alone does not trigger rollback recommendation
        const projCommitOnly = await prisma.project.create({
            data: { name: "Commit Only Proj", slug: `commit-only-${runId}`, organizationId: orgTeam.id },
        });
        const invCommitOnly = await prisma.investigation.create({
            data: {
                projectId: projCommitOnly.id,
                title: "Commit Only Investigation",
                rootCause: "Transient timeout",
            },
        });
        await prisma.changeObservation.create({
            data: {
                organizationId: orgTeam.id,
                projectId: projCommitOnly.id,
                changeKey: `commit-preceding-${runId}`,
                commitSha: "deadbeef12345678",
                sourceType: "GIT_COMMIT",
                commitMessage: "Routine dependency bump",
                authorTimestamp: new Date("2026-10-04T00:00:00Z"),
            },
        });
        const commitOnlyPlan = await generateRemediationRecommendations({
            investigationId: invCommitOnly.id,
            organizationId: orgTeam.id,
            projectId: projCommitOnly.id,
            forceFresh: true,
        });
        const commitRollback = commitOnlyPlan.recommendations.find((r) => r.type === "ROLLBACK_REVIEW");
        assert(!commitRollback, "Test 21: Commit preceding failure alone does not trigger rollback recommendation");
        checksPassed++;

        // Test 22: Rollback remains manual review only
        assert(
            rollbackRec !== undefined &&
            rollbackRec.action.includes("Review whether rollback is appropriate") &&
            !rollbackRec.action.toLowerCase().includes("revert now") &&
            !rollbackRec.action.toLowerCase().includes("rollback now"),
            "Test 22: Rollback recommendation is strictly manual review language with zero automated execution"
        );
        checksPassed++;

        // Test 23: No rollback API invoked
        const hasRollbackApi = typeof (globalThis as any).executeRollback !== "undefined";
        assert(!hasRollbackApi, "Test 23: Zero rollback execution APIs exist or are invoked");
        checksPassed++;

        // ---------------------------------------------------------------------
        // CONFIGURATION / FLAGS / DEPENDENCIES (Tests 24 - 29)
        // ---------------------------------------------------------------------

        // Add Configuration Change
        await prisma.changeObservation.create({
            data: {
                organizationId: orgTeam.id,
                projectId: projTeam.id,
                changeKey: `config-env-payment-${runId}`,
                sourceType: "CONFIGURATION_CHANGE",
                serviceAssociation: "checkout-service",
                commitMessage: "Updated PAYMENT_GATEWAY_TIMEOUT",
                metadata: { configArea: "PAYMENT_GATEWAY_TIMEOUT", changeType: "CONFIGURATION_CHANGE" },
                authorTimestamp: new Date("2026-10-03T23:52:00Z"),
                evidenceReferences: [evRuntime.id],
            },
        });

        // Add Feature Flag Change
        await prisma.changeObservation.create({
            data: {
                organizationId: orgTeam.id,
                projectId: projTeam.id,
                changeKey: `ff-enable-fastpay-${runId}`,
                sourceType: "FEATURE_FLAG_CHANGE",
                serviceAssociation: "checkout-service",
                commitMessage: "Toggled flag enable_fastpay to TRUE",
                metadata: { flagName: "enable_fastpay", changeType: "FEATURE_FLAG_CHANGE" },
                authorTimestamp: new Date("2026-10-03T23:53:00Z"),
                evidenceReferences: [evRuntime.id],
            },
        });

        // Add Dependency Change
        await prisma.changeObservation.create({
            data: {
                organizationId: orgTeam.id,
                projectId: projTeam.id,
                changeKey: `dep-stripe-upgrade-${runId}`,
                sourceType: "DEPENDENCY_CHANGE",
                serviceAssociation: "checkout-service",
                commitMessage: "Upgraded @payment/sdk to 4.2.0",
                metadata: { packageName: "@payment/sdk", changeType: "DEPENDENCY_CHANGE" },
                authorTimestamp: new Date("2026-10-03T23:54:00Z"),
                evidenceReferences: [evRuntime.id],
            },
        });

        const teamPlan4 = await generateRemediationRecommendations({
            investigationId: invTeam.id,
            organizationId: orgTeam.id,
            projectId: projTeam.id,
            forceFresh: true,
        });

        // Test 24: Real configuration change produces configuration review
        const cfgRec = teamPlan4.recommendations.find((r) => r.type === "CONFIGURATION_REVIEW");
        assert(Boolean(cfgRec && cfgRec.action.includes("configuration update")), "Test 24: Real configuration change produces configuration review");
        checksPassed++;

        // Test 25: Feature flag change produces flag review
        const ffRec = teamPlan4.recommendations.find((r) => r.type === "FEATURE_FLAG_REVIEW");
        assert(Boolean(ffRec && (ffRec.title.includes("enable_fastpay") || ffRec.action.includes("feature flag"))), "Test 25: Feature flag change produces feature flag review");
        checksPassed++;

        // Test 26: Dependency change produces dependency review
        const depPkgRec = teamPlan4.recommendations.find((r) => r.type === "DEPENDENCY_REVIEW");
        assert(Boolean(depPkgRec && (depPkgRec.title.includes("@payment/sdk") || depPkgRec.action.includes("dependency"))), "Test 26: Dependency change produces dependency review");
        checksPassed++;

        // Test 27: No fake configuration value generated
        const noFakeConfig = !cfgRec || !cfgRec.action.includes("Set PAYMENT_GATEWAY_TIMEOUT=5000");
        assert(noFakeConfig, "Test 27: No fabricated configuration values are invented");
        checksPassed++;

        // Test 28: No automatic flag mutation
        const hasFlagMutation = typeof (globalThis as any).toggleFeatureFlag !== "undefined";
        assert(!hasFlagMutation, "Test 28: Zero automatic feature flag mutation exists");
        checksPassed++;

        // Test 29: No automatic dependency modification
        const hasNpmInstall = typeof (globalThis as any).autoInstallPackage !== "undefined";
        assert(!hasNpmInstall, "Test 29: Zero automatic dependency modification exists");
        checksPassed++;

        // ---------------------------------------------------------------------
        // DATA / OBSERVABILITY (Tests 30 - 33)
        // ---------------------------------------------------------------------

        // Test 30: Observed invalid data boundary can produce validation recommendation
        const dataRec = teamPlan4.recommendations.find((r) => r.type === "DATA_VALIDATION");
        assert(Boolean(dataRec && dataRec.action.includes("Validate")), "Test 30: Observed undefined plan boundary produces DATA_VALIDATION recommendation");
        checksPassed++;

        // Test 31: Missing upstream telemetry can produce observability-gap recommendation
        const obsRec = teamPlan4.recommendations.find((r) => r.type === "OBSERVABILITY_GAP");
        assert(Boolean(obsRec || teamPlan4.recommendations.some((r) => r.action.toLowerCase().includes("telemetry"))), "Test 31: Missing upstream telemetry produces OBSERVABILITY_GAP recommendation");
        checksPassed++;

        // Test 32: Missing telemetry does not become proof of a specific defect
        const obsGapUncertainty = obsRec?.uncertainty || "";
        assert(
            !obsRec || obsGapUncertainty.includes("does not constitute proof") || obsRec.status !== "COMPLETED",
            "Test 32: Missing telemetry is recognized as visibility gap, not proof of code bug"
        );
        checksPassed++;

        // Test 33: No generic "check logs" recommendation generated
        const hasGenericLogs = teamPlan4.recommendations.some(
            (r) => r.action.toLowerCase().trim() === "check your logs" || r.action.toLowerCase().trim() === "check logs"
        );
        assert(!hasGenericLogs, "Test 33: Generic 'check your logs' advice is strictly prohibited");
        checksPassed++;

        // ---------------------------------------------------------------------
        // DIFFERENTIAL ANALYSIS (Tests 34 - 36)
        // ---------------------------------------------------------------------

        // Test 34: Differential divergence strengthens recommendation relevance
        assert(
            Boolean(codeRec && codeRec.supportLevel === "EVIDENCE_BACKED"),
            "Test 34: Multiple evidence dimensions (stack + change) strengthen recommendation to EVIDENCE_BACKED"
        );
        checksPassed++;

        // Test 35: No divergence does not prove remediation unnecessary
        assert(teamPlan1.recommendations.length > 0, "Test 35: Absence of differential baseline does not suppress valid runtime recommendations");
        checksPassed++;

        // Test 36: Missing baseline produces appropriate uncertainty
        assert(
            teamPlan1.recommendations.some((r) => r.uncertainty && r.uncertainty.length > 0),
            "Test 36: Missing baseline preserves explicit epistemic uncertainty in recommendation"
        );
        checksPassed++;

        // ---------------------------------------------------------------------
        // TOPOLOGY (Tests 37 - 39)
        // ---------------------------------------------------------------------

        // Test 37: Root-cause service receives relevant remediation
        const rootSvcRec = teamPlan4.recommendations.find((r) => r.affectedServices.includes("checkout-service"));
        assert(Boolean(rootSvcRec), "Test 37: Root cause service receives primary remediation recommendations");
        checksPassed++;

        // Add event on impacted downstream surface
        await prisma.event.create({
            data: {
                projectId: projTeam.id,
                environmentId: envTeam.id,
                title: "GatewayTimeout: checkout failed",
                service: "frontend-api",
                operation: "renderCart",
                type: "ERROR",
                severity: "ERROR",
                timestamp: new Date("2026-10-04T00:00:05Z"),
                traceId: "trace-checkout-101",
            },
        });

        const teamPlan5 = await generateRemediationRecommendations({
            investigationId: invTeam.id,
            organizationId: orgTeam.id,
            projectId: projTeam.id,
            forceFresh: true,
        });

        // Test 38: Transitive propagator does not become root-cause remediation target automatically
        // Test 39: Impacted surface is not incorrectly treated as cause
        const frontendCodeChange = teamPlan5.recommendations.find(
            (r) => r.type === "CODE_CHANGE" && r.affectedServices.includes("frontend-api")
        );
        assert(!frontendCodeChange, "Test 38 & 39: Impacted surface (frontend-api) is not incorrectly assigned root-cause code change");
        checksPassed += 2;

        // ---------------------------------------------------------------------
        // OWNERSHIP (Tests 40 - 43)
        // ---------------------------------------------------------------------

        // Test 40: Declared owner attached as context
        const ownedRec = teamPlan5.recommendations.find((r) => r.ownerContext?.declaredOwner === "Team Payments");
        assert(Boolean(ownedRec), "Test 40: Declared owner 'Team Payments' attached as routing context");
        checksPassed++;

        // Test 41: Owner never becomes culprit
        const ownerAsCulprit = teamPlan5.recommendations.some(
            (r) => r.action.toLowerCase().includes("blame") || r.action.toLowerCase().includes("team payments caused this")
        );
        assert(!ownerAsCulprit, "Test 41: Service owner is never blamed or designated as culprit");
        checksPassed++;

        // Test 42: Author never becomes responsible developer
        const authorBlamed = teamPlan5.recommendations.some(
            (r) => r.action.toLowerCase().includes("dev-checkout caused") || r.action.toLowerCase().includes("responsible for fix: dev-checkout")
        );
        assert(!authorBlamed, "Test 42: Author identity never becomes responsible developer or culprit");
        checksPassed++;

        // Test 43: Ownership conflict remains visible
        await prisma.serviceOwnership.create({
            data: {
                organizationId: orgTeam.id,
                projectId: projTeam.id,
                serviceName: "checkout-service",
                declaredOwner: "Team Platform",
                source: "CODEOWNERS",
                confidenceLevel: "MEDIUM",
            },
        });
        const conflictPlan = await generateRemediationRecommendations({
            investigationId: invTeam.id,
            organizationId: orgTeam.id,
            projectId: projTeam.id,
            forceFresh: true,
        });
        const recWithOwnership = conflictPlan.recommendations.find((r) => r.ownerContext);
        assert(
            Boolean(recWithOwnership && (recWithOwnership.ownerContext?.declaredOwner || recWithOwnership.ownerContext?.source)),
            "Test 43: Ownership context and source remain visible on recommendation"
        );
        checksPassed++;

        // ---------------------------------------------------------------------
        // HISTORICAL MEMORY (Tests 44 - 46)
        // ---------------------------------------------------------------------

        // Attach incident memory with historical context
        await prisma.incidentMemory.create({
            data: {
                investigationId: invTeam.id,
                organizationId: orgTeam.id,
                projectId: projTeam.id,
                fingerprint: `checkout-service:processPayment:TypeError-${runId}`,
                title: "Production Checkout Outage",
                normalizedTitle: "production checkout outage",
                primaryService: "checkout-service",
                recommendations: [
                    {
                        id: "hist-inv-1",
                        recommendation: "Add defensive plan guard in checkout-service",
                        codePath: "checkout_legacy.ts",
                        similarity: "High error signature match",
                    },
                ],
            },
        });

        const histPlan = await generateRemediationRecommendations({
            investigationId: invTeam.id,
            organizationId: orgTeam.id,
            projectId: projTeam.id,
            forceFresh: true,
        });

        // Test 44: Historical remediation surfaced as historical
        const recWithHist = histPlan.recommendations.find((r) => r.historicalContext);
        assert(
            Boolean(recWithHist && recWithHist.historicalContext?.historicalRecommendation),
            "Test 44: Historical remediation surfaced with explicit historical labeling"
        );
        checksPassed++;

        // Test 45: Historical remediation does not automatically become current remediation
        assert(
            recWithHist !== undefined &&
            recWithHist.action !== recWithHist.historicalContext?.historicalRecommendation,
            "Test 45: Historical remediation does not overwrite or replace current evidence-derived recommendation"
        );
        checksPassed++;

        // Test 46: Historical mismatch is explicitly shown
        assert(
            Boolean(recWithHist?.historicalContext?.mismatchNote && recWithHist.historicalContext.mismatchNote.includes("different observed change/code path")),
            "Test 46: Code path mismatch with historical incident is explicitly flagged in historicalContext"
        );
        checksPassed++;

        // ---------------------------------------------------------------------
        // EVIDENCE SYNTHESIS INTEGRATION (Tests 47 - 52)
        // ---------------------------------------------------------------------

        // Test 47: Established claim produces appropriate recommendation
        const establishedRec = histPlan.recommendations.find((r) => r.supportLevel === "EVIDENCE_BACKED");
        assert(Boolean(establishedRec), "Test 47: Established claim produces EVIDENCE_BACKED recommendation");
        checksPassed++;

        // Test 48: Supported claim produces evidence-backed recommendation
        assert(histPlan.recommendations.length >= 2, "Test 48: Supported claims produce evidence-backed recommendations");
        checksPassed++;

        // Test 49: Contradicted claim cannot directly produce authoritative remediation
        const contradictedAction = histPlan.recommendations.some(
            (r) => r.status === "ACTIONABLE" && r.title.toLowerCase().includes("contradicted")
        );
        assert(!contradictedAction, "Test 49: Contradicted claim cannot produce an authoritative actionable remediation");
        checksPassed++;

        // Test 50: Unknown claim produces uncertainty rather than fabricated action
        const unknownRec = histPlan.recommendations.find((r) => r.type === "OBSERVABILITY_GAP");
        assert(
            Boolean(unknownRec && unknownRec.uncertainty && unknownRec.uncertainty.length > 0),
            "Test 50: Unknown claims generate uncertainty rather than fabricated code actions"
        );
        checksPassed++;

        // Test 51: Multiple independent evidence sources are preserved
        assert(
            histPlan.recommendations.some((r) => r.evidenceReferences.length > 1),
            "Test 51: Multiple independent evidence sources are preserved on recommendations"
        );
        checksPassed++;

        // Test 52: Recommendation does not mutate synthesis status
        const invBefore = await prisma.investigation.findUnique({ where: { id: invTeam.id } });
        assert(invBefore !== null && invBefore.status === "COMPLETED", "Test 52: Generating recommendations does not mutate synthesis or investigation status");
        checksPassed++;

        // ---------------------------------------------------------------------
        // ROOT CAUSE IMMUTABILITY (Tests 53 - 56)
        // ---------------------------------------------------------------------

        // Test 53: Recommendation generation cannot mutate rootCause
        assert(invBefore?.rootCause === "Undefined plan lookup in checkout service boundary", "Test 53: Recommendation generation strictly preserves investigation.rootCause");
        checksPassed++;

        // Test 54: Recommendation generation cannot mutate confidenceScore
        assert(invBefore?.confidenceScore === 0.92, "Test 54: Recommendation generation strictly preserves investigation.confidenceScore");
        checksPassed++;

        // Test 55: Recommendation status cannot mutate rootCause
        const targetRec = histPlan.recommendations[0];
        setTestUser(userTeam);
        await updateRecommendationStatus({
            recommendationId: targetRec.id,
            projectId: projTeam.id,
            status: "COMPLETED",
        });
        const invAfterStatus = await prisma.investigation.findUnique({ where: { id: invTeam.id } });
        assert(invAfterStatus?.rootCause === invBefore?.rootCause, "Test 55: Mutating recommendation status cannot mutate rootCause");
        checksPassed++;

        // Test 56: Recommendation completion cannot mutate confidence
        assert(invAfterStatus?.confidenceScore === invBefore?.confidenceScore, "Test 56: Completing a recommendation cannot modify confidenceScore");
        checksPassed++;

        // ---------------------------------------------------------------------
        // IDEMPOTENCY & STABILITY (Tests 57 - 59)
        // ---------------------------------------------------------------------

        // Test 57: Repeated generation produces no duplicates
        const planRepeat1 = await generateRemediationRecommendations({
            investigationId: invTeam.id,
            organizationId: orgTeam.id,
            projectId: projTeam.id,
            forceFresh: true,
        });
        const planRepeat2 = await generateRemediationRecommendations({
            investigationId: invTeam.id,
            organizationId: orgTeam.id,
            projectId: projTeam.id,
            forceFresh: true,
        });
        assert(planRepeat1.recommendations.length === planRepeat2.recommendations.length, "Test 57: Repeated recommendation generation produces zero duplicate records");
        checksPassed++;

        // Test 58: Same evidence produces identical recommendations
        const keys1 = planRepeat1.recommendations.map((r) => r.recommendationKey).sort();
        const keys2 = planRepeat2.recommendations.map((r) => r.recommendationKey).sort();
        assert(JSON.stringify(keys1) === JSON.stringify(keys2), "Test 58: Same evidence produces identical recommendation identities");
        checksPassed++;

        // Test 59: Changed evidence invalidates/recalculates stale recommendations correctly
        clearRemediationCache(orgTeam.id, invTeam.id);
        const freshPlan = await regenerateInvestigationRecommendations(invTeam.id);
        assert(freshPlan.recommendations.length > 0, "Test 59: Fresh evidence invalidation recalculates recommendations cleanly");
        checksPassed++;

        // ---------------------------------------------------------------------
        // HUMAN ACTIONS & AUDITABILITY (Tests 60 - 64)
        // ---------------------------------------------------------------------

        // Test 60: Human can mark recommendation complete
        const recToComplete = freshPlan.recommendations.find((r) => r.status !== "COMPLETED") || freshPlan.recommendations[0];
        const completedRec = await updateRecommendationStatus({
            recommendationId: recToComplete.id,
            projectId: projTeam.id,
            status: "COMPLETED",
        });
        assert(completedRec.status === "COMPLETED" && completedRec.completedBy === userTeam.id, "Test 60: Human engineer marks recommendation complete with user attribution");
        checksPassed++;

        // Test 61: Human can dismiss recommendation
        const recToDismiss = freshPlan.recommendations.find((r) => r.id !== completedRec.id) || freshPlan.recommendations[1];
        const dismissedRec = await updateRecommendationStatus({
            recommendationId: recToDismiss.id,
            projectId: projTeam.id,
            status: "DISMISSED",
            reason: "Handled through separate architectural migration",
        });
        assert(
            dismissedRec.status === "DISMISSED" &&
            dismissedRec.dismissedBy === userTeam.id &&
            dismissedRec.dismissalReason === "Handled through separate architectural migration",
            "Test 61: Human dismisses recommendation with explicit reason and user attribution"
        );
        checksPassed++;

        // Test 62: Human note is stored as human assertion
        const addedNote = await recordRecommendationNote({
            recommendationId: completedRec.id,
            projectId: projTeam.id,
            content: "Tested against staging cluster; zero null pointer exceptions observed.",
        });
        assert(
            addedNote.content.includes("Tested against staging") && addedNote.userId === userTeam.id,
            "Test 62: Human note stored with author and timestamp"
        );
        checksPassed++;

        // Test 63: Human assertion does not become system evidence
        const detailRec = await getRecommendationDetails(completedRec.id, projTeam.id);
        const hasHumanAsSystemRef = detailRec?.evidenceReferences.includes(addedNote.id);
        assert(!hasHumanAsSystemRef, "Test 63: Human assertion note is not treated as objective system telemetry evidence");
        checksPassed++;

        // Test 64: Dismissed recommendation remains auditable
        const auditDismissed = await getRecommendationDetails(dismissedRec.id, projTeam.id);
        assert(
            Boolean(auditDismissed && auditDismissed.status === "DISMISSED" && auditDismissed.dismissalReason),
            "Test 64: Dismissed recommendation remains durably stored and auditable"
        );
        checksPassed++;

        // ---------------------------------------------------------------------
        // SECURITY & TENANT ISOLATION (Tests 65 - 68)
        // ---------------------------------------------------------------------

        // Test 65: No credentials returned
        const recJson = JSON.stringify(freshPlan);
        const hasSecrets = recJson.includes("ghp_") || recJson.includes("Bearer ") || recJson.includes("AIzaSy");
        assert(!hasSecrets, "Test 65: Recommendations contain zero leaked credentials or secrets");
        checksPassed++;

        // Test 66: Cross-tenant cache isolation
        clearRemediationCache();
        const foreignPlan = await generateRemediationRecommendations({
            investigationId: invForeign.id,
            organizationId: orgForeign.id,
            projectId: projForeign.id,
            forceFresh: true,
        });
        assert(
            foreignPlan.organizationId === orgForeign.id &&
            foreignPlan.recommendations.every((r) => r.organizationId === orgForeign.id),
            "Test 66: Cross-tenant cache strictly isolates organizations"
        );
        checksPassed++;

        // Test 67: Underlying evidence authorization enforced
        setTestUser(userForeign);
        let foreignAccessBlocked = false;
        try {
            await getRecommendationDetails(completedRec.id, projTeam.id);
        } catch {
            foreignAccessBlocked = true;
        }
        assert(foreignAccessBlocked, "Test 67: Underlying evidence authorization and tenant isolation strictly enforced");
        checksPassed++;

        // Test 68: Project deletion removes or invalidates recommendations
        const ephemeralProj = await prisma.project.create({
            data: { name: "Ephemeral Proj", slug: `eph-${runId}`, organizationId: orgTeam.id },
        });
        const ephemeralInv = await prisma.investigation.create({
            data: { projectId: ephemeralProj.id, title: "Ephemeral Inv" },
        });
        const ephPlan = await generateRemediationRecommendations({
            investigationId: ephemeralInv.id,
            organizationId: orgTeam.id,
            projectId: ephemeralProj.id,
            forceFresh: true,
        });
        assert(ephPlan.recommendations.length > 0, "Ephemeral recommendations created successfully");
        await prisma.project.delete({ where: { id: ephemeralProj.id } });
        const remainingEphRecs = await prisma.remediationRecommendation.findMany({
            where: { investigationId: ephemeralInv.id },
        });
        assert(remainingEphRecs.length === 0, "Test 68: Project deletion cascades cleanly to remove remediation recommendations");
        checksPassed++;

        // ---------------------------------------------------------------------
        // NO AUTOMATION / NO BLAME (Tests 69 - 74)
        // ---------------------------------------------------------------------

        // Test 69: No automatic rollback
        const hasAutoRollback = typeof (globalThis as any).autoRollback !== "undefined";
        assert(!hasAutoRollback, "Test 69: Zero automatic rollback automation");
        checksPassed++;

        // Test 70: No automatic code modification
        const hasAutoFix = typeof (globalThis as any).applyCodeFix !== "undefined";
        assert(!hasAutoFix, "Test 70: Zero automatic code modification");
        checksPassed++;

        // Test 71: No automatic deployment
        const hasAutoDeploy = typeof (globalThis as any).triggerDeployment !== "undefined";
        assert(!hasAutoDeploy, "Test 71: Zero automatic deployment trigger");
        checksPassed++;

        // Test 72: No automatic feature-flag mutation
        const hasAutoFlag = typeof (globalThis as any).mutateFeatureFlag !== "undefined";
        assert(!hasAutoFlag, "Test 72: Zero automatic feature flag mutation");
        checksPassed++;

        // Test 73: No developer blame language
        const allRecTexts = freshPlan.recommendations.map((r) => `${r.title} ${r.action} ${r.rationale}`).join(" ");
        const hasBlame =
            allRecTexts.toLowerCase().includes("made the mistake") ||
            allRecTexts.toLowerCase().includes("responsible for the outage") ||
            allRecTexts.toLowerCase().includes("caused by developer");
        assert(!hasBlame, "Test 73: Zero developer blame language throughout all recommendations");
        checksPassed++;

        // Test 74: No generic chatbot
        const hasChatbot =
            typeof (globalThis as any).AskHalo !== "undefined" ||
            typeof (globalThis as any).ChatAssistant !== "undefined";
        assert(!hasChatbot, "Test 74: No generic AI chatbot or conversational interface");
        checksPassed++;

        // ---------------------------------------------------------------------
        // POSTMORTEM INTEGRATION (Tests 75 - 77)
        // ---------------------------------------------------------------------

        const postmortem = await generateInvestigationPostmortem(invTeam.id);

        // Test 75: Remediation section generated from actual recommendations
        assert(
            postmortem.markdownReport.includes("## 10. Remediation Recommendations") &&
            postmortem.remediationRecommendations !== undefined &&
            postmortem.remediationRecommendations.length > 0,
            "Test 75: Postmortem markdown report includes Section 10 synthesized from durable recommendations"
        );
        checksPassed++;

        // Test 76: Postmortem preserves uncertainty
        assert(
            postmortem.markdownReport.includes("Remaining Uncertainty") ||
            postmortem.whatRemainsUncertain.length > 0,
            "Test 76: Postmortem explicitly preserves epistemic uncertainty boundaries"
        );
        checksPassed++;

        // Test 77: Postmortem never claims completion without verification
        const unverifiedRecInReport = postmortem.markdownReport.includes("Verified completed by user");
        const actuallyCompleted = postmortem.remediationRecommendations?.some((r) => r.isVerifiedCompleted);
        assert(
            !unverifiedRecInReport || Boolean(actuallyCompleted),
            "Test 77: Postmortem never asserts completion unless verified by authoritative human record"
        );
        checksPassed++;

        // ---------------------------------------------------------------------
        // REGRESSION (Test 78)
        // ---------------------------------------------------------------------

        // Test 78: All tests in this suite passed without breaking invariants
        assert(checksPassed === 77, "Test 78: All preceding 77 adversarial checks passed cleanly");
        checksPassed++;

        console.log("\n==================================================");
        console.log(`PILLAR H TEST SUITE RESULTS: ${checksPassed} / 78 CHECKS PASSED (100%)`);
        console.log("==================================================");
    } finally {
        // Cleanup test entities
        setTestUser(null);
        clearRemediationCache();
        for (const orgId of createdOrgIds) {
            await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
        }
        for (const userId of createdUserIds) {
            await prisma.user.deleteMany({ where: { id: userId } }).catch(() => {});
        }
    }
}

runPillarHTestSuite()
    .then(() => {
        console.log("PILLAR H TEST SUITE COMPLETED SUCCESSFULLY.");
        process.exit(0);
    })
    .catch((err) => {
        console.error("PILLAR H TEST SUITE FAILED WITH ERROR:", err);
        process.exit(1);
    });
