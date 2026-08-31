"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    ArrowDownRight,
    ArrowUpRight,
    CheckCircle2,
    Clock,
    GitCommit,
    Layers,
    Radio,
    ShieldAlert,
    Sparkles,
    TrendingUp,
    Zap,
} from "lucide-react";
import type { TimeBucketPoint, TimelineEventMarker } from "@/lib/analytics/types";

interface SynchronizedTimelineProps {
    timeline: TimeBucketPoint[];
    markers: TimelineEventMarker[];
    projectId?: string;
}

export function SynchronizedTimeline({
    timeline,
    markers,
    projectId,
}: SynchronizedTimelineProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [activeSignal, setActiveSignal] = useState<"ERRORS" | "REQUESTS" | "LATENCY">("ERRORS");

    if (timeline.length === 0) {
        return (
            <div className="p-6 rounded-2xl border border-border bg-surface-elevated space-y-4 font-mono text-xs">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                    <Activity size={14} className="text-accent" />
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                        Synchronized Multi-Signal Timeline
                    </h3>
                </div>
                <div className="h-36 flex flex-col items-center justify-center text-center border border-dashed border-border rounded-xl p-4">
                    <Clock size={20} className="text-muted mb-2 opacity-50" />
                    <p className="text-xs text-white font-medium font-sans">No telemetry activity recorded in selected window</p>
                    <p className="text-[11px] text-muted mt-0.5 max-w-sm font-sans">
                        Synchronized timelines will plot live event rates, error spikes, and deployment markers once telemetry events arrive.
                    </p>
                </div>
            </div>
        );
    }

    const maxRequests = Math.max(...timeline.map((p) => p.requestCount), 1);
    const maxErrors = Math.max(...timeline.map((p) => p.errorCount), 1);
    const maxLatency = Math.max(...timeline.map((p) => p.p95LatencyMs || p.avgLatencyMs || 0), 1);

    const activePoint = selectedIndex !== null ? timeline[selectedIndex] : hoveredIndex !== null ? timeline[hoveredIndex] : timeline[timeline.length - 1];

    const chartHeight = 130;
    const pointCount = timeline.length;
    const svgWidth = 800;
    const stepX = pointCount > 1 ? svgWidth / (pointCount - 1) : svgWidth;

    // Build SVG Path strings
    const errorPoints = timeline.map((p, idx) => {
        const x = idx * stepX;
        const y = chartHeight - (p.errorCount / maxErrors) * (chartHeight - 16) - 8;
        return `${x},${y}`;
    });

    const requestPoints = timeline.map((p, idx) => {
        const x = idx * stepX;
        const y = chartHeight - (p.requestCount / maxRequests) * (chartHeight - 16) - 8;
        return `${x},${y}`;
    });

    const latencyPoints = timeline.map((p, idx) => {
        const lat = p.p95LatencyMs || p.avgLatencyMs || 0;
        const x = idx * stepX;
        const y = chartHeight - (lat / maxLatency) * (chartHeight - 16) - 8;
        return `${x},${y}`;
    });

    // Comparison Path
    const hasComparison = timeline.some((p) => p.comparison !== undefined);
    const compErrorPoints = hasComparison
        ? timeline.map((p, idx) => {
              const count = p.comparison?.errorCount || 0;
              const x = idx * stepX;
              const y = chartHeight - (count / maxErrors) * (chartHeight - 16) - 8;
              return `${x},${y}`;
          })
        : [];

    const activeIndex = selectedIndex !== null ? selectedIndex : hoveredIndex;

    return (
        <div className="p-6 rounded-2xl border border-border bg-surface-elevated space-y-4 font-mono text-xs">
            {/* Header & Signal Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                    <Activity size={14} className="text-accent" />
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                        Synchronized Multi-Signal Timeline
                    </h3>
                    <span className="text-[10px] text-muted font-sans">
                        (Click a bucket to inspect interval details)
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-[#080b11] p-0.5 rounded-lg border border-border text-[11px]">
                        <button
                            type="button"
                            onClick={() => setActiveSignal("ERRORS")}
                            className={`px-2.5 py-1 rounded-md transition-colors ${
                                activeSignal === "ERRORS" ? "bg-red-500/20 text-red-400 font-semibold" : "text-muted hover:text-white"
                            }`}
                        >
                            Errors
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveSignal("REQUESTS")}
                            className={`px-2.5 py-1 rounded-md transition-colors ${
                                activeSignal === "REQUESTS" ? "bg-accent/20 text-accent font-semibold" : "text-muted hover:text-white"
                            }`}
                        >
                            Requests
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveSignal("LATENCY")}
                            className={`px-2.5 py-1 rounded-md transition-colors ${
                                activeSignal === "LATENCY" ? "bg-amber-500/20 text-amber-400 font-semibold" : "text-muted hover:text-white"
                            }`}
                        >
                            Latency P95
                        </button>
                    </div>
                </div>
            </div>

            {/* SVG Interactive Multi-Signal Chart */}
            <div className="relative w-full h-36 bg-[#06080d] rounded-xl border border-border/60 p-2 select-none">
                <svg
                    viewBox={`0 0 ${svgWidth} ${chartHeight}`}
                    preserveAspectRatio="none"
                    className="w-full h-full cursor-crosshair"
                >
                    <defs>
                        <linearGradient id="primary-grad-errors" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="primary-grad-requests" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#5bb8ff" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#5bb8ff" stopOpacity="0.0" />
                        </linearGradient>
                        <linearGradient id="primary-grad-latency" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                        </linearGradient>
                    </defs>

                    {/* Comparison Baseline (Dashed) */}
                    {hasComparison && compErrorPoints.length > 0 && activeSignal === "ERRORS" && (
                        <polyline
                            fill="none"
                            stroke="rgba(255,255,255,0.2)"
                            strokeWidth="1.5"
                            strokeDasharray="4 4"
                            points={compErrorPoints.join(" ")}
                        />
                    )}

                    {/* Main Signal Area & Polyline */}
                    {activeSignal === "ERRORS" && (
                        <>
                            <polygon
                                fill="url(#primary-grad-errors)"
                                points={`0,${chartHeight} ${errorPoints.join(" ")} ${svgWidth},${chartHeight}`}
                            />
                            <polyline
                                fill="none"
                                stroke="#ef4444"
                                strokeWidth="2"
                                points={errorPoints.join(" ")}
                            />
                        </>
                    )}

                    {activeSignal === "REQUESTS" && (
                        <>
                            <polygon
                                fill="url(#primary-grad-requests)"
                                points={`0,${chartHeight} ${requestPoints.join(" ")} ${svgWidth},${chartHeight}`}
                            />
                            <polyline
                                fill="none"
                                stroke="#5bb8ff"
                                strokeWidth="2"
                                points={requestPoints.join(" ")}
                            />
                        </>
                    )}

                    {activeSignal === "LATENCY" && (
                        <>
                            <polygon
                                fill="url(#primary-grad-latency)"
                                points={`0,${chartHeight} ${latencyPoints.join(" ")} ${svgWidth},${chartHeight}`}
                            />
                            <polyline
                                fill="none"
                                stroke="#f59e0b"
                                strokeWidth="2"
                                points={latencyPoints.join(" ")}
                            />
                        </>
                    )}

                    {/* Scrubber vertical line */}
                    {activeIndex !== null && (
                        <line
                            x1={activeIndex * stepX}
                            y1="0"
                            x2={activeIndex * stepX}
                            y2={chartHeight}
                            stroke="#5bb8ff"
                            strokeWidth="1.5"
                            strokeDasharray="2 2"
                        />
                    )}

                    {/* Interactive Click / Hover Columns */}
                    {timeline.map((p, idx) => (
                        <rect
                            key={idx}
                            x={idx * stepX - stepX / 2}
                            y="0"
                            width={stepX}
                            height={chartHeight}
                            fill="transparent"
                            onMouseEnter={() => setHoveredIndex(idx)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            onClick={() => setSelectedIndex(idx === selectedIndex ? null : idx)}
                            className="cursor-pointer"
                        />
                    ))}
                </svg>
            </div>

            {/* Active Bucket & Interval Scrubber Details */}
            {activePoint && (
                <div className="p-3.5 rounded-xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#080b11] border border-border text-accent">
                            <Clock size={15} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-xs">{activePoint.formattedTime} (UTC)</span>
                                {selectedIndex !== null && (
                                    <span className="px-1.5 py-0.2 rounded bg-accent/20 text-accent text-[9px] font-semibold uppercase">
                                        Selected Interval
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted mt-0.5">
                                <span>
                                    Requests: <strong className="text-white">{activePoint.requestCount}</strong>
                                </span>
                                <span>·</span>
                                <span>
                                    Errors: <strong className="text-red-400">{activePoint.errorCount}</strong> ({activePoint.errorRate}%)
                                </span>
                                {activePoint.p95LatencyMs !== null && (
                                    <>
                                        <span>·</span>
                                        <span>
                                            P95 Latency: <strong className="text-amber-400">{activePoint.p95LatencyMs}ms</strong>
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {activePoint.affectedServices.length > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                                <Layers size={11} className="text-accent" />
                                <span>{activePoint.affectedServices.slice(0, 2).join(", ")}</span>
                            </div>
                        )}

                        <Link
                            href={`/projects/${projectId || "current"}/investigations/new?intervalTime=${encodeURIComponent(activePoint.timestamp)}`}
                            className="halo-btn halo-btn-primary halo-btn-xs"
                        >
                            <Sparkles size={11} />
                            <span>Analyze Interval</span>
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
