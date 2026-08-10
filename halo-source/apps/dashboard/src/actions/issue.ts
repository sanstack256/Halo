"use server";

import { prisma } from "@/lib/prisma";
import { EventSeverity } from "@/generated/prisma/client";

export async function findOrCreateIssue(
    projectId: string,
    title: string,
    fingerprint: string,
    severity: EventSeverity
) {
    const existing = await prisma.issue.findFirst({
        where: {
            projectId,
            fingerprint,
        },
    });

    if (existing) {
        return prisma.issue.update({
            where: {
                id: existing.id,
            },
            data: {
                eventCount: {
                    increment: 1,
                },
                lastSeen: new Date(),
            },
        });
    }

    return prisma.issue.create({
        data: {
            title,
            fingerprint,
            severity,
            projectId,
        },
    });
}

export async function getIssues(
    projectId: string
) {
    return prisma.issue.findMany({
        where: {
            projectId,
        },
        orderBy: {
            lastSeen: "desc",
        },
    });
}

export async function getIssue(
    issueId: string
) {
    return prisma.issue.findUnique({
        where: {
            id: issueId,
        },
        include: {
            events: {
                orderBy: {
                    timestamp: "desc",
                },
            },
        },
    });
}