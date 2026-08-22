"use server";

import { prisma } from "@/lib/prisma";
import { EventSeverity } from "@/generated/prisma/client";

const INVESTIGATION_EVENT_LIMIT = 500;

const INVESTIGATION_WINDOW_MS =
    5 * 60 * 1000;

const INVESTIGATION_ANCHOR_LIMIT = 100;

export async function findOrCreateIssue(
    projectId: string,
    title: string,
    fingerprint: string,
    severity: EventSeverity,
) {
    return prisma.issue.upsert({
        where: {
            projectId_fingerprint: {
                projectId,
                fingerprint,
            },
        },

        update: {
            lastSeen: new Date(),
            severity,
            title,
        },

        create: {
            projectId,
            title,
            fingerprint,
            severity,

            /*
             * The first event that creates the
             * Issue will increment this counter
             * when createEvent() updates the Issue.
             */
            eventCount: 0,
        },
    });
}

export async function getIssues(
    projectId: string,
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

export async function getAllOrgIssues(filters?: {
    status?: "OPEN" | "RESOLVED" | "IGNORED";
    severity?: "FATAL" | "ERROR" | "WARNING" | "INFO";
    recurring?: boolean;
    regressions?: boolean;
}) {
    const { getSession } = await import("@/lib/session");
    const { getOrganization } = await import("@/lib/organization");

    const session = await getSession();
    if (!session) return [];

    const organization = await getOrganization(session.user.id);
    if (!organization) return [];

    const projects = await prisma.project.findMany({
        where: { organizationId: organization.id },
        select: { id: true, name: true },
    });
    if (projects.length === 0) return [];

    const projectIds = projects.map((p) => p.id);
    const projectMap = new Map(projects.map((p) => [p.id, p.name]));

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const issues = await prisma.issue.findMany({
        where: {
            projectId: { in: projectIds },
            ...(filters?.status ? { status: filters.status } : {}),
            ...(filters?.severity ? { severity: filters.severity } : {}),
            ...(filters?.recurring ? { eventCount: { gt: 10 } } : {}),
            ...(filters?.regressions ? { firstSeen: { gte: sevenDaysAgo } } : {}),
        },
        orderBy: { lastSeen: "desc" },
    });

    return issues.map((issue) => ({
        ...issue,
        projectName: projectMap.get(issue.projectId) ?? "Unknown",
    }));
}

export async function getIssue(
    issueId: string,
    projectId?: string,
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

                include: {
                    environment: {
                        select: {
                            name: true,
                        },
                    },
                },
            },
        },
    });
}

/**
 * Returns the telemetry that should be considered
 * when investigating an Issue.
 *
 * The Issue's own events are always included.
 *
 * Additional project telemetry is selected by
 * correlation with those Issue events:
 *
 * - requestId
 * - traceId
 * - sessionId
 * - service
 * - resource
 * - release
 * - temporal proximity
 *
 * We deliberately do not return every event in the
 * project. Investigation evidence must be relevant,
 * bounded, and explainable.
 */
