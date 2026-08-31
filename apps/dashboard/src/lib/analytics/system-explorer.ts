import { prisma } from "@/lib/prisma";
import type {
    SystemExplorerData,
    TimeBucketPoint,
    TimelineEventMarker,
    ServiceContributionItem,
    ChangeExplanation,
    EvidenceClassification,
    ServiceHealthStatus,
    DataProvenance,
} from "./types";
import { parseTimeRange, generateTimeBuckets, calculateMetricComparison } from "./time";

export interface SystemExplorerParams {
    organizationId: string;
    projectId?: string;
    environment?: string;
    timeRangeKey?: string;
    comparisonMode?: "PREVIOUS_PERIOD" | "NONE";
    service?: string;
}

export async function fetchSystemExplorerAnalytics(
    params: SystemExplorerParams
): Promise<SystemExplorerData> {
    const timeRange = parseTimeRange(params.timeRangeKey, params.comparisonMode || "PREVIOUS_PERIOD");

    // 1. Resolve Project Scoping
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
        return createEmptySystemExplorerData(timeRange, params);
    }

    // 2. Build Event Query Filter
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

    // Comparison Event Query Filter
    let compEventFilter: any = null;
    if (timeRange.comparisonStart && timeRange.comparisonEnd) {
        compEventFilter = {
            projectId: { in: projectIds },
            timestamp: {
                gte: timeRange.comparisonStart,
                lte: timeRange.comparisonEnd,
            },
        };
        if (params.environment && params.environment !== "ALL") {
            compEventFilter.environment = { name: params.environment };
        }
        if (params.service && params.service !== "ALL") {
            compEventFilter.service = params.service;
        }
    }

    // 3. Parallel Query Execution for Primary Window, Comparison Window & Markers
    const [
        primaryEvents,
        comparisonEvents,
        releases,
        issues,
        alerts,
        investigations,
        activeMonitorsFiring,
    ] = await Promise.all([
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
                issueId: true,
                release: true,
            },
            orderBy: { timestamp: "asc" },
        }),
        compEventFilter
            ? prisma.event.findMany({
                  where: compEventFilter,
                  select: {
                      id: true,
                      type: true,
                      timestamp: true,
                      durationMs: true,
                      service: true,
                  },
              })
            : Promise.resolve([]),
        prisma.release.findMany({
            where: {
                projectId: { in: projectIds },
                lastSeen: {
                    gte: timeRange.start,
                    lte: timeRange.end,
                },
            },
            select: {
                id: true,
                version: true,
                lastSeen: true,
                projectId: true,
            },
            orderBy: { lastSeen: "asc" },
        }),
        prisma.issue.findMany({
            where: {
                projectId: { in: projectIds },
                lastSeen: {
                    gte: timeRange.start,
                    lte: timeRange.end,
                },
            },
            select: {
                id: true,
                title: true,
                severity: true,
                status: true,
                lastSeen: true,
                eventCount: true,
                projectId: true,
            },
            orderBy: { lastSeen: "desc" },
        }),
        prisma.monitorAlert.findMany({
            where: {
                monitor: { projectId: { in: projectIds } },
                triggeredAt: {
                    gte: timeRange.start,
                    lte: timeRange.end,
                },
            },
            select: {
                id: true,
                status: true,
                conditionSummary: true,
                triggeredAt: true,
                monitor: { select: { id: true, name: true, projectId: true } },
            },
            orderBy: { triggeredAt: "asc" },
        }),
        prisma.investigation.findMany({
            where: {
                projectId: { in: projectIds },
                createdAt: {
                    gte: timeRange.start,
                    lte: timeRange.end,
                },
            },
            select: {
                id: true,
                title: true,
                createdAt: true,
                projectId: true,
            },
            orderBy: { createdAt: "asc" },
        }),
        prisma.monitor.count({
            where: {
                projectId: { in: projectIds },
                status: "FIRING",
            },
        }),
    ]);

    // 4. Generate Synchronized Time Buckets
    const rawBuckets = generateTimeBuckets(timeRange.start, timeRange.end, timeRange.bucketCount);
    const durationMs = timeRange.end.getTime() - timeRange.start.getTime();

    // Map events into buckets
    const timeline: TimeBucketPoint[] = rawBuckets.map((bucket) => {
        const bStartMs = bucket.start.getTime();
        const bEndMs = bucket.end.getTime();

        // Primary period events
        const bucketEvents = primaryEvents.filter((e) => {
            const t = e.timestamp.getTime();
            return t >= bStartMs && t < bEndMs;
        });

        const errorEvents = bucketEvents.filter((e) => e.type === "ERROR");
        const requestCount = bucketEvents.length;
        const errorCount = errorEvents.length;
        const errorRate = requestCount > 0 ? Math.round((errorCount / requestCount) * 1000) / 10 : 0;

        const durations = bucketEvents
            .map((e) => e.durationMs)
            .filter((d): d is number => typeof d === "number" && d > 0)
            .sort((a, b) => a - b);

        const avgLatencyMs =
            durations.length > 0
                ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
                : null;

        const p95LatencyMs =
            durations.length > 0
                ? durations[Math.floor(durations.length * 0.95)] || durations[durations.length - 1]
                : null;

        // Incident markers in bucket
        const incidentCount = issues.filter((iss) => {
            const t = iss.lastSeen.getTime();
            return t >= bStartMs && t < bEndMs;
        }).length;

        // Release markers in bucket
        const releaseCount = releases.filter((rel) => {
            const t = rel.lastSeen.getTime();
            return t >= bStartMs && t < bEndMs;
        }).length;

        // Monitor alert markers in bucket
        const monitorTriggerCount = alerts.filter((alt) => {
            const t = alt.triggeredAt.getTime();
            return t >= bStartMs && t < bEndMs;
        }).length;

        // Investigation markers in bucket
        const investigationCount = investigations.filter((inv) => {
            const t = inv.createdAt.getTime();
            return t >= bStartMs && t < bEndMs;
        }).length;

        // Comparison bucket mapping (shift back by durationMs)
        let comparison: TimeBucketPoint["comparison"] | undefined = undefined;
        if (timeRange.comparisonStart && comparisonEvents.length > 0) {
            const compBStartMs = bStartMs - durationMs;
            const compBEndMs = bEndMs - durationMs;

            const compBucketEvents = comparisonEvents.filter((e) => {
                const t = e.timestamp.getTime();
                return t >= compBStartMs && t < compBEndMs;
            });

            const compErrors = compBucketEvents.filter((e) => e.type === "ERROR").length;
            const compReqs = compBucketEvents.length;
            const compErrorRate = compReqs > 0 ? Math.round((compErrors / compReqs) * 1000) / 10 : 0;

            const compDurations = compBucketEvents
                .map((e) => e.durationMs)
                .filter((d): d is number => typeof d === "number" && d > 0);
            const compAvgLatency =
                compDurations.length > 0
                    ? Math.round(compDurations.reduce((sum, d) => sum + d, 0) / compDurations.length)
                    : null;

            comparison = {
                errorCount: compErrors,
                requestCount: compReqs,
                errorRate: compErrorRate,
                avgLatencyMs: compAvgLatency,
            };
        }

        return {
            timestamp: bucket.start.toISOString(),
            formattedTime: bucket.formattedTime,
            errorCount,
            requestCount,
            errorRate,
            avgLatencyMs,
            p95LatencyMs,
            incidentCount,
            releaseCount,
            monitorTriggerCount,
            investigationCount,
            comparison,
        };
    });

    // 5. Build Timeline Markers
    const markers: TimelineEventMarker[] = [];

    for (const rel of releases) {
        markers.push({
            id: `release-${rel.id}`,
            timestamp: rel.lastSeen.toISOString(),
            type: "RELEASE",
            title: `Release ${rel.version}`,
            entityId: rel.id,
            linkUrl: `/dashboards/changes?projectId=${rel.projectId}&release=${rel.version}`,
        });
    }

    for (const iss of issues) {
        markers.push({
            id: `issue-${iss.id}`,
            timestamp: iss.lastSeen.toISOString(),
            type: "INCIDENT",
            title: iss.title,
            severity: iss.severity,
            entityId: iss.id,
            linkUrl: `/projects/${iss.projectId}/issues/${iss.id}`,
        });
    }

    for (const alt of alerts) {
        markers.push({
            id: `alert-${alt.id}`,
            timestamp: alt.triggeredAt.toISOString(),
            type: "MONITOR_ALERT",
            title: `Alert: ${alt.monitor.name} (${alt.status})`,
            entityId: alt.id,
            linkUrl: `/monitors/alerts/${alt.id}`,
        });
    }

    for (const inv of investigations) {
        markers.push({
            id: `investigation-${inv.id}`,
            timestamp: inv.createdAt.toISOString(),
            type: "INVESTIGATION",
            title: inv.title,
            entityId: inv.id,
            linkUrl: `/projects/${inv.projectId}/investigations/new?investigationId=${inv.id}`,
        });
    }

    markers.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // 6. Aggregate Summary Metrics
    const totalRequestsCurrent = primaryEvents.length;
    const totalErrorsCurrent = primaryEvents.filter((e) => e.type === "ERROR").length;
    const errorRateCurrent =
        totalRequestsCurrent > 0 ? (totalErrorsCurrent / totalRequestsCurrent) * 100 : 0;

    const primaryDurations = primaryEvents
        .map((e) => e.durationMs)
        .filter((d): d is number => typeof d === "number" && d > 0)
        .sort((a, b) => a - b);

    const avgLatencyCurrent =
        primaryDurations.length > 0
            ? primaryDurations.reduce((sum, d) => sum + d, 0) / primaryDurations.length
            : null;

    const p95LatencyCurrent =
        primaryDurations.length > 0
            ? primaryDurations[Math.floor(primaryDurations.length * 0.95)] || primaryDurations[primaryDurations.length - 1]
            : null;

    // Comparison summary metrics
    const totalRequestsPrev = comparisonEvents.length;
    const totalErrorsPrev = comparisonEvents.filter((e) => e.type === "ERROR").length;
    const errorRatePrev =
        totalRequestsPrev > 0 ? (totalErrorsPrev / totalRequestsPrev) * 100 : 0;

    const compDurations = comparisonEvents
        .map((e) => e.durationMs)
        .filter((d): d is number => typeof d === "number" && d > 0)
        .sort((a, b) => a - b);

    const avgLatencyPrev =
        compDurations.length > 0
            ? compDurations.reduce((sum, d) => sum + d, 0) / compDurations.length
            : null;

    const p95LatencyPrev =
        compDurations.length > 0
            ? compDurations[Math.floor(compDurations.length * 0.95)] || compDurations[compDurations.length - 1]
            : null;

    const hasComparison = Boolean(timeRange.comparisonStart);

    const summaryMetrics = {
        totalRequests: calculateMetricComparison(totalRequestsCurrent, hasComparison ? totalRequestsPrev : null, false, false),
        totalErrors: calculateMetricComparison(totalErrorsCurrent, hasComparison ? totalErrorsPrev : null, false, true),
        errorRate: calculateMetricComparison(errorRateCurrent, hasComparison ? errorRatePrev : null, true, true),
        avgLatencyMs: calculateMetricComparison(avgLatencyCurrent || 0, hasComparison && avgLatencyPrev !== null ? avgLatencyPrev : null, false, true),
        p95LatencyMs: calculateMetricComparison(p95LatencyCurrent || 0, hasComparison && p95LatencyPrev !== null ? p95LatencyPrev : null, false, true),
        activeIncidentsCount: issues.filter((i) => i.status === "OPEN").length,
        monitorsFiringCount: activeMonitorsFiring,
    };

    // 7. Service Contribution Breakdown
    const serviceMap = new Map<
        string,
        {
            service: string;
            projectId: string;
            errorCount: number;
            totalCount: number;
            durations: number[];
        }
    >();

    for (const evt of primaryEvents) {
        const sName = evt.service || "unnamed-service";
        const entry = serviceMap.get(sName) || {
            service: sName,
            projectId: evt.projectId,
            errorCount: 0,
            totalCount: 0,
            durations: [],
        };
        entry.totalCount++;
        if (evt.type === "ERROR") entry.errorCount++;
        if (typeof evt.durationMs === "number" && evt.durationMs > 0) entry.durations.push(evt.durationMs);
        serviceMap.set(sName, entry);
    }

    // Comparison per service
    const compServiceMap = new Map<string, { errorCount: number; totalCount: number; durations: number[] }>();
    for (const evt of comparisonEvents) {
        const sName = evt.service || "unnamed-service";
        const entry = compServiceMap.get(sName) || { errorCount: 0, totalCount: 0, durations: [] };
        entry.totalCount++;
        if (evt.type === "ERROR") entry.errorCount++;
        if (typeof evt.durationMs === "number" && evt.durationMs > 0) entry.durations.push(evt.durationMs);
        compServiceMap.set(sName, entry);
    }

    const serviceContributions: ServiceContributionItem[] = Array.from(serviceMap.values())
        .map((s) => {
            const errorRate = s.totalCount > 0 ? Math.round((s.errorCount / s.totalCount) * 1000) / 10 : 0;
            const errorContributionPct =
                totalErrorsCurrent > 0 ? Math.round((s.errorCount / totalErrorsCurrent) * 1000) / 10 : 0;
            const requestContributionPct =
                totalRequestsCurrent > 0 ? Math.round((s.totalCount / totalRequestsCurrent) * 1000) / 10 : 0;

            const avgLatency =
                s.durations.length > 0
                    ? Math.round(s.durations.reduce((sum, d) => sum + d, 0) / s.durations.length)
                    : null;

            const comp = compServiceMap.get(s.service);
            const prevErrorRate = comp && comp.totalCount > 0 ? (comp.errorCount / comp.totalCount) * 100 : null;
            const prevAvgLatency =
                comp && comp.durations.length > 0
                    ? comp.durations.reduce((sum, d) => sum + d, 0) / comp.durations.length
                    : null;

            const errorRateComparison = calculateMetricComparison(errorRate, prevErrorRate, true, true);
            const latencyComparison = calculateMetricComparison(avgLatency || 0, prevAvgLatency, false, true);

            const affectedIssuesCount = issues.filter(
                (i) => i.projectId === s.projectId && (i.title.toLowerCase().includes(s.service.toLowerCase()) || i.status === "OPEN")
            ).length;

            const health: ServiceHealthStatus =
                s.totalCount === 0
                    ? "Unknown"
                    : errorRate >= 20 || (errorRate >= 5 && (errorRateComparison.relativeDiffPct || 0) > 100)
                    ? "Critical"
                    : errorRate >= 5
                    ? "Degraded"
                    : "Healthy";

            return {
                service: s.service,
                projectId: s.projectId,
                projectName: projectNameMap.get(s.projectId) || "Unknown",
                errorCount: s.errorCount,
                totalCount: s.totalCount,
                errorRate,
                errorRateComparison,
                errorContributionPct,
                requestContributionPct,
                avgLatencyMs: avgLatency,
                latencyComparison,
                affectedIssuesCount,
                health,
            };
        })
        .sort((a, b) => b.errorCount - a.errorCount || b.totalCount - a.totalCount);

    // 8. "Explain a Change" Detection Engine
    const explanation = buildChangeExplanation({
        timeline,
        primaryEvents,
        releases,
        issues,
        alerts,
        serviceContributions,
    });

    // 9. Provenance Metadata
    const dataQuality: DataProvenance["dataQuality"] =
        primaryEvents.length === 0
            ? "No telemetry"
            : primaryEvents.length < 10
            ? "Insufficient observations"
            : "Complete";

    const provenance: DataProvenance = {
        sources: ["PostgreSQL Event Store", "Telemetry Traces", "Release Registry", "Issue Index", "Monitor Alerts"],
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
        totalErrorsAnalyzed: totalErrorsCurrent,
        methodology: "Synchronized time-bucket aggregation. Error rate = (errors / requests) * 100. P95 computed from ordered durationMs arrays.",
        dataQuality,
        lastCalculatedAt: new Date().toISOString(),
    };

    return {
        timeline,
        markers,
        summaryMetrics,
        explanation,
        serviceContributions,
        provenance,
    };
}

