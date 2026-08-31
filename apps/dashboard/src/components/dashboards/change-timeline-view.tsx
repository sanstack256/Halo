"use client";

import React from "react";
import Link from "next/link";
import {
    ArrowRight,
    Clock,
    GitCommit,
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
        "Regression Detected": "halo-badge-critical",
        "Likely Regression": "halo-badge-degraded",
        "No Regression Observed": "halo-badge-healthy",
        "Insufficient Evidence": "halo-badge-neutral",
        "Inconclusive": "halo-badge-neutral",
    };

    if (changes.length === 0) {
        return (
            <div className="halo-panel">
                <div className="halo-panel-header">
                    <div className="halo-panel-title-group">
                        <GitCommit size={15} className="text-accent" />
                        <h3 className="halo-panel-title">
                            Release Regression &amp; Impact History
                        </h3>
                    </div>
                </div>
                <div className="h-40 flex flex-col items-center justify-center text-center border border-dashed border-border rounded-xl p-6">
                    <Clock size={20} className="text-text-muted mb-2 opacity-50" />
                    <p className="text-xs text-text font-medium">No releases found in current scope</p>
                    <p className="text-[11px] text-text-muted mt-1 max-w-sm">
                        As deployments are recorded with pre/post telemetry windows, Halo evaluates multi-dimensional regression metrics here.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="halo-panel">
            {/* Header */}
            <div className="halo-panel-header">
                <div className="halo-panel-title-group">
                    <GitCommit size={15} className="text-accent" />
                    <h3 className="halo-panel-title">
                        Release Regression &amp; Impact History
                    </h3>
                    <span className="halo-panel-subtitle">({changes.length} evaluated releases)</span>
                </div>
            </div>

            {/* Releases List with Vertically Aligned Grid */}
            <div className="space-y-3">
                {changes.map((c) => {
                    const errorPpDiff = c.metricsDiff.errorRate.percentagePointsDiff;
                    const isRegressed = c.verdict === "Regression Detected" || c.verdict === "Likely Regression";

                    return (
                        <div
                            key={c.id}
                            onClick={() => onSelectChange(c)}
                            className="p-4 rounded-xl bg-surface border border-border hover:border-border-strong hover:bg-surface-elevated/40 transition-all cursor-pointer space-y-3 group"
                        >
                            {/* Top Info Bar: Version, Verdict, Commit, Timestamp */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <div className="w-6 h-6 rounded bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                                        <GitCommit size={13} />
                                    </div>
                                    <span className="font-semibold text-text text-sm group-hover:text-accent transition-colors">
                                        Release {c.version}
                                    </span>
                                    <span className={`halo-badge ${verdictBadgeClass[c.verdict]}`}>
                                        {c.verdict}
                                    </span>
                                    {c.commitSha && (
                                        <span className="text-[10px] text-text-muted bg-[#080b11] px-1.5 py-0.5 rounded border border-border font-mono">
                                            {c.commitSha.slice(0, 7)}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-1.5 text-text-muted text-xs font-mono">
                                    <Clock size={12} />
                                    <span>{formatDeterministicDateTime(c.timestamp)}</span>
                                </div>
                            </div>

                            {/* Pre/Post Telemetry Metrics Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#06080d] p-3 rounded-lg border border-border">
                                {/* Error Rate Pre/Post */}
                                <div className="space-y-0.5">
                                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block">Error Rate</span>
                                    <div className="flex items-center gap-1.5 font-mono text-xs">
                                        <span className="text-text-muted">{c.baselineWindow.errorRate}%</span>
                                        <span className="text-text-muted opacity-40">&rarr;</span>
                                        <span className={`font-semibold ${isRegressed ? "text-error" : "text-text"}`}>
                                            {c.observationWindow.errorRate}%
                                        </span>
                                        {errorPpDiff !== null && errorPpDiff > 0 && (
                                            <span className="text-error text-[10.5px] font-bold">
                                                (+{errorPpDiff}pp)
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Request Volume Pre/Post */}
                                <div className="space-y-0.5 sm:border-l sm:border-border sm:pl-3">
                                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block">Request Volume</span>
                                    <div className="flex items-center gap-1.5 font-mono text-xs text-text-secondary">
                                        <span>{c.baselineWindow.totalEvents}</span>
                                        <span className="text-text-muted opacity-40">&rarr;</span>
                                        <span className="font-semibold text-text">
                                            {c.observationWindow.totalEvents}
                                        </span>
                                    </div>
                                </div>

                                {/* Avg Latency Pre/Post */}
                                <div className="space-y-0.5 lg:border-l lg:border-border lg:pl-3">
                                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block">Avg Latency</span>
                                    <div className="flex items-center gap-1.5 font-mono text-xs text-text-secondary">
                                        <span>{c.baselineWindow.avgLatencyMs ? `${c.baselineWindow.avgLatencyMs}ms` : "—"}</span>
                                        <span className="text-text-muted opacity-40">&rarr;</span>
                                        <span className="font-semibold text-text">
                                            {c.observationWindow.avgLatencyMs ? `${c.observationWindow.avgLatencyMs}ms` : "—"}
                                        </span>
                                    </div>
                                </div>

                                {/* Sample Size Assessment */}
                                <div className="space-y-0.5 sm:border-l sm:border-border sm:pl-3">
                                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block">Sample Size</span>
                                    <div className="font-semibold text-xs">
                                        <span
                                            className={
                                                c.sampleSizeAssessment?.isSufficient
                                                    ? "text-success"
                                                    : "text-warning"
                                            }
                                        >
                                            {c.sampleSizeAssessment?.isSufficient ? "Sufficient" : "Limited"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Summary Note & Deep Analysis Action */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs">
                                <p className="text-text-secondary line-clamp-1">
                                    {c.regressionReason || c.sampleSizeAssessment?.notes || "Pre/post release telemetry evaluated."}
                                </p>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectChange(c);
                                    }}
                                    className="halo-filter-btn text-[11px] h-7 px-2.5 shrink-0 self-start sm:self-auto"
                                >
                                    <span>Deep Analysis</span>
                                    <ArrowRight size={12} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
