"use client";

import React, { useState, useEffect } from "react";
import {
    Sparkles,
    CheckCircle2,
    HelpCircle,
    XCircle,
    AlertTriangle,
    Layers,
    ArrowRight,
    ExternalLink,
    ChevronDown,
    ChevronRight,
    GitCommit,
    FileCode,
    Shield,
    History,
    Network,
    Activity,
    Info,
    Search,
} from "lucide-react";
import { getInvestigationSynthesis } from "@/actions/evidence-synthesis";
import type {
    InvestigationSynthesis,
    EvidenceClaim,
    EvidenceReference,
    EvidenceStatus,
    EvidenceChainNode,
    EvidenceChainEdge,
} from "@/lib/evidence-synthesis/types";

interface Props {
    investigationId: string;
    projectId: string;
}

const STATUS_BADGE_CONFIG: Record<
    EvidenceStatus,
    { label: string; bg: string; text: string; border: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
    ESTABLISHED: {
        label: "Established",
        bg: "bg-emerald-500/10",
        text: "text-emerald-400",
        border: "border-emerald-500/30",
        icon: CheckCircle2,
    },
    SUPPORTED: {
        label: "Supported",
        bg: "bg-blue-500/10",
        text: "text-blue-400",
        border: "border-blue-500/30",
        icon: Sparkles,
    },
    CONTRADICTED: {
        label: "Contradicted",
        bg: "bg-rose-500/10",
        text: "text-rose-400",
        border: "border-rose-500/30",
        icon: XCircle,
    },
    UNKNOWN: {
        label: "Unknown",
        bg: "bg-amber-500/10",
        text: "text-amber-400",
        border: "border-amber-500/30",
        icon: HelpCircle,
    },
    UNAVAILABLE: {
        label: "Unavailable",
        bg: "bg-zinc-500/10",
        text: "text-zinc-400",
        border: "border-zinc-500/30",
        icon: AlertTriangle,
    },
};

