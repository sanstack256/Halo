"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    ArrowRight,
    Calendar,
    Check,
    ChevronDown,
    Clock,
    Filter,
    Layers,
    RotateCcw,
    Search,
    Server,
    ShieldAlert,
    Terminal,
    X,
} from "lucide-react";
import { RelativeTime } from "@/components/ui/relative-time";
import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/ui/severity-badge";

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
    sessionId?: string | null;
    issueId?: string | null;
    status?: string | number | null;
    durationMs?: number | null;
};

interface Props {
    projectId: string;
    events: TelemetryEvent[];
}

export function EventStreamView({ projectId, events }: Props) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedType, setSelectedType] = useState<string>("ALL");
    const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
    const [selectedService, setSelectedService] = useState<string>("ALL");
    const [selectedEnv, setSelectedEnv] = useState<string>("ALL");
    const [selectedSdk, setSelectedSdk] = useState<string>("ALL");
    const [selectedTimeRange, setSelectedTimeRange] = useState<string>("ALL");

    // Extract unique services and environments
    const services = useMemo(() => {
        const set = new Set<string>();
        for (const e of events) {
            if (e.service) set.add(e.service);
        }
        return Array.from(set).sort();
    }, [events]);

    const environments = useMemo(() => {
        const set = new Set<string>();
        for (const e of events) {
            const env = e.environment?.name || "production";
            set.add(env);
        }
        return Array.from(set).sort();
    }, [events]);

    const eventTypes = useMemo(() => {
        const set = new Set<string>();
        for (const e of events) {
            if (e.type) set.add(e.type);
        }
        return Array.from(set).sort();
    }, [events]);

    const sdks = useMemo(() => {
        const set = new Set<string>();
        for (const e of events) {
            if (e.sdkName) set.add(e.sdkName);
        }
        return Array.from(set).sort();
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
    };

    // Filter events
    const filteredEvents = useMemo(() => {
        const now = Date.now();

        return events.filter((ev) => {
            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchTitle = ev.title.toLowerCase().includes(q);
                const matchMsg = ev.message ? ev.message.toLowerCase().includes(q) : false;
                const matchService = ev.service ? ev.service.toLowerCase().includes(q) : false;
                const matchTrace = ev.traceId ? ev.traceId.toLowerCase().includes(q) : false;
                const matchReq = ev.requestId ? ev.requestId.toLowerCase().includes(q) : false;
                if (!matchTitle && !matchMsg && !matchService && !matchTrace && !matchReq) {
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
            if (selectedSdk !== "ALL") {
                if (ev.sdkName !== selectedSdk) return false;
            }

            // Time range filter
            if (selectedTimeRange !== "ALL") {
                const evTime = new Date(ev.timestamp).getTime();
                const deltaMs = now - evTime;
                if (selectedTimeRange === "15m" && deltaMs > 15 * 60 * 1000) return false;
                if (selectedTimeRange === "1h" && deltaMs > 60 * 60 * 1000) return false;
                if (selectedTimeRange === "24h" && deltaMs > 24 * 60 * 60 * 1000) return false;
                if (selectedTimeRange === "7d" && deltaMs > 7 * 24 * 60 * 60 * 1000) return false;
            }

            return true;
        });
    }, [
        events,
        searchQuery,
        selectedType,
        selectedSeverity,
        selectedService,
        selectedEnv,
        selectedSdk,
        selectedTimeRange,
    ]);

    const formatTimeDetailed = (date: Date) => {
        const d = new Date(date);
        return d.toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    return (
        <div className="space-y-6">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                        Events
                    </h1>
                    <p className="text-sm text-secondary mt-1">
                        Every event received from your application.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="px-3.5 py-1.5 rounded-xl bg-surface border border-border flex items-center gap-2 font-mono text-xs text-zinc-300">
                        <Activity size={14} className="text-accent" />
                        <span>
                            <strong className="text-white font-bold">{filteredEvents.length}</strong>
                            {filteredEvents.length !== events.length ? ` / ${events.length}` : ""} event{filteredEvents.length !== 1 ? "s" : ""}
                        </span>
                    </div>
                </div>
            </div>

            {/* 23. Filter / Query Toolbar Order: Search → Type → Severity → Service → Environment → SDK → Time */}
            <div className="p-3 rounded-2xl bg-surface/70 border border-border space-y-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* 1. Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={14} />
                        <input
                            type="text"
                            placeholder="Search title, message, service, traceId..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-9 rounded-xl bg-[#080b11] border border-white/10 pl-9 pr-8 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent font-mono"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {/* 2. Type */}
                    <select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        className="h-9 px-3 rounded-xl bg-[#080b11] border border-white/10 text-xs font-mono text-zinc-300 focus:outline-none focus:border-accent cursor-pointer"
                    >
                        <option value="ALL">All Types</option>
                        {eventTypes.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>

                    {/* 3. Severity */}
                    <select
                        value={selectedSeverity}
                        onChange={(e) => setSelectedSeverity(e.target.value)}
                        className="h-9 px-3 rounded-xl bg-[#080b11] border border-white/10 text-xs font-mono text-zinc-300 focus:outline-none focus:border-accent cursor-pointer"
                    >
                        <option value="ALL">All Severities</option>
                        <option value="FATAL">FATAL</option>
                        <option value="ERROR">ERROR</option>
                        <option value="WARNING">WARNING</option>
                        <option value="INFO">INFO</option>
                    </select>

                    {/* 4. Service */}
                    {services.length > 0 && (
                        <select
                            value={selectedService}
                            onChange={(e) => setSelectedService(e.target.value)}
                            className="h-9 px-3 rounded-xl bg-[#080b11] border border-white/10 text-xs font-mono text-zinc-300 focus:outline-none focus:border-accent cursor-pointer"
                        >
                            <option value="ALL">All Services</option>
                            {services.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    )}

                    {/* 5. Environment */}
                    {environments.length > 0 && (
                        <select
                            value={selectedEnv}
                            onChange={(e) => setSelectedEnv(e.target.value)}
                            className="h-9 px-3 rounded-xl bg-[#080b11] border border-white/10 text-xs font-mono text-zinc-300 focus:outline-none focus:border-accent cursor-pointer"
                        >
                            <option value="ALL">All Environments</option>
                            {environments.map((env) => (
                                <option key={env} value={env}>{env}</option>
                            ))}
                        </select>
                    )}

                    {/* 6. SDK */}
                    {sdks.length > 0 && (
                        <select
                            value={selectedSdk}
                            onChange={(e) => setSelectedSdk(e.target.value)}
                            className="h-9 px-3 rounded-xl bg-[#080b11] border border-white/10 text-xs font-mono text-zinc-300 focus:outline-none focus:border-accent cursor-pointer"
                        >
                            <option value="ALL">All SDKs</option>
                            {sdks.map((sdk) => (
                                <option key={sdk} value={sdk}>{sdk}</option>
                            ))}
                        </select>
                    )}

                    {/* 7. Time */}
                    <select
                        value={selectedTimeRange}
                        onChange={(e) => setSelectedTimeRange(e.target.value)}
                        className="h-9 px-3 rounded-xl bg-[#080b11] border border-white/10 text-xs font-mono text-zinc-300 focus:outline-none focus:border-accent cursor-pointer"
                    >
                        <option value="ALL">All Time</option>
                        <option value="15m">Last 15 minutes</option>
                        <option value="1h">Last 1 hour</option>
                        <option value="24h">Last 24 hours</option>
                        <option value="7d">Last 7 days</option>
                    </select>

                    {/* Clear Filters Button */}
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="h-9 px-3 rounded-xl bg-surface hover:bg-surface-hover border border-border text-xs font-mono text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                            <RotateCcw size={12} />
                            <span>Clear</span>
                        </button>
                    )}
                </div>
            </div>

            {/* 24. Main Chronological Event Stream Columns: Timestamp | Type | Event Payload / Message | Severity | Service | SDK */}
            {filteredEvents.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-surface border border-border space-y-3">
                    <p className="text-sm font-semibold text-white">No telemetry events match your filters</p>
                    <p className="text-xs text-secondary max-w-md mx-auto">
                        Try clearing or adjusting your search query, severity, service, SDK, or time range filters.
                    </p>
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="halo-btn halo-btn-xs halo-btn-secondary mt-2 inline-flex items-center gap-1"
                        >
                            <RotateCcw size={12} />
                            Reset All Filters
                        </button>
                    )}
                </div>
            ) : (
                <div className="rounded-2xl border border-border bg-[#080b11] overflow-hidden shadow-xl">
                    {/* Stream Header */}
                    <div className="grid grid-cols-[130px_90px_minmax(0,1fr)_90px_110px_100px] items-center gap-3 px-4 py-2.5 bg-surface/90 border-b border-border text-[10px] font-mono uppercase tracking-wider text-muted select-none">
                        <span>Timestamp</span>
                        <span>Type</span>
                        <span>Event Payload / Message</span>
                        <span>Severity</span>
                        <span>Service</span>
                        <span className="text-right">SDK</span>
                    </div>

                    {/* Stream Rows */}
                    <div className="divide-y divide-white/5">
                        {filteredEvents.map((event) => {
                            const envName = event.environment?.name || "production";

                            return (
                                <Link
                                    key={event.id}
                                    href={`/projects/${projectId}/events/${event.id}`}
                                    className="grid grid-cols-[130px_90px_minmax(0,1fr)_90px_110px_100px] items-center gap-3 px-4 py-3 hover:bg-surface/50 transition-colors group cursor-pointer"
                                >
                                    {/* 1. Timestamp */}
                                    <div className="font-mono text-xs space-y-0.5">
                                        <span className="text-zinc-300 font-semibold block">
                                            {formatTimeDetailed(event.timestamp)}
                                        </span>
                                        <span className="text-[10px] text-zinc-500 block truncate">
                                            <RelativeTime date={event.timestamp} />
                                        </span>
                                    </div>

                                    {/* 2. Event Type Badge */}
                                    <div>
                                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border bg-surface border-border text-accent truncate block text-center">
                                            {event.type}
                                        </span>
                                    </div>

                                    {/* 3. Primary Title & Message */}
                                    <div className="min-w-0 pr-2">
                                        <p className="text-xs font-semibold text-white group-hover:text-accent transition-colors truncate">
                                            {event.title}
                                        </p>
                                        {event.message && (
                                            <p className="text-[11px] font-mono text-zinc-400 truncate mt-0.5">
                                                {event.message}
                                            </p>
                                        )}
                                        {event.traceId && (
                                            <span className="text-[10px] font-mono text-zinc-600 block truncate">
                                                trace: {event.traceId}
                                            </span>
                                        )}
                                    </div>

                                    {/* 4. Severity */}
                                    <div>
                                        <SeverityBadge severity={event.severity as any} />
                                    </div>

                                    {/* 5. Service & Environment */}
                                    <div className="font-mono text-xs space-y-0.5 truncate">
                                        <span className="text-zinc-300 truncate block text-[11px]">
                                            {event.service || "web-client"}
                                        </span>
                                        <span className="text-[10px] text-zinc-500 truncate block">
                                            {envName}
                                        </span>
                                    </div>

                                    {/* 6. SDK Version */}
                                    <div className="font-mono text-right text-xs truncate">
                                        <span className="text-zinc-400 text-[11px] block truncate">
                                            {event.sdkName || "SDK"}
                                        </span>
                                        {event.sdkVersion && (
                                            <span className="text-[10px] text-zinc-600 block">
                                                v{event.sdkVersion}
                                            </span>
                                        )}
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
