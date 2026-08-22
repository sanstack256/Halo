"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getOrganization } from "@/lib/organization";

export async function getLogs(options?: { projectId?: string; service?: string; limit?: number }) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) return [];

    const projects = await prisma.project.findMany({
        where: { organizationId: organization.id },
        select: { id: true, name: true },
    });
    if (projects.length === 0) return [];

    const projectIds = options?.projectId ? [options.projectId] : projects.map((p) => p.id);
    const projectMap = new Map(projects.map((p) => [p.id, p.name]));

    const events = await prisma.event.findMany({
        where: {
            projectId: { in: projectIds },
            type: { in: ["LOG", "MESSAGE"] },
            ...(options?.service ? { service: options.service } : {}),
        },
        orderBy: { timestamp: "desc" },
        take: options?.limit ?? 100,
    });

    return events.map((e) => ({
        ...e,
        projectName: projectMap.get(e.projectId) ?? "Unknown",
    }));
}

export async function getTraces(options?: { projectId?: string; service?: string; limit?: number }) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) return [];

    const projects = await prisma.project.findMany({
        where: { organizationId: organization.id },
        select: { id: true, name: true },
    });
    if (projects.length === 0) return [];

    const projectIds = options?.projectId ? [options.projectId] : projects.map((p) => p.id);
    const projectMap = new Map(projects.map((p) => [p.id, p.name]));

    const events = await prisma.event.findMany({
        where: {
            projectId: { in: projectIds },
            type: "TRACE",
            ...(options?.service ? { service: options.service } : {}),
        },
        orderBy: { timestamp: "desc" },
        take: options?.limit ?? 100,
    });

    return events.map((e) => ({
        ...e,
        projectName: projectMap.get(e.projectId) ?? "Unknown",
    }));
}

export async function getErrors(options?: { projectId?: string; service?: string; limit?: number }) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) return [];

    const projects = await prisma.project.findMany({
        where: { organizationId: organization.id },
        select: { id: true, name: true },
    });
    if (projects.length === 0) return [];

    const projectIds = options?.projectId ? [options.projectId] : projects.map((p) => p.id);
    const projectMap = new Map(projects.map((p) => [p.id, p.name]));

    const events = await prisma.event.findMany({
        where: {
            projectId: { in: projectIds },
            type: "ERROR",
            ...(options?.service ? { service: options.service } : {}),
        },
        orderBy: { timestamp: "desc" },
        take: options?.limit ?? 100,
    });

    return events.map((e) => ({
        ...e,
        projectName: projectMap.get(e.projectId) ?? "Unknown",
    }));
}

export async function getRequests(options?: { projectId?: string; limit?: number }) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) return [];

    const projects = await prisma.project.findMany({
        where: { organizationId: organization.id },
        select: { id: true, name: true },
    });
    if (projects.length === 0) return [];

    const projectIds = options?.projectId ? [options.projectId] : projects.map((p) => p.id);
    const projectMap = new Map(projects.map((p) => [p.id, p.name]));

    const events = await prisma.event.findMany({
        where: {
            projectId: { in: projectIds },
            requestId: { not: null },
        },
        orderBy: { timestamp: "desc" },
        take: options?.limit ?? 100,
    });

    return events.map((e) => ({
        ...e,
        projectName: projectMap.get(e.projectId) ?? "Unknown",
    }));
}
