"use client";

import React from "react";
import Link from "next/link";
import {
    ArrowDownRight,
    Layers,
    Radio,
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

    const investigateUrl = `/projects/${projectId || "current"}/investigations/new?service=${encodeURIComponent(selectedEntity)}`;

    return (
        <div className="halo-panel border-accent/30 animate-in fade-in">
            {/* Header */}
            <div className="halo-panel-header">
                <div className="halo-panel-title-group">
                    <div className="halo-dash-icon-box">
                        <Radio size={15} />
                    </div>
                    <div>
                        <h3 className="halo-panel-title">
                            Blast Radius &amp; Failure Propagation: <span className="text-accent">{selectedEntity}</span>
                        </h3>
                        <p className="halo-panel-subtitle">
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
                        className="p-1 text-text-muted hover:text-text cursor-pointer transition-colors"
                        title="Close panel"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* 3-Column Evidence Categories Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Observed Downstream Failure Propagation */}
                <div className="p-4 rounded-xl bg-surface border border-error/30 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-error border-b border-border pb-2">
                        <span>Observed Failure Propagation</span>
                        <span className="font-mono">({observedPropagation.length})</span>
                    </div>

                    {observedPropagation.length === 0 ? (
                        <p className="text-xs text-text-muted leading-relaxed">
                            No downstream services observed propagating active errors.
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {observedPropagation.map((d, i) => (
                                <div
                                    key={i}
                                    className="p-2.5 rounded-lg bg-[#080b11] border border-error/20 space-y-1 text-xs"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-text font-semibold">
                                            <ArrowDownRight size={13} className="text-error shrink-0" />
                                            <span>{d.name}</span>
                                        </div>
                                        <span className="text-error font-semibold font-mono text-[11px]">
                                            {d.observedErrorRate}% err ({d.hops} hop)
                                        </span>
                                    </div>
                                    <span className="text-[11px] text-text-secondary block">
                                        {d.evidence}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. Potential Structural Exposure */}
                <div className="p-4 rounded-xl bg-surface border border-warning/30 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-warning border-b border-border pb-2">
                        <span>Potential Structural Exposure</span>
                        <span className="font-mono">({potentialExposure.length})</span>
                    </div>

                    {potentialExposure.length === 0 ? (
                        <p className="text-xs text-text-muted leading-relaxed">
                            No active connected callers in current traffic graph.
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {potentialExposure.map((p, i) => (
                                <div
                                    key={i}
                                    className="p-2.5 rounded-lg bg-[#080b11] border border-border flex items-center justify-between text-xs"
                                >
                                    <div className="flex items-center gap-1.5 text-text">
                                        <Layers size={13} className="text-warning shrink-0" />
                                        <span className="font-medium">{p.name}</span>
                                    </div>
                                    <span className="text-text-muted text-[11px]">
                                        {p.connectionType}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 3. Unobserved / Isolated */}
                <div className="p-4 rounded-xl bg-surface border border-border space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-text-muted border-b border-border pb-2">
                        <span>Unobserved / Isolated</span>
                        <span className="font-mono">({unobserved.length})</span>
                    </div>

                    {unobserved.length === 0 ? (
                        <p className="text-xs text-text-muted leading-relaxed">
                            All graph nodes share observed connectivity.
                        </p>
                    ) : (
                        <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                            {unobserved.map((u, i) => (
                                <div
                                    key={i}
                                    className="p-1.5 rounded bg-[#080b11] border border-border text-text-muted text-[11px] font-mono"
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
