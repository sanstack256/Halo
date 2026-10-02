"use client";

import React, { useState } from "react";
import { type IncidentComparisonResult } from "@/lib/investigation/incident-memory/similarity-engine";
import { History, AlertTriangle, ArrowRight, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";

interface SimilarIncidentCardProps {
    match: IncidentComparisonResult;
    onInspect?: (investigationId: string) => void;
}

export function SimilarIncidentCard({ match, onInspect }: SimilarIncidentCardProps) {
    const [expanded, setExpanded] = useState(false);

    const getBadgeStyle = (classification: string) => {
        switch (classification) {
            case "STRONG_STRUCTURAL_MATCH":
                return "bg-purple-950/60 border-purple-500/40 text-purple-300";
            case "MODERATE_STRUCTURAL_MATCH":
                return "bg-cyan-950/60 border-cyan-500/40 text-cyan-300";
            case "WEAK_PARTIAL_MATCH":
                return "bg-zinc-800/80 border-zinc-700 text-zinc-300";
            default:
                return "bg-zinc-900 border-zinc-800 text-zinc-400";
        }
    };

    return (
        <div className="bg-zinc-950/60 border border-zinc-800/80 rounded-lg p-4 space-y-3.5 hover:border-zinc-700 transition-all">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider font-semibold ${getBadgeStyle(match.classification)}`}>
                            {match.classification.replace(/_/g, " ")}
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">
                            {match.score}% Structural Overlap
                        </span>
                    </div>
                    <h4 className="text-sm font-medium text-zinc-200">
                        {match.historicalTitle}
                    </h4>
                </div>

                {onInspect && (
                    <button
                        onClick={() => onInspect(match.historicalInvestigationId)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono transition-colors"
                    >
                        <span>Inspect</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Explanation Narrative */}
            <p className="text-xs text-zinc-400 leading-relaxed bg-zinc-900/40 border border-zinc-800/50 p-2.5 rounded">
                {match.explanation}
            </p>

            {/* Same symptom, different cause callout */}
            {match.symptomMatchWithDifferentCause && (
                <div className="bg-amber-950/30 border border-amber-500/30 rounded p-2.5 flex items-start gap-2.5 text-amber-300 text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                        <span className="font-semibold block">Same Symptom, Differing Causality</span>
                        <p className="text-[11px] text-amber-200/80">
                            Surface services and operations match, but historical causal path diverges from current telemetry. Historical resolution must not be blindly assumed as the current cause.
                        </p>
                    </div>
                </div>
            )}

            {/* Matches vs Differences Chip Matrix */}
            <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Matches ({match.matchingDimensions.length})
                    </span>
                    <div className="flex flex-wrap gap-1">
                        {match.matchingDimensions.map((dim) => (
                            <span
                                key={dim}
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-300"
                            >
                                {dim}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-zinc-400" /> Differences ({match.differingDimensions.length})
                    </span>
                    <div className="flex flex-wrap gap-1">
                        {match.differingDimensions.length > 0 ? (
                            match.differingDimensions.map((dim) => (
                                <span
                                    key={dim}
                                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700/60 text-zinc-400"
                                >
                                    {dim}
                                </span>
                            ))
                        ) : (
                            <span className="text-[10px] text-zinc-500 font-mono italic">None</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Historical Root Cause vs Current Telemetry */}
            <div className="border-t border-zinc-850 pt-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-zinc-400">
                    <History className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Historical Root Cause:</span>
                    <span className="text-zinc-200 font-mono">
                        {match.historicalRootCause || "Unresolved (Uncertain)"}
                    </span>
                </div>
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 font-mono underline"
                >
                    {expanded ? "Hide Details" : "Show Details"}
                </button>
            </div>

            {/* Expanded Historical Evidence & Peer Verdicts */}
            {expanded && (
                <div className="space-y-3 pt-2 border-t border-zinc-850 text-xs text-zinc-300 animate-in fade-in duration-200">
                    {/* Signals breakdown */}
                    <div className="space-y-1.5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                            Evidence Dimension Breakdown
                        </span>
                        <div className="space-y-1">
                            {match.signals.map((sig, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-[11px] font-mono">
                                    <span className={sig.isMatch ? "text-emerald-400" : "text-zinc-500"}>
                                        {sig.isMatch ? "✓" : "✗"}
                                    </span>
                                    <span className="text-zinc-400">{sig.dimension}:</span>
                                    <span className="text-zinc-300">{sig.description}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Historical Peer Verdicts */}
                    {match.historicalVerdicts && match.historicalVerdicts.length > 0 && (
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                                Historical Team Peer Verdicts
                            </span>
                            <div className="space-y-1">
                                {match.historicalVerdicts.map((v: any, idx: number) => (
                                    <div key={idx} className="bg-zinc-900/50 p-2 rounded border border-zinc-800/40 text-[11px]">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-zinc-200">{v.authorName}</span>
                                            <span className="font-mono text-[10px] uppercase text-indigo-300 font-semibold">{v.verdict}</span>
                                        </div>
                                        {v.reasoning && <p className="text-zinc-400 mt-0.5">{v.reasoning}</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Historical Recommendations */}
                    {match.historicalRecommendations && match.historicalRecommendations.length > 0 && (
                        <div className="space-y-1.5">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                                Previous Investigation Recommendations
                            </span>
                            <div className="space-y-1">
                                {match.historicalRecommendations.map((r: any, idx: number) => (
                                    <div key={idx} className="bg-indigo-950/20 border border-indigo-500/20 p-2 rounded text-[11px]">
                                        <span className="text-[10px] font-mono text-indigo-400 block">Historical Recommendation #{idx + 1}</span>
                                        <p className="text-zinc-300 mt-0.5">
                                            {typeof r.content === "string" ? r.content : r.content?.title || JSON.stringify(r.content)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
