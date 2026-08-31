"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Clock,
    GitCommit,
    Layers,
    Radio,
    ShieldAlert,
    Sparkles,
    TrendingDown,
    TrendingUp,
} from "lucide-react";
import type { ChangeImpactItem, EvidenceClassification } from "@/lib/analytics/types";
import { formatDeterministicDateTime } from "@/lib/date-format";
import { ChangeImpactModal } from "./change-impact-modal";

interface ChangeTimelineViewProps {
    changes: ChangeImpactItem[];
}

export function ChangeTimelineView({ changes }: ChangeTimelineViewProps) {
    const [selectedChange, setSelectedChange] = useState<ChangeImpactItem | null>(null);

    const classificationBadgeClass: Record<EvidenceClassification, string> = {
        "Observed": "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
        "Correlated": "bg-amber-500/10 text-amber-400 border-amber-500/30",
        "Strongly correlated": "bg-purple-500/10 text-purple-400 border-purple-500/30",
        "Causal evidence established": "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        "Possible": "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
        "Insufficient evidence": "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
    };

    if (changes.length === 0) {
        return (
            <div className="p-6 rounded-2xl border border-border bg-surface-elevated space-y-4 font-mono text-xs">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                    <GitCommit size={14} className="text-accent" />
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                        Releases &amp; Change Log
                    </h3>
                </div>
                <div className="h-40 flex flex-col items-center justify-center text-center border border-dashed border-border rounded-xl p-4">
                    <Clock size={22} className="text-muted mb-2 opacity-50" />
                    <p className="text-xs text-white font-medium font-sans">No releases or deployments recorded</p>
                    <p className="text-[11px] text-muted mt-0.5 max-w-sm font-sans">
                        Deployments registered via the SDK, CLI, or CI/CD pipelines will be automatically tracked here with pre/post baseline regression analysis.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <GitCommit size={14} className="text-accent" />
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                        Release Impact &amp; Regression Intelligence
                    </h3>
                    <span className="text-[11px] text-muted">
                        ({changes.length} recorded releases)
                    </span>
                </div>
            </div>

            <div className="space-y-3">
                {changes.map((c) => {
                    const badgeClass =
                        classificationBadgeClass[c.impactClassification] ||
                        classificationBadgeClass["Observed"];

                    return (
                        <div
                            key={c.id}
                            className={`p-5 rounded-2xl border transition-all ${
                                c.regressionDetected
                                    ? "bg-red-500/[0.03] border-red-500/30"
                                    : "bg-surface-elevated border-border hover:border-border-strong"
                            }`}
                        >
                            {/* Top row: Release identity & Classification */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-bold text-white flex items-center gap-1.5">
                                            <GitCommit size={15} className="text-accent shrink-0" />
                                            <span>Release {c.version}</span>
                                        </span>

                                        {c.commitSha && (
                                            <code className="px-2 py-0.5 rounded bg-surface border border-border text-muted text-[10px]">
                                                {c.commitSha.slice(0, 7)}
                                            </code>
                                        )}

                                        <span
                                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${badgeClass}`}
                                        >
                                            {c.impactClassification}
                                        </span>

                                        {c.regressionDetected && (
                                            <span className="px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-semibold flex items-center gap-1">
                                                <ShieldAlert size={11} />
                                                <span>Regression: {c.regressionSeverity}</span>
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3 text-[11px] text-muted">
                                        <span>Project: {c.projectName}</span>
                                        <span>·</span>
                                        <span>Deployed: {formatDeterministicDateTime(new Date(c.timestamp))}</span>
                                        <span>·</span>
                                        <span>Scope: {c.scope}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedChange(c)}
                                        className="halo-btn halo-btn-primary halo-btn-xs"
                                    >
                                        <Sparkles size={11} />
                                        <span>Analyze Impact</span>
                                    </button>
                                </div>
                            </div>

                            {/* Regression Alert Rationale */}
                            {c.regressionReason && (
                                <div className="mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 text-[11px] font-sans flex items-start gap-2">
                                    <AlertCircle size={14} className="shrink-0 mt-0.5 text-red-400" />
                                    <span>{c.regressionReason}</span>
                                </div>
                            )}

                            {/* Baseline vs Observation Matrix Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-[11px]">
                                {/* 1. Error Rate Comparison */}
                                <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                                    <span className="text-[10px] text-muted uppercase block">Error Rate</span>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-white font-bold text-sm">
                                            {c.observationWindow.errorRate}%
                                        </span>
                                        <span className="text-muted text-[10px]">
                                            (base: {c.baselineWindow.errorRate}%)
                                        </span>
                                    </div>
                                    {c.metricsDiff.errorRate.percentagePointsDiff !== null && (
                                        <span
                                            className={`text-[10px] block ${
                                                (c.metricsDiff.errorRate.percentagePointsDiff || 0) > 0
                                                    ? "text-red-400 font-semibold"
                                                    : "text-emerald-400"
                                            }`}
                                        >
                                            {(c.metricsDiff.errorRate.percentagePointsDiff || 0) > 0 ? "+" : ""}
                                            {c.metricsDiff.errorRate.percentagePointsDiff}pp shift
                                        </span>
                                    )}
                                </div>

                                {/* 2. Error Volume */}
                                <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                                    <span className="text-[10px] text-muted uppercase block">Error Volume</span>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-white font-bold text-sm">
                                            {c.observationWindow.errorCount}
                                        </span>
                                        <span className="text-muted text-[10px]">
                                            (base: {c.baselineWindow.errorCount})
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-muted block">
                                        in 2h observation window
                                    </span>
                                </div>

                                {/* 3. Request Traffic */}
                                <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                                    <span className="text-[10px] text-muted uppercase block">Requests / Traffic</span>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-white font-bold text-sm">
                                            {c.observationWindow.totalEvents}
                                        </span>
                                        <span className="text-muted text-[10px]">
                                            (base: {c.baselineWindow.totalEvents})
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-muted block">
                                        total telemetry events
                                    </span>
                                </div>

                                {/* 4. Correlated Incidents & Monitors */}
                                <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                                    <span className="text-[10px] text-muted uppercase block">Triggered Alerts</span>
                                    <div className="text-white font-bold text-sm">
                                        {c.relatedMonitorsCount} alerts · {c.relatedIssuesCount} issues
                                    </div>
                                    <span className="text-[10px] text-muted block">
                                        {c.relatedInvestigationsCount} investigation(s)
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Change Impact Deep Analysis Modal */}
            {selectedChange && (
                <ChangeImpactModal
                    change={selectedChange}
                    onClose={() => setSelectedChange(null)}
                />
            )}
        </div>
    );
}
