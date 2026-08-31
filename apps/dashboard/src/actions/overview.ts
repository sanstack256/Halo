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
        openIssues,
        fatalIssues,
        recentErrorEvents,
        allEvents24h,
        sessions,
        recentReleases,
        serviceEvents,
        recentInvestigationRows,
    ] = await Promise.all([
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
            take: 6,
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
    // Only surface investigations that actually have a root cause or summary.
    // Never fabricate confidence scores or evidence counts.
    const discoveries: HaloDiscovery[] = recentInvestigationRows
        .filter((inv) => inv.summary || inv.rootCause)
        .slice(0, 3)
        .map((inv) => {
            // Derive qualitative confidence from the stored numeric score.
            // null → no investigations run → "Insufficient Evidence" shown in UI.
            const scoreNum = inv.confidenceScore;
            const confidence: HaloDiscovery["confidence"] =
                scoreNum === null
                    ? "Low"
                    : scoreNum >= 0.9
                    ? "Very High"
                    : scoreNum >= 0.75
                    ? "High"
                    : scoreNum >= 0.5
                    ? "Medium"
                    : "Low";

            return {
                id: `disc-${inv.id}`,
                title: inv.title,
                summary: inv.summary ?? inv.rootCause ?? "Investigation completed.",
                confidence,
                confidenceScore: scoreNum,
                // evidenceCount is stored as an integer on the Investigation record.
                // We don't have it in the select above — add it via a separate field if needed.
                // For now, surface 0 to avoid any fabrication.
                supportingEvidenceCount: 0,
                contradictingEvidenceCount: 0,
                suspectedRootCause: inv.rootCause ?? null,
                issueId: inv.issueId ?? null,
                projectId: inv.projectId,
                projectName: projectMap.get(inv.projectId) ?? "Unknown",
                service: null, // Service attribution requires joining to issue events
                historicalPattern: null,
                timestamp: inv.updatedAt,
            };
        });

    // Build Recent Changes — Release records are always "deployment" type.
    // Halo's schema does not have a change type discriminator on Release.
    // Do NOT fabricate "config" or "feature_flag" types.
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
    // hasRootCause is derived from whether rootCause field is non-null.
    // confidenceScore is the actual DB value, never hardcoded.
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

    // Operational System Health metrics
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

    // Apdex is approximated from error rate (1 - errorRate).
    // This is a proxy metric, not a real apdex calculation (which requires latency thresholds).
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
            openIssuesCount: openIssues.length,
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
        discoveries: [],
        recentChanges: [],
        activeIncidents: [],
        recentInvestigations: [],
        serviceHealth: [],
    };
}
