"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Server,
    Activity,
    AlertCircle,
    ShieldAlert,
    HelpCircle,
    Search,
    Filter,
    ArrowUpDown,
    ExternalLink,
    MoreHorizontal,
    GitBranch,
    Users,
    Clock,
    Layers,
    Code,
    Sparkles,
    CheckCircle2,
    Calendar,
} from "lucide-react";
import type { CanonicalService, HealthStatus } from "@/lib/services/service-registry";
import { RelativeTime } from "@/components/ui/relative-time";
import { HaloSelect, type HaloSelectOption } from "@/components/ui/halo-select";

const TIME_RANGE_OPTIONS: HaloSelectOption[] = [
    { value: "1h", label: "Last 1 hour" },
    { value: "6h", label: "Last 6 hours" },
    { value: "24h", label: "Last 24 hours" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
];

const HEALTH_OPTIONS: HaloSelectOption[] = [
    { value: "ALL", label: "All Health States" },
    { value: "Critical", label: "Critical Only" },
    { value: "Degraded", label: "Degraded Only" },
    { value: "Healthy", label: "Healthy Only" },
    { value: "Unknown", label: "Unknown Only" },
];

const SORT_OPTIONS: HaloSelectOption[] = [
    { value: "severity", label: "Sort: Health Severity" },
    { value: "errors", label: "Sort: Highest Error Rate" },
    { value: "latency", label: "Sort: p95 Latency" },
    { value: "volume", label: "Sort: Request Volume" },
    { value: "recent", label: "Sort: Last Active" },
];

interface ServicesInventoryClientProps {
    initialServices: CanonicalService[];
    summary: {
        total: number;
        healthy: number;
        degraded: number;
        critical: number;
        unknown: number;
    };
    timeRangeKey: string;
    environments: string[];
    owners: string[];
}

export function ServicesInventoryClient({
    initialServices,
    summary,
    timeRangeKey,
    environments,
    owners,
}: ServicesInventoryClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
    const [selectedHealth, setSelectedHealth] = useState<HealthStatus | "ALL">(
        (searchParams.get("health") as HealthStatus) || "ALL"
    );
    const [selectedEnv, setSelectedEnv] = useState<string>(searchParams.get("environment") || "ALL");
    const [selectedOwner, setSelectedOwner] = useState<string>(searchParams.get("owner") || "ALL");
    const [selectedTimeRange, setSelectedTimeRange] = useState<string>(timeRangeKey || "24h");
    const [sortBy, setSortBy] = useState<"severity" | "errors" | "latency" | "volume" | "recent">("severity");
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    // Update query params while preserving all other active filters
    const updateFilter = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "ALL" || !value) {
            params.delete(key);
        } else {
            params.set(key, value);
        }
        router.replace(`/services?${params.toString()}`);
    };

    const clearAllFilters = () => {
        setSearchQuery("");
        setSelectedHealth("ALL");
        setSelectedEnv("ALL");
        setSelectedOwner("ALL");
        const params = new URLSearchParams();
        if (selectedTimeRange !== "24h") {
            params.set("timeRange", selectedTimeRange);
        }
        router.replace(`/services${params.toString() ? `?${params.toString()}` : ""}`);
    };

    const filteredServices = useMemo(() => {
        let list = [...initialServices];

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(
                (s) =>
                    s.name.toLowerCase().includes(q) ||
                    s.projectName.toLowerCase().includes(q) ||
                    (s.repository && s.repository.toLowerCase().includes(q)) ||
                    s.owner.toLowerCase().includes(q) ||
                    s.environment.toLowerCase().includes(q)
            );
        }

        if (selectedHealth !== "ALL") {
            list = list.filter((s) => s.health === selectedHealth);
        }

        if (selectedEnv !== "ALL") {
            list = list.filter((s) => s.environment.toLowerCase() === selectedEnv.toLowerCase() || s.environments.includes(selectedEnv));
        }

        if (selectedOwner !== "ALL") {
            list = list.filter((s) => s.owner === selectedOwner);
        }

        // Sorting
        const healthWeight: Record<HealthStatus, number> = {
            Critical: 4,
            Degraded: 3,
            Unknown: 2,
            Healthy: 1,
        };

        list.sort((a, b) => {
            if (sortBy === "severity") {
                const diff = healthWeight[b.health] - healthWeight[a.health];
                if (diff !== 0) return diff;
                return b.metrics.errorCount - a.metrics.errorCount || b.metrics.requestCount - a.metrics.requestCount;
            }
            if (sortBy === "errors") {
                const aRate = a.metrics.errorRate ?? -1;
                const bRate = b.metrics.errorRate ?? -1;
                return bRate - aRate || b.metrics.errorCount - a.metrics.errorCount;
            }
            if (sortBy === "latency") {
                return (b.metrics.p95LatencyMs || 0) - (a.metrics.p95LatencyMs || 0);
            }
            if (sortBy === "volume") {
                return b.metrics.requestCount - a.metrics.requestCount;
            }
            if (sortBy === "recent") {
                const aTime = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
                const bTime = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
                return bTime - aTime;
            }
            return 0;
        });

        return list;
    }, [initialServices, searchQuery, selectedHealth, selectedEnv, selectedOwner, sortBy]);

    const getHealthBadge = (health: HealthStatus) => {
        switch (health) {
            case "Healthy":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Healthy
                    </span>
                );
            case "Degraded":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-mono font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        Degraded
                    </span>
                );
            case "Critical":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-mono font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        Critical
                    </span>
                );
            case "Unknown":
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs font-mono font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                        Unknown
                    </span>
                );
        }
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Services</h1>
                    <p className="text-sm text-secondary mt-1">
                        Your application&apos;s service inventory and current operational state.
                    </p>
                </div>

                {/* Time Range Selector */}
                <div className="flex items-center gap-2">
                    <HaloSelect
                        value={selectedTimeRange}
                        onChange={(val) => {
                            setSelectedTimeRange(val);
                            updateFilter("timeRange", val);
                        }}
                        options={TIME_RANGE_OPTIONS}
                        ariaLabel="Filter by time window"
                    />
                </div>
            </div>

            {/* Summary Strip (Structured Interactive Metric Strip) */}
            <div className="halo-metric-strip grid-cols-2 sm:grid-cols-5">
                <button
                    onClick={() => {
                        setSelectedHealth("ALL");
                        updateFilter("health", "ALL");
                    }}
                    className={`halo-metric-cell text-left transition-all ${
                        selectedHealth === "ALL"
                            ? "bg-surface-elevated ring-1 ring-inset ring-accent/40"
                            : "hover:bg-surface-elevated"
                    }`}
                >
                    <span className="text-[10px] text-muted uppercase tracking-wider block font-mono font-semibold">
                        Total Services
                    </span>
                    <span className="text-2xl font-bold text-white font-sans mt-1 block">{summary.total}</span>
                </button>

                <button
                    onClick={() => {
                        setSelectedHealth("Healthy");
                        updateFilter("health", "Healthy");
                    }}
                    className={`halo-metric-cell text-left transition-all ${
                        selectedHealth === "Healthy"
                            ? "bg-surface-elevated ring-1 ring-inset ring-emerald-500/40"
                            : "hover:bg-surface-elevated"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-emerald-400/90 uppercase tracking-wider font-mono font-semibold">
                            Healthy
                        </span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    </div>
                    <span className="text-2xl font-bold text-emerald-400 font-sans mt-1 block">{summary.healthy}</span>
                </button>

                <button
                    onClick={() => {
                        setSelectedHealth("Degraded");
                        updateFilter("health", "Degraded");
                    }}
                    className={`halo-metric-cell text-left transition-all ${
                        selectedHealth === "Degraded"
                            ? "bg-surface-elevated ring-1 ring-inset ring-amber-500/40"
                            : "hover:bg-surface-elevated"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-amber-400/90 uppercase tracking-wider font-mono font-semibold">
                            Degraded
                        </span>
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                    </div>
                    <span className="text-2xl font-bold text-amber-400 font-sans mt-1 block">{summary.degraded}</span>
                </button>

                <button
                    onClick={() => {
                        setSelectedHealth("Critical");
                        updateFilter("health", "Critical");
                    }}
                    className={`halo-metric-cell text-left transition-all ${
                        selectedHealth === "Critical"
                            ? "bg-surface-elevated ring-1 ring-inset ring-red-500/40"
                            : "hover:bg-surface-elevated"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-red-400/90 uppercase tracking-wider font-mono font-semibold">
                            Critical
                        </span>
                        <span className="w-2 h-2 rounded-full bg-red-400" />
                    </div>
                    <span className="text-2xl font-bold text-red-400 font-sans mt-1 block">{summary.critical}</span>
                </button>

                <button
                    onClick={() => {
                        setSelectedHealth("Unknown");
                        updateFilter("health", "Unknown");
                    }}
                    className={`halo-metric-cell text-left transition-all ${
                        selectedHealth === "Unknown"
                            ? "bg-surface-elevated ring-1 ring-inset ring-zinc-500/40"
                            : "hover:bg-surface-elevated"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono font-semibold">
                            Unknown
                        </span>
                        <HelpCircle size={12} className="text-zinc-500" />
                    </div>
                    <span className="text-2xl font-bold text-zinc-300 font-sans mt-1 block">{summary.unknown}</span>
                </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-border">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search services by name, repository, owner, or environment..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            updateFilter("search", e.target.value);
                        }}
                        className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-accent"
                    />
                </div>

                {/* Filter Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                    <HaloSelect
                        value={selectedHealth}
                        onChange={(val) => {
                            setSelectedHealth(val as any);
                            updateFilter("health", val);
                        }}
                        options={HEALTH_OPTIONS}
                        ariaLabel="Filter by health state"
                    />

                    <HaloSelect
                        value={selectedEnv}
                        onChange={(val) => {
                            setSelectedEnv(val);
                            updateFilter("environment", val);
                        }}
                        options={[
                            { value: "ALL", label: "All Environments" },
                            ...environments.map((env) => ({ value: env, label: env })),
                        ]}
                        ariaLabel="Filter by environment"
                    />

                    {owners.length > 0 && (
                        <HaloSelect
                            value={selectedOwner}
                            onChange={(val) => {
                                setSelectedOwner(val);
                                updateFilter("owner", val);
                            }}
                            options={[
                                { value: "ALL", label: "All Owners" },
                                ...owners.map((owner) => ({ value: owner, label: owner })),
                            ]}
                            ariaLabel="Filter by owner"
                        />
                    )}

                    <HaloSelect
                        value={sortBy}
                        onChange={(val) => setSortBy(val as any)}
                        options={SORT_OPTIONS}
                        ariaLabel="Sort by"
                    />
                </div>
            </div>

            {/* Service Inventory Table or Precise Empty States */}
            {summary.total === 0 ? (
                /* CASE A: No services discovered at all */
                <div className="p-12 rounded-xl bg-surface border border-border text-center space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto text-accent">
                        <Server size={24} />
                    </div>
                    <div className="space-y-1 max-w-md mx-auto">
                        <h3 className="text-base font-semibold text-white">No services discovered yet</h3>
                        <p className="text-xs text-secondary leading-relaxed">
                            Halo automatically discovers microservices as telemetry events, traces, and errors arrive from your applications.
                        </p>
                    </div>
                    <div className="pt-2">
                        <Link href="/sdk" className="halo-btn halo-btn-primary halo-btn-sm">
                            <Code size={13} />
                            <span>Connect Telemetry SDK</span>
                        </Link>
                    </div>
                </div>
            ) : filteredServices.length === 0 ? (
                /* CASE B: Services exist but zero match current active filters */
                <div className="p-12 rounded-xl bg-surface border border-border text-center space-y-3">
                    <Filter className="w-8 h-8 text-muted mx-auto" />
                    <h3 className="text-sm font-semibold text-white">
                        {selectedHealth !== "ALL"
                            ? `No ${selectedHealth.toLowerCase()} services match the current filters.`
                            : searchQuery.trim()
                            ? `No services match "${searchQuery.trim()}".`
                            : "No services match the current filters."}
                    </h3>
                    <p className="text-xs text-secondary max-w-md mx-auto">
                        {selectedHealth !== "ALL"
                            ? `There are ${summary.total} total discovered services in the system, but none currently evaluate to the '${selectedHealth}' status.`
                            : "Try resetting your search query or adjusting your environment or health filters."}
                    </p>
                    <div className="pt-2">
                        <button
                            onClick={clearAllFilters}
                            className="halo-btn halo-btn-secondary halo-btn-sm"
                        >
                            <span>Clear all filters</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="halo-table rounded-xl overflow-hidden border border-border">
                    {/* Table Header */}
                    <div className="halo-table-header grid-cols-[1.4fr_110px_130px_100px_90px_90px_80px_120px_40px] px-4 py-3 bg-[#080c12] text-[11px] font-mono font-semibold text-zinc-400 border-b border-border">
                        <div>Service Name</div>
                        <div>Health</div>
                        <div>Environment / Repo</div>
                        <div className="text-right">Volume</div>
                        <div className="text-right">Error Rate</div>
                        <div className="text-right">p95 Latency</div>
                        <div className="text-center">Deps</div>
                        <div>Last Active</div>
                        <div className="text-right"></div>
                    </div>

                    {/* Table Rows */}
                    <div className="divide-y divide-border/60">
                        {filteredServices.map((service) => (
                            <div
                                key={`${service.name}-${service.projectId}`}
                                className="halo-table-row grid-cols-[1.4fr_110px_130px_100px_90px_90px_80px_120px_40px] px-4 py-3.5 items-center hover:bg-surface-elevated/80 transition-colors group cursor-pointer text-xs"
                                onClick={() => router.push(`/services/${encodeURIComponent(service.name)}`)}
                            >
                                {/* Service Name & Project */}
                                <div className="min-w-0 pr-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-white group-hover:text-accent transition-colors truncate font-mono">
                                            {service.name}
                                        </span>
                                        {service.currentRelease && (
                                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-surface border border-border text-zinc-400 truncate max-w-[90px]">
                                                {service.currentRelease}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500">
                                        <span className="truncate">{service.projectName}</span>
                                        {service.owner !== "Unassigned" && (
                                            <>
                                                <span>•</span>
                                                <span className="truncate">{service.owner}</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Health */}
                                <div>{getHealthBadge(service.health)}</div>

                                {/* Environment & Repo */}
                                <div className="text-[11px] text-zinc-400 truncate font-mono space-y-0.5">
                                    <div className="truncate">{service.environment}</div>
                                    {service.repository ? (
                                        <div className="text-[10px] text-zinc-500 truncate flex items-center gap-1">
                                            <GitBranch size={10} />
                                            <span>{service.repository}</span>
                                        </div>
                                    ) : (
                                        <div className="text-[10px] text-zinc-600">No repo linked</div>
                                    )}
                                </div>

                                {/* Volume (Zero vs No Data) */}
                                <div className="text-right font-mono text-zinc-200">
                                    {service.metrics.requestCount > 0 ? (
                                        <span>{service.metrics.requestCount.toLocaleString()}</span>
                                    ) : (
                                        <span className="text-zinc-600">No data</span>
                                    )}
                                </div>

                                {/* Error Rate (Zero vs No Data) */}
                                <div className="text-right font-mono">
                                    {service.metrics.errorRate !== null ? (
                                        <span
                                            className={
                                                service.metrics.errorRate >= 20
                                                    ? "text-red-400 font-bold"
                                                    : service.metrics.errorRate >= 5
                                                    ? "text-amber-400 font-semibold"
                                                    : "text-zinc-300"
                                            }
                                        >
                                            {service.metrics.errorRate.toFixed(1)}%
                                        </span>
                                    ) : (
                                        <span className="text-zinc-600">—</span>
                                    )}
                                </div>

                                {/* p95 Latency (Zero vs No Data) */}
                                <div className="text-right font-mono text-zinc-300">
                                    {service.metrics.p95LatencyMs !== null ? (
                                        <span>{service.metrics.p95LatencyMs}ms</span>
                                    ) : (
                                        <span className="text-zinc-600">—</span>
                                    )}
                                </div>

                                {/* Dependency Count */}
                                <div className="text-center font-mono text-zinc-400">
                                    <span className="px-1.5 py-0.5 rounded bg-surface border border-border text-[11px]">
                                        {service.metrics.dependencyCount}
                                    </span>
                                </div>

                                {/* Last Active */}
                                <div className="text-[11px] text-zinc-400 font-mono truncate">
                                    {service.lastSeen ? <RelativeTime date={service.lastSeen} /> : "No telemetry"}
                                </div>

                                {/* Context Menu */}
                                <div
                                    className="text-right relative"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuId(openMenuId === service.name ? null : service.name);
                                    }}
                                >
                                    <button className="p-1 rounded hover:bg-surface border border-transparent hover:border-border text-zinc-400 hover:text-white transition-colors">
                                        <MoreHorizontal size={14} />
                                    </button>

                                    {openMenuId === service.name && (
                                        <div className="absolute right-0 top-6 w-52 rounded-xl bg-[#0b1018] border border-border shadow-xl z-20 py-1.5 text-xs text-left font-sans">
                                            <Link
                                                href={`/services/${encodeURIComponent(service.name)}`}
                                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-elevated text-zinc-200 hover:text-white"
                                            >
                                                <Server size={13} className="text-muted" />
                                                <span>Open Service Detail</span>
                                            </Link>

                                            {service.health === "Critical" && (
                                                <Link
                                                    href={`/projects/${service.projectId}/investigations/new?service=${encodeURIComponent(
                                                        service.name
                                                    )}`}
                                                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-elevated text-red-400 hover:text-red-300"
                                                >
                                                    <ShieldAlert size={13} />
                                                    <span>Investigate Critical State</span>
                                                </Link>
                                            )}

                                            {service.health === "Degraded" && (
                                                <Link
                                                    href={`/projects/${service.projectId}/investigations/new?service=${encodeURIComponent(
                                                        service.name
                                                    )}`}
                                                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-elevated text-amber-400 hover:text-amber-300"
                                                >
                                                    <span>Investigate Degradation</span>
                                                </Link>
                                            )}

                                            <Link
                                                href={`/issues?service=${encodeURIComponent(service.name)}`}
                                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-elevated text-zinc-200 hover:text-white"
                                            >
                                                <AlertCircle size={13} className="text-muted" />
                                                <span>View Issues ({service.metrics.activeIssuesCount})</span>
                                            </Link>

                                            <Link
                                                href={`/explore?service=${encodeURIComponent(service.name)}`}
                                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-elevated text-zinc-200 hover:text-white"
                                            >
                                                <ExternalLink size={13} className="text-muted" />
                                                <span>Explore Telemetry</span>
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
