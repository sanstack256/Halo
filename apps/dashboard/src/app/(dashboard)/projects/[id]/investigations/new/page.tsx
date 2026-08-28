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
import { getReplaySessionForIssue } from "@/actions/replay";
import { ReplayPlayerClient } from "@/components/replay/replay-player-client";
import { ReplayStatus } from "@/components/replay/replay-status";
import { interpretInvestigation, type InterpretedInvestigation } from "@/lib/investigation/interpreter";
import { RuntimeReconstructionView } from "@/components/investigation/runtime-reconstruction-view";

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
        const [{ investigation, incidentAnchorId, incidentAnchorTimestamp, historicalOccurrenceCount }, replaySession] = await Promise.all([
            investigateIssueOccurrence(issueId, id, eventId),
            getReplaySessionForIssue(issueId),
        ]);
        return (
            <InvestigationView
                investigation={investigation}
                replaySession={replaySession}
                projectId={id}
                incidentAnchorId={incidentAnchorId}
                incidentAnchorTimestamp={incidentAnchorTimestamp}
                historicalOccurrenceCount={historicalOccurrenceCount}
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
    replaySession,
    projectId,
    incidentAnchorId,
    incidentAnchorTimestamp,
    historicalOccurrenceCount,
}: {
    investigation: Investigation;
    replaySession?: any | null;
    projectId: string;
    incidentAnchorId?: string;
    incidentAnchorTimestamp?: Date;
    historicalOccurrenceCount?: number;
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

    const interpreted = interpretInvestigation(investigation, replaySession, incidentAnchorId);

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

            {/* 1. Root Cause Section */}
            <section className="halo-card p-6 border-border space-y-5">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                            Root cause
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted font-mono">Confidence:</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {interpreted.rootCauseSummary.confidenceLabel}
                        </span>
                    </div>
                </div>

                <div className="space-y-4">
                    <p className="text-base text-zinc-200 leading-relaxed font-medium">
                        {interpreted.rootCauseSummary.rootCauseStatement}
                    </p>

                    {/* Visual Causal Flowchart Box */}
                    <div className="rounded-xl bg-[#080b11] border border-white/10 p-4 font-mono text-xs text-zinc-300 overflow-x-auto space-y-1">
                        <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-sans font-semibold mb-2">
                            The evidence directly establishes the sequence:
                        </div>
                        <pre className="text-emerald-400 leading-snug">
                            {interpreted.asciiFlow}
                        </pre>
                    </div>

                    <p className="text-xs text-secondary italic">
                        The browser exception is therefore <strong className="text-white">a downstream symptom</strong>, not the originating failure.
                    </p>
                </div>
            </section>

            {/* 2. What Happened Section */}
            <section className="halo-card p-6 border-border space-y-5">
                <div className="border-b border-border pb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                        What happened
                    </h2>
                    <span className="text-xs font-mono text-secondary">
                        {interpreted.whatHappened.timeFormatted} &bull; {interpreted.whatHappened.pageUrl}
                    </span>
                </div>

                <p className="text-sm text-zinc-300">
                    At <strong className="text-white font-mono">{interpreted.whatHappened.timeFormatted}</strong>, the user was on <code className="text-accent bg-surface px-1.5 py-0.5 rounded text-xs">{interpreted.whatHappened.pageUrl}</code> and clicked <strong className="text-white">Pay</strong>. Halo observed:
                </p>

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
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Observed
                            </span>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">
                            {interpreted.whatHappened.userAction.description}.
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

            {/* 3. Why this is the root cause chain */}
            <section className="halo-card p-6 border-border space-y-4">
                <div className="border-b border-border pb-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                        Why this is the root cause chain
                    </h2>
                </div>

                <p className="text-sm text-zinc-300 leading-relaxed">
                    {interpreted.whyThisConclusion.narrative}
                </p>

                <div className="p-4 rounded-xl bg-[#080b11] border border-white/10 space-y-2">
                    <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider font-semibold">
                        Causal relationship
                    </span>
                    <pre className="font-mono text-xs text-zinc-300 leading-relaxed">
                        {interpreted.whyThisConclusion.treeDiagram}
                    </pre>
                </div>
            </section>

            {/* 4. What is known vs unknown */}
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
                                Confirmed
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
                                Unknown
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
                            Halo should never invent the missing backend cause just because a TypeError is available.
                        </p>
                    </div>
                </div>
            </section>

            {/* 5. Historical / Unrelated Evidence Filter */}
            {interpreted.historicalObservations.hasUnrelatedEvents && (
                <section className="p-4 rounded-xl bg-surface border border-border space-y-2">
                    <div className="flex items-center gap-2 text-secondary">
                        <Info size={14} className="text-accent" />
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                            Historical / Unrelated Evidence
                        </h3>
                    </div>
                    <blockquote className="text-xs text-secondary italic border-l-2 border-accent/40 pl-3 py-1">
                        {interpreted.historicalObservations.explanation}
                    </blockquote>
                </section>
            )}

            {/* 6. Evidence Matrix Table */}
            <section className="halo-card p-6 border-border space-y-4 overflow-hidden">
                <div className="border-b border-border pb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                        Evidence
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

            {/* 7. Qualitative Confidence Breakdown */}
            <section className="halo-card p-6 border-border space-y-4">
                <div className="border-b border-border pb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                        Confidence
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Root Cause Confidence */}
                    <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold text-white">
                                Root-cause confidence:
                            </h3>
                            <span className="text-xs font-bold text-emerald-400">
                                {interpreted.rootCauseSummary.confidenceLabel}
                            </span>
                        </div>
                        <ul className="space-y-1.5 text-xs text-secondary pt-1">
                            {interpreted.rootCauseSummary.reasoning.map((r, idx) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                    <span className="text-accent font-bold">&bull;</span>
                                    <span>{r}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Exact Backend Cause Confidence */}
                    <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold text-white">
                                Exact backend cause:
                            </h3>
                            <span className="text-xs font-bold text-amber-400">
                                Unknown
                            </span>
                        </div>
                        <p className="text-xs text-secondary pt-1">
                            Because Halo lacks server-side evidence explaining the 500.
                        </p>
                    </div>
                </div>
            </section>

            {/* 8. Exact Runtime Failure & Context Reconstruction (Features 1 & 2) */}
            <RuntimeReconstructionView reconstruction={interpreted.runtimeReconstruction} />

            {/* 9. User Session Replay */}
            <section className="halo-section space-y-3">
                <SectionHeading
                    title="User Session Replay"
                    description="Reconstructed browser DOM interactions, mouse clicks, and network requests correlated directly with this failure."
                />

                {replaySession ? (
                    <div className="space-y-4">
                        <ReplayPlayerClient
                            replaySession={replaySession}
                            issueTitle={rootCause?.title || "Incident Session"}
                        />
                    </div>
                ) : (
                    <ReplayStatus status="NO_REPLAY" projectId={projectId} />
                )}
            </section>

            {/* 10. What Halo recommends */}
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
                                <span className="text-[10px] text-emerald-400">Validated against telemetry</span>
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
                                    What Halo Confirmed
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