"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getOrganization, ensureOrganization } from "@/lib/organization";
import { revalidatePath } from "next/cache";
import type { MonitorType, MonitorStatus, MonitorSeverity } from "@/generated/prisma/client";

export type OrgMonitor = {
    id: string;
    name: string;
    description: string | null;
    type: MonitorType;
    status: MonitorStatus;
    severity: MonitorSeverity;
    projectId: string;
    projectName: string;
    environmentId: string | null;
    creatorId: string | null;
    creatorName: string | null;
    thresholdValue: number | null;
    thresholdWindow: number | null;
    query: string | null;
    cronSchedule: string | null;
    endpointUrl: string | null;
    lastTriggeredAt: Date | null;
    lastEvaluatedAt: Date | null;
    incidentCount: number;
    alertConfig: any | null;
    createdAt: Date;
    updatedAt: Date;
};

export type GetMonitorsParams = {
    projectId?: string;
    type?: MonitorType | "ALL";
    status?: MonitorStatus | "ALL";
    search?: string;
    sortBy?: "lastEvaluatedAt" | "name" | "type" | "status" | "createdAt";
    sortOrder?: "asc" | "desc";
    page?: number;
    pageSize?: number;
    creatorId?: string;
};

export type GetMonitorsResult = {
    monitors: OrgMonitor[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
    counts: {
        all: number;
        firing: number;
        healthy: number;
        muted: number;
        disabled: number;
    };
};

export async function getOrgMonitors(params: GetMonitorsParams = {}): Promise<GetMonitorsResult> {
    const session = await getSession();
    if (!session) {
        return {
            monitors: [],
            totalCount: 0,
            page: 1,
            pageSize: params.pageSize || 20,
            totalPages: 0,
            counts: { all: 0, firing: 0, healthy: 0, muted: 0, disabled: 0 },
        };
    }

    let organization = await getOrganization(session.user.id);
    if (!organization) {
        organization = await ensureOrganization(session.user.id);
    }
    if (!organization) {
        return {
            monitors: [],
            totalCount: 0,
            page: 1,
            pageSize: params.pageSize || 20,
            totalPages: 0,
            counts: { all: 0, firing: 0, healthy: 0, muted: 0, disabled: 0 },
        };
    }

    const {
        projectId,
        type,
        status,
        search,
        sortBy = "lastEvaluatedAt",
        sortOrder = "desc",
        page = 1,
        pageSize = 20,
        creatorId,
    } = params;

    // Base organization project filter
    const whereClause: any = {
        project: {
            organizationId: organization.id,
        },
    };

    if (projectId && projectId !== "ALL") {
        whereClause.projectId = projectId;
    }

    if (type && type !== "ALL") {
        whereClause.type = type;
    }

    if (status && status !== "ALL") {
        whereClause.status = status;
    }

    if (creatorId) {
        whereClause.creatorId = creatorId;
    }

    if (search && search.trim()) {
        const queryTerm = search.trim();
        whereClause.OR = [
            { name: { contains: queryTerm, mode: "insensitive" } },
            { description: { contains: queryTerm, mode: "insensitive" } },
            { query: { contains: queryTerm, mode: "insensitive" } },
            { endpointUrl: { contains: queryTerm, mode: "insensitive" } },
        ];
    }

    // Build orderBy
    const orderBy: any = {};
    if (sortBy === "name") {
        orderBy.name = sortOrder;
    } else if (sortBy === "type") {
        orderBy.type = sortOrder;
    } else if (sortBy === "status") {
        orderBy.status = sortOrder;
    } else if (sortBy === "createdAt") {
        orderBy.createdAt = sortOrder;
    } else {
        orderBy.updatedAt = sortOrder;
    }

    const skip = Math.max(0, (page - 1) * pageSize);

    const [totalCount, rawMonitors, allCount, firingCount, healthyCount, mutedCount, disabledCount] = await Promise.all([
        prisma.monitor.count({ where: whereClause }),
        prisma.monitor.findMany({
            where: whereClause,
            include: {
                project: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                    },
                },
                creator: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy,
            skip,
            take: pageSize,
        }),
        prisma.monitor.count({
            where: {
                project: { organizationId: organization.id },
                ...(projectId && projectId !== "ALL" ? { projectId } : {}),
            },
        }),
        prisma.monitor.count({
            where: {
                project: { organizationId: organization.id },
                ...(projectId && projectId !== "ALL" ? { projectId } : {}),
                status: "FIRING",
            },
        }),
        prisma.monitor.count({
            where: {
                project: { organizationId: organization.id },
                ...(projectId && projectId !== "ALL" ? { projectId } : {}),
                status: "HEALTHY",
            },
        }),
        prisma.monitor.count({
            where: {
                project: { organizationId: organization.id },
                ...(projectId && projectId !== "ALL" ? { projectId } : {}),
                status: "MUTED",
            },
        }),
        prisma.monitor.count({
            where: {
                project: { organizationId: organization.id },
                ...(projectId && projectId !== "ALL" ? { projectId } : {}),
                status: "DISABLED",
            },
        }),
    ]);

    const monitors: OrgMonitor[] = rawMonitors.map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        type: m.type,
        status: m.status,
        severity: m.severity,
        projectId: m.projectId,
        projectName: m.project.name,
        environmentId: m.environmentId,
        creatorId: m.creatorId,
        creatorName: m.creator?.name || null,
        thresholdValue: m.thresholdValue,
        thresholdWindow: m.thresholdWindow,
        query: m.query,
        cronSchedule: m.cronSchedule,
        endpointUrl: m.endpointUrl,
        lastTriggeredAt: m.lastTriggeredAt,
        lastEvaluatedAt: m.lastEvaluatedAt,
        incidentCount: m.incidentCount,
        alertConfig: m.alertConfig,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
    }));

    return {
        monitors,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize) || 1,
        counts: {
            all: allCount,
            firing: firingCount,
            healthy: healthyCount,
            muted: mutedCount,
            disabled: disabledCount,
        },
    };
}

