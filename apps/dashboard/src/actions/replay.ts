"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { checkFeature, getUserOrgEntitlements } from "@/lib/entitlements";

const REPLAY_SESSION_INCLUDE = {
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
            sequence: "asc" as const,
        },
    },
};

export async function getReplaySessionForIssue(issueId: string, eventId?: string) {
    if (!issueId) return null;

    // 1. Direct Issue Association
    let replay = await prisma.replaySession.findFirst({
        where: {
            issueId,
            status: { in: ["AVAILABLE", "RECORDING", "PROCESSING"] },
        },
        include: REPLAY_SESSION_INCLUDE,
        orderBy: {
            createdAt: "desc",
        },
    });

    if (replay) return replay;

    // 2. Specific Event Association (if eventId is provided)
    if (eventId) {
        const anchorEvent = await prisma.event.findUnique({
            where: { id: eventId },
            select: {
                id: true,
                sessionId: true,
                traceId: true,
                requestId: true,
                timestamp: true,
                projectId: true,
            },
        });

        if (anchorEvent) {
            // 2a. Match by anchor event's session/trace/request IDs
            const orConditions: any[] = [];
            if (anchorEvent.sessionId) orConditions.push({ sessionId: anchorEvent.sessionId });
            if (anchorEvent.traceId) orConditions.push({ traceId: anchorEvent.traceId });
            if (anchorEvent.requestId) orConditions.push({ requestId: anchorEvent.requestId });

            if (orConditions.length > 0) {
                replay = await prisma.replaySession.findFirst({
                    where: {
                        projectId: anchorEvent.projectId,
                        OR: orConditions,
                        status: { in: ["AVAILABLE", "RECORDING", "PROCESSING"] },
                    },
                    include: REPLAY_SESSION_INCLUDE,
                    orderBy: { createdAt: "desc" },
                });
            }

            // 2b. Temporal Proximity in the same project
            if (!replay) {
                const eventTime = anchorEvent.timestamp;
                replay = await prisma.replaySession.findFirst({
                    where: {
                        projectId: anchorEvent.projectId,
                        status: { in: ["AVAILABLE", "RECORDING", "PROCESSING"] },
                        OR: [
                            {
                                startedAt: {
                                    gte: new Date(eventTime.getTime() - 10 * 60000),
                                    lte: new Date(eventTime.getTime() + 2 * 60000),
                                },
                            },
                            {
                                errorAt: {
                                    gte: new Date(eventTime.getTime() - 5 * 60000),
                                    lte: new Date(eventTime.getTime() + 5 * 60000),
                                },
                            },
                        ],
                    },
                    include: REPLAY_SESSION_INCLUDE,
                    orderBy: { createdAt: "desc" },
                });
            }
        }
    }

    // 3. Issue Events Correlation (match by any event in the issue)
    if (!replay) {
        const issue = await prisma.issue.findUnique({
            where: { id: issueId },
            include: {
                events: {
                    select: {
                        sessionId: true,
                        traceId: true,
                        requestId: true,
                        timestamp: true,
                    },
                    take: 50,
                    orderBy: { timestamp: "desc" },
                },
            },
        });

        if (issue) {
            const sessionIds = issue.events
                .map((e) => e.sessionId)
                .filter((s): s is string => Boolean(s));

            const traceIds = issue.events
                .map((e) => e.traceId)
                .filter((t): t is string => Boolean(t));

            const requestIds = issue.events
                .map((e) => e.requestId)
                .filter((r): r is string => Boolean(r));

            const orConditions: any[] = [];
            if (sessionIds.length > 0) orConditions.push({ sessionId: { in: sessionIds } });
            if (traceIds.length > 0) orConditions.push({ traceId: { in: traceIds } });
            if (requestIds.length > 0) orConditions.push({ requestId: { in: requestIds } });

            if (orConditions.length > 0) {
                replay = await prisma.replaySession.findFirst({
                    where: {
                        projectId: issue.projectId,
                        OR: orConditions,
                        status: { in: ["AVAILABLE", "RECORDING", "PROCESSING"] },
                    },
                    include: REPLAY_SESSION_INCLUDE,
                    orderBy: {
                        createdAt: "desc",
                    },
                });
            }

            // 4. Project-scoped temporal fallback matching the issue's activity window
            if (!replay && issue.events.length > 0) {
                const latestTime = issue.lastSeen || issue.events[0].timestamp;
                const earliestTime = issue.firstSeen || issue.events[issue.events.length - 1].timestamp;

                replay = await prisma.replaySession.findFirst({
                    where: {
                        projectId: issue.projectId,
                        status: { in: ["AVAILABLE", "RECORDING", "PROCESSING"] },
                        OR: [
                            {
                                startedAt: {
                                    gte: new Date(earliestTime.getTime() - 10 * 60000),
                                    lte: new Date(latestTime.getTime() + 5 * 60000),
                                },
                            },
                            {
                                errorAt: {
                                    gte: new Date(earliestTime.getTime() - 5 * 60000),
                                    lte: new Date(latestTime.getTime() + 5 * 60000),
                                },
                            },
                        ],
                    },
                    include: REPLAY_SESSION_INCLUDE,
                    orderBy: { createdAt: "desc" },
                });
            }
        }
    }

    // If an unlinked replay was correlated, link it to the issue for future instant retrieval
    if (replay && !replay.issueId) {
        try {
            await prisma.replaySession.update({
                where: { id: replay.id },
                data: { issueId },
            });
            replay.issueId = issueId;
        } catch {
            // ignore concurrent update
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
