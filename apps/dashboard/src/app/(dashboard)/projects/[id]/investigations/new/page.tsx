import { investigateIssueOccurrence } from "@/lib/investigation/run";
import { BackButton } from "@/components/ui/back-button";
import {
    Activity,
    AlertCircle,
    ArrowDown,
    ArrowRight,
    CheckCircle2,
    Clock,
    Code2,
    Compass,
    Copy,
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
    Terminal,
    XCircle,
    Zap,
} from "lucide-react";

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
    }>;
};

import { NoEventsInvestigationModal } from "./no-events-modal";
import { getReplaySessionForOccurrence, type ResolvedOccurrenceReplay } from "@/actions/replay";
import { ReplayPlayerClient } from "@/components/replay/replay-player-client";
import { ReplayStatus } from "@/components/replay/replay-status";
import { interpretInvestigation, type InterpretedInvestigation } from "@/lib/investigation/interpreter";
import { RuntimeReconstructionView } from "@/components/investigation/runtime-reconstruction-view";
import { CausalChainView } from "@/components/investigation/causal-chain-view";
import { resolveGitHubSourceContext } from "@/lib/investigation/runtime/github-source-provider";
import { parseStackTrace } from "@/lib/investigation/runtime/stack-parser";
import type { SourceContext } from "@/lib/investigation/runtime/types";

