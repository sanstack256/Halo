"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    CheckCircle2,
    AlertTriangle,
    HelpCircle,
    GitCommit,
    Info,
    ExternalLink,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import type { ResolutionProjection, ResolutionStatus } from "@/lib/issues/issue-intelligence";
import { RelativeTime } from "@/components/ui/relative-time";

interface ResolutionViewProps {
    data: ResolutionProjection;
}

export function ResolutionView({ data }: ResolutionViewProps) {
    const { candidates, summary, timeRange } = data;
    const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);

    const getStatusBadge = (status: ResolutionStatus) => {
        switch (status) {
            case "RECOVERED":
                return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                        <CheckCircle2 size={11} className="text-emerald-400" />
                        RECOVERED (SIGNATURE ELIMINATED)
                    </span>
                );
            case "PARTIALLY_RECOVERED":
                return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                        <AlertTriangle size={11} className="text-amber-400" />
                        PARTIALLY RECOVERED (RESIDUAL OBSERVED)
                    </span>
                );
            case "CHANGE_NOT_ISOLATED":
                return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">
                        <GitCommit size={11} className="text-purple-400" />
                        CHANGE NOT ISOLATED
                    </span>
                );
            case "STILL_OBSERVED":
                return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-semibold">
                        <AlertTriangle size={11} className="text-red-400" />
                        STILL OBSERVED (NO RECOVERY)
                    </span>
                );
            case "NO_BASELINE_OCCURRENCE":
                return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-border font-semibold">
                        NO BASELINE OCCURRENCE
                    </span>
                );
            case "INSUFFICIENT_EVIDENCE":
            default:
                return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 font-semibold">
                        <HelpCircle size={11} className="text-zinc-500" />
                        INSUFFICIENT EVIDENCE
                    </span>
                );
        }
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Resolution</h1>
                <p className="text-sm text-secondary mt-1">
                    Did the failure actually recover? Fix Verification audits post-change telemetry under comparable exposure rather than assuming issue closure implies recovery.
                </p>
            </div>

            {/* Invariant Note */}
            <div className="p-3.5 rounded-xl bg-[#070a0f] border border-border text-xs font-mono text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Info size={14} className="text-accent shrink-0" />
                    <span>
                        <strong>Verification Invariant:</strong> Elapsed hours alone are not proof of recovery. Verification requires active post-change exposure, signature elimination, and single-change isolation.
                    </span>
                </div>
                <span className="text-accent text-[10px] uppercase font-semibold shrink-0">
                    Exposure-Aware
                </span>
            </div>

            {/* Summary Strip (Calibrated KPI Strip) */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-xs font-mono">
                <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block">Evaluated</span>
                    <span className="text-2xl font-bold text-white block">{summary.totalEvaluated}</span>
                    <span className="text-[10px] text-zinc-500">Window: {timeRange.key}</span>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-emerald-500/20 space-y-1">
                    <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Recovered</span>
                    <span className="text-2xl font-bold text-emerald-400 block">{summary.recovered}</span>
                    <span className="text-[10px] text-zinc-400">Verified exposure</span>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-purple-500/20 space-y-1">
                    <span className="text-[10px] text-purple-400 uppercase font-semibold block">Unisolated</span>
                    <span className="text-2xl font-bold text-purple-400 block">{summary.changeNotIsolated}</span>
                    <span className="text-[10px] text-zinc-400">Multi-deployments</span>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-amber-500/20 space-y-1">
                    <span className="text-[10px] text-amber-400 uppercase font-semibold block">Partial</span>
                    <span className="text-2xl font-bold text-amber-400 block">{summary.partiallyRecovered}</span>
                    <span className="text-[10px] text-zinc-400">Residual failures</span>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-red-500/20 space-y-1">
                    <span className="text-[10px] text-red-400 uppercase font-semibold block">Still Observed</span>
                    <span className="text-2xl font-bold text-red-400 block">{summary.stillObserved}</span>
                    <span className="text-[10px] text-zinc-400">Active errors</span>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-zinc-700/60 space-y-1">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold block">Insufficient</span>
                    <span className="text-2xl font-bold text-zinc-300 block">{summary.insufficientEvidence}</span>
                    <span className="text-[10px] text-zinc-500">Unverified traffic</span>
                </div>
            </div>

            {candidates.length === 0 ? (
                <div className="p-10 rounded-xl bg-surface border border-border text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-zinc-500 mx-auto" />
                    <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">No Resolution Candidates Found</h2>
                    <p className="text-xs text-secondary max-w-md mx-auto font-mono">
                        No deployments, releases, or issue lifecycle changes matched the active scope to audit.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {candidates.map((c) => {
                        const isExpanded = expandedIssueId === c.issueId;

                        return (
                            <div
                                key={c.issueId}
                                className="p-4 rounded-xl bg-surface border border-border space-y-3 transition-all duration-150"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="space-y-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h2 className="text-sm font-bold text-white font-mono truncate">{c.title}</h2>
                                            {getStatusBadge(c.assessment.status)}
                                        </div>
                                        <div className="text-xs font-mono text-zinc-400 flex items-center gap-2 flex-wrap">
                                            <span>Service: <strong className="text-zinc-200">{c.service}</strong></span>
                                            <span>•</span>
                                            <span className="flex items-center gap-1 text-purple-400">
                                                <GitCommit size={11} />
                                                <span>{c.changeReference.identifier}</span>
                                            </span>
                                            <span>•</span>
                                            <span>Applied <RelativeTime date={c.changeReference.timestamp} /></span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => setExpandedIssueId(isExpanded ? null : c.issueId)}
                                            className="halo-btn halo-btn-secondary halo-btn-xs text-[11px] font-mono"
                                            aria-expanded={isExpanded}
                                        >
                                            <span>{isExpanded ? "Hide Audit Matrix" : "Inspect Audit Matrix"}</span>
                                            {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                        </button>
                                        <Link
                                            href={`/projects/${c.projectId}/issues/${c.issueId}`}
                                            className="halo-btn halo-btn-ghost halo-btn-xs text-zinc-400 hover:text-white"
                                            title="View issue details"
                                            aria-label="View issue details"
                                        >
                                            <ExternalLink size={13} />
                                            <span>Issue</span>
                                        </Link>
                                    </div>
                                </div>

                                {/* Post-Change Observation & Calibrated Verdict */}
                                <div className="p-2.5 rounded-lg bg-[#06080d] border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
                                    <div className="space-y-0.5 min-w-0">
                                        <span className="text-zinc-200 block text-[11px]">
                                            {c.assessment.verdictExplanation}
                                        </span>
                                        <div className="text-[10px] text-zinc-400 flex items-center gap-2 flex-wrap pt-0.5">
                                            <span>Post-Change: <strong className="text-white">{c.postChange.durationHours}h</strong></span>
                                            <span>•</span>
                                            <span>
                                                Requests: <strong className="text-white">{c.postChange.requestExposure !== null ? c.postChange.requestExposure : "UNKNOWN"}</strong>
                                            </span>
                                            <span>•</span>
                                            <span>
                                                Residual: <strong className="text-white">{c.postChange.residualOccurrences}</strong>
                                            </span>
                                            <span>•</span>
                                            <span>
                                                Exposure: <strong className={c.postChange.exposureAssessment === "COMPARABLE" ? "text-emerald-400" : "text-amber-400"}>
                                                    {c.postChange.exposureAssessment}
                                                </strong>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Progressive Disclosure: Full Before / Change / After Matrix */}
                                {isExpanded && (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2 border-t border-border/60 text-xs font-mono animate-in fade-in-50 duration-200">
                                        {/* BEFORE */}
                                        <div className="p-2.5 rounded-lg bg-surface-elevated border border-border space-y-1">
                                            <span className="text-[9px] uppercase font-bold text-zinc-500 block">
                                                1. Baseline Observation
                                            </span>
                                            <span
                                                className={`text-base font-bold font-mono block ${
                                                    c.preChange.hadActiveFailures ? "text-red-400" : "text-zinc-400"
                                                }`}
                                            >
                                                {c.preChange.hadActiveFailures
                                                    ? `${c.preChange.errorCount} failures`
                                                    : "0 baseline occurrences"}
                                            </span>
                                            <p className="text-[10px] text-zinc-400">
                                                {c.preChange.hadActiveFailures
                                                    ? "Failure signature actively observed prior to change."
                                                    : "Baseline failure signature was not active."}
                                            </p>
                                        </div>

                                        {/* CHANGE */}
                                        <div className="p-2.5 rounded-lg bg-surface-elevated border border-purple-500/20 space-y-1">
                                            <span className="text-[9px] uppercase font-bold text-purple-400 block">
                                                2. Code Deployment / Change
                                            </span>
                                            <span className="text-xs font-bold text-white block truncate">
                                                {c.changeReference.identifier}
                                            </span>
                                            <p className="text-[10px] text-zinc-400">
                                                {c.changeReference.multipleChangesInWindow
                                                    ? `Multiple deployments (${c.changeReference.allCandidateChanges?.length}) recorded in window.`
                                                    : `Single change on ${c.changeReference.timestamp.toLocaleDateString()}.`}
                                            </p>
                                        </div>

                                        {/* AFTER */}
                                        <div className="p-2.5 rounded-lg bg-surface-elevated border border-border space-y-1">
                                            <span className="text-[9px] uppercase font-bold text-zinc-500 block">
                                                3. Post-Change Verification
                                            </span>
                                            <span
                                                className={`text-base font-bold font-mono block ${
                                                    c.assessment.status === "RECOVERED"
                                                        ? "text-emerald-400"
                                                        : c.assessment.status === "PARTIALLY_RECOVERED"
                                                        ? "text-amber-400"
                                                        : c.postChange.residualOccurrences > 0
                                                        ? "text-red-400"
                                                        : "text-zinc-400"
                                                }`}
                                            >
                                                {c.postChange.residualOccurrences} residual failures
                                            </span>
                                            <p className="text-[10px] text-zinc-400">
                                                Search: {c.postChange.signatureSearch} • Continuity: {c.postChange.telemetryContinuity}
                                            </p>
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