export async function getMonitorById(id: string): Promise<OrgMonitor | null> {
    const session = await getSession();
    if (!session) return null;

    const organization = await getOrganization(session.user.id);
    if (!organization) return null;

    const m = await prisma.monitor.findFirst({
        where: {
            id,
            project: {
                organizationId: organization.id,
            },
        },
        include: {
            project: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                },
            },
            creator: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });

    if (!m) return null;

    return {
        id: m.id,
        name: m.name,
        description: m.description,
        type: m.type,
        status: m.status,
        severity: m.severity,
        projectId: m.projectId,
        projectName: m.project.name,
        environmentId: m.environmentId,
        creatorId: m.creatorId,
        creatorName: m.creator?.name || null,
        thresholdValue: m.thresholdValue,
        thresholdWindow: m.thresholdWindow,
        query: m.query,
        cronSchedule: m.cronSchedule,
        endpointUrl: m.endpointUrl,
        lastTriggeredAt: m.lastTriggeredAt,
        lastEvaluatedAt: m.lastEvaluatedAt,
        incidentCount: m.incidentCount,
        alertConfig: m.alertConfig,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
    };
}

export type CreateMonitorInput = {
    name: string;
    description?: string;
    type: MonitorType;
    severity?: MonitorSeverity;
    projectId: string;
    environmentId?: string;
    thresholdValue?: number;
    thresholdWindow?: number;
    query?: string;
    cronSchedule?: string;
    endpointUrl?: string;
    alertConfig?: any;
};

