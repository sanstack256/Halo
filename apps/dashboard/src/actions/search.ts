"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getOrganization } from "@/lib/organization";

export type SearchResultItem = {
    id: string;
    type: "issue" | "service" | "project" | "log" | "trace";
    title: string;
    subtitle: string;
    href: string;
    timestamp?: Date | null;
    meta?: string;
};

export async function universalSearch(query: string): Promise<SearchResultItem[]> {
    const session = await getSession();
    if (!session) return [];

    const organization = await getOrganization(session.user.id);
    if (!organization) return [];

    const trimmed = query.trim();
    if (!trimmed) return [];

    const projects = await prisma.project.findMany({
        where: { organizationId: organization.id },
        select: { id: true, name: true, slug: true },
    });

    if (projects.length === 0) return [];
    const projectIds = projects.map((p) => p.id);
    const projectMap = new Map(projects.map((p) => [p.id, p.name]));

    const [matchedProjects, matchedIssues, matchedEvents] = await Promise.all([
        // Projects
        prisma.project.findMany({
            where: {
                organizationId: organization.id,
                OR: [
                    { name: { contains: trimmed, mode: "insensitive" } },
                    { slug: { contains: trimmed, mode: "insensitive" } },
                ],
            },
            take: 5,
        }),

        // Issues
        prisma.issue.findMany({
            where: {
                projectId: { in: projectIds },
                title: { contains: trimmed, mode: "insensitive" },
            },
            orderBy: { lastSeen: "desc" },
            take: 8,
        }),

        // Events / Logs / Traces
        prisma.event.findMany({
            where: {
                projectId: { in: projectIds },
                OR: [
                    { title: { contains: trimmed, mode: "insensitive" } },
                    { message: { contains: trimmed, mode: "insensitive" } },
                    { service: { contains: trimmed, mode: "insensitive" } },
                ],
            },
            orderBy: { timestamp: "desc" },
            take: 10,
        }),
    ]);

    const results: SearchResultItem[] = [];

    // Map projects
    for (const p of matchedProjects) {
        results.push({
            id: `proj-${p.id}`,
            type: "project",
            title: p.name,
            subtitle: `Project · /${p.slug}`,
            href: `/projects/${p.id}`,
        });
    }

    // Map issues
    for (const issue of matchedIssues) {
        results.push({
            id: `issue-${issue.id}`,
            type: "issue",
            title: issue.title,
            subtitle: `${projectMap.get(issue.projectId) ?? "Project"} · ${issue.eventCount} occurrences · ${issue.severity}`,
            href: `/projects/${issue.projectId}/issues/${issue.id}`,
            timestamp: issue.lastSeen,
            meta: issue.severity,
        });
    }

    // Map events
    for (const ev of matchedEvents) {
        const isTrace = ev.type === "TRACE";
        const isLog = ev.type === "LOG";
        results.push({
            id: `ev-${ev.id}`,
            type: isTrace ? "trace" : isLog ? "log" : "issue",
            title: ev.title || ev.message || "Telemetry Event",
            subtitle: `${ev.service ?? "service"} · ${projectMap.get(ev.projectId) ?? ""}`,
            href: `/projects/${ev.projectId}/events/${ev.id}`,
            timestamp: ev.timestamp,
            meta: ev.type,
        });
    }

    return results;
}
