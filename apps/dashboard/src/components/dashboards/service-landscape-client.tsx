"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Activity,
    Layers,
    Radio,
    Server,
    ShieldAlert,
    TrendingUp,
} from "lucide-react";
import type { ServiceLandscapeData, ServiceLandscapeItem } from "@/lib/analytics/types";
import { DashboardFilterBar } from "./dashboard-filter-bar";
import { ServiceMatrixTable } from "./service-matrix-table";
import { ServiceInspectorDrawer } from "./service-inspector-drawer";

interface ServiceLandscapeClientProps {
    data: ServiceLandscapeData;
    projects: Array<{ id: string; name: string }>;
    environments: string[];
    currentProjectId?: string;
    currentEnvironment?: string;
    currentTimeRange?: string;
    currentService?: string;
}

export function ServiceLandscapeClient({
    data,
    projects,
    environments,
    currentProjectId = "ALL",
    currentEnvironment = "ALL",
    currentTimeRange = "24h",
    currentService = "ALL",
}: ServiceLandscapeClientProps) {
    const { services, rankings, summary, provenance } = data;
    const [selectedService, setSelectedService] = useState<ServiceLandscapeItem | null>(null);

    return (
        <div className="halo-dash-shell">
            {/* Header */}
            <div className="halo-dash-header">
                <nav className="halo-dash-breadcrumb" aria-label="Breadcrumb">
                    <Link href="/dashboards" className="halo-dash-breadcrumb-item">Dashboards</Link>
                    <span className="halo-dash-breadcrumb-sep">/</span>
                    <span className="halo-dash-breadcrumb-current">Service Landscape</span>
                </nav>
                <div className="halo-dash-title-row">
                    <div className="halo-dash-title-group">
                        <div className="halo-dash-icon-box">
                            <Server size={18} />
                        </div>
                        <div>
                            <h1 className="halo-dash-title">Service Landscape</h1>
                            <p className="halo-dash-desc">
                                Cross-service operational matrix, failure contribution rankings, and regression analysis.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <DashboardFilterBar
                projects={projects}
                environments={environments}
                currentProjectId={currentProjectId}
                currentEnvironment={currentEnvironment}
                currentTimeRange={currentTimeRange}
                provenance={provenance}
                showComparisonToggle={false}
            />

            {/* Primary Summary KPI Row */}
            <div className="halo-kpi-grid">
                <div className="halo-kpi-card">
                    <span className="halo-kpi-eyebrow">Total Services</span>
                    <div className="halo-kpi-value">{summary.totalServices}</div>
                    <div className="halo-kpi-sub">
                        <span>Across organization</span>
                    </div>
                </div>

                <div className="halo-kpi-card">
                    <span className="halo-kpi-eyebrow">Healthy</span>
                    <div className="halo-kpi-value text-success">{summary.healthyCount}</div>
                    <div className="halo-kpi-sub">
                        <span>Normal error rates</span>
                    </div>
                </div>

                <div className="halo-kpi-card">
                    <span className="halo-kpi-eyebrow">Degraded</span>
                    <div className={`halo-kpi-value ${summary.degradedCount > 0 ? "text-warning" : "text-text"}`}>
                        {summary.degradedCount}
                    </div>
                    <div className="halo-kpi-sub">
                        <span>Elevated failure rates</span>
                    </div>
                </div>

                <div className="halo-kpi-card">
                    <span className="halo-kpi-eyebrow">Critical</span>
                    <div className={`halo-kpi-value ${summary.criticalCount > 0 ? "text-error" : "text-text"}`}>
                        {summary.criticalCount}
                    </div>
                    <div className="halo-kpi-sub">
                        <span>Fatal / severe errors</span>
                    </div>
                </div>
            </div>

            {/* Secondary Signals Strip: Sleek & Compact */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#06080d] p-3 rounded-xl border border-border">
                {/* 1. Highest Failure Contributors */}
                <div className="space-y-1.5 pr-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text uppercase tracking-wider">
                        <ShieldAlert size={12} className="text-error" />
                        <span>Failure Share</span>
                    </div>
                    {rankings.highestFailureContributors.length === 0 ? (
                        <span className="text-[11px] text-text-muted">No failure data</span>
                    ) : (
                        <div className="space-y-1">
                            {rankings.highestFailureContributors.slice(0, 2).map((r, i) => (
                                <div key={i} className="flex items-center justify-between text-xs font-mono">
                                    <span className="text-text truncate pr-2">{r.service}</span>
                                    <span className="text-error font-semibold shrink-0">{r.failureContributionPct}%</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. Fastest Degrading */}
                <div className="space-y-1.5 sm:border-l sm:border-border sm:pl-3 pr-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text uppercase tracking-wider">
                        <TrendingUp size={12} className="text-warning" />
                        <span>Degradation</span>
                    </div>
                    {rankings.fastestDegrading.length === 0 ? (
                        <span className="text-[11px] text-text-muted">No degradation observed</span>
                    ) : (
                        <div className="space-y-1">
                            {rankings.fastestDegrading.slice(0, 2).map((r, i) => (
                                <div key={i} className="flex items-center justify-between text-xs font-mono">
                                    <span className="text-text truncate pr-2">{r.service}</span>
                                    <span className="text-warning font-semibold shrink-0">+{r.errorRateChange}%</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 3. Latency Regressions */}
                <div className="space-y-1.5 lg:border-l lg:border-border lg:pl-3 pr-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text uppercase tracking-wider">
                        <Activity size={12} className="text-accent" />
                        <span>Latency Delta</span>
                    </div>
                    {rankings.highestLatencyRegressions.length === 0 ? (
                        <span className="text-[11px] text-text-muted">No regressions detected</span>
                    ) : (
                        <div className="space-y-1">
                            {rankings.highestLatencyRegressions.slice(0, 2).map((r, i) => (
                                <div key={i} className="flex items-center justify-between text-xs font-mono">
                                    <span className="text-text truncate pr-2">{r.service}</span>
                                    <span className="text-accent font-semibold shrink-0">+{r.latencyDiffMs}ms</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 4. Traffic Dominance */}
                <div className="space-y-1.5 sm:border-l sm:border-border sm:pl-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text uppercase tracking-wider">
                        <Layers size={12} className="text-cyan-400" />
                        <span>Traffic Volume</span>
                    </div>
                    {rankings.highestTrafficExposure.length === 0 ? (
                        <span className="text-[11px] text-text-muted">No active traffic</span>
                    ) : (
                        <div className="space-y-1">
                            {rankings.highestTrafficExposure.slice(0, 2).map((r, i) => (
                                <div key={i} className="flex items-center justify-between text-xs font-mono">
                                    <span className="text-text truncate pr-2">{r.service}</span>
                                    <span className="text-text-secondary font-semibold shrink-0">{r.requestSharePct}% ({r.requestCount})</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Cross-Service Matrix Table */}
            <ServiceMatrixTable
                services={services}
                onSelectService={(s) => setSelectedService(s)}
                projectId={currentProjectId}
            />

            {/* Service Inspector Drawer */}
            {selectedService && (
                <ServiceInspectorDrawer
                    service={selectedService}
                    projectId={currentProjectId}
                    onClose={() => setSelectedService(null)}
                />
            )}
        </div>
    );
}
