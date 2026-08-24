"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getOrganization } from "@/lib/organization";
import { revalidatePath } from "next/cache";

export async function updateProjectSettings(
    projectId: string,
    data: {
        name?: string;
        slug?: string;
        description?: string;
    }
) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) throw new Error("Organization not found");

    const updated = await prisma.project.update({
        where: {
            id: projectId,
            organizationId: organization.id,
        },
        data: {
            ...(data.name ? { name: data.name } : {}),
            ...(data.slug ? { slug: data.slug } : {}),
            ...(data.description ? { description: data.description } : {}),
        },
    });

    revalidatePath("/settings");
    revalidatePath("/projects");
    return updated;
}

export async function updateOrganizationSettings(data: { name: string }) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) throw new Error("Organization not found");

    const updated = await prisma.organization.update({
        where: { id: organization.id },
        data: { name: data.name },
    });

    revalidatePath("/settings");
    return updated;
}

export async function revokeApiKey(keyId: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    await prisma.apiKey.delete({
        where: { id: keyId },
    });

    revalidatePath("/settings");
    return { success: true };
}

export async function getUserPlan() {
    try {
        const session = await getSession();
        if (!session?.user?.id) return { planId: "FREE", planName: "Free Plan" };

        const organization = await getOrganization(session.user.id);
        if (!organization) return { planId: "FREE", planName: "Free Plan" };

        const plan = (organization as any).plan || "FREE";
        const nameMap: Record<string, string> = {
            FREE: "Free Plan",
            DEVELOPER: "Developer Plan",
            TEAM: "Team Plan",
        };

        return {
            planId: plan,
            planName: nameMap[plan] || "Developer Plan",
        };
    } catch {
        return { planId: "FREE", planName: "Free Plan" };
    }
}
