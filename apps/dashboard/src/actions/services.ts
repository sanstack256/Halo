"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getOrganization } from "@/lib/organization";

export type ServiceSummary = {
    service: string;
    projectId: string;
    projectName: string;
    errorCount: number;
    traceCount: number;
    logCount: number;
    totalCount: number;
    errorRate: number;
    lastSeen: Date | null;
    health: "healthy" | "degraded" | "critical" | "unknown";
};

export async function getServices(): Promise<ServiceSummary[]> {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) return [];

    const projects = await prisma.project.findMany({
        where: { organizationId: organization.id },
        select: { id: true, name: true },
    });

    if (projects.length === 0) return [];

    const projectIds = projects.map((p) => p.id);
    const projectMap = new Map(projects.map((p) => [p.id, p.name]));

    const rows = await prisma.event.groupBy({
        by: ["service", "projectId", "type"],
        where: {
            projectId: { in: projectIds },
            service: { not: null },
        },
        _count: { id: true },
        _max: { timestamp: true },
    });

    type ServiceKey = `${string}::${string}`;
    const serviceMap = new Map<
        ServiceKey,
        {
            service: string;
            projectId: string;
            errorCount: number;
            traceCount: number;
            logCount: number;
            totalCount: number;
            lastSeen: Date | null;
        }
    >();

    for (const row of rows) {
        if (!row.service) continue;
        const key: ServiceKey = `${row.service}::${row.projectId}`;
        const existing = serviceMap.get(key) ?? {
            service: row.service,
            projectId: row.projectId,
            errorCount: 0,
            traceCount: 0,
            logCount: 0,
            totalCount: 0,
            lastSeen: null,
        };

        existing.totalCount += row._count.id;

        if (row.type === "ERROR") existing.errorCount += row._count.id;
        else if (row.type === "TRACE") existing.traceCount += row._count.id;
        else existing.logCount += row._count.id;

        const ts = row._max.timestamp;
        if (ts && (!existing.lastSeen || ts > existing.lastSeen)) {
            existing.lastSeen = ts;
        }

        serviceMap.set(key, existing);
    }

    return Array.from(serviceMap.values())
        .map((s) => {
            const errorRate =
                s.totalCount > 0
                    ? (s.errorCount / s.totalCount) * 100
                    : 0;
            const health: ServiceSummary["health"] =
                s.totalCount === 0
                    ? "unknown"
                    : errorRate >= 20
                      ? "critical"
                      : errorRate >= 5
                        ? "degraded"
                        : "healthy";
            return {
                service: s.service,
                projectId: s.projectId,
                projectName: projectMap.get(s.projectId) ?? "Unknown",
                errorCount: s.errorCount,
                traceCount: s.traceCount,
                logCount: s.logCount,
                totalCount: s.totalCount,
                errorRate: Math.round(errorRate * 10) / 10,
                lastSeen: s.lastSeen,
                health,
            };
        })
        .sort((a, b) => b.totalCount - a.totalCount);
}
