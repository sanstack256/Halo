"use server";

import { prisma } from "@/lib/prisma";
import { getOrganization } from "@/lib/organization";
import {
    requireAuthenticatedUser,
    requireOrganizationMembership,
    requireOrganizationRole,
    assertResourceLimit,
    getActiveMemberCount,
    AuthorizationError,
} from "@/lib/authorization";
import { OrganizationRole, MembershipStatus } from "@/generated/prisma/client";
import { PLANS, type PlanId } from "@/lib/plans";
import { revalidatePath } from "next/cache";

export type OrgMemberView = {
    id: string;
    userId: string;
    name: string;
    email: string;
    role: OrganizationRole;
    status: MembershipStatus;
    joinedAt: Date;
    isOwner: boolean;
};

export async function getOrganizationMembers(): Promise<{
    members: OrgMemberView[];
    currentCount: number;
    maxAllowed: number | null;
    planId: PlanId;
}> {
    const { user } = await requireAuthenticatedUser();
    const org = await getOrganization(user.id);
    if (!org) {
        throw new AuthorizationError("ORGANIZATION_NOT_FOUND", "Organization not found");
    }

    await requireOrganizationMembership(org.id, user.id);

    // Fetch owner
    const ownerUser = await prisma.user.findFirst({
        where: { organizationId: org.id },
        select: { id: true, name: true, email: true, createdAt: true },
    });

    // Fetch active members
    const memberRecords = await prisma.organizationMember.findMany({
        where: { organizationId: org.id },
        include: {
            user: {
                select: { id: true, name: true, email: true },
            },
        },
        orderBy: { createdAt: "asc" },
    });

    const members: OrgMemberView[] = [];

    // Add owner
    if (ownerUser) {
        members.push({
            id: `owner-${ownerUser.id}`,
            userId: ownerUser.id,
            name: ownerUser.name || "Owner",
            email: ownerUser.email,
            role: OrganizationRole.OWNER,
            status: MembershipStatus.ACTIVE,
            joinedAt: ownerUser.createdAt,
            isOwner: true,
        });
    }

    for (const m of memberRecords) {
        if (m.userId === ownerUser?.id) continue;
        members.push({
            id: m.id,
            userId: m.userId,
            name: m.user.name || "Member",
            email: m.user.email,
            role: m.role,
            status: m.status,
            joinedAt: m.createdAt,
            isOwner: false,
        });
    }

    const planId = (org.plan as PlanId) ?? "FREE";
    const maxAllowed = PLANS[planId].limits.maxMembers;
    const activeCount = members.filter((m) => m.status === MembershipStatus.ACTIVE).length;

    return {
        members,
        currentCount: activeCount,
        maxAllowed,
        planId,
    };
}

export async function addOrganizationMember(
    email: string,
    role: OrganizationRole = OrganizationRole.MEMBER
) {
    const { user } = await requireAuthenticatedUser();
    const org = await getOrganization(user.id);
    if (!org) throw new AuthorizationError("ORGANIZATION_NOT_FOUND", "Organization not found");

    // 1. Only OWNER or ADMIN can invite members
    await requireOrganizationRole(org.id, [OrganizationRole.OWNER, OrganizationRole.ADMIN], user.id);

    // 2. Owner protection: Cannot assign role = OWNER via member invite
    if (role === OrganizationRole.OWNER) {
        throw new AuthorizationError("FORBIDDEN", "Cannot assign OWNER role to invited members");
    }

    // 3. Server-side resource limit enforcement
    await assertResourceLimit(org.id, "maxMembers");

    // 4. Resolve target user
    const targetUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
    });

    if (!targetUser) {
        throw new AuthorizationError(
            "FORBIDDEN",
            `User with email "${email}" does not have a Halo account. Ask them to register first.`
        );
    }

    if (targetUser.organizationId === org.id) {
        throw new AuthorizationError("FORBIDDEN", "This user is already the owner of this organization.");
    }

    // Check existing membership
    const existing = await prisma.organizationMember.findUnique({
        where: {
            organizationId_userId: {
                organizationId: org.id,
                userId: targetUser.id,
            },
        },
    });

    if (existing) {
        if (existing.status === MembershipStatus.ACTIVE) {
            throw new AuthorizationError("FORBIDDEN", "User is already an active member of this organization.");
        }
        // Reactivate suspended member
        const reactivated = await prisma.organizationMember.update({
            where: { id: existing.id },
            data: { status: MembershipStatus.ACTIVE, role },
        });
        revalidatePath("/settings/members");
        return reactivated;
    }

    const newMember = await prisma.organizationMember.create({
        data: {
            organizationId: org.id,
            userId: targetUser.id,
            role,
            status: MembershipStatus.ACTIVE,
        },
    });

    revalidatePath("/settings/members");
    return newMember;
}

export async function updateMemberRole(
    memberId: string,
    newRole: OrganizationRole
) {
    const { user } = await requireAuthenticatedUser();
    const org = await getOrganization(user.id);
    if (!org) throw new AuthorizationError("ORGANIZATION_NOT_FOUND", "Organization not found");

    // Only OWNER and ADMIN can update roles
    const { membership: requester } = await requireOrganizationRole(
        org.id,
        [OrganizationRole.OWNER, OrganizationRole.ADMIN],
        user.id
    );

    const targetMember = await prisma.organizationMember.findUnique({
        where: { id: memberId },
    });

    if (!targetMember || targetMember.organizationId !== org.id) {
        throw new AuthorizationError("NOT_A_MEMBER", "Target member not found in your organization");
    }

    // Privilege escalation prevention:
    // 1. A member cannot change their own role
    if (targetMember.userId === user.id) {
        throw new AuthorizationError("FORBIDDEN", "You cannot modify your own role");
    }

    // 2. Cannot grant OWNER role
    if (newRole === OrganizationRole.OWNER) {
        throw new AuthorizationError("FORBIDDEN", "Cannot promote member to OWNER");
    }

    // 3. Admins cannot demote or promote other Admins (only OWNER can)
    if (requester.role === OrganizationRole.ADMIN && targetMember.role === OrganizationRole.ADMIN) {
        throw new AuthorizationError("FORBIDDEN", "Only Organization Owners can modify Admin roles");
    }

    const updated = await prisma.organizationMember.update({
        where: { id: memberId },
        data: { role: newRole },
    });

    revalidatePath("/settings/members");
    return updated;
}

export async function removeOrganizationMember(memberId: string) {
    const { user } = await requireAuthenticatedUser();
    const org = await getOrganization(user.id);
    if (!org) throw new AuthorizationError("ORGANIZATION_NOT_FOUND", "Organization not found");

    const { membership: requester } = await requireOrganizationRole(
        org.id,
        [OrganizationRole.OWNER, OrganizationRole.ADMIN],
        user.id
    );

    // If attempting to remove owner
    if (memberId.startsWith("owner-")) {
        throw new AuthorizationError("FORBIDDEN", "Organization Owner cannot be removed from the organization");
    }

    const targetMember = await prisma.organizationMember.findUnique({
        where: { id: memberId },
    });

    if (!targetMember || targetMember.organizationId !== org.id) {
        throw new AuthorizationError("NOT_A_MEMBER", "Member not found in your organization");
    }

    // Admins cannot remove other Admins (only OWNER can)
    if (requester.role === OrganizationRole.ADMIN && targetMember.role === OrganizationRole.ADMIN) {
        throw new AuthorizationError("FORBIDDEN", "Only Organization Owners can remove Admin members");
    }

    await prisma.organizationMember.delete({
        where: { id: memberId },
    });

    revalidatePath("/settings/members");
    return { success: true };
}
