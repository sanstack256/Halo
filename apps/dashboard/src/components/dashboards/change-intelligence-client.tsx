"use client";

import React from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Clock,
    GitCommit,
    Layers,
    ShieldAlert,
    Sparkles,
    TrendingDown,
    TrendingUp,
} from "lucide-react";
import { useState } from "react";
import type { ChangeIntelligenceData, ChangeImpactItem } from "@/lib/analytics/types";
import { DashboardFilterBar } from "./dashboard-filter-bar";
import { ChangeTimelineView } from "./change-timeline-view";
import { ChangeImpactModal } from "./change-impact-modal";

interface ChangeIntelligenceClientProps {
    data: ChangeIntelligenceData;
    projects: Array<{ id: string; name: string }>;
    environments: string[];
    currentProjectId?: string;
    currentEnvironment?: string;
    currentTimeRange?: string;
    currentService?: string;
}

export function ChangeIntelligenceClient({
    data,
    projects,
    environments,
    currentProjectId = "ALL",
    currentEnvironment = "ALL",
    currentTimeRange = "24h",
    currentService = "ALL",
}: ChangeIntelligenceClientProps) {
    const { changes, summary, provenance } = data;
    const [selectedChange, setSelectedChange] = useState<ChangeImpactItem | null>(null);

    return (
        <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-mono text-xs">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-accent/15 text-accent border border-accent/30">
                            <GitCommit size={18} />
                        </span>
                        <h1 className="text-xl font-bold text-white tracking-tight font-sans">
                            Change Intelligence
                        </h1>
                    </div>
                    <p className="text-secondary text-xs font-sans">
                        Automated pre/post deployment baseline comparison and regression detection engine.
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
                    <span className="text-[10px] text-muted uppercase block">Total Releases</span>
                    <div className="text-xl font-bold text-white tracking-tight">
                        {summary.totalChanges}
                    </div>
                    <span className="text-[10px] text-muted block">In evaluated scope</span>
                </div>

                <div className="p-4 rounded-2xl bg-surface-elevated border border-border space-y-1">
                    <span className="text-[10px] text-muted uppercase block">Regressions Detected</span>
                    <div
                        className={`text-xl font-bold tracking-tight ${
                            summary.regressionsDetected > 0 ? "text-red-400" : "text-emerald-400"
                        }`}
                    >
                        {summary.regressionsDetected}
                    </div>
                    <span className="text-[10px] text-muted block">
                        Elevated failure or latency
                    </span>
                </div>

                <div className="p-4 rounded-2xl bg-surface-elevated border border-border space-y-1">
                    <span className="text-[10px] text-muted uppercase block">Stable Deployments</span>
                    <div className="text-xl font-bold text-emerald-400 tracking-tight">
                        {summary.stableChanges}
                    </div>
                    <span className="text-[10px] text-muted block">
                        No telemetry regression
                    </span>
                </div>

                <div className="p-4 rounded-2xl bg-surface-elevated border border-border space-y-1">
                    <span className="text-[10px] text-muted uppercase block">Insufficient Data</span>
                    <div className="text-xl font-bold text-zinc-400 tracking-tight">
                        {summary.insufficientDataCount}
                    </div>
                    <span className="text-[10px] text-muted block">
                        Low event volume
                    </span>
                </div>
            </div>

            {/* Change Timeline View */}
            <ChangeTimelineView
                changes={changes}
                onSelectChange={(c) => setSelectedChange(c)}
                projectId={currentProjectId}
            />

            {/* Deep Impact Analysis Modal */}
            {selectedChange && (
                <ChangeImpactModal
                    change={selectedChange}
                    projectId={currentProjectId}
                    onClose={() => setSelectedChange(null)}
                />
            )}
        </div>
    );
}
