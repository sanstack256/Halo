"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { checkFeature, getUserOrgEntitlements } from "@/lib/entitlements";

export async function getReplaySessionForIssue(issueId: string) {
    if (!issueId) return null;

    // Check if there's a ReplaySession directly linked to this issueId or matching its sessionId
    let replay = await prisma.replaySession.findFirst({
        where: {
            issueId,
            status: { in: ["AVAILABLE", "RECORDING", "PROCESSING"] },
        },
        include: {
            chunks: {
                select: {
                    id: true,
                    sequence: true,
                    eventCount: true,
                    startedAt: true,
                    endedAt: true,
                },
                orderBy: {
                    sequence: "asc",
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    if (!replay) {
        // Fallback: check if the issue's events have a sessionId matching a ReplaySession
        const issue = await prisma.issue.findUnique({
            where: { id: issueId },
            include: {
                events: {
                    where: { sessionId: { not: null } },
                    select: { sessionId: true },
                    take: 5,
                },
            },
        });

        if (issue?.events && issue.events.length > 0) {
            const sessionIds = issue.events
                .map((e) => e.sessionId)
                .filter((s): s is string => Boolean(s));

            if (sessionIds.length > 0) {
                replay = await prisma.replaySession.findFirst({
                    where: {
                        sessionId: { in: sessionIds },
                        status: { in: ["AVAILABLE", "RECORDING", "PROCESSING"] },
                    },
                    include: {
                        chunks: {
                            select: {
                                id: true,
                                sequence: true,
                                eventCount: true,
                                startedAt: true,
                                endedAt: true,
                            },
                            orderBy: {
                                sequence: "asc",
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                });
            }
        }
    }

    return replay;
}

export async function getReplaySession(replaySessionId: string) {
    if (!replaySessionId) return null;

    return prisma.replaySession.findUnique({
        where: { id: replaySessionId },
        include: {
            project: {
                select: {
                    id: true,
                    name: true,
                    organizationId: true,
                },
            },
            chunks: {
                select: {
                    id: true,
                    sequence: true,
                    eventCount: true,
                    startedAt: true,
                    endedAt: true,
                    sizeBytes: true,
                },
                orderBy: {
                    sequence: "asc",
                },
            },
        },
    });
}

export async function getReplayEvents(replaySessionId: string) {
    if (!replaySessionId) return [];

    const chunks = await prisma.replayChunk.findMany({
        where: { replaySessionId },
        orderBy: { sequence: "asc" },
        select: {
            events: true,
            sequence: true,
        },
    });

    const allEvents: any[] = [];
    for (const chunk of chunks) {
        if (Array.isArray(chunk.events)) {
            allEvents.push(...chunk.events);
        }
    }

    return allEvents;
}

export async function getProjectReplays(projectId: string) {
    if (!projectId) return [];

    return prisma.replaySession.findMany({
        where: { projectId },
        orderBy: { startedAt: "desc" },
        take: 50,
        include: {
            issue: {
                select: {
                    id: true,
                    title: true,
                    severity: true,
                },
            },
        },
    });
}

export async function updateProjectReplayConfig(projectId: string, config: any) {
    const session = await getSession();

    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const featureCheck = await checkFeature(session.user.id, "sessionReplay");
    if (!featureCheck.allowed) {
        throw new Error("Session Replay configuration is not available on your plan.");
    }

    return prisma.project.update({
        where: { id: projectId },
        data: {
            replayConfig: config,
        },
    });
}
