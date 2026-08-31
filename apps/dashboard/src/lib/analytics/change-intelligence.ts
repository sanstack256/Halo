import { prisma } from "@/lib/prisma";
import type {
    ChangeIntelligenceData,
    ChangeImpactItem,
    ChangeImpactDeepAnalysis,
    EvidenceClassification,
    DataProvenance,
} from "./types";
import { parseTimeRange, calculateMetricComparison, generateTimeBuckets } from "./time";

export interface ChangeIntelligenceParams {
    organizationId: string;
    projectId?: string;
    environment?: string;
    timeRangeKey?: string;
    service?: string;
}

export async function fetchChangeIntelligenceAnalytics(
    params: ChangeIntelligenceParams
): Promise<ChangeIntelligenceData> {
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
        return createEmptyChangeIntelligenceData(timeRange, params);
    }

    // 2. Fetch Releases within the time window or recent
    const releases = await prisma.release.findMany({
        where: {
            projectId: { in: projectIds },
            lastSeen: {
                gte: timeRange.start,
                lte: timeRange.end,
            },
        },
        orderBy: { lastSeen: "desc" },
    });

    // Also fetch fallback recent releases if window had 0 releases
    let finalReleases = releases;
    if (finalReleases.length === 0) {
        finalReleases = await prisma.release.findMany({
            where: { projectId: { in: projectIds } },
            orderBy: { lastSeen: "desc" },
            take: 5,
        });
    }

    // 3. For each release, compute baseline vs observation window metrics
    const changes: ChangeImpactItem[] = await Promise.all(
        finalReleases.map(async (rel) => {
            const releaseTime = rel.lastSeen;
            const windowDurationMs = 2 * 60 * 60 * 1000; // 2 hours pre/post window

            const baselineStart = new Date(releaseTime.getTime() - windowDurationMs);
            const baselineEnd = new Date(releaseTime.getTime());

            const observationStart = new Date(releaseTime.getTime());
            const observationEnd = new Date(releaseTime.getTime() + windowDurationMs);

            // Fetch baseline and observation events
            const [baselineEvents, observationEvents, relatedIssues, relatedAlerts, relatedInvestigations] =
                await Promise.all([
                    prisma.event.findMany({
                        where: {
                            projectId: rel.projectId,
                            timestamp: { gte: baselineStart, lt: baselineEnd },
                        },
                        select: { id: true, type: true, durationMs: true, service: true },
                    }),
                    prisma.event.findMany({
                        where: {
                            projectId: rel.projectId,
                            timestamp: { gte: observationStart, lte: observationEnd },
                        },
                        select: { id: true, type: true, durationMs: true, service: true },
                    }),
                    prisma.issue.count({
                        where: {
                            projectId: rel.projectId,
                            firstSeen: { gte: baselineStart, lte: observationEnd },
                        },
                    }),
                    prisma.monitorAlert.count({
                        where: {
                            monitor: { projectId: rel.projectId },
                            triggeredAt: { gte: observationStart, lte: observationEnd },
                        },
                    }),
                    prisma.investigation.count({
                        where: {
                            projectId: rel.projectId,
                            createdAt: { gte: observationStart, lte: observationEnd },
                        },
                    }),
                ]);

            // Baseline calculations
            const baseErrors = baselineEvents.filter((e) => e.type === "ERROR").length;
            const baseTotal = baselineEvents.length;
            const baseErrorRate = baseTotal > 0 ? (baseErrors / baseTotal) * 100 : 0;
            const baseDurations = baselineEvents
                .map((e) => e.durationMs)
                .filter((d): d is number => typeof d === "number" && d > 0);
            const baseAvgLatency =
                baseDurations.length > 0
                    ? Math.round(baseDurations.reduce((a, b) => a + b, 0) / baseDurations.length)
                    : null;

            // Observation calculations
            const obsErrors = observationEvents.filter((e) => e.type === "ERROR").length;
            const obsTotal = observationEvents.length;
            const obsErrorRate = obsTotal > 0 ? (obsErrors / obsTotal) * 100 : 0;
            const obsDurations = observationEvents
                .map((e) => e.durationMs)
                .filter((d): d is number => typeof d === "number" && d > 0);
            const obsAvgLatency =
                obsDurations.length > 0
                    ? Math.round(obsDurations.reduce((a, b) => a + b, 0) / obsDurations.length)
                    : null;

            // Metric comparisons (Observation vs Baseline)
            const errorRateDiff = calculateMetricComparison(obsErrorRate, baseErrorRate, true, true);
            const errorCountDiff = calculateMetricComparison(obsErrors, baseErrors, false, true);
            const requestCountDiff = calculateMetricComparison(obsTotal, baseTotal, false, false);
            const latencyDiff = calculateMetricComparison(obsAvgLatency || 0, baseAvgLatency, false, true);

            // Determine unique services touched
            const servicesSeen = Array.from(new Set(observationEvents.map((e) => e.service).filter(Boolean)));
            const scope = servicesSeen.length > 0 ? servicesSeen.join(", ") : "Global Project Scope";

            // Regression Evaluation & Evidence Classification
            let regressionDetected = false;
            let regressionSeverity: ChangeImpactItem["regressionSeverity"] = undefined;
            let regressionReason: string | undefined = undefined;
            let impactClassification: EvidenceClassification = "Observed";

            const hasInsufficientData = baseTotal < 3 && obsTotal < 3;

            if (hasInsufficientData) {
                impactClassification = "Insufficient evidence";
                regressionReason = "Insufficient telemetry observations during baseline and observation windows.";
            } else if (obsErrors > 0 && (obsErrorRate >= 10 || (errorRateDiff.relativeDiffPct || 0) > 100)) {
                regressionDetected = true;
                regressionSeverity = obsErrorRate >= 20 || obsErrors > 10 ? "CRITICAL" : "HIGH";
                regressionReason = `Error rate rose to ${obsErrorRate.toFixed(1)}% (+${errorRateDiff.percentagePointsDiff}pp) following release.`;
                impactClassification = relatedAlerts > 0 ? "Strongly correlated" : "Correlated";
            } else if (latencyDiff.relativeDiffPct && latencyDiff.relativeDiffPct > 50 && (obsAvgLatency || 0) > 100) {
                regressionDetected = true;
                regressionSeverity = "MEDIUM";
                regressionReason = `Average response latency increased by +${latencyDiff.absoluteDiff}ms (${latencyDiff.relativeDiffPct}% increase).`;
                impactClassification = "Correlated";
            } else if (obsTotal > 0 && obsErrors === 0) {
                impactClassification = "Observed";
            }

            return {
                id: rel.id,
                version: rel.version,
                projectId: rel.projectId,
                projectName: projectNameMap.get(rel.projectId) || "Unknown",
                service: servicesSeen[0] || undefined,
                commitSha: rel.commitSha,
                timestamp: releaseTime.toISOString(),
                scope,
                baselineWindow: {
                    start: baselineStart.toISOString(),
                    end: baselineEnd.toISOString(),
                    totalEvents: baseTotal,
                    errorCount: baseErrors,
                    errorRate: Math.round(baseErrorRate * 10) / 10,
                    avgLatencyMs: baseAvgLatency,
                },
                observationWindow: {
                    start: observationStart.toISOString(),
                    end: observationEnd.toISOString(),
                    totalEvents: obsTotal,
                    errorCount: obsErrors,
                    errorRate: Math.round(obsErrorRate * 10) / 10,
                    avgLatencyMs: obsAvgLatency,
                },
                metricsDiff: {
                    errorRate: errorRateDiff,
                    errorCount: errorCountDiff,
                    requestCount: requestCountDiff,
                    avgLatencyMs: latencyDiff,
                },
                impactClassification,
                regressionDetected,
                regressionSeverity,
                regressionReason,
                relatedIssuesCount: relatedIssues,
                relatedMonitorsCount: relatedAlerts,
                relatedInvestigationsCount: relatedInvestigations,
            };
        })
    );

    const summary = {
        totalChanges: changes.length,
        regressionsDetected: changes.filter((c) => c.regressionDetected).length,
        stableChanges: changes.filter((c) => !c.regressionDetected && c.impactClassification !== "Insufficient evidence").length,
        insufficientDataCount: changes.filter((c) => c.impactClassification === "Insufficient evidence").length,
    };

    const dataQuality: DataProvenance["dataQuality"] =
        finalReleases.length === 0 ? "No telemetry" : "Complete";

    const provenance: DataProvenance = {
        sources: ["Release Registry", "Pre/Post Telemetry Baseline", "Issue Tracker", "Monitor Alert Pipeline"],
        projectId: params.projectId !== "ALL" ? params.projectId : undefined,
        projectName: params.projectId && params.projectId !== "ALL" ? projectNameMap.get(params.projectId) : "All Organization Projects",
        environment: params.environment || "All Environments",
        timeRange: {
            key: timeRange.key,
            start: timeRange.start.toISOString(),
            end: timeRange.end.toISOString(),
        },
        totalEventsAnalyzed: finalReleases.reduce((sum, r) => sum + r.eventCount, 0),
        totalTracesAnalyzed: finalReleases.reduce((sum, r) => sum + r.traceCount, 0),
        totalErrorsAnalyzed: finalReleases.reduce((sum, r) => sum + r.errorCount, 0),
        methodology: "2-hour symmetrical pre-deployment baseline vs post-deployment observation window analysis.",
        dataQuality,
        lastCalculatedAt: new Date().toISOString(),
    };

    return {
        changes,
        summary,
        provenance,
    };
}

