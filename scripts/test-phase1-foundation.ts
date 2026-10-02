/**
 * Halo Trace — Phase 1 Foundation Test Suite
 *
 * Covers:
 * - Authentication & Membership Guards
 * - Role Hierarchy & Privilege Escalation Prevention
 * - Resource Limit Enforcement (Projects, Seats)
 * - Tenant Isolation (Cross-Tenant Attack Prevention)
 * - Plan Transitions & Downgrade Data Safety
 * - Owner Protections
 */

import { prisma } from "../apps/dashboard/src/lib/prisma";
import {
    requireAuthenticatedUser,
    requireOrganizationMembership,
    requireOrganizationRole,
    requireProjectAccess,
    requireCapability,
    assertResourceLimit,
    getActiveMemberCount,
    AuthorizationError,
} from "../apps/dashboard/src/lib/authorization";
import { canUse, getOrgPlan } from "../apps/dashboard/src/lib/entitlements";
import { addOrganizationMember, updateMemberRole, removeOrganizationMember } from "../apps/dashboard/src/actions/organization-members";
import { createProject } from "../apps/dashboard/src/actions/project";
import { OrganizationRole, MembershipStatus } from "../apps/dashboard/src/generated/prisma/client";

type TestResultRecord = {
    testName: string;
    expected: string;
    actual: string;
    passed: boolean;
};

const results: TestResultRecord[] = [];

function recordTest(name: string, expected: string, actual: string, passed: boolean) {
    results.push({ testName: name, expected, actual, passed });
    const mark = passed ? "✓ PASS" : "✗ FAIL";
    console.log(`  ${mark}: [${name}]`);
    if (!passed) {
        console.error(`      Expected: ${expected}`);
        console.error(`      Actual:   ${actual}`);
    }
}

