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
        downstreamImpact,
        potentiallyExposed,
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
                            Observed failure transmission paths and transitive exposure risks.
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
                {/* 1. Directly Affected & Observed Downstream */}
                <div className="p-4 rounded-xl bg-surface border border-red-500/30 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-red-400 uppercase tracking-wider border-b border-border/60 pb-1.5">
                        <span>Observed Downstream Impact</span>
                        <span>({downstreamImpact.length})</span>
                    </div>

                    {downstreamImpact.length === 0 ? (
                        <p className="text-[11px] text-muted font-sans">
                            No downstream services observed propagating active errors.
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {downstreamImpact.map((d, i) => (
                                <div
                                    key={i}
                                    className="p-2 rounded-lg bg-[#080b11] border border-red-500/20 flex items-center justify-between text-[11px]"
                                >
                                    <div className="flex items-center gap-1.5 text-white">
                                        <ArrowDownRight size={12} className="text-red-400" />
                                        <span>{d.name}</span>
                                    </div>
                                    <span className="text-red-400 font-bold">
                                        {d.observedErrorRate}% err ({d.hops} hop)
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. Potentially Exposed */}
                <div className="p-4 rounded-xl bg-surface border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-amber-400 uppercase tracking-wider border-b border-border/60 pb-1.5">
                        <span>Potentially Exposed Callers</span>
                        <span>({potentiallyExposed.length})</span>
                    </div>

                    {potentiallyExposed.length === 0 ? (
                        <p className="text-[11px] text-muted font-sans">
                            No active connected callers in current traffic graph.
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {potentiallyExposed.map((p, i) => (
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
