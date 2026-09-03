"use client";

import React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X, FolderKanban, Globe, Server, Tag, Clock } from "lucide-react";
import { HaloSelect, type HaloSelectOption } from "@/components/ui/halo-select";

const TIME_RANGE_OPTIONS: HaloSelectOption[] = [
    { value: "15m", label: "Last 15 minutes" },
    { value: "1h", label: "Last 1 hour" },
    { value: "6h", label: "Last 6 hours" },
    { value: "24h", label: "Last 24 hours" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
];

interface ExploreContextBarProps {
    projects?: Array<{ id: string; name: string }>;
    environments?: Array<{ id: string; name: string; projectId: string }>;
    services?: string[];
    releases?: string[];
    contextOptions?: {
        projects: Array<{ id: string; name: string }>;
        environments: Array<{ id: string; name: string; projectId: string }>;
        services: string[];
        releases: string[];
    };
    searchPlaceholder?: string;
    showSearch?: boolean;
    showServiceFilter?: boolean;
    showReleaseFilter?: boolean;
}

export function ExploreContextBar({
    projects: directProjects,
    environments: directEnvs,
    services: directServices,
    releases: directReleases,
    contextOptions,
    searchPlaceholder = "Filter by identifier, message, resource...",
    showSearch = true,
    showServiceFilter = true,
    showReleaseFilter = true,
}: ExploreContextBarProps) {
    const projects = contextOptions?.projects || directProjects || [];
    const environments = contextOptions?.environments || directEnvs || [];
    const services = contextOptions?.services || directServices || [];
    const releases = contextOptions?.releases || directReleases || [];
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const currentProject = searchParams.get("projectId") || "ALL";
    const currentEnv = searchParams.get("environment") || "ALL";
    const currentService = searchParams.get("service") || "ALL";
    const currentRelease = searchParams.get("release") || "ALL";
    const currentTimeRange = searchParams.get("timeRange") || "24h";
    const currentSearch = searchParams.get("search") || "";

    const updateFilter = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "ALL" || !value) {
            params.delete(key);
        } else {
            params.set(key, value);
        }
        router.push(`${pathname}?${params.toString()}`);
    };

    const projectOptions: HaloSelectOption[] = [
        { value: "ALL", label: "All Projects" },
        ...projects.map((p) => ({ value: p.id, label: p.name })),
    ];

    const envOptions: HaloSelectOption[] = [
        { value: "ALL", label: "All Environments" },
        ...Array.from(new Set(environments.map((e) => e.name))).map((name) => ({
            value: name,
            label: name.charAt(0).toUpperCase() + name.slice(1),
        })),
    ];

    const serviceOptions: HaloSelectOption[] = [
        { value: "ALL", label: "All Services" },
        ...services.map((s) => ({ value: s, label: s })),
    ];

    const releaseOptions: HaloSelectOption[] = [
        { value: "ALL", label: "All Releases" },
        ...releases.map((r) => ({ value: r, label: r })),
    ];

    return (
        <div className="p-2.5 rounded-xl bg-surface border border-border flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                {/* Search field if enabled */}
                {showSearch && (
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
                        />
                        <input
                            type="text"
                            defaultValue={currentSearch}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    updateFilter("search", (e.target as HTMLInputElement).value);
                                }
                            }}
                            placeholder={searchPlaceholder}
                            className="w-full h-9 pl-8 pr-7 rounded-lg border border-border bg-[#080b11] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent font-sans"
                        />
                        {currentSearch && (
                            <button
                                type="button"
                                onClick={() => updateFilter("search", "")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                )}

                {/* Project Filter */}
                {projects.length > 1 && (
                    <div className="flex items-center gap-1.5">
                        <FolderKanban size={13} className="text-zinc-500 shrink-0" />
                        <HaloSelect
                            value={currentProject}
                            onChange={(val) => updateFilter("projectId", val)}
                            options={projectOptions}
                            ariaLabel="Filter by Project"
                        />
                    </div>
                )}

                {/* Environment Filter */}
                {envOptions.length > 1 && (
                    <div className="flex items-center gap-1.5">
                        <Globe size={13} className="text-zinc-500 shrink-0" />
                        <HaloSelect
                            value={currentEnv}
                            onChange={(val) => updateFilter("environment", val)}
                            options={envOptions}
                            ariaLabel="Filter by Environment"
                        />
                    </div>
                )}

                {/* Service Filter */}
                {showServiceFilter && serviceOptions.length > 1 && (
                    <div className="flex items-center gap-1.5">
                        <Server size={13} className="text-zinc-500 shrink-0" />
                        <HaloSelect
                            value={currentService}
                            onChange={(val) => updateFilter("service", val)}
                            options={serviceOptions}
                            ariaLabel="Filter by Service"
                        />
                    </div>
                )}

                {/* Release Filter */}
                {showReleaseFilter && releaseOptions.length > 1 && (
                    <div className="flex items-center gap-1.5">
                        <Tag size={13} className="text-zinc-500 shrink-0" />
                        <HaloSelect
                            value={currentRelease}
                            onChange={(val) => updateFilter("release", val)}
                            options={releaseOptions}
                            ariaLabel="Filter by Release"
                        />
                    </div>
                )}
            </div>

            {/* Time Window */}
            <div className="flex items-center gap-1.5 shrink-0">
                <Clock size={13} className="text-zinc-500 shrink-0" />
                <HaloSelect
                    value={currentTimeRange}
                    onChange={(val) => updateFilter("timeRange", val)}
                    options={TIME_RANGE_OPTIONS}
                    ariaLabel="Filter by Time Window"
                />
            </div>
        </div>
    );
}