function buildChangeExplanation(ctx: {
    timeline: TimeBucketPoint[];
    primaryEvents: any[];
    releases: any[];
    issues: any[];
    alerts: any[];
    serviceContributions: ServiceContributionItem[];
}): ChangeExplanation {
    if (ctx.primaryEvents.length === 0) {
        return {
            detected: false,
            headline: "No Telemetry in Selected Window",
            explanation: "No event activity was recorded during this timeframe to evaluate system changes.",
            classification: "Insufficient evidence",
            affectedServices: [],
            relatedReleases: [],
            relatedIncidents: [],
            relatedMonitorAlerts: [],
            supportingEvidence: ["Zero database events found in the active scope."],
        };
    }

    // Find peak error bucket
    let peakBucket: TimeBucketPoint | null = null;
    let maxErrors = 0;

    for (const b of ctx.timeline) {
        if (b.errorCount > maxErrors) {
            maxErrors = b.errorCount;
            peakBucket = b;
        }
    }

    if (!peakBucket || maxErrors === 0) {
        return {
            detected: false,
            headline: "Stable System Behavior",
            explanation: `System maintained a normal operational baseline throughout the window with 0 critical error spikes.`,
            classification: "Observed",
            affectedServices: [],
            relatedReleases: ctx.releases.slice(0, 3).map((r) => ({
                id: r.id,
                version: r.version,
                timestamp: r.lastSeen.toISOString(),
                temporalRelation: "Occurred during window with stable post-release telemetry",
            })),
            relatedIncidents: [],
            relatedMonitorAlerts: [],
            supportingEvidence: [
                `Evaluated ${ctx.primaryEvents.length} total events across ${ctx.timeline.length} time buckets.`,
                `Error rate remained at 0% across all evaluated intervals.`,
            ],
        };
    }

    const peakTimeMs = new Date(peakBucket.timestamp).getTime();

    // Check if there are releases right before or near peak
    const nearbyReleases = ctx.releases.filter((r) => {
        const relTime = r.lastSeen.getTime();
        return relTime <= peakTimeMs && peakTimeMs - relTime <= 60 * 60 * 1000; // within 1 hour before peak
    });

    const relatedAlerts = ctx.alerts.filter((a) => {
        const alertTime = a.triggeredAt.getTime();
        return Math.abs(alertTime - peakTimeMs) <= 30 * 60 * 1000;
    });

    const topServices = ctx.serviceContributions
        .filter((s) => s.errorCount > 0)
        .slice(0, 3)
        .map((s) => ({
            service: s.service,
            errorCount: s.errorCount,
            shareOfTotalErrorsPct: s.errorContributionPct,
        }));

    let classification: EvidenceClassification = "Correlated";
    let headline = `Error Surge of ${maxErrors} Events at ${peakBucket.formattedTime}`;
    let explanation = `A localized spike of ${maxErrors} errors (${peakBucket.errorRate}% error rate) was detected at ${peakBucket.formattedTime}.`;

    const supportingEvidence: string[] = [
        `Peak interval recorded ${maxErrors} error events (${peakBucket.errorRate}% error rate) out of ${peakBucket.requestCount} total requests.`,
        topServices.length > 0
            ? `Top error contributor: ${topServices[0].service} (${topServices[0].errorCount} errors, ${topServices[0].shareOfTotalErrorsPct}% of total errors).`
            : `Multiple services experienced simultaneous errors.`,
    ];

    if (nearbyReleases.length > 0) {
        classification = "Strongly correlated";
        const primaryRel = nearbyReleases[0];
        headline = `Error Spike Following Release ${primaryRel.version}`;
        explanation = `An error surge of ${maxErrors} events in service '${topServices[0]?.service || "system"}' occurred shortly after deployment of ${primaryRel.version}.`;
        supportingEvidence.push(
            `Release ${primaryRel.version} was recorded at ${primaryRel.lastSeen.toLocaleTimeString()} (${Math.round((peakTimeMs - primaryRel.lastSeen.getTime()) / 60000)}m prior to error peak).`
        );
    }

    if (relatedAlerts.length > 0) {
        supportingEvidence.push(
            `${relatedAlerts.length} monitor alert(s) triggered during this window (e.g. ${relatedAlerts[0].monitor.name}).`
        );
    }

    return {
        detected: true,
        headline,
        explanation,
        peakTimestamp: peakBucket.timestamp,
        magnitudeDescription: `${maxErrors} error events (${peakBucket.errorRate}% error rate)`,
        classification,
        affectedServices: topServices,
        relatedReleases: nearbyReleases.map((r) => ({
            id: r.id,
            version: r.version,
            timestamp: r.lastSeen.toISOString(),
            temporalRelation: `${Math.round((peakTimeMs - r.lastSeen.getTime()) / 60000)}m before error peak`,
        })),
        relatedIncidents: ctx.issues.slice(0, 3).map((iss) => ({
            id: iss.id,
            title: iss.title,
            severity: iss.severity,
            eventCount: iss.eventCount,
        })),
        relatedMonitorAlerts: relatedAlerts.map((a) => ({
            id: a.id,
            monitorName: a.monitor.name,
            condition: a.conditionSummary,
            status: a.status,
            triggeredAt: a.triggeredAt.toISOString(),
        })),
        supportingEvidence,
    };
}

function createEmptySystemExplorerData(timeRange: any, params: SystemExplorerParams): SystemExplorerData {
    return {
        timeline: [],
        markers: [],
        summaryMetrics: {
            totalRequests: calculateMetricComparison(0, null),
            totalErrors: calculateMetricComparison(0, null),
            errorRate: calculateMetricComparison(0, null, true),
            avgLatencyMs: calculateMetricComparison(0, null),
            p95LatencyMs: calculateMetricComparison(0, null),
            activeIncidentsCount: 0,
            monitorsFiringCount: 0,
        },
        explanation: {
            detected: false,
            headline: "No Projects or Telemetry Available",
            explanation: "No connected projects or active telemetry sources found for this scope.",
            classification: "Insufficient evidence",
            affectedServices: [],
            relatedReleases: [],
            relatedIncidents: [],
            relatedMonitorAlerts: [],
            supportingEvidence: ["No database records found matching query parameters."],
        },
        serviceContributions: [],
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
            methodology: "Synchronized time-bucket aggregation.",
            dataQuality: "No telemetry",
            lastCalculatedAt: new Date().toISOString(),
        },
    };
}
