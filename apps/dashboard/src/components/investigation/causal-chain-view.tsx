"use client";

import React, { useState } from "react";
import {
    Activity,
    AlertCircle,
    ArrowDown,
    ArrowRight,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Code2,
    Compass,
    Copy,
    Database,
    FileCode,
    GitCommit,
    HelpCircle,
    Layers,
    ListTree,
    Network,
    Server,
    ShieldAlert,
    Terminal,
    XCircle,
    Zap,
} from "lucide-react";
import type { CausalChain, CausalClassification, EvidenceEdge, Hypothesis, TemporalRelationship } from "@halo/investigation-engine";

interface Props {
    causalChains?: CausalChain[];
    hypotheses?: Hypothesis[];
    rawEdges?: EvidenceEdge[];
}

const CLASSIFICATION_BADGES: Record<CausalClassification, { bg: string; text: string; border: string; desc: string }> = {
    Observed: {
        bg: "bg-emerald-500/10",
        text: "text-emerald-400",
        border: "border-emerald-500/20",
        desc: "Directly verified by telemetry (e.g. parent-child span, trace ID match, stack trace).",
    },
    Inferred: {
        bg: "bg-blue-500/10",
        text: "text-blue-400",
        border: "border-blue-500/20",
        desc: "Derived from multiple correlated real signals across session or call chain.",
    },
    Likely: {
        bg: "bg-amber-500/10",
        text: "text-amber-400",
        border: "border-amber-500/20",
        desc: "Supported by strong temporal & scope correlation; meaningful uncertainty remains.",
    },
    Unknown: {
        bg: "bg-zinc-800",
        text: "text-zinc-400",
        border: "border-zinc-700",
        desc: "Available evidence is insufficient to confirm or refute connection.",
    },
};

const TEMPORAL_BADGES: Record<TemporalRelationship, string> = {
    IMMEDIATELY_PRECEDES: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    CONTAINS: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    OVERLAPS: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    BEFORE: "text-zinc-300 bg-surface border-border",
    AFTER: "text-zinc-400 bg-surface border-border",
    WITHIN_LIFETIME: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    TEMPORALLY_CORRELATED: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    UNKNOWN: "text-zinc-500 bg-zinc-800 border-zinc-700",
};

