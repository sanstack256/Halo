"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Clock,
    Flame,
    Gauge,
    Layers,
    Radio,
    ShieldAlert,
    ShieldCheck,
    Sparkles,
    TrendingDown,
    TrendingUp,
    Zap,
} from "lucide-react";
import type { ReliabilityLabData, RecurringPatternItem } from "@/lib/analytics/types";
import { RecurringPatternModal } from "./recurring-pattern-modal";
import { formatDeterministicDateTime } from "@/lib/date-format";

interface ReliabilityPostureViewProps {
    data: ReliabilityLabData;
    projectId?: string;
}

export function ReliabilityPostureView({ data, projectId }: ReliabilityPostureViewProps) {
    const { posture, errorBudget, trajectory, contributors, recurringPatterns } = data;
    const [selectedPattern, setSelectedPattern] = useState<RecurringPatternItem | null>(null);

    // SVG Trajectory calculations
    const width = 800;
    const height = 150;
    const paddingLeft = 30;
    const paddingRight = 30;
    const paddingTop = 20;
    const paddingBottom = 20;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    const stepX = chartWidth / Math.max(1, trajectory.length - 1);

    const getX = (i: number) => paddingLeft + i * stepX;
    const getYAvail = (pct: number) => {
        // scale between 90% and 100%
        const normalized = Math.max(0, Math.min(1, (pct - 90) / 10));
        return paddingTop + chartHeight - normalized * chartHeight;
    };

    const availPoints = trajectory
        .map((t, i) => `${getX(i)},${getYAvail(t.availabilityPct)}`)
        .join(" ");

    return (
        <div className="space-y-6 font-mono text-xs">
            {/* Top Posture Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {/* 1. Availability */}
                <div className="p-4 rounded-2xl bg-surface-elevated border border-border space-y-1.5">
                    <div className="flex items-center justify-between text-muted">
                        <span className="text-[10px] uppercase">Availability</span>
                        <ShieldCheck size={14} className="text-emerald-400" />
                    </div>
                    <div className="text-xl font-bold text-white tracking-tight">
                        {posture.availabilityPct.value}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted">
                        <span>Target: 99.9%</span>
                        {posture.availabilityPct.comparison?.percentagePointsDiff !== null && (
                            <span
                                className={`ml-1 font-semibold ${
                                    (posture.availabilityPct.comparison?.percentagePointsDiff || 0) >= 0
                                        ? "text-emerald-400"
                                        : "text-red-400"
                                }`}
                            >
                                {(posture.availabilityPct.comparison?.percentagePointsDiff || 0) >= 0 ? "+" : ""}
                                {posture.availabilityPct.comparison?.percentagePointsDiff}pp
                            </span>
                        )}
                    </div>
                </div>

                {/* 2. Error Budget Remaining */}
                <div className="p-4 rounded-2xl bg-surface-elevated border border-border space-y-1.5">
                    <div className="flex items-center justify-between text-muted">
                        <span className="text-[10px] uppercase">Error Budget</span>
                        <Gauge size={14} className="text-accent" />
                    </div>
                    <div
                        className={`text-xl font-bold tracking-tight ${
                            errorBudget.budgetRemainingPct < 20
                                ? "text-red-400"
                                : errorBudget.budgetRemainingPct < 50
                                ? "text-amber-400"
                                : "text-white"
                        }`}
                    >
                        {posture.errorBudgetRemainingPct.value}
                    </div>
                    <div className="w-full h-1.5 bg-surface rounded-full overflow-hidden border border-border">
                        <div
                            className={`h-full rounded-full ${
                                errorBudget.budgetRemainingPct < 20
                                    ? "bg-red-400"
                                    : errorBudget.budgetRemainingPct < 50
                                    ? "bg-amber-400"
                                    : "bg-emerald-400"
                            }`}
                            style={{ width: `${errorBudget.budgetRemainingPct}%` }}
                        />
                    </div>
                </div>

                {/* 3. Burn Rate */}
                <div className="p-4 rounded-2xl bg-surface-elevated border border-border space-y-1.5">
                    <div className="flex items-center justify-between text-muted">
                        <span className="text-[10px] uppercase">Burn Rate</span>
                        <Flame size={14} className="text-amber-400" />
                    </div>
                    <div
                        className={`text-xl font-bold tracking-tight ${
                            errorBudget.burnRate > 2.5
                                ? "text-red-400"
                                : errorBudget.burnRate > 1.0
                                ? "text-amber-400"
                                : "text-white"
                        }`}
                    >
                        {posture.burnRateMultiplier.value}
                    </div>
                    <span className="text-[10px] text-muted block truncate">
                        {errorBudget.burnRate <= 1.0 ? "Sustainable pace" : "Elevated consumption"}
                    </span>
                </div>

                {/* 4. Crash-Free Sessions */}
                <div className="p-4 rounded-2xl bg-surface-elevated border border-border space-y-1.5">
                    <div className="flex items-center justify-between text-muted">
                        <span className="text-[10px] uppercase">Crash-Free Rate</span>
                        <Activity size={14} className="text-cyan-400" />
                    </div>
                    <div className="text-xl font-bold text-white tracking-tight">
                        {posture.crashFreeSessionPct.value}
                    </div>
                    <span className="text-[10px] text-muted block">
                        Across recorded sessions
                    </span>
                </div>

                {/* 5. Incident Frequency */}
                <div className="p-4 rounded-2xl bg-surface-elevated border border-border space-y-1.5">
                    <div className="flex items-center justify-between text-muted">
                        <span className="text-[10px] uppercase">Incident Rate</span>
                        <ShieldAlert size={14} className="text-purple-400" />
                    </div>
                    <div className="text-xl font-bold text-white tracking-tight">
                        {posture.incidentFrequencyPerDay.value}
                    </div>
                    <span
                        className={`text-[10px] inline-flex items-center gap-1 ${
                            posture.overallTrend === "Improving"
                                ? "text-emerald-400"
                                : posture.overallTrend === "Degrading"
                                ? "text-red-400"
                                : "text-zinc-400"
                        }`}
                    >
                        {posture.overallTrend === "Improving" && <TrendingDown size={11} />}
                        {posture.overallTrend === "Degrading" && <TrendingUp size={11} />}
                        <span>Trend: {posture.overallTrend}</span>
                    </span>
                </div>
            </div>

            {/* Trajectory Timeline Chart */}
            <div className="p-6 rounded-2xl border border-border bg-surface-elevated space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                        <Activity size={14} className="text-accent" />
                        <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                            Reliability Trajectory &amp; Availability
                        </h3>
                    </div>
                    <span className="text-[10px] text-muted">
                        SLO Target: 99.9%
                    </span>
                </div>

                {trajectory.length === 0 ? (
                    <div className="h-28 flex items-center justify-center text-muted">
                        No trajectory points recorded.
                    </div>
                ) : (
                    <div className="space-y-2">
                        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36 select-none overflow-visible">
                            {/* 99.9% SLO Target Baseline */}
                            <line
                                x1={paddingLeft}
                                y1={getYAvail(99.9)}
                                x2={width - paddingRight}
                                y2={getYAvail(99.9)}
                                stroke="rgba(34,197,94,0.4)"
                                strokeDasharray="3 3"
                            />
                            <text
                                x={width - paddingRight + 5}
                                y={getYAvail(99.9) + 3}
                                fill="#22c55e"
                                fontSize="9"
                                fontFamily="monospace"
                            >
                                99.9%
                            </text>

                            {/* Trajectory Line */}
                            <polyline
                                fill="none"
                                stroke="#5bb8ff"
                                strokeWidth="2"
                                points={availPoints}
                            />

                            {/* Data points */}
                            {trajectory.map((t, i) => {
                                const x = getX(i);
                                const y = getYAvail(t.availabilityPct);
                                const hasError = t.errorRate > 0;

                                return (
                                    <circle
                                        key={i}
                                        cx={x}
                                        cy={y}
                                        r={hasError ? 3.5 : 2.5}
                                        fill={hasError ? "#ef4444" : "#5bb8ff"}
                                    />
                                );
                            })}
                        </svg>

                        <div className="flex justify-between text-[10px] text-muted border-t border-border/60 pt-1.5 px-1">
                            <span>{trajectory[0]?.formattedTime}</span>
                            <span>{trajectory[Math.floor(trajectory.length / 2)]?.formattedTime}</span>
                            <span>{trajectory[trajectory.length - 1]?.formattedTime}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Recurring Failure Patterns & Top Contributors Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 1. Recurring Failure Patterns */}
                <div className="p-6 rounded-2xl border border-border bg-surface-elevated space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                        <div className="flex items-center gap-2">
                            <ShieldAlert size={14} className="text-red-400" />
                            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                                Recurring Failure Patterns
                            </h3>
                        </div>
                        <span className="text-[10px] text-muted">
                            ({recurringPatterns.length} fingerprints)
                        </span>
                    </div>

                    {recurringPatterns.length === 0 ? (
                        <div className="py-8 text-center text-muted font-sans text-[11px]">
                            No recurring error fingerprints detected in this scope.
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                            {recurringPatterns.map((p) => (
                                <div
                                    key={p.id}
                                    onClick={() => setSelectedPattern(p)}
                                    className="p-3 rounded-xl bg-surface border border-border hover:border-border-strong transition-colors cursor-pointer space-y-1.5 group"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-white truncate pr-2 group-hover:text-accent">
                                            {p.title}
                                        </span>
                                        <span className="text-red-400 font-bold shrink-0">
                                            {p.occurrenceCount}x
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] text-muted">
                                        <span>
                                            Services: {p.affectedServices.join(", ") || "application"}
                                        </span>
                                        <span>·</span>
                                        <span>Last: {formatDeterministicDateTime(p.lastObservedAt)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. Reliability Debt */}
                {data.reliabilityDebt && data.reliabilityDebt.length > 0 && (
                    <div className="p-6 rounded-2xl border border-amber-500/20 bg-surface-elevated space-y-4 lg:col-span-2">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <div className="flex items-center gap-2">
                                <Zap size={14} className="text-amber-400" />
                                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                                    Reliability Debt
                                </h3>
                            </div>
                            <span className="text-[10px] text-muted">
                                Persistent failure patterns consuming reliability budget ({data.reliabilityDebt.length} active patterns)
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {data.reliabilityDebt.map((debt) => (
                                <div
                                    key={debt.id}
                                    className="p-3 rounded-xl bg-surface border border-border flex items-start justify-between gap-2"
                                >
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-white text-[11px] truncate max-w-xs">{debt.title}</span>
                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                {debt.severity}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-muted font-sans">
                                            Observed {debt.occurrenceCount}x across {debt.affectedServices.join(", ") || "services"}
                                        </p>
                                    </div>
                                    <span className="text-[10px] text-amber-400 font-bold shrink-0">
                                        ~{debt.estimatedReliabilityImpactMinutes}m impact
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 2. Top Reliability Contributors */}
                <div className="p-6 rounded-2xl border border-border bg-surface-elevated space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                        <div className="flex items-center gap-2">
                            <Layers size={14} className="text-accent" />
                            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                                Top Reliability Contributors
                            </h3>
                        </div>
                        <span className="text-[10px] text-muted">
                            ({contributors.length} services)
                        </span>
                    </div>

                    {contributors.length === 0 ? (
                        <div className="py-8 text-center text-muted font-sans text-[11px]">
                            No service-specific failure contributions observed.
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                            {contributors.map((c, i) => (
                                <div
                                    key={i}
                                    className="p-3 rounded-xl bg-surface border border-border flex items-center justify-between"
                                >
                                    <div className="space-y-0.5">
                                        <div className="font-semibold text-white">{c.service}</div>
                                        <span className="text-[10px] text-muted block">
                                            {c.errorBudgetConsumedPct}% error budget consumed
                                        </span>
                                    </div>
                                    <div className="text-right space-y-0.5">
                                        <span className="text-red-400 font-bold">
                                            {c.failedRequestCount} failures
                                        </span>
                                        <span className="text-[10px] text-muted block">
                                            ({c.failedRequestSharePct}% share)
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Recurring Pattern Inspector Modal */}
            {selectedPattern && (
                <RecurringPatternModal
                    pattern={selectedPattern}
                    projectId={projectId}
                    onClose={() => setSelectedPattern(null)}
                />
            )}
        </div>
    );
}
