"use client";

import React from "react";
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
    Zap,
} from "lucide-react";
import { useState } from "react";
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
        <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-mono text-xs">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-accent/15 text-accent border border-accent/30">
                            <Server size={18} />
                        </span>
                        <h1 className="text-xl font-bold text-white tracking-tight font-sans">
                            Service Landscape
                        </h1>
                    </div>
                    <p className="text-secondary text-xs font-sans">
                        Cross-service operational matrix, failure contribution rankings, and regression analysis.
                    </p>
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

            {/* Summary Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-surface-elevated border border-border space-y-1">
                    <span className="text-[10px] text-muted uppercase block">Total Services</span>
                    <div className="text-xl font-bold text-white tracking-tight">
                        {summary.totalServices}
                    </div>
                    <span className="text-[10px] text-muted block">Across organization</span>
                </div>

                <div className="p-4 rounded-2xl bg-surface-elevated border border-border space-y-1">
                    <span className="text-[10px] text-muted uppercase block">Healthy</span>
                    <div className="text-xl font-bold text-emerald-400 tracking-tight">
                        {summary.healthyCount}
                    </div>
                    <span className="text-[10px] text-muted block">Normal error rates</span>
                </div>

                <div className="p-4 rounded-2xl bg-surface-elevated border border-border space-y-1">
                    <span className="text-[10px] text-muted uppercase block">Degraded</span>
                    <div className="text-xl font-bold text-amber-400 tracking-tight">
                        {summary.degradedCount}
                    </div>
                    <span className="text-[10px] text-muted block">Elevated failure rates</span>
                </div>

                <div className="p-4 rounded-2xl bg-surface-elevated border border-border space-y-1">
                    <span className="text-[10px] text-muted uppercase block">Critical</span>
                    <div className="text-xl font-bold text-red-400 tracking-tight">
                        {summary.criticalCount}
                    </div>
                    <span className="text-[10px] text-muted block">Fatal / severe errors</span>
                </div>
            </div>

            {/* Service Rankings Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Highest Failure Contributors */}
                <div className="p-4 rounded-2xl bg-surface-elevated border border-border space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-white uppercase tracking-wider border-b border-border pb-2">
                        <span className="flex items-center gap-1.5 text-red-400">
                            <ShieldAlert size={13} />
                            <span>Failure Share</span>
                        </span>
                    </div>

                    {rankings.highestFailureContributors.length === 0 ? (
                        <span className="text-[11px] text-muted block">No failure data</span>
                    ) : (
                        <div className="space-y-1.5">
                            {rankings.highestFailureContributors.map((r, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <span className="text-zinc-200 truncate pr-2">{r.service}</span>
                                    <span className="text-red-400 font-bold shrink-0">
                                        {r.failureContributionPct}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 2. Fastest Degrading */}
                <div className="p-4 rounded-2xl bg-surface-elevated border border-border space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-white uppercase tracking-wider border-b border-border pb-2">
                        <span className="flex items-center gap-1.5 text-amber-400">
                            <TrendingUp size={13} />
                            <span>Degradation</span>
                        </span>
                    </div>

                    {rankings.fastestDegrading.length === 0 ? (
                        <span className="text-[11px] text-muted block">No degradation observed</span>
                    ) : (
                        <div className="space-y-1.5">
                            {rankings.fastestDegrading.map((r, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <span className="text-zinc-200 truncate pr-2">{r.service}</span>
                                    <span className="text-amber-400 font-bold shrink-0">
                                        +{r.errorRateChange}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 3. Latency Regressions */}
                <div className="p-4 rounded-2xl bg-surface-elevated border border-border space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-white uppercase tracking-wider border-b border-border pb-2">
                        <span className="flex items-center gap-1.5 text-purple-400">
                            <Activity size={13} />
                            <span>Latency Delta</span>
                        </span>
                    </div>

                    {rankings.highestLatencyRegressions.length === 0 ? (
                        <span className="text-[11px] text-muted block">No regressions detected</span>
                    ) : (
                        <div className="space-y-1.5">
                            {rankings.highestLatencyRegressions.map((r, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <span className="text-zinc-200 truncate pr-2">{r.service}</span>
                                    <span className="text-purple-400 font-bold shrink-0">
                                        +{r.latencyDiffMs}ms
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 4. Traffic Exposure */}
                <div className="p-4 rounded-2xl bg-surface-elevated border border-border space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-white uppercase tracking-wider border-b border-border pb-2">
                        <span className="flex items-center gap-1.5 text-cyan-400">
                            <Layers size={13} />
                            <span>Traffic Volume</span>
                        </span>
                    </div>

                    {rankings.highestTrafficExposure.length === 0 ? (
                        <span className="text-[11px] text-muted block">No traffic records</span>
                    ) : (
                        <div className="space-y-1.5">
                            {rankings.highestTrafficExposure.map((r, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <span className="text-zinc-200 truncate pr-2">{r.service}</span>
                                    <span className="text-cyan-400 font-bold shrink-0">
                                        {r.requestSharePct}% ({r.requestCount})
                                    </span>
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
                projectId={currentProjectId !== "ALL" ? currentProjectId : undefined}
            />

            {/* Service Inspector Drawer */}
            {selectedService && (
                <ServiceInspectorDrawer
                    service={selectedService}
                    projectId={currentProjectId !== "ALL" ? currentProjectId : undefined}
                    timeRangeKey={currentTimeRange}
                    onClose={() => setSelectedService(null)}
                />
            )}
        </div>
    );
}
