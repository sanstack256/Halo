"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    ArrowDownRight,
    ArrowRight,
    ArrowUpRight,
    CheckCircle2,
    Clock,
    Flame,
    Layers,
    Radio,
    Server,
    ShieldAlert,
    Sparkles,
    TrendingDown,
    TrendingUp,
} from "lucide-react";
import type { SystemExplorerData, TimeBucketPoint } from "@/lib/analytics/types";
import { DashboardFilterBar } from "./dashboard-filter-bar";
import { SynchronizedTimeline } from "./synchronized-timeline";
import { ChangeExplanationPanel } from "./change-explanation-panel";

interface SystemExplorerClientProps {
    data: SystemExplorerData;
    projects: Array<{ id: string; name: string }>;
    environments: string[];
    currentProjectId?: string;
    currentEnvironment?: string;
    currentTimeRange?: string;
    currentComparison?: string;
    currentService?: string;
}

export function SystemExplorerClient({
    data,
    projects,
    environments,
    currentProjectId = "ALL",
    currentEnvironment = "ALL",
    currentTimeRange = "24h",
    currentComparison = "PREVIOUS_PERIOD",
    currentService = "ALL",
}: SystemExplorerClientProps) {
    const { timeline, markers, summaryMetrics, explanation, serviceContributions, provenance } = data;
    const [selectedBucket, setSelectedBucket] = useState<TimeBucketPoint | null>(null);

    const servicesList = serviceContributions.map((s) => s.service);

    return (
        <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-mono text-xs">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-accent/15 text-accent border border-accent/30">
                            <Activity size={18} />
                        </span>
                        <h1 className="text-xl font-bold text-white tracking-tight font-sans">
                            System Explorer
                        </h1>
                    </div>
                    <p className="text-secondary text-xs font-sans">
                        Cross-signal temporal timeline and evidence-backed change detection engine.
                    </p>
                </div>
            </div>

            {/* Shared Filter Bar */}
            <DashboardFilterBar
                projects={projects}
                environments={environments}
                currentProjectId={currentProjectId}
                currentEnvironment={currentEnvironment}
                currentTimeRange={currentTimeRange}
                currentComparison={currentComparison}
                provenance={provenance}
                showComparisonToggle={true}
                showServiceFilter={true}
                services={servicesList}
                currentService={currentService}
            />

            {/* Summary Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Total Requests */}
                <div className="p-3.5 rounded-2xl bg-surface-elevated border border-border space-y-1">
                    <span className="text-[10px] text-muted uppercase block">Total Requests</span>
                    <div className="text-lg font-bold text-white tracking-tight">
                        {summaryMetrics.totalRequests.current}
                    </div>
                    {summaryMetrics.totalRequests.relativeDiffPct !== null && (
                        <div className="flex items-center gap-1 text-[10px] text-muted">
                            <span
                                className={`font-semibold ${
                                    (summaryMetrics.totalRequests.relativeDiffPct || 0) >= 0
                                        ? "text-cyan-400"
                                        : "text-muted"
                                }`}
                            >
                                {(summaryMetrics.totalRequests.relativeDiffPct || 0) >= 0 ? "+" : ""}
                                {summaryMetrics.totalRequests.relativeDiffPct}%
                            </span>
                            <span>vs prev</span>
                        </div>
                    )}
                </div>

                {/* Total Errors */}
                <div className="p-3.5 rounded-2xl bg-surface-elevated border border-border space-y-1">
                    <span className="text-[10px] text-muted uppercase block">Total Errors</span>
                    <div
                        className={`text-lg font-bold tracking-tight ${
                            summaryMetrics.totalErrors.current > 0 ? "text-red-400" : "text-white"
                        }`}
                    >
                        {summaryMetrics.totalErrors.current}
                    </div>
                    {summaryMetrics.totalErrors.relativeDiffPct !== null && (
                        <div className="flex items-center gap-1 text-[10px] text-muted">
                            <span
                                className={`font-semibold ${
                                    (summaryMetrics.totalErrors.relativeDiffPct || 0) > 0
                                        ? "text-red-400"
                                        : "text-emerald-400"
                                }`}
                            >
                                {(summaryMetrics.totalErrors.relativeDiffPct || 0) > 0 ? "+" : ""}
                                {summaryMetrics.totalErrors.relativeDiffPct}%
                            </span>
                            <span>vs prev</span>
                        </div>
                    )}
                </div>

                {/* Error Rate */}
                <div className="p-3.5 rounded-2xl bg-surface-elevated border border-border space-y-1">
                    <span className="text-[10px] text-muted uppercase block">Error Rate</span>
                    <div
                        className={`text-lg font-bold tracking-tight ${
                            summaryMetrics.errorRate.current >= 20
                                ? "text-red-400"
                                : summaryMetrics.errorRate.current >= 5
                                ? "text-amber-400"
                                : "text-white"
                        }`}
                    >
                        {summaryMetrics.errorRate.current}%
                    </div>
                    {summaryMetrics.errorRate.percentagePointsDiff !== null && (
                        <div className="flex items-center gap-1 text-[10px] text-muted">
                            <span
                                className={`font-semibold ${
                                    (summaryMetrics.errorRate.percentagePointsDiff || 0) > 0
                                        ? "text-red-400"
                                        : "text-emerald-400"
                                }`}
                            >
                                {(summaryMetrics.errorRate.percentagePointsDiff || 0) > 0 ? "+" : ""}
                                {summaryMetrics.errorRate.percentagePointsDiff}pp
                            </span>
                            <span>vs prev</span>
                        </div>
                    )}
                </div>

                {/* Avg Latency */}
                <div className="p-3.5 rounded-2xl bg-surface-elevated border border-border space-y-1">
                    <span className="text-[10px] text-muted uppercase block">Avg Latency</span>
                    <div className="text-lg font-bold text-white tracking-tight">
                        {summaryMetrics.avgLatencyMs.current > 0 ? `${summaryMetrics.avgLatencyMs.current}ms` : "-"}
                    </div>
                    <span className="text-[10px] text-muted block">
                        Across trace spans
                    </span>
                </div>

                {/* P95 Latency */}
                <div className="p-3.5 rounded-2xl bg-surface-elevated border border-border space-y-1">
                    <span className="text-[10px] text-muted uppercase block">P95 Latency</span>
                    <div className="text-lg font-bold text-white tracking-tight">
                        {summaryMetrics.p95LatencyMs.current > 0 ? `${summaryMetrics.p95LatencyMs.current}ms` : "-"}
                    </div>
                    <span className="text-[10px] text-muted block">
                        Tail response time
                    </span>
                </div>

                {/* Active Incidents & Firing Monitors */}
                <div className="p-3.5 rounded-2xl bg-surface-elevated border border-border space-y-1">
                    <span className="text-[10px] text-muted uppercase block">Active Alerts</span>
                    <div className="text-lg font-bold text-white tracking-tight">
                        {summaryMetrics.monitorsFiringCount} firing · {summaryMetrics.activeIncidentsCount} open
                    </div>
                    <span className="text-[10px] text-muted block">
                        Monitors &amp; Issues
                    </span>
                </div>
            </div>

            {/* Primary Synchronized Multi-Signal Timeline */}
            <SynchronizedTimeline
                timeline={timeline}
                markers={markers}
                onSelectBucket={(b) => setSelectedBucket(b)}
                selectedBucket={selectedBucket}
            />

            {/* Explain a Change Engine Panel */}
            <ChangeExplanationPanel
                explanation={explanation}
                projectId={currentProjectId !== "ALL" ? currentProjectId : undefined}
                environment={currentEnvironment !== "ALL" ? currentEnvironment : undefined}
            />

            {/* Service Contribution Table */}
            <div className="p-6 rounded-2xl border border-border bg-surface-elevated space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                        <Server size={14} className="text-accent" />
                        <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                            Service Contribution Breakdown
                        </h3>
                    </div>
                    <span className="text-[10px] text-muted">
                        ({serviceContributions.length} services contributing telemetry)
                    </span>
                </div>

                {serviceContributions.length === 0 ? (
                    <div className="py-8 text-center text-muted">
                        No service contribution data available.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border/80 text-[10px] uppercase text-muted tracking-wider">
                                    <th className="py-2.5 px-3">Service</th>
                                    <th className="py-2.5 px-3">Health</th>
                                    <th className="py-2.5 px-3">Error Share</th>
                                    <th className="py-2.5 px-3">Error Rate</th>
                                    <th className="py-2.5 px-3">Avg Latency</th>
                                    <th className="py-2.5 px-3">Traffic Share</th>
                                    <th className="py-2.5 px-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {serviceContributions.map((s) => (
                                    <tr key={`${s.service}-${s.projectId}`} className="hover:bg-white/[0.02]">
                                        <td className="py-3 px-3">
                                            <div className="font-semibold text-white flex items-center gap-1.5">
                                                <Layers size={13} className="text-accent" />
                                                <span>{s.service}</span>
                                            </div>
                                            <span className="text-[10px] text-muted block mt-0.5">
                                                {s.projectName}
                                            </span>
                                        </td>

                                        <td className="py-3 px-3">
                                            <span
                                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                                                    s.health === "Healthy"
                                                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                        : s.health === "Degraded"
                                                        ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                                        : s.health === "Critical"
                                                        ? "bg-red-500/10 border-red-500/20 text-red-400"
                                                        : "bg-zinc-500/10 border-zinc-500/20 text-zinc-400"
                                                }`}
                                            >
                                                {s.health}
                                            </span>
                                        </td>

                                        <td className="py-3 px-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-[11px]">
                                                    <span className="text-white font-medium">
                                                        {s.errorContributionPct}%
                                                    </span>
                                                    <span className="text-[10px] text-muted">
                                                        ({s.errorCount} errs)
                                                    </span>
                                                </div>
                                                <div className="w-20 h-1.5 bg-surface rounded-full overflow-hidden border border-border">
                                                    <div
                                                        className="h-full bg-red-400 rounded-full"
                                                        style={{ width: `${Math.min(100, s.errorContributionPct)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>

                                        <td className="py-3 px-3">
                                            <span className="font-semibold text-white">
                                                {s.errorRate}%
                                            </span>
                                            {s.errorRateComparison?.percentagePointsDiff !== null && (
                                                <span
                                                    className={`text-[10px] block mt-0.5 ${
                                                        (s.errorRateComparison?.percentagePointsDiff || 0) > 0
                                                            ? "text-red-400"
                                                            : "text-emerald-400"
                                                    }`}
                                                >
                                                    {(s.errorRateComparison?.percentagePointsDiff || 0) > 0 ? "+" : ""}
                                                    {s.errorRateComparison?.percentagePointsDiff}pp
                                                </span>
                                            )}
                                        </td>

                                        <td className="py-3 px-3">
                                            <span className="text-zinc-200">
                                                {s.avgLatencyMs ? `${s.avgLatencyMs}ms` : "-"}
                                            </span>
                                        </td>

                                        <td className="py-3 px-3">
                                            <span className="text-zinc-200">
                                                {s.requestContributionPct}%
                                            </span>
                                            <span className="text-[10px] text-muted block mt-0.5">
                                                ({s.totalCount} reqs)
                                            </span>
                                        </td>

                                        <td className="py-3 px-3 text-right">
                                            <Link
                                                href={`/dashboards/services?projectId=${s.projectId}&service=${s.service}`}
                                                className="halo-btn halo-btn-secondary halo-btn-xs"
                                            >
                                                <span>Landscape &rarr;</span>
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
