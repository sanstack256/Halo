"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Search,
    X,
    FileWarning,
    Globe,
    Waypoints,
    Terminal,
    Database,
    Radio,
    Clock,
    ArrowUpRight,
    Sparkles,
    ChevronRight,
} from "lucide-react";
import type { CategorizedSearchResults, EvidenceNeedleResult } from "@/lib/explore/evidence-needle";
import type { CanonicalEvidenceRecord } from "@/lib/explore/evidence-types";
import { ExploreHeader } from "./explore-header";
import { ExploreContextBar } from "./explore-context-bar";
import { EvidenceBadge } from "./evidence-badge";
import { DetailDrawer } from "./detail-drawer";
import { ExploreEmptyState } from "./empty-state";
import { RelativeTime } from "@/components/ui/relative-time";
import { formatDeterministicTime } from "@/lib/date-format";

interface SearchNeedleClientProps {
    initialQuery: string;
    initialAnchorId?: string;
    searchResults: CategorizedSearchResults;
    needle: EvidenceNeedleResult | null;
    contextOptions: {
        projects: Array<{ id: string; name: string }>;
        environments: Array<{ id: string; name: string; projectId: string }>;
        services: string[];
        releases: string[];
    };
}

export function SearchNeedleClient({
    initialQuery,
    initialAnchorId,
    searchResults,
    needle,
    contextOptions,
}: SearchNeedleClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const searchInputRef = useRef<HTMLInputElement>(null);

    const [query, setQuery] = useState(initialQuery);
    const [selectedRecord, setSelectedRecord] = useState<CanonicalEvidenceRecord | null>(null);

    useEffect(() => {
        setQuery(initialQuery);
    }, [initialQuery]);

    // Global keyboard shortcut Cmd+K to focus search input
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const handleSearchSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const effectiveQuery = (searchInputRef.current?.value ?? query).trim();
        const searchStr = typeof window !== "undefined" ? window.location.search : searchParams.toString();
        const params = new URLSearchParams(searchStr);
        if (effectiveQuery) {
            params.set("q", effectiveQuery);
        } else {
            params.delete("q");
        }
        params.delete("anchorId");
        if (typeof window !== "undefined") {
            window.location.href = `/explore?${params.toString()}`;
        } else {
            router.push(`/explore?${params.toString()}`);
        }
    };

    const handleSelectAnchor = (rec: CanonicalEvidenceRecord) => {
        const searchStr = typeof window !== "undefined" ? window.location.search : searchParams.toString();
        const params = new URLSearchParams(searchStr);
        params.set("anchorId", rec.id);
        const effectiveQuery = (searchInputRef.current?.value ?? query).trim();
        if (effectiveQuery) params.set("q", effectiveQuery);
        if (typeof window !== "undefined") {
            window.location.href = `/explore?${params.toString()}`;
        } else {
            router.push(`/explore?${params.toString()}`);
        }
    };

    const hasResults = searchResults.totalMatches > 0;

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <ExploreHeader
                title="Search"
                subtitle="Find the exact evidence thread behind a signal."
                icon={Search}
                badgeText={hasResults ? `${searchResults.totalMatches} matches` : undefined}
            />

            {/* Dominant Search Surface */}
            <div className="space-y-2">
                <form onSubmit={handleSearchSubmit} className="relative">
                    <Search
                        size={18}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                    />
                    <input
                        id="search-input"
                        ref={searchInputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                handleSearchSubmit(e);
                            }
                        }}
                        placeholder="Search error messages, request IDs, trace IDs, logs, services, releases... (Press ⌘K to focus)"
                        className="w-full h-12 pl-12 pr-28 rounded-xl border border-border bg-[#080b11] text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent font-sans shadow-sm"
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                        {query && (
                            <button
                                type="button"
                                onClick={() => {
                                    setQuery("");
                                    searchInputRef.current?.focus();
                                }}
                                className="p-1 text-zinc-500 hover:text-white"
                                title="Clear search"
                            >
                                <X size={15} />
                            </button>
                        )}
                        <button
                            id="search-submit-btn"
                            type="button"
                            onClick={handleSearchSubmit}
                            className="halo-btn halo-btn-xs halo-btn-primary font-sans h-7 px-2.5 text-[11px]"
                        >
                            Search
                        </button>
                    </div>
                </form>

                {/* Compact Syntax Examples */}
                <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono text-muted px-1">
                    <span className="text-secondary font-semibold">SYNTAX:</span>
                    <button
                        type="button"
                        onClick={() => setQuery("request:")}
                        className="hover:text-accent underline decoration-dotted"
                    >
                        request:...
                    </button>
                    <span>•</span>
                    <button
                        type="button"
                        onClick={() => setQuery("trace:")}
                        className="hover:text-accent underline decoration-dotted"
                    >
                        trace:...
                    </button>
                    <span>•</span>
                    <button
                        type="button"
                        onClick={() => setQuery("service:")}
                        className="hover:text-accent underline decoration-dotted"
                    >
                        service:...
                    </button>
                    <span>•</span>
                    <button
                        type="button"
                        onClick={() => setQuery("error:")}
                        className="hover:text-accent underline decoration-dotted"
                    >
                        error:...
                    </button>
                    <span>•</span>
                    <button
                        type="button"
                        onClick={() => setQuery("release:")}
                        className="hover:text-accent underline decoration-dotted"
                    >
                        release:...
                    </button>
                    <span>•</span>
                    <button
                        type="button"
                        onClick={() => setQuery('message:"checkout"')}
                        className="hover:text-accent underline decoration-dotted"
                    >
                        message:&quot;...&quot;
                    </button>
                </div>
            </div>

            {/* Context Filter Bar */}
            <ExploreContextBar
                projects={contextOptions.projects}
                environments={contextOptions.environments}
                services={contextOptions.services}
                releases={contextOptions.releases}
                showSearch={false}
            />

            {/* Main Investigation Split View: Search Results (Left) + Evidence Needle (Right) */}
            {!hasResults && !query.trim() ? (
                <ExploreEmptyState
                    type="NO_DATA"
                    title="Enter evidence to discover surrounding context"
                    description="Search by error message, distributed trace ID, request ID, SQL snippet, or service name to reconstruct the underlying execution needle."
                />
            ) : !hasResults && query.trim() ? (
                <ExploreEmptyState
                    type="NO_DATA"
                    title="No matching telemetry observed"
                    description={`No telemetry records matched "${query}". Verify the query syntax or broaden the time range.`}
                />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* Left Column: Categorized Search Matches */}
                    <div className="lg:col-span-6 space-y-4">
                        <div className="flex items-center justify-between pb-1 border-b border-border text-xs font-mono">
                            <span className="text-muted uppercase font-semibold">
                                Categorized Evidence ({searchResults.totalMatches})
                            </span>
                            <span className="text-[11px] text-secondary">
                                Click to anchor needle
                            </span>
                        </div>

                        {/* Errors */}
                        {searchResults.errors.length > 0 && (
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-red-400">
                                    <FileWarning size={13} />
                                    <span>Errors ({searchResults.errors.length})</span>
                                </div>
                                <div className="space-y-1">
                                    {searchResults.errors.map((err) => (
                                        <div
                                            key={err.id}
                                            onClick={() => handleSelectAnchor(err)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-colors text-xs ${
                                                needle?.anchor.id === err.id
                                                    ? "bg-accent/10 border-accent text-white ring-1 ring-accent/30"
                                                    : "bg-surface border-border hover:border-border-strong text-zinc-300"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-semibold text-white truncate font-sans">
                                                    {err.title}
                                                </span>
                                                <span className="text-[10px] font-mono text-muted shrink-0">
                                                    <RelativeTime date={err.timestamp} />
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] font-mono text-secondary mt-1 flex-wrap">
                                                <span>{err.service || "service"}</span>
                                                <span>•</span>
                                                <span>{err.environmentName}</span>
                                                {err.traceId && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="text-cyan-400">trace:{err.traceId.slice(0, 8)}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Requests */}
                        {searchResults.requests.length > 0 && (
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-purple-400">
                                    <Globe size={13} />
                                    <span>Requests ({searchResults.requests.length})</span>
                                </div>
                                <div className="space-y-1">
                                    {searchResults.requests.map((req) => (
                                        <div
                                            key={req.id}
                                            onClick={() => handleSelectAnchor(req)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-colors text-xs ${
                                                needle?.anchor.id === req.id
                                                    ? "bg-accent/10 border-accent text-white ring-1 ring-accent/30"
                                                    : "bg-surface border-border hover:border-border-strong text-zinc-300"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-semibold text-white truncate font-sans">
                                                    {req.resource || req.title}
                                                </span>
                                                <span className="text-[10px] font-mono text-muted shrink-0">
                                                    <RelativeTime date={req.timestamp} />
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] font-mono text-secondary mt-1 flex-wrap">
                                                <span>{req.service || "service"}</span>
                                                <span>•</span>
                                                <span className="text-purple-300">req:{req.requestId?.slice(0, 8)}</span>
                                                {req.durationMs && <span>• {req.durationMs}ms</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Traces */}
                        {searchResults.traces.length > 0 && (
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-cyan-400">
                                    <Waypoints size={13} />
                                    <span>Traces ({searchResults.traces.length})</span>
                                </div>
                                <div className="space-y-1">
                                    {searchResults.traces.map((tr) => (
                                        <div
                                            key={tr.id}
                                            onClick={() => handleSelectAnchor(tr)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-colors text-xs ${
                                                needle?.anchor.id === tr.id
                                                    ? "bg-accent/10 border-accent text-white ring-1 ring-accent/30"
                                                    : "bg-surface border-border hover:border-border-strong text-zinc-300"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-semibold text-white truncate font-sans">
                                                    {tr.operation || tr.title}
                                                </span>
                                                <span className="text-[10px] font-mono text-muted shrink-0">
                                                    <RelativeTime date={tr.timestamp} />
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] font-mono text-secondary mt-1 flex-wrap">
                                                <span>{tr.service || "service"}</span>
                                                <span>•</span>
                                                <span className="text-cyan-300">trace:{tr.traceId?.slice(0, 8)}</span>
                                                {tr.durationMs && <span>• {tr.durationMs}ms</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Database */}
                        {searchResults.database.length > 0 && (
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-emerald-400">
                                    <Database size={13} />
                                    <span>Database Operations ({searchResults.database.length})</span>
                                </div>
                                <div className="space-y-1">
                                    {searchResults.database.map((db) => (
                                        <div
                                            key={db.id}
                                            onClick={() => handleSelectAnchor(db)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-colors text-xs ${
                                                needle?.anchor.id === db.id
                                                    ? "bg-accent/10 border-accent text-white ring-1 ring-accent/30"
                                                    : "bg-surface border-border hover:border-border-strong text-zinc-300"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-mono text-white truncate text-[11px]">
                                                    {db.resource || db.operation || db.title}
                                                </span>
                                                <span className="text-[10px] font-mono text-muted shrink-0">
                                                    <RelativeTime date={db.timestamp} />
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] font-mono text-secondary mt-1 flex-wrap">
                                                <span>{db.service || "database"}</span>
                                                {db.durationMs && <span>• {db.durationMs}ms</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Logs */}
                        {searchResults.logs.length > 0 && (
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-amber-400">
                                    <Terminal size={13} />
                                    <span>Logs ({searchResults.logs.length})</span>
                                </div>
                                <div className="space-y-1">
                                    {searchResults.logs.map((log) => (
                                        <div
                                            key={log.id}
                                            onClick={() => handleSelectAnchor(log)}
                                            className={`p-3 rounded-lg border cursor-pointer transition-colors text-xs ${
                                                needle?.anchor.id === log.id
                                                    ? "bg-accent/10 border-accent text-white ring-1 ring-accent/30"
                                                    : "bg-surface border-border hover:border-border-strong text-zinc-300"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-mono text-white truncate text-[11px]">
                                                    {log.message || log.title}
                                                </span>
                                                <span className="text-[10px] font-mono text-muted shrink-0">
                                                    <RelativeTime date={log.timestamp} />
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-[11px] font-mono text-secondary mt-1 flex-wrap">
                                                <span>{log.service || "service"}</span>
                                                <span>•</span>
                                                <span className="text-zinc-400">{log.severity}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: The Evidence Needle */}
                    <div className="lg:col-span-6 space-y-3 sticky top-6">
                        <div className="flex items-center justify-between pb-1 border-b border-border text-xs font-mono">
                            <div className="flex items-center gap-1.5 text-accent font-semibold">
                                <Sparkles size={13} />
                                <span>THE EVIDENCE NEEDLE</span>
                            </div>
                            {needle && (
                                <span className="text-[11px] text-muted">
                                    Window: ±{needle.windowSeconds}s ({needle.items.length} items)
                                </span>
                            )}
                        </div>

                        {!needle ? (
                            <div className="p-6 rounded-xl bg-surface border border-border text-center text-xs text-muted">
                                Select an evidence match on the left to reconstruct its chronological execution needle.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Anchor Summary Banner */}
                                <div className="p-3.5 rounded-xl bg-accent/10 border border-accent/30 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-mono uppercase font-bold text-accent">
                                            SELECTED ANCHOR ({needle.anchor.type})
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedRecord(needle.anchor)}
                                            className="halo-btn halo-btn-xs halo-btn-secondary text-[10px] font-mono"
                                        >
                                            Inspect Details
                                        </button>
                                    </div>
                                    <p className="text-xs font-semibold text-white font-sans">
                                        {needle.anchor.title}
                                    </p>
                                    <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-300 flex-wrap">
                                        <span>Service: {needle.anchor.service || "service"}</span>
                                        <span>•</span>
                                        <span>Time: {formatDeterministicTime(needle.anchor.timestamp, "UTC", false)} UTC</span>
                                    </div>
                                </div>

                                {/* Linkage Counts Strip */}
                                <div className="halo-metric-strip grid-cols-4 text-center">
                                    <div className="halo-metric-cell p-2 space-y-0.5">
                                        <span className="text-[10px] font-mono text-cyan-400 block font-semibold">TRACE</span>
                                        <span className="text-base font-bold text-white block">{needle.summary.directTraceCount}</span>
                                    </div>
                                    <div className="halo-metric-cell p-2 space-y-0.5">
                                        <span className="text-[10px] font-mono text-purple-400 block font-semibold">REQUEST</span>
                                        <span className="text-base font-bold text-white block">{needle.summary.directRequestCount}</span>
                                    </div>
                                    <div className="halo-metric-cell p-2 space-y-0.5">
                                        <span className="text-[10px] font-mono text-blue-400 block font-semibold">SESSION</span>
                                        <span className="text-base font-bold text-white block">{needle.summary.directSessionCount}</span>
                                    </div>
                                    <div className="halo-metric-cell p-2 space-y-0.5">
                                        <span className="text-[10px] font-mono text-muted block font-semibold">TEMPORAL</span>
                                        <span className="text-base font-bold text-white block">{needle.summary.temporalCount}</span>
                                    </div>
                                </div>

                                {/* Chronological Neighborhood List */}
                                <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
                                    {needle.items.map((item) => (
                                        <div
                                            key={item.record.id}
                                            onClick={() => setSelectedRecord(item.record)}
                                            className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors space-y-1.5 ${
                                                item.isAnchor
                                                    ? "bg-accent/15 border-accent text-white ring-1 ring-accent"
                                                    : "bg-surface border-border hover:border-border-strong text-zinc-300"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <EvidenceBadge linkage={item.relationshipType} reason={item.linkReason} compact />
                                                    <span className="font-mono text-[10px] text-muted">
                                                        {item.offsetMs === 0
                                                            ? "T+0ms (Anchor)"
                                                            : item.offsetMs < 0
                                                            ? `${item.offsetMs}ms before`
                                                            : `+${item.offsetMs}ms after`}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] font-mono text-muted">
                                                    {formatDeterministicTime(item.record.timestamp, "UTC", false)}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-sans font-medium text-white truncate">
                                                    {item.record.title}
                                                </span>
                                                <span className="text-[10px] font-mono text-secondary shrink-0">
                                                    {item.record.service}
                                                </span>
                                            </div>

                                            {/* Reason why included */}
                                            <p className="text-[11px] text-secondary font-sans leading-tight">
                                                {item.linkReason}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Detail Drawer */}
            <DetailDrawer
                record={selectedRecord}
                onClose={() => setSelectedRecord(null)}
            />
        </div>
    );
}
