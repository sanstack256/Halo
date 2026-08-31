"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Clock,
    Code,
    GitCommit,
    Layers,
    Radio,
    ShieldAlert,
    Sparkles,
    TrendingUp,
    X,
} from "lucide-react";
import type { RecurringPatternItem, OccurrenceComparison } from "@/lib/analytics/types";
import { getOccurrenceComparisonAction } from "@/actions/analytics";
import { formatDeterministicDateTime } from "@/lib/date-format";

interface RecurringPatternModalProps {
    pattern: RecurringPatternItem | null;
    projectId?: string;
    onClose: () => void;
}

export function RecurringPatternModal({
    pattern,
    projectId,
    onClose,
}: RecurringPatternModalProps) {
    const [comparison, setComparison] = useState<OccurrenceComparison | null>(null);
    const [loadingComp, setLoadingComp] = useState(false);

    useEffect(() => {
        if (!pattern || !projectId) {
            setComparison(null);
            return;
        }

        let isMounted = true;
        setLoadingComp(true);

        getOccurrenceComparisonAction(pattern.fingerprint, projectId)
            .then((res) => {
                if (isMounted) {
                    setComparison(res);
                    setLoadingComp(false);
                }
            })
            .catch(() => {
                if (isMounted) setLoadingComp(false);
            });

        return () => {
            isMounted = false;
        };
    }, [pattern, projectId]);

    if (!pattern) return null;

    const investigateUrl = pattern.activeIssueId
        ? `/projects/${projectId || "current"}/issues/${pattern.activeIssueId}`
        : `/projects/${projectId || "current"}/investigations/new?fingerprint=${encodeURIComponent(pattern.fingerprint)}`;

    return (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 font-mono text-xs animate-in fade-in duration-150">
            <div className="w-full max-w-2xl bg-[#080b11] border border-border rounded-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border pb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                            <Activity size={18} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-white tracking-wide font-sans">
                                    Recurring Pattern: {pattern.title}
                                </h2>
                            </div>
                            <p className="text-[10px] text-muted font-mono mt-0.5 truncate max-w-md">
                                Fingerprint: {pattern.fingerprint}
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

                {/* Primary Action */}
                <div className="p-4 rounded-xl bg-surface border border-accent/30 flex items-center justify-between gap-3">
                    <div>
                        <span className="font-semibold text-white block">Investigate Recurring Pattern</span>
                        <span className="text-[11px] text-muted font-sans">
                            {pattern.occurrenceCount} occurrences recorded across {pattern.affectedServices.length} service(s).
                        </span>
                    </div>
                    <Link
                        href={investigateUrl}
                        className="halo-btn halo-btn-primary halo-btn-sm shrink-0"
                    >
                        <Sparkles size={12} />
                        <span>Investigate Pattern</span>
                    </Link>
                </div>

                {/* Occurrence Metrics */}
                <div className="grid grid-cols-3 gap-3 text-[11px]">
                    <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                        <span className="text-[10px] text-muted uppercase block">Occurrences</span>
                        <span className="text-base font-bold text-amber-400">{pattern.occurrenceCount}x</span>
                    </div>
                    <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                        <span className="text-[10px] text-muted uppercase block">First Observed</span>
                        <span className="text-[11px] text-white font-semibold block">
                            {formatDeterministicDateTime(pattern.firstObservedAt)}
                        </span>
                    </div>
                    <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                        <span className="text-[10px] text-muted uppercase block">Latest Observed</span>
                        <span className="text-[11px] text-white font-semibold block">
                            {formatDeterministicDateTime(pattern.lastObservedAt)}
                        </span>
                    </div>
                </div>

                {/* What's Different This Time? Comparison */}
                {comparison && (
                    <div className="p-4 rounded-xl bg-surface border border-accent/30 space-y-3">
                        <div className="text-[11px] font-semibold text-white uppercase tracking-wider border-b border-border pb-1.5 flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-accent">
                                <Sparkles size={13} />
                                <span>What&apos;s Different This Time?</span>
                            </span>
                            <span className="text-[10px] text-muted normal-case font-normal">
                                Current vs Previous Occurrence
                            </span>
                        </div>

                        <div className="space-y-2">
                            <div className="space-y-1">
                                <span className="text-[10px] text-muted uppercase block">Observed Differences</span>
                                <ul className="space-y-1 text-[11px] font-sans text-zinc-200">
                                    {comparison.differences.map((diff, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                                            <span>{diff}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {comparison.sharedAttributes.length > 0 && (
                                <div className="space-y-1 pt-2 border-t border-border/40">
                                    <span className="text-[10px] text-muted uppercase block">Shared Invariants</span>
                                    <ul className="space-y-1 text-[11px] font-sans text-zinc-400">
                                        {comparison.sharedAttributes.map((attr, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 mt-1.5 shrink-0" />
                                                <span>{attr}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Sample Stack Trace Preview */}
                {pattern.sampleStack && (
                    <div className="space-y-2">
                        <div className="text-[11px] font-semibold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-1.5">
                            <Code size={13} className="text-muted" />
                            <span>Stack Frame Trace</span>
                        </div>
                        <pre className="p-3 rounded-xl bg-[#04060a] border border-border text-[10.5px] text-zinc-300 overflow-x-auto font-mono whitespace-pre-wrap">
                            {pattern.sampleStack}
                        </pre>
                    </div>
                )}

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
