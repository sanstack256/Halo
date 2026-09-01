"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Activity,
    Clock,
    Flame,
    Gauge,
    Layers,
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
import { ReliabilityTrajectoryChart } from "./reliability-trajectory-chart";

interface ReliabilityPostureViewProps {
    data: ReliabilityLabData;
    projectId?: string;
}

export function ReliabilityPostureView({ data, projectId }: ReliabilityPostureViewProps) {
    const { posture, errorBudget, trajectory, contributors, recurringPatterns } = data;
    const [selectedPattern, setSelectedPattern] = useState<RecurringPatternItem | null>(null);

    return (
        <div className="space-y-6">
            {/* Top Posture Cards Grid */}
            <div className="halo-kpi-grid">
                {/* 1. Availability */}
                <div className="halo-kpi-card">
                    <div className="halo-kpi-eyebrow">
                        <span>Availability</span>
                        <ShieldCheck size={14} className="text-success" />
                    </div>
                    <div className="halo-kpi-value text-text">
                        {posture.availabilityPct.value}
                    </div>
                    <div className="halo-kpi-sub">
                        <span>Target: 99.9%</span>
                        {posture.availabilityPct.comparison?.percentagePointsDiff !== null && (
                            <span
                                className={`halo-kpi-delta ${
                                    (posture.availabilityPct.comparison?.percentagePointsDiff || 0) >= 0
                                        ? "is-positive"
                                        : "is-negative"
                                }`}
                            >
                                {(posture.availabilityPct.comparison?.percentagePointsDiff || 0) >= 0 ? "+" : ""}
                                {posture.availabilityPct.comparison?.percentagePointsDiff}pp
                            </span>
                        )}
                    </div>
                </div>

                {/* 2. Error Budget Remaining */}
                <div className="halo-kpi-card">
                    <div className="halo-kpi-eyebrow">
                        <span>Error Budget</span>
                        <Gauge size={14} className="text-accent" />
                    </div>
                    <div
                        className={`halo-kpi-value ${
                            errorBudget.budgetRemainingPct !== null && errorBudget.budgetRemainingPct < 20
                                ? "text-error"
                                : errorBudget.budgetRemainingPct !== null && errorBudget.budgetRemainingPct < 50
                                ? "text-warning"
                                : "text-text"
                        }`}
                    >
                        {posture.errorBudgetRemainingPct.value}
                    </div>
                    {errorBudget.budgetRemainingPct !== null ? (
                        <div className="w-full h-1.5 bg-[#06080d] rounded-full overflow-hidden border border-border mt-1">
                            <div
                                className={`h-full rounded-full ${
                                    errorBudget.budgetRemainingPct < 20
                                        ? "bg-error"
                                        : errorBudget.budgetRemainingPct < 50
                                        ? "bg-warning"
                                        : "bg-success"
                                }`}
                                style={{ width: `${errorBudget.budgetRemainingPct}%` }}
                            />
                        </div>
                    ) : (
                        <div className="halo-kpi-sub">
                            <span>No budget baseline</span>
                        </div>
                    )}
                </div>

                {/* 3. Burn Rate */}
                <div className="halo-kpi-card">
                    <div className="halo-kpi-eyebrow">
                        <span>Burn Rate</span>
                        <Flame size={14} className="text-warning" />
                    </div>
                    <div
                        className={`halo-kpi-value ${
                            errorBudget.burnRate !== null && errorBudget.burnRate > 2.5
                                ? "text-error"
                                : errorBudget.burnRate !== null && errorBudget.burnRate > 1.0
                                ? "text-warning"
                                : "text-text"
                        }`}
                    >
                        {posture.burnRateMultiplier.value}
                    </div>
                    <div className="halo-kpi-sub">
                        <span>
                            {errorBudget.burnRate !== null
                                ? errorBudget.burnRate <= 1.0
                                    ? "Sustainable pace"
                                    : "Elevated consumption"
                                : "No consumption evidence"}
                        </span>
                    </div>
                </div>

                {/* 4. Crash-Free Sessions */}
                <div className="halo-kpi-card">
                    <div className="halo-kpi-eyebrow">
                        <span>Crash-Free Rate</span>
                        <Activity size={14} className="text-cyan-400" />
                    </div>
                    <div className="halo-kpi-value text-text">
                        {posture.crashFreeSessionPct.value}
                    </div>
                    <div className="halo-kpi-sub">
                        <span>Recorded sessions</span>
                    </div>
                </div>

                {/* 5. Incident Frequency */}
                <div className="halo-kpi-card">
                    <div className="halo-kpi-eyebrow">
                        <span>Incident Rate</span>
                        <ShieldAlert size={14} className="text-purple-400" />
                    </div>
                    <div className="halo-kpi-value text-text">
                        {posture.incidentFrequencyPerDay.value}
                    </div>
                    <div className="halo-kpi-sub">
                        <span
                            className={`inline-flex items-center gap-1 font-medium ${
                                posture.overallTrend === "Improving"
                                    ? "text-success"
                                    : posture.overallTrend === "Degrading"
                                    ? "text-error"
                                    : "text-text-muted"
                            }`}
                        >
                            {posture.overallTrend === "Improving" && <TrendingDown size={11} />}
                            {posture.overallTrend === "Degrading" && <TrendingUp size={11} />}
                            <span>Trend: {posture.overallTrend}</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Trajectory Timeline Chart */}
            <div className="halo-panel">
                <div className="halo-panel-header">
                    <div className="halo-panel-title-group">
                        <Activity size={15} className="text-accent" />
                        <div>
                            <h3 className="halo-panel-title">Reliability Trajectory &amp; Availability</h3>
                            <span className="halo-panel-subtitle">SLO target baseline vs actual observed availability</span>
                        </div>
                    </div>

                    <div className="halo-chart-legend">
                        <div className="halo-chart-legend-item">
                            <span className="halo-chart-legend-indicator bg-accent" />
                            <span className="font-medium text-text">Observed Availability</span>
                        </div>
                        <div className="halo-chart-legend-item">
                            <span className="halo-chart-legend-indicator is-ref-target" />
                            <span className="text-success font-medium">99.9% Target Baseline</span>
                        </div>
                    </div>
                </div>

                {trajectory.length === 0 ? (
                    <div className="h-32 flex items-center justify-center text-text-muted text-xs">
                        No trajectory points recorded in selected window.
                    </div>
                ) : (
                    <ReliabilityTrajectoryChart
                        trajectory={trajectory}
                        targetAvailabilityPct={99.9}
                    />
                )}
            </div>

            {/* Recurring Failure Patterns & Top Contributors Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 1. Recurring Failure Patterns */}
                <div className="halo-panel">
                    <div className="halo-panel-header">
                        <div className="halo-panel-title-group">
                            <ShieldAlert size={15} className="text-error" />
                            <h3 className="halo-panel-title">Recurring Failure Patterns</h3>
                        </div>
                        <span className="halo-panel-subtitle">
                            ({recurringPatterns.length} {recurringPatterns.length === 1 ? "fingerprint" : "fingerprints"})
                        </span>
                    </div>

                    {recurringPatterns.length === 0 ? (
                        <div className="py-8 text-center text-text-muted text-xs">
                            No recurring error fingerprints detected in this scope.
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                            {recurringPatterns.map((p) => (
                                <div
                                    key={p.id}
                                    onClick={() => setSelectedPattern(p)}
                                    className="p-3 rounded-xl bg-surface border border-border hover:border-border-strong hover:bg-surface-elevated/40 transition-colors cursor-pointer space-y-1 group"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-text text-xs truncate pr-2 group-hover:text-accent transition-colors font-mono">
                                            {p.title}
                                        </span>
                                        <span className="halo-badge halo-badge-critical text-[10px] py-0 font-mono">
                                            {p.occurrenceCount}x
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-text-muted font-mono">
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

                {/* 2. Top Reliability Contributors */}
                <div className="halo-panel">
                    <div className="halo-panel-header">
                        <div className="halo-panel-title-group">
                            <Layers size={15} className="text-accent" />
                            <h3 className="halo-panel-title">Top Reliability Contributors</h3>
                        </div>
                        <span className="halo-panel-subtitle">
                            ({contributors.length} {contributors.length === 1 ? "contributor" : "contributors"})
                        </span>
                    </div>

                    {contributors.length === 0 ? (
                        <div className="py-8 text-center text-text-muted text-xs">
                            No contributor failure data in current window.
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                            {contributors.map((c, i) => (
                                <div
                                    key={i}
                                    className="p-3 rounded-xl bg-surface border border-border space-y-1 text-xs"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-text">{c.service}</span>
                                        <span className="font-mono text-error font-semibold">
                                            {c.failedRequestCount} failures ({c.failedRequestSharePct}%)
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-text-muted">
                                        <span>Downtime Est: <strong className="text-text font-mono">~{c.downtimeMinutesEstimate}m</strong></span>
                                        <span className="font-mono text-warning">Budget Consumed: {c.errorBudgetConsumedPct}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Reliability Debt Block (If Active) */}
            {data.reliabilityDebt && data.reliabilityDebt.length > 0 && (
                <div className="halo-panel border-warning/30">
                    <div className="halo-panel-header">
                        <div className="halo-panel-title-group">
                            <Zap size={15} className="text-warning" />
                            <h3 className="halo-panel-title">Reliability Debt</h3>
                        </div>
                        <span className="halo-panel-subtitle">
                            Persistent failure patterns draining error capacity ({data.reliabilityDebt.length} active)
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {data.reliabilityDebt.map((debt) => (
                            <div
                                key={debt.id}
                                className="p-3 rounded-xl bg-surface border border-border flex items-start justify-between gap-2"
                            >
                                <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-text text-xs truncate">{debt.title}</span>
                                        <span className="halo-badge halo-badge-degraded text-[9px] py-0">
                                            {debt.severity}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-text-muted">
                                        Observed {debt.occurrenceCount}x across {debt.affectedServices.join(", ") || "services"}
                                    </p>
                                </div>
                                <span className="text-xs text-warning font-semibold font-mono shrink-0">
                                    ~{debt.estimatedReliabilityImpactMinutes}m
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recurring Pattern Drill-Down Modal */}
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
