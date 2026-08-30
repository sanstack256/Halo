"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getOrganization, ensureOrganization } from "@/lib/organization";
import { revalidatePath } from "next/cache";
import type {
    MonitorAlertStatus,
    NotificationChannel,
    NotificationOutcome,
} from "@/generated/prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AlertWithMonitor = {
    id: string;
    monitorId: string;
    monitorName: string;
    monitorType: string;
    projectId: string;
    projectName: string;
    status: MonitorAlertStatus;
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
    investigation?: {
        id: string;
        status: string;
        rootCause: string | null;
        confidenceScore: number | null;
    } | null;
};

export type AlertNotification = {
    id: string;
    alertId: string;
    channel: NotificationChannel;
    destination: string | null;
    outcome: NotificationOutcome;
    failReason: string | null;
    attemptedAt: Date;
};

export type GetAlertsParams = {
    projectId?: string;
    monitorId?: string;
    status?: MonitorAlertStatus | "ALL";
    search?: string;
    sortBy?: "triggeredAt" | "status" | "monitorName";
    sortOrder?: "asc" | "desc";
    page?: number;
    pageSize?: number;
};

export type GetAlertsResult = {
    alerts: AlertWithMonitor[];
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
    counts: {
        all: number;
        open: number;
        acknowledged: number;
        resolved: number;
    };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getOrgAndSession() {
    const session = await getSession();
    if (!session) return { session: null, organization: null };

    let org = await getOrganization(session.user.id);
    if (!org) org = await ensureOrganization(session.user.id);

    return { session, organization: org };
}

// ─────────────────────────────────────────────────────────────────────────────
// Query
// ─────────────────────────────────────────────────────────────────────────────

export async function getOrgAlerts(
    params: GetAlertsParams = {}
): Promise<GetAlertsResult> {
    const empty: GetAlertsResult = {
        alerts: [],
        totalCount: 0,
        page: 1,
        pageSize: params.pageSize ?? 20,
        totalPages: 0,
        counts: { all: 0, open: 0, acknowledged: 0, resolved: 0 },
    };

    const { organization } = await getOrgAndSession();
    if (!organization) return empty;

    const {
        projectId,
        monitorId,
        status,
        search,
        sortBy = "triggeredAt",
        sortOrder = "desc",
        page = 1,
        pageSize = 20,
    } = params;

    const orgBase: any = {
        monitor: {
            project: {
                organizationId: organization.id,
            },
        },
    };

    const whereClause: any = { ...orgBase };

    if (projectId && projectId !== "ALL") {
        whereClause.monitor = {
            ...whereClause.monitor,
            projectId,
        };
    }

    if (monitorId) {
        whereClause.monitorId = monitorId;
    }

    if (status && status !== "ALL") {
        whereClause.status = status;
    }

    if (search?.trim()) {
        whereClause.OR = [
            { conditionSummary: { contains: search.trim(), mode: "insensitive" } },
            { monitor: { name: { contains: search.trim(), mode: "insensitive" } } },
        ];
    }

    const countBase: any = { ...orgBase };
    if (monitorId) countBase.monitorId = monitorId;

    const [statusGroups, totalCount, rawAlerts] = await Promise.all([
        prisma.monitorAlert.groupBy({
            by: ["status"],
            where: countBase,
            _count: true,
        }),
        prisma.monitorAlert.count({ where: whereClause }),
        prisma.monitorAlert.findMany({
            where: whereClause,
            orderBy:
                sortBy === "monitorName"
                    ? { monitor: { name: sortOrder } }
                    : { [sortBy]: sortOrder },
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: {
                monitor: {
                    select: {
                        name: true,
                        type: true,
                        projectId: true,
                        project: { select: { name: true } },
                    },
                },
                notifications: {
                    select: { outcome: true },
                },
                investigation: {
                    select: {
                        id: true,
                        status: true,
                        rootCause: true,
                        confidenceScore: true,
                    },
                },
            },
        }),
    ]);

    const sm = Object.fromEntries(statusGroups.map((c) => [c.status, c._count]));
    const openCount = sm["OPEN"] ?? 0;
    const ackCount = sm["ACKNOWLEDGED"] ?? 0;
    const resolvedCount = sm["RESOLVED"] ?? 0;

    const alerts: AlertWithMonitor[] = rawAlerts.map((a) => ({
        id: a.id,
        monitorId: a.monitorId,
        monitorName: a.monitor.name,
        monitorType: a.monitor.type,
        projectId: a.monitor.projectId,
        projectName: a.monitor.project.name,
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
        investigation: a.investigation || null,
    }));

    return {
        alerts,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        counts: {
            all: openCount + ackCount + resolvedCount,
            open: openCount,
            acknowledged: ackCount,
            resolved: resolvedCount,
        },
    };
}

export async function getAlertById(alertId: string): Promise<{
    alert: AlertWithMonitor | null;
    notifications: AlertNotification[];
}> {
    const { organization } = await getOrgAndSession();
    if (!organization) return { alert: null, notifications: [] };

    const raw = await prisma.monitorAlert.findFirst({
        where: {
            id: alertId,
            monitor: { project: { organizationId: organization.id } },
        },
        include: {
            monitor: {
                select: {
                    name: true,
                    type: true,
                    projectId: true,
                    project: { select: { name: true } },
                },
            },
            notifications: {
                orderBy: { attemptedAt: "desc" },
            },
            investigation: {
                select: {
                    id: true,
                    status: true,
                    rootCause: true,
                    confidenceScore: true,
                },
            },
        },
    });

    if (!raw) return { alert: null, notifications: [] };

    const alert: AlertWithMonitor = {
        id: raw.id,
        monitorId: raw.monitorId,
        monitorName: raw.monitor.name,
        monitorType: raw.monitor.type,
        projectId: raw.monitor.projectId,
        projectName: raw.monitor.project.name,
        status: raw.status,
        triggeredAt: raw.triggeredAt,
        acknowledgedAt: raw.acknowledgedAt,
        resolvedAt: raw.resolvedAt,
        conditionSummary: raw.conditionSummary,
        observedValue: raw.observedValue,
        thresholdValue: raw.thresholdValue,
        notes: raw.notes,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
        notificationCount: raw.notifications.length,
        deliveredCount: raw.notifications.filter((n) => n.outcome === "DELIVERED").length,
        failedCount: raw.notifications.filter((n) => n.outcome === "FAILED").length,
        investigation: raw.investigation || null,
    };

    const notifications: AlertNotification[] = raw.notifications.map((n) => ({
        id: n.id,
        alertId: n.alertId,
        channel: n.channel,
        destination: n.destination,
        outcome: n.outcome,
        failReason: n.failReason,
        attemptedAt: n.attemptedAt,
    }));

    return { alert, notifications };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

export async function acknowledgeAlert(
    alertId: string,
    notes?: string
): Promise<{ success: boolean; error?: string }> {
    const { organization } = await getOrgAndSession();
    if (!organization) return { success: false, error: "Not authenticated" };

    const alert = await prisma.monitorAlert.findFirst({
        where: { id: alertId, monitor: { project: { organizationId: organization.id } } },
    });

    if (!alert) return { success: false, error: "Alert not found" };
    if (alert.status !== "OPEN")
        return { success: false, error: "Only OPEN alerts can be acknowledged" };

    await prisma.monitorAlert.update({
        where: { id: alertId },
        data: {
            status: "ACKNOWLEDGED",
            acknowledgedAt: new Date(),
            ...(notes ? { notes } : {}),
        },
    });

    revalidatePath("/monitors/alerts");
    revalidatePath(`/monitors/alerts/${alertId}`);
    revalidatePath("/monitors");

    return { success: true };
}

export async function resolveAlert(
    alertId: string,
    notes?: string
): Promise<{ success: boolean; error?: string }> {
    const { organization } = await getOrgAndSession();
    if (!organization) return { success: false, error: "Not authenticated" };

    const alert = await prisma.monitorAlert.findFirst({
        where: { id: alertId, monitor: { project: { organizationId: organization.id } } },
    });

    if (!alert) return { success: false, error: "Alert not found" };
    if (alert.status === "RESOLVED")
        return { success: false, error: "Alert is already resolved" };

    await prisma.monitorAlert.update({
        where: { id: alertId },
        data: {
            status: "RESOLVED",
            resolvedAt: new Date(),
            ...(notes ? { notes } : {}),
        },
    });

    // Recover monitor to HEALTHY if no other open/acknowledged alerts remain
    const stillOpen = await prisma.monitorAlert.count({
        where: {
            monitorId: alert.monitorId,
            status: { in: ["OPEN", "ACKNOWLEDGED"] },
        },
    });

    if (stillOpen === 0) {
        await prisma.monitor.update({
            where: { id: alert.monitorId },
            data: { status: "HEALTHY" },
        });
    }

    revalidatePath("/monitors/alerts");
    revalidatePath(`/monitors/alerts/${alertId}`);
    revalidatePath("/monitors");

    return { success: true };
}

export async function updateAlertNotes(
    alertId: string,
    notes: string
): Promise<{ success: boolean; error?: string }> {
    const { organization } = await getOrgAndSession();
    if (!organization) return { success: false, error: "Not authenticated" };

    const alert = await prisma.monitorAlert.findFirst({
        where: { id: alertId, monitor: { project: { organizationId: organization.id } } },
    });

    if (!alert) return { success: false, error: "Alert not found" };

    await prisma.monitorAlert.update({
        where: { id: alertId },
        data: { notes },
    });

    revalidatePath(`/monitors/alerts/${alertId}`);

    return { success: true };
}
