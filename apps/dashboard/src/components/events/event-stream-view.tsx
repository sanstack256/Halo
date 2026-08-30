"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
    ArrowDown,
    ArrowUp,
    ChevronLeft,
    ChevronRight,
    RotateCcw,
    Search,
    Terminal,
    X,
} from "lucide-react";
import { RelativeTime } from "@/components/ui/relative-time";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { EventTypeBadge } from "@/components/events/event-type-badge";
import { HaloSelect } from "@/components/ui/halo-select";
import { formatDeterministicDateTime, formatDeterministicTime } from "@/lib/date-format";

export type TelemetryEvent = {
    id: string;
    type: string;
    severity: string;
    title: string;
    message: string | null;
    timestamp: Date;
    service?: string | null;
    environmentId?: string | null;
    environment?: { name: string } | null;
    sdkName?: string | null;
    sdkVersion?: string | null;
    release?: string | null;
    requestId?: string | null;
    traceId?: string | null;
    durationMs?: number | null;
    operation?: string | null;
    resource?: string | null;
    status?: string | number | null;
    sessionId?: string | null;
    fingerprint?: string | null;
    stack?: string | null;
    breadcrumbs?: any;
    tags?: any;
    user?: any;
    metadata?: any;
    issueId?: string | null;
    issue?: {
        id: string;
        title: string;
        fingerprint?: string | null;
    } | null;
};

interface Props {
    projectId: string;
    events: TelemetryEvent[];
}

const PAGE_SIZE = 25;

