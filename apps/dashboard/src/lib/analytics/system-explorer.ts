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
    SharedEvidenceItem,
    QualitativeConfidence,
    InvestigationPriority,
    IntervalComparisonAnalysis,
} from "./types";
import { parseTimeRange, generateTimeBuckets, calculateMetricComparison } from "./time";
import { formatDeterministicTime } from "../date-format";

export interface SystemExplorerParams {
    organizationId: string;
    projectId?: string;
    environment?: string;
    timeRangeKey?: string;
    comparisonMode?: "PREVIOUS_PERIOD" | "NONE";
    service?: string;
    userTimezone?: string;
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
                fingerprint: true,
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
                      fingerprint: true,
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
    const userTimezone = params.userTimezone || "UTC";
    const rawBuckets = generateTimeBuckets(timeRange.start, timeRange.end, timeRange.bucketCount, userTimezone);
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

        const p50LatencyMs =
            durations.length > 0
                ? durations[Math.floor(durations.length * 0.5)] || durations[0]
                : null;

        const p95LatencyMs =
            durations.length > 0
                ? durations[Math.floor(durations.length * 0.95)] || durations[durations.length - 1]
                : null;

        const p99LatencyMs =
            durations.length > 0
                ? durations[Math.floor(durations.length * 0.99)] || durations[durations.length - 1]
                : null;

        const affectedServices = Array.from(
            new Set(bucketEvents.map((e) => e.service).filter((s): s is string => Boolean(s)))
        );

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

            const compReqs = compBucketEvents.length;
            const compErrors = compBucketEvents.filter((e) => e.type === "ERROR").length;
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
                hasObservation: compReqs > 0,
            };
        }

        return {
            timestamp: bucket.start.toISOString(),
            formattedTime: bucket.formattedTime,
            timeZoneAbbr: bucket.timeZoneAbbr,
            errorCount,
            requestCount,
            errorRate,
            avgLatencyMs,
            p50LatencyMs,
            p95LatencyMs,
            p99LatencyMs,
            incidentCount,
            releaseCount,
            monitorTriggerCount,
            investigationCount,
            affectedServices,
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

    const p50LatencyCurrent =
        primaryDurations.length > 0
            ? primaryDurations[Math.floor(primaryDurations.length * 0.5)] || primaryDurations[0]
            : null;

    const p95LatencyCurrent =
        primaryDurations.length > 0
            ? primaryDurations[Math.floor(primaryDurations.length * 0.95)] || primaryDurations[primaryDurations.length - 1]
            : null;

    const p99LatencyCurrent =
        primaryDurations.length > 0
            ? primaryDurations[Math.floor(primaryDurations.length * 0.99)] || primaryDurations[primaryDurations.length - 1]
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
    const hasObservedComparison = hasComparison && comparisonEvents.length > 0;

    const summaryMetrics = {
        totalRequests: calculateMetricComparison(
            totalRequestsCurrent,
            hasObservedComparison ? totalRequestsPrev : null,
            false,
            false
        ),
        totalErrors: calculateMetricComparison(
            totalErrorsCurrent,
            hasObservedComparison ? totalErrorsPrev : null,
            false,
            true
        ),
        errorRate: calculateMetricComparison(
            errorRateCurrent,
            hasObservedComparison ? errorRatePrev : null,
            true,
            true
        ),
        avgLatencyMs: calculateMetricComparison(
            avgLatencyCurrent,
            hasObservedComparison && avgLatencyPrev !== null ? avgLatencyPrev : null,
            false,
            true
        ),
        p50LatencyMs: calculateMetricComparison(p50LatencyCurrent, null, false, true),
        p95LatencyMs: calculateMetricComparison(
            p95LatencyCurrent,
            hasObservedComparison && p95LatencyPrev !== null ? p95LatencyPrev : null,
            false,
            true
        ),
        p99LatencyMs: calculateMetricComparison(p99LatencyCurrent, null, false, true),
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

            s.durations.sort((a, b) => a - b);
            const avgLatency =
                s.durations.length > 0
                    ? Math.round(s.durations.reduce((sum, d) => sum + d, 0) / s.durations.length)
                    : null;
            const p95Latency =
                s.durations.length > 0
                    ? s.durations[Math.floor(s.durations.length * 0.95)] || s.durations[s.durations.length - 1]
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

            // Investigation Priority calculation
            const priorityReasons: string[] = [];
            let priorityScore = 0;
            if (errorContributionPct > 30) {
                priorityScore += 3;
                priorityReasons.push(`${errorContributionPct}% of all system failures`);
            }
            if ((errorRateComparison.relativeDiffPct || 0) > 50) {
                priorityScore += 2;
                priorityReasons.push(`${(errorRateComparison.relativeDiffPct! / 100 + 1).toFixed(1)}× baseline error rate increase`);
            }
            if (errorRate >= 20) {
                priorityScore += 3;
                priorityReasons.push(`High error rate (${errorRate}%)`);
            }
            if (affectedIssuesCount > 0) {
                priorityScore += 1;
                priorityReasons.push(`${affectedIssuesCount} correlated active issue(s)`);
            }

            const priorityLevel: InvestigationPriority["level"] =
                priorityScore >= 5 ? "Very High" : priorityScore >= 3 ? "High" : priorityScore >= 1 ? "Medium" : "Low";

            const investigationPriority: InvestigationPriority = {
                level: priorityLevel,
                score: priorityScore,
                reasons: priorityReasons.length > 0 ? priorityReasons : ["Stable operational metrics"],
            };

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
                p95LatencyMs: p95Latency,
                latencyComparison,
                affectedIssuesCount,
                health,
                investigationPriority,
            };
        })
        .sort((a, b) => b.errorCount - a.errorCount || b.totalCount - a.totalCount);

    // 8. "Explain a Change" Detection Engine & Shared Evidence Ledger
    const { explanation, evidenceLedger } = buildChangeExplanationAndEvidence({
        timeline,
        primaryEvents,
        comparisonEvents,
        releases,
        issues,
        alerts,
        serviceContributions,
        userTimezone,
    });

    // 9. Provenance Metadata
    const limitations: string[] = [];
    if (primaryEvents.length < 10) {
        limitations.push("Small telemetry event sample (< 10 records) limits statistical confidence in baseline comparisons.");
    }
    if (primaryEvents.filter((e) => e.type === "TRACE").length === 0) {
        limitations.push("Distributed trace spans unavailable in this window; causal attribution relies on timestamp alignment.");
    }

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
        methodology: "Synchronized time-bucket aggregation. Error rate = (errors / requests) * 100. Latency percentiles computed from ordered duration arrays.",
        dataQuality,
        limitations,
        lastCalculatedAt: new Date().toISOString(),
    };

    return {
        timeline,
        markers,
        summaryMetrics,
        explanation,
        serviceContributions,
        evidenceLedger,
        provenance,
    };
}

