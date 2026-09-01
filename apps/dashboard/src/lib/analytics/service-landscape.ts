import { prisma } from "@/lib/prisma";
import type {
    ServiceLandscapeData,
    ServiceLandscapeItem,
    ServiceLandscapeRankings,
    ServiceDetailedContext,
    ServiceHealthStatus,
    TrendDirection,
    DataProvenance,
    InvestigationPriority,
} from "./types";
import { parseTimeRange, calculateMetricComparison, generateTimeBuckets } from "./time";

export interface ServiceLandscapeParams {
    organizationId: string;
    projectId?: string;
    environment?: string;
    timeRangeKey?: string;
    service?: string;
    userTimezone?: string;
}

export async function fetchServiceLandscapeAnalytics(
    params: ServiceLandscapeParams
): Promise<ServiceLandscapeData> {
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
        return createEmptyServiceLandscapeData(timeRange, params);
    }

    // 2. Build Event Filter for Current and Previous Period
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

    const compEventFilter: any = {
        projectId: { in: projectIds },
        timestamp: {
            gte: timeRange.comparisonStart!,
            lte: timeRange.comparisonEnd!,
        },
    };
    if (params.environment && params.environment !== "ALL") {
        compEventFilter.environment = { name: params.environment };
    }

    // 3. Query primary events, comparison events, releases, and issues in parallel
    const [primaryEvents, comparisonEvents, releases, issues, firingAlerts] = await Promise.all([
        prisma.event.findMany({
            where: eventFilter,
            select: {
                id: true,
                type: true,
                severity: true,
                timestamp: true,
                durationMs: true,
                service: true,
                projectId: true,
                traceId: true,
                resource: true,
                operation: true,
                fingerprint: true,
            },
        }),
        prisma.event.findMany({
            where: compEventFilter,
            select: {
                id: true,
                type: true,
                durationMs: true,
                service: true,
                projectId: true,
                fingerprint: true,
            },
        }),
        prisma.release.findMany({
            where: {
                projectId: { in: projectIds },
                lastSeen: { gte: timeRange.start, lte: timeRange.end },
            },
            select: { id: true, version: true, projectId: true },
        }),
        prisma.issue.findMany({
            where: {
                projectId: { in: projectIds },
                status: "OPEN",
            },
            select: { id: true, title: true, severity: true, projectId: true, fingerprint: true },
        }),
        prisma.monitorAlert.findMany({
            where: {
                status: "OPEN",
                monitor: { projectId: { in: projectIds } },
            },
            select: { id: true, monitor: { select: { name: true, query: true } } },
        }),
    ]);

    const totalSystemErrors = primaryEvents.filter((e) => e.type === "ERROR").length;
    const totalSystemRequests = primaryEvents.length;

    // 4. Group Primary Telemetry by Service
    type ServiceAgg = {
        service: string;
        projectId: string;
        errorCount: number;
        fatalCount: number;
        totalCount: number;
        durations: number[];
        lastSeen: Date | null;
        traceIds: Set<string>;
        fingerprints: Map<string, number>;
    };

    const serviceMap = new Map<string, ServiceAgg>();

    for (const evt of primaryEvents) {
        const sName = evt.service || "unnamed-service";
        const key = `${sName}::${evt.projectId}`;
        const entry = serviceMap.get(key) || {
            service: sName,
            projectId: evt.projectId,
            errorCount: 0,
            fatalCount: 0,
            totalCount: 0,
            durations: [],
            lastSeen: null,
            traceIds: new Set<string>(),
            fingerprints: new Map<string, number>(),
        };

        entry.totalCount++;
        if (evt.type === "ERROR") {
            entry.errorCount++;
            if (evt.fingerprint) {
                entry.fingerprints.set(
                    evt.fingerprint,
                    (entry.fingerprints.get(evt.fingerprint) || 0) + 1
                );
            }
        }
        if (evt.severity === "FATAL") entry.fatalCount++;
        if (typeof evt.durationMs === "number" && evt.durationMs > 0) entry.durations.push(evt.durationMs);
        if (evt.traceId) entry.traceIds.add(evt.traceId);

        if (!entry.lastSeen || evt.timestamp > entry.lastSeen) {
            entry.lastSeen = evt.timestamp;
        }

        serviceMap.set(key, entry);
    }

    // 5. Group Comparison Telemetry by Service
    const compMap = new Map<string, { errorCount: number; totalCount: number; durations: number[] }>();
    for (const evt of comparisonEvents) {
        const sName = evt.service || "unnamed-service";
        const key = `${sName}::${evt.projectId}`;
        const entry = compMap.get(key) || { errorCount: 0, totalCount: 0, durations: [] };
        entry.totalCount++;
        if (evt.type === "ERROR") entry.errorCount++;
        if (typeof evt.durationMs === "number" && evt.durationMs > 0) entry.durations.push(evt.durationMs);
        compMap.set(key, entry);
    }

    // 6. Compute Canonical Service Matrix
    const services: ServiceLandscapeItem[] = Array.from(serviceMap.values()).map((s) => {
        const errorRate = s.totalCount > 0 ? Math.round((s.errorCount / s.totalCount) * 1000) / 10 : 0;
        const failureContributionPct =
            totalSystemErrors > 0 ? Math.round((s.errorCount / totalSystemErrors) * 1000) / 10 : 0;
        const trafficSharePct =
            totalSystemRequests > 0 ? Math.round((s.totalCount / totalSystemRequests) * 1000) / 10 : 0;

        s.durations.sort((a, b) => a - b);
        const avgLatencyMs =
            s.durations.length > 0
                ? Math.round(s.durations.reduce((sum, d) => sum + d, 0) / s.durations.length)
                : null;
        const p95LatencyMs =
            s.durations.length > 0
                ? s.durations[Math.floor(s.durations.length * 0.95)] || s.durations[s.durations.length - 1]
                : null;

        // Comparison metrics
        const comp = compMap.get(`${s.service}::${s.projectId}`);
        const prevErrorRate = comp && comp.totalCount > 0 ? (comp.errorCount / comp.totalCount) * 100 : null;
        comp?.durations.sort((a, b) => a - b);
        const prevAvgLatency =
            comp && comp.durations.length > 0
                ? comp.durations.reduce((sum, d) => sum + d, 0) / comp.durations.length
                : null;

        const errorRateComparison = calculateMetricComparison(errorRate, prevErrorRate, true, true);
        const latencyComparison = calculateMetricComparison(avgLatencyMs || 0, prevAvgLatency, false, true);

        // Health Evaluation & Rationale
        let health: ServiceHealthStatus = "Healthy";
        let healthReason = "Normal error rate and stable response latencies.";

        const hasFiringAlert = firingAlerts.some(
            (a) => a.monitor.query?.includes(s.service) || a.monitor.name.toLowerCase().includes(s.service.toLowerCase())
        );

        if (s.totalCount === 0) {
            health = "Unknown";
            healthReason = "No telemetry observed during this period.";
        } else if (s.fatalCount > 0 || errorRate >= 20 || hasFiringAlert) {
            health = "Critical";
            if (s.fatalCount > 0) {
                healthReason = `Critical — ${s.fatalCount} fatal exceptions detected with ${errorRate}% error rate.`;
            } else if (hasFiringAlert) {
                healthReason = "Critical — active firing monitor alert associated with this service.";
            } else {
                healthReason = `Critical — high failure rate of ${errorRate}% (${s.errorCount} errors).`;
            }
        } else if (errorRate >= 5 || (errorRateComparison.relativeDiffPct !== null && errorRateComparison.relativeDiffPct > 50)) {
            health = "Degraded";
            if (errorRateComparison.relativeDiffPct !== null && errorRateComparison.relativeDiffPct > 50) {
                healthReason = `Degraded — error rate increased ${(errorRateComparison.relativeDiffPct / 100 + 1).toFixed(1)}× compared to baseline.`;
            } else {
                healthReason = `Degraded — elevated error rate of ${errorRate}%.`;
            }
        }

        // Investigation Priority
        const priorityReasons: string[] = [];
        let priorityScore = 0;
        if (failureContributionPct > 30) {
            priorityScore += 3;
            priorityReasons.push(`${failureContributionPct}% of all system failures`);
        }
        if ((errorRateComparison.relativeDiffPct || 0) > 50) {
            priorityScore += 2;
            priorityReasons.push(`${(errorRateComparison.relativeDiffPct! / 100 + 1).toFixed(1)}× baseline error rate increase`);
        }
        if (health === "Critical") {
            priorityScore += 3;
            priorityReasons.push("Critical service health state");
        }
        if (hasFiringAlert) {
            priorityScore += 2;
            priorityReasons.push("Active firing alert triggered");
        }

        const activeIssuesCount = issues.filter(
            (i) => i.projectId === s.projectId && i.title.toLowerCase().includes(s.service.toLowerCase())
        ).length;

        if (activeIssuesCount > 0) {
            priorityScore += 1;
            priorityReasons.push(`${activeIssuesCount} correlated active issue(s)`);
        }

        const priorityLevel: InvestigationPriority["level"] =
            priorityScore >= 5 ? "Very High" : priorityScore >= 3 ? "High" : priorityScore >= 1 ? "Medium" : "Low";

        const investigationPriority: InvestigationPriority = {
            level: priorityLevel,
            score: priorityScore,
            reasons: priorityReasons.length > 0 ? priorityReasons : ["Stable operational metrics"],
        };

        // Trend calculation
        let trend: TrendDirection = "Stable";
        if (errorRateComparison.relativeDiffPct !== null) {
            if (errorRateComparison.relativeDiffPct > 30) trend = "Degrading";
            else if (errorRateComparison.relativeDiffPct < -30) trend = "Improving";
            else trend = "Stable";
        } else if (errorRate > 15) {
            trend = "Volatile";
        }

        const recentReleasesCount = releases.filter((r) => r.projectId === s.projectId).length;
        const dependencyCount = Math.max(1, Math.min(s.traceIds.size, 5));

        // Find most recurring fingerprint
        let topFp: string | undefined = undefined;
        let topFpCount = 0;
        for (const [fp, count] of s.fingerprints.entries()) {
            if (count > topFpCount) {
                topFpCount = count;
                topFp = fp;
            }
        }

        return {
            service: s.service,
            projectId: s.projectId,
            projectName: projectNameMap.get(s.projectId) || "Unknown",
            health,
            healthReason,
            investigationPriority,
            errorCount: s.errorCount,
            totalCount: s.totalCount,
            errorRate,
            errorRateComparison,
            avgLatencyMs,
            p95LatencyMs,
            latencyComparison,
            requestCount: s.totalCount,
            failureContributionPct,
            trafficSharePct,
            dependencyCount,
            trend,
            lastSeen: s.lastSeen ? s.lastSeen.toISOString() : null,
            activeIssuesCount,
            recentReleasesCount,
            mostRecurringFingerprint: topFp,
        };
    });

    services.sort((a, b) => b.failureContributionPct - a.failureContributionPct || b.requestCount - a.requestCount);

    // 7. Calculate Service Rankings
    const highestFailureContributors = [...services]
        .filter((s) => s.errorCount > 0)
        .sort((a, b) => b.failureContributionPct - a.failureContributionPct)
        .slice(0, 4)
        .map((s) => ({
            service: s.service,
            failureContributionPct: s.failureContributionPct,
            errorCount: s.errorCount,
        }));

    const fastestDegrading = [...services]
        .filter((s) => (s.errorRateComparison?.relativeDiffPct || 0) > 0)
        .sort((a, b) => (b.errorRateComparison?.relativeDiffPct || 0) - (a.errorRateComparison?.relativeDiffPct || 0))
        .slice(0, 4)
        .map((s) => ({
            service: s.service,
            errorRateChange: s.errorRateComparison?.relativeDiffPct || 0,
            currentRate: s.errorRate,
        }));

    const highestLatencyRegressions = [...services]
        .filter((s) => (s.latencyComparison?.absoluteDiff || 0) > 0 && s.p95LatencyMs !== null)
        .sort((a, b) => (b.latencyComparison?.absoluteDiff || 0) - (a.latencyComparison?.absoluteDiff || 0))
        .slice(0, 4)
        .map((s) => ({
            service: s.service,
            latencyDiffMs: s.latencyComparison?.absoluteDiff || 0,
            currentP95Ms: s.p95LatencyMs || 0,
        }));

    const highestTrafficExposure = [...services]
        .sort((a, b) => b.requestCount - a.requestCount)
        .slice(0, 4)
        .map((s) => ({
            service: s.service,
            requestCount: s.requestCount,
            requestSharePct: s.trafficSharePct,
        }));

    const highestReliabilityRisk = [...services]
        .sort((a, b) => b.investigationPriority.score - a.investigationPriority.score)
        .slice(0, 4)
        .map((s) => ({
            service: s.service,
            priority: s.investigationPriority.level,
            errorRate: s.errorRate,
        }));

    const mostRecurringFailures = [...services]
        .filter((s) => s.errorCount > 0)
        .sort((a, b) => b.errorCount - a.errorCount)
        .slice(0, 4)
        .map((s) => ({
            service: s.service,
            recurrenceCount: s.errorCount,
        }));

    const rankings: ServiceLandscapeRankings = {
        highestFailureContributors,
        fastestDegrading,
        highestLatencyRegressions,
        highestTrafficExposure,
        highestReliabilityRisk,
        mostRecurringFailures,
    };

    const summary = {
        totalServices: services.length,
        healthyCount: services.filter((s) => s.health === "Healthy").length,
        degradedCount: services.filter((s) => s.health === "Degraded").length,
        criticalCount: services.filter((s) => s.health === "Critical").length,
        unknownCount: services.filter((s) => s.health === "Unknown").length,
    };

    const limitations: string[] = [];
    if (primaryEvents.length < 10) {
        limitations.push("Low event volume (< 10 total requests) across services.");
    }

    const dataQuality: DataProvenance["dataQuality"] =
        primaryEvents.length === 0
            ? "No telemetry"
            : primaryEvents.length < 10
            ? "Insufficient observations"
            : "Complete";

    const provenance: DataProvenance = {
        sources: ["PostgreSQL Event Store", "Trace Latency Aggregator", "Issue Tracker", "Monitor Alert Pipeline"],
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
        totalEventsAnalyzed: primaryEvents.length,
        totalTracesAnalyzed: primaryEvents.filter((e) => e.type === "TRACE").length,
        totalErrorsAnalyzed: totalSystemErrors,
        methodology: "Cross-service matrix aggregation with deterministic threshold classification rules.",
        dataQuality,
        limitations,
        lastCalculatedAt: new Date().toISOString(),
    };

    return {
        services,
        rankings,
        summary,
        provenance,
    };
}

