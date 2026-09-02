"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    History,
    GitBranch,
    Clock,
    Info,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import type { EvolutionProjection, IssueEvolution } from "@/lib/issues/issue-intelligence";
import { RelativeTime } from "@/components/ui/relative-time";

interface EvolutionViewProps {
    data: EvolutionProjection;
}

export function EvolutionView({ data }: EvolutionViewProps) {
    const { evolutions, summary, timeRange } = data;
    const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Evolution</h1>
                <p className="text-sm text-secondary mt-1">
                    How has this failure's observable behavior changed over time? Reconstructs chronological behavioral transitions and detects telemetry continuity breaks.
                </p>
            </div>

            {/* Invariant Note */}
            <div className="p-3.5 rounded-xl bg-[#070a0f] border border-border text-xs font-mono text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Info size={14} className="text-accent shrink-0" />
                    <span>
                        <strong>Evolution Invariant:</strong> Behavioral versions (DNA) are only assigned when an observed execution property shifts. Static issues display a single verified behavioral state without synthetic versioning.
                    </span>
                </div>
                <span className="text-accent text-[10px] uppercase font-semibold shrink-0">
                    Empirical Transitions
                </span>
            </div>

            {/* Summary Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block">Tracked Issues</span>
                    <span className="text-2xl font-bold text-white block">{summary.totalTracked}</span>
                    <span className="text-[11px] text-zinc-400">Time window: {timeRange.key}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-surface border border-amber-500/20 space-y-1">
                    <span className="text-[10px] text-amber-400 uppercase font-semibold block">Behavioral Transitions</span>
                    <span className="text-2xl font-bold text-amber-400 block">{summary.behaviorShiftsDetected}</span>
                    <span className="text-[11px] text-zinc-400">Empirical property shifts</span>
                </div>
                <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold block">Continuity Gaps</span>
                    <span className="text-2xl font-bold text-zinc-300 block">{summary.telemetryGapsDetected}</span>
                    <span className="text-[11px] text-zinc-400">Interrupted telemetry intervals</span>
                </div>
            </div>

            {evolutions.length === 0 ? (
                <div className="p-12 rounded-2xl bg-surface border border-border text-center space-y-2">
                    <History className="w-8 h-8 text-zinc-500 mx-auto" />
                    <h3 className="text-base font-semibold text-white">No evolution timelines available</h3>
                    <p className="text-xs text-secondary max-w-md mx-auto font-mono">
                        No telemetry transitions found for the active filter settings in this window.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {evolutions.map((evo) => {
                        const isExpanded = expandedIssueId === evo.issueId;

                        // SECTION 12: Stable evolution should be compact!
                        if (!evo.hasTransition) {
                            return (
                                <div
                                    key={evo.issueId}
                                    className="p-4 rounded-xl bg-surface border border-border space-y-3 text-xs font-mono"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="space-y-0.5 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h2 className="text-sm font-bold text-white truncate">{evo.title}</h2>
                                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-elevated text-zinc-400 border border-border">
                                                    Single Stable State
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-zinc-400 flex items-center gap-2 flex-wrap">
                                                <span>Service: <strong className="text-zinc-200">{evo.service}</strong></span>
                                                <span>•</span>
                                                <span className="text-zinc-500">
                                                    Boundary: <strong className="text-zinc-300">{evo.currentDNA.failureBoundary}</strong>
                                                </span>
                                                <span>•</span>
                                                <span className="text-zinc-500">
                                                    Status: <strong className="text-zinc-300">{evo.currentDNA.responseStatus}</strong>
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setExpandedIssueId(isExpanded ? null : evo.issueId)}
                                            className="halo-btn halo-btn-secondary halo-btn-xs text-[10px] font-mono shrink-0"
                                        >
                                            <span>{isExpanded ? "Hide Details" : "Inspect Observed Behavior"}</span>
                                            {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                        </button>
                                    </div>

                                    {/* SECTION 1: Truthful wording when no transition exists */}
                                    <div className="p-2.5 rounded-lg bg-[#06080d] border border-border/80 flex items-center justify-between gap-2 text-[11px]">
                                        <div className="space-y-0.5">
                                            <span className="text-[10px] uppercase font-bold text-accent block">
                                                CURRENT OBSERVED BEHAVIOR
                                            </span>
                                            <span className="text-zinc-300">
                                                One stable behavioral state observed. No behavioral transition established during the selected window.
                                            </span>
                                        </div>
                                    </div>

                                    {/* Expanded: show full DNA properties without fabricated versions */}
                                    {isExpanded && (
                                        <div className="space-y-2 pt-2 border-t border-border/60">
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                <div className="p-2 rounded bg-surface-elevated border border-border">
                                                    <span className="text-[9px] text-zinc-500 uppercase block">Failure Boundary</span>
                                                    <span className="text-white font-semibold block text-[11px]">{evo.currentDNA.failureBoundary}</span>
                                                </div>
                                                <div className="p-2 rounded bg-surface-elevated border border-border">
                                                    <span className="text-[9px] text-zinc-500 uppercase block">Response Status</span>
                                                    <span className="text-white font-semibold block text-[11px]">{evo.currentDNA.responseStatus}</span>
                                                </div>
                                                <div className="p-2 rounded bg-surface-elevated border border-border">
                                                    <span className="text-[9px] text-zinc-500 uppercase block">Dependency Call</span>
                                                    <span className="text-white font-semibold block text-[11px]">{evo.currentDNA.dependencyInvolvement}</span>
                                                </div>
                                                <div className="p-2 rounded bg-surface-elevated border border-border">
                                                    <span className="text-[9px] text-zinc-500 uppercase block">Retry Behavior</span>
                                                    <span className="text-zinc-300 font-semibold block text-[11px]">{evo.currentDNA.retryBehavior}</span>
                                                </div>
                                            </div>

                                            {/* Gaps if any */}
                                            {evo.timeline.some((t) => t.type === "GAP") && (
                                                <div className="space-y-1 pt-1">
                                                    {evo.timeline.filter((t) => t.type === "GAP").map((gap) => (
                                                        <div key={gap.id} className="p-2 rounded border border-dashed border-zinc-700 bg-zinc-900/30 text-[10px] text-zinc-400 flex items-center justify-between">
                                                            <div className="flex items-center gap-1.5">
                                                                <Clock size={11} className="text-zinc-500" />
                                                                <span>{gap.title} ({gap.gapDurationHours}h interval)</span>
                                                            </div>
                                                            <span className="text-zinc-500">{gap.description}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        // Transitioning issue: Render full evolution timeline with DNA versions
                        return (
                            <div
                                key={evo.issueId}
                                className="p-4 rounded-xl bg-surface border border-border space-y-3 text-xs font-mono"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-2.5">
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h2 className="text-sm font-bold text-white">{evo.title}</h2>
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                                                {evo.dnaStatesRecorded} Behavioral States Observed
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-zinc-400 flex items-center gap-2 flex-wrap">
                                            <span>Service: <strong className="text-zinc-200">{evo.service}</strong></span>
                                            <span>•</span>
                                            <span className="text-zinc-400">{evo.transitionSummary}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Active Profile with Version (legitimate version because transition exists) */}
                                <div className="p-2.5 rounded-lg bg-[#06080d] border border-border/80 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-bold uppercase text-accent block">
                                            Latest Profile ({evo.currentDNA.version})
                                        </span>
                                        <span className="text-zinc-500 text-[10px]">
                                            Observed at {evo.currentDNA.detectedAt.toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5">
                                        <div className="p-2 rounded bg-surface border border-border">
                                            <span className="text-[9px] text-zinc-500 uppercase block">Failure Boundary</span>
                                            <span className="text-white font-semibold block text-[11px]">{evo.currentDNA.failureBoundary}</span>
                                        </div>
                                        <div className="p-2 rounded bg-surface border border-border">
                                            <span className="text-[9px] text-zinc-500 uppercase block">Response Status</span>
                                            <span className="text-white font-semibold block text-[11px]">{evo.currentDNA.responseStatus}</span>
                                        </div>
                                        <div className="p-2 rounded bg-surface border border-border">
                                            <span className="text-[9px] text-zinc-500 uppercase block">Dependency Call</span>
                                            <span className="text-white font-semibold block text-[11px]">{evo.currentDNA.dependencyInvolvement}</span>
                                        </div>
                                        <div className="p-2 rounded bg-surface border border-border">
                                            <span className="text-[9px] text-zinc-500 uppercase block">Retry Behavior</span>
                                            <span className="text-zinc-300 font-semibold block text-[11px]">{evo.currentDNA.retryBehavior}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Transitions timeline */}
                                <div className="space-y-1.5 pt-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                                        Chronological State Transitions
                                    </span>

                                    <div className="space-y-2">
                                        {evo.timeline.map((item) => {
                                            if (item.type === "GAP") {
                                                return (
                                                    <div
                                                        key={item.id}
                                                        className="p-2.5 rounded border border-dashed border-zinc-700 bg-zinc-900/30 text-[10px] text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                                                    >
                                                        <div className="flex items-center gap-1.5">
                                                            <Clock size={12} className="text-zinc-500 shrink-0" />
                                                            <span className="font-semibold text-zinc-300">
                                                                {item.title} ({item.gapDurationHours}h interval)
                                                            </span>
                                                        </div>
                                                        <span className="text-zinc-500">{item.description}</span>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div
                                                    key={item.id}
                                                    className="p-2.5 rounded-lg bg-surface-elevated border border-border space-y-1"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            <GitBranch size={12} className="text-accent" />
                                                            <span className="text-white font-semibold">{item.title}</span>
                                                            {item.dnaVersion && (
                                                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-accent/10 text-accent border border-accent/20">
                                                                    {item.dnaVersion}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-zinc-500 text-[10px]">
                                                            <RelativeTime date={item.timestamp} />
                                                        </span>
                                                    </div>
                                                    <p className="text-zinc-300 text-[11px]">{item.description}</p>
                                                    {item.diffs && (
                                                        <div className="p-2 rounded bg-surface border border-border/80 space-y-0.5 mt-1">
                                                            <span className="text-[9px] uppercase font-bold text-amber-400 block">
                                                                Observed Changes
                                                            </span>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px]">
                                                                {item.diffs.map((d, i) => (
                                                                    <div key={i} className="flex items-center gap-1 text-zinc-300">
                                                                        <span className="text-zinc-500">{d.property}:</span>
                                                                        <span className="line-through text-zinc-500">{d.previous}</span>
                                                                        <span>→</span>
                                                                        <span className="text-white font-semibold">{d.current}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