export async function createMonitor(data: CreateMonitorInput): Promise<OrgMonitor> {
    const session = await getSession();
    if (!session) {
        throw new Error("You must be logged in to create a monitor.");
    }

    const organization = await getOrganization(session.user.id);
    if (!organization) {
        throw new Error("Organization not found.");
    }

    // Verify project belongs to organization
    const project = await prisma.project.findFirst({
        where: {
            id: data.projectId,
            organizationId: organization.id,
        },
    });

    if (!project) {
        throw new Error("Invalid project selected.");
    }

    const created = await prisma.monitor.create({
        data: {
            name: data.name.trim(),
            description: data.description?.trim() || null,
            type: data.type,
            status: "HEALTHY",
            severity: data.severity || "ERROR",
            projectId: data.projectId,
            environmentId: data.environmentId || null,
            creatorId: session.user.id,
            thresholdValue: data.thresholdValue || null,
            thresholdWindow: data.thresholdWindow || null,
            query: data.query?.trim() || null,
            cronSchedule: data.cronSchedule?.trim() || null,
            endpointUrl: data.endpointUrl?.trim() || null,
            alertConfig: data.alertConfig || null,
            lastEvaluatedAt: new Date(),
        },
        include: {
            project: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                },
            },
            creator: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });

    revalidatePath("/monitors");
    revalidatePath(`/projects/${data.projectId}`);

    return {
        id: created.id,
        name: created.name,
        description: created.description,
        type: created.type,
        status: created.status,
        severity: created.severity,
        projectId: created.projectId,
        projectName: created.project.name,
        environmentId: created.environmentId,
        creatorId: created.creatorId,
        creatorName: created.creator?.name || null,
        thresholdValue: created.thresholdValue,
        thresholdWindow: created.thresholdWindow,
        query: created.query,
        cronSchedule: created.cronSchedule,
        endpointUrl: created.endpointUrl,
        lastTriggeredAt: created.lastTriggeredAt,
        lastEvaluatedAt: created.lastEvaluatedAt,
        incidentCount: created.incidentCount,
        alertConfig: created.alertConfig,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
    };
}

export async function toggleMonitorStatus(id: string, status: MonitorStatus): Promise<boolean> {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) throw new Error("Unauthorized");

    await prisma.monitor.updateMany({
        where: {
            id,
            project: {
                organizationId: organization.id,
            },
        },
        data: {
            status,
            updatedAt: new Date(),
        },
    });

    revalidatePath("/monitors");
    return true;
}

export async function updateMonitor(id: string, data: Partial<CreateMonitorInput>): Promise<OrgMonitor> {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) throw new Error("Unauthorized");

    const existing = await prisma.monitor.findFirst({
        where: {
            id,
            project: { organizationId: organization.id },
        },
    });

    if (!existing) throw new Error("Monitor not found.");

    const updated = await prisma.monitor.update({
        where: { id },
        data: {
            name: data.name !== undefined ? data.name.trim() : undefined,
            description: data.description !== undefined ? data.description.trim() || null : undefined,
            type: data.type,
            severity: data.severity,
            projectId: data.projectId,
            environmentId: data.environmentId,
            thresholdValue: data.thresholdValue,
            thresholdWindow: data.thresholdWindow,
            query: data.query !== undefined ? data.query.trim() || null : undefined,
            cronSchedule: data.cronSchedule !== undefined ? data.cronSchedule.trim() || null : undefined,
            endpointUrl: data.endpointUrl !== undefined ? data.endpointUrl.trim() || null : undefined,
            alertConfig: data.alertConfig,
            updatedAt: new Date(),
        },
        include: {
            project: { select: { id: true, name: true, slug: true } },
            creator: { select: { id: true, name: true, email: true } },
        },
    });

    revalidatePath("/monitors");
    revalidatePath(`/monitors/${id}`);
    return {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        type: updated.type,
        status: updated.status,
        severity: updated.severity,
        projectId: updated.projectId,
        projectName: updated.project.name,
        environmentId: updated.environmentId,
        creatorId: updated.creatorId,
        creatorName: updated.creator?.name || null,
        thresholdValue: updated.thresholdValue,
        thresholdWindow: updated.thresholdWindow,
        query: updated.query,
        cronSchedule: updated.cronSchedule,
        endpointUrl: updated.endpointUrl,
        lastTriggeredAt: updated.lastTriggeredAt,
        lastEvaluatedAt: updated.lastEvaluatedAt,
        incidentCount: updated.incidentCount,
        alertConfig: updated.alertConfig,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
    };
}

export async function deleteMonitor(id: string): Promise<boolean> {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) throw new Error("Unauthorized");

    await prisma.monitor.deleteMany({
        where: {
            id,
            project: {
                organizationId: organization.id,
            },
        },
    });

    revalidatePath("/monitors");
    return true;
}

