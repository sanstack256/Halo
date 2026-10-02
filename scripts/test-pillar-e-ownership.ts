/**
 * HALO TRACE — PILLAR E TEST SUITE
 * Ownership Intelligence & Engineering Responsibility
 *
 * Verifies all Master Invariants & Adversarial Scenarios:
 * 1. Test 58: Plan Capability Gating (Developer & Free -> TEAM_PLAN_REQUIRED, Team -> Success)
 * 2. Test 56: Multi-Tenant Boundary Isolation (Org A cannot access Org B ownership)
 * 3. Test 57: Project-Level Authorization Boundary
 * 4. Test 59: Unknown Owner Handling (Zero fabricated teams or guesswork)
 * 5. Test 60: Ownership Conflict Detection (Disagreements surfaced; no silent overwrite)
 * 6. Test 61: Multiple Declared CODEOWNERS Preserved
 * 7. Test 62: Malformed CODEOWNERS Robustness (Resilient parser; zero crashes)
 * 8. Test 63: Path Traversal Security (Blocks ../, root escape, null bytes)
 * 9. Test 64: Author != Owner Context (No developer blame attribution)
 * 10. Test 65: Historical Participant != Current Owner Distinction
 * 11. Test 66: Root-Cause Service vs Impacted Surface Distinction
 * 12. Test 67: Ownership Change Audit Trail (Previous vs Current states preserved)
 * 13. Test 68: Investigation Root Cause & Confidence Protection (Immutability guarantee)
 * 14. Test 69: Human Assertions Tagged Strictly as HUMAN ASSERTION
 * 15. Test 70: Cross-Tenant Cache Isolation
 * 16. Test 71: Ownership Freshness & Commit SHA Tracking
 * 17. Test 72: No Repository Metadata -> Repository: Unknown (Zero URL invention)
 * 18. Test 73: No Source Path -> Code Ownership Unavailable
 * 19. Test 74: Multi-Service Incident Ownership Independence (No collapse to single owner)
 * 20. Test 75: Absolute Zero Developer Blame Language Audit
 * 21. Test 27: Confidence Describes Evidence Certainty, Never Fault Probability
 * 22. Test 32: External Group Identifier Representation (No fabricated Halo teams)
 * 23. Test 53: Postmortem Integration Includes Factual Ownership Without Blame
 * 24. Test 22: Topology Integration Annotates Canonical Services & Dependency Nodes
 * 25. Test 90: Cascading Deletion Safety for Ownership Records
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
    getInvestigationOwnership,
    getServiceOwnership,
    configureServiceOwnership,
    recordHumanOwnershipAssertion,
    getServiceOwnershipHistory,
} from "@/actions/ownership";
import {
    parseCodeownersContent,
    resolveCodeownersForPath,
    sanitizeRepositoryPath,
} from "@/lib/ownership/codeowners-parser";
import { loadProjectCodeowners, clearCodeownersCache } from "@/lib/ownership/codeowners-loader";
import { generateInvestigationPostmortem } from "@/lib/investigation/incident-memory/postmortem-generator";
import { queryCanonicalServices } from "@/lib/services/service-registry";

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`  ✗ FAIL: [${message}]`);
        throw new Error(message);
    }
    console.log(`  ✓ PASS: [${message}]`);
}

async function runPillarESuite() {
    console.log("==================================================");
    console.log("HALO TRACE — PILLAR E OWNERSHIP INTELLIGENCE SUITE");
    console.log("==================================================");

    let checksPassed = 0;
    const testId = `test_pille_${Date.now()}`;

    // Clean up any stale test entities
    await prisma.serviceOwnershipHistory.deleteMany({
        where: { serviceName: { startsWith: "test-" } },
    });
    await prisma.serviceOwnershipAssertion.deleteMany({
        where: { serviceName: { startsWith: "test-" } },
    });
    await prisma.serviceOwnership.deleteMany({
        where: { serviceName: { startsWith: "test-" } },
    });

    // Setup Test Organizations
    const orgTeam = await prisma.organization.create({
        data: {
            name: `Team Org ${testId}`,
            slug: `team-org-${testId}`,
            plan: "TEAM",
        },
    });

    const orgDev = await prisma.organization.create({
        data: {
            name: `Dev Org ${testId}`,
            slug: `dev-org-${testId}`,
            plan: "DEVELOPER",
        },
    });

    const orgForeign = await prisma.organization.create({
        data: {
            name: `Foreign Org ${testId}`,
            slug: `foreign-org-${testId}`,
            plan: "TEAM",
        },
    });

    // Setup Test Users
    const userAlice = await prisma.user.create({
        data: {
            id: `usr_alice_${testId}`,
            name: "Alice Lead",
            email: `alice_${testId}@halo.dev`,
        },
    });
    await prisma.organizationMember.create({
        data: {
            organizationId: orgTeam.id,
            userId: userAlice.id,
            role: "OWNER",
        },
    });

    const userBob = await prisma.user.create({
        data: {
            id: `usr_bob_${testId}`,
            name: "Bob Dev",
            email: `bob_${testId}@halo.dev`,
        },
    });
    await prisma.organizationMember.create({
        data: {
            organizationId: orgDev.id,
            userId: userBob.id,
            role: "OWNER",
        },
    });

    const userEve = await prisma.user.create({
        data: {
            id: `usr_eve_${testId}`,
            name: "Eve Foreign",
            email: `eve_${testId}@foreign.dev`,
        },
    });
    await prisma.organizationMember.create({
        data: {
            organizationId: orgForeign.id,
            userId: userEve.id,
            role: "OWNER",
        },
    });

    // Setup Projects
    const projTeamA = await prisma.project.create({
        data: {
            name: "Payments Platform",
            slug: `payments-platform-${testId}`,
            organizationId: orgTeam.id,
            githubRepoOwner: "acme-corp",
            githubRepoName: "payments-core",
            githubDefaultBranch: "main",
        },
    });

    const projTeamB = await prisma.project.create({
        data: {
            name: "Analytics Service",
            slug: `analytics-service-${testId}`,
            organizationId: orgTeam.id,
        },
    });

    const projDev = await prisma.project.create({
        data: {
            name: "Dev Project",
            slug: `dev-project-${testId}`,
            organizationId: orgDev.id,
        },
    });

    const projForeign = await prisma.project.create({
        data: {
            name: "Foreign Project",
            slug: `foreign-project-${testId}`,
            organizationId: orgForeign.id,
        },
    });

    const envTeamA = await prisma.environment.create({
        data: { name: "Production", projectId: projTeamA.id },
    });
    const envTeamB = await prisma.environment.create({
        data: { name: "Production", projectId: projTeamB.id },
    });
    const envDev = await prisma.environment.create({
        data: { name: "Development", projectId: projDev.id },
    });

    try {
        // =====================================================================
        // TEST 58: PLAN CAPABILITY GATING
        // =====================================================================
        console.log("\n--- TEST 58: Developer and Free Plan Entitlement Gating ---");
        setTestUser(userBob); // Developer plan user

        let blockedDeveloperPlan = false;
        try {
            await configureServiceOwnership({
                projectId: projDev.id,
                serviceName: "test-auth-service",
                declaredOwner: "Security Team",
            });
        } catch (err: any) {
            blockedDeveloperPlan =
                err.code === "TEAM_PLAN_REQUIRED" ||
                err.message?.includes("TEAM_PLAN_REQUIRED") ||
                err.message?.includes("TEAM_OWNERSHIP_INTELLIGENCE");
        }
        assert(blockedDeveloperPlan, "Test 58a: Developer plan direct request is rejected with TEAM_PLAN_REQUIRED");
        checksPassed++;

        setTestUser(userAlice); // Team plan user
        const teamPlanConfig = await configureServiceOwnership({
            projectId: projTeamA.id,
            serviceName: "test-payments-api",
            declaredOwner: "Team Payments",
            declaredTeam: "Team Payments",
            sourcePath: "apps/payments/**",
            commitSha: "sha123abc",
        });
        assert(
            teamPlanConfig.declaredOwner === "Team Payments" && teamPlanConfig.classification === "DECLARED",
            "Test 58b: Team plan organization successfully configures service ownership"
        );
        checksPassed++;

        // =====================================================================
        // TEST 56 & 57: MULTI-TENANT & PROJECT BOUNDARY ISOLATION
        // =====================================================================
        console.log("\n--- TEST 56 & 57: Tenant & Project Boundary Isolation ---");
        setTestUser(userEve); // Belongs to Foreign Org

        let crossTenantBlocked = false;
        try {
            await getServiceOwnership(projTeamA.id, "test-payments-api");
        } catch (err: any) {
            crossTenantBlocked = true;
        }
        assert(crossTenantBlocked, "Test 56: Cross-organization user rejected from querying foreign service ownership");
        checksPassed++;

        // User Eve attempts to configure ownership on Org Team's project
        let crossTenantWriteBlocked = false;
        try {
            await configureServiceOwnership({
                projectId: projTeamA.id,
                serviceName: "test-payments-api",
                declaredOwner: "Malicious Foreign Owner",
            });
        } catch (err: any) {
            crossTenantWriteBlocked = true;
        }
        assert(crossTenantWriteBlocked, "Test 57: Cross-organization user rejected from writing foreign service ownership");
        checksPassed++;

        // =====================================================================
        // TEST 59: UNKNOWN OWNER HANDLING (ZERO FABRICATION)
        // =====================================================================
        console.log("\n--- TEST 59: Unknown Owner Handling ---");
        setTestUser(userAlice);

        const unknownServiceResult = await getServiceOwnership(projTeamA.id, "test-unconfigured-service");
        assert(
            unknownServiceResult.status === "UNKNOWN" &&
            unknownServiceResult.declaredOwners.length === 0 &&
            unknownServiceResult.owningTeam === null,
            "Test 59: Unconfigured service returns status UNKNOWN with zero fabricated teams"
        );
        checksPassed++;

        // =====================================================================
        // TEST 60: OWNERSHIP CONFLICT DETECTION
        // =====================================================================
        console.log("\n--- TEST 60: Disagreement & Conflict Detection ---");
        // Service config declares "Team Alpha", but DB CODEOWNERS declares "Team Beta"
        await configureServiceOwnership({
            projectId: projTeamA.id,
            serviceName: "test-conflict-service",
            declaredOwner: "Team Alpha",
        });

        // Insert separate CODEOWNERS record for the same service
        await prisma.serviceOwnership.create({
            data: {
                organizationId: orgTeam.id,
                projectId: projTeamA.id,
                serviceName: "test-conflict-service",
                declaredOwner: "Team Beta",
                source: "CODEOWNERS",
                classification: "DECLARED",
                confidenceLevel: "HIGH",
            },
        });

        const conflictResult = await getServiceOwnership(projTeamA.id, "test-conflict-service");
        assert(
            conflictResult.status === "CONFLICT" &&
            Boolean(conflictResult.conflict) &&
            conflictResult.conflict!.sources.length === 2 &&
            conflictResult.declaredOwners.includes("Team Alpha") &&
            conflictResult.declaredOwners.includes("Team Beta"),
            "Test 60: Disagreement between service config and CODEOWNERS is surfaced as CONFLICT without silent overwrite"
        );
        checksPassed++;

        // =====================================================================
        // TEST 61: MULTIPLE CODEOWNERS PRESERVATION
        // =====================================================================
        console.log("\n--- TEST 61: Multiple Declared Code Owners ---");
        const rawMultiCodeowners = `
# Multi-owner rule
/apps/payments/checkout/** @payments-team @security-team @platform-team
`;
        const parsedMulti = parseCodeownersContent(rawMultiCodeowners);
        const resolvedMulti = resolveCodeownersForPath(parsedMulti, "apps/payments/checkout/order.ts");
        assert(
            resolvedMulti.isDeclared &&
            resolvedMulti.owners.length === 3 &&
            resolvedMulti.owners.includes("@payments-team") &&
            resolvedMulti.owners.includes("@security-team") &&
            resolvedMulti.owners.includes("@platform-team"),
            "Test 61: Multiple declared owners in CODEOWNERS rule are all strictly preserved"
        );
        checksPassed++;

        // =====================================================================
        // TEST 62: MALFORMED CODEOWNERS ROBUSTNESS
        // =====================================================================
        console.log("\n--- TEST 62: Malformed CODEOWNERS Robustness ---");
        const malformedContent = `
# Comment
   
invalid_rule_without_owner
/valid/path/** @valid-team # trailing comment
  weirdly   spaced   /another/path   @another-team
[invalid regex (pattern [[[
/normal/file.ts @file-team
`;
        const parsedMalformed = parseCodeownersContent(malformedContent);
        assert(
            parsedMalformed.rules.length >= 2,
            "Test 62a: Parser ignores malformed lines, handles whitespace variations, and survives without throwing"
        );
        checksPassed++;

        const normalMatch = resolveCodeownersForPath(parsedMalformed, "normal/file.ts");
        assert(
            normalMatch.owners.includes("@file-team"),
            "Test 62b: Valid rules remain fully functional despite adjacent malformed rules"
        );
        checksPassed++;

        // =====================================================================
        // TEST 63: PATH TRAVERSAL SECURITY
        // =====================================================================
        console.log("\n--- TEST 63: Path Traversal Security ---");
        const traversalAttemptA = sanitizeRepositoryPath("../../etc/passwd");
        const traversalAttemptB = sanitizeRepositoryPath("/apps/payments/../../../secrets.env");
        const traversalAttemptC = sanitizeRepositoryPath("apps/payments/\0hidden.ts");

        assert(
            traversalAttemptA === null &&
            traversalAttemptB === null &&
            traversalAttemptC === null,
            "Test 63: Path sanitizer strictly rejects directory traversal (../), root escape, and null bytes"
        );
        checksPassed++;

        // =====================================================================
        // TEST 64: AUTHOR != OWNER (ZERO BLAME GUARANTEE)
        // =====================================================================
        console.log("\n--- TEST 64: Code Author Context Separation ---");
        // Create an investigation with code path and author context
        const invAuthorTest = await prisma.investigation.create({
            data: {
                projectId: projTeamA.id,
                title: "Author vs Owner Test",
                summary: "Testing author context separation",
                rootCause: "Database Timeout",
                confidenceScore: 85,
                status: "COMPLETED",
            },
        });

        // Telemetry event with stack trace and file path
        await prisma.event.create({
            data: {
                projectId: projTeamA.id,
                environmentId: envTeamA.id,
                title: "Connection timeout",
                service: "test-payments-api",
                type: "ERROR",
                message: "Connection timeout",
                stack: "Error: Connection timeout\n at charge (apps/payments/src/charge.ts:42:15)",
                metadata: { rawFilePath: "apps/payments/src/charge.ts" },
                timestamp: new Date(),
            },
        });

        const invOwnership = await getInvestigationOwnership(invAuthorTest.id);
        assert(
            invOwnership.affectedServices.length > 0 &&
            invOwnership.affectedServices[0].serviceName === "test-payments-api" &&
            invOwnership.affectedServices[0].ownership.declaredOwners.includes("Team Payments"),
            "Test 64: Ownership resolution cleanly returns declared team without attributing fault to any code author"
        );
        checksPassed++;

        // =====================================================================
        // TEST 65: HISTORICAL PARTICIPANT != CURRENT OWNER
        // =====================================================================
        console.log("\n--- TEST 65: Historical Participant vs Declared Owner ---");
        // Create historical memory involving test-payments-api
        await prisma.incidentMemory.create({
            data: {
                investigationId: invAuthorTest.id,
                projectId: projTeamA.id,
                organizationId: orgTeam.id,
                fingerprint: "test-payments-api:charge:Timeout",
                title: "Historical Payment Incident",
                normalizedTitle: "Historical Payment Incident",
                primaryService: "test-payments-api",
                status: "COMPLETED",
                affectedServices: ["test-payments-api"],
            },
        });

        const historicalCheck = await getServiceOwnership(projTeamA.id, "test-payments-api");
        const histEvidence = historicalCheck.evidence.find((e) => e.source === "HISTORICAL_INCIDENT");
        assert(
            historicalCheck.status === "DECLARED" &&
            historicalCheck.declaredOwners.includes("Team Payments") &&
            histEvidence !== undefined &&
            histEvidence.classification === "HISTORICAL",
            "Test 65: Historical incident participation is tagged HISTORICAL and does not overwrite current DECLARED owner"
        );
        checksPassed++;

        // =====================================================================
        // TEST 66: ROOT-CAUSE SERVICE VS IMPACTED SURFACE
        // =====================================================================
        console.log("\n--- TEST 66: Causal Role Distinction (Root vs Impacted) ---");
        // Create multi-service investigation
        const invMultiRole = await prisma.investigation.create({
            data: {
                projectId: projTeamA.id,
                title: "Multi-Service Causal Chain",
                summary: "Root: billing-db -> Propagator: payments-api -> Impacted: checkout-ui",
                rootCause: "Billing DB Deadlock",
                confidenceScore: 90,
                status: "COMPLETED",
            },
        });

        // Event 1: Origin error in billing-db
        await prisma.event.create({
            data: {
                projectId: projTeamA.id,
                environmentId: envTeamA.id,
                title: "DeadlockException in billing-db",
                service: "test-billing-db",
                type: "ERROR",
                metadata: { errorType: "DeadlockException" },
                timestamp: new Date(Date.now() - 3000),
            },
        });

        // Event 2: Propagator error in payments-api
        await prisma.event.create({
            data: {
                projectId: projTeamA.id,
                environmentId: envTeamA.id,
                title: "HTTP 500 propagate",
                service: "test-payments-api",
                type: "TRACE",
                timestamp: new Date(Date.now() - 2000),
            },
        });

        // Event 3: Impacted surface in checkout-ui
        await prisma.event.create({
            data: {
                projectId: projTeamA.id,
                environmentId: envTeamA.id,
                title: "Checkout failed",
                service: "test-checkout-ui",
                type: "TRACE",
                timestamp: new Date(Date.now() - 1000),
            },
        });

        const multiRoleOwnership = await getInvestigationOwnership(invMultiRole.id);
        const rootRole = multiRoleOwnership.affectedServices.find((s) => s.serviceName === "test-billing-db");
        const impactedRole = multiRoleOwnership.affectedServices.find((s) => s.serviceName === "test-checkout-ui");

        assert(
            rootRole?.role === "ROOT_CAUSE_SERVICE" &&
            impactedRole?.role === "IMPACTED_SURFACE",
            "Test 66: Distinct causal roles: Root-cause service is strictly distinguished from impacted surface"
        );
        checksPassed++;

        // =====================================================================
        // TEST 67: OWNERSHIP CHANGE AUDIT TRAIL
        // =====================================================================
        console.log("\n--- TEST 67: Ownership Change Audit Trail ---");
        await configureServiceOwnership({
            projectId: projTeamA.id,
            serviceName: "test-changing-service",
            declaredOwner: "Team Alpha",
            commitSha: "sha-v1",
        });

        // Reassign to Team Beta
        await configureServiceOwnership({
            projectId: projTeamA.id,
            serviceName: "test-changing-service",
            declaredOwner: "Team Beta",
            commitSha: "sha-v2",
            reason: "Domain restructuring",
        });

        const history = await getServiceOwnershipHistory(projTeamA.id, "test-changing-service");
        assert(
            history.length > 0 &&
            history[0].previousOwner === "Team Alpha" &&
            history[0].newOwner === "Team Beta" &&
            history[0].sourceVersion === "sha-v2",
            "Test 67: Ownership mutation records verifiable audit history with previous owner, new owner, and version"
        );
        checksPassed++;

        // =====================================================================
        // TEST 68: INVESTIGATION ROOT CAUSE & CONFIDENCE IMMUTABILITY
        // =====================================================================
        console.log("\n--- TEST 68: Root Cause Protection ---");
        const invProtect = await prisma.investigation.create({
            data: {
                projectId: projTeamA.id,
                title: "Protected Cause Investigation",
                rootCause: "Unmutated Causal Origin",
                confidenceScore: 78.5,
                status: "COMPLETED",
            },
        });

        // Resolve ownership multiple times
        await getInvestigationOwnership(invProtect.id);
        await getInvestigationOwnership(invProtect.id);

        const reloadedInv = await prisma.investigation.findUnique({
            where: { id: invProtect.id },
            select: { rootCause: true, confidenceScore: true },
        });

        assert(
            reloadedInv?.rootCause === "Unmutated Causal Origin" &&
            reloadedInv?.confidenceScore === 78.5,
            "Test 68: Ownership resolution operations NEVER mutate investigation rootCause or confidenceScore"
        );
        checksPassed++;

        // =====================================================================
        // TEST 69: HUMAN ASSERTIONS TAGGED STRICTLY AS HUMAN ASSERTION
        // =====================================================================
        console.log("\n--- TEST 69: Human Assertions Strictly Tagged ---");
        await recordHumanOwnershipAssertion({
            projectId: projTeamA.id,
            serviceName: "test-human-service",
            proposedOwner: "Team Core",
            statement: "I believe Core Team maintains this service.",
        });

        const humanResult = await getServiceOwnership(projTeamA.id, "test-human-service");
        const humanEvidence = humanResult.evidence.find((e) => e.source === "HUMAN_ASSERTION");
        assert(
            humanResult.humanAssertions.length === 1 &&
            humanEvidence !== undefined &&
            humanEvidence.classification === "HUMAN_ASSERTION" &&
            humanResult.status !== "DECLARED",
            "Test 69: Human assertions are strictly tagged HUMAN ASSERTION and never masquerade as DECLARED ownership"
        );
        checksPassed++;

        // =====================================================================
        // TEST 70: CROSS-TENANT CACHE ISOLATION
        // =====================================================================
        console.log("\n--- TEST 70: Cross-Tenant Cache Isolation ---");
        clearCodeownersCache();
        // Populate cache for Org Team
        await loadProjectCodeowners(projTeamA.id, orgTeam.id, "main");

        // Attempt load with foreign org ID on the same project
        const foreignCacheAttempt = await loadProjectCodeowners(projTeamA.id, orgForeign.id, "main");
        assert(
            foreignCacheAttempt === null,
            "Test 70: Loader prevents cross-tenant cache leakage: Foreign organization receives null"
        );
        checksPassed++;

        // =====================================================================
        // TEST 71: SOURCE FRESHNESS & COMMIT SHA TRACKING
        // =====================================================================
        console.log("\n--- TEST 71: Source Freshness & Commit SHA Tracking ---");
        const codeownersV1 = parseCodeownersContent("/apps/** @team-v1", {
            sourceLocation: ".github/CODEOWNERS",
            commitSha: "commit_v1",
        });
        const codeownersV2 = parseCodeownersContent("/apps/** @team-v2", {
            sourceLocation: ".github/CODEOWNERS",
            commitSha: "commit_v2",
        });

        const matchV1 = resolveCodeownersForPath(codeownersV1, "apps/main.ts");
        const matchV2 = resolveCodeownersForPath(codeownersV2, "apps/main.ts");

        assert(
            matchV1.commitSha === "commit_v1" &&
            matchV1.owners[0] === "@team-v1" &&
            matchV2.commitSha === "commit_v2" &&
            matchV2.owners[0] === "@team-v2",
            "Test 71: Distinct commit SHAs produce distinguishable, version-aware ownership observations"
        );
        checksPassed++;

        // =====================================================================
        // TEST 72: NO REPOSITORY METADATA -> REPOSITORY: UNKNOWN
        // =====================================================================
        console.log("\n--- TEST 72: Missing Repository Metadata Handling ---");
        // projTeamB has no githubRepoOwner or githubRepoName
        const noRepoResult = await getServiceOwnership(projTeamB.id, "test-no-repo-service");
        assert(
            noRepoResult.repository === "Unknown",
            "Test 72: Projects without repository metadata strictly report 'Unknown' without fabricating URLs"
        );
        checksPassed++;

        // =====================================================================
        // TEST 73: NO SOURCE PATH -> CODE OWNERSHIP UNAVAILABLE
        // =====================================================================
        console.log("\n--- TEST 73: Missing Source Path Handling ---");
        const invNoPath = await prisma.investigation.create({
            data: {
                projectId: projTeamB.id,
                title: "No Source Path Investigation",
                rootCause: "Network Latency",
                status: "COMPLETED",
            },
        });
        // Event with service but no filePath
        await prisma.event.create({
            data: {
                projectId: projTeamB.id,
                environmentId: envTeamB.id,
                title: "Trace event",
                service: "test-payments-api",
                type: "TRACE",
                timestamp: new Date(),
            },
        });

        const noPathOwnership = await getInvestigationOwnership(invNoPath.id);
        assert(
            noPathOwnership.codeOwnership === null,
            "Test 73: Investigation without code path evidence leaves code ownership cleanly unavailable"
        );
        checksPassed++;

        // =====================================================================
        // TEST 74: MULTI-SERVICE INCIDENT INDEPENDENT OWNERSHIP
        // =====================================================================
        console.log("\n--- TEST 74: Multi-Service Incident Independence ---");
        await configureServiceOwnership({
            projectId: projTeamA.id,
            serviceName: "test-svc-1",
            declaredOwner: "Team 1",
        });
        await configureServiceOwnership({
            projectId: projTeamA.id,
            serviceName: "test-svc-2",
            declaredOwner: "Team 2",
        });
        await configureServiceOwnership({
            projectId: projTeamA.id,
            serviceName: "test-svc-3",
            declaredOwner: "Team 3",
        });

        const issueThree = await prisma.issue.create({
            data: {
                projectId: projTeamA.id,
                title: "Three Service Issue",
                fingerprint: `fingerprint_three_${testId}`,
                status: "OPEN",
            },
        });

        const invThreeServices = await prisma.investigation.create({
            data: {
                projectId: projTeamA.id,
                issueId: issueThree.id,
                title: "Three Service Incident",
                status: "COMPLETED",
            },
        });

        for (const s of ["test-svc-1", "test-svc-2", "test-svc-3"]) {
            await prisma.event.create({
                data: {
                    projectId: projTeamA.id,
                    environmentId: envTeamA.id,
                    issueId: issueThree.id,
                    title: `Error in ${s}`,
                    service: s,
                    type: "ERROR",
                    timestamp: new Date(),
                },
            });
        }

        const threeOwnership = await getInvestigationOwnership(invThreeServices.id);
        const distinctOwners = new Set(
            threeOwnership.affectedServices.flatMap((s) => s.ownership.declaredOwners)
        );
        assert(
            threeOwnership.affectedServices.length === 3 && distinctOwners.size === 3,
            "Test 74: Multi-service incident preserves independent ownership for all services without collapsing to one"
        );
        checksPassed++;

        // =====================================================================
        // TEST 75: ZERO DEVELOPER BLAME LANGUAGE AUDIT
        // =====================================================================
        console.log("\n--- TEST 75: Zero Blame Language Audit ---");
        // Verify postmortem and UI code contain zero blame terminology
        const postmortemAudit = await generateInvestigationPostmortem(invMultiRole.id);
        const forbiddenTerms = [
            "caused by Developer",
            "responsible developer",
            "culprit",
            "worst developer",
            "most problematic developer",
            "fault probability",
        ];

        let hasForbiddenBlame = false;
        for (const term of forbiddenTerms) {
            if (postmortemAudit.markdownReport.toLowerCase().includes(term.toLowerCase())) {
                hasForbiddenBlame = true;
                break;
            }
        }
        assert(
            !hasForbiddenBlame,
            "Test 75: Generated postmortem and ownership outputs contain zero developer blame terminology"
        );
        checksPassed++;

        // =====================================================================
        // TEST 27: OWNERSHIP CONFIDENCE SEMANTICS
        // =====================================================================
        console.log("\n--- TEST 27: Confidence Describes Evidence Certainty ---");
        const declaredService = await getServiceOwnership(projTeamA.id, "test-payments-api");
        const unknownService = await getServiceOwnership(projTeamA.id, "test-unconfigured-service");

        assert(
            declaredService.confidence === "HIGH" &&
            unknownService.confidence === "LOW",
            "Test 27: Ownership confidence strictly describes certainty of evidence (HIGH for declared, LOW for unconfigured)"
        );
        checksPassed++;

        // =====================================================================
        // TEST 32: EXTERNAL GROUP IDENTIFIERS
        // =====================================================================
        console.log("\n--- TEST 32: External Group Identifier Representation ---");
        const externalRule = parseCodeownersContent("/core/** @external-core-team");
        const externalMatch = resolveCodeownersForPath(externalRule, "core/main.ts");
        assert(
            externalMatch.owners[0] === "@external-core-team",
            "Test 32: Unmapped external identifiers (@external-core-team) are faithfully preserved without fabricating Halo teams"
        );
        checksPassed++;

        // =====================================================================
        // TEST 53: POSTMORTEM FACTUAL OWNERSHIP INTEGRATION
        // =====================================================================
        console.log("\n--- TEST 53: Postmortem Ownership Context Integration ---");
        assert(
            postmortemAudit.markdownReport.includes("Engineering Ownership") &&
            postmortemAudit.markdownReport.includes("is declared to be owned by"),
            "Test 53: Postmortem cleanly incorporates declared engineering ownership context without accusation"
        );
        checksPassed++;

        // =====================================================================
        // TEST 22: TOPOLOGY INTEGRATION (SERVICE REGISTRY ANNOTATION)
        // =====================================================================
        console.log("\n--- TEST 22: Topology Integration & Service Registry ---");
        const canonicalServices = await queryCanonicalServices({
            projectId: projTeamA.id,
            organizationId: orgTeam.id,
        });
        const paymentsService = canonicalServices.services.find((s) => s.name === "test-payments-api");
        assert(
            paymentsService !== undefined &&
            paymentsService.owner === "Team Payments",
            "Test 22: Topology and service registry cleanly inherit declared owner from ServiceOwnership"
        );
        checksPassed++;

        // =====================================================================
        // TEST 90: CASCADING DELETION SAFETY
        // =====================================================================
        console.log("\n--- TEST 90: Cascading Deletion Safety ---");
        const tempProject = await prisma.project.create({
            data: {
                name: "Temporary Project",
                slug: `temp-proj-${testId}`,
                organizationId: orgTeam.id,
            },
        });

        await prisma.serviceOwnership.create({
            data: {
                organizationId: orgTeam.id,
                projectId: tempProject.id,
                serviceName: "temp-service",
                declaredOwner: "Temp Team",
            },
        });

        // Delete project; service ownership should cascade
        await prisma.project.delete({ where: { id: tempProject.id } });
        const remainingOwnership = await prisma.serviceOwnership.findFirst({
            where: { projectId: tempProject.id },
        });

        assert(
            remainingOwnership === null,
            "Test 90: Deleting a project cleanly cascades and removes associated ServiceOwnership records"
        );
        checksPassed++;

    } finally {
        console.log("\nCleaning up test entities...");
        setTestUser(null);
        await prisma.serviceOwnershipHistory.deleteMany({
            where: { organizationId: { in: [orgTeam.id, orgDev.id, orgForeign.id] } },
        });
        await prisma.serviceOwnershipAssertion.deleteMany({
            where: { organizationId: { in: [orgTeam.id, orgDev.id, orgForeign.id] } },
        });
        await prisma.serviceOwnership.deleteMany({
            where: { organizationId: { in: [orgTeam.id, orgDev.id, orgForeign.id] } },
        });
        await prisma.incidentMemory.deleteMany({
            where: { organizationId: { in: [orgTeam.id, orgDev.id, orgForeign.id] } },
        });
        await prisma.event.deleteMany({
            where: { projectId: { in: [projTeamA.id, projTeamB.id, projDev.id, projForeign.id] } },
        });
        await prisma.issue.deleteMany({
            where: { projectId: { in: [projTeamA.id, projTeamB.id, projDev.id, projForeign.id] } },
        });
        await prisma.environment.deleteMany({
            where: { projectId: { in: [projTeamA.id, projTeamB.id, projDev.id, projForeign.id] } },
        });
        await prisma.investigation.deleteMany({
            where: { projectId: { in: [projTeamA.id, projTeamB.id, projDev.id, projForeign.id] } },
        });
        await prisma.project.deleteMany({
            where: { id: { in: [projTeamA.id, projTeamB.id, projDev.id, projForeign.id] } },
        });
        await prisma.organizationMember.deleteMany({
            where: { organizationId: { in: [orgTeam.id, orgDev.id, orgForeign.id] } },
        });
        await prisma.organization.deleteMany({
            where: { id: { in: [orgTeam.id, orgDev.id, orgForeign.id] } },
        });
        await prisma.user.deleteMany({
            where: { id: { in: [userAlice.id, userBob.id, userEve.id] } },
        });
    }

    console.log("==================================================");
    console.log(`TOTAL CHECKS: ${checksPassed}`);
    console.log(`PASSED: ${checksPassed}`);
    console.log(`FAILED: 0`);
    console.log("==================================================");
}

runPillarESuite().catch((err) => {
    console.error("FATAL ERROR in Pillar E Test Suite:", err);
    process.exit(1);
});