export function EvidenceSynthesisPanel({ investigationId, projectId }: Props) {
    const [loading, setLoading] = useState<boolean>(true);
    const [synthesis, setSynthesis] = useState<InvestigationSynthesis | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"narrative" | "chain" | "claims">("narrative");
    const [statusFilter, setStatusFilter] = useState<EvidenceStatus | "ALL">("ALL");
    const [selectedReference, setSelectedReference] = useState<EvidenceReference | null>(null);
    const [expandedClaimId, setExpandedClaimId] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setError(null);

        getInvestigationSynthesis(investigationId)
            .then((res) => {
                if (isMounted) {
                    setSynthesis(res);
                    if (res.claims.length > 0) {
                        setExpandedClaimId(res.claims[0].claimId);
                    }
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (isMounted) {
                    setError(err?.message || "Failed to load evidence synthesis.");
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [investigationId]);

    if (loading) {
        return (
            <div className="halo-card p-6 border-border space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                    <span className="text-sm text-zinc-300 font-mono">
                        Synthesizing cross-pillar investigation evidence...
                    </span>
                </div>
            </div>
        );
    }

    if (error || !synthesis) {
        return (
            <div className="halo-card p-6 border-border border-amber-500/20 bg-amber-500/5 space-y-3">
                <div className="flex items-center gap-2 text-amber-400">
                    <AlertTriangle size={18} />
                    <span className="text-sm font-semibold">Evidence Synthesis Unavailable</span>
                </div>
                <p className="text-xs text-zinc-400">{error || "No synthesis could be derived."}</p>
            </div>
        );
    }

    const filteredClaims = synthesis.claims.filter(
        (c) => statusFilter === "ALL" || c.status === statusFilter
    );

    return (
        <section id="section-evidence-synthesis" className="halo-card p-6 border-border space-y-6 scroll-mt-24">
            {/* Header */}
            <div className="border-b border-border pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400">
                        <Sparkles size={20} />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold text-white tracking-wide flex items-center gap-2">
                            Evidence Synthesis & Investigation Reasoning
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                Pillar G
                            </span>
                        </h2>
                        <p className="text-xs text-zinc-400">
                            Deterministic, inspectable cross-pillar synthesis. Every claim is verified with independent evidence.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="px-2 py-1 rounded bg-zinc-800/80 text-[11px] font-mono text-zinc-300 border border-zinc-700/50">
                        {synthesis.statistics.totalClaims} Claims
                    </span>
                    <span className="px-2 py-1 rounded bg-blue-500/10 text-[11px] font-mono text-blue-400 border border-blue-500/30">
                        {synthesis.statistics.independentSourceCategories} Source Dimensions
                    </span>
                </div>
            </div>

            {/* Authoritative Root Cause Presentation (Section 23 & 24) */}
            <div className="p-4 rounded-lg bg-zinc-900/60 border border-border space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold font-mono">
                        Authoritative Investigation Conclusion
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-zinc-400">Confidence:</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-xs border border-emerald-500/20">
                            {Math.round(synthesis.rootCauseMap.confidenceScore * 100)}%
                        </span>
                    </div>
                </div>

                <h3 className="text-base font-medium text-white">
                    {synthesis.rootCauseMap.canonicalRootCause}
                </h3>

                <p className="text-xs text-zinc-300 leading-relaxed">
                    {synthesis.rootCauseMap.explanation}
                </p>

                {/* Evidence Support Dimensions */}
                <div className="pt-2 border-t border-zinc-800/60 flex flex-wrap gap-2 items-center">
                    <span className="text-[11px] text-zinc-500 font-mono">Supporting dimensions:</span>
                    {synthesis.rootCauseMap.supportedDimensions.map((dim) => (
                        <span
                            key={dim}
                            className="px-2 py-0.5 rounded-full text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20"
                        >
                            ✓ {dim}
                        </span>
                    ))}
                    {synthesis.rootCauseMap.unknownDimensions.map((dim) => (
                        <span
                            key={dim}
                            className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20"
                        >
                            ? {dim} (Unknown)
                        </span>
                    ))}
                    {synthesis.rootCauseMap.contradictedDimensions.map((dim) => (
                        <span
                            key={dim}
                            className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/10 text-rose-300 border border-rose-500/20"
                        >
                            ⚠ {dim} (Contradicted)
                        </span>
                    ))}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-border/80 pb-2">
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab("narrative")}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            activeTab === "narrative"
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                        }`}
                    >
                        Investigation Narrative (9 Sections)
                    </button>
                    <button
                        onClick={() => setActiveTab("chain")}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            activeTab === "chain"
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                        }`}
                    >
                        Minimum Sufficient Evidence Chain
                    </button>
                    <button
                        onClick={() => setActiveTab("claims")}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            activeTab === "claims"
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                        }`}
                    >
                        Synthesized Claims ({synthesis.claims.length})
                    </button>
                </div>

                {activeTab === "claims" && (
                    <div className="flex gap-1">
                        {(["ALL", "ESTABLISHED", "SUPPORTED", "CONTRADICTED", "UNKNOWN", "UNAVAILABLE"] as const).map(
                            (st) => (
                                <button
                                    key={st}
                                    onClick={() => setStatusFilter(st)}
                                    className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                                        statusFilter === st
                                            ? "bg-zinc-700 text-white font-semibold"
                                            : "text-zinc-400 hover:text-zinc-200"
                                    }`}
                                >
                                    {st}
                                </button>
                            )
                        )}
                    </div>
                )}
            </div>

            {/* TAB 1: 9-PART NARRATIVE */}
            {activeTab === "narrative" && (
                <div className="space-y-4">
                    {synthesis.narrative.sections.map((section) => (
                        <div
                            key={section.id}
                            className="p-4 rounded-lg bg-zinc-900/40 border border-zinc-800/80 space-y-2.5"
                        >
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs uppercase tracking-wider font-semibold text-zinc-300 font-mono flex items-center gap-2">
                                    {section.title}
                                </h4>
                                <span className="text-[11px] text-zinc-500 font-mono">
                                    {section.bulletPoints.length} point{section.bulletPoints.length === 1 ? "" : "s"}
                                </span>
                            </div>

                            <p className="text-xs text-zinc-400">{section.summary}</p>

                            <ul className="space-y-2 pt-1">
                                {section.bulletPoints.map((bp, idx) => {
                                    const badge = STATUS_BADGE_CONFIG[bp.status];
                                    const Icon = badge.icon;
                                    return (
                                        <li
                                            key={idx}
                                            className="text-xs text-zinc-300 flex items-start gap-2.5 bg-zinc-950/40 p-2.5 rounded border border-zinc-800/40"
                                        >
                                            <span
                                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 ${badge.bg} ${badge.text} ${badge.border} border`}
                                            >
                                                <Icon size={11} />
                                                {badge.label}
                                            </span>

                                            <div className="flex-1 space-y-1">
                                                <p className="leading-relaxed">{bp.text}</p>
                                                {bp.references.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                                        {bp.references.map((ref) => (
                                                            <button
                                                                key={ref.id}
                                                                onClick={() => setSelectedReference(ref)}
                                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800/90 text-indigo-300 hover:bg-zinc-750 border border-zinc-700/50 hover:border-indigo-500/50 transition-colors"
                                                            >
                                                                <span>[{ref.sourceType}]</span>
                                                                <span>{ref.label}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>
            )}

            {/* TAB 2: MINIMUM SUFFICIENT EVIDENCE CHAIN */}
            {activeTab === "chain" && (
                <div className="space-y-6">
                    <div className="p-3 bg-zinc-900/60 rounded border border-border text-xs text-zinc-400">
                        <strong className="text-zinc-200">Minimum Sufficient Chain:</strong> Smallest verified sequence of evidence connecting the failure onset to code path, change, and deployment boundaries. Chronology is strictly separated from causality.
                    </div>

                    {/* Nodes flow */}
                    <div className="space-y-3">
                        {synthesis.chain.nodes
                            .filter((n) => synthesis.chain.minimumChainNodeIds.includes(n.id))
                            .map((node, idx, arr) => {
                                const badge = STATUS_BADGE_CONFIG[node.status];
                                const isLast = idx === arr.length - 1;
                                const matchingEdge = synthesis.chain.edges.find((e) => e.from === node.id);

                                return (
                                    <div key={node.id} className="space-y-2">
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-[11px] font-mono text-indigo-300">
                                                    {idx + 1}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] uppercase font-mono text-zinc-400 font-semibold">
                                                            {node.type}
                                                        </span>
                                                        <span
                                                            className={`px-1.5 py-0.2 rounded text-[9px] font-mono ${badge.bg} ${badge.text} ${badge.border} border`}
                                                        >
                                                            {badge.label}
                                                        </span>
                                                        <span className="text-[10px] text-zinc-500 font-mono">
                                                            [{node.source}]
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-white font-medium mt-0.5">
                                                        {node.label}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex gap-1.5">
                                                {node.evidenceReferences.map((ref) => (
                                                    <button
                                                        key={ref.id}
                                                        onClick={() => setSelectedReference(ref)}
                                                        className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700"
                                                    >
                                                        Inspect Evidence
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {!isLast && matchingEdge && (
                                            <div className="flex items-center gap-2 pl-6 py-1 text-xs text-zinc-400 font-mono">
                                                <ArrowRight size={14} className="text-indigo-400 shrink-0" />
                                                <span className="text-[10px] uppercase tracking-wider text-indigo-300 font-semibold">
                                                    {matchingEdge.relationship}
                                                </span>
                                                <span className="text-[10px] text-zinc-500">
                                                    ({matchingEdge.status} • {matchingEdge.evidenceCount} evidence source{matchingEdge.evidenceCount > 1 ? "s" : ""})
                                                </span>
                                                {matchingEdge.explanation && (
                                                    <span className="text-[11px] text-zinc-400 font-sans italic">
                                                        — {matchingEdge.explanation}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* TAB 3: STRUCTURED CLAIMS */}
            {activeTab === "claims" && (
                <div className="space-y-3">
                    {filteredClaims.map((claim) => {
                        const badge = STATUS_BADGE_CONFIG[claim.status];
                        const Icon = badge.icon;
                        const isExpanded = expandedClaimId === claim.claimId;

                        return (
                            <div
                                key={claim.claimId}
                                className="rounded-lg bg-zinc-900/50 border border-zinc-800/80 overflow-hidden"
                            >
                                <button
                                    onClick={() => setExpandedClaimId(isExpanded ? null : claim.claimId)}
                                    className="w-full text-left p-3.5 flex items-start justify-between gap-3 hover:bg-zinc-800/30 transition-colors"
                                >
                                    <div className="flex items-start gap-2.5 flex-1">
                                        <span
                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 mt-0.5 ${badge.bg} ${badge.text} ${badge.border} border`}
                                        >
                                            <Icon size={11} />
                                            {badge.label}
                                        </span>
                                        <div>
                                            <p className="text-xs text-zinc-200 leading-snug">{claim.statement}</p>
                                            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-500 font-mono">
                                                <span>Sources: {claim.sourceTypes.join(", ")}</span>
                                                <span>•</span>
                                                <span>{claim.independentSourceCount} Independent Dimension{claim.independentSourceCount === 1 ? "" : "s"}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-zinc-400 hover:text-zinc-200 mt-1">
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="p-3.5 bg-zinc-950/60 border-t border-zinc-800/80 space-y-3 text-xs">
                                        <div className="space-y-1.5">
                                            <span className="text-[10px] uppercase font-mono text-zinc-400 font-semibold">
                                                Underlying Evidence References ({claim.evidenceReferences.length})
                                            </span>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {claim.evidenceReferences.map((ref) => (
                                                    <div
                                                        key={ref.id}
                                                        onClick={() => setSelectedReference(ref)}
                                                        className="p-2 rounded bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 cursor-pointer transition-colors"
                                                    >
                                                        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                                                            <span className="text-indigo-400 font-semibold">{ref.sourceType}</span>
                                                            <span>Target: {ref.targetId.slice(0, 12)}</span>
                                                        </div>
                                                        <p className="text-zinc-200 font-mono text-[11px] truncate mt-1">
                                                            {ref.label}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {claim.relatedServices.length > 0 && (
                                            <div className="text-[11px] text-zinc-400 font-mono">
                                                Related services: <span className="text-zinc-200">{claim.relatedServices.join(", ")}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Evidence Provenance Modal / Drawer (Section 37) */}
            {selectedReference && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="halo-card max-w-lg w-full p-6 border-border space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    {selectedReference.sourceType}
                                </span>
                                <h4 className="text-sm font-semibold text-white">Evidence Provenance</h4>
                            </div>
                            <button
                                onClick={() => setSelectedReference(null)}
                                className="text-zinc-400 hover:text-white text-xs font-mono"
                            >
                                [Close]
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div>
                                <span className="text-[10px] uppercase font-mono text-zinc-500">Label</span>
                                <p className="text-white font-mono mt-0.5">{selectedReference.label}</p>
                            </div>

                            <div>
                                <span className="text-[10px] uppercase font-mono text-zinc-500">Target Identifier</span>
                                <p className="text-zinc-300 font-mono mt-0.5">{selectedReference.targetId}</p>
                            </div>

                            {selectedReference.timestamp && (
                                <div>
                                    <span className="text-[10px] uppercase font-mono text-zinc-500">Observed Timestamp</span>
                                    <p className="text-zinc-300 font-mono mt-0.5">
                                        {new Date(selectedReference.timestamp).toISOString()}
                                    </p>
                                </div>
                            )}

                            {selectedReference.metadata && (
                                <div>
                                    <span className="text-[10px] uppercase font-mono text-zinc-500">Metadata</span>
                                    <pre className="p-2.5 rounded bg-zinc-950 text-zinc-300 font-mono text-[10px] overflow-x-auto border border-zinc-800 mt-1">
                                        {JSON.stringify(selectedReference.metadata, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>

                        <div className="pt-2 border-t border-border flex justify-end">
                            <button
                                onClick={() => setSelectedReference(null)}
                                className="px-3 py-1.5 rounded bg-zinc-800 text-white text-xs font-medium hover:bg-zinc-700 transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
