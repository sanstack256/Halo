"use client";

import React, { useState, useEffect } from "react";
import {
    GitCommit,
    GitBranch,
    Calendar,
    Server,
    FileCode,
    AlertCircle,
    ChevronDown,
    ChevronRight,
    Shield,
    CheckCircle2,
    Clock,
    Layers,
    ArrowRight,
    HelpCircle,
    XCircle,
} from "lucide-react";
import { getInvestigationChanges } from "@/actions/change-intelligence";
import {
    type InvestigationChangeContext,
    type AnalyzedChangeCandidate,
    type ChangeRelationshipType,
    type SignalLevel,
} from "@/lib/change-intelligence/types";

interface Props {
    investigationId: string;
    projectId: string;
}

const RELATIONSHIP_BADGE_CONFIG: Record<
    ChangeRelationshipType,
    { label: string; bg: string; text: string; border: string }
> = {
    STRONGLY_SUPPORTED: {
        label: "Strongly Supported",
        bg: "bg-emerald-500/10",
        text: "text-emerald-400",
        border: "border-emerald-500/30",
    },
    BEHAVIORALLY_RELATED: {
        label: "Behaviorally Related",
        bg: "bg-blue-500/10",
        text: "text-blue-400",
        border: "border-blue-500/30",
    },
    CODE_PATH_RELATED: {
        label: "Code Path Related",
        bg: "bg-purple-500/10",
        text: "text-purple-400",
        border: "border-purple-500/30",
    },
    SERVICE_RELATED: {
        label: "Service Related",
        bg: "bg-cyan-500/10",
        text: "text-cyan-400",
        border: "border-cyan-500/30",
    },
    TEMPORALLY_RELATED: {
        label: "Temporal",
        bg: "bg-amber-500/10",
        text: "text-amber-400",
        border: "border-amber-500/30",
    },
    INSUFFICIENT_EVIDENCE: {
        label: "Insufficient Evidence",
        bg: "bg-zinc-500/10",
        text: "text-zinc-400",
        border: "border-zinc-500/30",
    },
    UNRELATED: {
        label: "Unrelated",
        bg: "bg-zinc-800/40",
        text: "text-zinc-500",
        border: "border-zinc-700/30",
    },
};

