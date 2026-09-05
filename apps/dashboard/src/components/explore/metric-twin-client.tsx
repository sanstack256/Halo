"use client";

import React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, Activity, Zap, Layers, Clock, ArrowRight, CheckCircle2, AlertTriangle, ArrowUpRight, Info } from "lucide-react";
import type { MetricShapeTwinResult, MetricKey } from "@/lib/explore/metric-twin";
import { ExploreHeader } from "./explore-header";
import { RelativeTime } from "@/components/ui/relative-time";
import { formatDeterministicTime, formatDeterministicDate } from "@/lib/date-format";
import { ExploreEmptyState } from "./empty-state";

interface MetricTwinClientProps {
    data: MetricShapeTwinResult;
    currentMetric: MetricKey;
    currentTimeRange: string;
}

export function MetricTwinClient({
    data,
    currentMetric,
    currentTimeRange,
}: MetricTwinClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleSelectMetric = (metric: MetricKey) => {
        const searchStr = typeof window !== "undefined" ? window.location.search : searchParams.toString();
        const params = new URLSearchParams(searchStr);
        params.set("metric", metric);
        if (typeof window !== "undefined") {
            window.location.href = `/explore/metrics?${params.toString()}`;
        } else {
            router.push(`/explore/metrics?${params.toString()}`);
        }
    };

    const handleSelectWindow = (windowStr: string) => {
        const searchStr = typeof window !== "undefined" ? window.location.search : searchParams.toString();
        const params = new URLSearchParams(searchStr);
        params.set("timeRange", windowStr);
        if (typeof window !== "undefined") {
            window.location.href = `/explore/metrics?${params.toString()}`;
        } else {
            router.push(`/explore/metrics?${params.toString()}`);
        }
    };

    const isInsufficient = data.sufficiency.status === "INSUFFICIENT";

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <ExploreHeader
                title="Metrics"
                subtitle="Determine whether the current metric behavior resembles a previously observed behavioral shape."
                icon={BarChart3}
                badgeText={`${data.metricLabel} • ${currentTimeRange}`}
            />

            {/* Metric & Window Selector */}
            <div className="p-3.5 rounded-xl bg-surface border border-border flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Metric Type Selector */}
                <div className="flex items-center gap-2">
                    <span className="text-muted font-mono uppercase font-semibold text-[10px]">
                        Target Metric:
                    </span>
                    <div className="flex items-center gap-1.5 font-mono">
                        <button
                            type="button"
                            onClick={() => handleSelectMetric("errors")}
                            className={`px-2.5 py-1 rounded border transition-colors ${
                                currentMetric === "errors"
                                    ? "bg-accent/15 border-accent text-accent font-bold"
                                    : "bg-[#06080e] border-border text-zinc-400 hover:text-white"
                            }`}
                        >
                            Error Frequency
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSelectMetric("latency")}
                            className={`px-2.5 py-1 rounded border transition-colors ${
                                currentMetric === "latency"
                                    ? "bg-accent/15 border-accent text-accent font-bold"
                                    : "bg-[#06080e] border-border text-zinc-400 hover:text-white"
                            }`}
                        >
                            P95 Latency
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSelectMetric("throughput")}
                            className={`px-2.5 py-1 rounded border transition-colors ${
                                currentMetric === "throughput"
                                    ? "bg-accent/15 border-accent text-accent font-bold"
                                    : "bg-[#06080e] border-border text-zinc-400 hover:text-white"
                            }`}
                        >
                            Throughput
                        </button>
                    </div>
                </div>

                {/* Window Selector */}
                <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-muted text-[10px] uppercase">Window:</span>
                    {["1h", "6h", "24h", "7d"].map((w) => (
                        <button
                            key={w}
                            type="button"
                            onClick={() => handleSelectWindow(w)}
                            className={`px-2 py-0.5 rounded border text-[11px] ${
                                currentTimeRange === w
                                    ? "bg-surface-elevated border-accent text-white font-bold"
                                    : "bg-[#06080e] border-border text-zinc-500 hover:text-zinc-300"
                            }`}
                        >
                            {w}
                        </button>
                    ))}
                </div>
            </div>

            {/* If Insufficient Samples: STOP and display explicit INSUFFICIENT SHAPE DATA */}
            {isInsufficient ? (
                <ExploreEmptyState
                    type="INSUFFICIENT"
                    title="INSUFFICIENT SHAPE DATA"
                    description={data.sufficiency.reasons[0] || "Current interval does not contain enough data points to mathematically extract a behavioral shape or compute contour similarity."}
                    action={
                        <button
                            type="button"
                            onClick={() => handleSelectWindow("7d")}
                            className="halo-btn halo-btn-sm halo-btn-primary"
                        >
                            Expand Time Window to 7d
                        </button>
                    }
                />
            ) : (
                <>
                    {/* Current Behavior Surface vs Best Historical Twin */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                        {/* Current Window Shape Card */}
                        <div className="p-5 rounded-xl bg-surface border border-border space-y-4">
                            <div className="flex items-center justify-between border-b border-border pb-2">
                                <div>
                                    <span className="text-[10px] font-mono uppercase font-bold text-accent block">
                                        CURRENT INTERVAL BEHAVIOR
                                    </span>
                                    <span className="text-xs text-muted font-mono">
                                        {formatDeterministicTime(data.currentWindow.startTime, "UTC", false)} – {formatDeterministicTime(data.currentWindow.endTime, "UTC", false)} UTC
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-lg font-bold text-white font-mono block">
                                        Peak: {data.currentWindow.peakValue} {data.unit}
                                    </span>
                                    <span className="text-[10px] text-secondary font-mono">
                                        Avg: {data.currentWindow.avgValue} {data.unit}
                                    </span>
                                </div>
                            </div>

                            {/* Shape Trajectory Bars */}
                            <div className="p-4 rounded-lg bg-[#04060a] border border-border space-y-2">
                                <div className="flex items-end gap-1.5 h-24 pt-2">
                                    {data.currentWindow.points.map((pt, idx) => {
                                        const hasTelemetry = pt.sampleCount > 0;
                                        const heightPct =
                                            hasTelemetry && data.currentWindow.peakValue > 0
                                                ? Math.max(12, Math.round((pt.value / data.currentWindow.peakValue) * 100))
                                                : 6;
                                        return (
                                            <div
                                                key={idx}
                                                style={{ height: `${heightPct}%` }}
                                                title={
                                                    hasTelemetry
                                                        ? `${formatDeterministicTime(pt.timestamp, "UTC", false)} UTC: ${pt.value} ${data.unit} (${pt.sampleCount} ${pt.sampleCount === 1 ? "sample" : "samples"})`
                                                        : `${formatDeterministicTime(pt.timestamp, "UTC", false)} UTC: No observed telemetry (0 samples)`
                                                }
                                                className={`flex-1 rounded-t transition-all cursor-pointer ${
                                                    hasTelemetry
                                                        ? "bg-accent/70 hover:bg-accent"
                                                        : "bg-zinc-800/40 hover:bg-zinc-700/50 border-t border-dashed border-zinc-600/60"
                                                }`}
                                            />
                                        );
                                    })}
                                </div>
                                <div className="flex items-center justify-between text-[10px] font-mono text-muted pt-1 border-t border-border/40">
                                    <span>{formatDeterministicTime(data.currentWindow.startTime, "UTC", false)}</span>
                                    <span>Current Shape Trajectory</span>
                                    <span>{formatDeterministicTime(data.currentWindow.endTime, "UTC", false)}</span>
                                </div>
                            </div>

                            {data.currentWindow.features && (
                                <div className="p-3 rounded-lg bg-[#06080e] border border-border text-xs font-sans space-y-1">
                                    <span className="text-[10px] font-mono text-muted uppercase block font-semibold">
                                        Identified Behavioral Shape
                                    </span>
                                    <p className="text-zinc-200">
                                        Dynamic: <strong className="text-white">{data.currentWindow.features.description}</strong>. Trend: <span className="text-accent">{data.currentWindow.features.trend}</span>.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Best Historical Match (Shape Twin) Card */}
                        <div className="p-5 rounded-xl bg-surface border border-border space-y-4">
                            <div className="flex items-center justify-between border-b border-border pb-2">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-mono uppercase font-bold text-emerald-400 block">
                                            CLOSEST HISTORICAL SHAPE TWIN
                                        </span>
                                        {data.bestTwin && (
                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                                {data.bestTwin.similarity}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs text-muted font-mono">
                                        {data.bestTwin
                                            ? `${formatDeterministicDate(data.bestTwin.startTime, "UTC")} ${formatDeterministicTime(data.bestTwin.startTime, "UTC", false)} UTC`
                                            : "No historical match"}
                                    </span>
                                </div>
                                <div className="text-right">
                                    {data.bestTwin && (
                                        <>
                                            <span className="text-sm font-bold text-white font-mono block">
                                                Contour Dist: {data.bestTwin.contourDistance}
                                            </span>
                                            <span className="text-[10px] text-zinc-400 font-mono">
                                                {data.bestTwin.correlatedEventsCount} events in window
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {data.bestTwin ? (
                                <>
                                    <div className="p-4 rounded-lg bg-[#04060a] border border-border space-y-2">
                                        <div className="flex items-end gap-1.5 h-24 pt-2">
                                            {data.bestTwin.points.map((pt, idx) => {
                                                const peak = Math.max(...data.bestTwin!.points.map((p) => p.value), 1);
                                                const hasTelemetry = pt.sampleCount > 0;
                                                const heightPct =
                                                    hasTelemetry && peak > 0
                                                        ? Math.max(12, Math.round((pt.value / peak) * 100))
                                                        : 6;
                                                return (
                                                    <div
                                                        key={idx}
                                                        style={{ height: `${heightPct}%` }}
                                                        title={
                                                            hasTelemetry
                                                                ? `${formatDeterministicTime(pt.timestamp, "UTC", false)} UTC: ${pt.value} (${pt.sampleCount} ${pt.sampleCount === 1 ? "sample" : "samples"})`
                                                                : `${formatDeterministicTime(pt.timestamp, "UTC", false)} UTC: No observed telemetry (0 samples)`
                                                        }
                                                        className={`flex-1 rounded-t transition-all cursor-pointer ${
                                                            hasTelemetry
                                                                ? "bg-emerald-500/70 hover:bg-emerald-400"
                                                                : "bg-zinc-800/40 hover:bg-zinc-700/50 border-t border-dashed border-zinc-600/60"
                                                        }`}
                                                    />
                                                );
                                            })}
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] font-mono text-muted pt-1 border-t border-border/40">
                                            <span>{formatDeterministicTime(data.bestTwin.startTime, "UTC", false)}</span>
                                            <span>Historical Contour Trajectory</span>
                                            <span>{formatDeterministicTime(data.bestTwin.endTime, "UTC", false)}</span>
                                        </div>
                                    </div>

                                    {/* Separate Shape Similarity from Event Correlation */}
                                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                        <div className="p-2.5 rounded bg-[#06080e] border border-border space-y-0.5">
                                            <span className="text-[10px] text-muted uppercase block">Shape Match</span>
                                            <span className="text-white font-bold">{data.bestTwin.similarity}</span>
                                        </div>
                                        <div className="p-2.5 rounded bg-[#06080e] border border-border space-y-0.5">
                                            <span className="text-[10px] text-muted uppercase block">Correlated Events</span>
                                            <span className="text-emerald-400 font-bold">{data.bestTwin.correlatedEventsCount} observed</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="py-12 text-center text-muted font-mono text-xs">
                                    No historical window found matching this trajectory.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Historical Windows Comparison Table */}
                    {data.historicalTwins.length > 0 && (
                        <div className="rounded-xl bg-surface border border-border overflow-hidden">
                            <div className="p-3 bg-[#06080e] border-b border-border flex items-center justify-between text-xs font-mono">
                                <span className="text-muted uppercase font-semibold">
                                    EVALUATED HISTORICAL LOOKBACK INTERVALS ({data.historicalTwins.length})
                                </span>
                                <span className="text-secondary text-[11px]">Ranked by normalized contour distance</span>
                            </div>

                            <div className="divide-y divide-border/40 font-mono text-xs">
                                {data.historicalTwins.map((twin) => (
                                    <div
                                        key={twin.intervalId}
                                        className="p-3.5 flex items-center justify-between gap-4 hover:bg-surface-elevated transition-colors"
                                    >
                                        <div className="space-y-0.5">
                                            <div className="text-white font-semibold flex items-center gap-2">
                                                <span>
                                                    {formatDeterministicDate(twin.startTime, "UTC")} {formatDeterministicTime(twin.startTime, "UTC", false)} – {formatDeterministicTime(twin.endTime, "UTC", false)} UTC
                                                </span>
                                                <span className="text-muted text-[11px] font-sans">
                                                    (<RelativeTime date={twin.startTime} />)
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-zinc-300 font-sans">
                                                {twin.explanation}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-4 shrink-0">
                                            <div className="text-right">
                                                <span className="text-[10px] uppercase text-muted block">Distance</span>
                                                <span className="text-white font-bold">{twin.contourDistance}</span>
                                            </div>

                                            <span
                                                className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                                                    twin.similarity === "STRONG MATCH"
                                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                                        : twin.similarity === "MODERATE MATCH"
                                                        ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                                                        : "bg-zinc-800 text-zinc-400 border-zinc-700"
                                                }`}
                                            >
                                                {twin.similarity}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