export function EventStreamView({ projectId, events }: Props) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedType, setSelectedType] = useState<string>("ALL");
    const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
    const [selectedService, setSelectedService] = useState<string>("ALL");
    const [selectedEnv, setSelectedEnv] = useState<string>("ALL");
    const [selectedSdk, setSelectedSdk] = useState<string>("ALL");
    const [selectedTimeRange, setSelectedTimeRange] = useState<string>("ALL");
    const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
    const [currentPage, setCurrentPage] = useState(1);

    // Extract unique dynamic dropdown options from real data
    const allTypes = useMemo(() => {
        const set = new Set<string>();
        for (const e of events) if (e.type) set.add(e.type);
        return Array.from(set).sort();
    }, [events]);

    const allSeverities = useMemo(() => {
        const set = new Set<string>();
        for (const e of events) if (e.severity) set.add(e.severity);
        return Array.from(set).sort();
    }, [events]);

    const allServices = useMemo(() => {
        const set = new Set<string>();
        for (const e of events) if (e.service) set.add(e.service);
        return Array.from(set).sort();
    }, [events]);

    const allEnvironments = useMemo(() => {
        const set = new Set<string>();
        for (const e of events) {
            const env = e.environment?.name || "production";
            set.add(env);
        }
        return Array.from(set).sort();
    }, [events]);

    const allSdks = useMemo(() => {
        const set = new Set<string>();
        for (const e of events) if (e.sdkName) set.add(e.sdkName);
        return Array.from(set).sort();
    }, [events]);

    // Overview metric aggregations
    const overviewMetrics = useMemo(() => {
        let total = events.length;
        let errors = 0;
        let warnings = 0;
        let info = 0;

        for (const e of events) {
            const sev = (e.severity || "").toUpperCase();
            if (sev === "ERROR" || sev === "FATAL") {
                errors++;
            } else if (sev === "WARN" || sev === "WARNING") {
                warnings++;
            } else if (sev === "INFO") {
                info++;
            }
        }

        return { total, errors, warnings, info };
    }, [events]);

    const hasActiveFilters =
        Boolean(searchQuery.trim()) ||
        selectedType !== "ALL" ||
        selectedSeverity !== "ALL" ||
        selectedService !== "ALL" ||
        selectedEnv !== "ALL" ||
        selectedSdk !== "ALL" ||
        selectedTimeRange !== "ALL";

    const clearFilters = () => {
        setSearchQuery("");
        setSelectedType("ALL");
        setSelectedSeverity("ALL");
        setSelectedService("ALL");
        setSelectedEnv("ALL");
        setSelectedSdk("ALL");
        setSelectedTimeRange("ALL");
        setCurrentPage(1);
    };

    // Filter and Sort events
    const filteredEvents = useMemo(() => {
        const now = Date.now();

        const list = events.filter((ev) => {
            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchTitle = ev.title.toLowerCase().includes(q);
                const matchMessage = ev.message?.toLowerCase().includes(q);
                const matchService = ev.service?.toLowerCase().includes(q);
                const matchTrace = ev.traceId?.toLowerCase().includes(q);
                const matchRequest = ev.requestId?.toLowerCase().includes(q);
                const matchType = ev.type.toLowerCase().includes(q);
                const matchFp = ev.fingerprint?.toLowerCase().includes(q);
                if (
                    !matchTitle &&
                    !matchMessage &&
                    !matchService &&
                    !matchTrace &&
                    !matchRequest &&
                    !matchType &&
                    !matchFp
                ) {
                    return false;
                }
            }

            // Type filter
            if (selectedType !== "ALL" && ev.type !== selectedType) {
                return false;
            }

            // Severity filter
            if (selectedSeverity !== "ALL" && ev.severity !== selectedSeverity) {
                return false;
            }

            // Service filter
            if (selectedService !== "ALL" && ev.service !== selectedService) {
                return false;
            }

            // Environment filter
            if (selectedEnv !== "ALL") {
                const evEnv = ev.environment?.name || "production";
                if (evEnv !== selectedEnv) return false;
            }

            // SDK filter
            if (selectedSdk !== "ALL" && ev.sdkName !== selectedSdk) {
                return false;
            }

            // Time range filter
            if (selectedTimeRange !== "ALL") {
                const evTime = new Date(ev.timestamp).getTime();
                const deltaMs = now - evTime;
                if (selectedTimeRange === "15m" && deltaMs > 15 * 60 * 1000) return false;
                if (selectedTimeRange === "1h" && deltaMs > 60 * 60 * 1000) return false;
                if (selectedTimeRange === "24h" && deltaMs > 24 * 60 * 60 * 1000) return false;
                if (selectedTimeRange === "7d" && deltaMs > 7 * 24 * 60 * 60 * 1000) return false;
                if (selectedTimeRange === "30d" && deltaMs > 30 * 24 * 60 * 60 * 1000) return false;
            }

            return true;
        });

        // Sorting by timestamp
        list.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
        });

        return list;
    }, [
        events,
        searchQuery,
        selectedType,
        selectedSeverity,
        selectedService,
        selectedEnv,
        selectedSdk,
        selectedTimeRange,
        sortOrder,
    ]);

    // Pagination calculations
    const totalFiltered = filteredEvents.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
    const paginatedEvents = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredEvents.slice(start, start + PAGE_SIZE);
    }, [filteredEvents, currentPage]);

    const pageStart = totalFiltered === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const pageEnd = Math.min(currentPage * PAGE_SIZE, totalFiltered);

    return (
        <div className="space-y-5">
            {/* A. PAGE HEADER */}
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">
                            Events
                        </h1>
                        <p className="text-xs text-secondary mt-0.5">
                            Every event received from your application.
                        </p>
                    </div>

                    <div className="px-3 py-1 rounded-lg bg-surface border border-border text-xs font-mono text-zinc-300 font-semibold">
                        {events.length} Events
                    </div>
                </div>
                <div className="border-b border-border" />
            </div>

            {/* B. EVENT OVERVIEW / SUMMARY STRIP */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 px-4 rounded-xl border border-border bg-surface/30 space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans tracking-wider">
                        Total Events
                    </span>
                    <span className="text-lg font-bold text-white block font-mono">
                        {overviewMetrics.total}
                    </span>
                </div>

                <div className="p-3 px-4 rounded-xl border border-border bg-surface/30 space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans tracking-wider">
                        Errors
                    </span>
                    <span className="text-lg font-bold text-red-400 block font-mono">
                        {overviewMetrics.errors}
                    </span>
                </div>

                <div className="p-3 px-4 rounded-xl border border-border bg-surface/30 space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans tracking-wider">
                        Warnings
                    </span>
                    <span className="text-lg font-bold text-amber-400 block font-mono">
                        {overviewMetrics.warnings}
                    </span>
                </div>

                <div className="p-3 px-4 rounded-xl border border-border bg-surface/30 space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans tracking-wider">
                        Info
                    </span>
                    <span className="text-lg font-bold text-blue-400 block font-mono">
                        {overviewMetrics.info}
                    </span>
                </div>
            </div>

            {/* C. FILTER + SEARCH TOOLBAR */}
            <div className="p-2.5 rounded-xl bg-surface/60 border border-border space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Search Field (Flexible largest width) */}
                    <div className="relative flex-1 min-w-[240px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={13} />
                        <input
                            type="text"
                            placeholder="Search events, messages, services, traces..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full h-8.5 rounded-lg bg-[#080b11] border border-white/10 pl-8 pr-7 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent font-mono"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery("");
                                    setCurrentPage(1);
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Event Type */}
                    <HaloSelect
                        value={selectedType}
                        onChange={(val) => {
                            setSelectedType(val);
                            setCurrentPage(1);
                        }}
                        options={[
                            { value: "ALL", label: "All Types" },
                            ...allTypes.map((t) => ({ value: t, label: t })),
                        ]}
                    />

                    {/* Severity */}
                    <HaloSelect
                        value={selectedSeverity}
                        onChange={(val) => {
                            setSelectedSeverity(val);
                            setCurrentPage(1);
                        }}
                        options={[
                            { value: "ALL", label: "All Severities" },
                            { value: "FATAL", label: "FATAL" },
                            { value: "ERROR", label: "ERROR" },
                            { value: "WARNING", label: "WARNING" },
                            { value: "INFO", label: "INFO" },
                            { value: "DEBUG", label: "DEBUG" },
                        ]}
                    />

                    {/* Service */}
                    {allServices.length > 0 && (
                        <HaloSelect
                            value={selectedService}
                            onChange={(val) => {
                                setSelectedService(val);
                                setCurrentPage(1);
                            }}
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
                            onChange={(val) => {
                                setSelectedEnv(val);
                                setCurrentPage(1);
                            }}
                            options={[
                                { value: "ALL", label: "All Environments" },
                                ...allEnvironments.map((env) => ({ value: env, label: env })),
                            ]}
                        />
                    )}

                    {/* SDK */}
                    {allSdks.length > 0 && (
                        <HaloSelect
                            value={selectedSdk}
                            onChange={(val) => {
                                setSelectedSdk(val);
                                setCurrentPage(1);
                            }}
                            options={[
                                { value: "ALL", label: "All SDKs" },
                                ...allSdks.map((sdk) => ({ value: sdk, label: sdk })),
                            ]}
                        />
                    )}

                    {/* Time Range */}
                    <HaloSelect
                        value={selectedTimeRange}
                        onChange={(val) => {
                            setSelectedTimeRange(val);
                            setCurrentPage(1);
                        }}
                        options={[
                            { value: "ALL", label: "All Time" },
                            { value: "15m", label: "Last 15m" },
                            { value: "1h", label: "Last 1h" },
                            { value: "24h", label: "Last 24h" },
                            { value: "7d", label: "Last 7d" },
                            { value: "30d", label: "Last 30d" },
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

            {/* D. ACTIVE FILTERS ROW (Removable Chips) */}
            {hasActiveFilters && (
                <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
                    <span className="text-[11px] text-zinc-500">Active filters:</span>

                    {searchQuery.trim() && (
                        <span className="halo-filter-chip">
                            <span>Search: &ldquo;{searchQuery}&rdquo;</span>
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="hover:text-white"
                            >
                                <X size={11} />
                            </button>
                        </span>
                    )}

                    {selectedType !== "ALL" && (
                        <span className="halo-filter-chip">
                            <span>Type: {selectedType}</span>
                            <button
                                type="button"
                                onClick={() => setSelectedType("ALL")}
                                className="hover:text-white"
                            >
                                <X size={11} />
                            </button>
                        </span>
                    )}

                    {selectedSeverity !== "ALL" && (
                        <span className="halo-filter-chip">
                            <span>Severity: {selectedSeverity}</span>
                            <button
                                type="button"
                                onClick={() => setSelectedSeverity("ALL")}
                                className="hover:text-white"
                            >
                                <X size={11} />
                            </button>
                        </span>
                    )}

                    {selectedService !== "ALL" && (
                        <span className="halo-filter-chip">
                            <span>Service: {selectedService}</span>
                            <button
                                type="button"
                                onClick={() => setSelectedService("ALL")}
                                className="hover:text-white"
                            >
                                <X size={11} />
                            </button>
                        </span>
                    )}

                    {selectedEnv !== "ALL" && (
                        <span className="halo-filter-chip">
                            <span>Env: {selectedEnv}</span>
                            <button
                                type="button"
                                onClick={() => setSelectedEnv("ALL")}
                                className="hover:text-white"
                            >
                                <X size={11} />
                            </button>
                        </span>
                    )}

                    {selectedSdk !== "ALL" && (
                        <span className="halo-filter-chip">
                            <span>SDK: {selectedSdk}</span>
                            <button
                                type="button"
                                onClick={() => setSelectedSdk("ALL")}
                                className="hover:text-white"
                            >
                                <X size={11} />
                            </button>
                        </span>
                    )}

                    {selectedTimeRange !== "ALL" && (
                        <span className="halo-filter-chip">
                            <span>Time: {selectedTimeRange}</span>
                            <button
                                type="button"
                                onClick={() => setSelectedTimeRange("ALL")}
                                className="hover:text-white"
                            >
                                <X size={11} />
                            </button>
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={clearFilters}
                        className="text-[11px] text-zinc-400 hover:text-white underline ml-1"
                    >
                        Clear all
                    </button>
                </div>
            )}

            {/* E. EVENT TABLE STREAM (Dedicated page navigation on click) */}
            {events.length === 0 ? (
                /* No Events Yet Empty State */
                <div className="p-12 text-center rounded-xl bg-surface/30 border border-border space-y-3">
                    <div className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center mx-auto text-muted">
                        <Terminal size={18} />
                    </div>
                    <p className="text-base font-semibold text-white">No events yet</p>
                    <p className="text-xs text-secondary max-w-md mx-auto">
                        Telemetry events received from your application and SDK will appear here in real time.
                    </p>
                    <Link
                        href={`/projects/${projectId}/sdk`}
                        className="halo-btn halo-btn-sm halo-btn-primary inline-flex items-center gap-1.5 mt-2"
                    >
                        <span>SDK Setup Guide</span>
                    </Link>
                </div>
            ) : filteredEvents.length === 0 ? (
                /* No Filtered Matches Empty State */
                <div className="p-12 text-center rounded-xl bg-surface/30 border border-border space-y-2.5">
                    <p className="text-sm font-medium text-white">No events match your current filters</p>
                    <p className="text-xs text-secondary max-w-md mx-auto">
                        Try adjusting your search query, severity, service, or time range filters.
                    </p>
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="halo-btn halo-btn-xs halo-btn-secondary mt-1 inline-flex items-center gap-1"
                    >
                        <RotateCcw size={11} />
                        <span>Clear Filters</span>
                    </button>
                </div>
            ) : (
                <div className="rounded-xl border border-border bg-[#080b11] overflow-hidden shadow-lg">
                    {/* Header Row */}
                    <div className="grid grid-cols-[130px_90px_minmax(0,1fr)_100px_130px_100px_90px] items-center gap-3 px-4 py-2.5 bg-surface/50 border-b border-border text-[10px] font-mono uppercase tracking-wider text-muted select-none">
                        <button
                            type="button"
                            onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                            className="flex items-center gap-1 hover:text-white transition-colors text-left"
                        >
                            <span>Time</span>
                            {sortOrder === "desc" ? <ArrowDown size={11} /> : <ArrowUp size={11} />}
                        </button>
                        <span>Type</span>
                        <span>Event</span>
                        <span>Severity</span>
                        <span>Service</span>
                        <span>Environment</span>
                        <span className="text-right">SDK</span>
                    </div>

                    {/* Stream Rows: Navigation to dedicated full page on click */}
                    <div className="divide-y divide-white/5">
                        {paginatedEvents.map((event) => {
                            const envName = event.environment?.name || "production";

                            return (
                                <Link
                                    key={event.id}
                                    href={`/projects/${projectId}/events/${event.id}`}
                                    className="grid grid-cols-[130px_90px_minmax(0,1fr)_100px_130px_100px_90px] items-center gap-3 px-4 py-3 hover:bg-surface/35 transition-colors group cursor-pointer"
                                >
                                    {/* 1. TIME: Relative time primary, exact timestamp secondary */}
                                    <div
                                        className="font-mono text-xs space-y-0.5"
                                        title={formatDeterministicDateTime(event.timestamp)}
                                    >
                                        <span className="text-zinc-300 block text-[11px] truncate">
                                            <RelativeTime date={event.timestamp} />
                                        </span>
                                        <span className="text-[10px] text-zinc-500 block truncate font-mono">
                                            {formatDeterministicTime(event.timestamp)}
                                        </span>
                                    </div>

                                    {/* 2. TYPE: Restrained neutral classification */}
                                    <div>
                                        <EventTypeBadge type={event.type} className="w-full truncate" />
                                    </div>

                                    {/* 3. EVENT: Dominant title & supporting detail */}
                                    <div className="min-w-0 pr-2 space-y-0.5">
                                        <p
                                            className="text-xs font-semibold text-white group-hover:text-accent transition-colors truncate"
                                            title={event.title}
                                        >
                                            {event.title}
                                        </p>
                                        {event.message && event.message !== event.title && (
                                            <p className="text-[11px] font-mono text-zinc-400 truncate">
                                                {event.message}
                                            </p>
                                        )}
                                        {event.traceId && (
                                            <span className="text-[10px] font-mono text-zinc-500 block truncate">
                                                trace: {event.traceId}
                                            </span>
                                        )}
                                    </div>

                                    {/* 4. SEVERITY: Strong semantic badge */}
                                    <div>
                                        <SeverityBadge severity={event.severity} />
                                    </div>

                                    {/* 5. SERVICE: Actual service name */}
                                    <div className="font-mono text-xs truncate">
                                        <span className="text-zinc-300 font-medium truncate block">
                                            {event.service || "—"}
                                        </span>
                                    </div>

                                    {/* 6. ENVIRONMENT: Subdued metadata */}
                                    <div className="font-mono text-xs truncate">
                                        <span className="text-zinc-400 truncate block">
                                            {envName}
                                        </span>
                                    </div>

                                    {/* 7. SDK: Compact two-line format */}
                                    <div className="font-mono text-right space-y-0.5 truncate">
                                        <span className="text-xs text-zinc-300 truncate block">
                                            {event.sdkName || "—"}
                                        </span>
                                        {event.sdkVersion && (
                                            <span className="text-[10px] text-zinc-500 truncate block">
                                                v{event.sdkVersion}
                                            </span>
                                        )}
                                    </div>
                                </Link>
                            );
                        })}
                    </div>

                    {/* F. PAGINATION / RESULT NAVIGATION */}
                    <div className="flex items-center justify-between px-4 py-3 bg-surface/40 border-t border-border text-xs font-mono text-zinc-400">
                        <div>
                            Showing <span className="text-white font-semibold">{pageStart}</span>–
                            <span className="text-white font-semibold">{pageEnd}</span> of{" "}
                            <span className="text-white font-semibold">{totalFiltered}</span> events
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                className="h-7 px-2.5 rounded-lg bg-surface border border-border text-zinc-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                            >
                                <ChevronLeft size={13} />
                                <span>Previous</span>
                            </button>

                            <span className="text-zinc-500 px-1">
                                Page {currentPage} of {totalPages}
                            </span>

                            <button
                                type="button"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                className="h-7 px-2.5 rounded-lg bg-surface border border-border text-zinc-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                            >
                                <span>Next</span>
                                <ChevronRight size={13} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
