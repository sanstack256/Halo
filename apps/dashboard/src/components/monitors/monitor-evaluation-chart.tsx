"use client";

import React, { useState } from "react";
import { Activity, Clock, Info, ShieldAlert } from "lucide-react";
import { formatDeterministicDateTime } from "@/lib/date-format";
import type { MonitorFullDetails } from "@/actions/monitor";

interface MonitorEvaluationChartProps {
    data: MonitorFullDetails;
}

export function MonitorEvaluationChart({ data }: MonitorEvaluationChartProps) {
    const { monitor, alerts } = data;
    const [hoveredPoint, setHoveredPoint] = useState<{
        timestamp: Date;
        status: string;
        observedValue?: number | null;
        thresholdValue?: number | null;
        condition?: string;
        title: string;
    } | null>(null);

    // Build timeline observation points strictly from real data
    const points: Array<{
        id: string;
        timestamp: Date;
        status: "FIRING" | "HEALTHY" | "ACKNOWLEDGED" | "RESOLVED" | "EVALUATION";
        observedValue?: number | null;
        thresholdValue?: number | null;
        condition?: string;
        title: string;
    }> = [];

    // Add alert points
    for (const a of alerts) {
        points.push({
            id: `alert-${a.id}`,
            timestamp: new Date(a.triggeredAt),
            status: a.status === "OPEN" ? "FIRING" : a.status,
            observedValue: a.observedValue,
            thresholdValue: a.thresholdValue,
            condition: a.conditionSummary,
            title: `Alert Triggered (${a.status})`,
        });
        if (a.resolvedAt) {
            points.push({
                id: `resolved-${a.id}`,
                timestamp: new Date(a.resolvedAt),
                status: "RESOLVED",
                observedValue: a.observedValue,
                thresholdValue: a.thresholdValue,
                condition: "Condition returned to normal",
                title: "Alert Resolved",
            });
        }
    }

    // Add last evaluation point if exists
    if (monitor.lastEvaluatedAt) {
        const lastEvalTime = new Date(monitor.lastEvaluatedAt).getTime();
        const hasPointAtSameTime = points.some(
            (p) => Math.abs(p.timestamp.getTime() - lastEvalTime) < 5000
        );
        if (!hasPointAtSameTime) {
            points.push({
                id: `eval-${monitor.id}`,
                timestamp: new Date(monitor.lastEvaluatedAt),
                status: monitor.status === "FIRING" ? "FIRING" : "HEALTHY",
                observedValue: null,
                thresholdValue: monitor.thresholdValue,
                condition: `Evaluated status: ${monitor.status}`,
                title: `Evaluation: ${monitor.status}`,
            });
        }
    }

    // Sort ascending for chronological graph display
    points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // If no real evaluation or alert data points exist
    if (points.length === 0) {
        return (
            <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Activity size={14} className="text-[var(--text-muted)]" />
                        <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                            Evaluation &amp; Health History
                        </h3>
                    </div>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">Zero recorded history</span>
                </div>
                <div className="h-32 flex flex-col items-center justify-center text-center border border-dashed border-[var(--border)] rounded-xl p-4">
                    <Clock size={20} className="text-[var(--text-muted)] mb-2 opacity-50" />
                    <p className="text-xs text-white font-medium">No evaluations or alert triggers recorded yet</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5 max-w-sm">
                        As this monitor runs on schedule or ingests events, its real evaluated values and alert states will be plotted here.
                    </p>
                </div>
            </div>
        );
    }

    const minTime = points[0].timestamp.getTime();
    const maxTime = points[points.length - 1].timestamp.getTime();
    const timeSpan = maxTime - minTime || 1;

    return (
        <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Activity size={14} className="text-[var(--accent)]" />
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                        Evaluation &amp; Health Timeline
                    </h3>
                </div>
                <div className="flex items-center gap-4 text-[11px] font-mono text-[var(--text-muted)]">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>Healthy</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-400" />
                        <span>Firing</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span>Acknowledged</span>
                    </div>
                </div>
            </div>

            {/* Visual Timeline Bar / Chart */}
            <div className="relative h-28 w-full border border-[var(--border)] rounded-xl bg-[var(--surface)] p-4 flex flex-col justify-between">
                {/* Horizontal baseline */}
                <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-[1px] bg-[var(--border)] z-0" />

                {/* Timeline points */}
                <div className="relative z-10 w-full h-full flex items-center">
                    {points.map((p, idx) => {
                        const pct = points.length === 1 ? 50 : ((p.timestamp.getTime() - minTime) / timeSpan) * 100;
                        const isFiring = p.status === "FIRING";
                        const isAck = p.status === "ACKNOWLEDGED";
                        const isResolved = p.status === "RESOLVED";

                        const colorClass = isFiring
                            ? "bg-red-400 border-red-500 shadow-[0_0_10px_rgba(248,113,113,0.6)]"
                            : isAck
                            ? "bg-amber-400 border-amber-500"
                            : "bg-emerald-400 border-emerald-500";

                        return (
                            <div
                                key={p.id}
                                style={{ left: `${Math.max(2, Math.min(98, pct))}%` }}
                                className="absolute -translate-x-1/2 cursor-pointer group"
                                onMouseEnter={() => setHoveredPoint(p)}
                                onMouseLeave={() => setHoveredPoint(null)}
                            >
                                <div
                                    className={`w-3.5 h-3.5 rounded-full border-2 transition-transform duration-150 group-hover:scale-150 ${colorClass}`}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* X-axis labels */}
                <div className="flex items-center justify-between text-[10px] font-mono text-[var(--text-muted)] pt-2 border-t border-[var(--border)]/40">
                    <span>{formatDeterministicDateTime(points[0].timestamp)}</span>
                    {points.length > 1 && (
                        <span>{formatDeterministicDateTime(points[points.length - 1].timestamp)}</span>
                    )}
                </div>
            </div>

            {/* Hover details display or active detail card */}
            <div className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs font-mono">
                {hoveredPoint ? (
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <span
                                className={`w-2 h-2 rounded-full ${
                                    hoveredPoint.status === "FIRING"
                                        ? "bg-red-400"
                                        : hoveredPoint.status === "ACKNOWLEDGED"
                                        ? "bg-amber-400"
                                        : "bg-emerald-400"
                                }`}
                            />
                            <span className="text-white font-semibold">{hoveredPoint.title}</span>
                            {hoveredPoint.condition && (
                                <span className="text-[var(--text-secondary)]">— {hoveredPoint.condition}</span>
                            )}
                        </div>
                        <span className="text-[var(--text-muted)] shrink-0">
                            {formatDeterministicDateTime(hoveredPoint.timestamp)}
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center justify-between text-[var(--text-muted)]">
                        <span className="flex items-center gap-1.5">
                            <Info size={12} />
                            Hover over timeline nodes to inspect exact event observations &amp; thresholds.
                        </span>
                        <span>{points.length} recorded events</span>
                    </div>
                )}
            </div>
        </div>
    );
}
