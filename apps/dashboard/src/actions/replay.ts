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

export type ReplayCorrelationMethod =
    | "EXACT_OCCURRENCE_SESSION"
    | "EXACT_SESSION_ID"
    | "TRACE_REQUEST_MATCH"
    | "TEMPORAL_URL_FALLBACK"
    | "NONE";

export type ReplayCorrelationStrength =
    | "EXACT"
    | "STRONG"
    | "RELATED_UNVERIFIED"
    | "NONE";

export interface ResolvedOccurrenceReplay {
    replaySession: any | null;
    replaySessionId: string | null;
    occurrenceId: string | null;
    correlationMethod: ReplayCorrelationMethod;
    correlationStrength: ReplayCorrelationStrength;
    isExact: boolean;
    reason?: string;
}

/**
 * Retrieve the replay session specifically correlated to the exact occurrence being investigated.
 * 
 * Strict Correlation Order:
 * 1. Occurrence / event specific session ID matching ReplaySession.sessionId (EXACT)
 * 2. Replay sessionId explicitly associated with the occurrence / metadata (EXACT)
 * 3. traceId / requestId when available (STRONG)
 * 4. Only use timestamp + URL fallback within the same project when no stronger identifier exists (RELATED_UNVERIFIED)
 */
export async function getReplaySessionForOccurrence(
    issueId: string,
    occurrenceId?: string,
    projectId?: string,
): Promise<ResolvedOccurrenceReplay> {
    if (!issueId && !occurrenceId) {
        return {
            replaySession: null,
            replaySessionId: null,
            occurrenceId: occurrenceId ?? null,
            correlationMethod: "NONE",
            correlationStrength: "NONE",
            isExact: false,
            reason: "No issue or occurrence identifier provided.",
        };
    }

    // Step 1: Identify the exact occurrence event if provided or find the latest anchor event for the issue
    let targetOccurrence: {
        id: string;
        sessionId: string | null;
        traceId: string | null;
        requestId: string | null;
        timestamp: Date;
        projectId: string;
        resource?: string | null;
        metadata?: any;
    } | null = null;

    if (occurrenceId) {
        targetOccurrence = await prisma.event.findUnique({
            where: { id: occurrenceId },
            select: {
                id: true,
                sessionId: true,
                traceId: true,
                requestId: true,
                timestamp: true,
                projectId: true,
                resource: true,
                metadata: true,
            },
        });
    }

    if (!targetOccurrence && issueId) {
        targetOccurrence = await prisma.event.findFirst({
            where: { issueId, type: "ERROR" },
            orderBy: { timestamp: "desc" },
            select: {
                id: true,
                sessionId: true,
                traceId: true,
                requestId: true,
                timestamp: true,
                projectId: true,
                resource: true,
                metadata: true,
            },
        });
    }

    const effectiveProjectId = targetOccurrence?.projectId ?? projectId;

    // Scope check: Project ID must be known to prevent cross-tenant replay exposure
    if (!effectiveProjectId) {
        return {
            replaySession: null,
            replaySessionId: null,
            occurrenceId: targetOccurrence?.id ?? occurrenceId ?? null,
            correlationMethod: "NONE",
            correlationStrength: "NONE",
            isExact: false,
            reason: "Project scope could not be verified.",
        };
    }

    // Tier 1: Exact Occurrence Session ID Matching
    if (targetOccurrence?.sessionId) {
        const replay = await prisma.replaySession.findFirst({
            where: {
                projectId: effectiveProjectId,
                sessionId: targetOccurrence.sessionId,
                status: { in: ["AVAILABLE", "RECORDING", "PROCESSING"] },
            },
            include: REPLAY_SESSION_INCLUDE,
        });

        if (replay) {
            return {
                replaySession: replay,
                replaySessionId: replay.id,
                occurrenceId: targetOccurrence.id,
                correlationMethod: "EXACT_OCCURRENCE_SESSION",
                correlationStrength: "EXACT",
                isExact: true,
                reason: `Directly correlated via session identifier (${targetOccurrence.sessionId}).`,
            };
        }
    }

    // Tier 2: Explicit Replay Session ID in Occurrence Metadata or Direct issueId link on Session
    const metaReplayId = targetOccurrence?.metadata && typeof targetOccurrence.metadata === "object"
        ? (targetOccurrence.metadata as any).replaySessionId || (targetOccurrence.metadata as any).replayId
        : undefined;

    if (metaReplayId) {
        const replay = await prisma.replaySession.findFirst({
            where: {
                id: metaReplayId,
                projectId: effectiveProjectId,
                status: { in: ["AVAILABLE", "RECORDING", "PROCESSING"] },
            },
            include: REPLAY_SESSION_INCLUDE,
        });

        if (replay) {
            return {
                replaySession: replay,
                replaySessionId: replay.id,
                occurrenceId: targetOccurrence?.id ?? occurrenceId ?? null,
                correlationMethod: "EXACT_SESSION_ID",
                correlationStrength: "EXACT",
                isExact: true,
                reason: `Explicitly linked via occurrence metadata (${metaReplayId}).`,
            };
        }
    }

    // Tier 3: Trace ID or Request ID Correlated Match
    if (targetOccurrence && (targetOccurrence.traceId || targetOccurrence.requestId)) {
        const orConditions: any[] = [];
        if (targetOccurrence.traceId) orConditions.push({ traceId: targetOccurrence.traceId });
        if (targetOccurrence.requestId) orConditions.push({ requestId: targetOccurrence.requestId });

        const replay = await prisma.replaySession.findFirst({
            where: {
                projectId: effectiveProjectId,
                OR: orConditions,
                status: { in: ["AVAILABLE", "RECORDING", "PROCESSING"] },
            },
            include: REPLAY_SESSION_INCLUDE,
            orderBy: { createdAt: "desc" },
        });

        if (replay) {
            const matchedKey = replay.traceId === targetOccurrence.traceId ? `trace ${targetOccurrence.traceId}` : `request ${targetOccurrence.requestId}`;
            return {
                replaySession: replay,
                replaySessionId: replay.id,
                occurrenceId: targetOccurrence.id,
                correlationMethod: "TRACE_REQUEST_MATCH",
                correlationStrength: "STRONG",
                isExact: true,
                reason: `Correlated via distributed telemetry (${matchedKey}).`,
            };
        }
    }

    // Tier 4: Fallback: Timestamp + URL Proximity (Marked as Related / Unverified)
    if (targetOccurrence) {
        const eventTime = targetOccurrence.timestamp;
        const targetUrl = targetOccurrence.resource ?? (targetOccurrence.metadata as any)?.url;

        const replay = await prisma.replaySession.findFirst({
            where: {
                projectId: effectiveProjectId,
                status: { in: ["AVAILABLE", "RECORDING", "PROCESSING"] },
                OR: [
                    {
                        startedAt: {
                            gte: new Date(eventTime.getTime() - 5 * 60000),
                            lte: new Date(eventTime.getTime() + 2 * 60000),
                        },
                    },
                    {
                        errorAt: {
                            gte: new Date(eventTime.getTime() - 2 * 60000),
                            lte: new Date(eventTime.getTime() + 2 * 60000),
                        },
                    },
                ],
                ...(targetUrl ? { url: { contains: targetUrl } } : {}),
            },
            include: REPLAY_SESSION_INCLUDE,
            orderBy: { createdAt: "desc" },
        });

        if (replay) {
            return {
                replaySession: replay,
                replaySessionId: replay.id,
                occurrenceId: targetOccurrence.id,
                correlationMethod: "TEMPORAL_URL_FALLBACK",
                correlationStrength: "RELATED_UNVERIFIED",
                isExact: false,
                reason: "Correlated via temporal window and URL proximity. Exact occurrence session link unverified.",
            };
        }
    }

    return {
        replaySession: null,
        replaySessionId: null,
        occurrenceId: targetOccurrence?.id ?? occurrenceId ?? null,
        correlationMethod: "NONE",
        correlationStrength: "NONE",
        isExact: false,
        reason: "No session replay was captured or correlated with this specific occurrence.",
    };
}

export async function getReplaySessionForIssue(issueId: string, eventId?: string) {
    const resolved = await getReplaySessionForOccurrence(issueId, eventId);
    return resolved.replaySession;
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
