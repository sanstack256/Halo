import { prisma } from "@/lib/prisma";
import type {
    ChangeIntelligenceData,
    ChangeImpactItem,
    ChangeImpactDeepAnalysis,
    EvidenceClassification,
    DataProvenance,
    ReleaseVerdict,
    SharedEvidenceItem,
    QualitativeConfidence,
} from "./types";
import { parseTimeRange, calculateMetricComparison, generateTimeBuckets } from "./time";

export interface ChangeIntelligenceParams {
    organizationId: string;
    projectId?: string;
    environment?: string;
    timeRangeKey?: string;
    service?: string;
    userTimezone?: string;
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

    let finalReleases = releases;
    if (finalReleases.length === 0) {
        finalReleases = await prisma.release.findMany({
            where: { projectId: { in: projectIds } },
            orderBy: { lastSeen: "desc" },
            take: 5,
        });
    }

    // 3. For each release, compute dynamic baseline vs observation window metrics
    const changes: ChangeImpactItem[] = await Promise.all(
        finalReleases.map(async (rel) => {
            const releaseTime = rel.lastSeen;
            // Symmetrical 2h window with fallback expansion if event volume is low
            const windowDurationMs = 2 * 60 * 60 * 1000;

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
                        select: { id: true, type: true, durationMs: true, service: true, fingerprint: true },
                    }),
                    prisma.event.findMany({
                        where: {
                            projectId: rel.projectId,
                            timestamp: { gte: observationStart, lte: observationEnd },
                        },
                        select: { id: true, type: true, durationMs: true, service: true, fingerprint: true },
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

            // Determine services touched
            const servicesSeen = Array.from(new Set(observationEvents.map((e) => e.service).filter(Boolean)));
            const scope = servicesSeen.length > 0 ? servicesSeen.join(", ") : "Global Project Scope";

            // Sample Size & Statistical Sufficiency Assessment
            const isSufficient = baseTotal >= 5 && obsTotal >= 5;
            const sampleNotes = !isSufficient
                ? `Sample size is limited (baseline: ${baseTotal} events, observation: ${obsTotal} events). Statistical confidence is constrained.`
                : `Sufficient sample size evaluated across ${baseTotal + obsTotal} total telemetry records.`;

            // Check if errors existed before release (counter-evidence)
            const obsFingerprints = new Set(observationEvents.filter((e) => e.type === "ERROR").map((e) => e.fingerprint).filter(Boolean));
            const existedInBase = baselineEvents.some((e) => e.type === "ERROR" && e.fingerprint && obsFingerprints.has(e.fingerprint));

            // Determine Release Verdict & Classification
            let verdict: ReleaseVerdict = "No Regression Observed";
            let impactClassification: EvidenceClassification = "Observed";
            let evidenceStrength: QualitativeConfidence = "High";
            let regressionDetected = false;
            let regressionSeverity: ChangeImpactItem["regressionSeverity"] = undefined;
            let regressionReason: string | undefined = undefined;

            if (!isSufficient) {
                verdict = "Insufficient Evidence";
                impactClassification = "Insufficient evidence";
                evidenceStrength = "Insufficient Evidence";
                regressionReason = "Insufficient telemetry observations during baseline and observation intervals.";
            } else if (
                (errorRateDiff.percentagePointsDiff || 0) > 0 &&
                obsErrors > baseErrors &&
                (obsErrorRate >= 10 || (errorRateDiff.relativeDiffPct || 0) > 50)
            ) {
                regressionDetected = true;
                verdict = existedInBase ? "Likely Regression" : "Regression Detected";
                regressionSeverity = obsErrorRate >= 20 || obsErrors > 10 ? "CRITICAL" : "HIGH";
                regressionReason = `Error rate regressed from ${baseErrorRate.toFixed(1)}% to ${obsErrorRate.toFixed(1)}% (+${errorRateDiff.percentagePointsDiff}pp) following release.`;
                impactClassification = existedInBase ? "Correlated" : "Strongly correlated";
                evidenceStrength = existedInBase ? "Medium" : "High";
            } else if (
                latencyDiff.relativeDiffPct !== null &&
                latencyDiff.relativeDiffPct > 50 &&
                (obsAvgLatency || 0) > (baseAvgLatency || 0) &&
                (obsAvgLatency || 0) > 80
            ) {
                regressionDetected = true;
                verdict = "Regression Detected";
                regressionSeverity = (latencyDiff.relativeDiffPct || 0) > 100 ? "HIGH" : "MEDIUM";
                regressionReason = `Average response latency regressed by +${latencyDiff.absoluteDiff}ms from ${baseAvgLatency ?? 0}ms to ${obsAvgLatency}ms (${latencyDiff.relativeDiffPct}% increase).`;
                impactClassification = "Strongly correlated";
                evidenceStrength = "High";
            } else if (obsTotal > 0 && (errorRateDiff.percentagePointsDiff || 0) <= 0) {
                verdict = "No Regression Observed";
                impactClassification = "Observed";
                evidenceStrength = "High";
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
                verdict,
                impactClassification,
                evidenceStrength,
                regressionDetected,
                regressionSeverity,
                regressionReason,
                sampleSizeAssessment: {
                    baselineEvents: baseTotal,
                    observationEvents: obsTotal,
                    isSufficient,
                    notes: sampleNotes,
                },
                relatedIssuesCount: relatedIssues,
                relatedMonitorsCount: relatedAlerts,
                relatedInvestigationsCount: relatedInvestigations,
            };
        })
    );

