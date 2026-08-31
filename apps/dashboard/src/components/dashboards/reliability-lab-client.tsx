"use client";

import React from "react";
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
        <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-mono text-xs">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-accent/15 text-accent border border-accent/30">
                            <Radio size={18} />
                        </span>
                        <h1 className="text-xl font-bold text-white tracking-tight font-sans">
                            Reliability Lab
                        </h1>
                    </div>
                    <p className="text-secondary text-xs font-sans">
                        Long-term reliability posture, error budget burn rates, and recurring failure pattern detector.
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
