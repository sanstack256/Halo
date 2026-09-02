import {
    investigateIssueOccurrence,
    investigateMonitorOccurrence,
    investigateInterval,
    investigateRelease,
} from "@/lib/investigation/run";
import { getMonitorTypeDefinition } from "@/lib/monitors/definitions";
import { BackButton } from "@/components/ui/back-button";
import {
    Activity,
    AlertCircle,
    AlertTriangle,
    ArrowDown,
    ArrowRight,
    ArrowUpRight,
    BellRing,
    CheckCircle2,
    Clock,
    Code2,
    Compass,
    Copy,
    FolderKanban,
    GitCommit,
    HelpCircle,
    History,
    Info,
    Layers,
    Lock,
    Maximize2,
    MousePointer,
    RotateCcw,
    Server,
    ShieldAlert,
    Sparkles,
    Terminal,
    XCircle,
    Zap,
} from "lucide-react";
import Link from "next/link";

import type {
    Investigation,
    Hypothesis,
    Recommendation,
} from "@halo/investigation-engine";

type Props = {
    params: Promise<{
        id: string;
    }>;

    searchParams: Promise<{
        issueId?: string;
        eventId?: string;
        monitorId?: string;
        alertId?: string;
        intervalTime?: string;
        intervalStart?: string;
        intervalEnd?: string;
        release?: string;
        releaseId?: string;
        releaseVersion?: string;
        environment?: string;
        service?: string;
    }>;
};

import { NoEventsInvestigationModal } from "./no-events-modal";
import { getReplaySessionForOccurrence, type ResolvedOccurrenceReplay } from "@/actions/replay";
import { ReplayPlayerClient } from "@/components/replay/replay-player-client";
import { ReplayStatus } from "@/components/replay/replay-status";
import { interpretInvestigation, type InterpretedInvestigation } from "@/lib/investigation/interpreter";
import { RuntimeReconstructionView } from "@/components/investigation/runtime-reconstruction-view";
import { CausalChainView } from "@/components/investigation/causal-chain-view";
import { EvidenceGraphView } from "@/components/investigation/evidence-graph-view";
import { RegressionDetectionView } from "@/components/investigation/regression-detection-view";
import { detectAutomaticRegression } from "@/lib/investigation/regression/regression-detector";
import { InvestigationStickyNav } from "@/components/investigation/sticky-nav";
import { RecommendationPlanView } from "@/components/investigation/recommendation-plan-view";
import { RelatedTelemetryView } from "@/components/investigation/related-telemetry-view";
import { resolveGitHubSourceContext } from "@/lib/investigation/runtime/github-source-provider";
import { parseStackTrace } from "@/lib/investigation/runtime/stack-parser";
import type { SourceContext } from "@/lib/investigation/runtime/types";
import { getServerTimezone } from "@/lib/timezone-server";
import { formatDeterministicDateTime, formatDeterministicTime, formatDeterministicDate, getTimezoneAbbr } from "@/lib/date-format";