export function ChangeIntelligencePanel({ investigationId, projectId }: Props) {
    const [loading, setLoading] = useState<boolean>(true);
    const [context, setContext] = useState<InvestigationChangeContext | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedChangeId, setExpandedChangeId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"candidates" | "timeline" | "impact">("candidates");

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setError(null);

        getInvestigationChanges(investigationId)
            .then((res) => {
                if (isMounted) {
                    setContext(res);
                    if (res.changes.length > 0) {
                        setExpandedChangeId(res.changes[0].id);
                    }
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (isMounted) {
                    setError(err.message || "Failed to load Change Intelligence");
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [investigationId]);

    if (loading) {
        return (
            <div id="section-change-intelligence" className="halo-card p-6 border-border space-y-4 scroll-mt-24 animate-pulse">
                <div className="flex items-center gap-2 text-zinc-400">
                    <GitBranch className="h-5 w-5 animate-spin" />
                    <span className="text-sm font-semibold tracking-wider uppercase text-zinc-300">
                        Correlating Change Intelligence...
                    </span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div id="section-change-intelligence" className="halo-card p-6 border-border space-y-4 scroll-mt-24">
                <div className="flex items-center gap-2 text-amber-400">
                    <AlertCircle className="h-5 w-5" />
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
                        Change Intelligence Notice
                    </h3>
                </div>
                <p className="text-xs text-zinc-400">{error}</p>
            </div>
        );
    }

    if (!context) return null;

    const { changes, timeline, contradictions, uncertainties, failingLocation, hasGitIntegration, hasDeploymentData } = context;

    return (
        <section id="section-change-intelligence" className="halo-card p-6 border-border space-y-6 scroll-mt-24">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-border/60 gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-accent/10 border border-accent/20 text-accent">
                        <GitBranch size={18} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                                Change Intelligence & Causal Change Analysis
                            </h2>
                            <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-accent/15 text-accent border border-accent/30 font-bold">
                                PILLAR F
                            </span>
                        </div>
                        <p className="text-xs text-secondary mt-0.5">
                            Deterministic change correlation with failure timeline, code execution path, and differential trace.
                        </p>
                    </div>
                </div>

                {/* Sub-tabs */}
                <div className="flex items-center gap-1 p-1 bg-surface rounded-lg border border-border">
                    <button
                        onClick={() => setActiveTab("candidates")}
                        className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                            activeTab === "candidates"
                                ? "bg-accent/20 text-white border border-accent/30"
                                : "text-zinc-400 hover:text-white"
                        }`}
                    >
                        Changes ({changes.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("timeline")}
                        className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                            activeTab === "timeline"
                                ? "bg-accent/20 text-white border border-accent/30"
                                : "text-zinc-400 hover:text-white"
                        }`}
                    >
                        Timeline ({timeline.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("impact")}
                        className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                            activeTab === "impact"
                                ? "bg-accent/20 text-white border border-accent/30"
                                : "text-zinc-400 hover:text-white"
                        }`}
                    >
                        Impact Graph
                    </button>
                </div>
            </div>

            {/* Failing Location Callout if observed */}
            {failingLocation?.filePath && (
                <div className="p-3 rounded-lg bg-surface/60 border border-border flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-zinc-300">
                        <FileCode size={14} className="text-accent" />
                        <span>Failing Stack Path:</span>
                        <code className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-white font-mono text-[11px]">
                            {failingLocation.filePath}
                            {failingLocation.lineNumber ? `:${failingLocation.lineNumber}` : ""}
                        </code>
                        {failingLocation.functionName && (
                            <span className="text-zinc-400 font-mono text-[11px]">
                                in {failingLocation.functionName}()
                            </span>
                        )}
                    </div>
                    <span className="text-[11px] text-zinc-500 font-mono">
                        Reconstructed telemetry target
                    </span>
                </div>
            )}

            {/* Contradiction Banner if surfaced */}
            {contradictions.length > 0 && (
                <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/25 space-y-1">
                    <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                        <AlertCircle size={14} />
                        <span>Contradictory Evidence Surfaced ({contradictions.length})</span>
                    </div>
                    <ul className="text-xs text-amber-200/80 space-y-0.5 pl-5 list-disc">
                        {contradictions.map((c, i) => (
                            <li key={i}>{c}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Tab Content: CANDIDATES */}
            {activeTab === "candidates" && (
                <div className="space-y-4">
                    {changes.length === 0 ? (
                        <div className="p-8 text-center rounded-xl bg-surface/40 border border-border border-dashed space-y-3">
                            <HelpCircle className="h-8 w-8 text-zinc-500 mx-auto" />
                            <h4 className="text-sm font-medium text-zinc-300">
                                {hasGitIntegration
                                    ? "No change evidence observed for this investigation window."
                                    : "Repository change history unavailable."}
                            </h4>
                            <p className="text-xs text-zinc-500 max-w-md mx-auto">
                                {!hasGitIntegration
                                    ? "Configure repository access in project settings to inspect commits, diffs, and code path intersections."
                                    : "No commit, deployment, or configuration modifications were recorded within the window."}
                            </p>
                        </div>
                    ) : (
                        changes.map((cand) => {
                            const isExpanded = expandedChangeId === cand.id;
                            const badge = RELATIONSHIP_BADGE_CONFIG[cand.relationship];

                            return (
                                <div
                                    key={cand.id}
                                    className={`rounded-xl border transition-all ${
                                        isExpanded
                                            ? "bg-surface/80 border-accent/40 shadow-sm"
                                            : "bg-surface/40 border-border hover:border-border/80"
                                    }`}
                                >
                                    {/* Card Header */}
                                    <div
                                        onClick={() => setExpandedChangeId(isExpanded ? null : cand.id)}
                                        className="p-4 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 rounded-lg bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 mt-0.5">
                                                <GitCommit size={16} />
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-mono text-xs font-bold text-white">
                                                        {cand.commitSha ? cand.commitSha.slice(0, 7) : cand.sourceType}
                                                    </span>
                                                    {cand.repository && (
                                                        <span className="text-xs text-zinc-400">
                                                            in {cand.repository}
                                                        </span>
                                                    )}
                                                    <span
                                                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${badge.bg} ${badge.text} ${badge.border}`}
                                                    >
                                                        {badge.label}
                                                    </span>
                                                    {cand.declaredOwner && (
                                                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                                                            <Shield size={10} />
                                                            Owner: {cand.declaredOwner}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-zinc-300 line-clamp-1">
                                                    {cand.commitMessage || "No change description recorded."}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 text-xs text-zinc-400 self-end md:self-center">
                                            {cand.authorIdentity && (
                                                <span className="text-zinc-400 text-[11px]">
                                                    Author: <strong className="text-zinc-300 font-normal">{cand.authorIdentity}</strong>
                                                </span>
                                            )}
                                            {cand.authorTimestamp && (
                                                <span className="text-[11px] font-mono text-zinc-500">
                                                    {new Date(cand.authorTimestamp).toLocaleTimeString()}
                                                </span>
                                            )}
                                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 pt-2 border-t border-border/60 space-y-4">
                                            {/* Evidence Dimensions Grid */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                                                <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                                                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                                                        Temporal
                                                    </span>
                                                    <div className="text-xs font-semibold text-zinc-200">
                                                        {cand.evidenceDimensions.temporalAlignment}
                                                    </div>
                                                </div>
                                                <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                                                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                                                        Service Match
                                                    </span>
                                                    <div className="text-xs font-semibold text-zinc-200">
                                                        {cand.evidenceDimensions.serviceIntersection}
                                                    </div>
                                                </div>
                                                <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                                                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                                                        File Match
                                                    </span>
                                                    <div className="text-xs font-semibold text-zinc-200">
                                                        {cand.evidenceDimensions.fileIntersection}
                                                    </div>
                                                </div>
                                                <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-1">
                                                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">
                                                        Line Match
                                                    </span>
                                                    <div className="text-xs font-semibold text-zinc-200">
                                                        {cand.evidenceDimensions.lineIntersection}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Explanation Prose */}
                                            <div className="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-1.5">
                                                <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                                                    Evidence Analysis Rationale
                                                </div>
                                                <p className="text-xs text-zinc-300 leading-relaxed">
                                                    {cand.explanation.explanation}
                                                </p>
                                                {cand.explanation.matchingSignals.length > 0 && (
                                                    <div className="pt-1.5 space-y-0.5">
                                                        {cand.explanation.matchingSignals.map((sig, idx) => (
                                                            <div key={idx} className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                                                                <CheckCircle2 size={12} className="shrink-0" />
                                                                <span>{sig}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {cand.explanation.contradictingSignals.length > 0 && (
                                                    <div className="pt-1.5 space-y-0.5">
                                                        {cand.explanation.contradictingSignals.map((sig, idx) => (
                                                            <div key={idx} className="flex items-center gap-1.5 text-[11px] text-amber-400">
                                                                <AlertCircle size={12} className="shrink-0" />
                                                                <span>{sig}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Changed Files List */}
                                            {cand.changedFiles.length > 0 && (
                                                <div className="space-y-2">
                                                    <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                                                        Changed Files ({cand.changedFiles.length})
                                                    </div>
                                                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                                                        {cand.changedFiles.map((file, fIdx) => (
                                                            <div
                                                                key={fIdx}
                                                                className={`p-2 rounded text-xs flex items-center justify-between border ${
                                                                    file.intersectsFailingPath
                                                                        ? "bg-purple-500/10 border-purple-500/30 text-white"
                                                                        : "bg-surface/50 border-border text-zinc-300"
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2 truncate">
                                                                    <FileCode size={13} className={file.intersectsFailingPath ? "text-purple-400" : "text-zinc-500"} />
                                                                    <span className="font-mono text-[11px] truncate">
                                                                        {file.filePath}
                                                                    </span>
                                                                    {file.intersectsFailingPath && (
                                                                        <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase">
                                                                            Intersects Failure
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {file.declaredOwner && (
                                                                    <span className="text-[10px] text-zinc-400 font-mono">
                                                                        Owner: {file.declaredOwner}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Tab Content: TIMELINE */}
            {activeTab === "timeline" && (
                <div className="p-4 rounded-xl bg-surface/50 border border-border space-y-4">
                    <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Reconstructed Change & Telemetry Sequence
                    </div>
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
                        {timeline.map((entry) => (
                            <div key={entry.id} className="relative group">
                                <div
                                    className={`absolute -left-[23px] top-1 h-3.5 w-3.5 rounded-full border-2 border-background ${
                                        entry.type === "FAILURE_ONSET"
                                            ? "bg-red-500 ring-2 ring-red-500/30"
                                            : entry.type === "DEPLOYMENT"
                                            ? "bg-cyan-500 ring-2 ring-cyan-500/30"
                                            : "bg-accent ring-2 ring-accent/30"
                                    }`}
                                />
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[11px] text-zinc-400">
                                            {new Date(entry.timestamp).toLocaleTimeString()}
                                        </span>
                                        <span className="text-xs font-semibold text-white">
                                            {entry.title}
                                        </span>
                                        {entry.relationship && (
                                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface border border-border text-zinc-300">
                                                {entry.relationship}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-zinc-400">{entry.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tab Content: IMPACT */}
            {activeTab === "impact" && (
                <div className="p-4 rounded-xl bg-surface/50 border border-border space-y-4">
                    <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Causal Change Flow & Blast Surface
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 justify-between p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                        <div className="text-center sm:text-left space-y-1">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                1. Change Candidate
                            </span>
                            <div className="text-xs font-mono text-accent">
                                {changes[0]?.commitSha ? changes[0].commitSha.slice(0, 7) : "No candidate"}
                            </div>
                        </div>
                        <ArrowRight size={16} className="text-zinc-600 hidden sm:block" />
                        <div className="text-center sm:text-left space-y-1">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                2. Modified Code
                            </span>
                            <div className="text-xs font-mono text-purple-400 truncate max-w-[150px]">
                                {failingLocation?.filePath ? failingLocation.filePath.split("/").pop() : "None observed"}
                            </div>
                        </div>
                        <ArrowRight size={16} className="text-zinc-600 hidden sm:block" />
                        <div className="text-center sm:text-left space-y-1">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                3. Target Service
                            </span>
                            <div className="text-xs font-mono text-cyan-400">
                                {context.rootCauseService || "unknown"}
                            </div>
                        </div>
                        <ArrowRight size={16} className="text-zinc-600 hidden sm:block" />
                        <div className="text-center sm:text-left space-y-1">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                4. Impacted Surface
                            </span>
                            <div className="text-xs font-mono text-emerald-400">
                                {context.affectedServices.length} service(s)
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Epistemic Boundaries Footer */}
            {uncertainties.length > 0 && (
                <div className="p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/60 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        Epistemic Boundaries & Unproven Gaps
                    </span>
                    <ul className="text-[11px] text-zinc-400 space-y-0.5 list-disc pl-4">
                        {uncertainties.map((u, i) => (
                            <li key={i}>{u}</li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}
