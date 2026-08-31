"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Activity,
    Clock,
    Layers,
    Sparkles,
} from "lucide-react";
import type { TimeBucketPoint, TimelineEventMarker } from "@/lib/analytics/types";
import { MultiSignalTimelineChart, type SignalType } from "./multi-signal-timeline-chart";

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
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [activeSignal, setActiveSignal] = useState<SignalType>("ERRORS");

    if (timeline.length === 0) {
        return (
            <div className="halo-panel">
                <div className="halo-panel-header">
                    <div className="halo-panel-title-group">
                        <Activity size={15} className="text-accent" />
                        <h3 className="halo-panel-title">Synchronized Multi-Signal Timeline</h3>
                    </div>
                </div>
                <div className="h-40 flex flex-col items-center justify-center text-center border border-dashed border-border rounded-xl p-6">
                    <Clock size={22} className="text-text-muted mb-2 opacity-50" />
                    <p className="text-xs text-text font-medium">No telemetry activity recorded in selected window</p>
                    <p className="text-[11px] text-text-muted mt-1 max-w-sm">
                        Synchronized timelines plot live event rates, error spikes, and deployment markers once telemetry events arrive.
                    </p>
                </div>
            </div>
        );
    }

    const activePoint = selectedIndex !== null ? timeline[selectedIndex] : timeline[timeline.length - 1];
    const hasComparison = timeline.some((p) => p.comparison !== undefined);

    return (
        <div className="halo-panel">
            {/* Header & Signal Switcher */}
            <div className="halo-panel-header">
                <div className="halo-panel-title-group">
                    <Activity size={15} className="text-accent" />
                    <div>
                        <h3 className="halo-panel-title">Synchronized Multi-Signal Timeline</h3>
                        <span className="halo-panel-subtitle">Click a point to inspect interval details</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Signal Switcher Buttons */}
                    <div className="halo-segment-control">
                        <button
                            type="button"
                            onClick={() => setActiveSignal("ERRORS")}
                            className={`halo-segment-btn ${
                                activeSignal === "ERRORS" ? "is-active-error" : ""
                            }`}
                        >
                            Errors
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveSignal("REQUESTS")}
                            className={`halo-segment-btn ${
                                activeSignal === "REQUESTS" ? "is-active-accent" : ""
                            }`}
                        >
                            Requests
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveSignal("LATENCY")}
                            className={`halo-segment-btn ${
                                activeSignal === "LATENCY" ? "is-active-warning" : ""
                            }`}
                        >
                            Latency P95
                        </button>
                    </div>
                </div>
            </div>

            {/* Production-Grade Analytical Chart Component */}
            <MultiSignalTimelineChart
                timeline={timeline}
                markers={markers}
                activeSignal={activeSignal}
                selectedIndex={selectedIndex}
                onSelectIndex={setSelectedIndex}
            />

            {/* Chart Legend & Context Bar */}
            <div className="flex items-center justify-between px-1 text-xs text-text-muted">
                <div className="halo-chart-legend">
                    <div className="halo-chart-legend-item">
                        <span
                            className="halo-chart-legend-indicator"
                            style={{
                                backgroundColor:
                                    activeSignal === "ERRORS"
                                        ? "#ef4444"
                                        : activeSignal === "REQUESTS"
                                        ? "#5bb8ff"
                                        : "#f59e0b",
                            }}
                        />
                        <span className="font-medium text-text">
                            {activeSignal === "ERRORS"
                                ? "Errors"
                                : activeSignal === "REQUESTS"
                                ? "Requests"
                                : "Latency P95"}
                        </span>
                    </div>

                    {hasComparison && (
                        <div className="halo-chart-legend-item">
                            <span className="halo-chart-legend-indicator is-dashed" />
                            <span>Previous Period Baseline</span>
                        </div>
                    )}
                </div>

                <span className="text-[11px] font-mono">
                    {timeline.length} {timeline.length === 1 ? "bucket" : "buckets"} evaluated
                </span>
            </div>

            {/* Active Bucket & Interval Scrubber Details Bar */}
            {activePoint && (
                <div className="p-3.5 rounded-xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[#080b11] border border-border text-accent shrink-0">
                            <Clock size={15} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-text text-xs font-mono">{activePoint.formattedTime} (UTC)</span>
                                {selectedIndex !== null ? (
                                    <span className="halo-badge halo-badge-info text-[9px] py-0.5">
                                        Selected Interval
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-text-muted">Latest Interval</span>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary mt-0.5 font-mono">
                                <span>
                                    Requests: <strong className="text-text">{activePoint.requestCount}</strong>
                                </span>
                                <span className="text-text-muted">·</span>
                                <span>
                                    Errors: <strong className={activePoint.errorCount > 0 ? "text-error" : "text-text"}>{activePoint.errorCount}</strong> ({activePoint.errorRate}%)
                                </span>
                                {activePoint.p95LatencyMs !== null && (
                                    <>
                                        <span className="text-text-muted">·</span>
                                        <span>
                                            P95: <strong className="text-warning">{activePoint.p95LatencyMs}ms</strong>
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                        {activePoint.affectedServices.length > 0 && (
                            <div className="flex items-center gap-1.5 text-xs text-text-muted">
                                <Layers size={12} className="text-accent" />
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
