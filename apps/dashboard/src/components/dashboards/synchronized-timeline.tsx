"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    BellRing,
    ChevronRight,
    Clock,
    Flame,
    GitCommit,
    Layers,
    Radio,
    ShieldAlert,
    Sparkles,
    Zap,
} from "lucide-react";
import type { TimeBucketPoint, TimelineEventMarker } from "@/lib/analytics/types";
import { formatDeterministicDateTime } from "@/lib/date-format";

interface SynchronizedTimelineProps {
    timeline: TimeBucketPoint[];
    markers: TimelineEventMarker[];
    onSelectBucket?: (bucket: TimeBucketPoint) => void;
    selectedBucket?: TimeBucketPoint | null;
}

export function SynchronizedTimeline({
    timeline,
    markers,
    onSelectBucket,
    selectedBucket,
}: SynchronizedTimelineProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [visibleSignals, setVisibleSignals] = useState<{
        errors: boolean;
        requests: boolean;
        latency: boolean;
        markers: boolean;
        comparison: boolean;
    }>({
        errors: true,
        requests: true,
        latency: true,
        markers: true,
        comparison: true,
    });

    const toggleSignal = (key: keyof typeof visibleSignals) => {
        setVisibleSignals((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    // Calculate maximum scales
    const maxErrors = useMemo(() => {
        const primary = Math.max(...timeline.map((b) => b.errorCount), 0);
        const comp = Math.max(...timeline.map((b) => b.comparison?.errorCount || 0), 0);
        return Math.max(primary, comp, 5);
    }, [timeline]);

    const maxRequests = useMemo(() => {
        const primary = Math.max(...timeline.map((b) => b.requestCount), 0);
        const comp = Math.max(...timeline.map((b) => b.comparison?.requestCount || 0), 0);
        return Math.max(primary, comp, 10);
    }, [timeline]);

    const maxLatency = useMemo(() => {
        const primary = Math.max(...timeline.map((b) => b.p95LatencyMs || b.avgLatencyMs || 0), 0);
        const comp = Math.max(...timeline.map((b) => b.comparison?.avgLatencyMs || 0), 0);
        return Math.max(primary, comp, 50);
    }, [timeline]);

    if (timeline.length === 0) {
        return (
            <div className="p-6 rounded-2xl border border-border bg-surface-elevated space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Activity size={14} className="text-accent" />
                        <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                            Synchronized System Timeline
                        </h3>
                    </div>
                    <span className="text-[11px] font-mono text-muted">0 buckets</span>
                </div>
                <div className="h-44 flex flex-col items-center justify-center text-center border border-dashed border-border rounded-xl p-4">
                    <Clock size={22} className="text-muted mb-2 opacity-50" />
                    <p className="text-xs text-white font-medium font-sans">No telemetry timeline available</p>
                    <p className="text-[11px] text-muted mt-0.5 max-w-sm font-sans">
                        Events, requests, and latency data for the chosen project/environment scope will appear here.
                    </p>
                </div>
            </div>
        );
    }

    const activeBucket = hoveredIndex !== null ? timeline[hoveredIndex] : selectedBucket || null;

    // Dimensions for SVG
    const width = 800;
    const height = 180;
    const paddingLeft = 30;
    const paddingRight = 30;
    const paddingTop = 25;
    const paddingBottom = 25;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    const stepX = chartWidth / Math.max(1, timeline.length - 1);

    // Coordinate helpers
    const getX = (index: number) => paddingLeft + index * stepX;
    const getYRequests = (val: number) => paddingTop + chartHeight - (val / maxRequests) * chartHeight;
    const getYErrors = (val: number) => paddingTop + chartHeight - (val / maxErrors) * chartHeight;
    const getYLatency = (val: number) => paddingTop + chartHeight - (val / maxLatency) * chartHeight;

    // SVG path builders
    const requestPoints = timeline.map((b, i) => `${getX(i)},${getYRequests(b.requestCount)}`).join(" ");
    const compRequestPoints = timeline
        .filter((b) => b.comparison)
        .map((b, i) => `${getX(i)},${getYRequests(b.comparison!.requestCount)}`)
        .join(" ");

    const errorPoints = timeline.map((b, i) => `${getX(i)},${getYErrors(b.errorCount)}`).join(" ");
    const latencyPoints = timeline
        .filter((b) => b.avgLatencyMs !== null)
        .map((b, i) => `${getX(i)},${getYLatency(b.avgLatencyMs!)}`)
        .join(" ");

    return (
        <div className="p-6 rounded-2xl border border-border bg-surface-elevated space-y-4 font-mono text-xs">
            {/* Header & Signal Toggles */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                    <Activity size={14} className="text-accent" />
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                        Synchronized System Timeline
                    </h3>
                    <span className="text-[10px] text-muted">
                        ({timeline.length} synchronized intervals)
                    </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    {/* Error Signal Toggle */}
                    <button
                        type="button"
                        onClick={() => toggleSignal("errors")}
                        className={`px-2.5 py-1 rounded-md border transition-colors flex items-center gap-1.5 cursor-pointer ${
                            visibleSignals.errors
                                ? "bg-red-500/10 border-red-500/30 text-red-400 font-semibold"
                                : "bg-surface border-border text-muted opacity-60"
                        }`}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        <span>Errors</span>
                    </button>

                    {/* Request Volume Toggle */}
                    <button
                        type="button"
                        onClick={() => toggleSignal("requests")}
                        className={`px-2.5 py-1 rounded-md border transition-colors flex items-center gap-1.5 cursor-pointer ${
                            visibleSignals.requests
                                ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 font-semibold"
                                : "bg-surface border-border text-muted opacity-60"
                        }`}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        <span>Requests</span>
                    </button>

                    {/* Latency Toggle */}
                    <button
                        type="button"
                        onClick={() => toggleSignal("latency")}
                        className={`px-2.5 py-1 rounded-md border transition-colors flex items-center gap-1.5 cursor-pointer ${
                            visibleSignals.latency
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-400 font-semibold"
                                : "bg-surface border-border text-muted opacity-60"
                        }`}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        <span>Latency</span>
                    </button>

                    {/* Event Markers Toggle */}
                    <button
                        type="button"
                        onClick={() => toggleSignal("markers")}
                        className={`px-2.5 py-1 rounded-md border transition-colors flex items-center gap-1.5 cursor-pointer ${
                            visibleSignals.markers
                                ? "bg-purple-500/10 border-purple-500/30 text-purple-400 font-semibold"
                                : "bg-surface border-border text-muted opacity-60"
                        }`}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        <span>Markers ({markers.length})</span>
                    </button>
                </div>
            </div>

            {/* Active Hover / Scrubber Stats Bar */}
            <div className="p-3 rounded-xl bg-surface border border-border flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Clock size={13} className="text-accent" />
                    <span className="text-white font-semibold">
                        {activeBucket ? activeBucket.formattedTime : "Hover timeline to inspect exact bucket"}
                    </span>
                    {activeBucket && (
                        <span className="text-[10px] text-muted">
                            ({formatDeterministicDateTime(new Date(activeBucket.timestamp))})
                        </span>
                    )}
                </div>

                {activeBucket && (
                    <div className="flex flex-wrap items-center gap-4 text-[11px]">
                        {visibleSignals.requests && (
                            <div className="flex items-center gap-1.5 text-cyan-400">
                                <span>Requests:</span>
                                <span className="font-bold text-white">{activeBucket.requestCount}</span>
                                {activeBucket.comparison && (
                                    <span className="text-[10px] text-muted">
                                        (prev: {activeBucket.comparison.requestCount})
                                    </span>
                                )}
                            </div>
                        )}

                        {visibleSignals.errors && (
                            <div className="flex items-center gap-1.5 text-red-400">
                                <span>Errors:</span>
                                <span className="font-bold text-white">{activeBucket.errorCount}</span>
                                <span className="text-[10px] text-zinc-400">({activeBucket.errorRate}%)</span>
                                {activeBucket.comparison && (
                                    <span className="text-[10px] text-muted">
                                        (prev: {activeBucket.comparison.errorCount})
                                    </span>
                                )}
                            </div>
                        )}

                        {visibleSignals.latency && activeBucket.avgLatencyMs !== null && (
                            <div className="flex items-center gap-1.5 text-amber-400">
                                <span>Avg Latency:</span>
                                <span className="font-bold text-white">{activeBucket.avgLatencyMs}ms</span>
                                {activeBucket.p95LatencyMs && (
                                    <span className="text-[10px] text-zinc-400">(P95: {activeBucket.p95LatencyMs}ms)</span>
                                )}
                            </div>
                        )}

                        {onSelectBucket && (
                            <button
                                type="button"
                                onClick={() => onSelectBucket(activeBucket)}
                                className="halo-btn halo-btn-primary halo-btn-xs text-[10px]"
                            >
                                <Sparkles size={11} />
                                <span>Explain Interval</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* SVG Timeline Canvas */}
            <div className="relative w-full overflow-hidden">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-44 overflow-visible select-none"
                    onMouseLeave={() => setHoveredIndex(null)}
                >
                    {/* Background Grid */}
                    <line
                        x1={paddingLeft}
                        y1={paddingTop}
                        x2={width - paddingRight}
                        y2={paddingTop}
                        stroke="rgba(255,255,255,0.06)"
                        strokeDasharray="3 3"
                    />
                    <line
                        x1={paddingLeft}
                        y1={paddingTop + chartHeight / 2}
                        x2={width - paddingRight}
                        y2={paddingTop + chartHeight / 2}
                        stroke="rgba(255,255,255,0.06)"
                        strokeDasharray="3 3"
                    />
                    <line
                        x1={paddingLeft}
                        y1={paddingTop + chartHeight}
                        x2={width - paddingRight}
                        y2={paddingTop + chartHeight}
                        stroke="rgba(255,255,255,0.12)"
                    />

                    {/* Comparison Request Line (Dashed) */}
                    {visibleSignals.requests && visibleSignals.comparison && compRequestPoints && (
                        <polyline
                            fill="none"
                            stroke="rgba(91,184,255,0.3)"
                            strokeWidth="1.5"
                            strokeDasharray="4 4"
                            points={compRequestPoints}
                        />
                    )}

                    {/* Request Volume Line */}
                    {visibleSignals.requests && requestPoints && (
                        <polyline
                            fill="none"
                            stroke="#5bb8ff"
                            strokeWidth="2"
                            points={requestPoints}
                        />
                    )}

                    {/* Latency Line */}
                    {visibleSignals.latency && latencyPoints && (
                        <polyline
                            fill="none"
                            stroke="#fbbf24"
                            strokeWidth="2"
                            points={latencyPoints}
                        />
                    )}

                    {/* Error Volume Bars / Line */}
                    {visibleSignals.errors && (
                        <g>
                            {timeline.map((b, i) => {
                                const x = getX(i);
                                const barWidth = Math.max(3, stepX * 0.6);
                                const barHeight = (b.errorCount / maxErrors) * chartHeight;
                                const y = paddingTop + chartHeight - barHeight;

                                if (b.errorCount === 0) return null;

                                return (
                                    <rect
                                        key={`err-bar-${i}`}
                                        x={x - barWidth / 2}
                                        y={y}
                                        width={barWidth}
                                        height={barHeight}
                                        fill="rgba(239,68,68,0.7)"
                                        rx={2}
                                    />
                                );
                            })}
                        </g>
                    )}

                    {/* Event Markers Overlay (Top row) */}
                    {visibleSignals.markers && (
                        <g>
                            {markers.map((m, idx) => {
                                const mTime = new Date(m.timestamp).getTime();
                                const firstTime = new Date(timeline[0].timestamp).getTime();
                                const lastTime = new Date(timeline[timeline.length - 1].timestamp).getTime();
                                const totalTime = lastTime - firstTime;

                                if (totalTime <= 0) return null;
                                const ratio = Math.max(0, Math.min(1, (mTime - firstTime) / totalTime));
                                const x = paddingLeft + ratio * chartWidth;

                                return (
                                    <g key={`marker-${idx}`} className="cursor-pointer">
                                        <line
                                            x1={x}
                                            y1={paddingTop - 10}
                                            x2={x}
                                            y2={paddingTop + chartHeight}
                                            stroke={
                                                m.type === "RELEASE"
                                                    ? "#a855f7"
                                                    : m.type === "INCIDENT"
                                                    ? "#ef4444"
                                                    : m.type === "MONITOR_ALERT"
                                                    ? "#f59e0b"
                                                    : "#5bb8ff"
                                            }
                                            strokeWidth="1"
                                            strokeDasharray="2 2"
                                            opacity={0.6}
                                        />
                                        <circle
                                            cx={x}
                                            cy={paddingTop - 10}
                                            r={4.5}
                                            fill={
                                                m.type === "RELEASE"
                                                    ? "#a855f7"
                                                    : m.type === "INCIDENT"
                                                    ? "#ef4444"
                                                    : m.type === "MONITOR_ALERT"
                                                    ? "#f59e0b"
                                                    : "#5bb8ff"
                                            }
                                        />
                                    </g>
                                );
                            })}
                        </g>
                    )}

                    {/* Interactive Hover Columns */}
                    {timeline.map((b, i) => {
                        const x = getX(i);
                        const isHovered = hoveredIndex === i;
                        const isSelected = selectedBucket?.timestamp === b.timestamp;

                        return (
                            <g
                                key={`col-${i}`}
                                onMouseEnter={() => setHoveredIndex(i)}
                                onClick={() => onSelectBucket && onSelectBucket(b)}
                                className="cursor-pointer"
                            >
                                <rect
                                    x={x - stepX / 2}
                                    y={paddingTop - 15}
                                    width={stepX}
                                    height={chartHeight + 35}
                                    fill={isSelected ? "rgba(91,184,255,0.12)" : isHovered ? "rgba(255,255,255,0.04)" : "transparent"}
                                />

                                {(isHovered || isSelected) && (
                                    <line
                                        x1={x}
                                        y1={paddingTop - 15}
                                        x2={x}
                                        y2={paddingTop + chartHeight + 5}
                                        stroke={isSelected ? "#5bb8ff" : "rgba(255,255,255,0.4)"}
                                        strokeWidth={1.5}
                                    />
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* Time Axis Labels */}
            <div className="flex justify-between text-[10px] text-muted border-t border-border/60 pt-2 px-1">
                <span>{timeline[0]?.formattedTime}</span>
                <span>{timeline[Math.floor(timeline.length / 2)]?.formattedTime}</span>
                <span>{timeline[timeline.length - 1]?.formattedTime}</span>
            </div>
        </div>
    );
}
