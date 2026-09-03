"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Waypoints,
    GitCommit,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Split,
    ArrowRight,
    Search,
    ChevronRight,
    Info,
} from "lucide-react";
import type { TraceDivergenceResult, AlignedTraceNode } from "@/lib/explore/trace-divergence";
import type { CanonicalEvidenceRecord } from "@/lib/explore/evidence-types";
import { ExploreHeader } from "./explore-header";
import { DetailDrawer } from "./detail-drawer";
import { ExploreEmptyState } from "./empty-state";
import { RelativeTime } from "@/components/ui/relative-time";

interface TraceDivergenceClientProps {
    divergence: TraceDivergenceResult | null;
    recentTraces: CanonicalEvidenceRecord[];
    currentTraceId?: string;
    currentReferenceId?: string;
}

export function TraceDivergenceClient({
    divergence,
    recentTraces,
    currentTraceId,
    currentReferenceId,
}: TraceDivergenceClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [selectedSpan, setSelectedSpan] = useState<CanonicalEvidenceRecord | null>(null);
    const [manualTraceInput, setManualTraceInput] = useState(currentTraceId || "");
    const [manualRefInput, setManualRefInput] = useState(currentReferenceId || "");

    const handleApplyTraces = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        if (manualTraceInput.trim()) {
            params.set("traceId", manualTraceInput.trim());
        }
        if (manualRefInput.trim()) {
            params.set("refTraceId", manualRefInput.trim());
        }
        router.push(`/explore/traces?${params.toString()}`);
    };

    const handleSelectTrace = (id: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("traceId", id);
        params.delete("refTraceId");
        router.push(`/explore/traces?${params.toString()}`);
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <ExploreHeader
                title="Traces"
                subtitle="Identify where observed execution paths first diverge between two executions."
                icon={Waypoints}
                badgeText={divergence ? `Trace: ${divergence.selectedTraceId.slice(0, 8)}` : undefined}
            />

            {/* Trace Selector Toolbar */}
            <div className="p-3.5 rounded-xl bg-surface border border-border space-y-3">
                <form onSubmit={handleApplyTraces} className="flex items-center gap-2.5 text-xs flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                            type="text"
                            value={manualTraceInput}
                            onChange={(e) => setManualTraceInput(e.target.value)}
                            placeholder="Target Trace ID (failing or selected)..."
                            className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-[#080b11] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent font-mono"
                        />
                    </div>

                    <div className="relative flex-1 min-w-[200px]">
                        <GitCommit size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                            type="text"
                            value={manualRefInput}
                            onChange={(e) => setManualRefInput(e.target.value)}
                            placeholder="Reference Trace ID (optional, auto-detected if empty)..."
                            className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-[#080b11] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent font-mono"
                        />
                    </div>

                    <button type="submit" className="halo-btn halo-btn-primary halo-btn-sm font-sans shrink-0">
                        Find Divergence
                    </button>
                </form>

                {recentTraces.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono pt-1 border-t border-border/60">
                        <span className="text-muted">RECENT TRACES:</span>
                        {recentTraces.slice(0, 6).map((tr) => {
                            const trId = tr.traceId || tr.id;
                            const isActive = trId === divergence?.selectedTraceId;
                            return (
                                <button
                                    key={tr.id}
                                    type="button"
                                    onClick={() => handleSelectTrace(trId)}
                                    className={`px-2 py-0.5 rounded border transition-colors truncate max-w-xs ${
                                        isActive
                                            ? "bg-accent/15 border-accent/40 text-accent font-bold"
                                            : "bg-[#06080e] border-border text-zinc-400 hover:text-white hover:border-zinc-500"
                                    }`}
                                >
                                    {tr.service || "service"} ({trId.slice(0, 8)})
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Main Investigation View */}
            {!divergence ? (
                <ExploreEmptyState
                    type="NO_DATA"
                    title="No trace selected"
                    description="Select a trace from recent executions or enter an exact Trace ID above to identify structural divergence against a successful execution."
                />
            ) : !divergence.traceB ? (
                <ExploreEmptyState
                    type="MISSING_TELEMETRY"
                    title="NO COMPARABLE REFERENCE TRACE FOUND"
                    description={`No successful execution matching service "${divergence.service}" and operation "${divergence.operation}" was found in telemetry.`}
                    action={
                        <span className="text-xs text-muted font-mono">
                            Tip: Manually specify a reference trace ID in the toolbar above.
                        </span>
                    }
                />
            ) : (
                <div className="space-y-5">
                    {/* Comparison KPI Header */}
                    <div className="halo-metric-strip grid-cols-2 sm:grid-cols-4">
                        <div className="halo-metric-cell space-y-1">
                            <span className="text-[10px] text-muted uppercase font-semibold font-mono">
                                Target Trace A
                            </span>
                            <span className="text-sm font-bold text-white block font-mono truncate">
                                {divergence.traceA.id}
                            </span>
                            <span className="text-[11px] text-secondary font-sans">
                                {divergence.traceA.totalDurationMs}ms • {divergence.traceA.spans.length} spans
                            </span>
                        </div>

                        <div className="halo-metric-cell space-y-1">
                            <span className="text-[10px] text-muted uppercase font-semibold font-mono">
                                Reference Trace B
                            </span>
                            <span className="text-sm font-bold text-emerald-400 block font-mono truncate">
                                {divergence.traceB.id}
                            </span>
                            <span className="text-[11px] text-secondary font-sans">
                                {divergence.traceB.totalDurationMs}ms • {divergence.traceB.spans.length} spans
                            </span>
                        </div>

                        <div className="halo-metric-cell space-y-1">
                            <span className="text-[10px] text-muted uppercase font-semibold font-mono">
                                Execution Divergence
                            </span>
                            <span className="text-sm font-bold text-amber-400 block font-sans">
                                {divergence.firstDivergence ? divergence.firstDivergence.divergenceType : "None observed"}
                            </span>
                            <span className="text-[11px] text-secondary font-sans">
                                {divergence.firstDivergence ? "Paths first differ here" : "Identical topology"}
                            </span>
                        </div>

                        <div className="halo-metric-cell space-y-1">
                            <span className="text-[10px] text-muted uppercase font-semibold font-mono">
                                Reference Quality
                            </span>
                            <span className="text-xs text-white block font-sans font-bold">
                                {divergence.referenceQuality} Quality
                            </span>
                            <span className="text-[11px] text-secondary font-sans truncate" title={divergence.referenceQualityReasons.join(", ")}>
                                {divergence.referenceQualityReasons[0] || "Matching telemetry"}
                            </span>
                        </div>
                    </div>

                    {/* Limited Depth Warning if 1-span trace */}
                    {divergence.sufficiency.status === "LIMITED" && (
                        <div className="p-3.5 rounded-xl bg-surface border border-border text-xs font-mono space-y-1">
                            <div className="flex items-center gap-2 text-zinc-300 font-semibold">
                                <Info size={14} className="text-cyan-400 shrink-0" />
                                <span>OBSERVED PATHS MATCH WITH LIMITED CAPTURED SPAN DEPTH</span>
                            </div>
                            <p className="text-muted text-[11px] font-sans">
                                {divergence.sufficiency.reasons[0] || "Only one span was captured in each execution. Downstream spans were not instrumented or emitted."}
                            </p>
                        </div>
                    )}

                    {/* First Observed Divergence Highlight Banner */}
                    {divergence.firstDivergence && (
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    FIRST OBSERVED DIVERGENCE
                                </span>
                                <span className="text-xs text-amber-300 font-sans font-semibold">
                                    Execution paths first differ here (Span #{divergence.firstDivergence.index + 1})
                                </span>
                            </div>
                            <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                                {divergence.firstDivergence.divergenceExplanation}
                            </p>
                            <p className="text-[11px] text-muted font-sans">
                                NOTE: First divergence indicates where execution paths first differ chronologically; it does not assert root causality.
                            </p>
                        </div>
                    )}

                    {/* Aligned Spans Table / Dual Tree */}
                    <div className="rounded-xl bg-surface border border-border overflow-hidden">
                        <div className="p-3 bg-[#06080e] border-b border-border grid grid-cols-12 gap-3 text-[11px] font-mono font-semibold uppercase text-muted">
                            <div className="col-span-1">#</div>
                            <div className="col-span-5">Trace A (Target Execution)</div>
                            <div className="col-span-5">Trace B (Comparable Reference)</div>
                            <div className="col-span-1 text-right">Inspect</div>
                        </div>

                        <div className="divide-y divide-border/40 font-mono text-xs">
                            {divergence.alignedNodes.map((pair) => (
                                <div
                                    key={pair.index}
                                    className={`p-3 grid grid-cols-12 gap-3 items-center transition-colors ${
                                        pair.isFirstDivergence
                                            ? "bg-amber-500/10 border-l-4 border-l-amber-400"
                                            : pair.divergenceType !== "NONE"
                                            ? "bg-red-500/5"
                                            : "hover:bg-surface-elevated"
                                    }`}
                                >
                                    <div className="col-span-1 text-[11px] text-muted">
                                        #{pair.index + 1}
                                    </div>

                                    {/* Span A */}
                                    <div className="col-span-5 min-w-0">
                                        {pair.spanA ? (
                                            <div
                                                onClick={() => setSelectedSpan(pair.spanA)}
                                                className="cursor-pointer hover:text-accent truncate"
                                            >
                                                <div className="flex items-center gap-1.5 truncate">
                                                    <span className="font-semibold text-white truncate">
                                                        {pair.spanA.operation || pair.spanA.title}
                                                    </span>
                                                    {pair.spanA.status && (
                                                        <span className="text-[10px] text-zinc-400">
                                                            [{pair.spanA.status}]
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-muted">
                                                    {pair.spanA.service} • {pair.spanA.durationMs || 0}ms
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-zinc-600 italic text-[11px]">
                                                [Span not executed in Trace A]
                                            </span>
                                        )}
                                    </div>

                                    {/* Span B */}
                                    <div className="col-span-5 min-w-0">
                                        {pair.spanB ? (
                                            <div
                                                onClick={() => setSelectedSpan(pair.spanB)}
                                                className="cursor-pointer hover:text-emerald-400 truncate"
                                            >
                                                <div className="flex items-center gap-1.5 truncate">
                                                    <span className="font-semibold text-emerald-300 truncate">
                                                        {pair.spanB.operation || pair.spanB.title}
                                                    </span>
                                                    {pair.spanB.status && (
                                                        <span className="text-[10px] text-zinc-400">
                                                            [{pair.spanB.status}]
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-muted">
                                                    {pair.spanB.service} • {pair.spanB.durationMs || 0}ms
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-zinc-600 italic text-[11px]">
                                                [Span not executed in Trace B]
                                            </span>
                                        )}
                                    </div>

                                    {/* Inspect button */}
                                    <div className="col-span-1 text-right">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedSpan(pair.spanA || pair.spanB)}
                                            className="halo-btn halo-btn-xs halo-btn-secondary text-[10px]"
                                        >
                                            View
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Drawer */}
            <DetailDrawer
                record={selectedSpan}
                provenance={divergence?.provenance}
                onClose={() => setSelectedSpan(null)}
            />
        </div>
    );
}
