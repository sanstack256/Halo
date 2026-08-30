"use server";

import { prisma } from "@/lib/prisma";
import { EventSeverity } from "@/generated/prisma/client";
import { isolateOccurrenceEvents } from "@/lib/investigation/occurrence-isolation";

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
        include: {
            events: {
                select: {
                    id: true,
                    timestamp: true,
                    service: true,
                    severity: true,
                    sdkName: true,
                    sdkVersion: true,
                    environment: {
                        select: {
                            name: true,
                        },
                    },
                },
                orderBy: {
                    timestamp: "asc",
                },
            },
        },
        orderBy: {
            lastSeen: "desc",
        },
    });
}

export async function updateIssueStatus(
    issueId: string,
    status: "OPEN" | "RESOLVED" | "IGNORED"
) {
    return prisma.issue.update({
        where: { id: issueId },
        data: { status },
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

/**
 * Returns the telemetry relevant to investigating a SINGLE
 * occurrence of an Issue.
 *
 * Issue grouping and Incident reconstruction are separate concerns:
 *
 * - Issue grouping: many events sharing a fingerprint → one Issue.
 * - Incident reconstruction: one specific occurrence (anchorEvent)
 *   → causal evidence around THAT event only.
 *
 * If `anchorEventId` is supplied, that exact event is used as the
 * incident anchor. Otherwise the most recent Issue event is chosen.
 *
 * Historical occurrences of the same Issue are NOT included in the
 * active incident telemetry. They are returned separately as
 * `historicalOccurrenceCount` so the UI can display them as context
 * without contaminating causal reasoning.
 */
export async function getInvestigationEventsForOccurrence(
    issueId: string,
    projectId: string,
    anchorEventId?: string | null,
): Promise<{
    anchorEvent: NonNullable<
        Awaited<ReturnType<typeof prisma.event.findFirst>>
    >;
    events: Awaited<ReturnType<typeof prisma.event.findMany>>;
    historicalOccurrenceCount: number;
} | null> {
    /*
     * Load the Issue with its events so we can:
     *   a) Verify the Issue exists in this project.
     *   b) Select the correct anchor occurrence.
     *   c) Count historical occurrences for the UI.
     */
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

                /*
                 * We only need enough events to find the
                 * requested anchor and count occurrences.
                 * A hard cap prevents runaway queries on
                 * Issues with thousands of events.
                 */
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

    if (issue.events.length === 0) {
        return null;
    }

    /*
     * --------------------------------------------------
     * Anchor selection
     * --------------------------------------------------
     *
     * The anchor is the single event representing the
     * occurrence being investigated.
     *
     * Priority:
     *   1. The caller-specified anchorEventId (user clicked
     *      "Investigate this occurrence").
     *   2. The most recent Issue event (default).
     */
    const anchorEvent =
        (anchorEventId
            ? issue.events.find(
                  (ev) => ev.id === anchorEventId,
              )
            : undefined) ?? issue.events[0]; // events are desc, so [0] is most recent

    if (!anchorEvent) {
        return null;
    }

    /*
     * Every other Issue event is a historical occurrence
     * of the same error — NOT part of this investigation.
     * We count them so the UI can say "3 other historical
     * occurrences exist and are excluded from this causal graph."
     */
    const historicalOccurrenceCount = issue.events.filter(
        (ev) => ev.id !== anchorEvent.id,
    ).length;

    /*
     * --------------------------------------------------
     * Build incident bounds from the single anchor
     * --------------------------------------------------
     *
     * Temporal bounds are derived from THIS occurrence
     * only, not from the spread across all occurrences.
     */
    const anchorTimeMs = anchorEvent.timestamp.getTime();

    const from = new Date(anchorTimeMs - INVESTIGATION_WINDOW_MS);
    const to = new Date(anchorTimeMs + INVESTIGATION_WINDOW_MS);

    /*
     * --------------------------------------------------
     * Extract correlation identifiers from the anchor
     * --------------------------------------------------
     *
     * Only the anchor event's IDs are used to broaden
     * the telemetry search. This prevents other sessions
     * or other occurrences from leaking into the evidence.
     */
    const correlationConditions: object[] = [
        /*
         * The anchor event itself is always included.
         */
        { id: anchorEvent.id },
    ];

    if (anchorEvent.requestId) {
        correlationConditions.push({
            requestId: anchorEvent.requestId,
        });
    }

    if (anchorEvent.traceId) {
        correlationConditions.push({
            traceId: anchorEvent.traceId,
        });
    }

    /*
     * --------------------------------------------------
     * Fetch bounded candidate telemetry
     * --------------------------------------------------
     *
     * Candidates must be within the anchor's temporal window and share an
     * exact request/trace identifier, or be the anchor itself. A session is
     * deliberately excluded: one session can contain several independent
     * requests and errors.
     *
     * Service/resource/release matching is NOT used here
     * as a sole criterion — those are too broad and can
     * pull in unrelated historical events.
     */
    const candidates = await prisma.event.findMany({
        where: {
            projectId,

            timestamp: {
                gte: from,
                lte: to,
            },

            OR: correlationConditions,
        },

        orderBy: {
            timestamp: "asc",
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
     * Score and filter — same approach as the original
     * getInvestigationEvents, but using only the single
     * anchor as the reference point.
     */
    const selected = isolateOccurrenceEvents(anchorEvent, candidates);

    /*
     * Return chronologically ordered evidence so the
     * investigation engine receives the actual sequence.
     */
    const events = selected.sort(
        (a, b) =>
            a.timestamp.getTime() - b.timestamp.getTime(),
    );

    return {
        anchorEvent,
        events,
        historicalOccurrenceCount,
    };
}