export async function getInvestigationEvents(
    issueId: string,
    projectId: string,
) {
    const issue = await prisma.issue.findFirst({
        where: {
            id: issueId,
            projectId,
        },

        include: {
            events: {
                orderBy: {
                    timestamp: "desc",
                },

                take: INVESTIGATION_ANCHOR_LIMIT,

                include: {
                    environment: {
                        select: {
                            name: true,
                        },
                    },
                },
            },
        },
    });

    if (!issue) {
        return null;
    }

    const anchorEvents =
        issue.events;

    if (anchorEvents.length === 0) {
        return [];
    }

    /*
     * --------------------------------------------------
     * Build investigation bounds
     * --------------------------------------------------
     *
     * Every Issue event acts as an anchor.
     *
     * We search a bounded temporal region around
     * those anchors rather than the entire project.
     */
    const earliestTimestamp =
        Math.min(
            ...anchorEvents.map(
                event =>
                    event.timestamp.getTime(),
            ),
        );

    const latestTimestamp =
        Math.max(
            ...anchorEvents.map(
                event =>
                    event.timestamp.getTime(),
            ),
        );

    const from =
        new Date(
            earliestTimestamp -
                INVESTIGATION_WINDOW_MS,
        );

    const to =
        new Date(
            latestTimestamp +
                INVESTIGATION_WINDOW_MS,
        );

    /*
     * --------------------------------------------------
     * Extract correlation identifiers
     * --------------------------------------------------
     */
    const requestIds =
        uniqueStrings(
            anchorEvents.map(
                event =>
                    event.requestId,
            ),
        );

    const traceIds =
        uniqueStrings(
            anchorEvents.map(
                event =>
                    event.traceId,
            ),
        );

    const sessionIds =
        uniqueStrings(
            anchorEvents.map(
                event =>
                    event.sessionId,
            ),
        );

    const services =
        uniqueStrings(
            anchorEvents.map(
                event =>
                    event.service,
            ),
        );

    const resources =
        uniqueStrings(
            anchorEvents.map(
                event =>
                    event.resource,
            ),
        );

    const releases =
        uniqueStrings(
            anchorEvents.map(
                event =>
                    event.release,
            ),
        );

    /*
     * --------------------------------------------------
     * Fetch bounded candidate telemetry
     * --------------------------------------------------
     *
     * The temporal condition prevents unrelated
     * historical project data from entering the
     * investigation.
     *
     * Correlation conditions then broaden the
     * candidate set when identifiers exist.
     */
    const candidates =
        await prisma.event.findMany({
            where: {
                projectId,

                timestamp: {
                    gte: from,
                    lte: to,
                },

                OR: [
                    {
                        id: {
                            in: anchorEvents.map(
                                event =>
                                    event.id,
                            ),
                        },
                    },

                    ...(requestIds.length > 0
                        ? [
                              {
                                  requestId: {
                                      in: requestIds,
                                  },
                              },
                          ]
                        : []),

                    ...(traceIds.length > 0
                        ? [
                              {
                                  traceId: {
                                      in: traceIds,
                                  },
                              },
                          ]
                        : []),

                    ...(sessionIds.length > 0
                        ? [
                              {
                                  sessionId: {
                                      in: sessionIds,
                                  },
                              },
                          ]
                        : []),

                    ...(services.length > 0
                        ? [
                              {
                                  service: {
                                      in: services,
                                  },
                              },
                          ]
                        : []),

                    ...(resources.length > 0
                        ? [
                              {
                                  resource: {
                                      in: resources,
                                  },
                              },
                          ]
                        : []),

                    ...(releases.length > 0
                        ? [
                              {
                                  release: {
                                      in: releases,
                                  },
                              },
                          ]
                        : []),
                ],
            },

            orderBy: {
                timestamp: "desc",
            },

            take: INVESTIGATION_EVENT_LIMIT,

            include: {
                environment: {
                    select: {
                        name: true,
                    },
                },
            },
        });

    /*
     * --------------------------------------------------
     * Score relevance
     * --------------------------------------------------
     *
     * Database filtering gives us candidates.
     *
     * This second stage decides which candidates
     * are actually relevant enough to investigate.
     */
    const scored =
        candidates.map(
            event => ({
                event,

                score:
                    scoreInvestigationRelevance(
                        event,
                        anchorEvents,
                    ),
            }),
        );

    /*
     * --------------------------------------------------
     * Select evidence
     * --------------------------------------------------
     *
     * Every Issue event is mandatory.
     *
     * Correlated events need a positive relevance
     * score.
     */
    const anchorIds =
        new Set(
            anchorEvents.map(
                event =>
                    event.id,
            ),
        );

    const selected =
        scored
            .filter(
                item =>
                    anchorIds.has(
                        item.event.id,
                    ) ||
                    item.score > 0,
            )
            .sort(
                (a, b) => {
                    /*
                     * Strongest relevance first.
                     *
                     * For equal relevance, most
                     * recent evidence first.
                     */
                    if (
                        b.score !==
                        a.score
                    ) {
                        return (
                            b.score -
                            a.score
                        );
                    }

                    return (
                        b.event.timestamp.getTime() -
                        a.event.timestamp.getTime()
                    );
                },
            )
            .slice(
                0,
                INVESTIGATION_EVENT_LIMIT,
            )
            .map(
                item =>
                    item.event,
            );

    /*
     * Keep the output deterministic and chronological.
     *
     * The investigation engine can then reconstruct
     * the actual incident timeline itself.
     */
    return selected.sort(
        (a, b) =>
            a.timestamp.getTime() -
            b.timestamp.getTime(),
    );
}

function scoreInvestigationRelevance(
    event: {
        id: string;
        timestamp: Date;
        requestId: string | null;
        traceId: string | null;
        sessionId: string | null;
        service: string | null;
        resource: string | null;
        release: string | null;
    },
    anchors: Array<{
        id: string;
        timestamp: Date;
        requestId: string | null;
        traceId: string | null;
        sessionId: string | null;
        service: string | null;
        resource: string | null;
        release: string | null;
    }>,
): number {
    /*
     * An Issue event is always relevant.
     */
    if (
        anchors.some(
            anchor =>
                anchor.id ===
                event.id,
        )
    ) {
        return 100;
    }

    let bestScore = 0;

    for (const anchor of anchors) {
        let score = 0;

        /*
         * Strongest relationships first.
         */
        if (
            event.requestId &&
            anchor.requestId &&
            event.requestId ===
                anchor.requestId
        ) {
            score += 60;
        }

        if (
            event.traceId &&
            anchor.traceId &&
            event.traceId ===
                anchor.traceId
        ) {
            score += 55;
        }

        if (
            event.sessionId &&
            anchor.sessionId &&
            event.sessionId ===
                anchor.sessionId
        ) {
            score += 30;
        }

        if (
            event.service &&
            anchor.service &&
            event.service ===
                anchor.service
        ) {
            score += 20;
        }

        if (
            event.resource &&
            anchor.resource &&
            event.resource ===
                anchor.resource
        ) {
            score += 20;
        }

        if (
            event.release &&
            anchor.release &&
            event.release ===
                anchor.release
        ) {
            score += 10;
        }

        /*
         * Temporal proximity provides useful
         * context but never dominates explicit
         * correlation identifiers.
         */
        const difference =
            Math.abs(
                event.timestamp.getTime() -
                    anchor.timestamp.getTime(),
            );

        if (
            difference <=
            INVESTIGATION_WINDOW_MS
        ) {
            const temporalScore =
                Math.max(
                    1,
                    Math.round(
                        15 *
                            (1 -
                                difference /
                                    INVESTIGATION_WINDOW_MS),
                    ),
                );

            score += temporalScore;
        }

        bestScore =
            Math.max(
                bestScore,
                score,
            );
    }

    return bestScore;
}

function uniqueStrings(
    values: Array<
        string | null | undefined
    >,
): string[] {
    return [
        ...new Set(
            values.filter(
                (
                    value,
                ): value is string =>
                    typeof value ===
                        "string" &&
                    value.length > 0,
            ),
        ),
    ];
}