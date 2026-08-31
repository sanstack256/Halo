"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Clock,
    GitCommit,
    Layers,
    ShieldAlert,
    Sparkles,
    X,
} from "lucide-react";
import type { ChangeImpactItem, ChangeImpactDeepAnalysis } from "@/lib/analytics/types";
import { getChangeImpactDeepAnalysisAction } from "@/actions/analytics";
import { formatDeterministicDateTime } from "@/lib/date-format";

interface ChangeImpactModalProps {
    change: ChangeImpactItem;
    onClose: () => void;
}

export function ChangeImpactModal({ change, onClose }: ChangeImpactModalProps) {
    const [loading, setLoading] = useState(true);
    const [analysis, setAnalysis] = useState<ChangeImpactDeepAnalysis | null>(null);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        getChangeImpactDeepAnalysisAction(change.id, change.projectId)
            .then((res) => {
                if (isMounted) {
                    setAnalysis(res);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [change.id, change.projectId]);

    const investigateUrl = `/projects/${change.projectId}/investigations/new?service=${change.service || "all"}`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-150 font-mono text-xs">
            <div
                className="relative w-full max-w-2xl rounded-2xl bg-[var(--surface-elevated)] border border-border p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border pb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                            <Sparkles size={16} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                                Release Impact Deep Analysis
                            </h2>
                            <p className="text-[11px] text-zinc-400 font-sans">
                                Release {change.version} · {change.projectName} · Deployed {formatDeterministicDateTime(new Date(change.timestamp))}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="text-zinc-500 hover:text-white p-1"
                    >
                        <X size={16} />
                    </button>
                </div>

                {loading ? (
                    <div className="py-16 text-center text-muted">
                        Calculating pre/post deployment telemetry baselines...
                    </div>
                ) : !analysis ? (
                    <div className="py-12 text-center text-muted">
                        Unable to compute baseline analysis. Telemetry records may be incomplete.
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* Categorized Impact Findings */}
                        <div className="space-y-3">
                            {/* Observed Telemetry Shifts */}
                            <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                                <span className="text-[11px] font-semibold text-white uppercase tracking-wider block border-b border-border/60 pb-1.5">
                                    Observed Telemetry Shifts
                                </span>
                                <ul className="space-y-1 text-[11px] text-zinc-300 font-sans">
                                    {analysis.observedChanges.map((item, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Likely Related Changes */}
                            {analysis.likelyRelatedChanges.length > 0 && (
                                <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                                    <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider block border-b border-border/60 pb-1.5">
                                        Likely Related Correlated Signals
                                    </span>
                                    <ul className="space-y-1 text-[11px] text-zinc-300 font-sans">
                                        {analysis.likelyRelatedChanges.map((item, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Insufficient Evidence Notes */}
                            {analysis.insufficientEvidenceNotes.length > 0 && (
                                <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                                    <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block border-b border-border/60 pb-1.5">
                                        Statistical Confidence Notes
                                    </span>
                                    <ul className="space-y-1 text-[11px] text-zinc-400 font-sans">
                                        {analysis.insufficientEvidenceNotes.map((item, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 mt-1.5 shrink-0" />
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* Pre/Post Telemetry Histogram */}
                        {analysis.telemetryBreakdown.length > 0 && (
                            <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                                <div className="flex items-center justify-between text-[11px] font-semibold text-white uppercase tracking-wider border-b border-border/60 pb-1.5">
                                    <span>Observation Interval Telemetry</span>
                                    <span className="text-[10px] text-accent normal-case font-mono">
                                        Release Point &darr;
                                    </span>
                                </div>

                                <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 h-16 items-end pt-2">
                                    {analysis.telemetryBreakdown.map((b, i) => {
                                        const maxReqs = Math.max(...analysis.telemetryBreakdown.map((x) => x.requestCount), 1);
                                        const heightPct = Math.max(10, Math.round((b.requestCount / maxReqs) * 100));

                                        return (
                                            <div
                                                key={i}
                                                className="h-full flex flex-col justify-end items-center group relative"
                                            >
                                                <div
                                                    className={`w-full rounded-sm ${
                                                        b.errorCount > 0 ? "bg-red-400" : "bg-cyan-400/60"
                                                    }`}
                                                    style={{ height: `${heightPct}%` }}
                                                />
                                                {/* Tooltip */}
                                                <div className="absolute bottom-full mb-1 hidden group-hover:block z-30 p-1.5 rounded bg-black/90 border border-border text-[9px] text-zinc-300 font-mono whitespace-nowrap shadow-lg">
                                                    {b.formattedTime}: {b.errorCount} err / {b.requestCount} req
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Related Issues */}
                        {analysis.relatedIssues.length > 0 && (
                            <div className="space-y-2">
                                <span className="text-[10px] text-muted uppercase block">
                                    Correlated Active Issues ({analysis.relatedIssues.length})
                                </span>
                                <div className="space-y-1.5">
                                    {analysis.relatedIssues.map((iss) => (
                                        <Link
                                            key={iss.id}
                                            href={`/projects/${change.projectId}/issues/${iss.id}`}
                                            className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border hover:border-border-strong hover:text-white transition-colors"
                                        >
                                            <span className="font-semibold text-zinc-200 truncate pr-2">
                                                {iss.title}
                                            </span>
                                            <span className={`halo-severity halo-severity-${iss.severity.toLowerCase()} text-[10px]`}>
                                                {iss.severity}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer Actions */}
                <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="halo-btn halo-btn-secondary halo-btn-sm"
                    >
                        <span>Close</span>
                    </button>

                    <Link
                        href={investigateUrl}
                        className="halo-btn halo-btn-primary halo-btn-sm"
                    >
                        <Sparkles size={12} />
                        <span>Launch Investigation</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