function buildChangeExplanationAndEvidence(ctx: {
    timeline: TimeBucketPoint[];
    primaryEvents: any[];
    comparisonEvents: any[];
    releases: any[];
    issues: any[];
    alerts: any[];
    serviceContributions: ServiceContributionItem[];
    userTimezone?: string;
}): { explanation: ChangeExplanation; evidenceLedger: SharedEvidenceItem[] } {
    const evidenceLedger: SharedEvidenceItem[] = [];

    if (ctx.primaryEvents.length === 0) {
        return {
            explanation: {
                detected: false,
                headline: "No Telemetry in Selected Window",
                explanation: "No event activity was recorded during this timeframe to evaluate system changes.",
                whatChanged: "Zero observed telemetry records.",
                when: "Selected time range",
                where: "Global project scope",
                magnitudeDescription: "0 events",
                classification: "Insufficient evidence",
                evidenceStrength: "Insufficient Evidence",
                affectedServices: [],
                relatedReleases: [],
                relatedIncidents: [],
                relatedMonitorAlerts: [],
                supportingEvidence: ["Zero database events found in active scope."],
                counterEvidence: [],
                evidenceItems: [],
            },
            evidenceLedger: [],
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
            explanation: {
                detected: false,
                headline: "Stable System Behavior",
                explanation: "System maintained a normal operational baseline throughout the window with 0 critical error spikes.",
                whatChanged: "No anomalous failure surge observed.",
                when: "Across all evaluated intervals",
                where: "System-wide",
                magnitudeDescription: "0 error events",
                classification: "Observed",
                evidenceStrength: "High",
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
                    "Error rate remained at 0% across all evaluated intervals.",
                ],
                counterEvidence: [],
                evidenceItems: [],
            },
            evidenceLedger: [],
        };
    }

    const peakTimeMs = new Date(peakBucket.timestamp).getTime();

    // Check if there are releases right before peak
    const nearbyReleases = ctx.releases.filter((r) => {
        const relTime = r.lastSeen.getTime();
        return relTime <= peakTimeMs && peakTimeMs - relTime <= 60 * 60 * 1000;
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

    const primaryService = topServices[0]?.service || "system";

    let classification: EvidenceClassification = "Correlated";
    let evidenceStrength: QualitativeConfidence = "Medium";
    let headline = `Error Surge of ${maxErrors} Events at ${peakBucket.formattedTime}`;
    let whatChanged = `Error volume increased to ${maxErrors} failures (${peakBucket.errorRate}% error rate) in ${primaryService}.`;
    const when = `${peakBucket.formattedTime} (${peakBucket.timeZoneAbbr || "UTC"})`;
    const where = `Service: ${primaryService}`;
    const magnitudeDescription = `${maxErrors} errors (${peakBucket.errorRate}% error rate)`;

    const supportingEvidence: string[] = [
        `Peak interval recorded ${maxErrors} error events (${peakBucket.errorRate}% error rate) out of ${peakBucket.requestCount} requests.`,
        topServices.length > 0
            ? `Top error contributor: ${topServices[0].service} (${topServices[0].errorCount} errors, ${topServices[0].shareOfTotalErrorsPct}% of total failures).`
            : "Errors distributed across multiple components.",
    ];

    const counterEvidence: string[] = [];

    // Add peak spike to evidence ledger
    evidenceLedger.push({
        id: `ev-spike-${peakTimeMs}`,
        type: "ERROR_SPIKE",
        title: `Error Surge: ${maxErrors} failures`,
        description: `Error rate reached ${peakBucket.errorRate}% at ${peakBucket.formattedTime}.`,
        timestamp: peakBucket.timestamp,
        relationship: "SUPPORTING",
        strength: "High",
        source: "Telemetry Event Ingestion",
    });

    // Check if the same error fingerprint existed before the peak in comparison window
    const peakFingerprints = new Set(
        ctx.primaryEvents
            .filter((e) => e.type === "ERROR" && Math.abs(e.timestamp.getTime() - peakTimeMs) < 15 * 60 * 1000)
            .map((e) => e.fingerprint)
            .filter(Boolean)
    );

    const existedInBaseline = ctx.comparisonEvents.some(
        (e) => e.type === "ERROR" && e.fingerprint && peakFingerprints.has(e.fingerprint)
    );

    if (existedInBaseline) {
        counterEvidence.push(
            "Identical error fingerprint was observed in previous comparison window prior to this surge."
        );
    }

    if (nearbyReleases.length > 0) {
        const primaryRel = nearbyReleases[0];
        const minsBefore = Math.round((peakTimeMs - primaryRel.lastSeen.getTime()) / 60000);

        if (!existedInBaseline) {
            classification = "Strongly correlated";
            evidenceStrength = "High";
            headline = `Error Spike Following Release ${primaryRel.version}`;
            whatChanged = `Error surge of ${maxErrors} events occurred ${minsBefore}m after deployment of ${primaryRel.version}.`;
        } else {
            classification = "Possible";
            evidenceStrength = "Medium";
            headline = `Error Spike Near Release ${primaryRel.version} (Pre-existing Pattern)`;
        }

        supportingEvidence.push(
            `Release ${primaryRel.version} deployed at ${formatDeterministicTime(primaryRel.lastSeen, ctx.userTimezone || "UTC")} (${minsBefore}m before error peak).`
        );

        evidenceLedger.push({
            id: `ev-release-${primaryRel.id}`,
            type: "DEPLOYMENT",
            title: `Deployment: Release ${primaryRel.version}`,
            description: `Deployed ${minsBefore}m prior to error peak.`,
            timestamp: primaryRel.lastSeen.toISOString(),
            relationship: existedInBaseline ? "CORRELATED" : "SUPPORTING",
            strength: existedInBaseline ? "Medium" : "High",
            source: "Release Registry",
            entityId: primaryRel.id,
        });
    }

    if (relatedAlerts.length > 0) {
        supportingEvidence.push(
            `${relatedAlerts.length} monitor alert(s) triggered during this window (e.g. ${relatedAlerts[0].monitor.name}).`
        );
        evidenceLedger.push({
            id: `ev-alert-${relatedAlerts[0].id}`,
            type: "MONITOR_TRIGGER",
            title: `Monitor Alert: ${relatedAlerts[0].monitor.name}`,
            description: `Condition met: ${relatedAlerts[0].conditionSummary}`,
            timestamp: relatedAlerts[0].triggeredAt.toISOString(),
            relationship: "SUPPORTING",
            strength: "Very High",
            source: "Monitor Evaluation Engine",
            entityId: relatedAlerts[0].id,
        });
    }

    const explanation: ChangeExplanation = {
        detected: true,
        headline,
        explanation: `${whatChanged} Telemetry evidence shows ${maxErrors} errors concentrated in ${primaryService}.`,
        whatChanged,
        when,
        where,
        magnitudeDescription,
        classification,
        evidenceStrength,
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
        counterEvidence,
        evidenceItems: evidenceLedger,
    };

    return {
        explanation,
        evidenceLedger,
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
            p50LatencyMs: calculateMetricComparison(0, null),
            p95LatencyMs: calculateMetricComparison(0, null),
            p99LatencyMs: calculateMetricComparison(0, null),
            activeIncidentsCount: 0,
            monitorsFiringCount: 0,
        },
        explanation: {
            detected: false,
            headline: "No Projects or Telemetry Available",
            explanation: "No connected projects or active telemetry sources found for this scope.",
            whatChanged: "None",
            when: "N/A",
            where: "N/A",
            magnitudeDescription: "0 events",
            classification: "Insufficient evidence",
            evidenceStrength: "Insufficient Evidence",
            affectedServices: [],
            relatedReleases: [],
            relatedIncidents: [],
            relatedMonitorAlerts: [],
            supportingEvidence: ["No database records found matching query parameters."],
            counterEvidence: [],
            evidenceItems: [],
        },
        serviceContributions: [],
        evidenceLedger: [],
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
