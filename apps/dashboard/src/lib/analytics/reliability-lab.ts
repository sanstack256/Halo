import { prisma } from "@/lib/prisma";
import type {
    ReliabilityLabData,
    RecurringPatternItem,
    TrendDirection,
    DataProvenance,
} from "./types";
import { parseTimeRange, calculateMetricComparison, generateTimeBuckets } from "./time";

export interface ReliabilityLabParams {
    organizationId: string;
    projectId?: string;
    environment?: string;
    timeRangeKey?: string;
    service?: string;
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
    ]);

    // 3. Compute Real Availability & Error Budget
    const totalRequests = events.length;
    const totalErrors = events.filter((e) => e.type === "ERROR").length;
    const errorRatePct = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
    const actualAvailability =
        totalRequests > 0 ? Math.max(0, Math.min(100, 100 - errorRatePct)) : 100.0;

    const targetAvailability = 99.9;
    const allowedFailureRatePct = 100 - targetAvailability; // 0.1%

    const budgetConsumedPct =
        allowedFailureRatePct > 0 ? (errorRatePct / allowedFailureRatePct) * 100 : 0;
    const budgetRemainingPct = Math.max(0, Math.min(100, Math.round((100 - budgetConsumedPct) * 10) / 10));
    const burnRate =
        allowedFailureRatePct > 0 ? Math.round((errorRatePct / allowedFailureRatePct) * 10) / 10 : 0;

    const burnRateAssessment =
        burnRate === 0
            ? "Zero budget burn during window"
            : burnRate <= 1.0
            ? "Sustainable consumption within SLO target"
            : burnRate <= 2.5
            ? "Elevated consumption — 2.5x standard burn"
            : "Critical burn — depleting error budget rapidly";

    // Comparison for availability & error rate
    const compTotal = compEvents.length;
    const compErrors = compEvents.filter((e) => e.type === "ERROR").length;
    const compErrorRate = compTotal > 0 ? (compErrors / compTotal) * 100 : 0;
    const compAvailability = compTotal > 0 ? 100 - compErrorRate : 100.0;

    const availComparison = calculateMetricComparison(actualAvailability, compAvailability, true, false);
    const budgetComparison = calculateMetricComparison(budgetRemainingPct, null, true, false);

    // Crash free sessions
    const totalSessions = sessions.length;
    const crashedSessions = sessions.filter((s) => s.crashedAt !== null).length;
    const crashFreePct =
        totalSessions > 0 ? Math.round(((totalSessions - crashedSessions) / totalSessions) * 1000) / 10 : 100.0;

    // Incident frequency per day
    const durationDays = (timeRange.end.getTime() - timeRange.start.getTime()) / (24 * 60 * 60 * 1000);
    const incidentFreqPerDay =
        durationDays > 0 ? Math.round((issues.length / durationDays) * 10) / 10 : issues.length;

    // Overall trend
    let overallTrend: TrendDirection = "Stable";
    if (errorRatePct > compErrorRate + 1.0) overallTrend = "Degrading";
    else if (errorRatePct < compErrorRate - 1.0) overallTrend = "Improving";
    else if (errorRatePct > 5.0) overallTrend = "Volatile";

    // 4. Build Trajectory Timeline Buckets
    const rawBuckets = generateTimeBuckets(timeRange.start, timeRange.end, timeRange.bucketCount);
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
        const bAvail = bTotal > 0 ? Math.max(0, Math.min(100, Math.round((100 - bErrorRate) * 10) / 10)) : 100.0;

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
            availabilityPct: bAvail,
            errorRate: bErrorRate,
            incidentCount: bIncidents,
            releaseCount: bReleases,
            monitorTriggerCount: bAlerts,
        };
    });

    // 5. Calculate Reliability Contributors (by Service)
    const serviceErrorMap = new Map<string, { service: string; errorCount: number; totalCount: number }>();
    for (const evt of events) {
        const sName = evt.service || "web-service";
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

    // 6. Detect Real Recurring Failure Patterns
    const patternMap = new Map<
        string,
        {
            fingerprint: string;
            title: string;
            occurrenceCount: number;
            services: Set<string>;
            releases: Set<string>;
            firstSeen: Date;
            lastSeen: Date;
            activeIssueId?: string;
            stack?: string | null;
        }
    >();

    // From real issues
    for (const iss of issues) {
        const fp = iss.fingerprint || iss.id;
        patternMap.set(fp, {
            fingerprint: fp,
            title: iss.title,
            occurrenceCount: iss.eventCount,
            services: new Set<string>(),
            releases: new Set<string>(),
            firstSeen: iss.firstSeen,
            lastSeen: iss.lastSeen,
            activeIssueId: iss.id,
        });
    }

    // Correlate with event attributes
    for (const evt of events) {
        if (evt.type !== "ERROR") continue;
        const fp = evt.fingerprint || evt.issueId || evt.title;
        const existing = patternMap.get(fp) || {
            fingerprint: fp,
            title: evt.title,
            occurrenceCount: 0,
            services: new Set<string>(),
            releases: new Set<string>(),
            firstSeen: evt.timestamp,
            lastSeen: evt.timestamp,
            stack: evt.stack,
        };

        existing.occurrenceCount++;
        if (evt.service) existing.services.add(evt.service);
        if (evt.release) existing.releases.add(evt.release);
        if (evt.timestamp < existing.firstSeen) existing.firstSeen = evt.timestamp;
        if (evt.timestamp > existing.lastSeen) existing.lastSeen = evt.timestamp;
        if (evt.stack && !existing.stack) existing.stack = evt.stack;

        patternMap.set(fp, existing);
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
            firstObservedAt: p.firstSeen.toISOString(),
            lastObservedAt: p.lastSeen.toISOString(),
            trend: (p.occurrenceCount > 5 ? "Degrading" : "Stable") as TrendDirection,
            activeIssueId: p.activeIssueId,
            sampleStack: p.stack,
        }))
        .sort((a, b) => b.occurrenceCount - a.occurrenceCount);

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
        methodology: "Standard 99.9% target SLO burn rate calculations & fingerprint-based failure recurrence grouping.",
        dataQuality,
        lastCalculatedAt: new Date().toISOString(),
    };

    return {
        posture: {
            availabilityPct: {
                title: "Availability",
                value: `${actualAvailability.toFixed(2)}%`,
                unit: "%",
                target: targetAvailability,
                status: actualAvailability >= 99.9 ? "HEALTHY" : actualAvailability >= 99.0 ? "DEGRADED" : "CRITICAL",
                definition: "Proportion of total telemetry events completed without unhandled errors.",
                methodology: "Availability = (1 - (errorCount / requestCount)) * 100",
                comparison: availComparison,
            },
            errorBudgetRemainingPct: {
                title: "Error Budget Remaining",
                value: `${budgetRemainingPct}%`,
                unit: "%",
                target: 100,
                status: budgetRemainingPct > 50 ? "HEALTHY" : budgetRemainingPct > 20 ? "DEGRADED" : "CRITICAL",
                definition: "Remaining allowed failure capacity against the 99.9% SLO target.",
                methodology: "Budget Remaining = max(0, 100 - ((errorRate / 0.1) * 100))",
                comparison: budgetComparison,
            },
            burnRateMultiplier: {
                title: "Burn Rate",
                value: `${burnRate}x`,
                status: burnRate <= 1.0 ? "HEALTHY" : burnRate <= 2.5 ? "DEGRADED" : "CRITICAL",
                definition: "Rate of error budget consumption relative to standard 30-day budget pace.",
                methodology: "Burn Rate = observed failure rate / allowed failure rate",
            },
            crashFreeSessionPct: {
                title: "Crash-Free Sessions",
                value: `${crashFreePct}%`,
                unit: "%",
                target: 99.5,
                status: crashFreePct >= 99.5 ? "HEALTHY" : "DEGRADED",
                definition: "Percentage of client telemetry sessions that concluded without a fatal crash event.",
                methodology: "Crash Free % = ((totalSessions - crashedSessions) / totalSessions) * 100",
            },
            incidentFrequencyPerDay: {
                title: "Incident Frequency",
                value: `${incidentFreqPerDay}/day`,
                status: incidentFreqPerDay === 0 ? "HEALTHY" : incidentFreqPerDay <= 2 ? "DEGRADED" : "CRITICAL",
                definition: "Normalized rate of new unique issue creations per 24 hours.",
                methodology: "Incidents Per Day = unique issues / time window days",
            },
            overallTrend,
        },
        errorBudget: {
            isConfigured: true,
            targetAvailability,
            actualAvailability,
            allowedFailureRatePct,
            actualFailureRatePct: Math.round(errorRatePct * 100) / 100,
            budgetConsumedPct: Math.min(100, Math.round(budgetConsumedPct * 10) / 10),
            budgetRemainingPct,
            burnRate,
            burnRateAssessment,
        },
        trajectory,
        contributors,
        recurringPatterns,
        provenance,
    };
}