export async function fetchServiceDetailedContext(
    serviceName: string,
    projectId: string,
    timeRangeKey: string = "24h",
    userTimezone: string = "UTC"
): Promise<ServiceDetailedContext | null> {
    const timeRange = parseTimeRange(timeRangeKey, "PREVIOUS_PERIOD");

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, name: true },
    });

    if (!project) return null;

    const [events, releases, issues, investigations, allTracedEvents] = await Promise.all([
        prisma.event.findMany({
            where: {
                projectId,
                service: serviceName,
                timestamp: { gte: timeRange.start, lte: timeRange.end },
            },
            select: {
                id: true,
                type: true,
                severity: true,
                timestamp: true,
                durationMs: true,
                traceId: true,
                resource: true,
                operation: true,
                fingerprint: true,
                title: true,
            },
            orderBy: { timestamp: "asc" },
        }),
        prisma.release.findMany({
            where: { projectId },
            select: { id: true, version: true, lastSeen: true, eventCount: true, errorCount: true },
            orderBy: { lastSeen: "desc" },
            take: 5,
        }),
        prisma.issue.findMany({
            where: {
                projectId,
                OR: [
                    { title: { contains: serviceName, mode: "insensitive" } },
                    { status: "OPEN" },
                ],
            },
            select: { id: true, title: true, severity: true, status: true, eventCount: true, lastSeen: true },
            orderBy: { lastSeen: "desc" },
            take: 6,
        }),
        prisma.investigation.findMany({
            where: { projectId },
            select: { id: true, title: true, status: true, rootCause: true, confidenceScore: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 5,
        }),
        // Fetch real distributed traces connecting to or from this service
        prisma.event.findMany({
            where: {
                projectId,
                timestamp: { gte: timeRange.start, lte: timeRange.end },
                traceId: { not: null },
            },
            select: {
                id: true,
                type: true,
                service: true,
                resource: true,
                traceId: true,
                durationMs: true,
                timestamp: true,
            },
        }),
    ]);

    const errorEvents = events.filter((e) => e.type === "ERROR");
    const errorCount = errorEvents.length;
    const requestCount = events.length;
    const errorRate = requestCount > 0 ? Math.round((errorCount / requestCount) * 1000) / 10 : 0;

    const durations = events
        .map((e) => e.durationMs)
        .filter((d): d is number => typeof d === "number" && d > 0)
        .sort((a, b) => a - b);

    const avgLatencyMs =
        durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
    const p95LatencyMs =
        durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] || durations[durations.length - 1] : null;

    const health: ServiceHealthStatus =
        requestCount === 0 ? "Unknown" : errorRate >= 20 ? "Critical" : errorRate >= 5 ? "Degraded" : "Healthy";

    const healthReason =
        health === "Critical"
            ? `Critical failure rate of ${errorRate}% with ${errorCount} errors.`
            : health === "Degraded"
            ? `Elevated error rate of ${errorRate}%.`
            : "Operating within normal stability targets.";

    // Real Upstream & Downstream Dependencies extracted strictly from trace groupings
    const traceMap = new Map<string, typeof allTracedEvents>();
    for (const evt of allTracedEvents) {
        if (!evt.traceId) continue;
        const list = traceMap.get(evt.traceId) || [];
        list.push(evt);
        traceMap.set(evt.traceId, list);
    }

    const upstreamMap = new Map<string, { service: string; callCount: number; errorCount: number; durations: number[] }>();
    const downstreamMap = new Map<string, { service: string; callCount: number; errorCount: number; durations: number[] }>();

    for (const [, spanList] of traceMap.entries()) {
        spanList.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        for (let i = 0; i < spanList.length; i++) {
            if (spanList[i].service === serviceName) {
                // Predecessor is upstream caller
                if (i > 0 && spanList[i - 1].service && spanList[i - 1].service !== serviceName) {
                    const caller = spanList[i - 1].service!;
                    const entry = upstreamMap.get(caller) || { service: caller, callCount: 0, errorCount: 0, durations: [] };
                    entry.callCount++;
                    if (spanList[i].type === "ERROR") entry.errorCount++;
                    if (typeof spanList[i].durationMs === "number") entry.durations.push(spanList[i].durationMs!);
                    upstreamMap.set(caller, entry);
                }
                // Successor is downstream target
                if (i < spanList.length - 1 && spanList[i + 1].service && spanList[i + 1].service !== serviceName) {
                    const target = spanList[i + 1].service!;
                    const entry = downstreamMap.get(target) || { service: target, callCount: 0, errorCount: 0, durations: [] };
                    entry.callCount++;
                    if (spanList[i + 1].type === "ERROR") entry.errorCount++;
                    if (typeof spanList[i + 1].durationMs === "number") entry.durations.push(spanList[i + 1].durationMs!);
                    downstreamMap.set(target, entry);
                }
            }
        }
    }

    // Connect recorded resources as downstream targets if observed
    for (const evt of events) {
        if (evt.resource && evt.resource !== serviceName) {
            const entry = downstreamMap.get(evt.resource) || { service: evt.resource, callCount: 0, errorCount: 0, durations: [] };
            entry.callCount++;
            if (evt.type === "ERROR") entry.errorCount++;
            if (typeof evt.durationMs === "number") entry.durations.push(evt.durationMs);
            downstreamMap.set(evt.resource, entry);
        }
    }

    const upstream = Array.from(upstreamMap.values()).map((u) => ({
        service: u.service,
        callCount: u.callCount,
        errorRate: Math.round((u.errorCount / u.callCount) * 1000) / 10,
        avgLatencyMs: u.durations.length > 0 ? Math.round(u.durations.reduce((a, b) => a + b, 0) / u.durations.length) : null,
    }));

    const downstream = Array.from(downstreamMap.values()).map((d) => ({
        service: d.service,
        callCount: d.callCount,
        errorRate: Math.round((d.errorCount / d.callCount) * 1000) / 10,
        avgLatencyMs: d.durations.length > 0 ? Math.round(d.durations.reduce((a, b) => a + b, 0) / d.durations.length) : null,
    }));

    // Recurring failures per fingerprint
    const fpMap = new Map<string, { fingerprint: string; title: string; count: number; firstSeen: Date; lastSeen: Date }>();
    for (const evt of events) {
        if (evt.type !== "ERROR") continue;
        const fp = evt.fingerprint || evt.title || "generic-error";
        const entry = fpMap.get(fp) || {
            fingerprint: fp,
            title: evt.title || "Unhandled Exception",
            count: 0,
            firstSeen: evt.timestamp,
            lastSeen: evt.timestamp,
        };
        entry.count++;
        if (evt.timestamp < entry.firstSeen) entry.firstSeen = evt.timestamp;
        if (evt.timestamp > entry.lastSeen) entry.lastSeen = evt.timestamp;
        fpMap.set(fp, entry);
    }

    const recurringFailures = Array.from(fpMap.values()).map((f) => ({
        fingerprint: f.fingerprint,
        title: f.title,
        count: f.count,
        firstSeen: f.firstSeen.toISOString(),
        lastSeen: f.lastSeen.toISOString(),
    })).sort((a, b) => b.count - a.count);

    // Generate time distribution buckets
    const rawBuckets = generateTimeBuckets(timeRange.start, timeRange.end, 12);
    const timeDistribution = rawBuckets.map((b) => {
        const bEvents = events.filter((e) => {
            const t = e.timestamp.getTime();
            return t >= b.start.getTime() && t < b.end.getTime();
        });
        return {
            timestamp: b.start.toISOString(),
            formattedTime: b.formattedTime,
            errorCount: bEvents.filter((e) => e.type === "ERROR").length,
            requestCount: bEvents.length,
        };
    });

    const investigationPriority: InvestigationPriority = {
        level: errorRate >= 20 ? "Very High" : errorRate >= 5 ? "High" : "Low",
        score: errorRate >= 20 ? 5 : errorRate >= 5 ? 3 : 0,
        reasons: errorRate >= 20 ? [`High failure rate (${errorRate}%)`] : ["Normal operational parameters"],
    };

    return {
        service: serviceName,
        projectId,
        projectName: project.name,
        health,
        healthReason,
        investigationPriority,
        metrics: {
            errorRate,
            errorCount,
            requestCount,
            avgLatencyMs,
            p95LatencyMs,
            failureContributionPct: 100.0,
            trafficSharePct: 100.0,
            trend: errorRate > 15 ? "Degrading" : "Stable",
        },
        observedDependencies: {
            upstream,
            downstream,
        },
        recentChanges: releases.map((r) => ({
            id: r.id,
            version: r.version,
            timestamp: r.lastSeen.toISOString(),
            eventCount: r.eventCount,
            errorCount: r.errorCount,
        })),
        activeIssues: issues.map((i) => ({
            id: i.id,
            title: i.title,
            severity: i.severity,
            status: i.status,
            eventCount: i.eventCount,
            lastSeen: i.lastSeen.toISOString(),
        })),
        recurringFailures,
        recentInvestigations: investigations.map((inv) => ({
            id: inv.id,
            title: inv.title,
            status: inv.status,
            rootCause: inv.rootCause,
            confidenceScore: inv.confidenceScore,
            createdAt: inv.createdAt.toISOString(),
        })),
        timeDistribution,
    };
}

function createEmptyServiceLandscapeData(timeRange: any, params: ServiceLandscapeParams): ServiceLandscapeData {
    return {
        services: [],
        rankings: {
            highestFailureContributors: [],
            fastestDegrading: [],
            highestLatencyRegressions: [],
            highestTrafficExposure: [],
            highestReliabilityRisk: [],
            mostRecurringFailures: [],
        },
        summary: {
            totalServices: 0,
            healthyCount: 0,
            degradedCount: 0,
            criticalCount: 0,
            unknownCount: 0,
        },
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
            methodology: "Cross-service matrix aggregation.",
            dataQuality: "No telemetry",
            lastCalculatedAt: new Date().toISOString(),
        },
    };
}
