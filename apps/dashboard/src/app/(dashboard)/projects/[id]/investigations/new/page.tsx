import { investigateIssueOccurrence, investigateMonitorOccurrence } from "@/lib/investigation/run";
import { getMonitorTypeDefinition } from "@/lib/monitors/definitions";
import { BackButton } from "@/components/ui/back-button";
import {
    Activity,
    AlertCircle,
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

export default async function InvestigationPage({
    params,
    searchParams,
}: Props) {
    const { id } = await params;
    const { issueId, eventId, monitorId, alertId } = await searchParams;

    if (!issueId && !monitorId) {
        return (
            <NoEventsInvestigationModal
                projectId={id}
                errorMessage="Please select an active issue or monitor trigger to start an investigation."
            />
        );
    }

    try {
        let investigation: Investigation;
        let incidentAnchorId: string | undefined;
        let incidentAnchorTimestamp: Date | undefined;
        let historicalOccurrenceCount: number | undefined;
        let resolvedReplay: ResolvedOccurrenceReplay | null = null;
        let monitorContext: {
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
        } | null = null;

        if (monitorId) {
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
        } else {
            // Issue Occurrence Investigation Path
            const [issueResult, replay] = await Promise.all([
                investigateIssueOccurrence(issueId!, id, eventId),
                getReplaySessionForOccurrence(issueId!, eventId, id),
            ]);
            investigation = issueResult.investigation;
            incidentAnchorId = issueResult.incidentAnchorId;
            incidentAnchorTimestamp = issueResult.incidentAnchorTimestamp;
            historicalOccurrenceCount = issueResult.historicalOccurrenceCount;
            resolvedReplay = replay;
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

        // Run Automatic Regression Detection if issue context exists
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
        ? new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "numeric",
              second: "numeric",
              hour12: true,
          }).format(new Date(incidentAnchorTimestamp))
        : null;

    // Categorize related telemetry for section I
    const relatedTraces = evidence.filter((e) => e.type === "TRACE");
    const relatedLogs = evidence.filter((e) => e.type === "LOG");
    const relatedMetrics = evidence.filter((e) => e.type === "METRIC");
    const relatedThirdParty = evidence.filter((e) => e.type === "THIRD_PARTY" || e.type === "INFRASTRUCTURE");

    return (
        <div className="halo-investigation max-w-5xl mx-auto space-y-8 pb-16">
            <div className="mb-4 flex items-center justify-between">
                <BackButton
                    fallbackHref={monitorContext ? `/monitors/${monitorContext.monitor.id}` : "/overview"}
                    label={monitorContext ? "Back to Monitor" : "Back to Issues"}
                />
                <div className="text-xs font-mono text-zinc-500">
                    {monitorContext ? (
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

            {/* Monitor Trigger Origin Context Banner */}
            {monitorContext && (
                <div className="p-4 rounded-2xl border border-accent/20 bg-accent/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full bg-accent/20 border border-accent/30 text-accent font-semibold text-[11px]">
                                Monitor Origin: {getMonitorTypeDefinition(monitorContext.monitor.type).shortLabel}
                            </span>
                            <span className="text-white font-semibold">
                                {monitorContext.monitor.name}
                            </span>
                        </div>
                        <p className="text-zinc-300 text-[11px] leading-relaxed">
                            {monitorContext.alert?.conditionSummary || `Threshold parameters evaluated over rolling window.`}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Link
                            href={`/monitors/${monitorContext.monitor.id}`}
                            className="halo-btn halo-btn-secondary halo-btn-xs"
                        >
                            <BellRing size={11} />
                            <span>Monitor Config</span>
                        </Link>
                        {monitorContext.alert && (
                            <Link
                                href={`/monitors/alerts/${monitorContext.alert.id}`}
                                className="halo-btn halo-btn-primary halo-btn-xs"
                            >
                                <ShieldAlert size={11} />
                                <span>View Alert</span>
                            </Link>
                        )}
                    </div>
                </div>
            )}

            {/* Sticky Section Navigation */}
            <InvestigationStickyNav />

            {/* Header */}
            <header className="halo-investigation-header space-y-3">
                <div className="halo-eyebrow-row flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="halo-eyebrow font-mono text-xs uppercase tracking-wider text-accent font-semibold">
                            Incident Investigation Report
                        </span>
                        {formattedAnchorTime && (
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-secondary">
                                Occurrence: {formattedAnchorTime}
                            </span>
                        )}
                    </div>
                    <StatusBadge status={status} />
                </div>

                <h1 className="text-3xl font-bold text-white tracking-tight">
                    {interpreted.headline}
                </h1>

                <p className="text-sm text-secondary">
                    Reconstructed transaction cascade across client interactions and backend APIs for this specific occurrence.
                </p>

                {/* Compact Horizontal Investigation Summary Bar */}
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

                {/* Core Four Questions Briefing Block */}
                <div className="p-4 rounded-xl bg-[#080b11] border border-white/10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div className="space-y-1 border-b sm:border-b-0 sm:border-r border-white/10 pb-2 sm:pb-0 sm:pr-3">
                        <span className="text-[10px] uppercase font-mono font-bold text-red-400 block">1. What Failed?</span>
                        <p className="text-zinc-200 font-medium truncate" title={interpreted.headline}>{interpreted.headline}</p>
                    </div>
                    <div className="space-y-1 border-b sm:border-b-0 sm:border-r border-white/10 pb-2 sm:pb-0 sm:pr-3">
                        <span className="text-[10px] uppercase font-mono font-bold text-emerald-400 block">2. What Do We Know?</span>
                        <p className="text-zinc-200 font-medium">{interpreted.evidenceIntegrity.confirmedFacts.length} verified facts observed</p>
                    </div>
                    <div className="space-y-1 border-b sm:border-b-0 md:border-r border-white/10 pb-2 sm:pb-0 sm:pr-3">
                        <span className="text-[10px] uppercase font-mono font-bold text-amber-400 block">3. What is the Likely Cause?</span>
                        <p className="text-zinc-200 font-medium truncate">{interpreted.rootCauseSummary.isClientDownstream ? "Upstream network failure" : interpreted.rootCauseSummary.rootCauseStatement}</p>
                    </div>
                    <div className="space-y-1">
                        <span className="text-[10px] uppercase font-mono font-bold text-accent block">4. What Should I Do?</span>
                        <p className="text-zinc-200 font-medium truncate" title={interpreted.recommendations.primary.immediateAction}>{interpreted.recommendations.primary.immediateAction}</p>
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
                            Incident Summary
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted font-mono">Investigation confidence:</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {interpreted.rootCauseSummary.confidenceLabel}
                        </span>
                    </div>
                </div>

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
            </section>

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
