"use server";

import { prisma } from "@/lib/prisma";
import {
    EventSeverity,
    EventType,
    Prisma,
} from "@/generated/prisma/client";

import { upsertRelease } from "@/actions/release";

import { findOrCreateIssue } from "@/actions/issue";

type CreateEventInput = {
    type: EventType;
    severity: EventSeverity;

    title: string;
    message?: string;

    stack?: string;
    fingerprint?: string;

    metadata?: Prisma.InputJsonValue;
    tags?: Prisma.InputJsonValue;
    breadcrumbs?: Prisma.InputJsonValue;
    user?: Prisma.InputJsonValue;

    timestamp: string;

    sdkName?: string;
    sdkVersion?: string;
    release?: string;

    service?: string;
    resource?: string;
    operation?: string;
    status?: string | number;
    requestId?: string;
    traceId?: string;
    durationMs?: number;

    sessionId?: string;
    sessionStartedAt?: string;

    projectId: string;
    environmentId: string;
};

async function ensureTelemetrySession(
    sessionId: string | undefined,
    sessionStartedAt: string | undefined,
    projectId: string,
    environmentId: string,
    release: string | undefined,
    user: Prisma.InputJsonValue | undefined,
    timestamp: Date,
) {
    if (!sessionId) {
        return undefined;
    }

    let userKey: string | undefined;

    if (
        user &&
        typeof user === "object" &&
        !Array.isArray(user)
    ) {
        const userRecord =
            user as Record<string, unknown>;

        const candidate =
            userRecord.id ??
            userRecord.email ??
            userRecord.username;

        if (typeof candidate === "string") {
            userKey = candidate;
        }
    }

    const startedAt = sessionStartedAt
        ? new Date(sessionStartedAt)
        : timestamp;

    return prisma.telemetrySession.upsert({
        where: {
            id: sessionId,
        },

        create: {
            id: sessionId,

            projectId,

            environmentId,

            userKey,

            release,

            startedAt,

            lastSeenAt: timestamp,
        },

        update: {
            lastSeenAt: timestamp,

            ...(release
                ? {
                    release,
                }
                : {}),

            ...(userKey
                ? {
                    userKey,
                }
                : {}),
        },
    });
}

async function ensureRelease(
    projectId: string,
    version: string,
) {
    return prisma.release.upsert({
        where: {
            projectId_version: {
                projectId,
                version,
            },
        },

        create: {
            projectId,
            version,

            firstSeen: new Date(),
            lastSeen: new Date(),

            eventCount: 0,
            errorCount: 0,
            traceCount: 0,
        },

        update: {
            lastSeen: new Date(),
        },
    });
}

function shouldCreateIssue(
    type: EventType,
) {
    return type === "ERROR";
}

function shouldMarkSessionCrashed(
    type: EventType,
    severity: EventSeverity,
) {
    /*
     * A session is considered crashed only when
     * the SDK explicitly reports a fatal error.
     *
     * Ordinary ERROR events are still useful
     * telemetry, but do not automatically mean
     * that the user's session crashed.
     */
    return (
        type === "ERROR" &&
        severity === "FATAL"
    );
}

export async function createEvent(
    data: CreateEventInput,
) {
    const timestamp =
        new Date(data.timestamp);

    /*
     * --------------------------------------------------
     * Release
     * --------------------------------------------------
     *
     * A release is created automatically the first
     * time an event arrives with a release version.
     *
     * Events without a release continue to work
     * exactly as before.
     */
    const releaseVersion =
        data.release?.trim();

    const release =
        releaseVersion
            ? await upsertRelease(
                data.projectId,
                releaseVersion,
                data.type,
                timestamp,
            )
            : undefined;

    /*
     * --------------------------------------------------
     * Telemetry session
     * --------------------------------------------------
     */

    const session =
        await ensureTelemetrySession(
            data.sessionId,
            data.sessionStartedAt,
            data.projectId,
            data.environmentId,
            data.release,
            data.user,
            timestamp,
        );

    /*
     * Only error events participate in
     * Issue grouping.
     *
     * TRACE, LOG and MESSAGE events are
     * telemetry, not Issues.
     */

    let issueId: string | undefined;

    if (
        shouldCreateIssue(data.type)
    ) {
        const fingerprint =
            data.fingerprint ??
            `${data.type}:${data.title}`;

        const issue =
            await findOrCreateIssue(
                data.projectId,
                data.title,
                fingerprint,
                data.severity,
            );

        issueId = issue.id;
    }

    /*
     * --------------------------------------------------
     * Event
     * --------------------------------------------------
     */

    const event =
        await prisma.event.create({
            data: {
                type: data.type,

                severity:
                    data.severity,

                title:
                    data.title,

                message:
                    data.message,

                stack:
                    data.stack,

                fingerprint:
                    data.fingerprint,

                metadata:
                    data.metadata,

                tags:
                    data.tags,

                breadcrumbs:
                    data.breadcrumbs,

                user:
                    data.user,

                timestamp,

                sdkName:
                    data.sdkName,

                sdkVersion:
                    data.sdkVersion,

                release:
                    releaseVersion,

                releaseId:
                    release?.id,

                service:
                    data.service,

                resource:
                    data.resource,

                operation:
                    data.operation,

                status:
                    data.status !==
                        undefined
                        ? String(
                            data.status,
                        )
                        : undefined,

                requestId:
                    data.requestId,

                traceId:
                    data.traceId,

                durationMs:
                    data.durationMs,

                sessionId:
                    session?.id,

                projectId:
                    data.projectId,

                environmentId:
                    data.environmentId,

                issueId,
            },
        });

    /*
     * --------------------------------------------------
     * Issue
     * --------------------------------------------------
     *
     * Only update the Issue when this event
     * actually belongs to one.
     */

    if (issueId) {
        await prisma.issue.update({
            where: {
                id: issueId,
            },

            data: {
                eventCount: {
                    increment: 1,
                },

                lastSeen:
                    event.timestamp,

                lastEventId:
                    event.id,
            },
        });
    }

    /*
     * --------------------------------------------------
     * Session crash detection
     * --------------------------------------------------
     *
     * A session becomes crashed only when
     * a FATAL error is explicitly reported.
     *
     * We keep the first crash timestamp.
     */

    if (
        session &&
        shouldMarkSessionCrashed(
            data.type,
            data.severity,
        )
    ) {
        await prisma.telemetrySession.update({
            where: {
                id: session.id,
            },

            data: {
                crashedAt:
                    session.crashedAt ??
                    timestamp,
            },
        });
    }

    return event;
}

export async function getEvents(
    projectId: string,
) {
    return prisma.event.findMany({
        where: {
            projectId,
        },
        include: {
            environment: {
                select: {
                    name: true,
                },
            },
            issue: {
                select: {
                    id: true,
                    title: true,
                    fingerprint: true,
                },
            },
        },
        orderBy: {
            timestamp: "desc",
        },
    });
}

export async function getEvent(
    eventId: string,
) {
    return prisma.event.findUnique({
        where: {
            id: eventId,
        },
        include: {
            issue: true,
            environment: {
                select: {
                    name: true,
                },
            },
        },
    });
}