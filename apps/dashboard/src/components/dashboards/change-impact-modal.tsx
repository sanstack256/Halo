"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    ArrowDownRight,
    ArrowRight,
    CheckCircle2,
    Clock,
    GitCommit,
    Layers,
    Radio,
    ShieldAlert,
    Sparkles,
    X,
} from "lucide-react";
import type { ChangeImpactDeepAnalysis, ChangeImpactItem } from "@/lib/analytics/types";
import { getChangeImpactDeepAnalysisAction } from "@/actions/analytics";
import { formatDeterministicDateTime } from "@/lib/date-format";

interface ChangeImpactModalProps {
    change: ChangeImpactItem | null;
    projectId?: string;
    onClose: () => void;
}

export function ChangeImpactModal({
    change,
    projectId,
    onClose,
}: ChangeImpactModalProps) {
    const [loading, setLoading] = useState(false);
    const [analysis, setAnalysis] = useState<ChangeImpactDeepAnalysis | null>(null);

    useEffect(() => {
        if (!change) {
            setAnalysis(null);
            return;
        }

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
    }, [change]);

    if (!change) return null;

    const investigateUrl = `/projects/${change.projectId}/investigations/new?release=${encodeURIComponent(change.version)}`;

    return (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/80 flex items-center justify-center p-4 font-mono text-xs animate-in fade-in duration-150">
            <div className="w-full max-w-2xl bg-[#0b0f16] border border-[#222b38] rounded-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="flex items-center justify-between border-b border-border pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                            <GitCommit size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-white tracking-wide font-sans">
                                    Release Impact Analysis: {change.version}
                                </h2>
                            </div>
                            <p className="text-[11px] text-muted font-sans">
                                Deployed at {formatDeterministicDateTime(change.timestamp)} · Scope: {change.scope}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 text-muted hover:text-white rounded-lg hover:bg-surface"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Primary Action Banner */}
                <div className="p-4 rounded-xl bg-surface border border-accent/30 flex items-center justify-between gap-3">
                    <div>
                        <span className="font-semibold text-white block">Launch Release Investigation</span>
                        <span className="text-[11px] text-muted font-sans">
                            Pre-populates baseline and observation window telemetry directly into Halo Investigation.
                        </span>
                    </div>
                    <Link
                        href={investigateUrl}
                        className="halo-btn halo-btn-primary halo-btn-sm shrink-0"
                    >
                        <Sparkles size={12} />
                        <span>Analyze Release</span>
                    </Link>
                </div>

                {/* Comparative Baseline vs Observation Box */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Baseline */}
                    <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                        <span className="text-[10px] text-muted uppercase font-semibold block">
                            Pre-Deployment Baseline (2h)
                        </span>
                        <div className="space-y-1 text-[11px]">
                            <div className="flex justify-between">
                                <span className="text-muted">Error Rate:</span>
                                <span className="text-white font-semibold">{change.baselineWindow.errorRate}%</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted">Total Events:</span>
                                <span className="text-white">{change.baselineWindow.totalEvents}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted">Errors:</span>
                                <span className="text-white">{change.baselineWindow.errorCount}</span>
                            </div>
                        </div>
                    </div>

                    {/* Observation */}
                    <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                        <span className="text-[10px] text-muted uppercase font-semibold block">
                            Post-Deployment Observation (2h)
                        </span>
                        <div className="space-y-1 text-[11px]">
                            <div className="flex justify-between">
                                <span className="text-muted">Error Rate:</span>
                                <span className={`font-semibold ${change.regressionDetected ? "text-red-400" : "text-white"}`}>
                                    {change.observationWindow.errorRate}%
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted">Total Events:</span>
                                <span className="text-white">{change.observationWindow.totalEvents}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted">Errors:</span>
                                <span className={`font-semibold ${change.regressionDetected ? "text-red-400" : "text-white"}`}>
                                    {change.observationWindow.errorCount}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="h-32 flex items-center justify-center text-muted">
                        Calculating deep impact...
                    </div>
                ) : analysis ? (
                    <div className="space-y-6">
                        {/* Observed Telemetry Signals */}
                        <div className="space-y-2.5">
                            <div className="text-[11px] font-semibold text-white uppercase tracking-wider border-b border-border pb-1.5 flex items-center gap-1.5">
                                <Activity size={13} className="text-accent" />
                                <span>Observed Telemetry Signals</span>
                            </div>
                            <ul className="space-y-1.5 text-[11px] font-sans text-zinc-300">
                                {analysis.observedChanges.map((ch, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                                        <span>{ch}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Counter-Evidence Grid */}
                        {analysis.counterEvidence.length > 0 && (
                            <div className="p-3.5 rounded-xl bg-surface border border-amber-500/30 space-y-2">
                                <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                                    Counter-Evidence &amp; Non-Causal Factors
                                </div>
                                <ul className="space-y-1 text-[11px] font-sans text-zinc-300">
                                    {analysis.counterEvidence.map((cev, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                                            <span>{cev}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Correlated Active Issues */}
                        {analysis.relatedIssues.length > 0 && (
                            <div className="space-y-2.5">
                                <div className="text-[11px] font-semibold text-white uppercase tracking-wider border-b border-border pb-1.5 flex items-center gap-1.5">
                                    <ShieldAlert size={13} className="text-red-400" />
                                    <span>Correlated Issues During Window ({analysis.relatedIssues.length})</span>
                                </div>
                                <div className="space-y-2">
                                    {analysis.relatedIssues.map((iss) => (
                                        <Link
                                            key={iss.id}
                                            href={`/projects/${change.projectId}/issues/${iss.id}`}
                                            className="p-2.5 rounded-lg bg-surface border border-border flex items-center justify-between hover:border-accent/40 transition-colors"
                                        >
                                            <span className="text-white font-medium">{iss.title}</span>
                                            <span className="text-red-400 text-[10px] uppercase font-semibold">
                                                {iss.severity}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}

                {/* Modal Footer */}
                <div className="pt-4 border-t border-border flex items-center justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="halo-btn halo-btn-secondary halo-btn-sm"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
