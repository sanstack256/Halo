/**
 * Centralized, authoritative server-side authorization layer for Halo Trace.
 *
 * Implements strict tenant scoping, role hierarchy, owner protection,
 * resource limit enforcement, and semantic capability checks.
 *
 * All server actions, API routes, and mutations MUST go through these guards.
 */

import { prisma } from "./prisma";
import { getSession } from "./session";
import { PLANS, type PlanId, type PlanLimits } from "./plans";
import { planHasCapability, type TeamCapability } from "./capabilities";
import { OrganizationRole, MembershipStatus } from "@/generated/prisma/client";

// Machine-readable error codes
export type AuthErrorCode =
    | "UNAUTHENTICATED"
    | "NOT_A_MEMBER"
    | "INSUFFICIENT_ROLE"
    | "TEAM_PLAN_REQUIRED"
    | "LIMIT_REACHED"
    | "FORBIDDEN"
    | "PROJECT_NOT_FOUND"
    | "ORGANIZATION_NOT_FOUND";

export class AuthorizationError extends Error {
    constructor(
        public readonly code: AuthErrorCode,
        message: string,
        public readonly details?: Record<string, any>
    ) {
        super(message);
        this.name = "AuthorizationError";
    }
}

/**
 * 1. Require that a request is authenticated with a valid user session.
 */
export async function requireAuthenticatedUser() {
    const session = await getSession();
    if (!session?.user?.id) {
        throw new AuthorizationError(
            "UNAUTHENTICATED",
            "Authentication required to perform this action"
        );
    }
    return {
        user: session.user,
        session: session.session,
    };
}

/**
 * 2. Get authoritative organization plan.
 */
export async function getOrganizationPlan(organizationId: string): Promise<PlanId> {
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { plan: true },
    });

    if (!org) {
        throw new AuthorizationError(
            "ORGANIZATION_NOT_FOUND",
            "Organization does not exist"
        );
    }

    return (org.plan as PlanId) ?? "FREE";
}

/**
 * 3. Count active members in an organization.
 * Defined strictly: Only ACTIVE memberships count towards seat limits.
 * Excludes suspended users, deleted users, or unconfirmed invitations.
 */
export async function getActiveMemberCount(organizationId: string): Promise<number> {
    const count = await prisma.organizationMember.count({
        where: {
            organizationId,
            status: MembershipStatus.ACTIVE,
        },
    });

    // If owner exists on organization but is not yet in members table, count them
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
            owner: { select: { id: true } },
            members: {
                where: { status: MembershipStatus.ACTIVE },
                select: { userId: true },
            },
        },
    });

    if (org?.owner?.id) {
        const ownerInMembers = org.members.some((m) => m.userId === org.owner!.id);
        if (!ownerInMembers) {
            return count + 1;
        }
    }

    return count;
}

/**
 * 4. Require that the user belongs to an organization (as an owner or active member).
 * Establishes strong tenant boundary.
 */
export async function requireOrganizationMembership(
    organizationId: string,
    providedUserId?: string
) {
    let userId = providedUserId;
    if (!userId) {
        const { user } = await requireAuthenticatedUser();
        userId = user.id;
    }

    // Check direct owner relationship
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            owner: { select: { id: true } },
        },
    });

    if (!org) {
        throw new AuthorizationError(
            "ORGANIZATION_NOT_FOUND",
            "Organization does not exist"
        );
    }

    if (org.owner?.id === userId) {
        return {
            organization: org,
            membership: {
                userId,
                organizationId,
                role: OrganizationRole.OWNER,
                status: MembershipStatus.ACTIVE,
                isOwner: true,
            },
        };
    }

    // Check OrganizationMember record
    const memberRecord = await prisma.organizationMember.findUnique({
        where: {
            organizationId_userId: {
                organizationId,
                userId,
            },
        },
    });

    if (!memberRecord || memberRecord.status !== MembershipStatus.ACTIVE) {
        throw new AuthorizationError(
            "NOT_A_MEMBER",
            "User is not an active member of this organization"
        );
    }

    return {
        organization: org,
        membership: {
            ...memberRecord,
            isOwner: false,
        },
    };
}

/**
 * 5. Require that the user has a specific minimum role in the organization.
 */
export async function requireOrganizationRole(
    organizationId: string,
    allowedRoles: OrganizationRole[],
    providedUserId?: string
) {
    const { organization, membership } = await requireOrganizationMembership(
        organizationId,
        providedUserId
    );

    if (!allowedRoles.includes(membership.role)) {
        throw new AuthorizationError(
            "INSUFFICIENT_ROLE",
            `Action requires one of the following roles: [${allowedRoles.join(", ")}]. User has role: ${membership.role}`,
            { currentRole: membership.role, allowedRoles }
        );
    }

    return { organization, membership };
}

/**
 * 6. Require authorized access to a project.
 * Scopes authorization from authenticated identity + database relationships.
 * Never trusts client-supplied organizationId.
 */
export async function requireProjectAccess(
    projectId: string,
    providedUserId?: string
) {
    let userId = providedUserId;
    if (!userId) {
        const { user } = await requireAuthenticatedUser();
        userId = user.id;
    }

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
            id: true,
            name: true,
            slug: true,
            organizationId: true,
        },
    });

    if (!project) {
        throw new AuthorizationError(
            "PROJECT_NOT_FOUND",
            "Project not found"
        );
    }

    // Verify user belongs to the project's owning organization
    const { organization, membership } = await requireOrganizationMembership(
        project.organizationId,
        userId
    );

    return {
        project,
        organization,
        membership,
    };
}

/**
 * 7. Require that the organization's plan unlocks a semantic capability.
 */
export async function requireCapability(
    organizationId: string,
    capability: TeamCapability
) {
    const plan = await getOrganizationPlan(organizationId);
    const hasCapability = planHasCapability(plan, capability);

    if (!hasCapability) {
        throw new AuthorizationError(
            "TEAM_PLAN_REQUIRED",
            `Capability "${capability}" requires the Team plan. Current organization plan is ${plan}.`,
            { currentPlan: plan, capability }
        );
    }

    return { plan };
}

/**
 * 8. Authoritative Resource Limit Check.
 * Verifies that an organization has not reached or exceeded its plan limits.
 * Call before mutating resource counts.
 */
export async function assertResourceLimit(
    organizationId: string,
    limitKey: keyof PlanLimits,
    proposedCount?: number
) {
    const plan = await getOrganizationPlan(organizationId);
    const limitMax = PLANS[plan].limits[limitKey];

    // null means unlimited
    if (limitMax === null) {
        return { allowed: true, current: proposedCount ?? 0, max: null, plan };
    }

    let current = proposedCount;

    if (current === undefined) {
        if (limitKey === "maxProjects") {
            current = await prisma.project.count({
                where: { organizationId },
            });
        } else if (limitKey === "maxMembers") {
            current = await getActiveMemberCount(organizationId);
        } else {
            current = 0;
        }
    }

    if (current >= limitMax) {
        throw new AuthorizationError(
            "LIMIT_REACHED",
            `Organization has reached the ${limitKey} limit of ${limitMax} on the ${plan} plan. Upgrade to increase capacity.`,
            { limitKey, current, max: limitMax, currentPlan: plan }
        );
    }

    return { allowed: true, current, max: limitMax, plan };
}
