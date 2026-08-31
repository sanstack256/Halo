"use client";

import React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
    Calendar,
    Check,
    ChevronDown,
    Filter,
    FolderKanban,
    Globe,
    Info,
    RotateCcw,
    Layers,
    Sparkles,
} from "lucide-react";
import { HaloSelect } from "@/components/ui/halo-select";
import type { TimeRangeKey, DataProvenance } from "@/lib/analytics/types";
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
        <div className="p-3.5 rounded-2xl bg-surface border border-border flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            {/* Left Filter Group */}
            <div className="flex flex-wrap items-center gap-2.5">
                {/* Project Selector */}
                {projects.length > 1 && (
                    <div className="flex items-center gap-1.5">
                        <FolderKanban size={13} className="text-muted" />
                        <HaloSelect
                            value={currentProjectId}
                            onChange={(val) => updateFilter("projectId", val)}
                            options={projectOptions}
                        />
                    </div>
                )}

                {/* Environment Selector */}
                <div className="flex items-center gap-1.5">
                    <Globe size={13} className="text-muted" />
                    <HaloSelect
                        value={currentEnvironment}
                        onChange={(val) => updateFilter("environment", val)}
                        options={envOptions}
                    />
                </div>

                {/* Time Range Selector */}
                <div className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-muted" />
                    <HaloSelect
                        value={currentTimeRange}
                        onChange={(val) => updateFilter("range", val)}
                        options={timeRangeOptions}
                    />
                </div>

                {/* Optional Service Filter */}
                {showServiceFilter && services.length > 0 && (
                    <div className="flex items-center gap-1.5">
                        <Layers size={13} className="text-muted" />
                        <HaloSelect
                            value={currentService}
                            onChange={(val) => updateFilter("service", val)}
                            options={serviceOptions}
                        />
                    </div>
                )}

                {/* Comparison Mode Toggle */}
                {showComparisonToggle && (
                    <button
                        type="button"
                        onClick={() =>
                            updateFilter("compare", isComparing ? "NONE" : "PREVIOUS_PERIOD")
                        }
                        className={`h-8 px-3 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                            isComparing
                                ? "bg-accent/15 border-accent/40 text-accent font-semibold shadow-sm"
                                : "bg-[#080b11] border-border text-secondary hover:border-border-strong hover:text-white"
                        }`}
                        title="Compare current window against previous symmetrical period"
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${isComparing ? "bg-accent" : "bg-muted"}`} />
                        <span>Compare: Previous Period</span>
                    </button>
                )}
            </div>

            {/* Right Provenance / Inspection Button */}
            {provenance && (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsProvenanceOpen(true)}
                        className="h-8 px-3 rounded-lg border border-border bg-[#080b11] text-secondary hover:text-white hover:border-border-strong transition-colors flex items-center gap-1.5"
                    >
                        <Info size={13} className="text-accent" />
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
