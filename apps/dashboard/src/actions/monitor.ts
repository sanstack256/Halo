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
