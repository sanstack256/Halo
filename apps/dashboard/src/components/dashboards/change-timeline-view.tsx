"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    ArrowDownRight,
    ArrowRight,
    ArrowUpRight,
    CheckCircle2,
    Clock,
    GitCommit,
    HelpCircle,
    Info,
    Layers,
    Radio,
    ShieldAlert,
    Sparkles,
} from "lucide-react";
import type { ChangeImpactItem, ReleaseVerdict } from "@/lib/analytics/types";
import { formatDeterministicDateTime } from "@/lib/date-format";

interface ChangeTimelineViewProps {
    changes: ChangeImpactItem[];
    onSelectChange: (change: ChangeImpactItem) => void;
    projectId?: string;
}

export function ChangeTimelineView({
    changes,
    onSelectChange,
    projectId,
}: ChangeTimelineViewProps) {
    const verdictBadgeClass: Record<ReleaseVerdict, string> = {
        "Regression Detected": "bg-red-500/15 text-red-400 border-red-500/30",
        "Likely Regression": "bg-amber-500/15 text-amber-400 border-amber-500/30",
        "No Regression Observed": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        "Insufficient Evidence": "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
        "Inconclusive": "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    };

    if (changes.length === 0) {
        return (
            <div className="p-6 rounded-2xl border border-border bg-surface-elevated space-y-4 font-mono text-xs">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                    <GitCommit size={14} className="text-accent" />
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                        Release Regression &amp; Impact History
                    </h3>
                </div>
                <div className="h-36 flex flex-col items-center justify-center text-center border border-dashed border-border rounded-xl p-4">
                    <Clock size={20} className="text-muted mb-2 opacity-50" />
                    <p className="text-xs text-white font-medium font-sans">No releases found in current scope</p>
                    <p className="text-[11px] text-muted mt-0.5 max-w-sm font-sans">
                        As deployments are recorded with pre/post telemetry windows, Halo evaluates multi-dimensional regression metrics here.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 rounded-2xl border border-border bg-surface-elevated space-y-4 font-mono text-xs">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                    <GitCommit size={14} className="text-accent" />
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                        Release Regression &amp; Impact History
                    </h3>
                    <span className="text-[10px] text-muted">({changes.length} evaluated releases)</span>
                </div>
            </div>

            {/* Releases List */}
            <div className="space-y-3">
                {changes.map((c) => {
                    const errorPpDiff = c.metricsDiff.errorRate.percentagePointsDiff;
                    const isRegressed = c.verdict === "Regression Detected" || c.verdict === "Likely Regression";

                    return (
                        <div
                            key={c.id}
                            onClick={() => onSelectChange(c)}
                            className="p-4 rounded-xl bg-surface border border-border hover:border-accent/40 transition-colors cursor-pointer space-y-3 group"
                        >
                            {/* Top Info Bar */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <div className="w-6 h-6 rounded bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                                        <GitCommit size={13} />
                                    </div>
                                    <span className="font-bold text-white text-sm group-hover:text-accent transition-colors">
                                        Release {c.version}
                                    </span>
                                    <span
                                        className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${verdictBadgeClass[c.verdict]}`}
                                    >
                                        {c.verdict}
                                    </span>
                                    {c.commitSha && (
                                        <span className="text-[10px] text-muted bg-[#080b11] px-1.5 py-0.5 rounded border border-border">
                                            {c.commitSha.slice(0, 7)}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-3 text-muted text-[11px]">
                                    <Clock size={12} />
                                    <span>{formatDeterministicDateTime(c.timestamp)}</span>
                                </div>
                            </div>

                            {/* Pre/Post Telemetry Metrics Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                                {/* Error Rate Pre/Post */}
                                <div className="space-y-0.5">
                                    <span className="text-[10px] text-muted uppercase block">Error Rate</span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-zinc-400">{c.baselineWindow.errorRate}%</span>
                                        <span className="text-muted">&rarr;</span>
                                        <span className={`font-bold ${isRegressed ? "text-red-400" : "text-white"}`}>
                                            {c.observationWindow.errorRate}%
                                        </span>
                                        {errorPpDiff !== null && errorPpDiff > 0 && (
                                            <span className="text-red-400 text-[10px] font-semibold">
                                                (+{errorPpDiff}pp)
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Requests Pre/Post */}
                                <div className="space-y-0.5">
                                    <span className="text-[10px] text-muted uppercase block">Request Volume</span>
                                    <div className="flex items-center gap-1.5 text-zinc-300">
                                        <span>{c.baselineWindow.totalEvents}</span>
                                        <span className="text-muted">&rarr;</span>
                                        <span className="font-semibold text-white">
                                            {c.observationWindow.totalEvents}
                                        </span>
                                    </div>
                                </div>

                                {/* Latency Pre/Post */}
                                <div className="space-y-0.5">
                                    <span className="text-[10px] text-muted uppercase block">Avg Latency</span>
                                    <div className="flex items-center gap-1.5 text-zinc-300">
                                        <span>{c.baselineWindow.avgLatencyMs ? `${c.baselineWindow.avgLatencyMs}ms` : "-"}</span>
                                        <span className="text-muted">&rarr;</span>
                                        <span className="font-semibold text-white">
                                            {c.observationWindow.avgLatencyMs ? `${c.observationWindow.avgLatencyMs}ms` : "-"}
                                        </span>
                                    </div>
                                </div>

                                {/* Sample Size Assessment */}
                                <div className="space-y-0.5">
                                    <span className="text-[10px] text-muted uppercase block">Sample Size</span>
                                    <span className={`text-[10px] font-semibold ${c.sampleSizeAssessment.isSufficient ? "text-emerald-400" : "text-amber-400"}`}>
                                        {c.sampleSizeAssessment.isSufficient ? "Sufficient" : "Limited"}
                                    </span>
                                </div>
                            </div>

                            {/* Rationale & Action Bar */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/40 text-[11px]">
                                <span className="text-zinc-400 font-sans text-[11px]">
                                    {c.regressionReason || c.sampleSizeAssessment.notes}
                                </span>

                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        className="halo-btn halo-btn-ghost halo-btn-xs"
                                    >
                                        <span>Deep Analysis</span>
                                        <ArrowRight size={11} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
