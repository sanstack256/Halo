"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { HaloSelect, type HaloSelectOption } from "@/components/ui/halo-select";

interface IssuesFilterBarProps {
    projects: Array<{ id: string; name: string }>;
    services: string[];
    environments: string[];
}

const TIME_RANGE_OPTIONS: HaloSelectOption[] = [
    { value: "1h", label: "Last 1 hour" },
    { value: "6h", label: "Last 6 hours" },
    { value: "24h", label: "Last 24 hours" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
];

export function IssuesFilterBar({
    projects,
    services,
    environments,
}: IssuesFilterBarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const selectedTimeRange = searchParams.get("timeRange") || "30d";
    const selectedProject = searchParams.get("project") || "ALL";
    const selectedEnv = searchParams.get("environment") || "ALL";
    const selectedService = searchParams.get("service") || "ALL";
    const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");

    const updateParam = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (!value || value === "ALL") {
            params.delete(key);
        } else {
            params.set(key, value);
        }
        router.replace(`${pathname}?${params.toString()}`);
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateParam("search", searchQuery.trim());
    };

    const hasActiveFilters =
        selectedProject !== "ALL" ||
        selectedEnv !== "ALL" ||
        selectedService !== "ALL" ||
        Boolean(searchParams.get("search"));

    const clearAllFilters = () => {
        const params = new URLSearchParams();
        if (selectedTimeRange !== "30d") params.set("timeRange", selectedTimeRange);
        router.replace(`${pathname}?${params.toString()}`);
        setSearchQuery("");
    };

    const projectOptions: HaloSelectOption[] = [
        { value: "ALL", label: "All Projects" },
        ...projects.map((p) => ({ value: p.id, label: p.name })),
    ];

    const serviceOptions: HaloSelectOption[] = [
        { value: "ALL", label: "All Services" },
        ...services.map((s) => ({ value: s, label: s })),
    ];

    const envOptions: HaloSelectOption[] = [
        { value: "ALL", label: "All Environments" },
        ...environments.map((env) => ({ value: env, label: env })),
    ];

    return (
        <div className="p-3 rounded-xl bg-surface border border-border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs font-mono">
            {/* Search Input (36px desktop height) */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                    type="text"
                    placeholder="Search issues, services, or signatures..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onBlur={() => updateParam("search", searchQuery.trim())}
                    className="w-full h-9 pl-9 pr-4 rounded-lg bg-[#080b11] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-accent transition-colors"
                />
            </form>

            {/* Filter Selectors using HaloSelect (Attached Solid Dark Dropdown System) */}
            <div className="flex items-center gap-2 flex-wrap">
                {/* Time Range */}
                <HaloSelect
                    value={selectedTimeRange}
                    onChange={(val) => updateParam("timeRange", val)}
                    options={TIME_RANGE_OPTIONS}
                    ariaLabel="Filter by time window"
                />

                {/* Project Filter */}
                <HaloSelect
                    value={selectedProject}
                    onChange={(val) => updateParam("project", val)}
                    options={projectOptions}
                    ariaLabel="Filter by project"
                />

                {/* Service Filter */}
                <HaloSelect
                    value={selectedService}
                    onChange={(val) => updateParam("service", val)}
                    options={serviceOptions}
                    ariaLabel="Filter by service"
                />

                {/* Environment Filter */}
                <HaloSelect
                    value={selectedEnv}
                    onChange={(val) => updateParam("environment", val)}
                    options={envOptions}
                    ariaLabel="Filter by environment"
                />

                {/* Reset Filters */}
                {hasActiveFilters && (
                    <button
                        onClick={clearAllFilters}
                        className="h-9 px-2.5 rounded-lg bg-[#080b11] border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-colors flex items-center gap-1 text-xs"
                        title="Clear active filters"
                        aria-label="Clear active filters"
                    >
                        <X size={13} />
                        <span className="hidden sm:inline text-[11px]">Clear</span>
                    </button>
                )}
            </div>
        </div>
    );
}
