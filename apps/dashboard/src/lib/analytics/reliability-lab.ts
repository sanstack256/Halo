import { prisma } from "@/lib/prisma";
import type {
    ReliabilityLabData,
    RecurringPatternItem,
    TrendDirection,
    DataProvenance,
    ReliabilityDebtItem,
} from "./types";
import { parseTimeRange, calculateMetricComparison, generateTimeBuckets } from "./time";

export interface ReliabilityLabParams {
    organizationId: string;
    projectId?: string;
    environment?: string;
    timeRangeKey?: string;
    service?: string;
    userTimezone?: string;
}

export async function fetchReliabilityLabAnalytics(
    params: ReliabilityLabParams
): Promise<ReliabilityLabData> {
    const timeRange = parseTimeRange(params.timeRangeKey, "PREVIOUS_PERIOD");

    // 1. Resolve Projects
    const projectWhere: any = { organizationId: params.organizationId };
    if (params.projectId && params.projectId !== "ALL") {
        projectWhere.id = params.projectId;
    }

    const projects = await prisma.project.findMany({
        where: projectWhere,
        select: { id: true, name: true },
    });

    const projectIds = projects.map((p) => p.id);
    const projectNameMap = new Map(projects.map((p) => [p.id, p.name]));

    if (projectIds.length === 0) {
        return createEmptyReliabilityData(timeRange, params);
    }

    // 2. Query Events, Telemetry Sessions, Issues, Releases, and Alerts
    const eventFilter: any = {
        projectId: { in: projectIds },
        timestamp: {
            gte: timeRange.start,
            lte: timeRange.end,
        },
    };

    if (params.environment && params.environment !== "ALL") {
        eventFilter.environment = { name: params.environment };
    }

    if (params.service && params.service !== "ALL") {
        eventFilter.service = params.service;
    }

    const compEventFilter: any = {
        projectId: { in: projectIds },
        timestamp: {
            gte: timeRange.comparisonStart!,
            lte: timeRange.comparisonEnd!,
        },
    };

    const [
        events,
        compEvents,
        sessions,
        issues,
        releases,
        alerts,
        allHistoricalEvents,
    ] = await Promise.all([
        prisma.event.findMany({
            where: eventFilter,
            select: {
                id: true,
                type: true,
                service: true,
                release: true,
                fingerprint: true,
                title: true,
                stack: true,
                resource: true,
                timestamp: true,
                durationMs: true,
                projectId: true,
                issueId: true,
            },
            orderBy: { timestamp: "asc" },
        }),
        prisma.event.findMany({
            where: compEventFilter,
            select: { id: true, type: true },
        }),
        prisma.telemetrySession.findMany({
            where: {
                projectId: { in: projectIds },
                startedAt: { gte: timeRange.start, lte: timeRange.end },
            },
            select: { id: true, crashedAt: true },
        }),
        prisma.issue.findMany({
            where: {
                projectId: { in: projectIds },
                lastSeen: { gte: timeRange.start, lte: timeRange.end },
            },
            select: {
                id: true,
                fingerprint: true,
                title: true,
                eventCount: true,
                firstSeen: true,
                lastSeen: true,
                projectId: true,
            },
            orderBy: { eventCount: "desc" },
        }),
        prisma.release.findMany({
            where: {
                projectId: { in: projectIds },
                lastSeen: { gte: timeRange.start, lte: timeRange.end },
            },
            select: { id: true, version: true, lastSeen: true },
        }),
        prisma.monitorAlert.findMany({
            where: {
                monitor: { projectId: { in: projectIds } },
                triggeredAt: { gte: timeRange.start, lte: timeRange.end },
            },
            select: { id: true, triggeredAt: true },
        }),
        prisma.event.findMany({
            where: {
                projectId: { in: projectIds },
                type: "ERROR",
            },
            select: {
                fingerprint: true,
                service: true,
                timestamp: true,
            },
            take: 200,
        }),
    ]);

    // 3. Compute Real Availability & Error Budget
    const totalRequests = events.length;
    const totalErrors = events.filter((e) => e.type === "ERROR").length;
    const errorRatePct = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
    const hasSufficientTelemetry = totalRequests >= 5;

    const actualAvailability: number | null =
        totalRequests > 0 ? Math.max(0, Math.min(100, 100 - errorRatePct)) : null;

    const targetAvailability = 99.9;
    const allowedFailureRatePct = 100 - targetAvailability; // 0.1%

    const budgetConsumedPct: number | null =
        totalRequests > 0 && allowedFailureRatePct > 0 ? (errorRatePct / allowedFailureRatePct) * 100 : null;
    const budgetRemainingPct: number | null =
        budgetConsumedPct !== null ? Math.max(0, Math.min(100, Math.round((100 - budgetConsumedPct) * 10) / 10)) : null;
    const burnRate: number | null =
        totalRequests > 0 && allowedFailureRatePct > 0 ? Math.round((errorRatePct / allowedFailureRatePct) * 10) / 10 : null;

    const budgetStatus: ReliabilityLabData["errorBudget"]["budgetStatus"] =
        totalRequests === 0
            ? "Insufficient Evidence"
            : (budgetRemainingPct || 0) === 0
            ? "Exhausted"
            : (budgetConsumedPct || 0) > 50
            ? "Consumed"
            : "Remaining";

    const burnRateAssessment =
        totalRequests === 0
            ? "Insufficient telemetry to evaluate SLO consumption"
            : burnRate === 0
            ? "Zero budget burn during window"
            : (burnRate || 0) <= 1.0
            ? "Sustainable consumption within SLO target"
            : (burnRate || 0) <= 2.5
            ? "Elevated consumption — 2.5x standard burn"
            : "Critical burn — error budget exhausted / depleted rapidly";

    // Comparison for availability & error rate
    const compTotal = compEvents.length;
    const compErrors = compEvents.filter((e) => e.type === "ERROR").length;
    const compErrorRate = compTotal > 0 ? (compErrors / compTotal) * 100 : 0;
    const compAvailability: number | null = compTotal > 0 ? 100 - compErrorRate : null;

    const availComparison = calculateMetricComparison(actualAvailability, compAvailability, true, false);
    const budgetComparison = calculateMetricComparison(budgetRemainingPct, null, true, false);
    const consumedComparison = calculateMetricComparison(
        budgetConsumedPct !== null ? Math.min(100, budgetConsumedPct) : null,
        null,
        true,
        true
    );

    // Crash free sessions
    const totalSessions = sessions.length;
    const crashedSessions = sessions.filter((s) => s.crashedAt !== null).length;
    const crashFreePct: number | null =
        totalSessions > 0 ? Math.round(((totalSessions - crashedSessions) / totalSessions) * 1000) / 10 : null;

    // Incident frequency per day
    const durationDays = (timeRange.end.getTime() - timeRange.start.getTime()) / (24 * 60 * 60 * 1000);
    const incidentFreqPerDay: number | null =
        issues.length > 0
            ? durationDays > 0
                ? Math.round((issues.length / durationDays) * 10) / 10
                : issues.length
            : totalRequests > 0
            ? 0.0
            : null;

    // Overall trend
    let overallTrend: TrendDirection = "Stable";
    if (totalRequests === 0) overallTrend = "Stable";
    else if (compTotal > 0 && errorRatePct > compErrorRate + 1.0) overallTrend = "Degrading";
    else if (compTotal > 0 && errorRatePct < compErrorRate - 1.0) overallTrend = "Improving";
    else if (errorRatePct > 5.0) overallTrend = "Volatile";

    // 4. Build Trajectory Timeline Buckets (Timezone-Aware)
    const userTimezone = params.userTimezone || "UTC";
    const rawBuckets = generateTimeBuckets(timeRange.start, timeRange.end, timeRange.bucketCount, userTimezone);
    const trajectory = rawBuckets.map((bucket) => {
        const bStartMs = bucket.start.getTime();
        const bEndMs = bucket.end.getTime();

        const bEvents = events.filter((e) => {
            const t = e.timestamp.getTime();
            return t >= bStartMs && t < bEndMs;
        });

        const bErrors = bEvents.filter((e) => e.type === "ERROR").length;
        const bTotal = bEvents.length;
        const bErrorRate = bTotal > 0 ? Math.round((bErrors / bTotal) * 1000) / 10 : 0;
        const bAvail = bTotal > 0 ? Math.max(0, Math.min(100, Math.round((100 - bErrorRate) * 10) / 10)) : null;

        const bIncidents = issues.filter((i) => {
            const t = i.lastSeen.getTime();
            return t >= bStartMs && t < bEndMs;
        }).length;

        const bReleases = releases.filter((r) => {
            const t = r.lastSeen.getTime();
            return t >= bStartMs && t < bEndMs;
        }).length;

        const bAlerts = alerts.filter((a) => {
            const t = a.triggeredAt.getTime();
            return t >= bStartMs && t < bEndMs;
        }).length;

        return {
            timestamp: bucket.start.toISOString(),
            formattedTime: bucket.formattedTime,
            timeZoneAbbr: bucket.timeZoneAbbr,
            availabilityPct: bAvail,
            errorRate: bErrorRate,
            incidentCount: bIncidents,
            releaseCount: bReleases,
            monitorTriggerCount: bAlerts,
            hasObservation: bTotal > 0,
        };
    });

    // 5. Calculate Reliability Contributors (by Service)
    const serviceErrorMap = new Map<string, { service: string; errorCount: number; totalCount: number }>();
    for (const evt of events) {
        const sName = evt.service || "(unnamed-service)";
        const entry = serviceErrorMap.get(sName) || { service: sName, errorCount: 0, totalCount: 0 };
        entry.totalCount++;
        if (evt.type === "ERROR") entry.errorCount++;
        serviceErrorMap.set(sName, entry);
    }

    const contributors = Array.from(serviceErrorMap.values())
        .map((s) => {
            const share = totalErrors > 0 ? Math.round((s.errorCount / totalErrors) * 1000) / 10 : 0;
            const errorBudgetConsumed =
                allowedFailureRatePct > 0
                    ? Math.round(((s.errorCount / (totalRequests || 1)) / allowedFailureRatePct) * 1000) / 10
                    : 0;

            const downtimeEst = Math.round((s.errorCount / (totalErrors || 1)) * 15 * 10) / 10;
            const trend: TrendDirection = s.errorCount > 10 ? "Degrading" : s.errorCount > 0 ? "Volatile" : "Stable";

            return {
                service: s.service,
                failedRequestCount: s.errorCount,
                failedRequestSharePct: share,
                errorBudgetConsumedPct: Math.min(100, errorBudgetConsumed),
                downtimeMinutesEstimate: downtimeEst,
                trend,
            };
        })
        .sort((a, b) => b.failedRequestCount - a.failedRequestCount);

    // 6. Detect Real Recurring Failure Patterns & Compute Reliability Debt
    const patternMap = new Map<
        string,
        {
            fingerprint: string;
            title: string;
            occurrenceCount: number;
            services: Set<string>;
            releases: Set<string>;
            endpoints: Set<string>;
            firstSeen: Date;
            lastSeen: Date;
            activeIssueId?: string;
            stack?: string | null;
        }
    >();

    for (const iss of issues) {
        const fp = iss.fingerprint || iss.id;
        patternMap.set(fp, {
            fingerprint: fp,
            title: iss.title,
            occurrenceCount: iss.eventCount,
            services: new Set<string>(),
            releases: new Set<string>(),
            endpoints: new Set<string>(),
            firstSeen: iss.firstSeen,
            lastSeen: iss.lastSeen,
            activeIssueId: iss.id,
        });
    }

    for (const evt of events) {
        if (evt.type !== "ERROR") continue;
        const fp = evt.fingerprint || evt.issueId || evt.title || "unhandled-exception";
        const existing = patternMap.get(fp) || {
            fingerprint: fp,
            title: evt.title || "Unhandled Exception",
            occurrenceCount: 0,
            services: new Set<string>(),
            releases: new Set<string>(),
            endpoints: new Set<string>(),
            firstSeen: evt.timestamp,
            lastSeen: evt.timestamp,
            stack: evt.stack,
        };

        existing.occurrenceCount++;
        if (evt.service) existing.services.add(evt.service);
        if (evt.release) existing.releases.add(evt.release);
        if (evt.resource) existing.endpoints.add(evt.resource);
        if (evt.timestamp < existing.firstSeen) existing.firstSeen = evt.timestamp;
        if (evt.timestamp > existing.lastSeen) existing.lastSeen = evt.timestamp;
        if (evt.stack && !existing.stack) existing.stack = evt.stack;

        patternMap.set(fp, existing);
    }

    // Historical matches counter
    const historicalFpCounts = new Map<string, number>();
    for (const h of allHistoricalEvents) {
        if (h.fingerprint) {
            historicalFpCounts.set(h.fingerprint, (historicalFpCounts.get(h.fingerprint) || 0) + 1);
        }
    }

    const recurringPatterns: RecurringPatternItem[] = Array.from(patternMap.values())
        .filter((p) => p.occurrenceCount > 0)
        .map((p) => ({
            id: p.fingerprint,
            fingerprint: p.fingerprint,
            title: p.title,
            occurrenceCount: p.occurrenceCount,
            affectedServices: Array.from(p.services),
            affectedReleases: Array.from(p.releases),
            affectedEndpoints: Array.from(p.endpoints),
            firstObservedAt: p.firstSeen.toISOString(),
            lastObservedAt: p.lastSeen.toISOString(),
            trend: (p.occurrenceCount > 5 ? "Degrading" : "Stable") as TrendDirection,
            activeIssueId: p.activeIssueId,
            sampleStack: p.stack,
            historicalMatchesCount: historicalFpCounts.get(p.fingerprint) || p.occurrenceCount,
        }))
        .sort((a, b) => b.occurrenceCount - a.occurrenceCount);

    // Compute Reliability Debt: items with multiple occurrences draining capacity
    const reliabilityDebt: ReliabilityDebtItem[] = recurringPatterns
        .filter((p) => p.occurrenceCount >= 2)
        .map((p) => ({
            id: `debt-${p.fingerprint}`,
            fingerprint: p.fingerprint,
            title: p.title,
            occurrenceCount: p.occurrenceCount,
            affectedServices: p.affectedServices,
            affectedReleases: p.affectedReleases,
            affectedEndpoints: p.affectedEndpoints,
            firstSeen: p.firstObservedAt,
            lastSeen: p.lastObservedAt,
            recurrenceTrend: p.trend,
            severity: p.occurrenceCount >= 10 ? "CRITICAL" : p.occurrenceCount >= 4 ? "HIGH" : "MEDIUM",
            evidenceQuality: p.occurrenceCount >= 5 ? "Very High" : "High",
            estimatedReliabilityImpactMinutes: Math.round(p.occurrenceCount * 1.5 * 10) / 10,
        }));

    const limitations: string[] = [];
    if (events.length < 10) {
        limitations.push("Small telemetry event volume limits long-term SLO burn rate accuracy.");
    }

    const dataQuality: DataProvenance["dataQuality"] =
        events.length === 0
            ? "No telemetry"
            : events.length < 10
            ? "Insufficient observations"
            : "Complete";

    const provenance: DataProvenance = {
        sources: ["PostgreSQL Event Store", "Session Stability Registry", "Issue Index", "SLO Calculator"],
        projectId: params.projectId !== "ALL" ? params.projectId : undefined,
        projectName: params.projectId && params.projectId !== "ALL" ? projectNameMap.get(params.projectId) : "All Organization Projects",
        environment: params.environment || "All Environments",
        timeRange: {
            key: timeRange.key,
            start: timeRange.start.toISOString(),
            end: timeRange.end.toISOString(),
        },
        comparisonRange: timeRange.comparisonStart
            ? {
                  start: timeRange.comparisonStart.toISOString(),
                  end: timeRange.comparisonEnd!.toISOString(),
              }
            : undefined,
        totalEventsAnalyzed: events.length,
        totalTracesAnalyzed: events.filter((e) => e.type === "TRACE").length,
        totalErrorsAnalyzed: totalErrors,
        methodology: "Standard 99.9% target SLO burn rate calculations, fingerprint recurrence analysis, and reliability debt quantification.",
        dataQuality,
        limitations,
        lastCalculatedAt: new Date().toISOString(),
    };

    return {
        posture: {
            availabilityPct: {
                title: "Availability",
                value: actualAvailability !== null ? `${actualAvailability.toFixed(2)}%` : "Insufficient evidence",
                unit: actualAvailability !== null ? "%" : undefined,
                target: targetAvailability,
                status:
                    actualAvailability !== null
                        ? actualAvailability >= 99.9
                            ? "HEALTHY"
                            : actualAvailability >= 99.0
                            ? "DEGRADED"
                            : "CRITICAL"
                        : "UNAVAILABLE",
                definition: "Proportion of total telemetry events completed without unhandled errors.",
                methodology: "Availability = (1 - (errorCount / requestCount)) * 100",
                comparison: availComparison,
            },
            errorBudgetRemainingPct: {
                title: "Error Budget Remaining",
                value: budgetRemainingPct !== null ? `${budgetRemainingPct}%` : "Insufficient evidence",
                unit: budgetRemainingPct !== null ? "%" : undefined,
                target: 100,
                status:
                    budgetRemainingPct !== null
                        ? budgetRemainingPct > 50
                            ? "HEALTHY"
                            : budgetRemainingPct > 20
                            ? "DEGRADED"
                            : "CRITICAL"
                        : "UNAVAILABLE",
                definition: "Remaining allowed failure capacity against the 99.9% SLO target.",
                methodology: "Budget Remaining = max(0, 100 - ((errorRate / 0.1) * 100))",
                comparison: budgetComparison,
            },
            errorBudgetConsumedPct: {
                title: "Error Budget Consumed",
                value: budgetConsumedPct !== null ? `${Math.min(100, Math.round(budgetConsumedPct * 10) / 10)}%` : "Insufficient evidence",
                unit: budgetConsumedPct !== null ? "%" : undefined,
                target: 0,
                status:
                    budgetConsumedPct !== null
                        ? budgetConsumedPct < 50
                            ? "HEALTHY"
                            : budgetConsumedPct < 80
                            ? "DEGRADED"
                            : "CRITICAL"
                        : "UNAVAILABLE",
                definition: "Proportion of the allowed 0.1% failure margin consumed by actual errors.",
                methodology: "Budget Consumed = (actualFailureRate / allowedFailureRate) * 100",
                comparison: consumedComparison,
            },
            burnRateMultiplier: {
                title: "Burn Rate",
                value: burnRate !== null ? `${burnRate}x` : "Insufficient evidence",
                status:
                    burnRate !== null
                        ? burnRate <= 1.0
                            ? "HEALTHY"
                            : burnRate <= 2.5
                            ? "DEGRADED"
                            : "CRITICAL"
                        : "UNAVAILABLE",
                definition: "Rate of error budget consumption relative to standard 30-day budget pace.",
                methodology: "Burn Rate = observed failure rate / allowed failure rate",
            },
            crashFreeSessionPct: {
                title: "Crash-Free Sessions",
                value: crashFreePct !== null ? `${crashFreePct}%` : "Insufficient evidence",
                unit: crashFreePct !== null ? "%" : undefined,
                target: 99.5,
                status: crashFreePct !== null ? (crashFreePct >= 99.5 ? "HEALTHY" : "DEGRADED") : "UNAVAILABLE",
                definition: "Percentage of client telemetry sessions that concluded without a fatal crash event.",
                methodology: "Crash Free % = ((totalSessions - crashedSessions) / totalSessions) * 100",
            },
            incidentFrequencyPerDay: {
                title: "Incident Frequency",
                value: incidentFreqPerDay !== null ? `${incidentFreqPerDay}/day` : "Insufficient evidence",
                status:
                    incidentFreqPerDay !== null
                        ? incidentFreqPerDay === 0
                            ? "HEALTHY"
                            : incidentFreqPerDay <= 2
                            ? "DEGRADED"
                            : "CRITICAL"
                        : "UNAVAILABLE",
                definition: "Normalized rate of new unique issue creations per 24 hours.",
                methodology: "Incidents Per Day = unique issues / time window days",
            },
            overallTrend,
        },
        errorBudget: {
            isConfigured: false,
            budgetStatus,
            targetAvailability,
            actualAvailability,
            allowedFailureRatePct,
            actualFailureRatePct: totalRequests > 0 ? Math.round(errorRatePct * 100) / 100 : null,
            budgetConsumedPct: budgetConsumedPct !== null ? Math.min(100, Math.round(budgetConsumedPct * 10) / 10) : null,
            budgetRemainingPct,
            burnRate,
            burnRateAssessment,
        },
        trajectory,
        contributors,
        reliabilityDebt,
        recurringPatterns,
        provenance,
    };
}

