"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Activity,
    ShieldAlert,
    AlertTriangle,
    HelpCircle,
    CheckCircle2,
    Sparkles,
    ArrowUpRight,
    ArrowRight,
    Search,
    TrendingUp,
    TrendingDown,
    Layers,
    GitBranch,
    Server,
    Calendar,
    ExternalLink,
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

interface ServiceHealthClientProps {
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
}

export function ServiceHealthClient({
    initialServices,
    summary,
    timeRangeKey,
    environments,
}: ServiceHealthClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [selectedHealth, setSelectedHealth] = useState<HealthStatus | "ALL">(
        (searchParams.get("health") as HealthStatus) || "ALL"
    );
    const [selectedEnv, setSelectedEnv] = useState<string>(searchParams.get("environment") || "ALL");
    const [selectedTimeRange, setSelectedTimeRange] = useState<string>(timeRangeKey || "24h");
    const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");

    const updateFilter = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "ALL" || !value) {
            params.delete(key);
        } else {
            params.set(key, value);
        }
        router.replace(`/services/health?${params.toString()}`);
    };

    const filteredServices = initialServices.filter((s) => {
        if (selectedHealth !== "ALL" && s.health !== selectedHealth) return false;
        if (selectedEnv !== "ALL" && s.environment.toLowerCase() !== selectedEnv.toLowerCase() && !s.environments.includes(selectedEnv)) return false;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            return (
                s.name.toLowerCase().includes(q) ||
                s.projectName.toLowerCase().includes(q) ||
                s.environment.toLowerCase().includes(q)
            );
        }
        return true;
    });

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Service Health</h1>
                    <p className="text-sm text-secondary mt-1">
                        Current operational health and evidence-based status across discovered services.
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

            {/* Health Distribution Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <button
                    onClick={() => {
                        setSelectedHealth(selectedHealth === "Healthy" ? "ALL" : "Healthy");
                        updateFilter("health", selectedHealth === "Healthy" ? "ALL" : "Healthy");
                    }}
                    className={`p-4 rounded-xl text-left border transition-all ${
                        selectedHealth === "Healthy"
                            ? "bg-emerald-500/15 border-emerald-500/40 shadow-sm"
                            : "bg-surface border-emerald-500/20 hover:border-emerald-500/40"
                    } space-y-2`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-semibold text-emerald-400 uppercase tracking-wider">
                            Healthy
                        </span>
                        <CheckCircle2 size={16} className="text-emerald-400" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-white font-mono">{summary.healthy}</span>
                        <span className="text-xs text-secondary font-mono">
                            ({summary.total > 0 ? Math.round((summary.healthy / summary.total) * 100) : 0}%)
                        </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-tight">
                        Operating normally within baseline error and latency thresholds.
                    </p>
                </button>

                <button
                    onClick={() => {
                        setSelectedHealth(selectedHealth === "Degraded" ? "ALL" : "Degraded");
                        updateFilter("health", selectedHealth === "Degraded" ? "ALL" : "Degraded");
                    }}
                    className={`p-4 rounded-xl text-left border transition-all ${
                        selectedHealth === "Degraded"
                            ? "bg-amber-500/15 border-amber-500/40 shadow-sm"
                            : "bg-surface border-amber-500/20 hover:border-amber-500/40"
                    } space-y-2`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-semibold text-amber-400 uppercase tracking-wider">
                            Degraded
                        </span>
                        <AlertTriangle size={16} className="text-amber-400" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-amber-400 font-mono">{summary.degraded}</span>
                        <span className="text-xs text-secondary font-mono">
                            ({summary.total > 0 ? Math.round((summary.degraded / summary.total) * 100) : 0}%)
                        </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-tight">
                        Elevated failure rates or significant latency regression vs baseline.
                    </p>
                </button>

                <button
                    onClick={() => {
                        setSelectedHealth(selectedHealth === "Critical" ? "ALL" : "Critical");
                        updateFilter("health", selectedHealth === "Critical" ? "ALL" : "Critical");
                    }}
                    className={`p-4 rounded-xl text-left border transition-all ${
                        selectedHealth === "Critical"
                            ? "bg-red-500/15 border-red-500/40 shadow-sm"
                            : "bg-surface border-red-500/20 hover:border-red-500/40"
                    } space-y-2`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-semibold text-red-400 uppercase tracking-wider">
                            Critical
                        </span>
                        <ShieldAlert size={16} className="text-red-400" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-red-400 font-mono">{summary.critical}</span>
                        <span className="text-xs text-secondary font-mono">
                            ({summary.total > 0 ? Math.round((summary.critical / summary.total) * 100) : 0}%)
                        </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-tight">
                        Critical failure rate ≥ 20%, fatal exceptions, or active firing monitors.
                    </p>
                </button>

                <button
                    onClick={() => {
                        setSelectedHealth(selectedHealth === "Unknown" ? "ALL" : "Unknown");
                        updateFilter("health", selectedHealth === "Unknown" ? "ALL" : "Unknown");
                    }}
                    className={`p-4 rounded-xl text-left border transition-all ${
                        selectedHealth === "Unknown"
                            ? "bg-zinc-800 border-zinc-500 shadow-sm"
                            : "bg-surface border-zinc-700/50 hover:border-zinc-500"
                    } space-y-2`}
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-semibold text-zinc-400 uppercase tracking-wider">
                            Unknown
                        </span>
                        <HelpCircle size={16} className="text-zinc-500" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-zinc-400 font-mono">{summary.unknown}</span>
                        <span className="text-xs text-secondary font-mono">
                            ({summary.total > 0 ? Math.round((summary.unknown / summary.total) * 100) : 0}%)
                        </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-tight">
                        Insufficient telemetry observed in the selected operational window.
                    </p>
                </button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-border">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search health by service name..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            updateFilter("search", e.target.value);
                        }}
                        className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-accent"
                    />
                </div>

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
                </div>
            </div>

            {/* Priority Service Health Cards */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                        Operational Health Hierarchy
                    </h2>
                    <span className="text-xs text-muted font-mono">
                        Ordered by operational severity (Critical → Degraded → Unknown → Healthy)
                    </span>
                </div>

                {filteredServices.length === 0 ? (
                    <div className="p-12 rounded-xl bg-surface border border-border text-center space-y-3">
                        <HelpCircle className="w-8 h-8 text-muted mx-auto" />
                        <h3 className="text-sm font-semibold text-white">
                            {selectedHealth !== "ALL"
                                ? `No ${selectedHealth.toLowerCase()} services found.`
                                : "No services match the selected health filters."}
                        </h3>
                        <p className="text-xs text-secondary">
                            Try resetting your filters or switching to a larger time window.
                        </p>
                        <button
                            onClick={() => {
                                setSelectedHealth("ALL");
                                setSelectedEnv("ALL");
                                setSearchQuery("");
                                router.replace("/services/health");
                            }}
                            className="halo-btn halo-btn-secondary halo-btn-xs inline-flex mt-2"
                        >
                            Reset filters
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredServices.map((service) => {
                            const isCritical = service.health === "Critical";
                            const isDegraded = service.health === "Degraded";
                            const isUnknown = service.health === "Unknown";
                            const isHealthy = service.health === "Healthy";

                            const borderClass = isCritical
                                ? "border-red-500/30 bg-red-500/[0.03]"
                                : isDegraded
                                ? "border-amber-500/30 bg-amber-500/[0.03]"
                                : isUnknown
                                ? "border-zinc-700 bg-surface"
                                : "border-border bg-surface";

                            return (
                                <div
                                    key={`${service.name}-${service.projectId}`}
                                    className={`p-4 rounded-xl border ${borderClass} transition-all space-y-3`}
                                >
                                    {/* Top Row: Identity & Status */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <Link
                                                href={`/services/${encodeURIComponent(service.name)}`}
                                                className="text-base font-bold text-white hover:text-accent font-mono transition-colors"
                                            >
                                                {service.name}
                                            </Link>

                                            <span
                                                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono font-semibold border ${
                                                    isCritical
                                                        ? "bg-red-500/10 text-red-400 border-red-500/30"
                                                        : isDegraded
                                                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                                        : isUnknown
                                                        ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                                                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                                }`}
                                            >
                                                <span
                                                    className={`w-1.5 h-1.5 rounded-full ${
                                                        isCritical
                                                            ? "bg-red-400 animate-pulse"
                                                            : isDegraded
                                                            ? "bg-amber-400"
                                                            : isUnknown
                                                            ? "bg-zinc-500"
                                                            : "bg-emerald-400"
                                                    }`}
                                                />
                                                {service.health}
                                            </span>

                                            {/* Health Transition Detection */}
                                            {service.healthTransition && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-zinc-300">
                                                    <span>Previous: {service.healthTransition.previousHealth}</span>
                                                    <ArrowRight size={10} className="text-muted" />
                                                    <span className="text-white font-semibold">
                                                        {service.healthTransition.currentHealth}
                                                    </span>
                                                </span>
                                            )}

                                            <span className="text-[11px] font-mono text-zinc-500">
                                                {service.environment} • {service.projectName}
                                            </span>
                                        </div>

                                        {/* Action Matrix */}
                                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                            {isCritical && (
                                                <Link
                                                    href={`/projects/${service.projectId}/investigations/new?service=${encodeURIComponent(
                                                        service.name
                                                    )}`}
                                                    className="halo-btn halo-btn-primary halo-btn-xs"
                                                >
                                                    <ShieldAlert size={11} />
                                                    <span>Investigate Critical State</span>
                                                </Link>
                                            )}

                                            {isDegraded && (
                                                <Link
                                                    href={`/projects/${service.projectId}/investigations/new?service=${encodeURIComponent(
                                                        service.name
                                                    )}`}
                                                    className="halo-btn halo-btn-primary halo-btn-xs"
                                                >
                                                    <Sparkles size={11} />
                                                    <span>Investigate Degradation</span>
                                                </Link>
                                            )}

                                            {isHealthy && (
                                                <Link
                                                    href={`/services/${encodeURIComponent(service.name)}`}
                                                    className="halo-btn halo-btn-secondary halo-btn-xs"
                                                >
                                                    <Server size={11} />
                                                    <span>View Service</span>
                                                </Link>
                                            )}

                                            {isUnknown && (
                                                <>
                                                    <Link
                                                        href={`/services/${encodeURIComponent(service.name)}`}
                                                        className="halo-btn halo-btn-secondary halo-btn-xs"
                                                    >
                                                        <Server size={11} />
                                                        <span>View Service</span>
                                                    </Link>
                                                    <Link
                                                        href={`/explore?service=${encodeURIComponent(service.name)}`}
                                                        className="halo-btn halo-btn-secondary halo-btn-xs"
                                                    >
                                                        <ExternalLink size={11} />
                                                        <span>Explore Telemetry</span>
                                                    </Link>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Middle Row: Primary Health Signals (Null-safe Zero vs No Data) */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                                        <div className="p-2.5 rounded-lg bg-surface-elevated border border-border">
                                            <span className="text-[10px] text-zinc-500 uppercase block">
                                                Error Rate
                                            </span>
                                            <span
                                                className={`text-sm font-bold block mt-0.5 ${
                                                    service.metrics.errorRate !== null && service.metrics.errorRate >= 20
                                                        ? "text-red-400"
                                                        : service.metrics.errorRate !== null && service.metrics.errorRate >= 5
                                                        ? "text-amber-400"
                                                        : "text-zinc-200"
                                                }`}
                                            >
                                                {service.metrics.errorRate !== null
                                                    ? `${service.metrics.errorRate.toFixed(1)}%`
                                                    : "—"}
                                            </span>
                                            <span className="text-[10px] text-zinc-500">
                                                {service.metrics.errorCount} error(s)
                                            </span>
                                        </div>

                                        <div className="p-2.5 rounded-lg bg-surface-elevated border border-border">
                                            <span className="text-[10px] text-zinc-500 uppercase block">
                                                p95 Latency
                                            </span>
                                            <span className="text-sm font-bold text-white block mt-0.5">
                                                {service.metrics.p95LatencyMs !== null
                                                    ? `${service.metrics.p95LatencyMs}ms`
                                                    : "—"}
                                            </span>
                                            <span className="text-[10px] text-zinc-500">
                                                Avg: {service.metrics.avgLatencyMs ? `${service.metrics.avgLatencyMs}ms` : "—"}
                                            </span>
                                        </div>

                                        <div className="p-2.5 rounded-lg bg-surface-elevated border border-border">
                                            <span className="text-[10px] text-zinc-500 uppercase block">
                                                Request Volume
                                            </span>
                                            <span className="text-sm font-bold text-white block mt-0.5">
                                                {service.metrics.requestCount > 0
                                                    ? service.metrics.requestCount.toLocaleString()
                                                    : "No data"}
                                            </span>
                                            <span className="text-[10px] text-zinc-500">
                                                Active trend: {service.trend}
                                            </span>
                                        </div>

                                        <div className="p-2.5 rounded-lg bg-surface-elevated border border-border">
                                            <span className="text-[10px] text-zinc-500 uppercase block">
                                                Active Issues
                                            </span>
                                            <span className="text-sm font-bold text-white block mt-0.5">
                                                {service.metrics.activeIssuesCount} open
                                            </span>
                                            <Link
                                                href={`/issues?service=${encodeURIComponent(service.name)}`}
                                                className="text-[10px] text-accent hover:underline block"
                                            >
                                                View in Issues →
                                            </Link>
                                        </div>
                                    </div>

                                    {/* Bottom Row: Evidence-backed Reason */}
                                    <div className="p-2.5 rounded-lg bg-[#080c12] border border-border/80 flex items-start gap-2 text-xs font-mono">
                                        <span className="text-[10px] text-zinc-500 uppercase shrink-0 mt-0.5 font-sans font-semibold">
                                            Health Rationale:
                                        </span>
                                        <p className="text-zinc-300 leading-relaxed">
                                            {service.healthReason}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