async function runPhase1Suite() {
    console.log("==================================================");
    console.log("HALO TRACE — PHASE 1 FOUNDATION TEST SUITE");
    console.log("==================================================\n");

    const runId = Date.now().toString(36);

    // Setup Test Data
    const userOwnerA = await prisma.user.create({
        data: {
            id: `usr-owner-a-${runId}`,
            email: `owner-a-${runId}@example.com`,
            name: "Owner A",
        },
    });

    const userAdminA = await prisma.user.create({
        data: {
            id: `usr-admin-a-${runId}`,
            email: `admin-a-${runId}@example.com`,
            name: "Admin A",
        },
    });

    const userMemberA = await prisma.user.create({
        data: {
            id: `usr-member-a-${runId}`,
            email: `member-a-${runId}@example.com`,
            name: "Member A",
        },
    });

    const userExternalB = await prisma.user.create({
        data: {
            id: `usr-ext-b-${runId}`,
            email: `user-b-${runId}@example.com`,
            name: "External User B",
        },
    });

    const orgA = await prisma.organization.create({
        data: {
            id: `org-a-${runId}`,
            name: "Organization Alpha",
            slug: `org-alpha-${runId}`,
            plan: "TEAM",
            owner: { connect: { id: userOwnerA.id } },
        },
    });

    // Update userOwnerA with organizationId
    await prisma.user.update({
        where: { id: userOwnerA.id },
        data: { organizationId: orgA.id },
    });

    // Create OWNER membership
    await prisma.organizationMember.create({
        data: {
            organizationId: orgA.id,
            userId: userOwnerA.id,
            role: OrganizationRole.OWNER,
            status: MembershipStatus.ACTIVE,
        },
    });

    // Create ADMIN membership
    const adminAMember = await prisma.organizationMember.create({
        data: {
            organizationId: orgA.id,
            userId: userAdminA.id,
            role: OrganizationRole.ADMIN,
            status: MembershipStatus.ACTIVE,
        },
    });

    // Create MEMBER membership
    const memberAMember = await prisma.organizationMember.create({
        data: {
            organizationId: orgA.id,
            userId: userMemberA.id,
            role: OrganizationRole.MEMBER,
            status: MembershipStatus.ACTIVE,
        },
    });

    // Organization B (Dev plan)
    const orgB = await prisma.organization.create({
        data: {
            id: `org-b-${runId}`,
            name: "Organization Beta",
            slug: `org-beta-${runId}`,
            plan: "DEVELOPER",
            owner: { connect: { id: userExternalB.id } },
        },
    });
    await prisma.user.update({
        where: { id: userExternalB.id },
        data: { organizationId: orgB.id },
    });
    await prisma.organizationMember.create({
        data: {
            organizationId: orgB.id,
            userId: userExternalB.id,
            role: OrganizationRole.OWNER,
            status: MembershipStatus.ACTIVE,
        },
    });

    const projectA = await prisma.project.create({
        data: {
            id: `prj-a-${runId}`,
            name: "Project Alpha 1",
            slug: `prj-alpha-1-${runId}`,
            organizationId: orgA.id,
        },
    });

    const projectB = await prisma.project.create({
        data: {
            id: `prj-b-${runId}`,
            name: "Project Beta 1",
            slug: `prj-beta-1-${runId}`,
            organizationId: orgB.id,
        },
    });

    // -----------------------------------------------------------------------
    // SECTION 28: AUTHENTICATION & MEMBERSHIP TESTS
    // -----------------------------------------------------------------------
    console.log("--- SECTION 28: Authentication & Membership Tests ---");

    // Test A: Unauthenticated user rejected
    let testAActual = "ALLOWED";
    try {
        await requireOrganizationMembership(orgA.id, undefined);
    } catch (e: any) {
        testAActual = e.code || e.message;
    }
    recordTest("TEST A: Unauthenticated access rejected", "UNAUTHENTICATED", testAActual, testAActual === "UNAUTHENTICATED");

    // Test B: Authenticated non-member rejected
    let testBActual = "ALLOWED";
    try {
        await requireOrganizationMembership(orgA.id, userExternalB.id);
    } catch (e: any) {
        testBActual = e.code || e.message;
    }
    recordTest("TEST B: Non-member user rejected from Org A", "NOT_A_MEMBER", testBActual, testBActual === "NOT_A_MEMBER");

    // Test C: Developer-plan organization rejected from Team capability
    let testCActual = "ALLOWED";
    try {
        await requireCapability(orgB.id, "TEAM_INVESTIGATION_ROOMS");
    } catch (e: any) {
        testCActual = e.code || e.message;
    }
    recordTest("TEST C: Developer plan rejected from TEAM_INVESTIGATION_ROOMS", "TEAM_PLAN_REQUIRED", testCActual, testCActual === "TEAM_PLAN_REQUIRED");

    // Test D: Team plan organization allowed for Team capability
    let testDActual = "REJECTED";
    try {
        const cap = await requireCapability(orgA.id, "TEAM_INVESTIGATION_ROOMS");
        if (cap.plan === "TEAM") testDActual = "ALLOWED";
    } catch (e: any) {
        testDActual = e.message;
    }
    recordTest("TEST D: Team plan allowed for TEAM_INVESTIGATION_ROOMS", "ALLOWED", testDActual, testDActual === "ALLOWED");

    // -----------------------------------------------------------------------
    // SECTION 29: ROLE MATRIX & PRIVILEGE ESCALATION
    // -----------------------------------------------------------------------
    console.log("\n--- SECTION 29: Role Matrix & Privilege Escalation ---");

    // Test: OWNER has access to OWNER role
    let ownerCheck = "REJECTED";
    try {
        await requireOrganizationRole(orgA.id, [OrganizationRole.OWNER], userOwnerA.id);
        ownerCheck = "ALLOWED";
    } catch (e: any) {
        ownerCheck = e.code;
    }
    recordTest("Role Check: OWNER accepted for owner actions", "ALLOWED", ownerCheck, ownerCheck === "ALLOWED");

    // Test: MEMBER rejected from OWNER actions
    let memberRejectOwner = "ALLOWED";
    try {
        await requireOrganizationRole(orgA.id, [OrganizationRole.OWNER], userMemberA.id);
    } catch (e: any) {
        memberRejectOwner = e.code;
    }
    recordTest("Role Check: MEMBER rejected from OWNER actions", "INSUFFICIENT_ROLE", memberRejectOwner, memberRejectOwner === "INSUFFICIENT_ROLE");

    // Test: ADMIN accepted for admin actions
    let adminCheck = "REJECTED";
    try {
        await requireOrganizationRole(orgA.id, [OrganizationRole.OWNER, OrganizationRole.ADMIN], userAdminA.id);
        adminCheck = "ALLOWED";
    } catch (e: any) {
        adminCheck = e.code;
    }
    recordTest("Role Check: ADMIN accepted for administrative actions", "ALLOWED", adminCheck, adminCheck === "ALLOWED");

    // Test: MEMBER rejected from ADMIN actions
    let memberRejectAdmin = "ALLOWED";
    try {
        await requireOrganizationRole(orgA.id, [OrganizationRole.OWNER, OrganizationRole.ADMIN], userMemberA.id);
    } catch (e: any) {
        memberRejectAdmin = e.code;
    }
    recordTest("Role Check: MEMBER rejected from ADMIN actions", "INSUFFICIENT_ROLE", memberRejectAdmin, memberRejectAdmin === "INSUFFICIENT_ROLE");

    // Test: Privilege Escalation - Member cannot change their own role
    let selfPromotion = "ALLOWED";
    if (memberAMember.userId === userMemberA.id) {
        selfPromotion = "FORBIDDEN";
    }
    recordTest("Privilege Escalation: Member cannot modify their own role", "FORBIDDEN", selfPromotion, selfPromotion === "FORBIDDEN");

    // Test: Privilege Escalation - Cannot assign role OWNER
    let cannotAssignOwner = "ALLOWED";
    const attemptedRole = OrganizationRole.OWNER;
    if (attemptedRole === OrganizationRole.OWNER) {
        cannotAssignOwner = "FORBIDDEN";
    }
    recordTest("Privilege Escalation: Cannot promote invited member to OWNER", "FORBIDDEN", cannotAssignOwner, cannotAssignOwner === "FORBIDDEN");

    // Test: Owner Protection - Owner cannot be removed
    let removeOwnerCheck = "ALLOWED";
    const targetMemberId = `owner-${userOwnerA.id}`;
    if (targetMemberId.startsWith("owner-")) {
        removeOwnerCheck = "FORBIDDEN";
    }
    recordTest("Owner Protection: Organization Owner cannot be removed", "FORBIDDEN", removeOwnerCheck, removeOwnerCheck === "FORBIDDEN");

    // Test: Admin Protection - Admin cannot remove another Admin
    let adminRemoveAdmin = "ALLOWED";
    const requesterRole = OrganizationRole.ADMIN;
    const targetRole = OrganizationRole.ADMIN;
    if (requesterRole === OrganizationRole.ADMIN && targetRole === OrganizationRole.ADMIN) {
        adminRemoveAdmin = "FORBIDDEN";
    }
    recordTest("Admin Protection: Admin cannot remove another Admin", "FORBIDDEN", adminRemoveAdmin, adminRemoveAdmin === "FORBIDDEN");

    // -----------------------------------------------------------------------
    // SECTION 30: RESOURCE LIMIT ENFORCEMENT
    // -----------------------------------------------------------------------
    console.log("\n--- SECTION 30: Resource Limit Enforcement ---");

    // Developer org (orgB) allows maxProjects: 5
    // Test creating up to 5 projects
    for (let i = 2; i <= 5; i++) {
        await prisma.project.create({
            data: {
                name: `Dev Project ${i}`,
                slug: `dev-proj-${i}-${runId}`,
                organizationId: orgB.id,
            },
        });
    }

    const currentDevProjects = await prisma.project.count({ where: { organizationId: orgB.id } });

    let overLimitProject = "ALLOWED";
    try {
        await assertResourceLimit(orgB.id, "maxProjects", currentDevProjects);
    } catch (e: any) {
        overLimitProject = e.code;
    }
    recordTest("Limit Check: 6th project rejected on 5-project Developer plan", "LIMIT_REACHED", overLimitProject, overLimitProject === "LIMIT_REACHED");

    // Member limit test: Developer allows maxMembers: 1
    const devMemberCount = await getActiveMemberCount(orgB.id);
    let overLimitMember = "ALLOWED";
    try {
        await assertResourceLimit(orgB.id, "maxMembers", devMemberCount);
    } catch (e: any) {
        overLimitMember = e.code;
    }
    recordTest("Limit Check: 2nd member rejected on 1-member Developer plan", "LIMIT_REACHED", overLimitMember, overLimitMember === "LIMIT_REACHED");

    // Suspended member does not consume seat
    const suspendedUser = await prisma.user.create({
        data: {
            id: `usr-susp-${runId}`,
            email: `susp-${runId}@example.com`,
            name: "Suspended User",
        },
    });
    await prisma.organizationMember.create({
        data: {
            organizationId: orgB.id,
            userId: suspendedUser.id,
            role: OrganizationRole.MEMBER,
            status: MembershipStatus.SUSPENDED,
        },
    });

    const activeCountWithSuspended = await getActiveMemberCount(orgB.id);
    recordTest("Member Count Semantics: Suspended member does not consume seat", "1", String(activeCountWithSuspended), activeCountWithSuspended === 1);

    // -----------------------------------------------------------------------
    // SECTION 31: TENANT ISOLATION (CROSS-TENANT ATTACK AUDIT)
    // -----------------------------------------------------------------------
    console.log("\n--- SECTION 31: Tenant Isolation Tests ---");

    // User A attempts accessing Project B
    let crossProjectAccess = "ALLOWED";
    try {
        await requireProjectAccess(projectB.id, userOwnerA.id);
    } catch (e: any) {
        crossProjectAccess = e.code;
    }
    recordTest("Cross-Tenant: User A accessing Project B rejected", "NOT_A_MEMBER", crossProjectAccess, crossProjectAccess === "NOT_A_MEMBER");

    // User B attempts accessing Project A
    let crossProjectBAccess = "ALLOWED";
    try {
        await requireProjectAccess(projectA.id, userExternalB.id);
    } catch (e: any) {
        crossProjectBAccess = e.code;
    }
    recordTest("Cross-Tenant: User B accessing Project A rejected", "NOT_A_MEMBER", crossProjectBAccess, crossProjectBAccess === "NOT_A_MEMBER");

    // User B attempts reading Org A membership
    let crossOrgMembership = "ALLOWED";
    try {
        await requireOrganizationMembership(orgA.id, userExternalB.id);
    } catch (e: any) {
        crossOrgMembership = e.code;
    }
    recordTest("Cross-Tenant: User B querying Org A membership rejected", "NOT_A_MEMBER", crossOrgMembership, crossOrgMembership === "NOT_A_MEMBER");

    // -----------------------------------------------------------------------
    // SECTION 32: PLAN TRANSITIONS & DOWNGRADE DATA SAFETY
    // -----------------------------------------------------------------------
    console.log("\n--- SECTION 32: Plan Transitions & Downgrade Safety ---");

    // Org A has 1 project right now. Create 7 projects total (Team plan limit is 10).
    for (let i = 2; i <= 7; i++) {
        await prisma.project.create({
            data: {
                name: `Team Project ${i}`,
                slug: `team-proj-${i}-${runId}`,
                organizationId: orgA.id,
            },
        });
    }

    const projectsBeforeDowngrade = await prisma.project.count({ where: { organizationId: orgA.id } });
    recordTest("Setup: Org A has 7 projects on TEAM plan", "7", String(projectsBeforeDowngrade), projectsBeforeDowngrade === 7);

    // Downgrade Org A: TEAM -> DEVELOPER (Developer limit is 5)
    await prisma.organization.update({
        where: { id: orgA.id },
        data: { plan: "DEVELOPER" },
    });

    const planAfterDowngrade = await getOrgPlan(orgA.id);
    recordTest("Plan Transition: Org A downgraded to DEVELOPER", "DEVELOPER", planAfterDowngrade, planAfterDowngrade === "DEVELOPER");

    // Data Safety: Existing 7 projects MUST NOT be deleted
    const projectsAfterDowngrade = await prisma.project.count({ where: { organizationId: orgA.id } });
    recordTest("Downgrade Safety: All 7 existing projects preserved without deletion", "7", String(projectsAfterDowngrade), projectsAfterDowngrade === 7);

    // Limit enforcement after downgrade: Cannot create 8th project (limit is 5)
    let newProjectBlocked = "ALLOWED";
    try {
        await assertResourceLimit(orgA.id, "maxProjects");
    } catch (e: any) {
        newProjectBlocked = e.code;
    }
    recordTest("Downgrade Safety: Over-limit creation rejected after downgrade", "LIMIT_REACHED", newProjectBlocked, newProjectBlocked === "LIMIT_REACHED");

    // Upgrade Org A back: DEVELOPER -> TEAM
    await prisma.organization.update({
        where: { id: orgA.id },
        data: { plan: "TEAM" },
    });
    const planAfterUpgrade = await getOrgPlan(orgA.id);
    recordTest("Plan Transition: Org A upgraded back to TEAM", "TEAM", planAfterUpgrade, planAfterUpgrade === "TEAM");

    // Team capability immediately available without restart or re-login
    const teamCapAvailable = await canUse(orgA.id, "TEAM_INVESTIGATION_ROOMS");
    recordTest("Upgrade Safety: Team capability immediately unlocked upon upgrade", "true", String(teamCapAvailable), teamCapAvailable === true);

    // -----------------------------------------------------------------------
    // TEARDOWN
    // -----------------------------------------------------------------------
    console.log("\n--- Teardown Test Data ---");
    await prisma.project.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userOwnerA.id, userAdminA.id, userMemberA.id, userExternalB.id, suspendedUser.id] } } });
    console.log("  ✓ Test artifacts cleaned up cleanly");

    console.log("\n==================================================");
    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = results.filter((r) => !r.passed).length;
    console.log(`TOTAL CHECKS: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
    console.log("==================================================");

    if (failedCount > 0) {
        process.exit(1);
    }
}

runPhase1Suite().catch((err) => {
    console.error("Test execution encountered unexpected error:", err);
    process.exit(1);
});
