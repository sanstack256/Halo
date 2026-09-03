"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Database,
    Clock,
    Layers,
    ArrowUpRight,
    Split,
    AlertTriangle,
    Search,
    ChevronRight,
    Waypoints,
    Globe,
    Info,
    HelpCircle,
} from "lucide-react";
import type { DatabaseWaitAttributionResult, DatabaseQueryRecord } from "@/lib/explore/db-attribution";
import { ExploreHeader } from "./explore-header";
import { ExploreEmptyState } from "./empty-state";
import { CopyButton } from "./copy-button";
import { DetailDrawer } from "./detail-drawer";

interface DatabaseAttributionClientProps {
    data: DatabaseWaitAttributionResult;
    currentRequestId?: string;
    currentService?: string;
}

export function DatabaseAttributionClient({
    data,
    currentRequestId,
    currentService,
}: DatabaseAttributionClientProps) {
    const [selectedQuery, setSelectedQuery] = useState<DatabaseQueryRecord | null>(
        data.queries[0] || null
    );

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <ExploreHeader
                title="Database"
                subtitle="Determine where observed request time was actually spent waiting on database operations."
                icon={Database}
                badgeText={data.telemetryObserved ? `${data.queries.length} observed queries` : "No DB Telemetry"}
            />

            {/* KPI Summary Strip */}
            <div className="halo-metric-strip grid-cols-2 sm:grid-cols-4">
                <div className="halo-metric-cell space-y-1">
                    <span className="text-[10px] text-muted uppercase font-semibold font-mono">
                        Observed Request Time
                    </span>
                    <span className="text-xl font-bold text-white block font-sans">
                        {data.requestDurationMs !== null ? `${data.requestDurationMs}ms` : "Unmeasured"}
                    </span>
                </div>
                <div className="halo-metric-cell space-y-1">
                    <span className="text-[10px] text-muted uppercase font-semibold font-mono">
                        Observed Database Wait
                    </span>
                    <span className="text-xl font-bold text-amber-400 block font-sans">
                        {data.telemetryObserved ? `${data.totalDbWaitMs}ms` : "NOT OBSERVED"}
                    </span>
                </div>
                <div className="halo-metric-cell space-y-1">
                    <span className="text-[10px] text-muted uppercase font-semibold font-mono">
                        Database Wait Fraction
                    </span>
                    <span className="text-xl font-bold text-cyan-400 block font-sans">
                        {data.dbWaitPercentage !== null ? `${data.dbWaitPercentage}%` : "NOT OBSERVED"}
                    </span>
                </div>
                <div className="halo-metric-cell space-y-1">
                    <span className="text-[10px] text-muted uppercase font-semibold font-mono">
                        Unattributed Processing Gap
                    </span>
                    <span className="text-xl font-bold text-purple-400 block font-sans">
                        {data.unattributedMs !== null && data.unattributedMs > 0 ? `${data.unattributedMs}ms` : "0ms"}
                    </span>
                </div>
            </div>

            {/* Evidence Sufficiency Warning if unobserved or limited */}
            {data.sufficiency.status !== "SUFFICIENT" && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs font-mono space-y-2">
                    <div className="flex items-center gap-2 text-amber-300 font-bold">
                        <AlertTriangle size={15} />
                        <span>EVIDENCE SUFFICIENCY: {data.sufficiency.status}</span>
                    </div>
                    <ul className="text-zinc-300 space-y-1 list-disc list-inside">
                        {data.sufficiency.reasons.map((r, idx) => (
                            <li key={idx}>{r}</li>
                        ))}
                    </ul>
                    <div className="text-muted text-[11px]">
                        Recommended action: {data.sufficiency.recommendedNextActions[0] || "Inspect request spans."}
                    </div>
                </div>
            )}

            {/* Slow vs Fast Request Comparison */}
            {data.slowVsFastComparison && (
                <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-muted uppercase font-semibold">
                            COMPARATIVE DATABASE WAIT (TARGET VS FAST REFERENCE)
                        </span>
                        <span className="text-cyan-400 font-bold">
                            {data.slowVsFastComparison.queryDiffExplanation}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                        <div className="p-3 rounded-lg bg-[#04060a] border border-border space-y-1">
                            <span className="text-muted text-[10px] uppercase">Target Execution</span>
                            <div className="text-white font-bold text-sm">
                                {data.slowVsFastComparison.targetDbDurationMs}ms DB Wait
                            </div>
                            <div className="text-secondary text-[11px]">
                                {data.slowVsFastComparison.targetQueryCount} queries observed
                            </div>
                        </div>

                        <div className="p-3 rounded-lg bg-[#04060a] border border-border space-y-1">
                            <span className="text-muted text-[10px] uppercase">Fast Reference Request</span>
                            <div className="text-emerald-400 font-bold text-sm">
                                {data.slowVsFastComparison.referenceDbDurationMs}ms DB Wait
                            </div>
                            <div className="text-secondary text-[11px]">
                                {data.slowVsFastComparison.referenceQueryCount} queries • Request: {data.slowVsFastComparison.referenceRequestId.slice(0, 8)}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Query Breakdown or Truthful Empty State */}
            {!data.telemetryObserved ? (
                <ExploreEmptyState
                    type="MISSING_TELEMETRY"
                    title="DATABASE TELEMETRY NOT OBSERVED"
                    description="No database spans or SQL execution metrics were observed for this request context. Database wait duration is unobserved rather than 0ms."
                    action={
                        <Link
                            href={data.targetRequestId ? `/explore/requests?requestId=${encodeURIComponent(data.targetRequestId)}` : "/explore/requests"}
                            className="halo-btn halo-btn-sm halo-btn-primary"
                        >
                            Inspect Request Telemetry
                        </Link>
                    }
                />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                    {/* Left: Query List */}
                    <div className="lg:col-span-5 rounded-xl bg-surface border border-border overflow-hidden">
                        <div className="p-3 bg-[#06080e] border-b border-border flex items-center justify-between text-xs font-mono">
                            <span className="text-muted uppercase font-semibold">
                                OBSERVED QUERIES ({data.queries.length})
                            </span>
                            <span className="text-secondary text-[11px]">Total: {data.totalDbWaitMs}ms</span>
                        </div>

                        <div className="divide-y divide-border/40 font-mono text-xs max-h-[580px] overflow-y-auto">
                            {data.queries.map((q) => {
                                const isSelected = selectedQuery?.id === q.id;
                                return (
                                    <div
                                        key={q.id}
                                        onClick={() => setSelectedQuery(q)}
                                        className={`p-3 cursor-pointer transition-colors ${
                                            isSelected
                                                ? "bg-accent/10 border-l-2 border-accent text-white"
                                                : "hover:bg-surface-elevated text-zinc-300"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                {q.waitCategory}
                                            </span>
                                            <span className="text-white font-bold">{q.durationMs}ms</span>
                                        </div>
                                        <div className="mt-1.5 text-[11px] text-zinc-300 truncate font-mono">
                                            {q.statement}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right: Selected Query Inspection */}
                    <div className="lg:col-span-7 rounded-xl bg-surface border border-border p-4 space-y-4">
                        {selectedQuery ? (
                            <>
                                <div className="flex items-center justify-between border-b border-border pb-3">
                                    <div className="space-y-0.5">
                                        <span className="text-[10px] font-mono uppercase text-muted">
                                            Observed SQL Operation
                                        </span>
                                        <h3 className="text-sm font-bold text-white font-mono">
                                            {selectedQuery.operation} ({selectedQuery.databaseSystem})
                                        </h3>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-lg font-bold text-amber-400 font-sans block">
                                            {selectedQuery.durationMs}ms
                                        </span>
                                        <span className="text-[10px] font-mono text-muted uppercase">
                                            Wait Category: {selectedQuery.waitCategory}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-mono uppercase font-semibold text-muted">
                                            Executed Statement
                                        </span>
                                        <CopyButton text={selectedQuery.statement} label="SQL" />
                                    </div>
                                    <pre className="p-3 rounded-lg bg-[#04060a] border border-border font-mono text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                                        {selectedQuery.statement}
                                    </pre>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs font-mono p-3 rounded-lg bg-[#04060a] border border-border">
                                    <div>
                                        <span className="text-muted text-[10px] uppercase block">Database System</span>
                                        <span className="text-white font-semibold">{selectedQuery.databaseSystem}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted text-[10px] uppercase block">Execution Status</span>
                                        <span className="text-emerald-400 font-semibold">{selectedQuery.status}</span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="py-12 text-center text-muted font-mono text-xs">
                                Select a query from the list to inspect its statement and attribution.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
