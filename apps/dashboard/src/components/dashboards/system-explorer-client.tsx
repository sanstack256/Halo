"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Activity,
    ArrowUpRight,
    Clock,
    Flame,
    Layers,
    Radio,
    Server,
    ShieldAlert,
    Sparkles,
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
        <div className="halo-dash-shell">
            {/* Page Header */}
            <div className="halo-dash-header">
                <nav className="halo-dash-breadcrumb" aria-label="Breadcrumb">
                    <Link href="/dashboards" className="halo-dash-breadcrumb-item">Dashboards</Link>
                    <span className="halo-dash-breadcrumb-sep">/</span>
                    <span className="halo-dash-breadcrumb-current">System Explorer</span>
                </nav>
                <div className="halo-dash-title-row">
                    <div className="halo-dash-title-group">
                        <div className="halo-dash-icon-box">
                            <Activity size={18} />
                        </div>
                        <div>
                            <h1 className="halo-dash-title">System Explorer</h1>
                            <p className="halo-dash-desc">
                                Cross-signal temporal timeline and evidence-backed change detection engine.
                            </p>
                        </div>
                    </div>
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
            <div className="halo-kpi-grid">
                {/* Total Requests */}
                <div className="halo-kpi-card">
                    <span className="halo-kpi-eyebrow">Total Requests</span>
                    <div className="halo-kpi-value">
                        {summaryMetrics.totalRequests.current !== null
                            ? summaryMetrics.totalRequests.current.toLocaleString()
                            : "—"}
                    </div>
                    <div className="halo-kpi-sub">
                        {summaryMetrics.totalRequests.relativeDiffPct !== null ? (
                            <>
                                <span
                                    className={`halo-kpi-delta ${
                                        (summaryMetrics.totalRequests.relativeDiffPct || 0) >= 0
                                            ? "is-neutral"
                                            : "text-muted"
                                    }`}
                                >
                                    {(summaryMetrics.totalRequests.relativeDiffPct || 0) >= 0 ? "+" : ""}
                                    {summaryMetrics.totalRequests.relativeDiffPct}%
                                </span>
                                <span>vs previous</span>
                            </>
                        ) : (
                            <span>Observed volume</span>
                        )}
                    </div>
                </div>

                {/* Total Errors */}
                <div className="halo-kpi-card">
                    <span className="halo-kpi-eyebrow">Total Errors</span>
                    <div
                        className={`halo-kpi-value ${
                            (summaryMetrics.totalErrors.current ?? 0) > 0 ? "text-error" : "text-white"
                        }`}
                    >
                        {summaryMetrics.totalErrors.current !== null
                            ? summaryMetrics.totalErrors.current.toLocaleString()
                            : "—"}
                    </div>
                    <div className="halo-kpi-sub">
                        {summaryMetrics.totalErrors.relativeDiffPct !== null ? (
                            <>
                                <span
                                    className={`halo-kpi-delta ${
                                        (summaryMetrics.totalErrors.relativeDiffPct || 0) > 0
                                            ? "is-negative"
                                            : "is-positive"
                                    }`}
                                >
                                    {(summaryMetrics.totalErrors.relativeDiffPct || 0) > 0 ? "+" : ""}
                                    {summaryMetrics.totalErrors.relativeDiffPct}%
                                </span>
                                <span>vs previous</span>
                            </>
                        ) : (
                            <span>Recorded failures</span>
                        )}
                    </div>
                </div>

                {/* Error Rate */}
                <div className="halo-kpi-card">
                    <span className="halo-kpi-eyebrow">Error Rate</span>
                    <div
                        className={`halo-kpi-value ${
                            (summaryMetrics.errorRate.current ?? 0) >= 20
                                ? "text-error"
                                : (summaryMetrics.errorRate.current ?? 0) >= 5
                                ? "text-warning"
                                : "text-white"
                        }`}
                    >
                        {summaryMetrics.errorRate.current !== null
                            ? `${summaryMetrics.errorRate.current}%`
                            : "—"}
                    </div>
                    <div className="halo-kpi-sub">
                        {summaryMetrics.errorRate.percentagePointsDiff !== null ? (
                            <>
                                <span
                                    className={`halo-kpi-delta ${
                                        (summaryMetrics.errorRate.percentagePointsDiff || 0) > 0
                                            ? "is-negative"
                                            : "is-positive"
                                    }`}
                                >
                                    {(summaryMetrics.errorRate.percentagePointsDiff || 0) > 0 ? "+" : ""}
                                    {summaryMetrics.errorRate.percentagePointsDiff}pp
                                </span>
                                <span>vs previous</span>
                            </>
                        ) : (
                            <span>Failure proportion</span>
                        )}
                    </div>
                </div>

                {/* Avg Latency */}
                <div className="halo-kpi-card">
                    <span className="halo-kpi-eyebrow">Avg Latency</span>
                    <div className="halo-kpi-value">
                        {summaryMetrics.avgLatencyMs.current !== null
                            ? `${summaryMetrics.avgLatencyMs.current}ms`
                            : "—"}
                    </div>
                    <div className="halo-kpi-sub">
                        {summaryMetrics.avgLatencyMs.absoluteDiff !== null ? (
                            <>
                                <span
                                    className={`halo-kpi-delta ${
                                        (summaryMetrics.avgLatencyMs.absoluteDiff || 0) > 0
                                            ? "is-negative"
                                            : "is-positive"
                                    }`}
                                >
                                    {(summaryMetrics.avgLatencyMs.absoluteDiff || 0) > 0 ? "+" : ""}
                                    {summaryMetrics.avgLatencyMs.absoluteDiff}ms
                                </span>
                                <span>vs previous</span>
                            </>
                        ) : (
                            <span>Trace spans</span>
                        )}
                    </div>
                </div>

                {/* P95 Latency */}
                <div className="halo-kpi-card">
                    <span className="halo-kpi-eyebrow">P95 Latency</span>
                    <div className="halo-kpi-value">
                        {summaryMetrics.p95LatencyMs.current !== null
                            ? `${summaryMetrics.p95LatencyMs.current}ms`
                            : "—"}
                    </div>
                    <div className="halo-kpi-sub">
                        {summaryMetrics.p95LatencyMs.absoluteDiff !== null ? (
                            <>
                                <span
                                    className={`halo-kpi-delta ${
                                        (summaryMetrics.p95LatencyMs.absoluteDiff || 0) > 0
                                            ? "is-negative"
                                            : "is-positive"
                                    }`}
                                >
                                    {(summaryMetrics.p95LatencyMs.absoluteDiff || 0) > 0 ? "+" : ""}
                                    {summaryMetrics.p95LatencyMs.absoluteDiff}ms
                                </span>
                                <span>vs previous</span>
                            </>
                        ) : (
                            <span>Tail response</span>
                        )}
                    </div>
                </div>

                {/* Active Alerts */}
                <div className="halo-kpi-card">
                    <span className="halo-kpi-eyebrow">Active Alerts</span>
                    <div className="halo-kpi-value">
                        <span className={summaryMetrics.monitorsFiringCount > 0 ? "text-error" : "text-text"}>
                            {summaryMetrics.monitorsFiringCount} firing
                        </span>
                        <span className="text-text-muted text-sm font-normal"> · {summaryMetrics.activeIncidentsCount} open</span>
                    </div>
                    <div className="halo-kpi-sub">
                        <span>Monitors &amp; issues</span>
                    </div>
                </div>
            </div>

            {/* Synchronized Multi-Signal Timeline */}
            <SynchronizedTimeline
                timeline={timeline}
                markers={markers}
                projectId={currentProjectId !== "ALL" ? currentProjectId : undefined}
            />

            {/* Change & Anomaly Explanation Section */}
            <ChangeExplanationPanel
                explanation={explanation}
                projectId={currentProjectId !== "ALL" ? currentProjectId : undefined}
                environment={currentEnvironment !== "ALL" ? currentEnvironment : undefined}
            />

            {/* Service Contribution Breakdown Table */}
            <div className="halo-panel">
                <div className="halo-panel-header">
                    <div className="halo-panel-title-group">
                        <Layers size={15} className="text-accent" />
                        <h2 className="halo-panel-title">Service Contribution Breakdown</h2>
                    </div>
                    <span className="halo-panel-subtitle">
                        ({serviceContributions.length} {serviceContributions.length === 1 ? "service" : "services"} contributing telemetry)
                    </span>
                </div>

                {serviceContributions.length === 0 ? (
                    <div className="py-8 text-center text-text-muted text-xs">
                        No service telemetry recorded in selected window.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-border text-[11px] font-medium text-text-muted">
                                    <th className="pb-2.5 pl-2">Service</th>
                                    <th className="pb-2.5">Health</th>
                                    <th className="pb-2.5">Error Share</th>
                                    <th className="pb-2.5">Error Rate</th>
                                    <th className="pb-2.5">Avg Latency</th>
                                    <th className="pb-2.5">Traffic Share</th>
                                    <th className="pb-2.5 pr-2 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-xs">
                                {serviceContributions.map((s) => (
                                    <tr
                                        key={s.service}
                                        className="hover:bg-surface-interactive/60 transition-colors group"
                                    >
                                        {/* Service */}
                                        <td className="py-3 pl-2">
                                            <div className="flex items-center gap-2">
                                                <Server size={13} className="text-accent shrink-0" />
                                                <div>
                                                    <span className="font-semibold text-text group-hover:text-accent transition-colors">
                                                        {s.service}
                                                    </span>
                                                    <span className="text-[10px] text-text-muted block font-mono">
                                                        {s.projectName}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Health */}
                                        <td className="py-3">
                                            <span
                                                className={`halo-badge ${
                                                    s.health === "Critical"
                                                        ? "halo-badge-critical"
                                                        : s.health === "Degraded"
                                                        ? "halo-badge-degraded"
                                                        : "halo-badge-healthy"
                                                }`}
                                            >
                                                {s.health}
                                            </span>
                                        </td>

                                        {/* Error Share */}
                                        <td className="py-3 font-mono text-[11.5px]">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-[#06080d] rounded-full overflow-hidden border border-border">
                                                    <div
                                                        className="h-full bg-error rounded-full"
                                                        style={{ width: `${Math.min(100, s.errorContributionPct)}%` }}
                                                    />
                                                </div>
                                                <span className="font-semibold text-text">{s.errorContributionPct}%</span>
                                                <span className="text-[10px] text-text-muted">({s.errorCount} errs)</span>
                                            </div>
                                        </td>

                                        {/* Error Rate */}
                                        <td className="py-3 font-mono text-[11.5px]">
                                            <span className={s.errorRate >= 20 ? "text-error font-semibold" : s.errorRate >= 5 ? "text-warning font-semibold" : "text-text"}>
                                                {s.errorRate}%
                                            </span>
                                            {s.errorRateComparison?.percentagePointsDiff !== null && s.errorRateComparison?.percentagePointsDiff !== undefined && (
                                                <span className="text-[10px] text-text-muted ml-1">
                                                    ({s.errorRateComparison.percentagePointsDiff >= 0 ? "+" : ""}{s.errorRateComparison.percentagePointsDiff}pp)
                                                </span>
                                            )}
                                        </td>

                                        {/* Avg Latency */}
                                        <td className="py-3 font-mono text-[11.5px] text-text-secondary">
                                            {s.avgLatencyMs !== null ? `${s.avgLatencyMs}ms` : "—"}
                                        </td>

                                        {/* Traffic Share */}
                                        <td className="py-3 font-mono text-[11.5px] text-text-secondary">
                                            <span>{s.requestContributionPct}%</span>
                                            <span className="text-[10px] text-text-muted ml-1">({s.totalCount} reqs)</span>
                                        </td>

                                        {/* Action */}
                                        <td className="py-3 pr-2 text-right">
                                            <Link
                                                href={`/dashboards/services?service=${encodeURIComponent(s.service)}`}
                                                className="halo-filter-btn text-[11px] h-7 px-2.5"
                                            >
                                                <span>Landscape</span>
                                                <ArrowUpRight size={12} />
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