export function CausalChainView({ causalChains = [], hypotheses = [], rawEdges = [] }: Props) {
    const [selectedChainId, setSelectedChainId] = useState<string>(
        causalChains.length > 0 ? causalChains[0].id : ""
    );
    const [expandedHypothesisId, setExpandedHypothesisId] = useState<string>(
        hypotheses.length > 0 ? hypotheses[0].id : ""
    );
    const [inspectedEdge, setInspectedEdge] = useState<EvidenceEdge | null>(null);
    const [showAllDirectEdges, setShowAllDirectEdges] = useState(false);

    const activeChain = causalChains.find((c) => c.id === selectedChainId) || causalChains[0];
    const directEdges = rawEdges.filter((e) => e.relationship !== "TEMPORALLY_PRECEDES");
    const INITIAL_VISIBLE_DIRECT_EDGES = 3;
    const visibleDirectEdges = showAllDirectEdges
        ? directEdges
        : directEdges.slice(0, INITIAL_VISIBLE_DIRECT_EDGES);

    return (
        <div className="space-y-8">
            {/* 1. Direct Supported Causal Relationships */}
            <section className="halo-card p-6 border-border space-y-5">
                <div className="border-b border-border pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Network className="w-4 h-4 text-accent" />
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                            Direct Supported Causal Relationships
                        </h2>
                    </div>
                    <span className="text-xs font-mono text-secondary">
                        {directEdges.length} supported relationship{directEdges.length === 1 ? "" : "s"} · click to inspect
                    </span>
                </div>

                {directEdges.length === 0 ? (
                    <div className="p-4 rounded-xl bg-surface/50 border border-border text-center space-y-1">
                        <p className="text-xs text-secondary">
                            No direct causal relationships established. Telemetry events lack shared trace, request, or stack frame correlation.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {visibleDirectEdges.map((edge, idx) => {
                            const classificationInfo = edge.classification ? CLASSIFICATION_BADGES[edge.classification] : undefined;
                            const isSelected = inspectedEdge === edge;

                            return (
                                <div
                                    key={`${edge.from}-${edge.to}-${edge.relationship}-${idx}`}
                                    onClick={() => setInspectedEdge(isSelected ? null : edge)}
                                    className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 text-xs ${
                                        isSelected
                                            ? "bg-accent/10 border-accent text-white ring-1 ring-accent/40 shadow-sm"
                                            : "bg-surface border-border/80 hover:border-accent/40 hover:bg-surface-hover/50"
                                    }`}
                                >
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2 font-mono">
                                            <span className="font-semibold text-white">
                                                {edge.from.slice(0, 14)}…
                                            </span>
                                            <ArrowRight className="w-3.5 h-3.5 text-accent" />
                                            <span className="font-semibold text-accent">
                                                {edge.relationship}
                                            </span>
                                            <ArrowRight className="w-3.5 h-3.5 text-accent" />
                                            <span className="font-semibold text-white">
                                                {edge.to.slice(0, 14)}…
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border font-semibold ${classificationInfo?.bg} ${classificationInfo?.text} ${classificationInfo?.border}`}
                                            >
                                                {edge.classification}
                                            </span>
                                            {edge.temporal && (
                                                <span
                                                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                                                        TEMPORAL_BADGES[edge.temporal] || "text-zinc-400"
                                                    }`}
                                                >
                                                    {edge.temporal}
                                                </span>
                                            )}
                                            <span className="text-[10px] text-muted font-mono">
                                                Inspect ↗
                                            </span>
                                        </div>
                                    </div>
                                    {edge.explanation && (
                                        <p className="text-[11px] text-zinc-300 font-sans leading-relaxed">
                                            {edge.explanation}
                                        </p>
                                    )}
                                    {edge.structural && edge.structural.relationType !== "NONE" && (
                                        <div className="p-2 rounded bg-[#080b11] border border-white/5 text-[11px] font-mono text-zinc-300 space-y-0.5">
                                            <div className="text-blue-400 font-semibold flex items-center gap-1">
                                                <Code2 size={11} /> Structural Code Trace
                                            </div>
                                            <div>Location: {edge.structural.filePath}:{edge.structural.lineNumber || 0} ({edge.structural.functionName})</div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {directEdges.length > INITIAL_VISIBLE_DIRECT_EDGES && (
                            <div className="pt-2 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => setShowAllDirectEdges(!showAllDirectEdges)}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-white bg-surface border border-border/80 hover:border-accent/40 hover:bg-surface-hover transition-all"
                                >
                                    {showAllDirectEdges ? (
                                        <>
                                            <ChevronUp className="w-3.5 h-3.5" />
                                            <span>Show less</span>
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown className="w-3.5 h-3.5" />
                                            <span>View all ({directEdges.length})</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Inspectable Causal Edge Telemetry Drawer */}
                {inspectedEdge && (
                    <CausalEdgeInspector
                        edge={inspectedEdge}
                        onClose={() => setInspectedEdge(null)}
                    />
                )}
            </section>

            {/* 2. Complete Multi-Step Causal Cascade Section */}
            <section className="halo-card p-6 border-border space-y-6">
                <div className="border-b border-border pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ListTree className="w-4 h-4 text-accent" />
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                            Multi-Step Causal Cascade
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-secondary">
                            {causalChains.length} reconstructed cascade{causalChains.length === 1 ? "" : "s"}
                        </span>
                    </div>
                </div>

                {causalChains.length === 0 ? (
                    <div className="p-6 rounded-xl bg-surface/50 border border-border text-center space-y-2">
                        <HelpCircle className="w-6 h-6 text-muted mx-auto" />
                        <p className="text-sm font-medium text-zinc-300">
                            No Complete Multi-Step Cascade Reconstructed
                        </p>
                        <p className="text-xs text-secondary max-w-md mx-auto leading-relaxed">
                            {directEdges.length > 0
                                ? "Direct supported causal relationships were identified, but intermediate server-side execution spans or database queries were unobserved, preventing complete end-to-end chain reconstruction."
                                : "Available telemetry did not contain sufficient correlated spans, requests, or stack frames to construct an end-to-end multi-step causal cascade."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Multi-chain tabs if > 1 */}
                        {causalChains.length > 1 && (
                            <div className="flex items-center gap-2 overflow-x-auto pb-2">
                                {causalChains.map((chain, idx) => (
                                    <button
                                        key={chain.id}
                                        onClick={() => setSelectedChainId(chain.id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center gap-2 ${
                                            activeChain?.id === chain.id
                                                ? "bg-accent text-white font-semibold shadow-sm"
                                                : "bg-surface text-secondary hover:text-white border border-border"
                                        }`}
                                    >
                                        <span>Chain #{idx + 1}</span>
                                        <span className="text-[10px] opacity-75">
                                            ({chain.steps.length} steps)
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {activeChain && (
                            <div className="space-y-5">
                                {/* Chain Summary Header */}
                                <div className="p-4 rounded-xl bg-[#080b11] border border-white/10 space-y-2.5">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono uppercase text-muted font-bold">
                                                Chain Classification:
                                            </span>
                                            <span
                                                className={`text-[11px] font-mono px-2 py-0.5 rounded border font-semibold ${
                                                    CLASSIFICATION_BADGES[activeChain.overallClassification]?.bg
                                                } ${CLASSIFICATION_BADGES[activeChain.overallClassification]?.text} ${
                                                    CLASSIFICATION_BADGES[activeChain.overallClassification]?.border
                                                }`}
                                            >
                                                {activeChain.overallClassification}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-mono text-muted">Chain Confidence:</span>
                                            <span className="text-xs font-mono font-bold text-emerald-400">
                                                {Math.round(activeChain.overallConfidence * 100)}%
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                                        {activeChain.explanation}
                                    </p>
                                </div>

                                {/* Step-by-Step Directed Graph */}
                                <div className="space-y-4">
                                    {activeChain.steps.map((step, idx) => {
                                        const edge = step.edgeFromPrevious;
                                        const classificationInfo = edge?.classification
                                            ? CLASSIFICATION_BADGES[edge.classification]
                                            : undefined;

                                        return (
                                            <React.Fragment key={step.evidenceId + idx}>
                                                {/* Connecting Edge Details (between nodes) */}
                                                {edge && (
                                                    <div className="my-2 pl-6 sm:pl-8 border-l-2 border-dashed border-accent/40 space-y-2 py-2">
                                                        <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
                                                            <ArrowDown className="w-3.5 h-3.5 text-accent shrink-0" />
                                                            <span className="font-semibold text-zinc-300">
                                                                {edge.relationship}
                                                            </span>
                                                            {edge.classification && classificationInfo && (
                                                                <span
                                                                    className={`text-[10px] px-1.5 py-0.5 rounded border ${classificationInfo.bg} ${classificationInfo.text} ${classificationInfo.border}`}
                                                                >
                                                                    {edge.classification}
                                                                </span>
                                                            )}
                                                            {edge.temporal && (
                                                                <span
                                                                    className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                                                        TEMPORAL_BADGES[edge.temporal] || "text-zinc-400"
                                                                    }`}
                                                                >
                                                                    {edge.temporal}
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] text-muted">
                                                                Strength: {Math.round((edge.strength ?? edge.confidence) * 100)}%
                                                            </span>
                                                        </div>

                                                        {edge.explanation && (
                                                            <p className="text-[11px] text-secondary leading-relaxed bg-surface/40 p-2 rounded-lg border border-border/50">
                                                                {edge.explanation}
                                                            </p>
                                                        )}

                                                        {/* Structural Code Context if present */}
                                                        {edge.structural && edge.structural.relationType !== "NONE" && (
                                                            <div className="p-2 rounded bg-[#080b11] border border-white/5 text-[11px] font-mono text-zinc-300 space-y-1">
                                                                <div className="flex items-center gap-1.5 text-blue-400 font-semibold">
                                                                    <Code2 size={12} />
                                                                    <span>Structural Code Relationship</span>
                                                                </div>
                                                                {edge.structural.functionName && (
                                                                    <div>Function: <code className="text-accent">{edge.structural.functionName}()</code></div>
                                                                )}
                                                                {edge.structural.filePath && (
                                                                    <div>File: <span className="text-zinc-400">{edge.structural.filePath}:{edge.structural.lineNumber || 0}</span></div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Node Box */}
                                                <div className="p-4 rounded-xl bg-surface border border-border hover:border-accent/40 transition-colors space-y-2">
                                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-5 h-5 rounded-full bg-accent/10 text-accent font-bold text-xs flex items-center justify-center font-mono">
                                                                {idx + 1}
                                                            </span>
                                                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-surface-elevated text-white border border-border">
                                                                {step.service}
                                                            </span>
                                                            <span
                                                                className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                                                                    step.role === "ROOT_CAUSE"
                                                                        ? "bg-red-500/10 text-red-400 border-red-500/20 font-bold"
                                                                        : step.role === "CANDIDATE_CAUSE"
                                                                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20 font-semibold"
                                                                        : step.role === "TRIGGER"
                                                                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20 font-bold"
                                                                        : step.role === "STRUCTURAL_CONTEXT"
                                                                        ? "bg-zinc-800 text-zinc-400 border-zinc-700 font-normal"
                                                                        : step.role === "SYMPTOM"
                                                                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20 font-semibold"
                                                                        : "bg-surface text-muted border-border"
                                                                }`}
                                                            >
                                                                {step.role.replace(/_/g, " ")}
                                                            </span>
                                                        </div>
                                                        <div className="text-[11px] font-mono text-muted">
                                                            T+{Math.round(step.delayMs)}ms • Evidence ID: <code className="text-accent text-[10px]">{step.evidenceId.slice(0, 10)}…</code>
                                                        </div>
                                                    </div>
                                                    <h3 className="text-sm font-semibold text-zinc-100 font-mono">
                                                        {step.title}
                                                    </h3>
                                                </div>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* 2. Evidence-Backed Competing Hypotheses Section */}
            <section className="halo-card p-6 border-border space-y-6">
                <div className="border-b border-border pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Compass className="w-4 h-4 text-accent" />
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                            Evidence-Backed Competing Hypotheses
                        </h2>
                    </div>
                    <span className="text-xs font-mono text-secondary">
                        {hypotheses.length} candidate mechanism{hypotheses.length === 1 ? "" : "s"} evaluated
                    </span>
                </div>

                {hypotheses.length === 0 ? (
                    <div className="p-6 rounded-xl bg-surface/50 border border-border text-center space-y-2">
                        <HelpCircle className="w-6 h-6 text-muted mx-auto" />
                        <p className="text-sm font-medium text-zinc-300">
                            No Hypothesis Candidates Available
                        </p>
                        <p className="text-xs text-secondary max-w-md mx-auto">
                            Collected evidence did not provide sufficient signals to establish competing root-cause candidates.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {hypotheses.map((hyp, idx) => {
                            const isExpanded = expandedHypothesisId === hyp.id;
                            const confidenceLvl = hyp.confidenceLevel || "LOW";

                            return (
                                <div
                                    key={hyp.id}
                                    className={`rounded-xl border transition-all ${
                                        hyp.status === "LEADING" || hyp.status === "VALIDATED"
                                            ? "bg-surface border-accent/40 shadow-sm"
                                            : hyp.status === "REJECTED"
                                            ? "bg-surface/40 border-red-500/20 opacity-80"
                                            : "bg-surface border-border"
                                    }`}
                                >
                                    {/* Header Row */}
                                    <div
                                        onClick={() => setExpandedHypothesisId(isExpanded ? "" : hyp.id)}
                                        className="p-4 cursor-pointer flex items-center justify-between flex-wrap gap-3 hover:bg-surface-hover/30 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs font-mono font-bold text-muted">
                                                #{idx + 1}
                                            </span>
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-sm font-bold text-white">
                                                        {hyp.title}
                                                    </h3>
                                                    <span
                                                        className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-semibold ${
                                                            hyp.status === "LEADING" || hyp.status === "VALIDATED"
                                                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                                : hyp.status === "REJECTED"
                                                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                                                : "bg-surface text-muted border border-border"
                                                        }`}
                                                    >
                                                        {hyp.status}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-secondary leading-snug">
                                                    {hyp.description}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="text-right font-mono">
                                                <span className="text-[10px] text-muted uppercase block">
                                                    Confidence
                                                </span>
                                                <span
                                                    className={`text-xs font-bold ${
                                                        confidenceLvl === "VERY_HIGH" || confidenceLvl === "HIGH"
                                                            ? "text-emerald-400"
                                                            : confidenceLvl === "MEDIUM"
                                                            ? "text-amber-400"
                                                            : "text-zinc-400"
                                                    }`}
                                                >
                                                    {confidenceLvl.replace("_", " ")}
                                                </span>
                                            </div>
                                            {isExpanded ? (
                                                <ChevronUp className="w-4 h-4 text-muted" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4 text-muted" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded Details Breakdown */}
                                    {isExpanded && (
                                        <div className="p-4 pt-0 border-t border-border/60 space-y-4 mt-2">
                                            {/* Ranking & Confidence Explanations */}
                                            {hyp.rankingExplanation && (
                                                <div className="p-3 rounded-lg bg-[#080b11] border border-white/5 text-xs text-zinc-300 space-y-1">
                                                    <span className="text-[10px] font-mono uppercase text-accent font-semibold">
                                                        Ranking Derivation:
                                                    </span>
                                                    <p>{hyp.rankingExplanation}</p>
                                                    {hyp.confidenceExplanation && (
                                                        <p className="text-muted text-[11px] pt-1 border-t border-white/5">
                                                            {hyp.confidenceExplanation}
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                                                {/* Supporting Evidence */}
                                                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                                                    <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase">
                                                        <CheckCircle2 size={13} />
                                                        <span>Supporting ({hyp.supportingReasons.length})</span>
                                                    </div>
                                                    {hyp.supportingReasons.length === 0 ? (
                                                        <p className="text-[11px] text-muted italic">No direct supporting signals.</p>
                                                    ) : (
                                                        <ul className="space-y-1.5 text-xs text-zinc-300">
                                                            {hyp.supportingReasons.map((r, i) => (
                                                                <li key={i} className="flex items-start gap-1.5 leading-relaxed">
                                                                    <span className="text-emerald-400 font-bold">&bull;</span>
                                                                    <div>
                                                                        <span className="font-semibold text-zinc-200">{r.title}:</span>{" "}
                                                                        <span>{r.description}</span>
                                                                    </div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>

                                                {/* Contradicting Evidence */}
                                                <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 space-y-2">
                                                    <div className="flex items-center gap-1.5 text-red-400 text-xs font-bold uppercase">
                                                        <XCircle size={13} />
                                                        <span>Contradicting ({hyp.contradictingReasons.length})</span>
                                                    </div>
                                                    {hyp.contradictingReasons.length === 0 ? (
                                                        <p className="text-[11px] text-zinc-400 italic">No contradictory evidence found.</p>
                                                    ) : (
                                                        <ul className="space-y-1.5 text-xs text-zinc-300">
                                                            {hyp.contradictingReasons.map((r, i) => (
                                                                <li key={i} className="flex items-start gap-1.5 leading-relaxed">
                                                                    <span className="text-red-400 font-bold">&bull;</span>
                                                                    <div>
                                                                        <span className="font-semibold text-red-300">{r.title}:</span>{" "}
                                                                        <span>{r.description}</span>
                                                                    </div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>

                                                {/* Missing Critical Telemetry */}
                                                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-2">
                                                    <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold uppercase">
                                                        <HelpCircle size={13} />
                                                        <span>Missing Telemetry ({hyp.missingReasons.length})</span>
                                                    </div>
                                                    {hyp.missingReasons.length === 0 ? (
                                                        <p className="text-[11px] text-zinc-400 italic">No critical telemetry gaps identified.</p>
                                                    ) : (
                                                        <ul className="space-y-1.5 text-xs text-zinc-300">
                                                            {hyp.missingReasons.map((r, i) => (
                                                                <li key={i} className="flex items-start gap-1.5 leading-relaxed">
                                                                    <span className="text-amber-400 font-bold">&bull;</span>
                                                                    <div>
                                                                        <span className="font-semibold text-amber-300">{r.title}:</span>{" "}
                                                                        <span>{r.description}</span>
                                                                    </div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}

function CausalEdgeInspector({
    edge,
    onClose,
}: {
    edge: EvidenceEdge;
    onClose: () => void;
}) {
    const classificationInfo = edge.classification ? CLASSIFICATION_BADGES[edge.classification] : undefined;

    return (
        <div className="p-4 rounded-xl bg-[#080b11] border border-white/10 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                    <Network size={14} className="text-accent" />
                    <span className="font-semibold text-white">Causal Relationship Telemetry</span>
                    {edge.classification && (
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${classificationInfo?.bg} ${classificationInfo?.text} ${classificationInfo?.border}`}>
                            {edge.classification}
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="text-zinc-500 hover:text-white transition-colors p-1"
                    title="Close inspector"
                >
                    ✕
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 font-mono">
                <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Source Event (From)</span>
                    <span className="text-zinc-200 font-semibold">{edge.from}</span>
                </div>
                <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Target Event (To)</span>
                    <span className="text-zinc-200 font-semibold">{edge.to}</span>
                </div>
                <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Relationship Type</span>
                    <span className="text-accent font-semibold">{edge.relationship}</span>
                </div>
                <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Temporal Relationship</span>
                    <span className="text-zinc-300">{edge.temporal || "NOT_EXPLICIT"}</span>
                </div>
                <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Relationship Strength</span>
                    <span className="text-emerald-400 font-bold">{Math.round((edge.strength ?? edge.confidence) * 100)}%</span>
                </div>
                <div>
                    <span className="text-[10px] text-zinc-500 uppercase block">Evidence Provenance</span>
                    <span className="text-blue-400">{edge.provenance || "sdk"}</span>
                </div>
            </div>

            {edge.explanation && (
                <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500 font-mono uppercase block">Causal Explanation</span>
                    <p className="text-xs text-zinc-300 bg-surface/40 p-2.5 rounded-lg border border-border/50 leading-relaxed font-sans">
                        {edge.explanation}
                    </p>
                </div>
            )}

            {edge.strengthFactors && edge.strengthFactors.length > 0 && (
                <div className="space-y-1.5">
                    <span className="text-[10px] text-zinc-500 font-mono uppercase block">Evidence Factor Breakdown</span>
                    <ul className="space-y-1 bg-surface/30 p-2 rounded-lg border border-border/40 text-[11px] text-zinc-300 font-mono">
                        {edge.strengthFactors.map((f, i) => (
                            <li key={i} className="flex items-center justify-between">
                                <span>{f.factor}:</span>
                                <span className="text-accent">+{Math.round(f.contribution * 100)}%</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {edge.structural && edge.structural.relationType !== "NONE" && (
                <div className="p-3 rounded-lg bg-blue-950/20 border border-blue-500/20 text-xs font-mono text-zinc-300 space-y-1">
                    <div className="flex items-center gap-1.5 text-blue-400 font-semibold">
                        <Code2 size={13} />
                        <span>Code Call Frame / Structural Relation</span>
                    </div>
                    {edge.structural.functionName && (
                        <div>Function: <span className="text-white font-semibold">{edge.structural.functionName}()</span></div>
                    )}
                    {edge.structural.filePath && (
                        <div>File: <span className="text-zinc-400">{edge.structural.filePath}:{edge.structural.lineNumber || 0}</span></div>
                    )}
                </div>
            )}
        </div>
    );
}