function createEmptyReliabilityData(timeRange: any, params: ReliabilityLabParams): ReliabilityLabData {
    return {
        posture: {
            availabilityPct: {
                title: "Availability",
                value: "Unavailable",
                status: "UNAVAILABLE",
                definition: "Proportion of total telemetry events completed without unhandled errors.",
                methodology: "Availability = (1 - (errorCount / requestCount)) * 100",
            },
            errorBudgetRemainingPct: {
                title: "Error Budget Remaining",
                value: "Unavailable",
                status: "UNAVAILABLE",
                definition: "Remaining allowed failure capacity against the 99.9% SLO target.",
                methodology: "Budget Remaining = max(0, 100 - ((errorRate / 0.1) * 100))",
            },
            burnRateMultiplier: {
                title: "Burn Rate",
                value: "0.0x",
                status: "HEALTHY",
                definition: "Rate of error budget consumption relative to standard pace.",
                methodology: "Burn Rate = observed failure rate / allowed failure rate",
            },
            crashFreeSessionPct: {
                title: "Crash-Free Sessions",
                value: "100%",
                status: "HEALTHY",
                definition: "Percentage of client telemetry sessions without a crash.",
                methodology: "Telemetry session crash ratio.",
            },
            incidentFrequencyPerDay: {
                title: "Incident Frequency",
                value: "0/day",
                status: "HEALTHY",
                definition: "Normalized rate of new issues created per day.",
                methodology: "Unique issues / days.",
            },
            overallTrend: "Unknown",
        },
        errorBudget: {
            isConfigured: false,
            targetAvailability: 99.9,
            actualAvailability: 100,
            allowedFailureRatePct: 0.1,
            actualFailureRatePct: 0,
            budgetConsumedPct: 0,
            budgetRemainingPct: 100,
            burnRate: 0,
            burnRateAssessment: "No active telemetry to evaluate error budget.",
        },
        trajectory: [],
        contributors: [],
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