export default async function InvestigationPage({
    params,
    searchParams,
}: Props) {
    const { id } = await params;
    const { issueId, eventId } = await searchParams;

    if (!issueId) {
        return (
            <NoEventsInvestigationModal
                projectId={id}
                errorMessage="Please select an active issue to start an investigation."
            />
        );
    }

    try {
        const [{ investigation, incidentAnchorId, incidentAnchorTimestamp, historicalOccurrenceCount }, resolvedReplay] = await Promise.all([
            investigateIssueOccurrence(issueId, id, eventId),
            getReplaySessionForOccurrence(issueId, eventId, id),
        ]);

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
        if (anchorError) {
            const rawStack =
                typeof anchorError.metadata?.stack === "string"
                    ? anchorError.metadata.stack
                    : anchorError.description || "";
            const frames = parseStackTrace(rawStack);
            const primaryFailingFrame =
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
}: {
    investigation: Investigation;
    resolvedReplay: ResolvedOccurrenceReplay;
    projectId: string;
    incidentAnchorId?: string;
    incidentAnchorTimestamp?: Date;
    historicalOccurrenceCount?: number;
    resolvedSourceContext?: SourceContext;
    anchorError?: any;
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
    const interpreted = interpretInvestigation(investigation, replaySession, incidentAnchorId, resolvedSourceContext);

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
            <div className="mb-4">
                <BackButton fallbackHref="/overview" label="Back to Overview" />
            </div>

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
                    Reconstructed transaction cascade across browser client and backend APIs for this specific occurrence.
                </p>

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
            <section className="halo-card p-6 border-border space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-accent" />
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                            Incident Summary
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted font-mono">Confidence:</span>
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
            <section className="halo-card p-6 border-border space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                            Earliest Observed Failure
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
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
            <CausalChainView
                causalChains={interpreted.causalChains}
                hypotheses={investigation.hypotheses}
                rawEdges={interpreted.rawEdges}
            />

            {/* D. WHAT HAPPENED (CHRONOLOGICAL) */}
            <section className="halo-card p-6 border-border space-y-5">
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
                                <MousePointer size={14} />
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
                        <p className="text-[11px] text-muted italic">
                            {interpreted.whatHappened.userAction.replayEvidence}
                        </p>
                    </div>

                    {/* Step 2: Failed Request */}
                    {interpreted.whatHappened.failedRequest && (
                        <div className="p-4 rounded-xl bg-surface border border-red-500/20 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-red-400">
                                    <Server size={14} />
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
                                <div>Duration: {interpreted.whatHappened.failedRequest.durationMs} ms</div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Client Exception */}
                    <div className="p-4 rounded-xl bg-surface border border-amber-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-amber-400">
                                <AlertCircle size={14} />
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

            {/* E. KNOWN VS UNKNOWN */}
            <section className="halo-card p-6 border-border space-y-5">
                <div className="border-b border-border pb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                        What is known vs unknown
                    </h2>
                    <span className="text-xs font-mono text-muted">Deterministic Boundary</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Confirmed */}
                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
                        <div className="flex items-center gap-2 text-emerald-400">
                            <CheckCircle2 size={15} />
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
                            <HelpCircle size={15} />
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

            {/* F. EVIDENCE (EVALUATED EVIDENCE RECORDS) */}
            <section className="halo-card p-6 border-border space-y-4 overflow-hidden">
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

            {/* G. SESSION REPLAY */}
            <section className="halo-section space-y-3">
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

            {/* H. RUNTIME FAILURE & STACK TRACE */}
            <RuntimeReconstructionView reconstruction={interpreted.runtimeReconstruction} />

            {/* I. RELATED TELEMETRY */}
            {(relatedTraces.length > 0 || relatedLogs.length > 0 || relatedMetrics.length > 0 || relatedThirdParty.length > 0) && (
                <section className="halo-card p-6 border-border space-y-4">
                    <div className="border-b border-border pb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-accent" />
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                                Related Telemetry Signals
                            </h2>
                        </div>
                        <span className="text-xs font-mono text-secondary">
                            {relatedTraces.length + relatedLogs.length + relatedMetrics.length + relatedThirdParty.length} items
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                        {relatedTraces.length > 0 && (
                            <div className="p-3 rounded-lg bg-surface border border-border space-y-2">
                                <span className="text-[10px] text-zinc-500 uppercase block font-bold">Distributed Traces & Spans ({relatedTraces.length})</span>
                                <ul className="space-y-1 text-zinc-300">
                                    {relatedTraces.map((t, i) => (
                                        <li key={i} className="truncate">
                                            <span className="text-blue-400">{t.service}</span>: {t.title}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {relatedLogs.length > 0 && (
                            <div className="p-3 rounded-lg bg-surface border border-border space-y-2">
                                <span className="text-[10px] text-zinc-500 uppercase block font-bold">Logs ({relatedLogs.length})</span>
                                <ul className="space-y-1 text-zinc-300">
                                    {relatedLogs.map((l, i) => (
                                        <li key={i} className="truncate text-zinc-400">
                                            {l.title}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {relatedMetrics.length > 0 && (
                            <div className="p-3 rounded-lg bg-surface border border-border space-y-2">
                                <span className="text-[10px] text-zinc-500 uppercase block font-bold">Metrics ({relatedMetrics.length})</span>
                                <ul className="space-y-1 text-zinc-300">
                                    {relatedMetrics.map((m, i) => (
                                        <li key={i} className="truncate text-zinc-400">
                                            {m.title}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {relatedThirdParty.length > 0 && (
                            <div className="p-3 rounded-lg bg-surface border border-border space-y-2">
                                <span className="text-[10px] text-zinc-500 uppercase block font-bold">Infrastructure & Third Party ({relatedThirdParty.length})</span>
                                <ul className="space-y-1 text-zinc-300">
                                    {relatedThirdParty.map((tp, i) => (
                                        <li key={i} className="truncate text-zinc-400">
                                            {tp.title}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* K. RECOMMENDATIONS */}
            <RecommendationPlanSection plan={interpreted.recommendations} />
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/* Recommendation Engine UI Components                                        */
/* -------------------------------------------------------------------------- */

function RecommendationPlanSection({ plan }: { plan: InterpretedInvestigation["recommendations"] }) {
    const { primary, secondary } = plan;

    const getKindBadge = (kind: string) => {
        switch (kind) {
            case "exact-code-fix":
                return { label: "Exact Code Fix", bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" };
            case "rollback":
                return { label: "Deployment Rollback", bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20" };
            case "config-fix":
                return { label: "Configuration Fix", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" };
            case "operational-fix":
                return { label: "Operational Remediation", bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" };
            case "dependency-fix":
                return { label: "Dependency Remediation", bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" };
            case "insufficient-evidence":
                return { label: "Telemetry Required", bg: "bg-zinc-800", text: "text-zinc-400", border: "border-zinc-700" };
            default:
                return { label: "Targeted Investigation", bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" };
        }
    };

    const badge = getKindBadge(primary.kind);

    return (
        <section className="halo-card p-6 border-border space-y-6">
            <div className="border-b border-border pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-accent" />
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                        What Halo recommends
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${badge.bg} ${badge.text} border ${badge.border} font-semibold`}>
                        {badge.label}
                    </span>
                </div>
            </div>

            <div className="space-y-6">
                {/* 1. Primary Action Box */}
                <div className="p-5 rounded-xl bg-surface border border-accent/30 space-y-3 shadow-lg shadow-accent/5">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-accent font-bold">
                            Immediate Resolution
                        </span>
                        {primary.confidence > 0 && (
                            <span className="text-xs font-mono text-secondary">
                                Confidence: {primary.confidence >= 0.85 || primary.confidence >= 85 ? "Very High" : primary.confidence >= 0.65 || primary.confidence >= 65 ? "High" : primary.confidence >= 0.4 || primary.confidence >= 40 ? "Medium" : "Low"}
                            </span>
                        )}
                    </div>

                    <p className="text-base font-bold text-white leading-snug">
                        {primary.immediateAction}
                    </p>

                    <p className="text-xs text-secondary leading-relaxed border-t border-border/60 pt-2.5">
                        {primary.rootCauseExplanation}
                    </p>
                </div>

                {/* 2. Code Patch Diff (if available) */}
                {primary.codePatch && (
                    <div className="p-4 rounded-xl bg-surface border border-blue-500/20 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-blue-400">
                                <Code2 size={15} />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                                    Recommended Code Patch
                                </h3>
                            </div>
                            <span className="text-[11px] font-mono text-zinc-400">
                                {primary.codePatch.filePath}
                                {primary.codePatch.lineRange ? `:${primary.codePatch.lineRange}` : ""}
                            </span>
                        </div>

                        {primary.codePatch.functionOrComponent && (
                            <div className="text-xs text-secondary font-mono">
                                Component/Function: <code className="text-accent bg-surface-hover px-1.5 py-0.5 rounded">{primary.codePatch.functionOrComponent}()</code>
                            </div>
                        )}

                        <div className="rounded-lg bg-[#080b11] border border-white/10 overflow-hidden text-xs font-mono">
                            <div className="px-3 py-1.5 bg-zinc-900/80 border-b border-white/5 text-[11px] text-zinc-400 flex items-center justify-between">
                                <span>Suggested Patch</span>
                                <span className="text-[10px] text-zinc-400">Suggested change — not executed or validated</span>
                            </div>
                            <pre className="p-3 text-emerald-300 overflow-x-auto leading-relaxed whitespace-pre font-mono text-xs">
                                <code>{primary.codePatch.after}</code>
                            </pre>
                        </div>

                        <p className="text-xs text-secondary leading-relaxed">
                            {primary.codePatch.explanation}
                        </p>

                        {primary.codePatch.sideEffects && (
                            <div className="p-2.5 rounded bg-amber-500/5 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
                                <Info size={14} className="shrink-0 mt-0.5 text-amber-400" />
                                <span>{primary.codePatch.sideEffects}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* 3. Operational Steps (if present) */}
                {primary.operationalSteps && primary.operationalSteps.length > 0 && (
                    <div className="p-4 rounded-xl bg-surface border border-purple-500/20 space-y-3">
                        <div className="flex items-center gap-2 text-purple-400">
                            <Terminal size={15} />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                                Operational Action Steps
                            </h3>
                        </div>
                        <ol className="space-y-2 pt-1 text-xs text-zinc-300">
                            {primary.operationalSteps.map((step, idx) => (
                                <li key={idx} className="flex items-start gap-2.5 p-2 rounded bg-[#080b11] border border-white/5">
                                    <span className="w-4 h-4 rounded-full bg-purple-500/10 text-purple-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                                        {idx + 1}
                                    </span>
                                    <span className="leading-relaxed">{step}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                )}

                {/* 4. Evidence Traceability Chain */}
                {primary.evidenceChain && primary.evidenceChain.length > 0 && (
                    <div className="p-4 rounded-xl bg-surface/60 border border-border/80 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-zinc-400">
                                <Layers size={14} />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                                    Evidence Provenance
                                </h3>
                            </div>
                            <span className="text-[10px] font-mono text-muted">
                                {primary.evidenceChain.length} supporting signals
                            </span>
                        </div>
                        <div className="divide-y divide-border/60 rounded-lg bg-[#080b11] border border-white/5 overflow-hidden">
                            {primary.evidenceChain.map((link, idx) => (
                                <div key={idx} className="p-2.5 flex items-center justify-between gap-3 text-xs font-mono">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-zinc-400 shrink-0">
                                            {link.role}
                                        </span>
                                        <span className="text-zinc-300 truncate text-[11px]">
                                            {link.excerpt}
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-muted shrink-0">
                                        {link.evidenceId.slice(0, 10)}…
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 5. Insufficient Evidence Diagnostics (if telemetry is missing) */}
                {primary.insufficientEvidence && (
                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                        <div className="flex items-center gap-2 text-amber-400">
                            <HelpCircle size={15} />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                                Telemetry Gaps & Unknowns
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="p-3 rounded-lg bg-[#080b11] border border-white/5 space-y-1.5">
                                <span className="text-[10px] font-mono uppercase text-emerald-400 font-semibold">
                                    Observed evidence
                                </span>
                                <ul className="space-y-1 text-zinc-300">
                                    {primary.insufficientEvidence.whatHaloKnows.map((k, i) => (
                                        <li key={i} className="flex items-start gap-1.5">
                                            <span className="text-emerald-400 font-bold">&bull;</span>
                                            <span>{k}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="p-3 rounded-lg bg-[#080b11] border border-white/5 space-y-1.5">
                                <span className="text-[10px] font-mono uppercase text-amber-400 font-semibold">
                                    Missing Telemetry
                                </span>
                                <ul className="space-y-1 text-zinc-300">
                                    {primary.insufficientEvidence.whatIsMissing.map((m, i) => (
                                        <li key={i} className="flex items-start gap-1.5">
                                            <span className="text-amber-400 font-bold">&bull;</span>
                                            <span>{m}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <p className="text-[11px] text-amber-300/80 italic border-t border-amber-500/20 pt-2">
                            <strong>Required:</strong> {primary.insufficientEvidence.requiredEvidence} &mdash; {primary.insufficientEvidence.why}
                        </p>
                    </div>
                )}

                {/* 6. Verification Steps */}
                <div className="p-4 rounded-xl bg-surface border border-emerald-500/20 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-400">
                            <CheckCircle2 size={15} />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                                Verification Procedure
                            </h3>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-400">
                            Expected: {primary.verification.expectedOutcome}
                        </span>
                    </div>

                    <ol className="space-y-1.5 pt-1 text-xs text-zinc-300">
                        {primary.verification.steps.map((step, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                                <span className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                                    {idx + 1}
                                </span>
                                <span>{step}</span>
                            </li>
                        ))}
                    </ol>

                    {primary.verification.regressionTest && (
                        <div className="p-2.5 rounded bg-[#080b11] border border-emerald-500/20 text-xs text-zinc-300 font-mono flex items-start gap-2">
                            <span className="text-emerald-400 font-bold text-[10px] uppercase">Test:</span>
                            <span className="text-[11px]">{primary.verification.regressionTest}</span>
                        </div>
                    )}
                </div>

                {/* 7. Prevention Guardrails */}
                {primary.prevention && primary.prevention.items.length > 0 && (
                    <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                        <div className="flex items-center gap-2 text-zinc-400">
                            <ShieldAlert size={15} />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                                Prevention Guardrails
                            </h3>
                        </div>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-secondary">
                            {primary.prevention.items.map((item, idx) => (
                                <li key={idx} className="p-2.5 rounded bg-[#080b11] border border-white/5 flex items-start gap-2">
                                    <span className="text-accent font-bold">&bull;</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                        {primary.prevention.monitoring && (
                            <p className="text-[11px] font-mono text-accent pt-1">
                                Alert Rule: {primary.prevention.monitoring}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </section>
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
