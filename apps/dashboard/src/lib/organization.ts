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

  const organization = await prisma.organization.create({
    data: {
      name: `${user.name}'s Organization`,
      slug: slugify(`${user.name}-${user.id.slice(0, 6)}`),
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