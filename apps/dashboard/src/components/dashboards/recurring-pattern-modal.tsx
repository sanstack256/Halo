"use client";

import React from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Clock,
    Flame,
    GitCommit,
    Layers,
    ShieldAlert,
    Sparkles,
    X,
} from "lucide-react";
import type { RecurringPatternItem } from "@/lib/analytics/types";
import { formatDeterministicDateTime } from "@/lib/date-format";

interface RecurringPatternModalProps {
    pattern: RecurringPatternItem;
    projectId?: string;
    onClose: () => void;
}

export function RecurringPatternModal({ pattern, projectId, onClose }: RecurringPatternModalProps) {
    const investigateUrl = pattern.activeIssueId
        ? `/projects/${projectId || "current"}/investigations/new?issueId=${pattern.activeIssueId}`
        : `/projects/${projectId || "current"}/investigations/new?service=${pattern.affectedServices[0] || "all"}`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-150 font-mono text-xs">
            <div
                className="relative w-full max-w-xl rounded-2xl bg-[var(--surface-elevated)] border border-border p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border pb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                            <ShieldAlert size={16} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                                Recurring Failure Pattern
                            </h2>
                            <p className="text-[11px] text-zinc-400 font-sans">
                                Fingerprint: {pattern.fingerprint.slice(0, 16)}…
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

                {/* Pattern Overview */}
                <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                    <div className="text-sm font-semibold text-white">
                        {pattern.title}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted pt-1">
                        <span className="text-red-400 font-bold">
                            {pattern.occurrenceCount} total occurrences
                        </span>
                        <span>·</span>
                        <span>First: {formatDeterministicDateTime(new Date(pattern.firstObservedAt))}</span>
                        <span>·</span>
                        <span>Last: {formatDeterministicDateTime(new Date(pattern.lastObservedAt))}</span>
                    </div>
                </div>

                {/* Affected Services & Releases */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                        <span className="text-[10px] text-muted uppercase block">Affected Services</span>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {pattern.affectedServices.length === 0 ? (
                                <span className="text-muted">Global scope</span>
                            ) : (
                                pattern.affectedServices.map((s, i) => (
                                    <span
                                        key={i}
                                        className="px-2 py-0.5 rounded bg-[#080b11] border border-border text-zinc-300 text-[10px]"
                                    >
                                        {s}
                                    </span>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                        <span className="text-[10px] text-muted uppercase block">Correlated Releases</span>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {pattern.affectedReleases.length === 0 ? (
                                <span className="text-muted">All releases</span>
                            ) : (
                                pattern.affectedReleases.map((r, i) => (
                                    <span
                                        key={i}
                                        className="px-2 py-0.5 rounded bg-[#080b11] border border-border text-purple-300 text-[10px]"
                                    >
                                        {r}
                                    </span>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Sample Stack Trace Preview */}
                {pattern.sampleStack && (
                    <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                        <span className="text-[10px] text-muted uppercase block">Sample Stack Frame</span>
                        <pre className="p-2.5 rounded-lg bg-[#06080d] border border-border/80 text-[10px] text-red-300 overflow-x-auto whitespace-pre font-mono leading-relaxed max-h-36">
                            {pattern.sampleStack}
                        </pre>
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
                        <span>Investigate Failure Pattern</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
