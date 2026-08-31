"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Activity,
    GitCommit,
    Layers,
    ShieldAlert,
    Sparkles,
} from "lucide-react";
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
        <div className="halo-dash-shell">
            {/* Header */}
            <div className="halo-dash-header">
                <nav className="halo-dash-breadcrumb" aria-label="Breadcrumb">
                    <Link href="/dashboards" className="halo-dash-breadcrumb-item">Dashboards</Link>
                    <span className="halo-dash-breadcrumb-sep">/</span>
                    <span className="halo-dash-breadcrumb-current">Change Intelligence</span>
                </nav>
                <div className="halo-dash-title-row">
                    <div className="halo-dash-title-group">
                        <div className="halo-dash-icon-box">
                            <GitCommit size={18} />
                        </div>
                        <div>
                            <h1 className="halo-dash-title">Change Intelligence</h1>
                            <p className="halo-dash-desc">
                                Automated pre/post deployment baseline comparison and regression detection engine.
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

            {/* Summary Counters */}
            <div className="halo-kpi-grid">
                <div className="halo-kpi-card">
                    <span className="halo-kpi-eyebrow">Total Releases</span>
                    <div className="halo-kpi-value">{summary.totalChanges}</div>
                    <div className="halo-kpi-sub">
                        <span>In evaluated scope</span>
                    </div>
                </div>

                <div className="halo-kpi-card">
                    <span className="halo-kpi-eyebrow">Regressions Detected</span>
                    <div
                        className={`halo-kpi-value ${
                            summary.regressionsDetected > 0 ? "text-error" : "text-success"
                        }`}
                    >
                        {summary.regressionsDetected}
                    </div>
                    <div className="halo-kpi-sub">
                        <span>Elevated failure or latency</span>
                    </div>
                </div>

                <div className="halo-kpi-card">
                    <span className="halo-kpi-eyebrow">Stable Deployments</span>
                    <div className="halo-kpi-value text-success">
                        {summary.stableChanges}
                    </div>
                    <div className="halo-kpi-sub">
                        <span>No telemetry regression</span>
                    </div>
                </div>

                <div className="halo-kpi-card">
                    <span className="halo-kpi-eyebrow">Insufficient Data</span>
                    <div className="halo-kpi-value text-text-muted">
                        {summary.insufficientDataCount}
                    </div>
                    <div className="halo-kpi-sub">
                        <span>Low event volume</span>
                    </div>
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