export default async function InvestigationPage({
    params,
    searchParams,
}: Props) {
    const { id } = await params;
    const {
        issueId,
        eventId,
        monitorId,
        alertId,
        intervalTime,
        intervalStart,
        intervalEnd,
        release,
        releaseId,
        releaseVersion,
        environment,
        service,
    } = await searchParams;

    const userTimezone = await getServerTimezone();

    const hasTarget = Boolean(
        issueId ||
        monitorId ||
        intervalTime ||
        intervalStart ||
        release ||
        releaseId ||
        releaseVersion ||
        service
    );

    if (!hasTarget) {
        return (
            <NoEventsInvestigationModal
                projectId={id}
                errorMessage="Please select an interval, release, active issue, or monitor trigger to start an investigation."
            />
        );
    }

    try {
        let investigation: Investigation;
        let incidentAnchorId: string | undefined;
        let incidentAnchorTimestamp: Date | undefined;
        let historicalOccurrenceCount: number | undefined;
        let resolvedReplay: ResolvedOccurrenceReplay | null = null;
        let monitorContext: any = null;
        let intervalContext: any = null;
        let releaseContext: any = null;

        if (intervalTime || intervalStart) {
            // Interval Investigation Path (From System Explorer)
            const startStr = intervalStart || intervalTime;
            const intervalResult = await investigateInterval({
                projectId: id,
                intervalStart: startStr!,
                intervalEnd,
                environment,
                service,
            });
            investigation = intervalResult.investigation;
            incidentAnchorId = intervalResult.incidentAnchorId;
            incidentAnchorTimestamp = intervalResult.incidentAnchorTimestamp;
            intervalContext = intervalResult.intervalContext;
        } else if (release || releaseId || releaseVersion) {
            // Release Investigation Path (From Change Intelligence)
            const relKey = release || releaseVersion || releaseId;
            const releaseResult = await investigateRelease({
                projectId: id,
                releaseVersionOrId: relKey!,
                environment,
            });
            investigation = releaseResult.investigation;
            incidentAnchorId = releaseResult.incidentAnchorId;
            incidentAnchorTimestamp = releaseResult.incidentAnchorTimestamp;
            releaseContext = releaseResult.releaseContext;
        } else if (monitorId) {
            // Monitor Trigger Investigation Path
            const monitorResult = await investigateMonitorOccurrence(monitorId, id, alertId);
            investigation = monitorResult.investigation;
            incidentAnchorId = monitorResult.incidentAnchorId;
            incidentAnchorTimestamp = monitorResult.incidentAnchorTimestamp;
            monitorContext = {
                monitor: monitorResult.monitor,
                alert: monitorResult.alert,
                investigationRecord: monitorResult.investigationRecord,
            };
        } else if (issueId) {
            // Issue Occurrence Investigation Path
            const [issueResult, replay] = await Promise.all([
                investigateIssueOccurrence(issueId, id, eventId),
                getReplaySessionForOccurrence(issueId, eventId, id),
            ]);
            investigation = issueResult.investigation;
            incidentAnchorId = issueResult.incidentAnchorId;
            incidentAnchorTimestamp = issueResult.incidentAnchorTimestamp;
            historicalOccurrenceCount = issueResult.historicalOccurrenceCount;
            resolvedReplay = replay;
        } else if (service) {
            // Service Investigation Path (From Services / Health / Degradation CTA)
            const { prisma } = await import("@/lib/prisma");

            // 1. Check active firing alert for service
            const activeAlert = await prisma.monitorAlert.findFirst({
                where: {
                    status: "OPEN",
                    monitor: { projectId: id },
                    OR: [
                        { conditionSummary: { contains: service, mode: "insensitive" } },
                        { monitor: { query: { contains: service, mode: "insensitive" } } },
                        { monitor: { name: { contains: service, mode: "insensitive" } } },
                    ],
                },
                include: { monitor: true },
                orderBy: { triggeredAt: "desc" },
            });

            if (activeAlert) {
                const monitorResult = await investigateMonitorOccurrence(activeAlert.monitorId, id, activeAlert.id);
                investigation = monitorResult.investigation;
                incidentAnchorId = monitorResult.incidentAnchorId;
                incidentAnchorTimestamp = monitorResult.incidentAnchorTimestamp;
                monitorContext = {
                    monitor: monitorResult.monitor,
                    alert: monitorResult.alert,
                    investigationRecord: monitorResult.investigationRecord,
                };
            } else {
                // 2. Check open issue for service
                const activeIssue = await prisma.issue.findFirst({
                    where: {
                        projectId: id,
                        status: "OPEN",
                        title: { contains: service, mode: "insensitive" },
                    },
                    orderBy: { lastSeen: "desc" },
                });

                if (activeIssue) {
                    const [issueResult, replay] = await Promise.all([
                        investigateIssueOccurrence(activeIssue.id, id),
                        getReplaySessionForOccurrence(activeIssue.id, undefined, id),
                    ]);
                    investigation = issueResult.investigation;
                    incidentAnchorId = issueResult.incidentAnchorId;
                    incidentAnchorTimestamp = issueResult.incidentAnchorTimestamp;
                    historicalOccurrenceCount = issueResult.historicalOccurrenceCount;
                    resolvedReplay = replay;
                } else {
                    // 3. Fallback: Run interval investigation around service's latest telemetry
                    const latestEvent = await prisma.event.findFirst({
                        where: { projectId: id, service },
                        orderBy: { timestamp: "desc" },
                    });

                    if (!latestEvent) {
                        return (
                            <NoEventsInvestigationModal
                                projectId={id}
                                errorMessage={`No telemetry events found for service "${service}".`}
                            />
                        );
                    }

                    const end = latestEvent.timestamp;
                    const start = new Date(end.getTime() - 2 * 3600 * 1000);
                    const intervalResult = await investigateInterval({
                        projectId: id,
                        intervalStart: start,
                        intervalEnd: end,
                        environment,
                        service,
                    });
                    investigation = intervalResult.investigation;
                    incidentAnchorId = intervalResult.incidentAnchorId;
                    incidentAnchorTimestamp = intervalResult.incidentAnchorTimestamp;
                    intervalContext = intervalResult.intervalContext;
                }
            }
        } else {
            return (
                <NoEventsInvestigationModal
                    projectId={id}
                    errorMessage="Please select an interval, release, active issue, or monitor trigger to start an investigation."
                />
            );
        }

        // Attempt async GitHub source resolution for the primary failing frame
        const allErrors = investigation.evidence.filter((e) => e.type === "ERROR");
        const anchorError =
            (incidentAnchorId
                ? investigation.evidence.find((e) => e.id === incidentAnchorId)
                : undefined) ??
            allErrors[allErrors.length - 1] ??
            allErrors[0] ??
            investigation.evidence[0];

        let resolvedSourceContext: SourceContext | undefined;
        let primaryFailingFrame: any;
        if (anchorError) {
            const rawStack =
                typeof anchorError.metadata?.stack === "string"
                    ? anchorError.metadata.stack
                    : anchorError.description || "";
            const frames = parseStackTrace(rawStack);
            primaryFailingFrame =
                frames.find((f) => f.isApplication && f.lineNumber) ||
                frames.find((f) => f.lineNumber) ||
                frames[0];

            if (primaryFailingFrame) {
                resolvedSourceContext = await resolveGitHubSourceContext({
                    projectId: id,
                    frame: primaryFailingFrame,
                    releaseVersion: anchorError.release,
                    commitSha: anchorError.commit,
                });
            }
        }

        // Run Automatic Regression Detection if issue context or release context exists
        let regressionAnalysis: any = null;
        if (issueId) {
            regressionAnalysis = await detectAutomaticRegression({
                projectId: id,
                issueId,
                incidentFirstSeen: incidentAnchorTimestamp ? new Date(incidentAnchorTimestamp) : new Date(),
                failingLocation: primaryFailingFrame ? {
                    filePath: primaryFailingFrame.filePath,
                    lineNumber: primaryFailingFrame.lineNumber,
                    functionName: primaryFailingFrame.functionName,
                } : undefined,
                releaseVersion: anchorError?.release,
                commitSha: anchorError?.commit,
            });
        }

        return (
            <InvestigationView
                investigation={investigation}
                resolvedReplay={resolvedReplay}
                projectId={id}
                incidentAnchorId={incidentAnchorId}
                incidentAnchorTimestamp={incidentAnchorTimestamp}
                historicalOccurrenceCount={historicalOccurrenceCount}
                resolvedSourceContext={resolvedSourceContext}
                anchorError={anchorError}
                regressionAnalysis={regressionAnalysis}
                monitorContext={monitorContext}
                intervalContext={intervalContext}
                releaseContext={releaseContext}
                userTimezone={userTimezone}
            />
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to run investigation.";
        return (
            <NoEventsInvestigationModal
                projectId={id}
                errorMessage={message}
            />
        );
    }
}

/* -------------------------------------------------------------------------- */
/* Main Investigation View                                                    */
/* -------------------------------------------------------------------------- */

function InvestigationView({
    investigation,
    resolvedReplay,
    projectId,
    incidentAnchorId,
    incidentAnchorTimestamp,
    historicalOccurrenceCount,
    resolvedSourceContext,
    anchorError,
    regressionAnalysis,
    monitorContext,
    intervalContext,
    releaseContext,
    userTimezone = "UTC",
}: {
    investigation: Investigation;
    resolvedReplay: ResolvedOccurrenceReplay | null;
    projectId: string;
    incidentAnchorId?: string;
    incidentAnchorTimestamp?: Date;
    historicalOccurrenceCount?: number;
    resolvedSourceContext?: SourceContext;
    anchorError?: any;
    regressionAnalysis?: any;
    monitorContext?: {
        monitor: {
            id: string;
            name: string;
            type: string;
            query: string | null;
            thresholdValue: number | null;
            thresholdWindow: number | null;
        };
        alert?: {
            id: string;
            status: string;
            conditionSummary: string;
            observedValue: number | null;
            thresholdValue: number | null;
            triggeredAt: Date;
        } | null;
        investigationRecord: any;
    } | null;
    intervalContext?: {
        intervalStart: Date;
        intervalEnd: Date;
        precedingStart: Date;
        followingEnd: Date;
        baselineStart: Date;
        baselineEnd: Date;
        metrics: {
            primaryRequests: number;
            primaryErrors: number;
            primaryErrorRate: number;
            primaryAvgLatencyMs: number | null;
            baselineRequests: number;
            baselineErrors: number;
            baselineErrorRate: number;
            baselineAvgLatencyMs: number | null;
            affectedServices: string[];
            affectedEndpoints: string[];
        };
        assessment: import("@/lib/investigation/evidence-boundary").IntervalSufficiencyAssessment;
        releases: any[];
        alerts: any[];
        project: { id: string; name: string };
    } | null;
    releaseContext?: {
        release: {
            id: string;
            version: string;
            commitSha: string | null;
            firstSeen: Date;
            lastSeen: Date;
        };
        releaseTime: Date;
        baselineStart: Date;
        observationEnd: Date;
        assessment: import("@/lib/investigation/evidence-boundary").ReleaseSufficiencyAssessment;
        metrics: {
            baselineRequests: number;
            baselineErrors: number;
            baselineErrorRate: number;
            baselineAvgLatencyMs: number | null;
            observationRequests: number;
            observationErrors: number;
            observationErrorRate: number;
            observationAvgLatencyMs: number | null;
            affectedServices: string[];
            isRegression: boolean;
            verdict: "Regression Detected" | "Likely Regression" | "No Regression Observed" | "Insufficient Evidence";
            summaryExplanation: string;
        };
        alerts: any[];
        project: { id: string; name: string };
    } | null;
    userTimezone?: string;
}) {
    const {
        status,
        report,
        rootCause,
        timeline,
        evidence,
        hypotheses,
        findings,
        changes,
        impact,
        recommendations,
    } = investigation;

    const replaySession = resolvedReplay?.replaySession;
    const interpreted = interpretInvestigation(
        investigation,
        replaySession,
        incidentAnchorId,
        resolvedSourceContext,
        regressionAnalysis
    );

    const formattedAnchorTime = incidentAnchorTimestamp
        ? formatDeterministicDateTime(incidentAnchorTimestamp, userTimezone)
        : null;

    // Categorize related telemetry for section I
    const relatedTraces = evidence.filter((e) => e.type === "TRACE");
    const relatedLogs = evidence.filter((e) => e.type === "LOG");
    const relatedMetrics = evidence.filter((e) => e.type === "METRIC");
    const relatedThirdParty = evidence.filter((e) => e.type === "THIRD_PARTY" || e.type === "INFRASTRUCTURE");

    // Compute dynamic headline for interval / release investigations
    let headline = interpreted.headline;
    let eyebrowTitle = "Incident Investigation Report";
    let backHref = "/overview";
    let backLabel = "Back to Dashboards";

    if (intervalContext) {
        eyebrowTitle = "Interval Analysis Report";
        backHref = "/dashboards/system";
        backLabel = "Back to System Explorer";
        if (intervalContext.metrics.primaryErrors > 0) {
            headline = `Error Surge of ${intervalContext.metrics.primaryErrors} Failures (${intervalContext.metrics.primaryErrorRate.toFixed(1)}% error rate)`;
        } else if (intervalContext.metrics.primaryRequests > 0) {
            headline = `Stable Operational Interval (${intervalContext.metrics.primaryRequests} requests, 0 errors)`;
        } else {
            headline = "Insufficient Telemetry Observed in Selected Interval";
        }
    } else if (releaseContext) {
        eyebrowTitle = "Release Impact Investigation";
        backHref = "/dashboards/changes";
        backLabel = "Back to Change Intelligence";
        headline = `Release ${releaseContext.release.version}: ${releaseContext.metrics.verdict}`;
    } else if (monitorContext) {
        eyebrowTitle = "Monitor Trigger Investigation";
        backHref = `/monitors/${monitorContext.monitor.id}`;
        backLabel = "Back to Monitor";
    }

    return (
        <div className="halo-investigation max-w-5xl mx-auto space-y-8 pb-16">
            <div className="mb-4 flex items-center justify-between">
                <BackButton
                    fallbackHref={backHref}
                    label={backLabel}
                />
                <div className="text-xs font-mono text-zinc-500">
                    {intervalContext ? (
                        <div className="flex items-center gap-2">
                            <span>Interval:</span>
                            <span className="text-white font-semibold">
                                {formatDeterministicTime(intervalContext.intervalStart, userTimezone, false)} → {formatDeterministicTime(intervalContext.intervalEnd, userTimezone)}
                            </span>
                        </div>
                    ) : releaseContext ? (
                        <div className="flex items-center gap-2">
                            <span>Release:</span>
                            <span className="text-white font-semibold">{releaseContext.release.version}</span>
                        </div>
                    ) : monitorContext ? (
                        <div className="flex items-center gap-2">
                            <span>Monitor:</span>
                            <Link
                                href={`/monitors/${monitorContext.monitor.id}`}
                                className="text-white hover:text-accent font-semibold flex items-center gap-1 transition-colors"
                            >
                                <BellRing size={12} />
                                {monitorContext.monitor.name}
                            </Link>
                            {monitorContext.alert && (
                                <>
                                    <span>&bull;</span>
                                    <Link
                                        href={`/monitors/alerts/${monitorContext.alert.id}`}
                                        className="text-accent hover:underline"
                                    >
                                        Alert Detail &rarr;
                                    </Link>
                                </>
                            )}
                        </div>
                    ) : (
                        <div>Issue: <span className="text-zinc-300 font-semibold">{rootCause?.title || "Active Incident"}</span></div>
                    )}
                </div>
            </div>

            {/* Context Origin Banner: Interval */}
            {intervalContext && (
                <div className="p-4 rounded-xl border border-accent/20 bg-accent/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full bg-accent/20 border border-accent/30 text-accent font-semibold text-[11px]">
                                System Explorer Interval
                            </span>
                            <span className="text-white font-semibold">
                                {formatDeterministicDateTime(intervalContext.intervalStart, userTimezone)} → {formatDeterministicTime(intervalContext.intervalEnd, userTimezone)}
                            </span>
                        </div>
                        <p className="text-zinc-300 text-[11px] leading-relaxed">
                            {intervalContext.metrics.primaryRequests > 0
                                ? `Evaluated ${intervalContext.metrics.primaryRequests} requests (${intervalContext.metrics.primaryErrors} errors, ${intervalContext.metrics.primaryErrorRate.toFixed(1)}% error rate). Baseline: ${intervalContext.metrics.baselineRequests} requests, ${intervalContext.metrics.baselineErrorRate.toFixed(1)}% error rate.`
                                : "No request or error events were observed during this specific time bucket."}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Link
                            href="/dashboards/system"
                            className="halo-btn halo-btn-secondary halo-btn-xs"
                        >
                            <Sparkles size={11} />
                            <span>System Explorer</span>
                        </Link>
                    </div>
                </div>
            )}

            {/* Context Origin Banner: Release */}
            {releaseContext && (
                <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 font-semibold text-[11px]">
                                Release Deployment
                            </span>
                            <span className="text-white font-semibold">
                                {releaseContext.release.version}
                            </span>
                            {releaseContext.release.commitSha && (
                                <span className="text-[10px] text-zinc-400 bg-surface px-1.5 py-0.5 rounded border border-border">
                                    {releaseContext.release.commitSha.slice(0, 7)}
                                </span>
                            )}
                        </div>
                        <p className="text-zinc-300 text-[11px] leading-relaxed">
                            {releaseContext.metrics.summaryExplanation}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Link
                            href="/dashboards/changes"
                            className="halo-btn halo-btn-secondary halo-btn-xs"
                        >
                            <GitCommit size={11} />
                            <span>Change Intelligence</span>
                        </Link>
                    </div>
                </div>
            )}

            {/* Sticky Section Navigation */}
            <InvestigationStickyNav />

            {/* Header */}
            {/* Header */}
            <header className="halo-investigation-header space-y-3">
                <div className="halo-eyebrow-row flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="halo-eyebrow font-mono text-xs uppercase tracking-wider text-accent font-semibold">
                            {eyebrowTitle}
                        </span>
                        {formattedAnchorTime && (
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-secondary">
                                Timestamp: {formattedAnchorTime}
                            </span>
                        )}
                    </div>
                    <StatusBadge status={status} />
                </div>

                <h1 className="text-3xl font-bold text-white tracking-tight">
                    {headline}
                </h1>

                <p className="text-sm text-secondary">
                    {intervalContext
                        ? "Deterministic evidence collection, preceding context analysis, and causal cascade reconstruction for the selected timeframe."
                        : releaseContext
                        ? "Pre/post deployment baseline comparison, multi-dimensional regression analysis, and correlated telemetry investigation."
                        : "Reconstructed transaction cascade across client interactions and backend APIs for this specific occurrence."}
                </p>

                {/* Compact Horizontal Investigation Summary Bar */}
                {intervalContext ? (
                    <div className="p-3.5 rounded-xl bg-surface border border-border grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 text-xs font-mono">
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Scope</span>
                            <span className="text-white font-bold truncate block">System Interval</span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Evaluated Requests</span>
                            <span className="text-accent truncate block">{intervalContext.metrics.primaryRequests}</span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Errors / Rate</span>
                            <span className="text-red-400 font-bold truncate block">
                                {intervalContext.metrics.primaryErrors} ({intervalContext.metrics.primaryErrorRate.toFixed(1)}%)
                            </span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Baseline Error Rate</span>
                            <span className="text-zinc-300 truncate block">
                                {intervalContext.metrics.baselineErrorRate.toFixed(1)}%
                            </span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Nearby Releases</span>
                            <span className="text-zinc-300 font-semibold block">{intervalContext.releases.length}</span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Affected Services</span>
                            <span className="text-zinc-300 truncate block">
                                {intervalContext.metrics.affectedServices.length > 0 ? intervalContext.metrics.affectedServices.join(", ") : "None"}
                            </span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Condition</span>
                            <span className="text-emerald-400 font-bold block">
                                {intervalContext.metrics.primaryErrors > 0 ? "Elevated Errors" : intervalContext.metrics.primaryRequests > 0 ? "Stable" : "Insufficient Telemetry"}
                            </span>
                        </div>
                    </div>
                ) : releaseContext ? (
                    <div className="p-3.5 rounded-xl bg-surface border border-border grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 text-xs font-mono">
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Release Version</span>
                            <span className="text-white font-bold truncate block">{releaseContext.release.version}</span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Baseline Errors</span>
                            <span className="text-zinc-300 truncate block">
                                {releaseContext.metrics.baselineErrors} ({releaseContext.metrics.baselineErrorRate.toFixed(1)}%)
                            </span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Post-Deploy Errors</span>
                            <span className="text-zinc-300 font-bold truncate block">
                                {releaseContext.metrics.observationErrors} ({releaseContext.metrics.observationErrorRate.toFixed(1)}%)
                            </span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Traffic Shift</span>
                            <span className="text-accent truncate block">
                                {releaseContext.metrics.baselineRequests} → {releaseContext.metrics.observationRequests}
                            </span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Observed Latency</span>
                            <span className="text-zinc-300 font-semibold block">
                                {releaseContext.metrics.observationAvgLatencyMs ? `${Math.round(releaseContext.metrics.observationAvgLatencyMs)}ms` : "—"}
                            </span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Verdict</span>
                            <span className={`font-bold block ${releaseContext.metrics.isRegression ? "text-red-400" : "text-emerald-400"}`}>
                                {releaseContext.metrics.verdict}
                            </span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Project Scope</span>
                            <span className="text-zinc-200 truncate block">{releaseContext.project.name}</span>
                        </div>
                    </div>
                ) : (
                    <div className="p-3.5 rounded-xl bg-surface border border-border grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 text-xs font-mono">
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Error</span>
                            <span className="text-white font-bold truncate block">{anchorError?.metadata?.errorType || (anchorError?.title?.includes(":") ? anchorError.title.split(":")[0] : "Application Error")}</span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Service</span>
                            <span className="text-accent truncate block">{anchorError?.service || "web-client"}</span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Environment</span>
                            <span className="text-zinc-300 truncate block">{anchorError?.environment || "production"}</span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">First Seen</span>
                            <span className="text-zinc-300 truncate block">{formattedAnchorTime?.split(",")[0] || "Just now"}</span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Occurrences</span>
                            <span className="text-zinc-300 font-semibold block">{historicalOccurrenceCount ? historicalOccurrenceCount + 1 : 1}</span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Investigation Confidence</span>
                            <span className="text-emerald-400 font-bold block">{interpreted.rootCauseSummary.confidenceLabel}</span>
                        </div>
                        <div className="space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Root Cause Status</span>
                            <span className="text-zinc-200 truncate block">{interpreted.rootCauseSummary.isClientDownstream ? "Downstream Symptom" : interpreted.rootCauseSummary.isExactRootCauseKnown ? "Established" : "Unknown"}</span>
                        </div>
                    </div>
                )}

                {/* Core Four Questions Briefing Block */}
                <div className="p-4 rounded-xl bg-[#080b11] border border-white/10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div className="space-y-1 border-b sm:border-b-0 sm:border-r border-white/10 pb-2 sm:pb-0 sm:pr-3">
                        <span className="text-[10px] uppercase font-mono font-bold text-red-400 block">1. What Failed?</span>
                        <p className="text-zinc-200 font-medium truncate" title={intervalContext ? (intervalContext.metrics.primaryErrors > 0 ? `${intervalContext.metrics.primaryErrors} failures recorded` : "0 failures (stable)") : releaseContext ? releaseContext.metrics.summaryExplanation : interpreted.headline}>
                            {intervalContext
                                ? (intervalContext.metrics.primaryErrors > 0 ? `${intervalContext.metrics.primaryErrors} failures recorded (${intervalContext.metrics.primaryErrorRate.toFixed(1)}% error rate)` : intervalContext.metrics.primaryRequests > 0 ? "0 failures (stable)" : "No telemetry in interval")
                                : releaseContext
                                ? releaseContext.metrics.summaryExplanation
                                : interpreted.headline}
                        </p>
                    </div>
                    <div className="space-y-1 border-b sm:border-b-0 sm:border-r border-white/10 pb-2 sm:pb-0 sm:pr-3">
                        <span className="text-[10px] uppercase font-mono font-bold text-emerald-400 block">2. What Do We Know?</span>
                        <p className="text-zinc-200 font-medium">
                            {intervalContext
                                ? `${intervalContext.metrics.primaryRequests} requests, ${intervalContext.releases.length} nearby releases`
                                : releaseContext
                                ? `${releaseContext.metrics.baselineRequests} baseline → ${releaseContext.metrics.observationRequests} post-deployment events`
                                : `${interpreted.evidenceIntegrity.confirmedFacts.length} verified facts observed`}
                        </p>
                    </div>
                    <div className="space-y-1 border-b sm:border-b-0 md:border-r border-white/10 pb-2 sm:pb-0 sm:pr-3">
                        <span className="text-[10px] uppercase font-mono font-bold text-amber-400 block">3. What is the Likely Cause?</span>
                        <p className="text-zinc-200 font-medium truncate">
                            {intervalContext
                                ? (intervalContext.releases.length > 0 ? `Correlated with release ${intervalContext.releases[0].version}` : intervalContext.metrics.primaryErrors > 0 ? `Elevated failure rate in ${intervalContext.metrics.affectedServices[0] || "application"}` : "Normal operational baseline")
                                : releaseContext
                                ? (releaseContext.metrics.isRegression ? "Deployment introduced failure or latency regression" : "Stable operational baseline (no regression)")
                                : (interpreted.rootCauseSummary.isClientDownstream ? "Upstream network failure" : interpreted.rootCauseSummary.rootCauseStatement)}
                        </p>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] uppercase font-mono font-bold text-accent block">4. What Should I Do?</span>
                        <p className="text-zinc-200 font-medium truncate" title={intervalContext ? (intervalContext.metrics.affectedServices.length > 0 ? `Inspect ${intervalContext.metrics.affectedServices[0]}` : "Return to System Explorer") : releaseContext ? (releaseContext.metrics.isRegression ? "Inspect affected endpoints and revert if needed" : "Monitor telemetry in Change Intelligence") : interpreted.recommendations.primary.immediateAction}>
                            {intervalContext
                                ? (intervalContext.metrics.affectedServices.length > 0 ? `Inspect service '${intervalContext.metrics.affectedServices[0]}'` : "Return to System Explorer")
                                : releaseContext
                                ? (releaseContext.metrics.isRegression ? "Inspect affected endpoints / revert deployment" : "Monitor post-release telemetry")
                                : interpreted.recommendations.primary.immediateAction}
                        </p>
                    </div>
                </div>

                {/* Strict Boundary Context Callout */}
                {typeof historicalOccurrenceCount === "number" && historicalOccurrenceCount > 0 && (
                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-surface/60 border border-border/80 text-xs text-secondary">
                        <History className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                        <div>
                            <span className="font-semibold text-zinc-300">Strict Occurrence Isolation:</span>{" "}
                            Investigating single occurrence anchor (ID: <code className="font-mono text-accent text-[11px]">{incidentAnchorId?.slice(0, 12)}…</code>).{" "}
                            {historicalOccurrenceCount} other historical occurrence{historicalOccurrenceCount > 1 ? "s" : ""} in this Issue remain isolated as historical context and excluded from this incident's active causal chain.
                        </div>
                    </div>
                )}
            </header>

            {/* A. INCIDENT SUMMARY */}
            <section id="section-summary" className="halo-card p-6 border-border space-y-4 scroll-mt-24">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-accent" />
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                            {intervalContext && intervalContext.metrics.primaryRequests === 0
                                ? "System Interval Analysis"
                                : "Incident Summary"}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted font-mono">Investigation confidence:</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {interpreted.rootCauseSummary.confidenceLabel}
                        </span>
                    </div>
                </div>

                {intervalContext && intervalContext.metrics.primaryRequests === 0 ? (
                    <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                        <div className="flex items-center gap-2 text-zinc-300 font-medium text-xs">
                            <HelpCircle className="w-4 h-4 text-muted shrink-0" />
                            <span>No request or error events were observed inside the selected interval.</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                            <div className="p-2.5 rounded bg-surface-elevated border border-border">
                                <span className="text-[10px] text-zinc-500 uppercase block">Primary Requests</span>
                                <span className="text-white font-bold">0</span>
                            </div>
                            <div className="p-2.5 rounded bg-surface-elevated border border-border">
                                <span className="text-[10px] text-zinc-500 uppercase block">Primary Errors</span>
                                <span className="text-white font-bold">0</span>
                            </div>
                            <div className="p-2.5 rounded bg-surface-elevated border border-border">
                                <span className="text-[10px] text-zinc-500 uppercase block">Traces</span>
                                <span className="text-white font-bold">0</span>
                            </div>
                        </div>
                        {intervalContext.assessment.contextExplanation && (
                            <p className="text-[11px] text-accent font-mono">
                                Note: {intervalContext.assessment.contextExplanation}
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                        <div className="p-3 rounded-lg bg-surface border border-border space-y-1">
                            <span className="text-[10px] text-zinc-500 uppercase block">Error Type</span>
                            <span className="text-white font-semibold truncate block">
                                {anchorError?.metadata?.errorType || (anchorError?.title?.includes(":") ? anchorError.title.split(":")[0] : "Application Error")}
                            </span>
                        </div>
                        <div className="p-3 rounded-lg bg-surface border border-border space-y-1">
                            <span className="text-[10px] text-zinc-500 uppercase block">Occurrence Time</span>
                            <span className="text-zinc-200 truncate block">{formattedAnchorTime || "Recorded Timestamp"}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-surface border border-border space-y-1">
                            <span className="text-[10px] text-zinc-500 uppercase block">Service / Runtime</span>
                            <span className="text-accent truncate block">{anchorError?.service || "web-client (Browser)"}</span>
                        </div>
                        <div className="p-3 rounded-lg bg-surface border border-border space-y-1">
                            <span className="text-[10px] text-zinc-500 uppercase block">Environment</span>
                            <span className="text-zinc-300 truncate block">{anchorError?.environment || "production"}</span>
                        </div>
                        <div className="col-span-2 p-3 rounded-lg bg-surface border border-border space-y-1">
                            <span className="text-[10px] text-zinc-500 uppercase block">Error Message</span>
                            <span className="text-red-400 truncate block font-sans text-xs">
                                {anchorError?.title || "Unhandled Exception"}
                            </span>
                        </div>
                        <div className="col-span-2 p-3 rounded-lg bg-surface border border-border space-y-1">
                            <span className="text-[10px] text-zinc-500 uppercase block">Occurrence Identifier</span>
                            <span className="text-zinc-400 truncate block">
                                {incidentAnchorId || anchorError?.id || "N/A"}
                            </span>
                        </div>
                    </div>
                )}
            </section>

            {/* EVIDENCE SUFFICIENCY & BOUNDARY ASSESSMENT */}
            {releaseContext && (
                <section id="section-evidence-sufficiency" className="halo-card p-6 border-border space-y-4 scroll-mt-24">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                        <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-purple-400" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                                Evidence Sufficiency & Boundary Assessment
                            </h2>
                        </div>
                        <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded border ${
                            releaseContext.assessment.sufficiency === "SUFFICIENT"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : releaseContext.assessment.sufficiency === "PARTIAL"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-zinc-800 text-zinc-400 border-zinc-700"
                        }`}>
                            {releaseContext.assessment.sufficiency} EVIDENCE
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Baseline Telemetry */}
                        <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                            <span className="text-[10px] uppercase font-mono text-zinc-400 font-bold block">
                                Pre-Deployment Baseline (2h)
                            </span>
                            <div className="text-xl font-bold text-white font-mono">
                                {releaseContext.metrics.baselineRequests} requests
                            </div>
                            <div className="text-xs text-secondary font-mono flex items-center gap-3">
                                <span>Errors: <strong className="text-zinc-200">{releaseContext.metrics.baselineErrors}</strong></span>
                                <span>Error Rate: <strong className="text-zinc-200">{releaseContext.metrics.baselineErrorRate.toFixed(1)}%</strong></span>
                                {releaseContext.metrics.baselineAvgLatencyMs && (
                                    <span>Avg Latency: <strong className="text-zinc-200">{Math.round(releaseContext.metrics.baselineAvgLatencyMs)}ms</strong></span>
                                )}
                            </div>
                            <p className="text-[11px] text-zinc-400 leading-relaxed pt-1 border-t border-border/50">
                                Establishes baseline operational distributions prior to release deployment.
                            </p>
                        </div>

                        {/* Post-Deployment Telemetry */}
                        <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                            <span className="text-[10px] uppercase font-mono text-purple-400 font-bold block">
                                Post-Deployment Observation (2h)
                            </span>
                            <div className="text-xl font-bold text-white font-mono">
                                {releaseContext.metrics.observationRequests} requests
                            </div>
                            <div className="text-xs text-secondary font-mono flex items-center gap-3">
                                <span>Errors: <strong className="text-zinc-200">{releaseContext.metrics.observationErrors}</strong></span>
                                <span>Error Rate: <strong className="text-zinc-200">{releaseContext.metrics.observationErrorRate.toFixed(1)}%</strong></span>
                                {releaseContext.metrics.observationAvgLatencyMs && (
                                    <span>Avg Latency: <strong className="text-zinc-200">{Math.round(releaseContext.metrics.observationAvgLatencyMs)}ms</strong></span>
                                )}
                            </div>
                            <p className="text-[11px] text-zinc-400 leading-relaxed pt-1 border-t border-border/50">
                                Observed behavior following deployment timestamp ({formatDeterministicDateTime(releaseContext.releaseTime, userTimezone)}).
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        {/* What Halo Can Establish */}
                        <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                                <CheckCircle2 size={13} />
                                <span>What Halo Can Establish</span>
                            </div>
                            <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside">
                                {releaseContext.assessment.whatHaloCanEstablish.map((point, idx) => (
                                    <li key={idx}>{point}</li>
                                ))}
                            </ul>
                        </div>

                        {/* What Halo Cannot Establish */}
                        <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                                <AlertTriangle size={13} />
                                <span>What Halo Cannot Establish</span>
                            </div>
                            <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside">
                                {releaseContext.assessment.whatHaloCannotEstablish.map((point, idx) => (
                                    <li key={idx}>{point}</li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Reasons / Why this matters */}
                    {releaseContext.assessment.reasons.length > 0 && (
                        <div className="p-3 rounded-lg bg-surface/60 border border-border text-xs text-zinc-300 space-y-1 font-mono">
                            <span className="text-[10px] text-zinc-500 uppercase font-sans font-semibold block">Sufficiency Findings</span>
                            {releaseContext.assessment.reasons.map((r, i) => (
                                <p key={i}>• {r}</p>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* B. EARLIEST OBSERVED FAILURE */}
            <section id="section-earliest-failure" className="halo-card p-6 border-border space-y-4 scroll-mt-24">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                            Earliest Observed Failure
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted font-mono">Relationship confidence:</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {interpreted.rootCauseSummary.confidenceLabel}
                        </span>
                        {!interpreted.rootCauseSummary.isExactRootCauseKnown && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Exact Backend Cause: Unknown
                            </span>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    <p className="text-base text-zinc-200 leading-relaxed font-medium">
                        {interpreted.rootCauseSummary.rootCauseStatement}
                    </p>

                    {/* Visual Flowchart Box */}
                    <div className="rounded-xl bg-[#080b11] border border-white/10 p-4 font-mono text-xs text-zinc-300 overflow-x-auto space-y-1">
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-sans font-semibold mb-2">
                            The evidence directly establishes the sequence:
                        </div>
                        <pre className="text-emerald-400 leading-snug">
                            {interpreted.asciiFlow}
                        </pre>
                    </div>

                    <p className="text-xs text-secondary italic">
                        The client exception is therefore <strong className="text-white">a downstream symptom</strong> of the earlier request failure.
                    </p>
                </div>
            </section>

            {/* C. CAUSAL CHAIN (INSPECTABLE) */}
            <div id="section-causal-chain" className="scroll-mt-24">
                <CausalChainView
                    causalChains={interpreted.causalChains}
                    hypotheses={investigation.hypotheses}
                    rawEdges={interpreted.rawEdges}
                />
            </div>

            {/* C2. INTERACTIVE EVIDENCE GRAPH */}
            <div id="section-evidence-graph" className="scroll-mt-24">
                <EvidenceGraphView
                    graph={interpreted.comprehensiveGraph}
                />
            </div>
            {/* C3. EVALUATED EVIDENCE RECORDS */}
            <section id="section-evidence-records" className="halo-card p-6 border-border space-y-4 overflow-hidden scroll-mt-24">
                <div className="border-b border-border pb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                        Evaluated Evidence Records
                    </h2>
                    <span className="text-xs font-mono text-secondary">
                        {interpreted.causalEvidenceGraph.length} signals evaluated
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="border-b border-border text-muted font-mono uppercase text-[10px]">
                                <th className="py-2.5 px-3">Evidence</th>
                                <th className="py-2.5 px-3">Relationship</th>
                                <th className="py-2.5 px-3">Strength</th>
                                <th className="py-2.5 px-3">Explanation</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {interpreted.causalEvidenceGraph.map((row) => (
                                <tr key={row.id} className="hover:bg-surface-hover/50 transition-colors">
                                    <td className="py-3 px-3 font-mono font-medium text-white max-w-xs truncate">
                                        {row.label}
                                    </td>
                                    <td className="py-3 px-3">
                                        <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                                            row.role === "Upstream failure"
                                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                                : row.role === "Downstream consequence"
                                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                                : row.role === "Trigger"
                                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                                : row.role === "Missing evidence"
                                                ? "bg-zinc-800 text-zinc-400 border border-zinc-700"
                                                : "bg-surface text-muted"
                                        }`}>
                                            {row.role}
                                        </span>
                                    </td>
                                    <td className="py-3 px-3">
                                        <span className={`font-semibold ${
                                            row.strength === "Very High"
                                                ? "text-emerald-400"
                                                : row.strength === "High"
                                                ? "text-blue-400"
                                                : row.strength === "Missing"
                                                ? "text-zinc-500"
                                                : "text-zinc-400"
                                        }`}>
                                            {row.strength}
                                        </span>
                                    </td>
                                    <td className="py-3 px-3 text-secondary max-w-md leading-relaxed">
                                        {row.explanation}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* C4. SESSION REPLAY */}
            <section id="section-replay" className="halo-section space-y-3 scroll-mt-24">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <SectionHeading
                        title="User Session Replay"
                        description={replaySession
                            ? "Reconstructed browser DOM interactions, mouse clicks, and network requests correlated directly with this failure."
                            : "Browser session replay recorded for the incident occurrence, when available."}
                    />
                    {replaySession && (
                        <span className={`text-[10px] font-mono px-2.5 py-1 rounded-full border font-semibold ${
                            resolvedReplay.correlationStrength === "EXACT"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : resolvedReplay.correlationStrength === "STRONG"
                                ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}>
                            {resolvedReplay.correlationStrength === "EXACT"
                                ? "✓ EXACT OCCURRENCE REPLAY"
                                : resolvedReplay.correlationStrength === "STRONG"
                                ? "✓ TRACE / REQUEST CORRELATED"
                                : "⚠ RELATED (UNVERIFIED)"}
                        </span>
                    )}
                </div>

                {replaySession ? (
                    <div className="space-y-4">
                        <ReplayPlayerClient
                            replaySession={replaySession}
                            issueTitle={rootCause?.title || "Incident Session"}
                        />
                    </div>
                ) : (
                    <ReplayStatus
                        status="NO_REPLAY"
                        message={resolvedReplay?.reason || "Session replay was not captured for this occurrence."}
                        projectId={projectId}
                    />
                )}
            </section>

            {/* C5. RUNTIME FAILURE & STACK TRACE */}
            <div id="section-runtime-stack" className="scroll-mt-24">
                <RuntimeReconstructionView reconstruction={interpreted.runtimeReconstruction} />
            </div>

            {/* C6. RELATED TELEMETRY */}
            <RelatedTelemetryView
                relatedTraces={relatedTraces}
                relatedLogs={relatedLogs}
                relatedMetrics={relatedMetrics}
                relatedThirdParty={relatedThirdParty}
            />

            {/* D. AUTOMATIC REGRESSION DETECTION (CHANGES) */}
            <div id="section-regression" className="scroll-mt-24">
                <RegressionDetectionView
                    regression={interpreted.regressionAnalysis}
                    projectId={projectId}
                />
            </div>

            {/* E. WHAT HAPPENED (TIMELINE) */}
            <section id="section-what-happened" className="halo-card p-6 border-border space-y-5 scroll-mt-24">
                <div className="border-b border-border pb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                        What happened
                    </h2>
                    <span className="text-xs font-mono text-secondary">
                        {interpreted.whatHappened.timeFormatted}
                        {interpreted.whatHappened.pageUrl ? ` • ${interpreted.whatHappened.pageUrl}` : ""}
                    </span>
                </div>

                {interpreted.whatHappened.pageUrl ? (
                    <p className="text-sm text-zinc-300">
                        At <strong className="text-white font-mono">{interpreted.whatHappened.timeFormatted}</strong>, activity was recorded on <code className="text-accent bg-surface px-1.5 py-0.5 rounded text-xs">{interpreted.whatHappened.pageUrl}</code>. Halo reconstructed the following sequence:
                    </p>
                ) : (
                    <p className="text-sm text-zinc-300">
                        At <strong className="text-white font-mono">{interpreted.whatHappened.timeFormatted}</strong>, an incident occurred in the application. Halo reconstructed the following sequence:
                    </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Step 1: User Action */}
                    <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-accent">
                                <Activity size={14} />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                                    1. User action
                                </h3>
                            </div>
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                interpreted.whatHappened.userAction.provenance === "Observed"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : interpreted.whatHappened.userAction.provenance === "Inferred"
                                    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                    : "bg-zinc-800 text-zinc-400 border-zinc-700"
                            }`}>
                                {interpreted.whatHappened.userAction.provenance}
                            </span>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">
                            {interpreted.whatHappened.userAction.description}
                        </p>
                        {interpreted.whatHappened.userAction.replayEvidence && (
                            <p className="text-[11px] text-muted italic">
                                {interpreted.whatHappened.userAction.replayEvidence}
                            </p>
                        )}
                    </div>

                    {/* Step 2: Failed Request */}
                    {interpreted.whatHappened.failedRequest ? (
                        <div className="p-4 rounded-xl bg-surface border border-red-500/20 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-red-400">
                                    <Activity size={14} />
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                                        2. Failed request
                                    </h3>
                                </div>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    Observed
                                </span>
                            </div>
                            <div className="rounded bg-[#080b11] p-2 font-mono text-[11px] text-zinc-300 space-y-0.5">
                                <div className="text-red-400 font-bold">
                                    {interpreted.whatHappened.failedRequest.method} {interpreted.whatHappened.failedRequest.endpoint}
                                </div>
                                <div>Status: {interpreted.whatHappened.failedRequest.status}</div>
                                {interpreted.whatHappened.failedRequest.durationMs !== undefined && (
                                    <div>Duration: {interpreted.whatHappened.failedRequest.durationMs} ms</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                            <div className="flex items-center gap-2 text-zinc-400">
                                <Activity size={14} />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                                    2. Request Flow
                                </h3>
                            </div>
                            <p className="text-xs text-secondary leading-relaxed">
                                No network request failure recorded prior to exception.
                            </p>
                        </div>
                    )}

                    {/* Step 3: Client Exception */}
                    <div className="p-4 rounded-xl bg-surface border border-amber-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-amber-400">
                                <Activity size={14} />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                                    3. Client exception
                                </h3>
                            </div>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Observed
                            </span>
                        </div>
                        <p className="text-xs text-secondary">
                            Immediately afterward:
                        </p>
                        <div className="rounded bg-[#080b11] p-2 font-mono text-[11px] text-amber-300">
                            {interpreted.whatHappened.clientException.title}
                        </div>
                        <p className="text-[11px] font-mono text-muted">
                            at: {interpreted.whatHappened.clientException.failingLocation}
                        </p>
                    </div>

                    {/* Step 4: User Impact */}
                    <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-blue-400">
                                <Activity size={14} />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                                    4. User impact
                                </h3>
                            </div>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                Inferred
                            </span>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">
                            {interpreted.whatHappened.userImpact}
                        </p>
                    </div>
                </div>
            </section>

            {/* F. KNOWN & UNKNOWN FACTORS */}
            <section id="section-known-unknown" className="halo-card p-6 border-border space-y-5 scroll-mt-24">
                <div className="border-b border-border pb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                        What is known vs unknown
                    </h2>
                    <span className="text-xs font-mono text-secondary">
                        Deterministic Boundary
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Confirmed */}
                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
                        <div className="flex items-center gap-2 text-emerald-400">
                            <Activity size={15} />
                            <h3 className="text-xs font-bold uppercase tracking-wider">
                                Confirmed Facts (Observed)
                            </h3>
                        </div>
                        <ul className="space-y-2 text-xs text-zinc-300">
                            {interpreted.evidenceIntegrity.confirmedFacts.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                    <span className="text-emerald-400 font-bold">&bull;</span>
                                    <span>{item.statement}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Unknown */}
                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                        <div className="flex items-center gap-2 text-amber-400">
                            <Activity size={15} />
                            <h3 className="text-xs font-bold uppercase tracking-wider">
                                Unknown (Missing Telemetry)
                            </h3>
                        </div>
                        <ul className="space-y-2 text-xs text-zinc-300">
                            {interpreted.evidenceIntegrity.unknowns.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                    <span className="text-amber-400 font-bold">&bull;</span>
                                    <span>{item.statement}</span>
                                </li>
                            ))}
                        </ul>
                        <p className="text-[11px] text-amber-300/80 italic pt-1 border-t border-amber-500/20">
                            Halo does not guess missing backend causes without correlated telemetry.
                        </p>
                    </div>
                </div>
            </section>

            {/* G. RECOMMENDATIONS (ACTIONS) */}
            <RecommendationPlanView plan={interpreted.recommendations} />
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Helper UI Components                                                       */
/* -------------------------------------------------------------------------- */

function SectionHeading({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div className="halo-section-heading">
            <h2 className="halo-section-title">
                {title}
            </h2>

            <p className="halo-section-description">
                {description}
            </p>
        </div>
    );
}

function StatusBadge({
    status,
}: {
    status: Investigation["status"];
}) {
    return (
        <span
            className={`halo-status halo-status-${status.toLowerCase()}`}
        >
            {formatLabel(status)}
        </span>
    );
}

function formatLabel(value: string) {
    return value
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/\b\w/g, (character) =>
            character.toUpperCase()
        );
}
