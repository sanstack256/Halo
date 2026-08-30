"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
    RotateCcw,
    Search,
    X,
} from "lucide-react";
import { RelativeTime } from "@/components/ui/relative-time";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { calculateIssueActivity } from "@/lib/issues/activity-calculator";
import { IssueFrequencySparkline } from "@/components/issues/issue-frequency-sparkline";
import { HaloSelect } from "@/components/ui/halo-select";
import { formatDeterministicDate } from "@/lib/date-format";

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
            {/* 1. PAGE HEADER: Title & Muted Subtitle on Left, Issue Count on Right, Subtle Divider below */}
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">
                            Issues
                        </h1>
                        <p className="text-xs text-secondary mt-0.5">
                            Production issues grouped by fingerprint.
                        </p>
                    </div>

                    <div className="px-3 py-1 rounded-lg bg-surface border border-border text-xs font-mono text-zinc-300 font-semibold">
                        {issues.length} Issues
                    </div>
                </div>
                <div className="border-b border-border" />
            </div>

            {/* 2. ISSUE SUMMARY STRIP: 4 Equal-width neutral cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3.5 px-4 rounded-xl border border-border bg-surface/30 space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans tracking-wider">
                        Total Issues
                    </span>
                    <span className="text-xl font-bold text-white block font-mono">
                        {statusCounts.total}
                    </span>
                </div>

                <div className="p-3.5 px-4 rounded-xl border border-border bg-surface/30 space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans tracking-wider">
                        Open Issues
                    </span>
                    <span className="text-xl font-bold text-red-400 block font-mono">
                        {statusCounts.open}
                    </span>
                </div>

                <div className="p-3.5 px-4 rounded-xl border border-border bg-surface/30 space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans tracking-wider">
                        Regressed
                    </span>
                    <span className="text-xl font-bold text-amber-400 block font-mono">
                        {statusCounts.regressed}
                    </span>
                </div>

                <div className="p-3.5 px-4 rounded-xl border border-border bg-surface/30 space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans tracking-wider">
                        Resolved
                    </span>
                    <span className="text-xl font-bold text-emerald-400 block font-mono">
                        {statusCounts.resolved}
                    </span>
                </div>
            </div>

            {/* 3. FILTER TOOLBAR: [ Search ] [ Status ] [ Severity ] [ Service ] [ Environment ] [ Time ] [ Sort ] */}
            <div className="p-2.5 rounded-xl bg-surface/60 border border-border space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Search (Flexible largest portion) */}
                    <div className="relative flex-1 min-w-[220px]">
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

                    {/* Status */}
                    <HaloSelect
                        value={selectedStatus}
                        onChange={(val) => setSelectedStatus(val)}
                        options={[
                            { value: "ALL", label: "All Statuses" },
                            { value: "OPEN", label: "Open" },
                            { value: "RESOLVED", label: "Resolved" },
                            { value: "IGNORED", label: "Ignored" },
                        ]}
                    />

                    {/* Severity */}
                    <HaloSelect
                        value={selectedSeverity}
                        onChange={(val) => setSelectedSeverity(val)}
                        options={[
                            { value: "ALL", label: "All Severities" },
                            { value: "FATAL", label: "FATAL" },
                            { value: "ERROR", label: "ERROR" },
                            { value: "WARNING", label: "WARNING" },
                            { value: "INFO", label: "INFO" },
                        ]}
                    />

                    {/* Service */}
                    {allServices.length > 0 && (
                        <HaloSelect
                            value={selectedService}
                            onChange={(val) => setSelectedService(val)}
                            options={[
                                { value: "ALL", label: "All Services" },
                                ...allServices.map((s) => ({ value: s, label: s })),
                            ]}
                        />
                    )}

                    {/* Environment */}
                    {allEnvironments.length > 0 && (
                        <HaloSelect
                            value={selectedEnv}
                            onChange={(val) => setSelectedEnv(val)}
                            options={[
                                { value: "ALL", label: "All Environments" },
                                ...allEnvironments.map((env) => ({ value: env, label: env })),
                            ]}
                        />
                    )}

                    {/* Time Range */}
                    <HaloSelect
                        value={selectedTimeRange}
                        onChange={(val) => setSelectedTimeRange(val)}
                        options={[
                            { value: "ALL", label: "All Time" },
                            { value: "15m", label: "Last 15m" },
                            { value: "1h", label: "Last 1h" },
                            { value: "24h", label: "Last 24h" },
                            { value: "7d", label: "Last 7d" },
                        ]}
                    />

                    {/* Sort (Final control on right) */}
                    <HaloSelect
                        value={sortBy}
                        onChange={(val) => setSortBy(val as any)}
                        options={[
                            { value: "lastSeen", label: "Sort: Last Seen" },
                            { value: "firstSeen", label: "Sort: First Seen" },
                            { value: "events", label: "Sort: Occurrences" },
                        ]}
                    />

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

            {/* 4 & 5. ISSUE LIST: Single table container with exact columns and hierarchy */}
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
                    {/* Header Row */}
                    <div className="grid grid-cols-[minmax(0,1fr)_100px_120px_120px_160px] items-center gap-4 px-5 py-2.5 bg-surface/50 border-b border-border text-[10px] font-mono uppercase tracking-wider text-muted select-none">
                        <span>Grouped Problem</span>
                        <span className="text-center">Occurrences</span>
                        <span>First Seen</span>
                        <span>Last Seen</span>
                        <span className="text-right">Activity</span>
                    </div>

                    {/* Issue Rows */}
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
                                    className="grid grid-cols-[minmax(0,1fr)_100px_120px_120px_160px] items-center gap-4 px-5 py-3.5 hover:bg-surface/35 transition-colors group cursor-pointer"
                                >
                                    {/* GROUPED PROBLEM Column */}
                                    <div className="min-w-0 pr-3 space-y-1">
                                        {/* Line 1: [STATUS BADGE] [SEVERITY BADGE] */}
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

                                        {/* Line 2: Issue Title (Strongest text) */}
                                        <h3 className="text-sm font-semibold text-white group-hover:text-accent transition-colors truncate leading-snug">
                                            {issue.title}
                                        </h3>

                                        {/* Line 3: fingerprint: <fingerprint> (Muted monospace) */}
                                        <p className="text-[11px] font-mono text-zinc-500 truncate">
                                            fingerprint: <code className="text-zinc-400">{issue.fingerprint}</code>
                                        </p>

                                        {/* Line 4: <Service> · <Environment> */}
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

                                    {/* OCCURRENCES Column */}
                                    <div className="font-mono text-center space-y-0.5">
                                        <span className="text-sm font-bold text-white block">
                                            {issue.eventCount}
                                        </span>
                                        <span className="text-[10px] text-zinc-500 block">
                                            occurrences
                                        </span>
                                    </div>

                                    {/* FIRST SEEN Column (Deterministic Date + Relative Time) */}
                                    <div className="font-mono text-xs space-y-0.5">
                                        <span className="text-zinc-300 block text-[11px] truncate">
                                            {formatDeterministicDate(issue.firstSeen)}
                                        </span>
                                        <span className="text-[10px] text-zinc-500 block truncate">
                                            <RelativeTime date={issue.firstSeen} />
                                        </span>
                                    </div>

                                    {/* LAST SEEN Column (Deterministic Date + Relative Time) */}
                                    <div className="font-mono text-xs space-y-0.5">
                                        <span className="text-zinc-300 block text-[11px] truncate">
                                            {formatDeterministicDate(issue.lastSeen)}
                                        </span>
                                        <span className="text-[10px] text-zinc-500 block truncate">
                                            <RelativeTime date={issue.lastSeen} />
                                        </span>
                                    </div>

                                    {/* ACTIVITY Column: Activity state badge + real frequency sparkline */}
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
