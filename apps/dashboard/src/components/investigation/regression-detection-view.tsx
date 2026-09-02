"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Clock,
    Code2,
    FileCode,
    GitBranch,
    GitCommit,
    HelpCircle,
    Layers,
    ShieldAlert,
    Sparkles,
    Terminal,
    User,
    Zap,
} from "lucide-react";
import { formatDeterministicDateTime, formatDeterministicTime } from "@/lib/date-format";
import { getClientTimezone } from "@/lib/timezone";
import type {
    RegressionAnalysisResult,
    RegressionCandidate,
    RegressionConfidence,
    CodeChangeRelationship,
} from "@halo/investigation-engine";

interface Props {
    regression?: RegressionAnalysisResult | null;
    projectId: string;
}

const CONFIDENCE_BADGES: Record<
    RegressionConfidence,
    { label: string; bg: string; text: string; border: string }
> = {
    OBSERVED: { label: "Observed Regression", bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30" },
    STRONGLY_SUPPORTED: { label: "Likely Regression Detected", bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30" },
    PLAUSIBLE_CANDIDATE: { label: "Plausible Candidate", bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" },
    INSUFFICIENT_EVIDENCE: { label: "Insufficient Evidence", bg: "bg-zinc-800", text: "text-zinc-400", border: "border-zinc-700" },
    UNKNOWN: { label: "Unknown Cause", bg: "bg-zinc-800", text: "text-zinc-400", border: "border-zinc-700" },
};

const CODE_RELATION_BADGES: Record<
    CodeChangeRelationship,
    { label: string; color: string }
> = {
    INTRODUCED: { label: "Introduced By Change", color: "text-red-400 bg-red-500/10 border-red-500/20" },
    MODIFIED: { label: "Modified In Change", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    MOVED: { label: "Moved In Change", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
    INDIRECTLY_AFFECTED: { label: "Indirectly Affected", color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
    UNRELATED: { label: "Unrelated Files", color: "text-zinc-400 bg-zinc-800 border-zinc-700" },
    UNKNOWN: { label: "Relationship Unknown", color: "text-zinc-400 bg-zinc-800 border-zinc-700" },
};

export function RegressionDetectionView({ regression, projectId }: Props) {
    const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
        regression?.strongestCandidate?.id || null
    );

    if (!regression) {
        return null;
    }

    const {
        isRegressionDetected,
        confidence,
        headline,
        strongestCandidate,
        candidates,
        failingLocation,
        unprovenFactors,
        hasGitIntegration,
    } = regression;

    const badge = CONFIDENCE_BADGES[confidence] || CONFIDENCE_BADGES.UNKNOWN;
    const activeCandidate = candidates.find((c) => c.id === selectedCandidateId) || strongestCandidate;

    return (
        <section className="halo-card p-6 border-border space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-accent" />
                    <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                            Automatic Regression Detection
                        </h2>
                        <p className="text-xs text-secondary">
                            Git commit & release correlation pipeline analyzing code change history against failure location.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono px-2.5 py-1 rounded-full border font-bold ${badge.bg} ${badge.text} ${badge.border}`}>
                        {badge.label}
                    </span>
                </div>
            </div>

            {/* Headline Callout */}
            <div className="p-4 rounded-xl bg-surface/60 border border-border/80 space-y-2">
                <div className="flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <h3 className="text-xs font-semibold text-white">
                            {headline}
                        </h3>
                        {failingLocation?.filePath && (
                            <p className="text-[11px] font-mono text-zinc-400">
                                Target failure site: <span className="text-emerald-400">{failingLocation.filePath}:{failingLocation.lineNumber}</span>
                                {failingLocation.functionName && ` in ${failingLocation.functionName}()`}
                            </p>
                        )}
                    </div>
                </div>
            </div>


            {/* Candidates Selection Strip if multiple */}
            {candidates.length > 1 && (
                <div className="space-y-2">
                    <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider block">
                        Evaluated Candidate Changes ({candidates.length})
                    </span>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {candidates.map((c) => {
                            const isSelected = (activeCandidate?.id || strongestCandidate?.id) === c.id;
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setSelectedCandidateId(c.id)}
                                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono shrink-0 transition-all flex items-center gap-2 ${
                                        isSelected
                                            ? "bg-accent text-white border-accent shadow font-semibold"
                                            : "bg-surface border-border text-zinc-400 hover:text-white"
                                    }`}
                                >
                                    <GitCommit size={13} />
                                    <span>{c.shortSha}</span>
                                    <span className="text-[10px] opacity-75">({c.confidence.replace("_", " ")})</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Active Candidate Deep Dive */}
            {activeCandidate && (
                <div className="p-5 rounded-xl bg-[#080b11] border border-white/10 space-y-5 text-xs">
                    {/* Candidate Metadata Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400">
                                <GitCommit size={16} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-white font-mono text-sm">{activeCandidate.shortSha}</span>
                                    <span className="text-zinc-400 font-medium">"{activeCandidate.commitMessage}"</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-0.5">
                                    <span>By {activeCandidate.authorName || "Author"}</span>
                                    <span>•</span>
                                    <span>Committed {formatDeterministicDateTime(activeCandidate.commitDate)}</span>
                                    {activeCandidate.releaseVersion && (
                                        <>
                                            <span>•</span>
                                            <span className="text-indigo-400">Release {activeCandidate.releaseVersion}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Code Change Relationship Badge */}
                        <div>
                            {(() => {
                                const relBadge = CODE_RELATION_BADGES[activeCandidate.codeRelationship] || CODE_RELATION_BADGES.UNKNOWN;
                                return (
                                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${relBadge.color}`}>
                                        {relBadge.label}
                                    </span>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Change Timeline */}
                    <div className="space-y-2">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono block">
                            Progression Timeline
                        </span>
                        <div className="p-3.5 rounded-xl bg-surface/50 border border-border/80 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-zinc-400">
                                    <GitCommit size={12} className="text-pink-400" />
                                    <span>Code Committed</span>
                                </div>
                                <div className="text-white font-semibold">
                                    {formatDeterministicTime(activeCandidate.commitDate, getClientTimezone())}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-zinc-400">
                                    <Zap size={12} className="text-fuchsia-400" />
                                    <span>Deployment / Release</span>
                                </div>
                                <div className="text-white font-semibold">
                                    {activeCandidate.deploymentDate
                                        ? formatDeterministicTime(activeCandidate.deploymentDate, getClientTimezone())
                                        : "Unknown"}
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-zinc-400">
                                    <AlertCircle size={12} className="text-red-400" />
                                    <span>Incident First Seen</span>
                                </div>
                                <div className="text-white font-semibold">
                                    {formatDeterministicTime(activeCandidate.timeline.incidentFirstSeen, getClientTimezone())}
                                    {activeCandidate.timeline.minutesBetweenDeployAndIncident != null && (
                                        <span className="text-[10px] text-amber-400 font-normal ml-1">
                                            (+{activeCandidate.timeline.minutesBetweenDeployAndIncident}m delta)
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Changed Files & Diffs */}
                    {activeCandidate.changedFiles.length > 0 && (
                        <div className="space-y-2">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono block">
                                Modified Source Files ({activeCandidate.changedFiles.length})
                            </span>
                            <div className="space-y-2 font-mono text-xs">
                                {activeCandidate.changedFiles.map((file, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-3 rounded-xl border ${
                                            file.isFailingFile
                                                ? "bg-red-500/10 border-red-500/30"
                                                : "bg-surface/40 border-border/60"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <FileCode size={14} className={file.isFailingFile ? "text-red-400" : "text-zinc-400"} />
                                                <span className={`font-semibold ${file.isFailingFile ? "text-red-300" : "text-zinc-200"}`}>
                                                    {file.filePath}
                                                </span>
                                                {file.isFailingFile && (
                                                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 border border-red-500/30 font-bold">
                                                        FAILING STACK FILE
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[11px] text-zinc-400">
                                                <span className="text-emerald-400">+{file.additions}</span>{" "}
                                                <span className="text-red-400">-{file.deletions}</span>
                                            </span>
                                        </div>

                                        {file.patch && (
                                            <pre className="mt-2 p-2 rounded bg-black/50 text-[11px] text-zinc-300 overflow-x-auto leading-relaxed border border-white/5">
                                                {file.patch}
                                            </pre>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Supporting Reasons & Causality Guardrails */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans text-xs">
                        <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                            <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold tracking-wider block">
                                Supporting Evidence
                            </span>
                            <ul className="space-y-1 text-zinc-300 text-[11px]">
                                {activeCandidate.supportingReasons.map((reason, idx) => (
                                    <li key={idx} className="flex items-start gap-1.5">
                                        <CheckCircle2 size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                                        <span>{reason}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
                            <span className="text-[10px] font-mono text-amber-400 uppercase font-bold tracking-wider block">
                                What Remains Unproven
                            </span>
                            <ul className="space-y-1 text-zinc-400 text-[11px]">
                                {activeCandidate.unprovenGaps.map((gap, idx) => (
                                    <li key={idx} className="flex items-start gap-1.5">
                                        <AlertCircle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                                        <span>{gap}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
