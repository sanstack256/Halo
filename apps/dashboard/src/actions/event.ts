"use server";

import { prisma } from "@/lib/prisma";
import {
    EventSeverity,
    EventType,
} from "@/generated/prisma/client";

import { findOrCreateIssue } from "@/actions/issue";
import { Prisma } from "@/generated/prisma/client";


type CreateEventInput = {
    type: EventType;
    severity: EventSeverity;

    title: string;
    message?: string;

    metadata?: Prisma.InputJsonValue;

    timestamp: string;

    sdkName?: string;
    sdkVersion?: string;
    release?: string;

    projectId: string;
    environmentId: string;
};

export async function createEvent(
    data: CreateEventInput
) {
    const fingerprint =
        `${data.type}:${data.title}`;

    const issue = await findOrCreateIssue(
        data.projectId,
        data.title,
        fingerprint,
        data.severity
    );

    return prisma.event.create({
        data: {
            type: data.type,
            severity: data.severity,

            title: data.title,
            message: data.message,

            metadata: data.metadata,

            timestamp: new Date(data.timestamp),

            sdkName: data.sdkName,
            sdkVersion: data.sdkVersion,
            release: data.release,

            projectId: data.projectId,
            environmentId: data.environmentId,

            issueId: issue.id,
        },
    });
}

export async function getEvents(
    projectId: string
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
    eventId: string
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