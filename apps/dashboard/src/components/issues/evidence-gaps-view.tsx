"use client";

import React from "react";
import Link from "next/link";
import {
    TrendingUp,
    CheckCircle2,
    Info,
} from "lucide-react";
import type { EvidenceGapsProjection, EvidenceGap } from "@/lib/issues/issue-intelligence";

interface EvidenceGapsViewProps {
    data: EvidenceGapsProjection;
}

export function EvidenceGapsView({ data }: EvidenceGapsViewProps) {
    const { gaps, summary, timeRange } = data;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Evidence Gaps</h1>
                <p className="text-sm text-secondary mt-1">
                    What prevents Halo from answering critical investigation questions? Prioritizes telemetry instrumentation by Evidence Leverage across blocked issues and capabilities.
                </p>
            </div>

            {/* Invariant Note */}
            <div className="p-3.5 rounded-xl bg-[#070a0f] border border-border text-xs font-mono text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Info size={14} className="text-accent shrink-0" />
                    <span>
                        <strong>Remediation Invariant:</strong> Remediation advice is explicitly qualified as possible patterns. Repository-verified code fixes are only presented when verified by source code analysis.
                    </span>
                </div>
                <span className="text-accent text-[10px] uppercase font-semibold shrink-0">
                    Qualified Advice
                </span>
            </div>

            {/* SECTION 8: Disambiguated Counts Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block">Active Blocker Gaps</span>
                    <span className="text-2xl font-bold text-white block">{summary.totalGaps}</span>
                    <span className="text-[11px] text-zinc-400">Window: {timeRange.key}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">BLOCKED ISSUES</span>
                    <span className="text-2xl font-bold text-white block">{summary.totalBlockedIssues}</span>
                    <span className="text-[11px] text-zinc-500">Distinct issues with missing telemetry</span>
                </div>
                <div className="p-3.5 rounded-xl bg-surface border border-amber-500/20 space-y-1">
                    <span className="text-[10px] text-amber-400 uppercase font-semibold block">BLOCKED CAPABILITIES</span>
                    <span className="text-2xl font-bold text-amber-400 block">{summary.totalBlockedInvestigationCapabilities}</span>
                    <span className="text-[11px] text-zinc-500">Investigation capabilities interrupted</span>
                </div>
                <div className="p-3.5 rounded-xl bg-surface border border-accent/20 space-y-1">
                    <span className="text-[10px] text-accent uppercase font-semibold block">Top Priority Target</span>
                    <span className="text-sm font-bold text-white block truncate">
                        {summary.highestLeverageGapTitle || "None"}
                    </span>
                    <span className="text-[11px] text-zinc-400 truncate block">
                        Highest cross-issue yield
                    </span>
                </div>
            </div>

            {gaps.length === 0 ? (
                <div className="p-12 rounded-2xl bg-surface border border-border text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <h3 className="text-base font-semibold text-white">No blocking telemetry gaps detected</h3>
                    <p className="text-xs text-secondary max-w-md mx-auto font-mono">
                        Active telemetry in this window provides complete trace and context coverage.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <TrendingUp size={15} className="text-accent" />
                        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
                            Telemetry Instrumentation Priority
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {gaps.map((gap, idx) => (
                            <div
                                key={gap.id}
                                className="p-4 rounded-xl bg-surface border border-border space-y-3 flex flex-col justify-between"
                            >
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/20 font-bold">
                                            Priority #{idx + 1} • {gap.blockedIssuesCount} Blocked Issues
                                        </span>
                                        <span className="text-[10px] font-mono text-zinc-400">
                                            {gap.affectedServices.length} Service(s) Affected
                                        </span>
                                    </div>

                                    <h3 className="text-sm font-bold text-white font-mono">{gap.title}</h3>
                                    <p className="text-xs font-mono text-zinc-400">{gap.description}</p>
                                </div>

                                <div className="space-y-2 pt-2 border-t border-border/60 text-xs font-mono">
                                    {/* SECTION 9: Meaningful explanation without gamified points */}
                                    <div className="p-2.5 rounded-lg bg-[#06080d] border border-border">
                                        <span className="text-[10px] text-accent uppercase font-bold block">
                                            WHY THIS RANKS HIGH
                                        </span>
                                        <span className="text-zinc-300 block text-[11px] mt-0.5">
                                            {gap.whyThisRanksHigh}
                                        </span>
                                    </div>

                                    {/* What it prevents */}
                                    <div className="p-2.5 rounded-lg bg-surface-elevated border border-border">
                                        <span className="text-[10px] text-amber-400 uppercase font-bold block">
                                            WHAT THIS GAP BLOCKS
                                        </span>
                                        <span className="text-zinc-300 block text-[11px] mt-0.5">
                                            {gap.whatItPrevents}
                                        </span>
                                    </div>

                                    {/* Possible Remediation */}
                                    <div className="p-2.5 rounded-lg bg-surface-elevated border border-border">
                                        <span className="text-[10px] text-zinc-400 uppercase font-bold block">
                                            POSSIBLE REMEDIATION PATTERN
                                        </span>
                                        <span className="text-white block text-[11px] mt-0.5 font-semibold">
                                            {gap.possibleRemediation}
                                        </span>
                                    </div>

                                    {/* Repository Verified Remediation (ONLY when repo verified) */}
                                    {gap.repositoryVerifiedRemediation && (
                                        <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                            <span className="text-[10px] text-emerald-400 uppercase font-bold block">
                                                REPOSITORY-VERIFIED CODE REMEDIATION
                                            </span>
                                            <span className="text-white block text-[11px] mt-0.5 font-mono">
                                                {gap.repositoryVerifiedRemediation}
                                            </span>
                                        </div>
                                    )}

                                    <div className="text-[11px] text-zinc-500">
                                        Affected services: <strong className="text-zinc-300">{gap.affectedServices.join(", ") || "None"}</strong>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