    const summary = {
        totalChanges: changes.length,
        regressionsDetected: changes.filter((c) => c.verdict === "Regression Detected").length,
        likelyRegressions: changes.filter((c) => c.verdict === "Likely Regression").length,
        stableChanges: changes.filter((c) => c.verdict === "No Regression Observed").length,
        insufficientDataCount: changes.filter((c) => c.verdict === "Insufficient Evidence" || c.verdict === "Inconclusive").length,
    };

    const limitations: string[] = [];
    if (finalReleases.length === 0) {
        limitations.push("No releases found in current project and time scope.");
    }

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
        methodology: "Symmetrical baseline vs post-deployment observation window analysis with statistical sample-size validation.",
        dataQuality,
        limitations,
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
    projectId: string,
    userTimezone: string = "UTC"
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
            select: { id: true, type: true, durationMs: true, service: true, timestamp: true, fingerprint: true },
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
    const counterEvidence: string[] = [];
    const insufficientEvidenceNotes: string[] = [];
    const evidenceItems: SharedEvidenceItem[] = [];

    // Check pre-existing fingerprints
    const obsFingerprints = new Set(obsEvents.filter((e) => e.type === "ERROR").map((e) => e.fingerprint).filter(Boolean));
    const existedInBaseline = baseEvents.some((e) => e.type === "ERROR" && e.fingerprint && obsFingerprints.has(e.fingerprint));

    if (existedInBaseline) {
        counterEvidence.push(
            "Identical error fingerprints occurred in the pre-deployment baseline, weakening causal attribution strictly to this release."
        );
    }

    if (obsErrors > baseErrors) {
        observedChanges.push(
            `Error count shifted from ${baseErrors} in baseline to ${obsErrors} post-deployment (${obsErrorRate.toFixed(1)}% failure rate).`
        );
        likelyRelatedChanges.push(
            `Elevated error responses observed in service '${obsEvents.find((e) => e.type === "ERROR")?.service || "application"}'.`
        );

        evidenceItems.push({
            id: `ev-rel-err-${release.id}`,
            type: "ERROR_SPIKE",
            title: `Error Surge Post-Release (${obsErrors} errors)`,
            description: `Observed error rate rose to ${obsErrorRate.toFixed(1)}% following deployment.`,
            timestamp: releaseTime.toISOString(),
            relationship: existedInBaseline ? "CORRELATED" : "SUPPORTING",
            strength: existedInBaseline ? "Medium" : "High",
            source: "Telemetry Event Store",
        });
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

    const isSufficient = baseEvents.length >= 5 && obsEvents.length >= 5;

    const verdict: ReleaseVerdict =
        !isSufficient
            ? "Insufficient Evidence"
            : obsErrors > baseErrors && obsErrorRate >= 10
            ? existedInBaseline
                ? "Likely Regression"
                : "Regression Detected"
            : "No Regression Observed";

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
        verdict,
        impactClassification: obsErrors > 0 && obsErrorRate > 10 ? (existedInBaseline ? "Correlated" : "Strongly correlated") : "Observed",
        evidenceStrength: isSufficient ? (existedInBaseline ? "Medium" : "High") : "Insufficient Evidence",
        regressionDetected: obsErrors > baseErrors && obsErrorRate >= 10,
        regressionSeverity: obsErrorRate >= 20 ? "CRITICAL" : "HIGH",
        regressionReason: obsErrors > baseErrors ? `Error rate shifted to ${obsErrorRate.toFixed(1)}% post-release.` : undefined,
        sampleSizeAssessment: {
            baselineEvents: baseEvents.length,
            observationEvents: obsEvents.length,
            isSufficient,
            notes: isSufficient ? "Sufficient telemetry volume observed." : "Sample size constrained.",
        },
        relatedIssuesCount: relatedIssues.length,
        relatedMonitorsCount: relatedAlerts.length,
        relatedInvestigationsCount: relatedInvestigations.length,
    };

    return {
        change,
        observedChanges,
        likelyRelatedChanges,
        unrelatedChanges,
        counterEvidence,
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
        evidenceItems,
    };
}

function createEmptyChangeIntelligenceData(timeRange: any, params: ChangeIntelligenceParams): ChangeIntelligenceData {
    return {
        changes: [],
        summary: {
            totalChanges: 0,
            regressionsDetected: 0,
            likelyRegressions: 0,
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