export type RelatedIssueSummary = {
    id: string;
    title: string;
    fingerprint: string;
    severity: string;
    status: string;
    eventCount: number;
    lastSeen: Date;
};

export type RelatedReleaseSummary = {
    id: string;
    version: string;
    errorCount: number;
    eventCount: number;
    lastSeen: Date;
};

export type MonitorTimelineEvent = {
    id: string;
    type: "CREATED" | "ALERT_TRIGGERED" | "ALERT_ACKNOWLEDGED" | "ALERT_RESOLVED" | "EVALUATED";
    timestamp: Date;
    title: string;
    description: string;
    alertId?: string;
    status?: string;
};

export type MonitorFullDetails = {
    monitor: OrgMonitor;
    alerts: Array<{
        id: string;
        monitorId: string;
        status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
        triggeredAt: Date;
        acknowledgedAt: Date | null;
        resolvedAt: Date | null;
        conditionSummary: string;
        observedValue: number | null;
        thresholdValue: number | null;
        notes: string | null;
        createdAt: Date;
        updatedAt: Date;
        notificationCount: number;
        deliveredCount: number;
        failedCount: number;
    }>;
    stats: {
        totalAlerts: number;
        openAlerts: number;
        acknowledgedAlerts: number;
        resolvedAlerts: number;
        lastTriggeredAt: Date | null;
        lastResolvedAt: Date | null;
        lastEvaluatedAt: Date | null;
    };
    relatedIssues: RelatedIssueSummary[];
    relatedReleases: RelatedReleaseSummary[];
    timelineEvents: MonitorTimelineEvent[];
};

