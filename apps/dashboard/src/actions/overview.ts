"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getOrganization } from "@/lib/organization";

const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 h

export type HaloDiscovery = {
    id: string;
    title: string;
    summary: string;
    confidence: "Low" | "Medium" | "High" | "Very High";
    /** Nullable: actual investigation confidenceScore from the DB, or null if not computed */
    confidenceScore: number | null;
    supportingEvidenceCount: number;
    contradictingEvidenceCount: number;
    suspectedRootCause: string | null;
    issueId: string | null;
    projectId: string;
    projectName: string;
    service: string | null;
    historicalPattern: string | null;
    timestamp: Date;
};

export type RecentChange = {
    id: string;
    version: string;
    /**
     * "deployment" is the only type Halo can infer from Release records.
     * Do not fabricate "config", "feature_flag", or "dependency" types
     * unless the schema carries a real type discriminator.
     */
    type: "deployment";
    projectName: string;
    projectId: string;
    timestamp: Date;
    correlatedErrors: number;
    status: "suspicious" | "stable";
};

export type ActiveIncident = {
    id: string;
    title: string;
    severity: "FATAL" | "ERROR" | "WARNING" | "INFO";
    eventCount: number;
    /**
     * Describes verified occurrence count.  NOT a fabricated request-impact estimate.
     * Callers that want a traffic-level estimate must compute it from real event telemetry.
     */
    occurrenceDescription: string;
    service: string | null;
    projectName: string;
    projectId: string;
    lastSeen: Date;
    status: string;
};

export type RecentInvestigation = {
    id: string;
    title: string;
    issueId: string | null;
    projectId: string;
    projectName: string;
    /** Actual status from the Investigation row — never hardcoded. */
    status: string;
    /** True only when rootCause is non-null in the database row. */
    hasRootCause: boolean;
    rootCauseTitle: string | null;
    /**
     * Actual confidence score from the DB, or null when not available.
     * Never fabricated.
     */
    confidenceScore: number | null;
    updatedAt: Date;
};

export type RecentActivityItem = {
    id: string;
    type: "issue_opened" | "deployment" | "investigation_completed";
    title: string;
    subtitle: string;
    timestamp: Date;
    link: string;
    badge?: {
        label: string;
        variant: "error" | "warning" | "success" | "neutral";
    };
};

export type SystemState = {
    activeIssuesCount: number;
    affectedServicesCount: number;
    recentErrors24h: number | null; // null if unobserved
    recentDeploymentsCount: number;
    telemetryObserved: boolean;
};

export type OverviewData = {
    projects: {
        id: string;
        name: string;
    }[];

    needsAttention: {
        openIssuesCount: number;
        fatalCount: number;
        criticalServiceCount: number;
        suspiciousChangeCount: number;
        primaryAlert: {
            title: string;
            service: string | null;
            severity: string;
            /**
             * Actual occurrence count, not a fabricated multiplier estimate.
             */
            occurrenceDescription: string;
            suspectedCause: string;
            issueId: string;
            projectId: string;
        } | null;
    };

    systemHealth: {
        apdexScore: number;
        apdexRating: "Satisfied" | "Tolerating" | "Frustrated";
        errorRate24h: number;
        crashFreeRate: number;
        /** Unique users with errors: derived from errorEvents count when user telemetry absent. */
        impactedUsers24h: number;
        totalErrors24h: number;
        activeServiceCount: number;
    };

    systemState: SystemState;
    recentActivity: RecentActivityItem[];

    discoveries: HaloDiscovery[];
    recentChanges: RecentChange[];
    activeIncidents: ActiveIncident[];
    recentInvestigations: RecentInvestigation[];

    serviceHealth: {
        service: string;
        projectId: string;
        projectName: string;
        errorCount: number;
        totalCount: number;
        errorRate: number;
        lastSeen: Date | null;
        health: "healthy" | "degraded" | "critical";
    }[];
};

