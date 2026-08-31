"use client";

import React from "react";
import Link from "next/link";
import {
    Activity,
    Layers,
    Radio,
    ShieldAlert,
    Sparkles,
} from "lucide-react";
import type { ReliabilityLabData } from "@/lib/analytics/types";
import { DashboardFilterBar } from "./dashboard-filter-bar";
import { ReliabilityPostureView } from "./reliability-posture-view";

interface ReliabilityLabClientProps {
    data: ReliabilityLabData;
    projects: Array<{ id: string; name: string }>;
    environments: string[];
    currentProjectId?: string;
    currentEnvironment?: string;
    currentTimeRange?: string;
    currentComparison?: string;
    currentService?: string;
}

export function ReliabilityLabClient({
    data,
    projects,
    environments,
    currentProjectId = "ALL",
    currentEnvironment = "ALL",
    currentTimeRange = "24h",
    currentComparison = "PREVIOUS_PERIOD",
    currentService = "ALL",
}: ReliabilityLabClientProps) {
    const { provenance } = data;

    return (
        <div className="halo-dash-shell">
            {/* Header */}
            <div className="halo-dash-header">
                <nav className="halo-dash-breadcrumb" aria-label="Breadcrumb">
                    <Link href="/dashboards" className="halo-dash-breadcrumb-item">Dashboards</Link>
                    <span className="halo-dash-breadcrumb-sep">/</span>
                    <span className="halo-dash-breadcrumb-current">Reliability Lab</span>
                </nav>
                <div className="halo-dash-title-row">
                    <div className="halo-dash-title-group">
                        <div className="halo-dash-icon-box">
                            <Radio size={18} />
                        </div>
                        <div>
                            <h1 className="halo-dash-title">Reliability Lab</h1>
                            <p className="halo-dash-desc">
                                Long-term reliability posture, error budget burn rates, and recurring failure pattern detector.
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
                currentComparison={currentComparison}
                provenance={provenance}
                showComparisonToggle={true}
            />

            {/* Reliability Posture & SLO View */}
            <ReliabilityPostureView
                data={data}
                projectId={currentProjectId !== "ALL" ? currentProjectId : undefined}
            />
        </div>
    );
}
