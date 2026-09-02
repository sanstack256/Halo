"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Boxes,
    Info,
    ExternalLink,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import type { PatternsProjection, FailurePattern } from "@/lib/issues/issue-intelligence";

interface PatternsViewProps {
    data: PatternsProjection;
}

export function PatternsView({ data }: PatternsViewProps) {
    const { patterns, summary, hasMeaningfulPatterns, emptyReason, timeRange } = data;
    const [expandedPatternId, setExpandedPatternId] = useState<string | null>(null);

    const getStrengthBadge = (strength: FailurePattern["evidenceStrength"]) => {
        switch (strength) {
            case "ROBUST":
                return (
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                        ROBUST PATTERN
                    </span>
                );
            case "MODERATE":
                return (
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                        MODERATE PATTERN
                    </span>
                );
            case "LIMITED":
            default:
                return (
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                        LIMITED PATTERN
                    </span>
                );
        }
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Patterns</h1>
                <p className="text-sm text-secondary mt-1">
                    Which failures share the same observed failure signature across available telemetry dimensions? Clusters distinct issues only when multi-dimensional telemetry confirms common failure mechanics.
                </p>
            </div>

            {/* Invariant Note */}
            <div className="p-3.5 rounded-xl bg-[#070a0f] border border-border text-xs font-mono text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Info size={14} className="text-accent shrink-0" />
                    <span>
                        <strong>Pattern Invariant:</strong> Generic error classifications (e.g. standard Application Exception without specific code or downstream dependency) are rejected. Shared behavior does not establish a shared root cause.
                    </span>
                </div>
                <span className="text-accent text-[10px] uppercase font-semibold shrink-0">
                    Behavioral Signatures
                </span>
            </div>

            {/* Summary Bar (Structured Analytical Surface) */}
            <div className="halo-metric-strip grid-cols-1 sm:grid-cols-3">
                <div className="halo-metric-cell space-y-1">
                    <span className="text-[10px] text-muted uppercase font-semibold block font-mono">Discovered Patterns</span>
                    <span className="text-2xl font-bold text-white block font-sans">{summary.totalPatterns}</span>
                    <span className="text-[11px] text-muted font-sans">Time window: {timeRange.key}</span>
                </div>
                <div className="halo-metric-cell space-y-1">
                    <span className="text-[10px] text-accent uppercase font-semibold block font-mono">Clustered Issues</span>
                    <span className="text-2xl font-bold text-accent block font-sans">{summary.totalAffectedIssues}</span>
                    <span className="text-[11px] text-muted font-sans">Issues sharing multi-dimensional behavior</span>
                </div>
                <div className="halo-metric-cell space-y-1">
                    <span className="text-[10px] text-secondary uppercase font-semibold block font-mono">Cross-Service Patterns</span>
                    <span className="text-2xl font-bold text-white block font-sans">{summary.crossServicePatterns}</span>
                    <span className="text-[11px] text-muted font-sans">Traversing service boundaries</span>
                </div>
            </div>

            {/* Content or Actionable Empty State per Section 10 */}
            {!hasMeaningfulPatterns || patterns.length === 0 ? (
                <div className="p-10 rounded-xl bg-surface border border-border text-center space-y-3">
                    <Boxes className="w-8 h-8 text-zinc-500 mx-auto" />
                    <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                        No Shared Execution Pattern Established
                    </h2>
                    <p className="text-xs text-secondary max-w-lg mx-auto font-mono leading-relaxed">
                        {emptyReason ||
                            "Generic error classifications are present across multiple issues, but available telemetry does not establish a shared execution behavior."}
                    </p>
                    <p className="text-[11px] text-zinc-400 max-w-md mx-auto font-mono">
                        Collect richer request, trace, dependency, or execution telemetry to enable behavioral comparison across issues.
                    </p>
                    <div className="pt-1 text-[10px] font-mono text-zinc-600">
                        Evaluated dimensions: failure boundaries, exception classes, HTTP status codes, and downstream resource dependencies.
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {patterns.map((p) => {
                        const isExpanded = expandedPatternId === p.id;

                        return (
                            <div
                                key={p.id}
                                className="p-4 rounded-xl bg-surface border border-border space-y-3 transition-all duration-150"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h2 className="text-sm font-semibold text-white font-sans">{p.name}</h2>
                                            {getStrengthBadge(p.evidenceStrength)}
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-surface-elevated text-zinc-300 border border-border">
                                                {p.issuesCount} distinct issues • {p.occurrencesCount} occurrences
                                            </span>
                                        </div>
                                        <div className="text-xs font-sans text-secondary flex items-center gap-2 flex-wrap">
                                            <span>Signature: <code className="text-zinc-200 font-mono text-[11px]">{p.behavioralSignature}</code></span>
                                            <span>•</span>
                                            <span>Services: <strong className="text-white font-mono text-[11px]">{p.affectedServices.join(", ")}</strong></span>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setExpandedPatternId(isExpanded ? null : p.id)}
                                        className="halo-btn halo-btn-secondary halo-btn-xs text-[11px] font-mono shrink-0"
                                        aria-expanded={isExpanded}
                                    >
                                        <span>{isExpanded ? "Hide Details" : "Inspect Fingerprint"}</span>
                                        {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                    </button>
                                </div>

                                {/* Common Observed Behavior & Why this qualifies as a pattern */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                    <div className="p-3 rounded-lg bg-[#06080d] border border-border/80 space-y-1">
                                        <span className="text-[11px] font-medium text-accent block font-sans">
                                            Common Observed Behavior
                                        </span>
                                        <span className="text-secondary block text-xs font-sans leading-relaxed">
                                            {p.commonObservedBehavior}
                                        </span>
                                    </div>
                                    <div className="p-3 rounded-lg bg-[#06080d] border border-border/80 space-y-1">
                                        <span className="text-[11px] font-medium text-primary block font-sans">
                                            Pattern Qualification Rationale
                                        </span>
                                        <span className="text-secondary block text-xs font-sans leading-relaxed">
                                            {p.whyThisIsAPattern}
                                        </span>
                                    </div>
                                </div>

                                {/* Progressive Disclosure: Fingerprint Sequence & Associated Issues */}
                                {isExpanded && (
                                    <div className="space-y-3 pt-2 border-t border-border/60 animate-in fade-in-50 duration-200">
                                        {/* Fingerprint steps */}
                                        <div className="space-y-1.5">
                                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
                                                Multi-Stage Execution Sequence
                                            </span>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                                                {p.fingerprintSteps.map((step, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="p-2.5 rounded-lg bg-surface-elevated border border-border space-y-1"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[9px] uppercase font-bold text-accent">
                                                                Step {idx + 1}: {step.stage.replace("_", " ")}
                                                            </span>
                                                            <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                                                                {step.evidenceStatus}
                                                            </span>
                                                        </div>
                                                        <span className="text-white font-semibold block text-[11px] truncate">
                                                            {step.value}
                                                        </span>
                                                        <span className="text-[10px] text-zinc-400 block">
                                                            {step.evidenceDetail}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Invariants & Divergences */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                                            <div className="p-2.5 rounded-lg bg-surface-elevated border border-border space-y-1">
                                                <span className="text-[10px] uppercase font-bold text-emerald-400 block">
                                                    Invariants Across Group
                                                </span>
                                                <ul className="space-y-0.5 text-[11px] text-zinc-300 list-disc list-inside">
                                                    {p.invariants.map((inv, i) => (
                                                        <li key={i}>{inv}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="p-2.5 rounded-lg bg-surface-elevated border border-border space-y-1">
                                                <span className="text-[10px] uppercase font-bold text-amber-400 block">
                                                    Divergences
                                                </span>
                                                <ul className="space-y-0.5 text-[11px] text-zinc-300 list-disc list-inside">
                                                    {p.divergences.map((div, i) => (
                                                        <li key={i}>{div}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>

                                        {/* Associated issues list */}
                                        <div className="p-2.5 rounded-lg bg-[#06080d] border border-border/80 space-y-1.5 text-xs font-mono">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                                                Distinct Participating Issues ({p.associatedIssues.length})
                                            </span>
                                            <div className="divide-y divide-border/40">
                                                {p.associatedIssues.map((iss) => (
                                                    <div
                                                        key={iss.id}
                                                        className="py-1.5 flex items-center justify-between gap-2 text-[11px]"
                                                    >
                                                        <div className="flex items-center gap-2 truncate">
                                                            <span className="text-zinc-200 font-semibold truncate">{iss.title}</span>
                                                            <span className="text-zinc-500 text-[10px]">({iss.service})</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className="text-accent">{iss.occurrences} events</span>
                                                            <Link
                                                                href={`/projects/${iss.projectId}/issues/${iss.id}`}
                                                                className="text-zinc-400 hover:text-white p-1"
                                                                aria-label="View issue details"
                                                            >
                                                                <ExternalLink size={12} />
                                                            </Link>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
