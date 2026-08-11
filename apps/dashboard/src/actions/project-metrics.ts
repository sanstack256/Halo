"use server";

import { prisma } from "@/lib/prisma";

const APDEX_THRESHOLD_MS = 500;

export type ProjectMetrics = {
    crashFreeSessions: {
        percentage: number;
        crashed: number;
        total: number;
    };

    apdex: {
        score: number | null;
        satisfied: number;
        tolerating: number;
        frustrated: number;
        total: number;
        thresholdMs: number;
    };

    performance: {
        traceCount: number;
        errorCount: number;
        traceFailureRate: number;
        p50: number | null;
        p95: number | null;
        p99: number | null;
    };
};

function isFailedStatus(
    status: string | null,
) {
    if (!status) {
        return false;
    }

    const normalized =
        status.toLowerCase();

    if (
        normalized === "error" ||
        normalized === "failed" ||
        normalized === "failure" ||
        normalized === "timeout" ||
        normalized === "timed_out"
    ) {
        return true;
    }

    const numeric =
        Number(status);

    if (
        Number.isFinite(numeric)
    ) {
        return numeric >= 400;
    }

    return false;
}

function percentile(
    values: number[],
    percentileValue: number,
) {
    if (values.length === 0) {
        return null;
    }

    const sorted = [...values].sort(
        (a, b) => a - b,
    );

    const index =
        Math.ceil(
            percentileValue *
            sorted.length,
        ) - 1;

    return sorted[
        Math.max(0, index)
    ];
}

export async function getProjectMetrics(
    projectId: string,
): Promise<ProjectMetrics> {
    const [
        sessions,
        traces,
        errors,
    ] = await Promise.all([
        prisma.telemetrySession.findMany({
            where: {
                projectId,
            },
            select: {
                crashedAt: true,
            },
        }),

        prisma.event.findMany({
            where: {
                projectId,
                type: "TRACE",
                durationMs: {
                    not: null,
                },
            },
            select: {
                durationMs: true,
                status: true,
            },
        }),

        prisma.event.count({
            where: {
                projectId,
                type: "ERROR",
            },
        }),
    ]);

    /*
     * --------------------------------------------------
     * Crash-free sessions
     * --------------------------------------------------
     */

    const totalSessions =
        sessions.length;

    const crashedSessions =
        sessions.filter(
            (session) =>
                session.crashedAt !== null,
        ).length;

    const crashFreeSessions =
        totalSessions > 0
            ? (
                (
                    totalSessions -
                    crashedSessions
                ) /
                totalSessions
            ) *
            100
            : 100;

    /*
     * --------------------------------------------------
     * Apdex
     * --------------------------------------------------
     *
     * Satisfied:
     * <= T
     *
     * Tolerating:
     * > T and <= 4T
     *
     * Frustrated:
     * > 4T
     *
     * Failed requests are treated as frustrated.
     */

    const durations =
        traces
            .map(
                (trace) =>
                    trace.durationMs,
            )
            .filter(
                (
                    duration,
                ): duration is number =>
                    duration !== null &&
                    duration >= 0,
            );

    let satisfied = 0;
    let tolerating = 0;
    let frustrated = 0;

    for (
        const trace of traces
    ) {
        if (
            trace.durationMs ===
            null
        ) {
            continue;
        }

        if (
            isFailedStatus(
                trace.status,
            )
        ) {
            frustrated++;
            continue;
        }

        if (
            trace.durationMs <=
            APDEX_THRESHOLD_MS
        ) {
            satisfied++;
        } else if (
            trace.durationMs <=
            APDEX_THRESHOLD_MS * 4
        ) {
            tolerating++;
        } else {
            frustrated++;
        }
    }

    const apdexTotal =
        satisfied +
        tolerating +
        frustrated;

    const apdex =
        apdexTotal > 0
            ? (
                satisfied +
                tolerating / 2
            ) /
            apdexTotal
            : null;

    /*
     * --------------------------------------------------
     * Performance
     * --------------------------------------------------
     */

    const traceCount =
        traces.length;

    const failedTraces =
        traces.filter((trace) =>
            isFailedStatus(
                trace.status,
            ),
        ).length;

    const traceFailureRate =
        traceCount > 0
            ? (
                failedTraces /
                traceCount
            ) *
            100
            : 0;

    return {
        crashFreeSessions: {
            percentage:
                Number(
                    crashFreeSessions.toFixed(
                        2,
                    ),
                ),

            crashed:
                crashedSessions,

            total:
                totalSessions,
        },

        apdex: {
            score:
                apdex === null
                    ? null
                    : Number(
                        apdex.toFixed(
                            3,
                        ),
                    ),

            satisfied,

            tolerating,

            frustrated,

            total:
                apdexTotal,

            thresholdMs:
                APDEX_THRESHOLD_MS,
        },

        performance: {
            traceCount,

            errorCount:
                errors,

            traceFailureRate:
                Number(
                    traceFailureRate.toFixed(
                        2,
                    ),
                ),

            p50:
                percentile(
                    durations,
                    0.5,
                ),

            p95:
                percentile(
                    durations,
                    0.95,
                ),

            p99:
                percentile(
                    durations,
                    0.99,
                ),
        },
    };
}