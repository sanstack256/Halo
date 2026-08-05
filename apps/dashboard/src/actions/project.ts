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

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        name,
        description,
        slug,
        organizationId: organization.id,
      },
    });

    await tx.environment.create({
      data: {
        name: "Production",
        projectId: project.id,
      },
    });

    return project;
  });
}

export async function getProjects() {
  const session = await getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  const organization = await getOrganization(session.user.id);

  if (!organization) {
    return [];
  }

  return prisma.project.findMany({
    where: {
      organizationId: organization.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getProject(projectId: string) {
  const session = await getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  const organization = await getOrganization(session.user.id);

  if (!organization) {
    throw new Error("Organization not found");
  }

  return prisma.project.findFirst({
    where: {
      id: projectId,
      organizationId: organization.id,
    },
    include: {
      environments: true,
      events: true,
    },
  });
}

export async function getProjectHeader(projectId: string) {
    const session = await getSession();

    if (!session) {
        throw new Error("Unauthorized");
    }

    const organization = await getOrganization(session.user.id);

    if (!organization) {
        throw new Error("Organization not found");
    }

    return prisma.project.findFirst({
        where: {
            id: projectId,
            organizationId: organization.id,
        },
        select: {
            id: true,
            name: true,
            description: true,
        },
    });
}