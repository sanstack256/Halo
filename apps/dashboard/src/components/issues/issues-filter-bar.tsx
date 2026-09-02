"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, Calendar, Filter, X } from "lucide-react";

interface IssuesFilterBarProps {
    projects: Array<{ id: string; name: string }>;
    services: string[];
    environments: string[];
}

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

    return (
        <div className="p-3.5 rounded-xl bg-surface border border-border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs font-mono">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                    type="text"
                    placeholder="Search issues, services, or error signatures..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onBlur={() => updateParam("search", searchQuery.trim())}
                    className="w-full pl-8 pr-4 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-accent"
                />
            </form>

            {/* Filter Selectors */}
            <div className="flex items-center gap-2 flex-wrap">
                {/* Time Range */}
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border">
                    <Calendar size={12} className="text-muted" />
                    <span className="text-zinc-500">Window:</span>
                    <select
                        value={selectedTimeRange}
                        onChange={(e) => updateParam("timeRange", e.target.value)}
                        className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
                    >
                        <option value="1h" className="bg-[#0b1018]">Last 1 hour</option>
                        <option value="6h" className="bg-[#0b1018]">Last 6 hours</option>
                        <option value="24h" className="bg-[#0b1018]">Last 24 hours</option>
                        <option value="7d" className="bg-[#0b1018]">Last 7 days</option>
                        <option value="30d" className="bg-[#0b1018]">Last 30 days</option>
                    </select>
                </div>

                {/* Project Filter */}
                <select
                    value={selectedProject}
                    onChange={(e) => updateParam("project", e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border text-zinc-300 focus:outline-none focus:border-accent"
                >
                    <option value="ALL">All Projects</option>
                    {projects.map((p) => (
                        <option key={p.id} value={p.id} className="bg-[#0b1018]">
                            {p.name}
                        </option>
                    ))}
                </select>

                {/* Service Filter */}
                <select
                    value={selectedService}
                    onChange={(e) => updateParam("service", e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border text-zinc-300 focus:outline-none focus:border-accent"
                >
                    <option value="ALL">All Services</option>
                    {services.map((s) => (
                        <option key={s} value={s} className="bg-[#0b1018]">
                            {s}
                        </option>
                    ))}
                </select>

                {/* Environment Filter */}
                <select
                    value={selectedEnv}
                    onChange={(e) => updateParam("environment", e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border text-zinc-300 focus:outline-none focus:border-accent"
                >
                    <option value="ALL">All Environments</option>
                    {environments.map((env) => (
                        <option key={env} value={env} className="bg-[#0b1018]">
                            {env}
                        </option>
                    ))}
                </select>

                {/* Reset Filters */}
                {hasActiveFilters && (
                    <button
                        onClick={clearAllFilters}
                        className="p-1.5 rounded-lg bg-surface-elevated border border-border text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
                        title="Clear filters"
                    >
                        <X size={13} />
                    </button>
                )}
            </div>
        </div>
    );
}
