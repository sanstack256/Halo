"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    Archive,
    ArrowRight,
    Check,
    Clock,
    Filter,
    Layers,
    RotateCcw,
    Search,
    Server,
    ShieldAlert,
    Sparkles,
    TrendingDown,
    TrendingUp,
    X,
} from "lucide-react";
import { RelativeTime } from "@/components/ui/relative-time";
import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { calculateIssueActivity, ActivityResult } from "@/lib/issues/activity-calculator";
import { IssueFrequencySparkline } from "@/components/issues/issue-frequency-sparkline";

export type IssueOccurrenceEvent = {
    id: string;
    timestamp: Date;
    service?: string | null;
    severity?: string | null;
    sdkName?: string | null;
    sdkVersion?: string | null;
    environment?: { name: string } | null;
};

export type IssueItem = {
    id: string;
    projectId: string;
    title: string;
    fingerprint: string;
    status: "OPEN" | "RESOLVED" | "IGNORED";
    severity: "FATAL" | "ERROR" | "WARNING" | "INFO";
    eventCount: number;
    firstSeen: Date;
    lastSeen: Date;
    events?: IssueOccurrenceEvent[];
};

interface Props {
    projectId: string;
    issues: IssueItem[];
}

export function IssueInventoryView({ projectId, issues }: Props) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
    const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
    const [selectedService, setSelectedService] = useState<string>("ALL");
    const [selectedEnv, setSelectedEnv] = useState<string>("ALL");
    const [selectedTimeRange, setSelectedTimeRange] = useState<string>("ALL");
    const [sortBy, setSortBy] = useState<"lastSeen" | "firstSeen" | "events">("lastSeen");

    // Extract all unique services and environments across all issues
    const allServices = useMemo(() => {
        const set = new Set<string>();
        for (const issue of issues) {
            for (const ev of issue.events ?? []) {
                if (ev.service) set.add(ev.service);
            }
        }
        return Array.from(set).sort();
    }, [issues]);

    const allEnvironments = useMemo(() => {
        const set = new Set<string>();
        for (const issue of issues) {
            for (const ev of issue.events ?? []) {
                const env = ev.environment?.name || "production";
                set.add(env);
            }
        }
        return Array.from(set).sort();
    }, [issues]);

    // Summary Metrics computed strictly from real records
    const statusCounts = useMemo(() => {
        const total = issues.length;
        let open = 0;
        let resolved = 0;
        let regressed = 0;
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

        for (const issue of issues) {
            if (issue.status === "OPEN") {
                open++;
                const isOld = new Date(issue.firstSeen).getTime() < sevenDaysAgo;
                const hasRecent = new Date(issue.lastSeen).getTime() >= sevenDaysAgo;
                if (isOld && hasRecent && issue.eventCount > 1) {
                    regressed++;
                }
            } else if (issue.status === "RESOLVED") {
                resolved++;
            }
        }

        return { total, open, resolved, regressed };
    }, [issues]);

    const hasActiveFilters =
        Boolean(searchQuery.trim()) ||
        selectedStatus !== "ALL" ||
        selectedSeverity !== "ALL" ||
        selectedService !== "ALL" ||
        selectedEnv !== "ALL" ||
        selectedTimeRange !== "ALL";

    const clearFilters = () => {
        setSearchQuery("");
        setSelectedStatus("ALL");
        setSelectedSeverity("ALL");
        setSelectedService("ALL");
        setSelectedEnv("ALL");
        setSelectedTimeRange("ALL");
        setSortBy("lastSeen");
    };

    // Filter and Sort issues
    const filteredIssues = useMemo(() => {
        const now = Date.now();

        const list = issues.filter((issue) => {
            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchTitle = issue.title.toLowerCase().includes(q);
                const matchFp = issue.fingerprint.toLowerCase().includes(q);
                const matchEvents = (issue.events ?? []).some((e) =>
                    (e.service && e.service.toLowerCase().includes(q)) ||
                    (e.environment?.name && e.environment.name.toLowerCase().includes(q))
                );
                if (!matchTitle && !matchFp && !matchEvents) return false;
            }

            // Status filter
            if (selectedStatus !== "ALL" && issue.status !== selectedStatus) {
                return false;
            }

            // Severity filter
            if (selectedSeverity !== "ALL" && issue.severity !== selectedSeverity) {
                return false;
            }

            // Service filter
            if (selectedService !== "ALL") {
                const hasService = (issue.events ?? []).some((e) => e.service === selectedService);
                if (!hasService) return false;
            }

            // Environment filter
            if (selectedEnv !== "ALL") {
                const hasEnv = (issue.events ?? []).some((e) => {
                    const env = e.environment?.name || "production";
                    return env === selectedEnv;
                });
                if (!hasEnv) return false;
            }

            // Time range filter (by lastSeen)
            if (selectedTimeRange !== "ALL") {
                const lastMs = new Date(issue.lastSeen).getTime();
                const deltaMs = now - lastMs;
                if (selectedTimeRange === "15m" && deltaMs > 15 * 60 * 1000) return false;
                if (selectedTimeRange === "1h" && deltaMs > 60 * 60 * 1000) return false;
                if (selectedTimeRange === "24h" && deltaMs > 24 * 60 * 60 * 1000) return false;
                if (selectedTimeRange === "7d" && deltaMs > 7 * 24 * 60 * 60 * 1000) return false;
            }

            return true;
        });

        // Sorting
        list.sort((a, b) => {
            if (sortBy === "firstSeen") {
                return new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime();
            }
            if (sortBy === "events") {
                return b.eventCount - a.eventCount;
            }
            return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
        });

        return list;
    }, [
        issues,
        searchQuery,
        selectedStatus,
        selectedSeverity,
        selectedService,
        selectedEnv,
        selectedTimeRange,
        sortBy,
    ]);

    return (
        <div className="space-y-5">
            {/* 4. Tightened Page Header (Left Aligned, No redundant pill) */}
            <div className="border-b border-border pb-3">
                <h1 className="text-2xl font-bold text-white tracking-tight">
                    Issues
                </h1>
                <p className="text-xs text-secondary mt-0.5">
                    Production issues grouped by fingerprint.
                </p>
            </div>

            {/* 1 & 2. Four Quiet, Compact Summary Metric Cards (Neutral Borders, No Blue Outlines) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 px-4 rounded-xl border border-border bg-surface/30 space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans tracking-wider">
                        Total Issues
                    </span>
                    <span className="text-lg font-bold text-white block font-mono">
                        {statusCounts.total}
                    </span>
                </div>

                <div className="p-3 px-4 rounded-xl border border-border bg-surface/30 space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans tracking-wider">
                        Open Issues
                    </span>
                    <span className="text-lg font-bold text-red-400 block font-mono">
                        {statusCounts.open}
                    </span>
                </div>

                <div className="p-3 px-4 rounded-xl border border-border bg-surface/30 space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans tracking-wider">
                        Regressed (7D)
                    </span>
                    <span className="text-lg font-bold text-amber-400 block font-mono">
                        {statusCounts.regressed}
                    </span>
                </div>

                <div className="p-3 px-4 rounded-xl border border-border bg-surface/30 space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans tracking-wider">
                        Resolved
                    </span>
                    <span className="text-lg font-bold text-emerald-400 block font-mono">
                        {statusCounts.resolved}
                    </span>
                </div>
            </div>

            {/* 5. Filter Toolbar: Search → Status → Severity → Service → Environment → Time → Sort */}
            <div className="p-2.5 rounded-xl bg-surface/60 border border-border space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                    {/* 1. Search (Flexible width) */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={13} />
                        <input
                            type="text"
                            placeholder="Search issue, fingerprint, service..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-8.5 rounded-lg bg-[#080b11] border border-white/10 pl-8 pr-7 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent font-mono"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* 2. Status */}
                    <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="h-8.5 px-2.5 rounded-lg bg-[#080b11] border border-white/10 text-xs font-mono text-zinc-300 focus:outline-none focus:border-accent cursor-pointer"
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="OPEN">Open</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="IGNORED">Ignored</option>
                    </select>

                    {/* 3. Severity */}
                    <select
                        value={selectedSeverity}
                        onChange={(e) => setSelectedSeverity(e.target.value)}
                        className="h-8.5 px-2.5 rounded-lg bg-[#080b11] border border-white/10 text-xs font-mono text-zinc-300 focus:outline-none focus:border-accent cursor-pointer"
                    >
                        <option value="ALL">All Severities</option>
                        <option value="FATAL">FATAL</option>
                        <option value="ERROR">ERROR</option>
                        <option value="WARNING">WARNING</option>
                        <option value="INFO">INFO</option>
                    </select>

                    {/* 4. Service */}
                    {allServices.length > 0 && (
                        <select
                            value={selectedService}
                            onChange={(e) => setSelectedService(e.target.value)}
                            className="h-8.5 px-2.5 rounded-lg bg-[#080b11] border border-white/10 text-xs font-mono text-zinc-300 focus:outline-none focus:border-accent cursor-pointer"
                        >
                            <option value="ALL">All Services</option>
                            {allServices.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    )}

                    {/* 5. Environment */}
                    {allEnvironments.length > 0 && (
                        <select
                            value={selectedEnv}
                            onChange={(e) => setSelectedEnv(e.target.value)}
                            className="h-8.5 px-2.5 rounded-lg bg-[#080b11] border border-white/10 text-xs font-mono text-zinc-300 focus:outline-none focus:border-accent cursor-pointer"
                        >
                            <option value="ALL">All Environments</option>
                            {allEnvironments.map((env) => (
                                <option key={env} value={env}>{env}</option>
                            ))}
                        </select>
                    )}

                    {/* 6. Time Range */}
                    <select
                        value={selectedTimeRange}
                        onChange={(e) => setSelectedTimeRange(e.target.value)}
                        className="h-8.5 px-2.5 rounded-lg bg-[#080b11] border border-white/10 text-xs font-mono text-zinc-300 focus:outline-none focus:border-accent cursor-pointer"
                    >
                        <option value="ALL">All Time</option>
                        <option value="15m">Last 15m</option>
                        <option value="1h">Last 1h</option>
                        <option value="24h">Last 24h</option>
                        <option value="7d">Last 7d</option>
                    </select>

                    {/* 7. Sort (Final control on the right) */}
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="h-8.5 px-2.5 rounded-lg bg-[#080b11] border border-white/10 text-xs font-mono text-zinc-300 focus:outline-none focus:border-accent cursor-pointer"
                    >
                        <option value="lastSeen">Sort: Last Seen</option>
                        <option value="firstSeen">Sort: First Seen</option>
                        <option value="events">Sort: Occurrences</option>
                    </select>

                    {/* Clear Filters Button */}
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="h-8.5 px-2.5 rounded-lg bg-surface hover:bg-surface-hover border border-border text-xs font-mono text-zinc-300 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                        >
                            <RotateCcw size={11} />
                            <span>Clear</span>
                        </button>
                    )}
                </div>
            </div>

            {/* 6. Primary Surface: Grouped Issue List */}
            {filteredIssues.length === 0 ? (
                <div className="p-12 text-center rounded-xl bg-surface/30 border border-border space-y-2.5">
                    <p className="text-sm font-medium text-white">No issues match your current filters</p>
                    <p className="text-xs text-secondary max-w-md mx-auto">
                        Adjust or reset your query, status, severity, service, or time range filters.
                    </p>
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="halo-btn halo-btn-xs halo-btn-secondary mt-1 inline-flex items-center gap-1"
                        >
                            <RotateCcw size={11} />
                            Reset Filters
                        </button>
                    )}
                </div>
            ) : (
                <div className="rounded-xl border border-border bg-[#080b11] overflow-hidden shadow-lg">
                    {/* Header Bar */}
                    <div className="grid grid-cols-[minmax(0,1fr)_100px_120px_120px_150px] items-center gap-4 px-5 py-2.5 bg-surface/50 border-b border-border text-[10px] font-mono uppercase tracking-wider text-muted select-none">
                        <span>Grouped Problem</span>
                        <span className="text-center">Occurrences</span>
                        <span>First Seen</span>
                        <span>Last Seen</span>
                        <span className="text-right">Activity</span>
                    </div>

                    {/* Problem Inventory Rows */}
                    <div className="divide-y divide-white/5">
                        {filteredIssues.map((issue) => {
                            // Extract actual services and environments from underlying events
                            const issueServices = Array.from(
                                new Set((issue.events ?? []).map((e) => e.service || "web-client"))
                            );
                            const issueEnvs = Array.from(
                                new Set((issue.events ?? []).map((e) => e.environment?.name || "production"))
                            );

                            const eventTimestamps = (issue.events ?? []).map((e) => e.timestamp);
                            const activity = calculateIssueActivity(
                                issue.firstSeen,
                                issue.lastSeen,
                                eventTimestamps,
                                issue.status
                            );

                            return (
                                <Link
                                    key={issue.id}
                                    href={`/projects/${projectId}/issues/${issue.id}`}
                                    className="grid grid-cols-[minmax(0,1fr)_100px_120px_120px_150px] items-center gap-4 px-5 py-3.5 hover:bg-surface/35 transition-colors group cursor-pointer"
                                >
                                    {/* 7. Problem Details Hierarchy: Title > Status/Severity > Fingerprint > Service·Env */}
                                    <div className="min-w-0 pr-3 space-y-1">
                                        {/* Status & Severity */}
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ${
                                                issue.status === "RESOLVED"
                                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                    : issue.status === "IGNORED"
                                                    ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                                                    : "bg-red-500/10 text-red-400 border-red-500/20"
                                            }`}>
                                                {issue.status}
                                            </span>
                                            <SeverityBadge severity={issue.severity as any} />
                                        </div>

                                        {/* 1. Primary Dominant Issue Title */}
                                        <h3 className="text-sm font-semibold text-white group-hover:text-accent transition-colors truncate leading-snug">
                                            {issue.title}
                                        </h3>

                                        {/* Fingerprint (Quieter) */}
                                        <p className="text-[11px] font-mono text-zinc-500 truncate">
                                            fingerprint: <code className="text-zinc-400">{issue.fingerprint}</code>
                                        </p>

                                        {/* 9. Actual Service & Environment */}
                                        <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 flex-wrap">
                                            <span className="text-zinc-300 font-medium truncate max-w-[180px]">
                                                {issueServices.join(", ") || "web-client"}
                                            </span>
                                            <span className="text-zinc-600">·</span>
                                            <span className="text-zinc-500 truncate max-w-[140px]">
                                                {issueEnvs.join(", ") || "production"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 10. Occurrences Count */}
                                    <div className="font-mono text-center space-y-0.5">
                                        <span className="text-sm font-bold text-white block">
                                            {issue.eventCount}
                                        </span>
                                        <span className="text-[10px] text-zinc-500 block">
                                            occurrence{issue.eventCount !== 1 ? "s" : ""}
                                        </span>
                                    </div>

                                    {/* 11. First Seen */}
                                    <div className="font-mono text-xs space-y-0.5">
                                        <span className="text-zinc-300 block text-[11px] truncate">
                                            {new Date(issue.firstSeen).toLocaleDateString([], {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                            })}
                                        </span>
                                        <span className="text-[10px] text-zinc-500 block truncate">
                                            <RelativeTime date={issue.firstSeen} />
                                        </span>
                                    </div>

                                    {/* 11. Last Seen */}
                                    <div className="font-mono text-xs space-y-0.5">
                                        <span className="text-zinc-300 block text-[11px] truncate">
                                            {new Date(issue.lastSeen).toLocaleDateString([], {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                            })}
                                        </span>
                                        <span className="text-[10px] text-zinc-500 block truncate">
                                            <RelativeTime date={issue.lastSeen} />
                                        </span>
                                    </div>

                                    {/* 12 & 13. Activity & Cohesive Frequency Sparkline */}
                                    <div className="flex justify-end">
                                        <IssueFrequencySparkline activity={activity} />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
