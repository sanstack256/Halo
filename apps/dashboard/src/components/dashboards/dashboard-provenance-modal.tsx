"use client";

import React from "react";
import { CheckCircle2, Database, Info, Layers, ShieldCheck, X } from "lucide-react";
import type { DataProvenance } from "@/lib/analytics/types";
import { formatDeterministicDateTime } from "@/lib/date-format";

interface DashboardProvenanceModalProps {
    provenance: DataProvenance;
    onClose: () => void;
}

export function DashboardProvenanceModal({ provenance, onClose }: DashboardProvenanceModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in duration-150">
            <div
                className="relative w-full max-w-xl rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] p-6 shadow-2xl space-y-6 text-xs font-mono max-h-[90vh] overflow-y-auto"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border pb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                            <Info size={16} />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                                Analytical Provenance &amp; Methodology
                            </h2>
                            <p className="text-[11px] text-zinc-400 font-sans">
                                Transparent telemetry lineage and mathematical derivation rules.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-zinc-500 hover:text-white p-1"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Scope & Sources Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                        <span className="text-[10px] text-muted uppercase block">Target Scope</span>
                        <div className="text-white font-semibold">{provenance.projectName || "All Organization Projects"}</div>
                        <div className="text-secondary text-[11px]">Env: {provenance.environment}</div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                        <span className="text-[10px] text-muted uppercase block">Data Quality Rating</span>
                        <div className="flex items-center gap-2">
                            <span
                                className={`w-2 h-2 rounded-full ${
                                    provenance.dataQuality === "Complete"
                                        ? "bg-emerald-400"
                                        : provenance.dataQuality === "Partial"
                                        ? "bg-amber-400"
                                        : "bg-red-400"
                                }`}
                            />
                            <span className="text-white font-semibold">{provenance.dataQuality}</span>
                        </div>
                        <div className="text-secondary text-[11px]">
                            {provenance.totalEventsAnalyzed} events evaluated
                        </div>
                    </div>
                </div>

                {/* Time Windows */}
                <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                    <div className="text-[11px] font-semibold text-white uppercase tracking-wider border-b border-border/60 pb-2">
                        Evaluated Time Intervals
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                        <div className="flex justify-between">
                            <span className="text-muted">Primary Window:</span>
                            <span className="text-white font-medium">
                                {formatDeterministicDateTime(new Date(provenance.timeRange.start))} &rarr;{" "}
                                {formatDeterministicDateTime(new Date(provenance.timeRange.end))}
                            </span>
                        </div>

                        {provenance.comparisonRange && (
                            <div className="flex justify-between">
                                <span className="text-muted">Comparison Window:</span>
                                <span className="text-accent font-medium">
                                    {formatDeterministicDateTime(new Date(provenance.comparisonRange.start))} &rarr;{" "}
                                    {formatDeterministicDateTime(new Date(provenance.comparisonRange.end))}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Data Sources */}
                <div className="space-y-2">
                    <span className="text-[10px] text-muted uppercase block">Telemetry Data Sources</span>
                    <div className="flex flex-wrap gap-2">
                        {provenance.sources.map((src, i) => (
                            <span
                                key={i}
                                className="px-2.5 py-1 rounded-lg bg-surface border border-border text-zinc-300 flex items-center gap-1.5"
                            >
                                <Database size={11} className="text-accent" />
                                <span>{src}</span>
                            </span>
                        ))}
                    </div>
                </div>

                {/* Calculation Methodology */}
                <div className="p-4 rounded-xl bg-surface border border-border space-y-1.5">
                    <span className="text-[10px] text-muted uppercase block">Methodology &amp; Formula</span>
                    <p className="text-zinc-300 text-[11px] leading-relaxed font-sans">
                        {provenance.methodology}
                    </p>
                </div>

                {/* Footer Timestamp */}
                <div className="flex items-center justify-between text-[10px] text-muted border-t border-border pt-3">
                    <span>Generated by Halo Analytical Engine</span>
                    <span>Last calculated: {formatDeterministicDateTime(new Date(provenance.lastCalculatedAt))}</span>
                </div>
            </div>
        </div>
    );
}
