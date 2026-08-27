import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

export async function getOrganization(userId: string) {
    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
        include: {
            organization: true,
        },
    });

    return user?.organization ?? null;
}

export async function ensureOrganization(userId: string) {
    const existing = await getOrganization(userId);

    if (existing) {
        return existing;
    }

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    });

    if (!user) {
        throw new Error("User not found.");
    }

    const displayName = user.name?.trim() || user.email?.split("@")[0] || "My Workspace";
    const baseSlug = slugify(displayName) || "org";
    const uniqueSlug = `${baseSlug}-${user.id.slice(0, 8)}`;

    try {
        const organization = await prisma.organization.create({
            data: {
                name: `${displayName}'s Organization`,
                slug: uniqueSlug,
            },
        });

        await prisma.user.update({
            where: {
                id: user.id,
            },
            data: {
                organizationId: organization.id,
            },
        });

        return organization;
    } catch {
        // In case of race condition or existing slug, fetch fresh user organization
        const refreshed = await getOrganization(userId);
        if (refreshed) {
            return refreshed;
        }

        // Retry with timestamp suffix if slug collided
        const fallbackSlug = `${baseSlug}-${user.id.slice(0, 6)}-${Date.now().toString(36)}`;
        const organization = await prisma.organization.create({
            data: {
                name: `${displayName}'s Organization`,
                slug: fallbackSlug,
            },
        });

        await prisma.user.update({
            where: {
                id: user.id,
            },
            data: {
                organizationId: organization.id,
            },
        });

        return organization;
    }
}