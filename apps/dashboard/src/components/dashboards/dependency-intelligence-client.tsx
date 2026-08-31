"use client";

import React from "react";
import Link from "next/link";
import {
    Activity,
    Layers,
    Network,
    Radio,
    ShieldAlert,
    Sparkles,
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
    currentService?: string;
}

export function DependencyIntelligenceClient({
    data,
    projects,
    environments,
    currentProjectId = "ALL",
    currentEnvironment = "ALL",
    currentTimeRange = "24h",
    currentService = "ALL",
}: DependencyIntelligenceClientProps) {
    const { nodes, edges, criticalPaths, observedCallTotal, provenance } = data;

    return (
        <div className="halo-dash-shell">
            {/* Header */}
            <div className="halo-dash-header">
                <nav className="halo-dash-breadcrumb" aria-label="Breadcrumb">
                    <Link href="/dashboards" className="halo-dash-breadcrumb-item">Dashboards</Link>
                    <span className="halo-dash-breadcrumb-sep">/</span>
                    <span className="halo-dash-breadcrumb-current">Dependency Intelligence</span>
                </nav>
                <div className="halo-dash-title-row">
                    <div className="halo-dash-title-group">
                        <div className="halo-dash-icon-box">
                            <Network size={18} />
                        </div>
                        <div>
                            <h1 className="halo-dash-title">Dependency Intelligence</h1>
                            <p className="halo-dash-desc">
                                Reconstructed service topology graph from distributed trace spans, blast radius exposure, and causal dependency paths.
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

            {/* Topology Graph & Blast Radius View */}
            <DependencyTopologyGraph
                nodes={nodes}
                edges={edges}
                criticalPaths={criticalPaths}
                observedCallTotal={observedCallTotal}
                projectId={currentProjectId !== "ALL" ? currentProjectId : undefined}
            />
        </div>
    );
}
