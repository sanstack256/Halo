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

  const projects = await prisma.project.findMany({
    where: {
      organizationId: organization.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      _count: {
        select: {
          events: true,
          issues: true,
        },
      },

      events: {
        orderBy: {
          timestamp: "desc",
        },
        take: 1,
        select: {
          timestamp: true,
        },
      },

      issues: {
        where: {
          status: "OPEN",
        },
        select: {
          id: true,
        },
      },
    },
  });

  return projects.map((project) => ({
    id: project.id,

    name: project.name,

    description: project.description,

    createdAt: project.createdAt,

    eventCount: project._count.events,

    openIssueCount: project.issues.length,

    lastEventAt:
      project.events.length > 0
        ? project.events[0].timestamp
        : null,
  }));
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