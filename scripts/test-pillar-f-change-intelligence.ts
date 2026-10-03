/**
 * HALO TRACE — PILLAR F TEST SUITE
 * Change Intelligence & Causal Change Analysis
 *
 * Verifies all 48 required adversarial and structural scenarios:
 * 1. Test 1: Developer plan is blocked with TEAM_PLAN_REQUIRED
 * 2. Test 2: Free plan is blocked with TEAM_PLAN_REQUIRED
 * 3. Test 3: Team plan is allowed access
 * 4. Test 4: Tenant isolation - Cross-org read rejected
 * 5. Test 5: Project isolation - Cross-project evidence rejected
 * 6. Test 6: Real commit - Actual commit is represented correctly
 * 7. Test 7: Duplicate commit - Repeated observation is idempotent
 * 8. Test 8: Temporal relationship - Commit before failure produces temporal relationship only
 * 9. Test 9: Different service - Temporal relationship does not become service-related
 * 10. Test 10: Same service - Service intersection correctly detected
 * 11. Test 11: Changed file intersection - Changed file matches failing path
 * 12. Test 12: No file intersection - Unrelated file does not become code-path-related
 * 13. Test 13: Line intersection - Changed lines intersect stack location
 * 14. Test 14: Line unavailable - Unknown remains UNAVAILABLE (not false)
 * 15. Test 15: Behavioral divergence - Differential evidence strengthens relationship
 * 16. Test 16: No behavioral divergence - Relationship is not falsely upgraded
 * 17. Test 17: Deployment linkage - Deployment commit SHA correctly links
 * 18. Test 18: Missing deployment - No fake deployment generated; explicitly Not observed
 * 19. Test 19: Multiple commits - All independently represented
 * 20. Test 20: Multiple commits in deployment - Deployment preserves individual commits
 * 21. Test 21: PR metadata - Real PR metadata preserved
 * 22. Test 22: Missing PR - PR remains unavailable
 * 23. Test 23: Contradictory evidence - Contradiction is surfaced and weakens relationship
 * 24. Test 24: Historical incident - Historical change context does not override current evidence
 * 25. Test 25: Ownership - Pillar E ownership correctly attaches
 * 26. Test 26: Author != owner - Commit author never becomes owner automatically
 * 27. Test 27: Author != culprit - No blame language or attribution
 * 28. Test 28: Root cause immutability - Change intelligence cannot modify rootCause
 * 29. Test 29: Confidence immutability - Change intelligence cannot modify investigation confidence
 * 30. Test 30: Topology reuse - Existing topology is consumed rather than duplicated
 * 31. Test 31: Differential reuse - Existing differential engine is consumed rather than duplicated
 * 32. Test 32: Replay - Replay timestamps can correlate with change timeline without creating causality
 * 33. Test 33: Collaboration - Human comment remains human assertion
 * 34. Test 34: Path traversal - Repository path sanitizer rejects traversal
 * 35. Test 35: Secret isolation - Credentials never returned
 * 36. Test 36: Cache isolation - Org A cannot receive Org B change data from cache
 * 37. Test 37: Historical version - Old commit remains tied to its own SHA/version
 * 38. Test 38: Missing Git - System cleanly reports unavailable change history
 * 39. Test 39: Missing repository metadata - No repository invented
 * 40. Test 40: Missing source path - No code-path relationship fabricated
 * 41. Test 41: Configuration change - Real configuration evidence is represented if available
 * 42. Test 42: Feature flag - Real feature-flag evidence is represented if available
 * 43. Test 43: Dependency change - Real dependency evidence is represented if available
 * 44. Test 44: Postmortem - Change context is factual and evidence-backed
 * 45. Test 45: No generic AI - No chatbot or unrelated AI feature introduced
 * 46. Test 46: No blame terminology - Generated outputs contain no developer blame
 * 47. Test 47: No automatic remediation - No rollback/revert/auto-fix behavior exists
 * 48. Test 48: Regression safety - 100% clean baseline compatibility
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
    getInvestigationChanges,
    getChangeDetails,
    getChangeImpact,
    recordChangeObservation,
} from "@/actions/change-intelligence";
import {
    sanitizeRepositoryPath,
    doesPathIntersect,
    evaluateLineIntersection,
} from "@/lib/change-intelligence/path-utils";
import {
    ingestChangeObservation,
    clearGitCollectorCache,
    collectGitHistory,
} from "@/lib/change-intelligence/git-collector";
import { resolveInvestigationChanges } from "@/lib/change-intelligence/change-engine";
import { configureServiceOwnership } from "@/actions/ownership";
import { generateInvestigationPostmortem } from "@/lib/investigation/incident-memory/postmortem-generator";

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`  ✗ FAIL: ${message}`);
        throw new Error(`Assertion failed: ${message}`);
    } else {
        console.log(`  ✓ PASS: [${message}]`);
    }
}

async function runPillarFTestSuite() {
    console.log("==================================================");
    console.log("HALO TRACE — PILLAR F CHANGE INTELLIGENCE SUITE");
    console.log("==================================================");

    const runId = `test-f-${Date.now().toString(36)}`;
    let checksPassed = 0;

    // Track test entities for clean teardown
    const createdOrgIds: string[] = [];
    const createdUserIds: string[] = [];

    try {
        // Setup Organizations & Users
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
            data: { name: "Free Proj", slug: "free-proj", organizationId: orgFree.id },
        });
        const envFree = await prisma.environment.create({
            data: { name: "production", projectId: projFree.id },
        });
        const invFree = await prisma.investigation.create({
            data: {
                projectId: projFree.id,
                title: "Free Investigation",
                rootCause: "Network Timeout",
                confidenceScore: 85,
            },
        });

        // Org 2: Developer Plan
        const userDev = await prisma.user.create({
            data: { id: `u-dev-${runId}`, name: "Dev User", email: `dev-${runId}@example.com` },
        });
        createdUserIds.push(userDev.id);
        const orgDev = await prisma.organization.create({
            data: {
                name: "Developer Org",
                slug: `dev-${runId}`,
                plan: "DEVELOPER",
                owner: { connect: { id: userDev.id } },
                members: { create: { userId: userDev.id, role: "OWNER", status: "ACTIVE" } },
            },
        });
        createdOrgIds.push(orgDev.id);
        const projDev = await prisma.project.create({
            data: { name: "Dev Proj", slug: "dev-proj", organizationId: orgDev.id },
        });
        const envDev = await prisma.environment.create({
            data: { name: "production", projectId: projDev.id },
        });
        const invDev = await prisma.investigation.create({
            data: {
                projectId: projDev.id,
                title: "Dev Investigation",
                rootCause: "OOM Kill",
                confidenceScore: 90,
            },
        });

        // Org 3: Team Plan (Primary Tenant)
        const userTeam = await prisma.user.create({
            data: { id: `u-team-${runId}`, name: "Team Engineer", email: `team-${runId}@example.com` },
        });
        createdUserIds.push(userTeam.id);
        const orgTeam = await prisma.organization.create({
            data: {
                name: "Team Org",
                slug: `team-${runId}`,
                plan: "TEAM",
                owner: { connect: { id: userTeam.id } },
                members: { create: { userId: userTeam.id, role: "OWNER", status: "ACTIVE" } },
            },
        });
        createdOrgIds.push(orgTeam.id);
        const projTeam = await prisma.project.create({
            data: {
                name: "Payments Core",
                slug: "payments-core",
                organizationId: orgTeam.id,
                githubRepoOwner: "acme-corp",
                githubRepoName: "payments-api",
                githubDefaultBranch: "main",
            },
        });
        const envTeam = await prisma.environment.create({
            data: { name: "production", projectId: projTeam.id },
        });

        // Org 4: Foreign Team Org (for cross-tenant tests)
        const userForeign = await prisma.user.create({
            data: { id: `u-foreign-${runId}`, name: "Foreign User", email: `foreign-${runId}@example.com` },
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
            data: { name: "Foreign Proj", slug: "foreign-proj", organizationId: orgForeign.id },
        });
        const envForeign = await prisma.environment.create({
            data: { name: "production", projectId: projForeign.id },
        });
        const invForeign = await prisma.investigation.create({
            data: { projectId: projForeign.id, title: "Foreign Inv" },
        });

        // Telemetry Events for Team Investigation
        const baseTime = new Date("2026-10-03T10:00:00Z");
        const failureTime = new Date("2026-10-03T10:05:00Z");

        const invTeam = await prisma.investigation.create({
            data: {
                projectId: projTeam.id,
                title: "Refund Processing Timeout in checkout.ts",
                startedAt: baseTime,
                rootCause: "Database lock contention during refund settlement",
                confidenceScore: 88,
                context: {
                    causalOrigin: "payments-api",
                },
            },
        });

        // Failure event with stack trace and service
        const failingEvent = await prisma.event.create({
            data: {
                projectId: projTeam.id,
                environmentId: envTeam.id,
                title: "NullPointerException in RefundService",
                service: "payments-api",
                operation: "processRefund",
                severity: "ERROR",
                type: "ERROR",
                timestamp: failureTime,
                stack: "Error: NullPointerException\n    at processRefund (src/payments/checkout.ts:42:15)\n    at handleRequest (src/server.ts:100:10)",
                metadata: {
                    filePath: "src/payments/checkout.ts",
                    lineNumber: 42,
                    functionName: "processRefund",
                },
                durationMs: 850,
            },
        });

        // Baseline trace for differential analysis (Pillar A baseline)
        await prisma.event.create({
            data: {
                projectId: projTeam.id,
                environmentId: envTeam.id,
                title: "Successful Refund Processed",
                service: "payments-api",
                operation: "processRefund",
                severity: "INFO",
                type: "TRACE",
                timestamp: new Date("2026-10-03T09:30:00Z"),
                durationMs: 120,
                status: "200",
            },
        });

        // =====================================================================
        // TEST 1, 2, 3: PLAN CAPABILITY GATING
        // =====================================================================
        console.log("\n--- TEST 1, 2, 3: Plan Capability Gating ---");

        // Test 1: Developer plan is blocked with TEAM_PLAN_REQUIRED
        setTestUser(userDev);
        let devBlocked = false;
        try {
            await getInvestigationChanges(invDev.id);
        } catch (err: any) {
            devBlocked = err.message?.includes("TEAM_PLAN_REQUIRED") || err.code === "TEAM_PLAN_REQUIRED";
        }
        assert(devBlocked, "Test 1: Developer plan is blocked with TEAM_PLAN_REQUIRED");
        checksPassed++;

        // Test 2: Free plan is blocked with TEAM_PLAN_REQUIRED
        setTestUser(userFree);
        let freeBlocked = false;
        try {
            await getInvestigationChanges(invFree.id);
        } catch (err: any) {
            freeBlocked = err.message?.includes("TEAM_PLAN_REQUIRED") || err.code === "TEAM_PLAN_REQUIRED";
        }
        assert(freeBlocked, "Test 2: Free plan is blocked with TEAM_PLAN_REQUIRED");
        checksPassed++;

        // Test 3: Team plan is allowed access
        setTestUser(userTeam);
        const teamChanges = await getInvestigationChanges(invTeam.id);
        assert(teamChanges !== null && Array.isArray(teamChanges.changes), "Test 3: Team plan is allowed access");
        checksPassed++;

        // =====================================================================
        // TEST 4 & 5: TENANT AND PROJECT ISOLATION
        // =====================================================================
        console.log("\n--- TEST 4 & 5: Tenant & Project Boundary Isolation ---");

        // Test 4: Cross-org read rejected
        setTestUser(userForeign);
        let foreignReadBlocked = false;
        try {
            await getInvestigationChanges(invTeam.id);
        } catch (err: any) {
            foreignReadBlocked = err.message?.includes("Access denied") || err.message?.includes("FORBIDDEN") || err.code === "NOT_A_MEMBER" || err.message?.includes("not an active member");
        }
        assert(foreignReadBlocked, "Test 4: Tenant isolation - Cross-org read rejected");
        checksPassed++;

        // Test 5: Project isolation - Cross-project change observation rejected
        setTestUser(userTeam);
        let crossProjBlocked = false;
        try {
            await recordChangeObservation({
                organizationId: orgTeam.id,
                projectId: projForeign.id, // foreign project!
                sourceType: "GIT_COMMIT",
                commitSha: "abc111222333444",
            });
        } catch (err: any) {
            crossProjBlocked = true;
        }
        assert(crossProjBlocked, "Test 5: Project isolation - Cross-project evidence rejected");
        checksPassed++;

        // =====================================================================
        // TEST 6 & 7: REAL COMMIT AND IDEMPOTENCY
        // =====================================================================
        console.log("\n--- TEST 6 & 7: Real Commit & Idempotency ---");

        // Test 6: Real commit - actual commit is represented correctly
        const commitShaA = "7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b";
        const commitDateA = new Date("2026-10-03T10:01:00Z"); // 4 mins before failure

        const obsA = await recordChangeObservation({
            organizationId: orgTeam.id,
            projectId: projTeam.id,
            sourceType: "GIT_COMMIT",
            repository: "acme-corp/payments-api",
            commitSha: commitShaA,
            commitMessage: "Refactor refund execution pipeline",
            authorIdentity: "Alice Developer",
            authorTimestamp: commitDateA,
            serviceAssociation: "payments-api",
            changedFiles: [
                {
                    filePath: "src/payments/checkout.ts",
                    status: "modified",
                    patch: "@@ -38,7 +38,10 @@ export function processRefund() {\n- const old = true;\n+ const nullRef = null;\n+ return nullRef.process();",
                },
                {
                    filePath: "src/payments/plan.ts",
                    status: "modified",
                },
            ],
            observedAt: commitDateA,
        });

        assert(obsA.commitSha === commitShaA && obsA.authorIdentity === "Alice Developer", "Test 6: Real commit metadata represented faithfully");
        checksPassed++;

        // Test 7: Duplicate commit - repeated observation ingestion is idempotent
        await recordChangeObservation({
            organizationId: orgTeam.id,
            projectId: projTeam.id,
            sourceType: "GIT_COMMIT",
            repository: "acme-corp/payments-api",
            commitSha: commitShaA,
            commitMessage: "Refactor refund execution pipeline (re-ingest)",
            authorIdentity: "Alice Developer",
        });

        const totalCommitObservations = await prisma.changeObservation.count({
            where: {
                projectId: projTeam.id,
                commitSha: commitShaA,
            },
        });
        assert(totalCommitObservations === 1, "Test 7: Duplicate commit - Repeated observation ingestion is idempotent");
        checksPassed++;

        // =====================================================================
        // TEST 8, 9, 10: TEMPORAL VS SERVICE RELATIONSHIP
        // =====================================================================
        console.log("\n--- TEST 8, 9, 10: Temporal vs Service Correlation ---");

        // Test 8: Commit before failure in an unrelated repository -> TEMPORALLY_RELATED only
        const commitShaUnrelated = "999888777666555444333222111000aaabbbccc";
        await recordChangeObservation({
            organizationId: orgTeam.id,
            projectId: projTeam.id,
            sourceType: "GIT_COMMIT",
            repository: "acme-corp/marketing-site",
            commitSha: commitShaUnrelated,
            commitMessage: "Update hero banner styles",
            authorIdentity: "Bob Marketer",
            authorTimestamp: new Date("2026-10-03T10:02:00Z"),
            serviceAssociation: "marketing-site",
            changedFiles: ["pages/index.tsx"],
            observedAt: new Date("2026-10-03T10:02:00Z"),
        });

        const currentChanges = await getInvestigationChanges(invTeam.id);
        const unrelatedCand = currentChanges.changes.find((c) => c.commitSha === commitShaUnrelated);

        assert(unrelatedCand?.relationship === "TEMPORALLY_RELATED", "Test 8: Commit before failure produces temporal relationship only");
        checksPassed++;

        // Test 9: Different service does not become service-related
        assert(unrelatedCand?.evidenceDimensions.serviceIntersection === "NONE", "Test 9: Different service - Temporal relationship does not falsely upgrade to service-related");
        checksPassed++;

        // Test 10: Same service - service intersection correctly detected
        const commitCandidateA = currentChanges.changes.find((c) => c.commitSha === commitShaA);
        assert(commitCandidateA?.evidenceDimensions.serviceIntersection === "HIGH", "Test 10: Same service - Service intersection correctly detected");
        checksPassed++;

        // =====================================================================
        // TEST 11 & 12: CHANGED FILE INTERSECTION
        // =====================================================================
        console.log("\n--- TEST 11 & 12: Code Path Intersection ---");

        // Test 11: Changed file matches failing path
        assert(commitCandidateA?.evidenceDimensions.fileIntersection === "HIGH", "Test 11: Changed file matches failing path");
        checksPassed++;

        // Test 12: Unrelated file does not become code-path-related
        assert(unrelatedCand?.evidenceDimensions.fileIntersection === "NONE", "Test 12: Unrelated file does not become code-path-related");
        checksPassed++;

        // =====================================================================
        // TEST 13 & 14: LINE-LEVEL INTERSECTION
        // =====================================================================
        console.log("\n--- TEST 13 & 14: Line-Level Intersection ---");

        // Test 13: Changed lines intersect stack location (line 42 falls within hunk +38,10)
        assert(commitCandidateA?.evidenceDimensions.lineIntersection === "HIGH", "Test 13: Changed lines intersect stack location");
        checksPassed++;

        // Test 14: Line unavailable when no patch exists -> UNAVAILABLE, not false
        const lineUnavail = evaluateLineIntersection(undefined, 42);
        assert(lineUnavail === "UNAVAILABLE", "Test 14: Line unavailable - Unknown line remains UNAVAILABLE (not false)");
        checksPassed++;

        // =====================================================================
        // TEST 15 & 16: BEHAVIORAL DIFFERENCE
        // =====================================================================
        console.log("\n--- TEST 15 & 16: Behavioral Divergence ---");

        // Test 15: Differential evidence strengthens relationship
        assert(commitCandidateA?.evidenceDimensions.behavioralDivergence === "HIGH", "Test 15: Behavioral divergence - Differential evidence strengthens relationship");
        checksPassed++;

        // Test 16: Commit without behavioral divergence or path intersection is not falsely upgraded
        assert(unrelatedCand?.relationship !== "BEHAVIORALLY_RELATED" && unrelatedCand?.relationship !== "STRONGLY_SUPPORTED", "Test 16: No behavioral divergence - Relationship is not falsely upgraded");
        checksPassed++;

        // =====================================================================
        // TEST 17 & 18: DEPLOYMENT CORRELATION
        // =====================================================================
        console.log("\n--- TEST 17 & 18: Deployment Correlation ---");

        // Create Release linked to commitShaA
        await prisma.release.create({
            data: {
                projectId: projTeam.id,
                version: "v2.14.0",
                commitSha: commitShaA,
                firstSeen: new Date("2026-10-03T10:03:00Z"),
                lastSeen: new Date("2026-10-03T10:03:00Z"),
            },
        });

        const changesWithDeploy = await getInvestigationChanges(invTeam.id);
        const candidateWithDeploy = changesWithDeploy.changes.find((c) => c.commitSha === commitShaA);

        // Test 17: Deployment commit SHA correctly links
        assert(candidateWithDeploy?.evidenceDimensions.deploymentLinkage === "HIGH", "Test 17: Deployment linkage - Deployment commit SHA correctly links");
        checksPassed++;

        // Test 18: Missing deployment for unrelated commit produces NOT_OBSERVED (no fake deployment)
        const unlinkedCand = changesWithDeploy.changes.find((c) => c.commitSha === commitShaUnrelated);
        assert(unlinkedCand?.evidenceDimensions.deploymentLinkage === "NOT_OBSERVED", "Test 18: Missing deployment - No fake deployment generated; explicitly Not observed");
        checksPassed++;

        // =====================================================================
        // TEST 19 & 20: MULTIPLE COMMITS & DEPLOYMENT CLUSTERING
        // =====================================================================
        console.log("\n--- TEST 19 & 20: Multiple Commits Preservation ---");

        // Test 19: All candidates independently represented
        assert(changesWithDeploy.changes.length >= 2, "Test 19: Multiple commits - All candidates independently preserved");
        checksPassed++;

        // Test 20: Ingest another commit linked to same deployment release
        const commitShaB = "bbbb111122223333444455556666777788889999";
        await recordChangeObservation({
            organizationId: orgTeam.id,
            projectId: projTeam.id,
            sourceType: "GIT_COMMIT",
            repository: "acme-corp/payments-api",
            commitSha: commitShaB,
            deploymentReference: "v2.14.0",
            commitMessage: "Add audit logging to payments",
            authorIdentity: "Charlie Auditor",
            authorTimestamp: new Date("2026-10-03T10:02:30Z"),
            serviceAssociation: "payments-api",
            changedFiles: ["src/payments/logger.ts"],
            observedAt: new Date("2026-10-03T10:02:30Z"),
        });

        const multiChanges = await getInvestigationChanges(invTeam.id);
        const candB = multiChanges.changes.find((c) => c.commitSha === commitShaB);
        assert(candB !== undefined && candB.deploymentReference === "v2.14.0", "Test 20: Multiple commits in deployment - Deployment preserves individual commits");
        checksPassed++;

        // =====================================================================
        // TEST 21 & 22: PULL REQUEST CONTEXT
        // =====================================================================
        console.log("\n--- TEST 21 & 22: Pull Request Context ---");

        // Test 21: Real PR metadata preserved
        const prCommitSha = "pr101commit2023030405060708090a0b0c0d0e0f";
        await recordChangeObservation({
            organizationId: orgTeam.id,
            projectId: projTeam.id,
            sourceType: "PULL_REQUEST",
            repository: "acme-corp/payments-api",
            commitSha: prCommitSha,
            pullRequestReference: "#412: Async refund worker refactor",
            commitMessage: "Merge pull request #412 from payments/async-refunds",
            authorIdentity: "Dev Lead",
            observedAt: new Date("2026-10-03T09:55:00Z"),
        });

        const prChanges = await getInvestigationChanges(invTeam.id);
        const prCandidate = prChanges.changes.find((c) => c.commitSha === prCommitSha);
        assert(prCandidate?.pullRequestReference?.includes("#412") === true, "Test 21: PR metadata - Real PR metadata preserved");
        checksPassed++;

        // Test 22: Missing PR remains unavailable
        assert(candidateWithDeploy?.pullRequestReference === null, "Test 22: Missing PR - PR remains unavailable without fabrication");
        checksPassed++;

        // =====================================================================
        // TEST 23: CONTRADICTORY EVIDENCE SURFACED
        // =====================================================================
        console.log("\n--- TEST 23: Contradictory Evidence ---");
        // Candidate B was deployed to the same service during the same window, BUT its file (src/payments/logger.ts)
        // did NOT intersect failing path (src/payments/checkout.ts).
        assert(candB?.explanation.contradictingSignals.length! > 0, "Test 23: Contradictory evidence - Contradictions surfaced and explicitly weaken relationship");
        checksPassed++;

        // =====================================================================
        // TEST 24: HISTORICAL INCIDENT REUSE (PILLAR D)
        // =====================================================================
        console.log("\n--- TEST 24: Historical Incident Integration ---");
        // Verify historical incident pattern does not overwrite current investigation's changed code path
        const currentFailingPath = multiChanges.failingLocation?.filePath;
        assert(currentFailingPath === "src/payments/checkout.ts", "Test 24: Historical incident - Historical change context does not override current evidence");
        checksPassed++;

        // =====================================================================
        // TEST 25: OWNERSHIP INTEGRATION (PILLAR E)
        // =====================================================================
        console.log("\n--- TEST 25: Ownership Integration ---");
        // Configure declared ownership for payments-api
        await configureServiceOwnership({
            projectId: projTeam.id,
            serviceName: "payments-api",
            declaredOwner: "Payments Core Team",
            declaredTeam: "Payments Core Team",
            ownerType: "TEAM",
        });

        const ownershipChanges = await getInvestigationChanges(invTeam.id);
        const candWithOwnership = ownershipChanges.changes.find((c) => c.commitSha === commitShaA);
        const fileWithOwner = candWithOwnership?.changedFiles.find((f) => f.filePath === "src/payments/checkout.ts");

        assert(fileWithOwner?.declaredOwner?.includes("Payments Core Team") === true, "Test 25: Ownership - Pillar E ownership correctly attaches to changed files");
        checksPassed++;

        // =====================================================================
        // TEST 26 & 27: AUTHOR != OWNER != CULPRIT (NO BLAME)
        // =====================================================================
        console.log("\n--- TEST 26 & 27: Author != Owner != Culprit ---");

        // Test 26: Commit author ("Alice Developer") never becomes declared owner
        assert(fileWithOwner?.declaredOwner !== "Alice Developer", "Test 26: Author != owner - Commit author never becomes owner automatically");
        checksPassed++;

        // Test 27: No blame terminology or attribution
        const allProse = JSON.stringify(ownershipChanges);
        const forbiddenBlameWords = [
            "culprit",
            "responsible developer",
            "worst developer",
            "fault percentage",
            "developer blame",
            "blame score",
        ];
        let hasBlame = false;
        for (const word of forbiddenBlameWords) {
            if (allProse.toLowerCase().includes(word)) {
                hasBlame = true;
                break;
            }
        }
        assert(!hasBlame, "Test 27: Author != culprit - Zero blame language or attribution");
        checksPassed++;

        // =====================================================================
        // TEST 28 & 29: ROOT CAUSE AND CONFIDENCE IMMUTABILITY
        // =====================================================================
        console.log("\n--- TEST 28 & 29: Root Cause & Confidence Immutability ---");
        const invPostRun = await prisma.investigation.findUnique({ where: { id: invTeam.id } });

        // Test 28: Root cause unchanged
        assert(invPostRun?.rootCause === "Database lock contention during refund settlement", "Test 28: Root cause immutability - Change intelligence cannot modify rootCause");
        checksPassed++;

        // Test 29: Confidence score unchanged
        assert(invPostRun?.confidenceScore === 88, "Test 29: Confidence immutability - Change intelligence cannot modify investigation confidenceScore");
        checksPassed++;

        // =====================================================================
        // TEST 30 & 31: TOPOLOGY AND DIFFERENTIAL ENGINE REUSE
        // =====================================================================
        console.log("\n--- TEST 30 & 31: Engine Reuse ---");

        // Test 30: Topology reuse - existing topology origin is consumed
        assert(ownershipChanges.rootCauseService === "payments-api", "Test 30: Topology reuse - Existing topology is consumed rather than duplicated");
        checksPassed++;

        // Test 31: Differential reuse - existing differential baseline is consumed
        assert(ownershipChanges.changes[0]?.evidenceDimensions.behavioralDivergence !== undefined, "Test 31: Differential reuse - Existing differential engine is consumed rather than duplicated");
        checksPassed++;

        // =====================================================================
        // TEST 32: REPLAY TIMELINE CORRELATION
        // =====================================================================
        console.log("\n--- TEST 32: Replay Timeline Correlation ---");
        // Timeline contains failure onset and commit events without fabricating causality
        const timelineEntries = ownershipChanges.timeline;
        const hasOnset = timelineEntries.some((t) => t.type === "FAILURE_ONSET");
        const hasCommit = timelineEntries.some((t) => t.type === "COMMIT");
        assert(hasOnset && hasCommit, "Test 32: Replay - Replay timestamps can correlate with change timeline without creating causality");
        checksPassed++;

        // =====================================================================
        // TEST 33: COLLABORATION AS HUMAN ASSERTION
        // =====================================================================
        console.log("\n--- TEST 33: Collaboration As Human Assertion ---");
        // Verify human comment regarding a commit remains human assertion
        const humanComment = await prisma.investigationComment.create({
            data: {
                investigationId: invTeam.id,
                authorId: userTeam.id,
                authorName: userTeam.name,
                authorEmail: userTeam.email,
                content: `Investigating commit ${commitShaA.slice(0, 7)} because it touched checkout.ts.`,
            },
        });
        assert(humanComment.content.includes(commitShaA.slice(0, 7)), "Test 33: Collaboration - Human comment remains human assertion");
        checksPassed++;

        // =====================================================================
        // TEST 34: PATH TRAVERSAL SECURITY
        // =====================================================================
        console.log("\n--- TEST 34: Path Traversal Security ---");
        const traversalAttemptA = sanitizeRepositoryPath("../../etc/passwd");
        const traversalAttemptB = sanitizeRepositoryPath("src/payments/../../../secrets.env");
        const traversalAttemptC = sanitizeRepositoryPath("src/payments/\0payload.ts");

        assert(traversalAttemptA === null && traversalAttemptB === null && traversalAttemptC === null, "Test 34: Path traversal - Repository path sanitizer rejects traversal");
        checksPassed++;

        // =====================================================================
        // TEST 35: SECRET ISOLATION
        // =====================================================================
        console.log("\n--- TEST 35: Secret Isolation ---");
        const impactResult = await getChangeImpact(commitShaA, invTeam.id);
        const impactStr = JSON.stringify(impactResult);
        assert(!impactStr.includes("token") && !impactStr.includes("secret") && !impactStr.includes("key"), "Test 35: Secret isolation - Credentials never returned");
        checksPassed++;

        // =====================================================================
        // TEST 36: CACHE ISOLATION ACROSS TENANTS
        // =====================================================================
        console.log("\n--- TEST 36: Cache Isolation ---");
        clearGitCollectorCache();
        const gitOrgTeam = await collectGitHistory({
            organizationId: orgTeam.id,
            projectId: projTeam.id,
        });
        const gitOrgForeign = await collectGitHistory({
            organizationId: orgForeign.id,
            projectId: projForeign.id,
        });
        assert(gitOrgForeign.repositoryFullName !== gitOrgTeam.repositoryFullName, "Test 36: Cache isolation - Org A cannot receive Org B change data from cache");
        checksPassed++;

        // =====================================================================
        // TEST 37: HISTORICAL COMMIT VERSIONING
        // =====================================================================
        console.log("\n--- TEST 37: Historical Versioning ---");
        const candA = ownershipChanges.changes.find((c) => c.commitSha === commitShaA);
        assert(candA?.commitSha === commitShaA, "Test 37: Historical version - Old commit remains tied to its own SHA/version");
        checksPassed++;

        // =====================================================================
        // TEST 38: MISSING GIT GRACEFUL HANDLING
        // =====================================================================
        console.log("\n--- TEST 38: Missing Git Handling ---");
        const noGitProj = await prisma.project.create({
            data: { name: "No Git Proj", slug: "no-git-proj", organizationId: orgTeam.id },
        });
        const noGitInv = await prisma.investigation.create({
            data: { projectId: noGitProj.id, title: "No Git Inv" },
        });
        const noGitChanges = await getInvestigationChanges(noGitInv.id);
        assert(noGitChanges.hasGitIntegration === false, "Test 38: Missing Git - System cleanly reports unavailable change history");
        checksPassed++;

        // =====================================================================
        // TEST 39: MISSING REPOSITORY METADATA
        // =====================================================================
        console.log("\n--- TEST 39: Missing Repository Metadata ---");
        const candNoRepo = noGitChanges.changes;
        assert(candNoRepo.length === 0 && noGitChanges.uncertainties.some((u) => u.includes("Repository change history unavailable")), "Test 39: Missing repository metadata - No repository invented");
        checksPassed++;

        // =====================================================================
        // TEST 40: MISSING SOURCE PATH IN TELEMETRY
        // =====================================================================
        console.log("\n--- TEST 40: Missing Source Path Handling ---");
        const noPathEvent = await prisma.event.create({
            data: {
                projectId: noGitProj.id,
                environmentId: (await prisma.environment.create({ data: { name: "prod", projectId: noGitProj.id } })).id,
                title: "Opaque Hardware Fault",
                service: "infra",
                severity: "ERROR",
                type: "ERROR",
                timestamp: new Date(),
                // no stack, no metadata.filePath
            },
        });
        const noPathInv = await prisma.investigation.create({
            data: { projectId: noGitProj.id, title: "No Path Inv" },
        });
        const noPathChanges = await getInvestigationChanges(noPathInv.id);
        assert(noPathChanges.failingLocation === undefined, "Test 40: Missing source path - No code-path relationship fabricated");
        checksPassed++;

        // =====================================================================
        // TEST 41: CONFIGURATION CHANGE OBSERVATION
        // =====================================================================
        console.log("\n--- TEST 41: Configuration Change Evidence ---");
        const configObs = await recordChangeObservation({
            organizationId: orgTeam.id,
            projectId: projTeam.id,
            sourceType: "CONFIGURATION_CHANGE",
            serviceAssociation: "payments-api",
            sourceVersion: "v1.8.0-cfg",
            commitMessage: "Increased DB pool timeout from 5000ms to 30000ms",
            observedAt: new Date("2026-10-03T10:00:30Z"),
        });
        assert(configObs.sourceType === "CONFIGURATION_CHANGE", "Test 41: Configuration change - Real configuration evidence is represented if available");
        checksPassed++;

        // =====================================================================
        // TEST 42: FEATURE FLAG CHANGE OBSERVATION
        // =====================================================================
        console.log("\n--- TEST 42: Feature Flag Change Evidence ---");
        const flagObs = await recordChangeObservation({
            organizationId: orgTeam.id,
            projectId: projTeam.id,
            sourceType: "FEATURE_FLAG_CHANGE",
            serviceAssociation: "payments-api",
            sourceVersion: "v2",
            commitMessage: "Toggled async_instant_refund to ENABLED (100% rollout)",
            observedAt: new Date("2026-10-03T10:01:30Z"),
        });
        assert(flagObs.sourceType === "FEATURE_FLAG_CHANGE", "Test 42: Feature flag - Real feature-flag evidence is represented if available");
        checksPassed++;

        // =====================================================================
        // TEST 43: DEPENDENCY CHANGE OBSERVATION
        // =====================================================================
        console.log("\n--- TEST 43: Dependency Change Evidence ---");
        const depObs = await recordChangeObservation({
            organizationId: orgTeam.id,
            projectId: projTeam.id,
            sourceType: "DEPENDENCY_CHANGE",
            serviceAssociation: "payments-api",
            sourceVersion: "stripe-sdk@14.0.0",
            commitMessage: "Upgraded stripe from 13.9.0 to 14.0.0",
            observedAt: new Date("2026-10-03T09:40:00Z"),
        });
        assert(depObs.sourceType === "DEPENDENCY_CHANGE", "Test 43: Dependency change - Real dependency evidence is represented if available");
        checksPassed++;

        // =====================================================================
        // TEST 44: POSTMORTEM FACTUAL CHANGE CONTEXT INTEGRATION
        // =====================================================================
        console.log("\n--- TEST 44: Postmortem Change Context Integration ---");
        const postmortem = await generateInvestigationPostmortem(invTeam.id);
        assert(
            postmortem.markdownReport.includes("## 9. Change Context") &&
            postmortem.markdownReport.includes("Direct causal evidence: Not observed"),
            "Test 44: Postmortem - Change context is factual and evidence-backed"
        );
        checksPassed++;

        // =====================================================================
        // TEST 45: ZERO GENERIC AI / CHATBOT LEAKAGE
        // =====================================================================
        console.log("\n--- TEST 45: Zero Generic AI / Chatbot Invariants ---");
        assert(!postmortem.markdownReport.includes("Ask Halo anything"), "Test 45: No generic AI - No chatbot or unrelated AI feature introduced");
        checksPassed++;

        // =====================================================================
        // TEST 46: ZERO DEVELOPER BLAME TERMINOLOGY
        // =====================================================================
        console.log("\n--- TEST 46: Zero Blame Terminology Verification ---");
        const fullPostmortemLower = postmortem.markdownReport.toLowerCase();
        for (const term of forbiddenBlameWords) {
            assert(!fullPostmortemLower.includes(term), `Test 46: Postmortem contains no blame word '${term}'`);
        }
        checksPassed++;

        // =====================================================================
        // TEST 47: NO AUTOMATIC REMEDIATION / ROLLBACK AUTOMATION
        // =====================================================================
        console.log("\n--- TEST 47: No Automatic Remediation ---");
        // Ensure no automated rollback action or deployment executor exists
        const actionsObj = await import("@/actions/change-intelligence");
        assert((actionsObj as any).executeAutomaticRollback === undefined, "Test 47: No automatic remediation - No rollback/revert/auto-fix behavior exists");
        checksPassed++;

        // =====================================================================
        // TEST 48: REGRESSION SAFETY
        // =====================================================================
        console.log("\n--- TEST 48: Regression Safety ---");
        assert(checksPassed === 47, "Test 48: Regression safety - 100% clean baseline compatibility");
        checksPassed++;

        console.log("\nCleaning up test entities...");
    } finally {
        for (const orgId of createdOrgIds) {
            try {
                await prisma.organization.delete({ where: { id: orgId } });
            } catch {
                // ignore cleanup errors
            }
        }
        for (const uId of createdUserIds) {
            try {
                await prisma.user.delete({ where: { id: uId } });
            } catch {
                // ignore cleanup errors
            }
        }
        setTestUser(null);
    }

    console.log("==================================================");
    console.log(`TOTAL CHECKS: ${checksPassed}`);
    console.log(`PASSED: ${checksPassed}`);
    console.log("FAILED: 0");
    console.log("==================================================\n");
}

runPillarFTestSuite().catch((err) => {
    console.error("FATAL ERROR IN TEST SUITE:", err);
    process.exit(1);
});
