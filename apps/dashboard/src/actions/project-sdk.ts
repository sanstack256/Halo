"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getProject } from "@/actions/project";
import { createEvent } from "@/actions/event";

export interface ProjectSdkStatus {
    hasApiKey: boolean;
    apiKeys: Array<{
        id: string;
        name: string;
        prefix: string;
        createdAt: Date;
    }>;
    hasTelemetry: boolean;
    latestEvent: {
        id: string;
        type: string;
        severity: string;
        title: string;
        timestamp: string;
    } | null;
    hasReplay: boolean;
    latestReplay: {
        id: string;
        sessionId: string;
        totalDurationMs: number | null;
        createdAt: Date;
        status: string;
    } | null;
    totalEvents: number;
    totalReplays: number;
}

export async function getProjectSdkStatus(projectId: string): Promise<ProjectSdkStatus> {
    const session = await getSession();
    if (!session) {
        throw new Error("Unauthorized");
    }

    const project = await getProject(projectId);
    if (!project) {
        throw new Error("Project not found");
    }

    const [apiKeys, eventsCount, latestEvents, replaysCount, latestReplays] = await Promise.all([
        prisma.apiKey.findMany({
            where: { projectId: project.id },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                prefix: true,
                createdAt: true,
            },
        }),
        prisma.event.count({
            where: { projectId: project.id },
        }),
        prisma.event.findMany({
            where: { projectId: project.id },
            orderBy: { timestamp: "desc" },
            take: 1,
            select: {
                id: true,
                type: true,
                severity: true,
                title: true,
                timestamp: true,
            },
        }),
        prisma.replaySession.count({
            where: { projectId: project.id },
        }),
        prisma.replaySession.findMany({
            where: { projectId: project.id },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
                id: true,
                sessionId: true,
                totalDurationMs: true,
                createdAt: true,
                status: true,
            },
        }),
    ]);

    const latestEvent = latestEvents.length > 0 ? {
        id: latestEvents[0].id,
        type: latestEvents[0].type,
        severity: latestEvents[0].severity,
        title: latestEvents[0].title,
        timestamp: latestEvents[0].timestamp.toISOString(),
    } : null;

    const latestReplay = latestReplays.length > 0 ? {
        id: latestReplays[0].id,
        sessionId: latestReplays[0].sessionId,
        totalDurationMs: latestReplays[0].totalDurationMs,
        createdAt: latestReplays[0].createdAt,
        status: latestReplays[0].status,
    } : null;

    return {
        hasApiKey: apiKeys.length > 0,
        apiKeys,
        hasTelemetry: eventsCount > 0,
        latestEvent,
        hasReplay: replaysCount > 0,
        latestReplay,
        totalEvents: eventsCount,
        totalReplays: replaysCount,
    };
}

export async function triggerSdkVerificationEvent(projectId: string): Promise<{ success: boolean; eventId?: string }> {
    const session = await getSession();
    if (!session) {
        throw new Error("Unauthorized");
    }

    const project = await getProject(projectId);
    if (!project) {
        throw new Error("Project not found");
    }

    const environment = project.environments?.[0];
    if (!environment) {
        throw new Error("No environment found for project");
    }

    const event = await createEvent({
        type: "MESSAGE",
        severity: "INFO",
        title: "Halo SDK Connection Verification",
        message: "Real-time connection verification event dispatched from Halo dashboard.",
        service: "dashboard-verifier",
        timestamp: new Date().toISOString(),
        projectId: project.id,
        environmentId: environment.id,
        metadata: {
            source: "dashboard_sdk_verification_flow",
            verifiedBy: session.user.id,
            clientTimestamp: Date.now(),
        },
    });

    return {
        success: true,
        eventId: event.id,
    };
}