export async function fetchChangeImpactDeepAnalysis(
    releaseId: string,
    projectId: string
): Promise<ChangeImpactDeepAnalysis | null> {
    const release = await prisma.release.findUnique({
        where: { id: releaseId },
        include: { project: { select: { id: true, name: true } } },
    });

    if (!release) return null;

    const releaseTime = release.lastSeen;
    const windowDurationMs = 2 * 60 * 60 * 1000;
    const baselineStart = new Date(releaseTime.getTime() - windowDurationMs);
    const observationEnd = new Date(releaseTime.getTime() + windowDurationMs);

    const [events, relatedIssues, relatedAlerts, relatedInvestigations] = await Promise.all([
        prisma.event.findMany({
            where: {
                projectId,
                timestamp: { gte: baselineStart, lte: observationEnd },
            },
            select: { id: true, type: true, durationMs: true, service: true, timestamp: true },
            orderBy: { timestamp: "asc" },
        }),
        prisma.issue.findMany({
            where: {
                projectId,
                firstSeen: { gte: baselineStart, lte: observationEnd },
            },
            select: { id: true, title: true, severity: true, firstSeen: true, lastSeen: true, eventCount: true },
            orderBy: { lastSeen: "desc" },
            take: 6,
        }),
        prisma.monitorAlert.findMany({
            where: {
                monitor: { projectId },
                triggeredAt: { gte: releaseTime, lte: observationEnd },
            },
            select: {
                id: true,
                status: true,
                conditionSummary: true,
                triggeredAt: true,
                monitor: { select: { name: true } },
            },
            take: 5,
        }),
        prisma.investigation.findMany({
            where: {
                projectId,
                createdAt: { gte: baselineStart, lte: observationEnd },
            },
            select: { id: true, title: true, rootCause: true, confidenceScore: true, createdAt: true },
            take: 5,
        }),
    ]);

    const baseEvents = events.filter((e) => e.timestamp < releaseTime);
    const obsEvents = events.filter((e) => e.timestamp >= releaseTime);

    const baseErrors = baseEvents.filter((e) => e.type === "ERROR").length;
    const obsErrors = obsEvents.filter((e) => e.type === "ERROR").length;
    const baseErrorRate = baseEvents.length > 0 ? (baseErrors / baseEvents.length) * 100 : 0;
    const obsErrorRate = obsEvents.length > 0 ? (obsErrors / obsEvents.length) * 100 : 0;

    const observedChanges: string[] = [];
    const likelyRelatedChanges: string[] = [];
    const unrelatedChanges: string[] = [];
    const insufficientEvidenceNotes: string[] = [];

    if (obsErrors > baseErrors) {
        observedChanges.push(
            `Error count increased from ${baseErrors} in baseline to ${obsErrors} post-deployment (${obsErrorRate.toFixed(1)}% error rate).`
        );
        likelyRelatedChanges.push(
            `Post-deployment error surge detected in service '${obsEvents.find((e) => e.type === "ERROR")?.service || "application"}'.`
        );
    } else {
        observedChanges.push(`Error volume remained stable at ${obsErrors} errors after release.`);
    }

    if (relatedAlerts.length > 0) {
        likelyRelatedChanges.push(
            `${relatedAlerts.length} monitor alert(s) triggered during the observation window.`
        );
    }

    if (events.length < 5) {
        insufficientEvidenceNotes.push(
            "Low overall event volume limits statistical confidence in baseline comparisons."
        );
    }

    // Telemetry breakdown buckets
    const rawBuckets = generateTimeBuckets(baselineStart, observationEnd, 12);
    const telemetryBreakdown = rawBuckets.map((b) => {
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

    const errorRateDiff = calculateMetricComparison(obsErrorRate, baseErrorRate, true, true);
    const errorCountDiff = calculateMetricComparison(obsErrors, baseErrors, false, true);
    const requestCountDiff = calculateMetricComparison(obsEvents.length, baseEvents.length, false, false);
    const latencyDiff = calculateMetricComparison(0, null, false, true);

    const change: ChangeImpactItem = {
        id: release.id,
        version: release.version,
        projectId: release.projectId,
        projectName: release.project.name,
        commitSha: release.commitSha,
        timestamp: releaseTime.toISOString(),
        scope: "Project Telemetry Scope",
        baselineWindow: {
            start: baselineStart.toISOString(),
            end: releaseTime.toISOString(),
            totalEvents: baseEvents.length,
            errorCount: baseErrors,
            errorRate: Math.round(baseErrorRate * 10) / 10,
            avgLatencyMs: null,
        },
        observationWindow: {
            start: releaseTime.toISOString(),
            end: observationEnd.toISOString(),
            totalEvents: obsEvents.length,
            errorCount: obsErrors,
            errorRate: Math.round(obsErrorRate * 10) / 10,
            avgLatencyMs: null,
        },
        metricsDiff: {
            errorRate: errorRateDiff,
            errorCount: errorCountDiff,
            requestCount: requestCountDiff,
            avgLatencyMs: latencyDiff,
        },
        impactClassification: obsErrors > 0 && obsErrorRate > 10 ? "Strongly correlated" : "Observed",
        regressionDetected: obsErrors > baseErrors && obsErrorRate >= 10,
        regressionSeverity: obsErrorRate >= 20 ? "CRITICAL" : "HIGH",
        regressionReason: obsErrors > baseErrors ? `Error rate rose to ${obsErrorRate.toFixed(1)}% post-release.` : undefined,
        relatedIssuesCount: relatedIssues.length,
        relatedMonitorsCount: relatedAlerts.length,
        relatedInvestigationsCount: relatedInvestigations.length,
    };

    return {
        change,
        observedChanges,
        likelyRelatedChanges,
        unrelatedChanges,
        insufficientEvidenceNotes,
        relatedIssues: relatedIssues.map((i) => ({
            id: i.id,
            title: i.title,
            severity: i.severity,
            firstSeen: i.firstSeen.toISOString(),
            lastSeen: i.lastSeen.toISOString(),
            eventCount: i.eventCount,
        })),
        relatedMonitorAlerts: relatedAlerts.map((a) => ({
            id: a.id,
            monitorName: a.monitor.name,
            status: a.status,
            condition: a.conditionSummary,
            triggeredAt: a.triggeredAt.toISOString(),
        })),
        relatedInvestigations: relatedInvestigations.map((inv) => ({
            id: inv.id,
            title: inv.title,
            rootCause: inv.rootCause,
            confidenceScore: inv.confidenceScore,
            createdAt: inv.createdAt.toISOString(),
        })),
        telemetryBreakdown,
    };
}

function createEmptyChangeIntelligenceData(timeRange: any, params: ChangeIntelligenceParams): ChangeIntelligenceData {
    return {
        changes: [],
        summary: {
            totalChanges: 0,
            regressionsDetected: 0,
            stableChanges: 0,
            insufficientDataCount: 0,
        },
        provenance: {
            sources: ["Release Registry", "PostgreSQL Event Store"],
            timeRange: {
                key: timeRange.key,
                start: timeRange.start.toISOString(),
                end: timeRange.end.toISOString(),
            },
            totalEventsAnalyzed: 0,
            totalTracesAnalyzed: 0,
            totalErrorsAnalyzed: 0,
            methodology: "Pre/post release comparative analysis.",
            dataQuality: "No telemetry",
            lastCalculatedAt: new Date().toISOString(),
        },
    };
}
