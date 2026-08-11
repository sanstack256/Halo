"use server";

import { prisma } from "@/lib/prisma";
import { EventSeverity } from "@/generated/prisma/client";

export async function findOrCreateIssue(
    projectId: string,
    title: string,
    fingerprint: string,
    severity: EventSeverity,
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
                lastSeen: new Date(),
                severity,
                title,
            },
        });
    }

    return prisma.issue.create({
        data: {
            projectId,
            title,
            fingerprint,
            severity,
            eventCount: 0,
        },
    });
}

export async function getIssues(projectId: string) {
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
    issueId: string,
    projectId?: string
) {
    return prisma.issue.findFirst({
        where: {
            id: issueId,
            ...(projectId
                ? {
                      projectId,
                  }
                : {}),
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