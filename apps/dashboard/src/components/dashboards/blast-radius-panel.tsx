"use client";

import React from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    ArrowDownRight,
    ArrowRight,
    CheckCircle2,
    Layers,
    Radio,
    ShieldAlert,
    Sparkles,
    X,
} from "lucide-react";
import type { BlastRadiusResult } from "@/lib/analytics/types";

interface BlastRadiusPanelProps {
    blastRadius: BlastRadiusResult;
    projectId?: string;
    onClose: () => void;
}

export function BlastRadiusPanel({ blastRadius, projectId, onClose }: BlastRadiusPanelProps) {
    const {
        selectedEntity,
        directlyAffected,
        observedPropagation,
        potentialExposure,
        unobserved,
    } = blastRadius;

    const investigateUrl = `/projects/${projectId || "current"}/investigations/new?service=${selectedEntity}`;

    return (
        <div className="p-6 rounded-2xl border border-accent/20 bg-surface-elevated space-y-4 font-mono text-xs animate-in fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                        <Radio size={14} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                                Blast Radius &amp; Failure Propagation: {selectedEntity}
                            </h3>
                        </div>
                        <p className="text-[11px] text-muted font-sans">
                            Distinguishes observed downstream failure transmission from structural exposure risk.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Link
                        href={investigateUrl}
                        className="halo-btn halo-btn-primary halo-btn-xs"
                    >
                        <Sparkles size={11} />
                        <span>Investigate Blast Radius</span>
                    </Link>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 text-muted hover:text-white"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Radius Categories Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Observed Downstream Failure Propagation */}
                <div className="p-4 rounded-xl bg-surface border border-red-500/30 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-red-400 uppercase tracking-wider border-b border-border/60 pb-1.5">
                        <span>Observed Failure Propagation</span>
                        <span>({observedPropagation.length})</span>
                    </div>

                    {observedPropagation.length === 0 ? (
                        <p className="text-[11px] text-muted font-sans">
                            No downstream services observed propagating active errors.
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {observedPropagation.map((d, i) => (
                                <div
                                    key={i}
                                    className="p-2 rounded-lg bg-[#080b11] border border-red-500/20 space-y-1 text-[11px]"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-white font-semibold">
                                            <ArrowDownRight size={12} className="text-red-400" />
                                            <span>{d.name}</span>
                                        </div>
                                        <span className="text-red-400 font-bold">
                                            {d.observedErrorRate}% err ({d.hops} hop)
                                        </span>
                                    </div>
                                    <span className="text-[10px] text-zinc-400 block font-sans">
                                        {d.evidence}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. Potential Structural Exposure */}
                <div className="p-4 rounded-xl bg-surface border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-amber-400 uppercase tracking-wider border-b border-border/60 pb-1.5">
                        <span>Potential Structural Exposure</span>
                        <span>({potentialExposure.length})</span>
                    </div>

                    {potentialExposure.length === 0 ? (
                        <p className="text-[11px] text-muted font-sans">
                            No active connected callers in current traffic graph.
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {potentialExposure.map((p, i) => (
                                <div
                                    key={i}
                                    className="p-2 rounded-lg bg-[#080b11] border border-border flex items-center justify-between text-[11px]"
                                >
                                    <div className="flex items-center gap-1.5 text-zinc-200">
                                        <Layers size={12} className="text-amber-400" />
                                        <span>{p.name}</span>
                                    </div>
                                    <span className="text-muted text-[10px]">
                                        {p.connectionType}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 3. Unobserved / Isolated */}
                <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-muted uppercase tracking-wider border-b border-border/60 pb-1.5">
                        <span>Unobserved / Isolated</span>
                        <span>({unobserved.length})</span>
                    </div>

                    {unobserved.length === 0 ? (
                        <p className="text-[11px] text-muted font-sans">
                            All graph nodes share observed connectivity.
                        </p>
                    ) : (
                        <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                            {unobserved.map((u, i) => (
                                <div
                                    key={i}
                                    className="p-1.5 rounded bg-[#080b11] border border-border text-muted text-[10px]"
                                >
                                    {u.name}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
