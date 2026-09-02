"use server";

import { getSession } from "@/lib/session";
import { getOrganization } from "@/lib/organization";
import {
    queryCanonicalServices,
    queryCanonicalDependencies,
    type CanonicalService,
    type ServiceDependencyNode,
    type ServiceDependencyEdge,
    type ServicesFilterParams,
    type HealthStatus,
} from "@/lib/services/service-registry";
import { prisma } from "@/lib/prisma";

// Legacy compatibility type
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

export async function getServicesInventory(params: ServicesFilterParams = {}) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    let orgId = params.organizationId;
    if (!orgId) {
        const organization = await getOrganization(session.user.id);
        if (!organization) {
            return {
                services: [],
                summary: { total: 0, healthy: 0, degraded: 0, critical: 0, unknown: 0 },
                timeRange: { key: "24h", start: new Date(), end: new Date() },
            };
        }
        orgId = organization.id;
    }

    return queryCanonicalServices({
        ...params,
        organizationId: orgId,
    });
}

// Legacy getServices method redirected to canonical registry
export async function getServices(): Promise<ServiceSummary[]> {
    const { services } = await getServicesInventory();
    return services.map((s) => ({
        service: s.name,
        projectId: s.projectId,
        projectName: s.projectName,
        errorCount: s.metrics.errorCount,
        traceCount: s.metrics.dependencyCount,
        logCount: Math.max(0, s.metrics.requestCount - s.metrics.errorCount),
        totalCount: s.metrics.requestCount,
        errorRate: s.metrics.errorRate ?? 0,
        lastSeen: s.lastSeen,
        health: s.health.toLowerCase() as ServiceSummary["health"],
    }));
}

export async function getServiceHealthView(params: ServicesFilterParams = {}) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    let orgId = params.organizationId;
    if (!orgId) {
        const organization = await getOrganization(session.user.id);
        if (!organization) {
            return {
                services: [],
                summary: { total: 0, healthy: 0, degraded: 0, critical: 0, unknown: 0 },
                timeRange: { key: "24h", start: new Date(), end: new Date() },
            };
        }
        orgId = organization.id;
    }

    return queryCanonicalServices({
        ...params,
        organizationId: orgId,
    });
}

export async function getServiceDependenciesView(params: ServicesFilterParams = {}) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    let orgId = params.organizationId;
    if (!orgId) {
        const organization = await getOrganization(session.user.id);
        if (!organization) {
            return {
                nodes: [],
                edges: [],
                timeRange: { key: "24h", start: new Date(), end: new Date() },
            };
        }
        orgId = organization.id;
    }

    return queryCanonicalDependencies({
        ...params,
        organizationId: orgId,
    });
}

export async function getServiceDetail(
    serviceId: string,
    params: { timeRangeKey?: string; environment?: string; organizationId?: string } = {}
): Promise<{
    service: CanonicalService;
    upstreamDependencies: Array<{ service: string; callCount: number; errorRate: number | null; avgLatencyMs: number | null }>;
    downstreamDependencies: Array<{ service: string; type: string; callCount: number; errorRate: number | null; avgLatencyMs: number | null }>;
    recentReleases: Array<{ id: string; version: string; commitSha: string | null; createdAt: Date }>;
    recentIssues: Array<{ id: string; title: string; severity: string; status: string; eventCount: number; lastSeen: Date }>;
} | null> {
    let orgId = params.organizationId;
    if (!orgId) {
        const session = await getSession();
        if (!session) throw new Error("Unauthorized");

        const organization = await getOrganization(session.user.id);
        if (!organization) return null;
        orgId = organization.id;
    }

    const cleanServiceName = decodeURIComponent(serviceId).split("::")[0];

    const { services } = await queryCanonicalServices({
        organizationId: orgId,
        search: cleanServiceName,
        timeRangeKey: params.timeRangeKey,
        environment: params.environment,
    });

    const service = services.find((s) => s.name.toLowerCase() === cleanServiceName.toLowerCase()) || services[0];
    if (!service) return null;

    // Get dependencies
    const { edges, nodes } = await queryCanonicalDependencies({
        organizationId: orgId,
        projectId: service.projectId,
        timeRangeKey: params.timeRangeKey,
        environment: params.environment,
    });

    const upstreamDependencies = edges
        .filter((e) => e.target.toLowerCase() === service.name.toLowerCase())
        .map((e) => ({
            service: e.source,
            callCount: e.callCount,
            errorRate: e.errorRate,
            avgLatencyMs: e.avgLatencyMs,
        }));

    const downstreamDependencies = edges
        .filter((e) => e.source.toLowerCase() === service.name.toLowerCase())
        .map((e) => {
            const targetNode = nodes.find((n) => n.name === e.target);
            return {
                service: e.target,
                type: targetNode ? targetNode.type : "service",
                callCount: e.callCount,
                errorRate: e.errorRate,
                avgLatencyMs: e.avgLatencyMs,
            };
        });

    const [recentReleases, recentIssues] = await Promise.all([
        prisma.release.findMany({
            where: { projectId: service.projectId },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { id: true, version: true, commitSha: true, createdAt: true },
        }),
        prisma.issue.findMany({
            where: {
                projectId: service.projectId,
                OR: [
                    { title: { contains: service.name, mode: "insensitive" } },
                    { status: "OPEN" },
                ],
            },
            orderBy: { lastSeen: "desc" },
            take: 5,
            select: { id: true, title: true, severity: true, status: true, eventCount: true, lastSeen: true },
        }),
    ]);

    return {
        service,
        upstreamDependencies,
        downstreamDependencies,
        recentReleases,
        recentIssues,
    };
}