function createEmptyReliabilityData(timeRange: any, params: ReliabilityLabParams): ReliabilityLabData {
    return {
        posture: {
            availabilityPct: {
                title: "Availability",
                value: "Insufficient evidence",
                status: "UNAVAILABLE",
                definition: "Proportion of total telemetry events completed without unhandled errors.",
                methodology: "Availability = (1 - (errorCount / requestCount)) * 100",
            },
            errorBudgetRemainingPct: {
                title: "Error Budget Remaining",
                value: "Insufficient evidence",
                status: "UNAVAILABLE",
                definition: "Remaining allowed failure capacity against the 99.9% SLO target.",
                methodology: "Budget Remaining = max(0, 100 - ((errorRate / 0.1) * 100))",
            },
            errorBudgetConsumedPct: {
                title: "Error Budget Consumed",
                value: "Insufficient evidence",
                status: "UNAVAILABLE",
                definition: "Proportion of error budget consumed.",
                methodology: "Budget Consumed = (errorRate / allowedRate) * 100",
            },
            burnRateMultiplier: {
                title: "Burn Rate",
                value: "Insufficient evidence",
                status: "UNAVAILABLE",
                definition: "Rate of error budget consumption relative to standard pace.",
                methodology: "Burn Rate = observed failure rate / allowed failure rate",
            },
            crashFreeSessionPct: {
                title: "Crash-Free Sessions",
                value: "Insufficient evidence",
                status: "UNAVAILABLE",
                definition: "Percentage of client telemetry sessions without a crash.",
                methodology: "Telemetry session crash ratio.",
            },
            incidentFrequencyPerDay: {
                title: "Incident Frequency",
                value: "Insufficient evidence",
                status: "UNAVAILABLE",
                definition: "Normalized rate of new issues created per day.",
                methodology: "Unique issues / days.",
            },
            overallTrend: "Unknown",
        },
        errorBudget: {
            isConfigured: false,
            budgetStatus: "Insufficient Evidence",
            targetAvailability: 99.9,
            actualAvailability: null,
            allowedFailureRatePct: 0.1,
            actualFailureRatePct: null,
            budgetConsumedPct: null,
            budgetRemainingPct: null,
            burnRate: null,
            burnRateAssessment: "No active telemetry to evaluate error budget.",
        },
        trajectory: [],
        contributors: [],
        reliabilityDebt: [],
        recurringPatterns: [],
        provenance: {
            sources: ["PostgreSQL Event Store"],
            timeRange: {
                key: timeRange.key,
                start: timeRange.start.toISOString(),
                end: timeRange.end.toISOString(),
            },
            totalEventsAnalyzed: 0,
            totalTracesAnalyzed: 0,
            totalErrorsAnalyzed: 0,
            methodology: "SLO budget burn pace.",
            dataQuality: "No telemetry",
            lastCalculatedAt: new Date().toISOString(),
        },
    };
}
