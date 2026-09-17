"use server";

import { prisma } from "@/lib/prisma";
import { EventType } from "@/generated/prisma/client";

export async function upsertRelease(
    projectId: string,
    version: string,
    type: EventType,
    timestamp: Date,
) {
    if (!version.trim()) {
        return undefined;
    }

    const release = await prisma.release.upsert({
        where: {
            projectId_version: {
                projectId,
                version,
            },
        },

        create: {
            projectId,
            version,

            firstSeen: timestamp,
            lastSeen: timestamp,

            eventCount: 1,

            errorCount:
                type === "ERROR"
                    ? 1
                    : 0,

            traceCount:
                type === "TRACE"
                    ? 1
                    : 0,
        },

        update: {
            lastSeen: timestamp,

            eventCount: {
                increment: 1,
            },

            ...(type === "ERROR"
                ? {
                      errorCount: {
                          increment: 1,
                      },
                  }
                : {}),

            ...(type === "TRACE"
                ? {
                      traceCount: {
                          increment: 1,
                      },
                  }
                : {}),
        },
    });

    return release;
}

export async function getReleases(
    projectId: string,
) {
    return prisma.release.findMany({
        where: {
            projectId,
        },

        orderBy: {
            lastSeen: "desc",
        },
    });
}

export async function getReleaseCount(
    projectId: string,
) {
    try {
        return await prisma.release.count({
            where: {
                projectId,
            },
        });
    } catch (err) {
        console.error("Error in getReleaseCount:", err);
        return 0;
    }
}

export async function getRelease(
    projectId: string,
    version: string,
) {
    return prisma.release.findFirst({
        where: {
            projectId,
            version,
        },
    });
}