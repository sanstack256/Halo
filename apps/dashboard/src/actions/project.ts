"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getOrganization, ensureOrganization } from "@/lib/organization";
import { slugify } from "@/lib/slug";
import { revalidatePath } from "next/cache";

export async function createProject(
  name: string,
  description?: string
) {
  const session = await getSession();

  if (!session) {
    throw new Error("You must be logged in to create a project.");
  }

  let organization = await getOrganization(session.user.id);

  if (!organization) {
    organization = await ensureOrganization(session.user.id);
  }

  if (!organization) {
    throw new Error("Organization could not be initialized.");
  }

  const baseSlug = slugify(name) || "project";

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

  const project = await prisma.$transaction(async (tx) => {
    const p = await tx.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        slug,
        organizationId: organization.id,
      },
    });

    await tx.environment.create({
      data: {
        name: "Production",
        projectId: p.id,
      },
    });

    return p;
  });

  revalidatePath("/projects");
  revalidatePath("/overview");

  return project;
}

export async function getProjects() {
  const session = await getSession();

  if (!session) {
    return [];
  }

  const organization = await getOrganization(session.user.id);

  if (!organization) {
    return [];
  }

  try {
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
  } catch (err) {
    console.error("Error loading projects:", err);
    return [];
  }
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
      organizationId: true,
    },
  });
}