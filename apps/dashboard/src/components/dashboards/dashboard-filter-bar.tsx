"use client";

import React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
    Calendar,
    FolderKanban,
    Globe,
    Info,
    Layers,
} from "lucide-react";
import { HaloSelect } from "@/components/ui/halo-select";
import type { DataProvenance } from "@/lib/analytics/types";
import { DashboardProvenanceModal } from "./dashboard-provenance-modal";

interface DashboardFilterBarProps {
    projects: Array<{ id: string; name: string }>;
    environments?: string[];
    currentProjectId?: string;
    currentEnvironment?: string;
    currentTimeRange?: string;
    currentComparison?: string;
    provenance?: DataProvenance;
    showComparisonToggle?: boolean;
    showServiceFilter?: boolean;
    services?: string[];
    currentService?: string;
}

export function DashboardFilterBar({
    projects,
    environments = ["production", "staging", "development"],
    currentProjectId = "ALL",
    currentEnvironment = "ALL",
    currentTimeRange = "24h",
    currentComparison = "PREVIOUS_PERIOD",
    provenance,
    showComparisonToggle = true,
    showServiceFilter = false,
    services = [],
    currentService = "ALL",
}: DashboardFilterBarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [isProvenanceOpen, setIsProvenanceOpen] = React.useState(false);

    const updateFilter = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "ALL" || value === "" || (key === "compare" && value === "NONE")) {
            params.delete(key);
        } else {
            params.set(key, value);
        }
        router.push(`${pathname}?${params.toString()}`);
    };

    const projectOptions = [
        { value: "ALL", label: "All Projects" },
        ...projects.map((p) => ({ value: p.id, label: p.name })),
    ];

    const envOptions = [
        { value: "ALL", label: "All Environments" },
        ...environments.map((e) => ({ value: e, label: e.charAt(0).toUpperCase() + e.slice(1) })),
    ];

    const timeRangeOptions = [
        { value: "1h", label: "Past 1 Hour" },
        { value: "6h", label: "Past 6 Hours" },
        { value: "24h", label: "Past 24 Hours" },
        { value: "7d", label: "Past 7 Days" },
        { value: "30d", label: "Past 30 Days" },
    ];

    const serviceOptions = [
        { value: "ALL", label: "All Services" },
        ...services.map((s) => ({ value: s, label: s })),
    ];

    const isComparing = currentComparison === "PREVIOUS_PERIOD";

    return (
        <div className="halo-filter-surface">
            {/* Left Filter Controls Group */}
            <div className="halo-filter-group">
                {/* Project Selector */}
                {projects.length > 1 && (
                    <div className="flex items-center gap-1.5">
                        <FolderKanban size={13} className="text-muted shrink-0" />
                        <HaloSelect
                            value={currentProjectId}
                            onChange={(val) => updateFilter("projectId", val)}
                            options={projectOptions}
                        />
                    </div>
                )}

                {/* Environment Selector */}
                <div className="flex items-center gap-1.5">
                    <Globe size={13} className="text-muted shrink-0" />
                    <HaloSelect
                        value={currentEnvironment}
                        onChange={(val) => updateFilter("environment", val)}
                        options={envOptions}
                    />
                </div>

                {/* Optional Service Filter */}
                {showServiceFilter && services.length > 0 && (
                    <div className="flex items-center gap-1.5">
                        <Layers size={13} className="text-muted shrink-0" />
                        <HaloSelect
                            value={currentService}
                            onChange={(val) => updateFilter("service", val)}
                            options={serviceOptions}
                        />
                    </div>
                )}

                <div className="halo-filter-divider" />

                {/* Time Range Selector */}
                <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-muted shrink-0" />
                    <HaloSelect
                        value={currentTimeRange}
                        onChange={(val) => updateFilter("range", val)}
                        options={timeRangeOptions}
                    />
                </div>

                {/* Comparison Mode Toggle */}
                {showComparisonToggle && (
                    <button
                        type="button"
                        onClick={() =>
                            updateFilter("compare", isComparing ? "NONE" : "PREVIOUS_PERIOD")
                        }
                        className={`halo-filter-btn ${isComparing ? "is-active" : ""}`}
                        title="Compare current window against previous symmetrical period"
                    >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isComparing ? "bg-accent" : "bg-muted"}`} />
                        <span>Compare: Previous Period</span>
                    </button>
                )}
            </div>

            {/* Right Provenance Action */}
            {provenance && (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsProvenanceOpen(true)}
                        className="halo-filter-btn"
                        title="Inspect telemetry sources and analytics provenance"
                    >
                        <Info size={13} className="text-accent shrink-0" />
                        <span>Data Provenance</span>
                    </button>

                    {isProvenanceOpen && (
                        <DashboardProvenanceModal
                            provenance={provenance}
                            onClose={() => setIsProvenanceOpen(false)}
                        />
                    )}
                </div>
            )}
        </div>
    );
}
