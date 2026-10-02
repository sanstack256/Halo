"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
    Flame,
    BarChart3,
    Activity,
    AlertTriangle,
    Clock,
    RefreshCw,
    HelpCircle,
    Info,
} from "lucide-react";
import {
    getFailureHeatmap,
    type ServiceFailureHeatmap,
    type HeatmapCell,
} from "@/actions/topology";
import Link from "next/link";

interface Props {
    projectId: string;
    isTeamPlan: boolean;
    initialTimeRangeKey?: string;
    environment?: string;
}

export function FailureHeatmapView({
    projectId,
    isTeamPlan,
    initialTimeRangeKey = "24h",
    environment = "ALL",
}: Props) {
    const [timeRangeKey, setTimeRangeKey] = useState(initialTimeRangeKey);
    const [metric, setMetric] = useState<"ERROR_RATE" | "FAILURE_COUNT" | "LATENCY_P95">("ERROR_RATE");
    const [heatmap, setHeatmap] = useState<ServiceFailureHeatmap | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

    const fetchHeatmap = React.useCallback(async () => {
        if (!isTeamPlan) return;
        setLoading(true);
        setError(null);
        try {
            const data = await getFailureHeatmap({
                projectId,
                timeRangeKey,
                metric,
                environment,
            });
            setHeatmap(data);
        } catch (err: any) {
            setError(err.message || "Failed to load failure heatmap");
        } finally {
            setLoading(false);
        }
    }, [projectId, timeRangeKey, metric, environment, isTeamPlan]);

    useEffect(() => {
        fetchHeatmap();
    }, [fetchHeatmap]);

    // Calculate max value for coloring
    const maxValue = useMemo(() => {
        if (!heatmap || heatmap.cells.length === 0) return 1;
        if (metric === "ERROR_RATE") return 1.0;
        let max = 0;
        for (const c of heatmap.cells) {
            const val = metric === "FAILURE_COUNT" ? c.failedRequests : c.p95LatencyMs || 0;
            if (val > max) max = val;
        }
        return max > 0 ? max : 1;
    }, [heatmap, metric]);

    // Color intensity mapping
    const getCellColor = (cell: HeatmapCell) => {
        if (cell.totalRequests === 0) {
            return "bg-[#18191d] border-zinc-800/40 text-zinc-600";
        }

        if (metric === "ERROR_RATE") {
            const rate = cell.errorRate || 0;
            if (rate === 0) return "bg-emerald-950/20 border-emerald-900/30 text-emerald-500";
            if (rate < 0.05) return "bg-yellow-950/40 border-yellow-800/40 text-yellow-400";
            if (rate < 0.20) return "bg-amber-950/60 border-amber-700/50 text-amber-300";
            return "bg-rose-950/80 border-rose-600/60 text-rose-300 font-bold";
        }

        if (metric === "FAILURE_COUNT") {
            const count = cell.failedRequests;
            if (count === 0) return "bg-[#18191d] border-zinc-800/60 text-zinc-500";
            const ratio = count / maxValue;
            if (ratio < 0.25) return "bg-rose-950/30 border-rose-900/30 text-rose-400";
            if (ratio < 0.60) return "bg-rose-950/60 border-rose-800/50 text-rose-300";
            return "bg-rose-900/80 border-rose-600 text-rose-200 font-bold";
        }

        // LATENCY_P95
        const lat = cell.p95LatencyMs || 0;
        if (lat === 0) return "bg-[#18191d] border-zinc-800/60 text-zinc-500";
        const ratio = lat / maxValue;
        if (ratio < 0.3) return "bg-indigo-950/30 border-indigo-900/30 text-indigo-400";
        if (ratio < 0.7) return "bg-amber-950/50 border-amber-800/40 text-amber-300";
        return "bg-rose-950/70 border-rose-700/60 text-rose-200 font-bold";
    };

    if (!isTeamPlan) {
        return (
            <div className="bg-[#121316] border border-amber-800/40 rounded-xl p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-amber-950/40 border border-amber-700/50 flex items-center justify-center mx-auto text-amber-400">
                    <Flame size={24} />
                </div>
                <h3 className="text-base font-semibold text-white">Cross-Service Failure Heatmaps</h3>
                <p className="text-xs text-zinc-400 max-w-lg mx-auto leading-relaxed">
                    Traffic-normalized failure concentration matrix across time windows and services. Isolate exactly when and where systemic failures originated without distortion from traffic volume. Available on the <strong>Team Plan</strong>.
                </p>
                <div className="pt-2">
                    <Link
                        href="/settings/billing"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold transition"
                    >
                        Upgrade to Team Plan
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#121316] border border-[#27272a] rounded-xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-[#27272a] flex flex-wrap items-center justify-between gap-3 bg-[#18191d]">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-950/60 border border-rose-800/40 flex items-center justify-center text-rose-400">
                        <Flame size={16} />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            Failure & Bottleneck Heatmap
                        </h3>
                        <p className="text-[11px] text-zinc-400 font-mono">
                            {heatmap?.metricDefinition || "Service failure concentration across time"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {/* Metric Selector */}
                    <div className="flex items-center bg-[#0d0e11] border border-zinc-800 rounded-lg p-0.5 text-xs font-mono">
                        <button
                            onClick={() => setMetric("ERROR_RATE")}
                            className={`px-2.5 py-1 rounded text-xs transition ${
                                metric === "ERROR_RATE"
                                    ? "bg-rose-600 text-white font-medium shadow-sm"
                                    : "text-zinc-400 hover:text-zinc-200"
                            }`}
                            title="Traffic-normalized failure rate"
                        >
                            Error Rate %
                        </button>
                        <button
                            onClick={() => setMetric("FAILURE_COUNT")}
                            className={`px-2.5 py-1 rounded text-xs transition ${
                                metric === "FAILURE_COUNT"
                                    ? "bg-rose-600 text-white font-medium shadow-sm"
                                    : "text-zinc-400 hover:text-zinc-200"
                            }`}
                            title="Absolute failure count"
                        >
                            Failure Count
                        </button>
                        <button
                            onClick={() => setMetric("LATENCY_P95")}
                            className={`px-2.5 py-1 rounded text-xs transition ${
                                metric === "LATENCY_P95"
                                    ? "bg-rose-600 text-white font-medium shadow-sm"
                                    : "text-zinc-400 hover:text-zinc-200"
                            }`}
                            title="p95 execution latency"
                        >
                            p95 Latency
                        </button>
                    </div>

                    {/* Time Range */}
                    <div className="flex items-center bg-[#0d0e11] border border-zinc-800 rounded-lg p-0.5 text-xs font-mono">
                        {(["1h", "6h", "24h", "7d"] as const).map((key) => (
                            <button
                                key={key}
                                onClick={() => setTimeRangeKey(key)}
                                className={`px-2 py-1 rounded text-xs transition ${
                                    timeRangeKey === key
                                        ? "bg-zinc-700 text-white font-medium"
                                        : "text-zinc-400 hover:text-zinc-200"
                                }`}
                            >
                                {key}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={fetchHeatmap}
                        disabled={loading}
                        className="p-1.5 rounded-lg border border-zinc-800 bg-[#0d0e11] text-zinc-400 hover:text-white transition disabled:opacity-50"
                        title="Refresh Heatmap"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* Error or Loading */}
            {loading && (
                <div className="p-16 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                    Computing service failure matrix...
                </div>
            )}

            {error && (
                <div className="p-4 m-4 bg-rose-950/20 border border-rose-800/40 rounded-xl flex items-center gap-3 text-xs text-rose-300">
                    <AlertTriangle size={16} className="text-rose-400 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Heatmap Grid */}
            {!loading && !error && heatmap && (
                <div className="p-6 overflow-x-auto space-y-4">
                    {heatmap.services.length === 0 ? (
                        <div className="py-12 text-center text-xs text-zinc-500 font-mono">
                            No service telemetry recorded in the selected {timeRangeKey} window.
                        </div>
                    ) : (
                        <div className="min-w-[640px] space-y-2">
                            {heatmap.services.map((serviceName) => {
                                const serviceCells = heatmap.cells.filter((c) => c.service === serviceName);
                                return (
                                    <div key={serviceName} className="flex items-center gap-3">
                                        <div className="w-36 text-xs font-mono text-zinc-300 truncate text-right font-medium" title={serviceName}>
                                            {serviceName}
                                        </div>
                                        <div className="flex-1 grid grid-cols-12 gap-1.5">
                                            {serviceCells.map((cell) => {
                                                const cellClass = getCellColor(cell);
                                                return (
                                                    <div
                                                        key={`${cell.service}-${cell.bucketIndex}`}
                                                        onMouseEnter={() => setHoveredCell(cell)}
                                                        className={`h-8 rounded border flex items-center justify-center text-[10px] font-mono cursor-pointer transition-transform hover:scale-105 ${cellClass}`}
                                                    >
                                                        {cell.totalRequests === 0
                                                            ? "-"
                                                            : metric === "ERROR_RATE"
                                                            ? cell.errorRate !== null && cell.errorRate > 0
                                                                ? `${Math.round(cell.errorRate * 100)}%`
                                                                : "0%"
                                                            : metric === "FAILURE_COUNT"
                                                            ? cell.failedRequests > 0
                                                                ? cell.failedRequests
                                                                : "0"
                                                            : cell.p95LatencyMs !== null
                                                            ? `${cell.p95LatencyMs}m`
                                                            : "-"}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Dynamic Tooltip / Cell Detail */}
                    {hoveredCell && (
                        <div className="p-3 bg-[#0d0e11] border border-zinc-800 rounded-lg flex items-center justify-between text-xs font-mono">
                            <div>
                                <span className="text-zinc-500">Service: </span>
                                <span className="text-white font-semibold">{hoveredCell.service}</span>
                                <span className="text-zinc-500 ml-3">Interval: </span>
                                <span className="text-zinc-300">
                                    {new Date(hoveredCell.bucketStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                                    {new Date(hoveredCell.bucketEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div>
                                    <span className="text-zinc-500">Requests: </span>
                                    <span className="text-white">{hoveredCell.totalRequests}</span>
                                </div>
                                <div>
                                    <span className="text-zinc-500">Failures: </span>
                                    <span className="text-rose-400 font-semibold">{hoveredCell.failedRequests}</span>
                                </div>
                                <div>
                                    <span className="text-zinc-500">Error Rate: </span>
                                    <span className="text-amber-400">
                                        {hoveredCell.errorRate !== null ? `${(hoveredCell.errorRate * 100).toFixed(1)}%` : "N/A"}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-zinc-500">p95 Latency: </span>
                                    <span className="text-indigo-400">
                                        {hoveredCell.p95LatencyMs !== null ? `${hoveredCell.p95LatencyMs}ms` : "N/A"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Heatmap Legend */}
                    <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                        <div className="flex items-center gap-2">
                            <span>Intensity Legend:</span>
                            <span className="px-2 py-0.5 rounded bg-[#18191d] border border-zinc-800 text-zinc-500">No Data</span>
                            <span className="px-2 py-0.5 rounded bg-emerald-950/20 border border-emerald-900/30 text-emerald-400">0% Errors</span>
                            <span className="px-2 py-0.5 rounded bg-yellow-950/40 border border-yellow-800/40 text-yellow-400">&lt;5% Degraded</span>
                            <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-700/50 text-amber-300">5-20% Warning</span>
                            <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-600/60 text-rose-300 font-bold">&gt;20% Critical</span>
                        </div>
                        <div>
                            <span>Traffic-normalized to avoid scale distortions</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