export async function getMonitorFullDetails(id: string): Promise<MonitorFullDetails | null> {
    const session = await getSession();
    if (!session) return null;

    const organization = await getOrganization(session.user.id);
    if (!organization) return null;

    const m = await prisma.monitor.findFirst({
        where: {
            id,
            project: {
                organizationId: organization.id,
            },
        },
        include: {
            project: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                },
            },
            creator: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            alerts: {
                orderBy: {
                    triggeredAt: "desc",
                },
                include: {
                    notifications: {
                        select: {
                            id: true,
                            channel: true,
                            outcome: true,
                        },
                    },
                },
            },
        },
    });

    if (!m) return null;

    const monitor: OrgMonitor = {
        id: m.id,
        name: m.name,
        description: m.description,
        type: m.type,
        status: m.status,
        severity: m.severity,
        projectId: m.projectId,
        projectName: m.project.name,
        environmentId: m.environmentId,
        creatorId: m.creatorId,
        creatorName: m.creator?.name || null,
        thresholdValue: m.thresholdValue,
        thresholdWindow: m.thresholdWindow,
        query: m.query,
        cronSchedule: m.cronSchedule,
        endpointUrl: m.endpointUrl,
        lastTriggeredAt: m.lastTriggeredAt,
        lastEvaluatedAt: m.lastEvaluatedAt,
        incidentCount: m.incidentCount,
        alertConfig: m.alertConfig,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
    };

    const alerts = m.alerts.map((a) => ({
        id: a.id,
        monitorId: a.monitorId,
        status: a.status,
        triggeredAt: a.triggeredAt,
        acknowledgedAt: a.acknowledgedAt,
        resolvedAt: a.resolvedAt,
        conditionSummary: a.conditionSummary,
        observedValue: a.observedValue,
        thresholdValue: a.thresholdValue,
        notes: a.notes,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
        notificationCount: a.notifications.length,
        deliveredCount: a.notifications.filter((n) => n.outcome === "DELIVERED").length,
        failedCount: a.notifications.filter((n) => n.outcome === "FAILED").length,
    }));

    // Calculate stats from actual persisted alert records
    const openAlerts = alerts.filter((a) => a.status === "OPEN").length;
    const acknowledgedAlerts = alerts.filter((a) => a.status === "ACKNOWLEDGED").length;
    const resolvedAlerts = alerts.filter((a) => a.status === "RESOLVED").length;
    const resolvedDates = alerts.map((a) => a.resolvedAt).filter((d): d is Date => d !== null);
    const lastResolvedAt = resolvedDates.length > 0 ? resolvedDates[0] : null;

    // Fetch related issues from the same project
    let issueWhere: any = { projectId: m.projectId };
    if (m.query && m.query.trim()) {
        issueWhere = {
            projectId: m.projectId,
            OR: [
                { title: { contains: m.query.trim(), mode: "insensitive" } },
                { fingerprint: { contains: m.query.trim(), mode: "insensitive" } },
            ],
        };
    }

    const rawIssues = await prisma.issue.findMany({
        where: issueWhere,
        take: 5,
        orderBy: { lastSeen: "desc" },
        select: {
            id: true,
            title: true,
            fingerprint: true,
            severity: true,
            status: true,
            eventCount: true,
            lastSeen: true,
        },
    });

    const relatedIssues: RelatedIssueSummary[] = rawIssues.map((i) => ({
        id: i.id,
        title: i.title,
        fingerprint: i.fingerprint,
        severity: i.severity,
        status: i.status,
        eventCount: i.eventCount,
        lastSeen: i.lastSeen,
    }));

    // Fetch recent releases from this project
    const rawReleases = await prisma.release.findMany({
        where: { projectId: m.projectId },
        take: 5,
        orderBy: { lastSeen: "desc" },
        select: {
            id: true,
            version: true,
            errorCount: true,
            eventCount: true,
            lastSeen: true,
        },
    });

    const relatedReleases: RelatedReleaseSummary[] = rawReleases.map((r) => ({
        id: r.id,
        version: r.version,
        errorCount: r.errorCount,
        eventCount: r.eventCount,
        lastSeen: r.lastSeen,
    }));

    // Build chronological lifecycle timeline
    const timelineEvents: MonitorTimelineEvent[] = [];

    // 1. Creation event
    timelineEvents.push({
        id: `created-${m.id}`,
        type: "CREATED",
        timestamp: m.createdAt,
        title: "Monitor Created",
        description: `Configured as ${m.type} monitor${m.creator?.name ? ` by ${m.creator.name}` : ""}`,
    });

    // 2. Alert events
    for (const a of alerts) {
        timelineEvents.push({
            id: `alert-trig-${a.id}`,
            type: "ALERT_TRIGGERED",
            timestamp: a.triggeredAt,
            title: `Alert Triggered`,
            description: a.conditionSummary,
            alertId: a.id,
            status: a.status,
        });

        if (a.acknowledgedAt) {
            timelineEvents.push({
                id: `alert-ack-${a.id}`,
                type: "ALERT_ACKNOWLEDGED",
                timestamp: a.acknowledgedAt,
                title: "Alert Acknowledged",
                description: a.notes ? `Acknowledged with notes: "${a.notes}"` : "Alert acknowledged by operator",
                alertId: a.id,
                status: "ACKNOWLEDGED",
            });
        }

        if (a.resolvedAt) {
            timelineEvents.push({
                id: `alert-res-${a.id}`,
                type: "ALERT_RESOLVED",
                timestamp: a.resolvedAt,
                title: "Alert Resolved",
                description: "Issue resolved and monitor condition returned to normal",
                alertId: a.id,
                status: "RESOLVED",
            });
        }
    }

    // 3. Evaluation event if available and no recent alert at exact time
    if (m.lastEvaluatedAt) {
        timelineEvents.push({
            id: `eval-${m.id}`,
            type: "EVALUATED",
            timestamp: m.lastEvaluatedAt,
            title: "Last Evaluation",
            description: `Evaluated status: ${m.status}`,
            status: m.status,
        });
    }

    // Sort timeline descending
    timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
        monitor,
        alerts,
        stats: {
            totalAlerts: alerts.length,
            openAlerts,
            acknowledgedAlerts,
            resolvedAlerts,
            lastTriggeredAt: m.lastTriggeredAt || (alerts.length > 0 ? alerts[0].triggeredAt : null),
            lastResolvedAt,
            lastEvaluatedAt: m.lastEvaluatedAt,
        },
        relatedIssues,
        relatedReleases,
        timelineEvents,
    };
}

