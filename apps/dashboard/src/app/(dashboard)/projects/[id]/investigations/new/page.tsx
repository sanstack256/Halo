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

            {/* 8. User Session Replay */}
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

            {/* 9. What Halo recommends */}
            <section className="halo-card p-6 border-border space-y-6">
                <div className="border-b border-border pb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                        What Halo recommends
                    </h2>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-accent/10 text-accent font-semibold">
                        Actionable Fix Plan
                    </span>
                </div>

                <div className="space-y-5">
                    {/* Immediate Backend Investigation */}
                    <div className="p-4 rounded-xl bg-surface border border-red-500/20 space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-red-400">
                            Immediate investigation
                        </h3>
                        <p className="text-xs font-semibold text-white">
                            {interpreted.recommendations.immediateInvestigation.title}
                        </p>
                        <p className="text-xs text-secondary">
                            {interpreted.recommendations.immediateInvestigation.description}
                        </p>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                            {interpreted.recommendations.immediateInvestigation.checklist.map((item, idx) => (
                                <li key={idx} className="p-2 rounded bg-[#080b11] border border-white/5 text-xs text-zinc-300 flex items-center gap-2">
                                    <span className="text-red-400 font-bold">&rarr;</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Likely Client-Side Bug */}
                    {interpreted.recommendations.likelyRemediation && (
                        <div className="p-4 rounded-xl bg-surface border border-blue-500/20 space-y-2">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                                Likely client-side bug
                            </h3>
                            <p className="text-xs font-semibold text-white">
                                {interpreted.recommendations.likelyRemediation.title}
                            </p>
                            <p className="text-xs text-secondary">
                                {interpreted.recommendations.likelyRemediation.description}
                            </p>
                            <pre className="p-3 rounded-lg bg-[#080b11] border border-white/10 text-xs font-mono text-emerald-300 overflow-x-auto my-2 leading-relaxed">
                                <code>{interpreted.recommendations.likelyRemediation.codeSnippet}</code>
                            </pre>
                        </div>
                    )}

                    {/* Verification */}
                    <div className="p-4 rounded-xl bg-surface border border-emerald-500/20 space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                            Verification
                        </h3>
                        <p className="text-xs text-secondary">
                            After fixing the backend failure:
                        </p>
                        <ol className="space-y-1.5 pt-1 text-xs text-zinc-300">
                            {interpreted.recommendations.verificationSteps.map((step, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                    <span className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                                        {idx + 1}
                                    </span>
                                    <span>{step}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                </div>
            </section>
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