export async function getOverviewData(): Promise<OverviewData> {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) {
        return emptyOverview();
    }

    const projects = await prisma.project.findMany({
        where: { organizationId: organization.id },
        select: { id: true, name: true },
    });

    if (projects.length === 0) {
        return emptyOverview();
    }

    const projectIds = projects.map((p) => p.id);
    const projectMap = new Map(projects.map((p) => [p.id, p.name]));

    const since = new Date(Date.now() - RECENT_WINDOW_MS);

    const [
        totalOpenIssuesCount,
        openIssues,
        fatalIssues,
        recentErrorEvents,
        allEvents24h,
        sessions,
        recentReleases,
        serviceEvents,
        recentInvestigationRows,
    ] = await Promise.all([
        // Total open issues count
        prisma.issue.count({
            where: { projectId: { in: projectIds }, status: "OPEN" },
        }),

        // Open issues (for active incidents)
        prisma.issue.findMany({
            where: { projectId: { in: projectIds }, status: "OPEN" },
            orderBy: { eventCount: "desc" },
            take: 10,
            include: {
                events: {
                    take: 1,
                    orderBy: { timestamp: "desc" },
                    select: { service: true, requestId: true },
                },
            },
        }),

        // Fatal open issues count
        prisma.issue.count({
            where: {
                projectId: { in: projectIds },
                status: "OPEN",
                severity: "FATAL",
            },
        }),

        // Error events in last 24h
        prisma.event.count({
            where: {
                projectId: { in: projectIds },
                type: "ERROR",
                timestamp: { gte: since },
            },
        }),

        // Total events in last 24h
        prisma.event.count({
            where: {
                projectId: { in: projectIds },
                timestamp: { gte: since },
            },
        }),

        // Telemetry sessions
        prisma.telemetrySession.findMany({
            where: { projectId: { in: projectIds } },
            select: { crashedAt: true },
        }),

        // Recent releases
        prisma.release.findMany({
            where: { projectId: { in: projectIds } },
            orderBy: { firstSeen: "desc" },
            take: 8,
            select: {
                id: true,
                version: true,
                projectId: true,
                firstSeen: true,
                errorCount: true,
            },
        }),

        // Grouped service telemetry
        prisma.event.groupBy({
            by: ["service", "projectId", "type"],
            where: {
                projectId: { in: projectIds },
                service: { not: null },
            },
            _count: { id: true },
            _max: { timestamp: true },
        }),

        // Real investigations from the Investigation table
        prisma.investigation.findMany({
            where: {
                projectId: { in: projectIds },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
                id: true,
                title: true,
                issueId: true,
                projectId: true,
                status: true,
                summary: true,
                rootCause: true,
                confidenceScore: true,
                createdAt: true,
                updatedAt: true,
            },
        }),
    ]);

    // Service health computation
    type ServiceKey = `${string}::${string}`;
    const serviceMap = new Map<
        ServiceKey,
        {
            service: string;
            projectId: string;
            errorCount: number;
            totalCount: number;
            lastSeen: Date | null;
        }
    >();

    for (const row of serviceEvents) {
        if (!row.service) continue;
        const key: ServiceKey = `${row.service}::${row.projectId}`;
        const existing = serviceMap.get(key) ?? {
            service: row.service,
            projectId: row.projectId,
            errorCount: 0,
            totalCount: 0,
            lastSeen: null,
        };

        existing.totalCount += row._count.id;
        if (row.type === "ERROR") {
            existing.errorCount += row._count.id;
        }
        const ts = row._max.timestamp;
        if (ts && (!existing.lastSeen || ts > existing.lastSeen)) {
            existing.lastSeen = ts;
        }
        serviceMap.set(key, existing);
    }

    const serviceHealthList = Array.from(serviceMap.values()).map((s) => {
        const errorRate = s.totalCount > 0 ? (s.errorCount / s.totalCount) * 100 : 0;
        const health: "healthy" | "degraded" | "critical" =
            errorRate >= 20 ? "critical" : errorRate >= 5 ? "degraded" : "healthy";
        return {
            ...s,
            projectName: projectMap.get(s.projectId) ?? "Unknown",
            errorRate: Math.round(errorRate * 10) / 10,
            health,
        };
    });

    const criticalServiceCount = serviceHealthList.filter(
        (s) => s.health === "critical"
    ).length;

    // Build Active Incidents list — no fabricated impact multipliers
    const activeIncidents: ActiveIncident[] = openIssues.map((issue) => {
        const serviceName = issue.events[0]?.service ?? null;
        const occurrenceDescription = `${issue.eventCount} recorded occurrences`;

        return {
            id: issue.id,
            title: issue.title,
            severity: issue.severity as ActiveIncident["severity"],
            eventCount: issue.eventCount,
            occurrenceDescription,
            service: serviceName,
            projectName: projectMap.get(issue.projectId) ?? "Unknown",
            projectId: issue.projectId,
            lastSeen: issue.lastSeen,
            status: issue.status,
        };
    });

    // Build Needs Attention primary alert — no fabricated impact multipliers
    const primaryIssue = openIssues[0];
    const primaryAlert = primaryIssue
        ? {
              title: primaryIssue.title,
              service: primaryIssue.events[0]?.service ?? null,
              severity: primaryIssue.severity,
              occurrenceDescription: `${primaryIssue.eventCount} recorded occurrences`,
              suspectedCause: primaryIssue.events[0]?.service
                  ? `Failure observed in service: ${primaryIssue.events[0].service}`
                  : "Service attribution unavailable for this issue.",
              issueId: primaryIssue.id,
              projectId: primaryIssue.projectId,
          }
        : null;

    // Build Halo Discoveries from REAL Investigation records
    // Deduplicate repeated/identical investigation results and prioritize highest-relevance items
    const seenDiscoveryKeys = new Set<string>();
    const deduplicatedInvestigations = recentInvestigationRows.filter((inv) => {
        if (!inv.summary && !inv.rootCause) return false;
        // Key deduplication by title + issueId or normalized title
        const normKey = `${inv.title}::${inv.issueId ?? ""}`;
        if (seenDiscoveryKeys.has(normKey)) return false;
        seenDiscoveryKeys.add(normKey);
        return true;
    });

    // Prioritize discoveries: root cause present first, then higher confidence
    deduplicatedInvestigations.sort((a, b) => {
        const aHasRC = a.rootCause ? 1 : 0;
        const bHasRC = b.rootCause ? 1 : 0;
        if (bHasRC !== aHasRC) return bHasRC - aHasRC;
        const aScore = a.confidenceScore ?? 0;
        const bScore = b.confidenceScore ?? 0;
        return bScore - aScore;
    });

    const discoveries: HaloDiscovery[] = deduplicatedInvestigations
        .slice(0, 4) // Show 3-5 high-priority discoveries
        .map((inv) => {
            // Qualitative confidence mapping: Low, Medium, High, Very High
            // Or Insufficient evidence if score is null or summary indicates insufficiency
            const scoreNum = inv.confidenceScore;
            let confidence: HaloDiscovery["confidence"] = "Low";
            if (scoreNum !== null) {
                const normalized = scoreNum > 1 ? scoreNum / 100 : scoreNum;
                if (normalized >= 0.9) confidence = "Very High";
                else if (normalized >= 0.75) confidence = "High";
                else if (normalized >= 0.5) confidence = "Medium";
                else confidence = "Low";
            }

            return {
                id: `disc-${inv.id}`,
                title: inv.title,
                summary: inv.summary ?? inv.rootCause ?? "Investigation completed.",
                confidence,
                confidenceScore: scoreNum,
                supportingEvidenceCount: 0,
                contradictingEvidenceCount: 0,
                suspectedRootCause: inv.rootCause ?? null,
                issueId: inv.issueId ?? null,
                projectId: inv.projectId,
                projectName: projectMap.get(inv.projectId) ?? "Unknown",
                service: null,
                historicalPattern: null,
                timestamp: inv.updatedAt,
            };
        });

    // Build Recent Changes — Release records are always "deployment" type.
    const recentChanges: RecentChange[] = recentReleases.map((rel) => {
        const isSuspicious = rel.errorCount > 0;
        return {
            id: rel.id,
            version: rel.version,
            type: "deployment",
            projectName: projectMap.get(rel.projectId) ?? "Unknown",
            projectId: rel.projectId,
            timestamp: rel.firstSeen,
            correlatedErrors: rel.errorCount,
            status: isSuspicious ? "suspicious" : "stable",
        };
    });

    // Build Recent Investigations from REAL database records.
    const recentInvestigations: RecentInvestigation[] = recentInvestigationRows.map((inv) => ({
        id: inv.id,
        title: inv.title,
        issueId: inv.issueId ?? null,
        projectId: inv.projectId,
        projectName: projectMap.get(inv.projectId) ?? "Unknown",
        status: inv.status,
        hasRootCause: inv.rootCause !== null,
        rootCauseTitle: inv.rootCause ?? null,
        confidenceScore: inv.confidenceScore ?? null,
        updatedAt: inv.updatedAt,
    }));

    // Build Recent Activity Feed (compact event-oriented stream)
    const recentActivityList: RecentActivityItem[] = [];

    // Add recent issues (up to 3)
    for (const issue of openIssues.slice(0, 3)) {
        recentActivityList.push({
            id: `act-issue-${issue.id}`,
            type: "issue_opened",
            title: issue.title,
            subtitle: `${issue.events[0]?.service ? `${issue.events[0].service} • ` : ""}${issue.eventCount} occurrences recorded`,
            timestamp: issue.lastSeen,
            link: `/projects/${issue.projectId}/issues/${issue.id}`,
            badge: {
                label: issue.severity,
                variant: issue.severity === "FATAL" || issue.severity === "ERROR" ? "error" : "warning",
            },
        });
    }

    // Add recent releases (up to 3)
    for (const rel of recentReleases.slice(0, 3)) {
        recentActivityList.push({
            id: `act-rel-${rel.id}`,
            type: "deployment",
            title: `Release ${rel.version} deployed`,
            subtitle: `${projectMap.get(rel.projectId) ?? "Project"}${rel.errorCount > 0 ? ` • ${rel.errorCount} correlated errors` : " • Stable"}`,
            timestamp: rel.firstSeen,
            link: `/explore/errors`,
            badge: {
                label: rel.errorCount > 0 ? "Suspicious" : "Stable",
                variant: rel.errorCount > 0 ? "warning" : "success",
            },
        });
    }

    // Add recent investigations (up to 3)
    for (const inv of recentInvestigationRows.slice(0, 3)) {
        recentActivityList.push({
            id: `act-inv-${inv.id}`,
            type: "investigation_completed",
            title: inv.rootCause ? `Root cause identified: ${inv.rootCause}` : inv.title,
            subtitle: inv.summary ? (inv.summary.length > 80 ? `${inv.summary.slice(0, 80)}...` : inv.summary) : "Autonomous investigation completed",
            timestamp: inv.updatedAt,
            link: inv.issueId
                ? `/projects/${inv.projectId}/investigations/new?issueId=${inv.issueId}`
                : `/projects/${inv.projectId}/investigations/new`,
            badge: {
                label: inv.rootCause ? "Identified" : "Investigated",
                variant: inv.rootCause ? "neutral" : "neutral",
            },
        });
    }

    // Sort combined activity by timestamp descending and take top 5
    recentActivityList.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const recentActivity = recentActivityList.slice(0, 5);

    // Build System State (Compact observed state summary)
    // Avoid fake percentages or misleading 0 fallback when unobserved.
    const hasObservedTelemetry = allEvents24h > 0 || recentReleases.length > 0 || openIssues.length > 0;
    const systemState: SystemState = {
        activeIssuesCount: totalOpenIssuesCount,
        affectedServicesCount: serviceHealthList.length,
        recentErrors24h: allEvents24h > 0 ? recentErrorEvents : null,
        recentDeploymentsCount: recentReleases.length,
        telemetryObserved: hasObservedTelemetry,
    };

    // Operational System Health metrics (kept for backward compatibility with Dashboards page)
    const totalSessions = sessions.length;
    const crashedSessions = sessions.filter((s) => s.crashedAt !== null).length;
    const crashFreeRate =
        totalSessions > 0
            ? Math.round(((totalSessions - crashedSessions) / totalSessions) * 1000) / 10
            : 100;

    const errorRate24h =
        allEvents24h > 0
            ? Math.round((recentErrorEvents / allEvents24h) * 1000) / 10
            : 0;

    const apdexScore =
        allEvents24h === 0
            ? 1.0
            : Math.max(0, Math.round((1 - errorRate24h / 100) * 100) / 100);
    const apdexRating: OverviewData["systemHealth"]["apdexRating"] =
        apdexScore >= 0.94 ? "Satisfied" : apdexScore >= 0.85 ? "Tolerating" : "Frustrated";

    const suspiciousChangeCount = recentChanges.filter((c) => c.status === "suspicious").length;

    return {
        projects,

        needsAttention: {
            openIssuesCount: totalOpenIssuesCount,
            fatalCount: fatalIssues,
            criticalServiceCount,
            suspiciousChangeCount,
            primaryAlert,
        },

        systemHealth: {
            apdexScore,
            apdexRating,
            errorRate24h,
            crashFreeRate,
            impactedUsers24h: recentErrorEvents,
            totalErrors24h: recentErrorEvents,
            activeServiceCount: serviceHealthList.length,
        },

        systemState,
        recentActivity,
        discoveries,
        recentChanges,
        activeIncidents,
        recentInvestigations,
        serviceHealth: serviceHealthList,
    };
}

function emptyOverview(): OverviewData {
    return {
        projects: [],
        needsAttention: {
            openIssuesCount: 0,
            fatalCount: 0,
            criticalServiceCount: 0,
            suspiciousChangeCount: 0,
            primaryAlert: null,
        },
        systemHealth: {
            apdexScore: 1.0,
            apdexRating: "Satisfied",
            errorRate24h: 0,
            crashFreeRate: 100,
            impactedUsers24h: 0,
            totalErrors24h: 0,
            activeServiceCount: 0,
        },
        systemState: {
            activeIssuesCount: 0,
            affectedServicesCount: 0,
            recentErrors24h: null,
            recentDeploymentsCount: 0,
            telemetryObserved: false,
        },
        recentActivity: [],
        discoveries: [],
        recentChanges: [],
        activeIncidents: [],
        recentInvestigations: [],
        serviceHealth: [],
    };
}
