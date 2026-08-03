"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getOrganization } from "@/lib/organization";
import { slugify } from "@/lib/slug";

export async function createProject(
  name: string,
  description?: string
) {
  const session = await getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  const organization = await getOrganization(session.user.id);

  if (!organization) {
    throw new Error("Organization not found");
  }

  const baseSlug = slugify(name);

  let slug = baseSlug;
  let count = 1;

  while (
    await prisma.project.findFirst({
      where: {
        organizationId: organization.id,
        slug,
      },
    })
  ) {
    slug = `${baseSlug}-${count++}`;
  }

  return prisma.project.create({
    data: {
      name,
      description,
      slug,
      organizationId: organization.id,
    },
  });
}