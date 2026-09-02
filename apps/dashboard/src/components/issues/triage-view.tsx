"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Sparkles,
    CheckCircle2,
    AlertTriangle,
    HelpCircle,
    Clock,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    TrendingUp,
} from "lucide-react";
import type {
    TriageProjection,
    TriageCandidate,
    InvestigationReadinessStatus,
} from "@/lib/issues/issue-intelligence";

interface TriageViewProps {
    data: TriageProjection;
}

export function TriageView({ data }: TriageViewProps) {
    const { candidates, summary } = data;
    const [expandedReadinessId, setExpandedReadinessId] = useState<string | null>(null);

    const getReadinessBadge = (status: InvestigationReadinessStatus) => {
        switch (status) {
            case "READY":
                return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                        <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                        READY
                    </span>
                );
            case "PARTIALLY_READY":
                return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                        <AlertTriangle size={11} className="text-amber-400 shrink-0" />
                        PARTIALLY READY
                    </span>
                );
            case "BLOCKED_BY_TELEMETRY":
                return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-semibold">
                        <HelpCircle size={11} className="text-red-400 shrink-0" />
                        BLOCKED BY TELEMETRY
                    </span>
                );
            case "INSUFFICIENT_EVIDENCE":
            default:
                return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 font-semibold">
                        INSUFFICIENT EVIDENCE
                    </span>
                );
        }
    };

    const getSurgeBadge = (surge: TriageCandidate["surge"]) => {
        switch (surge.status) {
            case "SURGE_OBSERVED":
                return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-bold">
                        <TrendingUp size={11} />
                        SURGE +{surge.changePct}%
                    </span>
                );
            case "NO_COMPARABLE_BASELINE":
                return (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-border" title={surge.explanation}>
                        NO BASELINE
                    </span>
                );
            case "NO_MATERIAL_CHANGE":
                return (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-elevated text-zinc-400 border border-border" title={surge.explanation}>
                        STEADY (±25%)
                    </span>
                );
            case "REDUCED_ACTIVITY":
                return (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title={surge.explanation}>
                        DECREASED {surge.changePct}%
                    </span>
                );
            case "INSUFFICIENT_OBSERVATION":
            default:
                return (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-elevated text-zinc-500 border border-border" title={surge.explanation}>
                        SPARSE DATA
                    </span>
                );
        }
    };

    const investigateNow = candidates.filter((c) => c.category === "INVESTIGATE_NOW");
    const worthInvestigating = candidates.filter((c) => c.category === "WORTH_INVESTIGATING");
    const needsEvidence = candidates.filter((c) => c.category === "NEEDS_EVIDENCE");
    const stableMonitor = candidates.filter((c) => c.category === "STABLE_MONITOR");

    const renderCandidateRow = (c: TriageCandidate) => {
        const isReadinessOpen = expandedReadinessId === c.id;

        return (
            <div
                key={c.id}
                className="rounded-xl bg-surface border border-border hover:border-border-strong transition-all duration-150 overflow-hidden"
            >
                <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                        {/* Title and Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-white font-bold truncate max-w-xl">
                                {c.title}
                            </span>
                            {getReadinessBadge(c.readiness.status)}
                            {getSurgeBadge(c.surge)}
                            {c.severity === "FATAL" && (
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 uppercase font-bold">
                                    FATAL
                                </span>
                            )}
                        </div>

                        {/* Metadata row */}
                        <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 flex-wrap">
                            <span className="text-accent font-semibold">{c.service}</span>
                            <span>•</span>
                            <span>{c.projectName}</span>
                            <span>•</span>
                            <span>{c.environment}</span>
                            <span>•</span>
                            <span>
                                {c.recentEventCount} event{c.recentEventCount === 1 ? "" : "s"} in window
                            </span>
                            <span>•</span>
                            <span className="text-zinc-500 flex items-center gap-1">
                                <Clock size={11} />
                                {c.hoursSinceLastSeen === 0 ? "Just now" : `${c.hoursSinceLastSeen}h ago`}
                            </span>
                        </div>

                        {/* Triage Reason */}
                        <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1.5 pt-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase font-semibold">TRIAGE REASON:</span>
                            <span className="text-zinc-300">{c.whyThisIsHere}</span>
                        </div>
                    </div>

                    {/* Actions: Strict Button Hierarchy per Rulebook Section 8 & 20 */}
                    <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0">
                        {/* Secondary action: Readiness inspector toggle */}
                        <button
                            onClick={() => setExpandedReadinessId(isReadinessOpen ? null : c.id)}
                            className="halo-btn halo-btn-secondary halo-btn-xs text-[11px] font-mono"
                            title="Inspect available vs missing evidence"
                            aria-expanded={isReadinessOpen}
                        >
                            <span>Readiness</span>
                            {isReadinessOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>

                        {/* Primary dominant action */}
                        <Link
                            href={`/projects/${c.projectId}/investigations/new?issueId=${c.issueId}`}
                            className="halo-btn halo-btn-primary halo-btn-xs"
                        >
                            <Sparkles size={11} />
                            <span>Investigate</span>
                        </Link>

                        {/* Ghost tertiary action */}
                        <Link
                            href={`/projects/${c.projectId}/issues/${c.issueId}`}
                            className="halo-btn halo-btn-ghost halo-btn-xs text-zinc-400 hover:text-white"
                            title="View in Project Issues"
                            aria-label="View in Project Issues"
                        >
                            <ExternalLink size={13} />
                        </Link>
                    </div>
                </div>

                {/* Expanded Investigation Readiness Inspector (Progressive Disclosure) */}
                {isReadinessOpen && (
                    <div className="p-4 border-t border-border/80 bg-[#06080d] space-y-3 text-xs font-mono animate-in fade-in-50 duration-200">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold text-accent tracking-wider">
                                Investigation Readiness Breakdown
                            </span>
                            <span className="text-zinc-500 text-[10px]">
                                Evidence Capability Assessment
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="p-3 rounded-lg bg-surface border border-border space-y-1">
                                <span className="text-[10px] uppercase font-bold text-emerald-400 block">
                                    Available Evidence Signals ({c.readiness.availableEvidence.length})
                                </span>
                                <ul className="space-y-0.5 text-zinc-300 text-[11px]">
                                    {c.readiness.availableEvidence.map((s, i) => (
                                        <li key={i} className="flex items-center gap-1.5">
                                            <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                                            <span>{s}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="p-3 rounded-lg bg-surface border border-border space-y-1">
                                <span className="text-[10px] uppercase font-bold text-amber-400 block">
                                    Missing Telemetry Signals ({c.readiness.missingEvidence.length})
                                </span>
                                <ul className="space-y-0.5 text-zinc-400 text-[11px]">
                                    {c.readiness.missingEvidence.length > 0 ? (
                                        c.readiness.missingEvidence.map((s, i) => (
                                            <li key={i} className="flex items-center gap-1.5">
                                                <HelpCircle size={11} className="text-amber-400 shrink-0" />
                                                <span>{s}</span>
                                            </li>
                                        ))
                                    ) : (
                                        <li className="text-zinc-500 italic">None — complete telemetry suite collected</li>
                                    )}
                                </ul>
                            </div>
                        </div>

                        {/* What Halo Can vs Cannot Establish */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            <div className="p-2.5 rounded-lg bg-surface-elevated border border-border text-[11px]">
                                <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                                    What Halo Can Establish:
                                </span>
                                <span className="text-zinc-200 mt-0.5 block">{c.readiness.whatCanBeEstablished}</span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-surface-elevated border border-border text-[11px]">
                                <span className="text-[10px] uppercase font-bold text-zinc-400 block">
                                    What Halo Cannot Establish:
                                </span>
                                <span className="text-zinc-400 mt-0.5 block">{c.readiness.whatCannotBeEstablished}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Triage</h1>
                <p className="text-sm text-secondary mt-1">
                    What deserves an engineer's attention right now? Prioritized by behavioral shift, active recency, and investigation readiness.
                </p>
            </div>

            {/* Queue Summary Strip (Metric Strip, No Card Soup) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3.5 rounded-xl bg-surface border border-red-500/20 space-y-1">
                    <span className="text-[10px] text-red-400 uppercase font-semibold block">Investigate Now</span>
                    <span className="text-2xl font-bold text-red-400 block">{summary.investigateNow}</span>
                    <span className="text-[11px] text-zinc-500">Active recent escalation</span>
                </div>
                <div className="p-3.5 rounded-xl bg-surface border border-amber-500/20 space-y-1">
                    <span className="text-[10px] text-amber-400 uppercase font-semibold block">Worth Investigating</span>
                    <span className="text-2xl font-bold text-amber-400 block">{summary.worthInvestigating}</span>
                    <span className="text-[11px] text-zinc-500">Steady recent activity</span>
                </div>
                <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Needs Evidence</span>
                    <span className="text-2xl font-bold text-zinc-300 block">{summary.needsEvidence}</span>
                    <span className="text-[11px] text-zinc-500">Telemetry blockers present</span>
                </div>
                <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold block">Stable / Monitor</span>
                    <span className="text-2xl font-bold text-zinc-400 block">{summary.stableMonitor}</span>
                    <span className="text-[11px] text-zinc-500">Low frequency or stale</span>
                </div>
            </div>

            {candidates.length === 0 ? (
                <div className="p-12 rounded-xl bg-surface border border-border text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <h3 className="text-base font-semibold text-white">No triage candidates</h3>
                    <p className="text-xs text-secondary max-w-md mx-auto">
                        No active issues matched the selected project, service, or time range filters.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* LANE 1: INVESTIGATE NOW */}
                    {investigateNow.length > 0 && (
                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-red-400">
                                    Investigate Now ({investigateNow.length})
                                </h2>
                                <span className="text-zinc-500 text-xs font-mono">— Active recent surge, fatal crash, or high failure velocity</span>
                            </div>
                            <div className="space-y-2.5">{investigateNow.map(renderCandidateRow)}</div>
                        </div>
                    )}

                    {/* LANE 2: WORTH INVESTIGATING */}
                    {worthInvestigating.length > 0 && (
                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                                    Worth Investigating ({worthInvestigating.length})
                                </h2>
                                <span className="text-zinc-500 text-xs font-mono">— Active failure activity observed in window</span>
                            </div>
                            <div className="space-y-2.5">{worthInvestigating.map(renderCandidateRow)}</div>
                        </div>
                    )}

                    {/* LANE 3: NEEDS EVIDENCE */}
                    {needsEvidence.length > 0 && (
                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-zinc-500" />
                                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">
                                    Needs Evidence ({needsEvidence.length})
                                </h2>
                                <span className="text-zinc-500 text-xs font-mono">— Unresolved, but causal progress is blocked by missing telemetry</span>
                            </div>
                            <div className="space-y-2.5">{needsEvidence.map(renderCandidateRow)}</div>
                        </div>
                    )}

                    {/* LANE 4: STABLE / MONITOR */}
                    {stableMonitor.length > 0 && (
                        <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-zinc-700" />
                                <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-500">
                                    Stable / Monitor ({stableMonitor.length})
                                </h2>
                                <span className="text-zinc-500 text-xs font-mono">— Inactive or steady-state; no active escalation detected</span>
                            </div>
                            <div className="space-y-2.5">{stableMonitor.map(renderCandidateRow)}</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
