"use client";

import React from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Clock,
    Layers,
    Network,
    Radio,
    ShieldAlert,
    Sparkles,
    TrendingDown,
    TrendingUp,
    Zap,
} from "lucide-react";
import type { DependencyIntelligenceData } from "@/lib/analytics/types";
import { DashboardFilterBar } from "./dashboard-filter-bar";
import { DependencyTopologyGraph } from "./dependency-topology-graph";

interface DependencyIntelligenceClientProps {
    data: DependencyIntelligenceData;
    projects: Array<{ id: string; name: string }>;
    environments: string[];
    currentProjectId?: string;
    currentEnvironment?: string;
    currentTimeRange?: string;
}

export function DependencyIntelligenceClient({
    data,
    projects,
    environments,
    currentProjectId = "ALL",
    currentEnvironment = "ALL",
    currentTimeRange = "24h",
}: DependencyIntelligenceClientProps) {
    const { nodes, edges, observedCallTotal, provenance } = data;

    return (
        <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-mono text-xs">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-accent/15 text-accent border border-accent/30">
                            <Network size={18} />
                        </span>
                        <h1 className="text-xl font-bold text-white tracking-tight font-sans">
                            Dependency Intelligence
                        </h1>
                    </div>
                    <p className="text-secondary text-xs font-sans">
                        Observed service topology, distributed trace linkages, and real blast radius analyzer.
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

            {/* Topology & Blast Radius Graph */}
            <DependencyTopologyGraph
                nodes={nodes}
                edges={edges}
                criticalPaths={data.criticalPaths}
                observedCallTotal={observedCallTotal}
                projectId={currentProjectId !== "ALL" ? currentProjectId : undefined}
            />
        </div>
    );
}
