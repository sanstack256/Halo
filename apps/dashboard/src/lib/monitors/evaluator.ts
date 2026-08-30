import { prisma } from "@/lib/prisma";
import { parseMonitorQuery, buildQueryWhereConditions } from "./query-parser";
import { sendMonitorAlertEmail } from "@/lib/notifications/email-alert";
import type { Monitor, MonitorAlert, MonitorStatus, Prisma } from "@/generated/prisma/client";

export interface EvaluationResult {
    monitorId: string;
    monitorName: string;
    projectId: string;
    evaluatedAt: Date;
    windowMinutes: number;
    matchingCount: number;
    thresholdValue: number;
    isThresholdViolated: boolean;
    previousState: MonitorStatus;
    newState: MonitorStatus;
    stateChanged: boolean;
    alertId?: string;
    alertCreated: boolean;
    reason: string;
    matchedEventIds: string[];
}

/**
 * Evaluates a single monitor against real persisted telemetry in its configured project.
 */
export async function evaluateMonitor(
    monitorId: string,
    evaluationTime: Date = new Date()
): Promise<EvaluationResult | null> {
    const monitor = await prisma.monitor.findUnique({
        where: { id: monitorId },
        include: {
            project: { select: { id: true, name: true } },
        },
    });

    if (!monitor) {
        return null;
    }

    // Disabled monitors are not evaluated
    if (monitor.status === "DISABLED") {
        return {
            monitorId: monitor.id,
            monitorName: monitor.name,
            projectId: monitor.projectId,
            evaluatedAt: evaluationTime,
            windowMinutes: monitor.thresholdWindow ?? 10,
            matchingCount: 0,
            thresholdValue: monitor.thresholdValue ?? 1,
            isThresholdViolated: false,
            previousState: monitor.status,
            newState: monitor.status,
            stateChanged: false,
            alertCreated: false,
            reason: "Monitor is disabled.",
            matchedEventIds: [],
        };
    }

    const windowMinutes = monitor.thresholdWindow && monitor.thresholdWindow > 0 ? monitor.thresholdWindow : 10;
    const windowMs = windowMinutes * 60 * 1000;
    const windowStart = new Date(evaluationTime.getTime() - windowMs);
    const threshold = monitor.thresholdValue && monitor.thresholdValue > 0 ? monitor.thresholdValue : 1;

    // 1. Build authoritative Prisma Event query strictly scoped to project and rolling window
    const baseWhere: Prisma.EventWhereInput = {
        projectId: monitor.projectId,
        timestamp: {
            gte: windowStart,
            lte: evaluationTime,
        },
    };

    // Filter by monitor type
    if (monitor.type === "ERROR") {
        baseWhere.type = "ERROR";
        if (monitor.severity) {
            if (monitor.severity === "FATAL") {
                baseWhere.severity = "FATAL";
            } else if (monitor.severity === "ERROR") {
                baseWhere.severity = { in: ["ERROR", "FATAL"] };
            } else if (monitor.severity === "WARNING") {
                baseWhere.severity = { in: ["WARNING", "ERROR", "FATAL"] };
            }
        }
    } else if (monitor.type === "METRIC") {
        baseWhere.type = { in: ["TRACE", "LOG"] };
    }

    // Apply parsed filter expression
    const parsedQuery = parseMonitorQuery(monitor.query);
    const queryConditions = buildQueryWhereConditions(parsedQuery);

    const fullWhere: Prisma.EventWhereInput = queryConditions.length > 0
        ? { AND: [baseWhere, ...queryConditions] }
        : baseWhere;

    // 2. Query real matching event records from database
    const [matchingCount, sampleEvents] = await Promise.all([
        prisma.event.count({ where: fullWhere }),
        prisma.event.findMany({
            where: fullWhere,
            select: { id: true },
            orderBy: { timestamp: "desc" },
            take: 10,
        }),
    ]);

    const isThresholdViolated = matchingCount >= threshold;
    const matchedEventIds = sampleEvents.map((e) => e.id);

    // 3. Find active (unresolved) alert for this monitor if one exists
    const activeAlert = await prisma.monitorAlert.findFirst({
        where: {
            monitorId: monitor.id,
            status: { in: ["OPEN", "ACKNOWLEDGED"] },
        },
        orderBy: { triggeredAt: "desc" },
    });

    const previousState = monitor.status;
    let newState: MonitorStatus = monitor.status;
    let stateChanged = false;
    let alertCreated = false;
    let targetAlertId = activeAlert?.id;
    let reason = "";

    const conditionSummary = `${matchingCount} matching ${monitor.type} event${matchingCount === 1 ? "" : "s"} in rolling ${windowMinutes}m window (threshold: >= ${threshold})`;

    // 4. State transition logic
    if (isThresholdViolated) {
        reason = `Condition met: ${conditionSummary}.`;

        if (!activeAlert) {
            // State Transition: HEALTHY (or MUTED) -> FIRING
            newState = monitor.status === "MUTED" ? "MUTED" : "FIRING";
            stateChanged = previousState !== newState;

            // Create new Alert record
            const newAlert = await prisma.monitorAlert.create({
                data: {
                    monitorId: monitor.id,
                    status: "OPEN",
                    triggeredAt: evaluationTime,
                    conditionSummary,
                    observedValue: matchingCount,
                    thresholdValue: threshold,
                },
            });

            targetAlertId = newAlert.id;
            alertCreated = true;

            // Update Monitor
            await prisma.monitor.update({
                where: { id: monitor.id },
                data: {
                    status: newState,
                    lastTriggeredAt: evaluationTime,
                    lastEvaluatedAt: evaluationTime,
                    incidentCount: { increment: 1 },
                },
            });

            // Trigger Resend email delivery if enabled (only on new firing episode)
            if (monitor.status !== "MUTED") {
                sendMonitorAlertEmail(newAlert.id).catch((err) => {
                    console.error(`[Halo Evaluator] Email delivery error for alert ${newAlert.id}:`, err);
                });
            }
        } else {
            // Continuous episode: already FIRING / ACKNOWLEDGED
            newState = monitor.status;
            stateChanged = false;

            // Update active alert observed values without creating duplicate alerts
            await prisma.monitorAlert.update({
                where: { id: activeAlert.id },
                data: {
                    conditionSummary,
                    observedValue: matchingCount,
                    updatedAt: evaluationTime,
                },
            });

            // Update monitor evaluation timestamp
            await prisma.monitor.update({
                where: { id: monitor.id },
                data: {
                    lastEvaluatedAt: evaluationTime,
                },
            });
        }
    } else {
        // Condition NOT violated (below threshold)
        reason = `Condition normal: ${matchingCount} matching ${monitor.type} event${matchingCount === 1 ? "" : "s"} in rolling ${windowMinutes}m window (threshold: >= ${threshold}).`;

        if (activeAlert) {
            // State Transition: FIRING / ACKNOWLEDGED -> HEALTHY (Recovery)
            newState = monitor.status === "MUTED" ? "MUTED" : "HEALTHY";
            stateChanged = previousState !== newState;

            // Auto-resolve open alert
            await prisma.monitorAlert.update({
                where: { id: activeAlert.id },
                data: {
                    status: "RESOLVED",
                    resolvedAt: evaluationTime,
                    notes: activeAlert.notes
                        ? `${activeAlert.notes}\nAuto-resolved after metrics returned below threshold.`
                        : "Auto-resolved after metrics returned below threshold.",
                },
            });

            // Update monitor to healthy
            await prisma.monitor.update({
                where: { id: monitor.id },
                data: {
                    status: newState,
                    lastEvaluatedAt: evaluationTime,
                },
            });
        } else {
            // Remained HEALTHY
            newState = monitor.status === "MUTED" ? "MUTED" : "HEALTHY";
            stateChanged = previousState !== newState;

            await prisma.monitor.update({
                where: { id: monitor.id },
                data: {
                    status: newState,
                    lastEvaluatedAt: evaluationTime,
                },
            });
        }
    }

    return {
        monitorId: monitor.id,
        monitorName: monitor.name,
        projectId: monitor.projectId,
        evaluatedAt: evaluationTime,
        windowMinutes,
        matchingCount,
        thresholdValue: threshold,
        isThresholdViolated,
        previousState,
        newState,
        stateChanged,
        alertId: targetAlertId,
        alertCreated,
        reason,
        matchedEventIds,
    };
}

/**
 * Evaluates all active monitors for a given project.
 * Triggered automatically when new telemetry is ingested or periodically.
 */
export async function evaluateMonitorsForProject(
    projectId: string,
    evaluationTime: Date = new Date()
): Promise<EvaluationResult[]> {
    if (!projectId) return [];

    const monitors = await prisma.monitor.findMany({
        where: {
            projectId,
            status: { not: "DISABLED" },
        },
        select: { id: true },
    });

    if (monitors.length === 0) return [];

    const results: EvaluationResult[] = [];
    for (const m of monitors) {
        try {
            const res = await evaluateMonitor(m.id, evaluationTime);
            if (res) results.push(res);
        } catch (err) {
            console.error(`[Halo Evaluator] Error evaluating monitor ${m.id}:`, err);
        }
    }

    return results;
}
