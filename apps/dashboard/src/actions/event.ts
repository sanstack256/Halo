"use server";

import { prisma } from "@/lib/prisma";
import {
    EventSeverity,
    EventType,
    Prisma,
} from "@/generated/prisma/client";

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

    projectId: string;
    environmentId: string;
};

export async function createEvent(
    data: CreateEventInput,
) {
    const fingerprint =
        data.fingerprint ??
        `${data.type}:${data.title}`;

    const issue = await findOrCreateIssue(
        data.projectId,
        data.title,
        fingerprint,
        data.severity,
    );

    const event = await prisma.event.create({
        data: {
            type: data.type,
            severity: data.severity,

            title: data.title,
            message: data.message,

            stack: data.stack,
            fingerprint,

            metadata: data.metadata,
            tags: data.tags,
            breadcrumbs: data.breadcrumbs,
            user: data.user,

            timestamp: new Date(data.timestamp),

            sdkName: data.sdkName,
            sdkVersion: data.sdkVersion,
            release: data.release,

            projectId: data.projectId,
            environmentId: data.environmentId,

            issueId: issue.id,
        },
    });

    await prisma.issue.update({
        where: {
            id: issue.id,
        },
        data: {
            eventCount: {
                increment: 1,
            },
            lastSeen: event.timestamp,
        },
    });

    return event;
}

export async function getEvents(
    projectId: string,
) {
    return prisma.event.findMany({
        where: {
            projectId,
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
        },
    });
}