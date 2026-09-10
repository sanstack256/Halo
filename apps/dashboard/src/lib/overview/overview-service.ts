/**
 * Canonical Overview Service.
 *
 * Single server-side collection boundary for Halo Overview.
 * - Single source of truth for attention and orientation
 * - Reuses canonical calculations and service registry
 * - Strictly tenant-isolated
 * - Eliminates duplicate queries and hardcoded metrics
 */

import { prisma } from "../prisma";
import {
    AttentionItem,
    prioritizeAttentionItems,
    summarizeAttention,
    AttentionSummary,
} from "./attention-model";
import { queryCanonicalServices } from "../services/service-registry";

export interface OverviewObservedState {
    totalProjects: number;
    activeIssuesCount: number;
    observedServicesCount: number;
    recentDeploymentsCount: number;
    recentErrorEvents: number | null; // null if unobserved
    telemetryObserved: boolean;
}

export interface CanonicalOverviewData {
    projects: Array<{ id: string; name: string; slug: string }>;
    attentionItems: AttentionItem[];
    attentionSummary: AttentionSummary;
    observedState: OverviewObservedState;
    serviceHealthSummary: {
        total: number;
        healthy: number;
        degraded: number;
        critical: number;
        unknown: number;
    };
}

export interface LoadOverviewParams {
    organizationId: string;
    projectId?: string;
    timeWindowMs?: number;
}

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function loadCanonicalOverview(params: LoadOverviewParams): Promise<CanonicalOverviewData> {
    const { organizationId, projectId, timeWindowMs = DEFAULT_WINDOW_MS } = params;

    // 1. Fetch authorized projects
    const projects = await prisma.project.findMany({
        where: {
            organizationId,
            ...(projectId ? { id: projectId } : {}),
        },
        select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
        },
        orderBy: { name: "asc" },
    });

    if (projects.length === 0) {
        return emptyOverviewData();
    }

    const projectIds = projects.map((p) => p.id);
    const projectMap = new Map(projects.map((p) => [p.id, p.name]));
    const since = new Date(Date.now() - timeWindowMs);

    // 2. Single consolidated query layer
    const [
        totalOpenIssuesCount,
        openIssues,
        recentReleases,
        recentInvestigations,
        recentErrorEvents,
        allEventsCount,
        canonicalServicesData,
    ] = await Promise.all([
        // Total open issues count
        prisma.issue.count({
            where: { projectId: { in: projectIds }, status: "OPEN" },
        }).catch(() => 0),

        // Open issues for attention items (prioritizing fatal and high-frequency)
        prisma.issue.findMany({
            where: { projectId: { in: projectIds }, status: "OPEN" },
            orderBy: [{ severity: "desc" }, { eventCount: "desc" }],
            take: 6,
            include: {
                events: {
                    take: 1,
                    orderBy: { timestamp: "desc" },
                    select: { service: true, requestId: true },
                },
            },
        }).catch(() => []),

        // Recent releases
        prisma.release.findMany({
            where: { projectId: { in: projectIds } },
            orderBy: { firstSeen: "desc" },
            take: 5,
            select: {
                id: true,
                version: true,
                projectId: true,
                firstSeen: true,
                errorCount: true,
            },
        }).catch(() => []),

        // Real investigations
        prisma.investigation.findMany({
            where: { projectId: { in: projectIds } },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
                id: true,
                title: true,
                issueId: true,
                projectId: true,
                status: true,
                summary: true,
                rootCause: true,
                confidenceScore: true,
                updatedAt: true,
            },
        }).catch(() => []),

        // Error events in time window
        prisma.event.count({
            where: {
                projectId: { in: projectIds },
                type: "ERROR",
                timestamp: { gte: since },
            },
        }).catch(() => 0),

        // All events in time window
        prisma.event.count({
            where: {
                projectId: { in: projectIds },
                timestamp: { gte: since },
            },
        }).catch(() => 0),

        // Canonical services inventory
        queryCanonicalServices({
            organizationId,
            projectId,
            timeRangeKey: "24h",
        }).catch(() => ({
            services: [],
            summary: { total: 0, healthy: 0, degraded: 0, critical: 0, unknown: 0 },
            timeRange: { key: "24h", start: since, end: new Date() },
        })),
    ]);

    // 3. Derive Attention Items strictly from real observations
    const attentionItems: AttentionItem[] = [];

    // 3a. Open issues requiring attention
    for (const issue of openIssues.slice(0, 3)) {
        const isFatal = issue.severity === "FATAL";
        const serviceName = issue.events[0]?.service || projectMap.get(issue.projectId) || "Unknown Service";
        attentionItems.push({
            id: `att-issue-${issue.id}`,
            type: "ISSUE",
            severity: isFatal ? "FATAL" : "ERROR",
            title: issue.title,
            summary: `${issue.eventCount} occurrence${issue.eventCount === 1 ? "" : "s"} observed in service ${serviceName}`,
            source: serviceName,
            timestamp: issue.lastSeen,
            destination: `/projects/${issue.projectId}/issues/${issue.id}`,
            evidenceReference: {
                entityId: issue.id,
                entityType: "issue",
                metricValue: `${issue.eventCount} occurrences`,
                explanation: `Active ${issue.severity.toLowerCase()} issue in ${serviceName}`,
            },
            status: issue.status,
        });
    }

    // 3b. Releases with correlated errors (Suspicious deployments)
    const suspiciousReleases = recentReleases.filter((r) => r.errorCount > 0);
    for (const rel of suspiciousReleases.slice(0, 2)) {
        const projName = projectMap.get(rel.projectId) || "Project";
        attentionItems.push({
            id: `att-change-${rel.id}`,
            type: "CHANGE",
            severity: "WARNING",
            title: `Release ${rel.version} correlated with errors`,
            summary: `${rel.errorCount} correlated error${rel.errorCount === 1 ? "" : "s"} observed since deployment in ${projName}`,
            source: projName,
            timestamp: rel.firstSeen,
            destination: `/dashboards/changes?projectId=${rel.projectId}`,
            evidenceReference: {
                entityId: rel.id,
                entityType: "release",
                metricValue: `${rel.errorCount} errors`,
                explanation: `Correlated with deployment ${rel.version}`,
            },
            status: "Suspicious",
        });
    }

    // 3c. Investigations: active or concluded with identified root causes
    const notableInvestigations = recentInvestigations.filter(
        (inv) => inv.rootCause !== null || inv.status === "RUNNING"
    );
    for (const inv of notableInvestigations.slice(0, 2)) {
        const projName = projectMap.get(inv.projectId) || "Project";
        attentionItems.push({
            id: `att-inv-${inv.id}`,
            type: "INVESTIGATION",
            severity: inv.status === "RUNNING" ? "WARNING" : "INFO",
            title: inv.rootCause ? `Root cause identified: ${inv.rootCause}` : inv.title,
            summary: inv.summary || (inv.status === "RUNNING" ? "Autonomous investigation in progress" : "Investigation concluded"),
            source: projName,
            timestamp: inv.updatedAt,
            destination: inv.issueId
                ? `/projects/${inv.projectId}/investigations/new?issueId=${inv.issueId}`
                : `/investigate`,
            evidenceReference: {
                entityId: inv.id,
                entityType: "investigation",
                metricValue: inv.confidenceScore !== null
                    ? `${Math.round(inv.confidenceScore > 1 ? inv.confidenceScore : inv.confidenceScore * 100)}% confidence`
                    : undefined,
                explanation: inv.rootCause || "Investigation report",
            },
            status: inv.status,
        });
    }

    // 3d. Telemetry Gap: If zero events observed across projects, surface SDK onboarding
    const hasObservedTelemetry = allEventsCount > 0 || openIssues.length > 0 || recentReleases.length > 0;
    if (!hasObservedTelemetry && projects.length > 0) {
        const firstProj = projects[0];
        attentionItems.push({
            id: `att-gap-${firstProj.id}`,
            type: "TELEMETRY_GAP",
            severity: "INFO",
            title: "No active telemetry observed",
            summary: `Install the Halo SDK in ${firstProj.name} to stream errors and enable autonomous investigations`,
            source: firstProj.name,
            timestamp: firstProj.createdAt,
            destination: `/projects/${firstProj.id}/sdk`,
            evidenceReference: {
                entityId: firstProj.id,
                entityType: "project",
                explanation: "Project onboarding pending telemetry ingestion",
            },
            status: "Pending Setup",
        });
    }

    const prioritized = prioritizeAttentionItems(attentionItems);
    const attentionSummary = summarizeAttention(prioritized);

    return {
        projects: projects.map((p) => ({ id: p.id, name: p.name, slug: p.slug })),
        attentionItems: prioritized,
        attentionSummary,
        observedState: {
            totalProjects: projects.length,
            activeIssuesCount: totalOpenIssuesCount,
            observedServicesCount: canonicalServicesData.services.length,
            recentDeploymentsCount: recentReleases.length,
            recentErrorEvents: allEventsCount > 0 ? recentErrorEvents : null,
            telemetryObserved: hasObservedTelemetry,
        },
        serviceHealthSummary: canonicalServicesData.summary,
    };
}

export function emptyOverviewData(): CanonicalOverviewData {
    return {
        projects: [],
        attentionItems: [],
        attentionSummary: {
            totalItems: 0,
            fatalCount: 0,
            errorCount: 0,
            warningCount: 0,
            hasGaps: false,
        },
        observedState: {
            totalProjects: 0,
            activeIssuesCount: 0,
            observedServicesCount: 0,
            recentDeploymentsCount: 0,
            recentErrorEvents: null,
            telemetryObserved: false,
        },
        serviceHealthSummary: {
            total: 0,
            healthy: 0,
            degraded: 0,
            critical: 0,
            unknown: 0,
        },
    };
}
