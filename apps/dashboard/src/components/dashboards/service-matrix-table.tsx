"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    ArrowDownRight,
    ArrowRight,
    ArrowUpRight,
    CheckCircle2,
    Clock,
    HelpCircle,
    Layers,
    Radio,
    Search,
    ShieldAlert,
    Sparkles,
    TrendingDown,
    TrendingUp,
} from "lucide-react";
import type { ServiceLandscapeItem, ServiceHealthStatus } from "@/lib/analytics/types";

interface ServiceMatrixTableProps {
    services: ServiceLandscapeItem[];
    onSelectService: (service: ServiceLandscapeItem) => void;
    projectId?: string;
}

export function ServiceMatrixTable({
    services,
    onSelectService,
    projectId,
}: ServiceMatrixTableProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("ALL");

    const filtered = services.filter((s) => {
        const matchesSearch = s.service.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === "ALL" || s.health === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const healthBadgeClass: Record<ServiceHealthStatus, string> = {
        Healthy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        Degraded: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        Critical: "bg-red-500/10 text-red-400 border-red-500/20",
        Unknown: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    };

    const priorityBadgeClass: Record<string, string> = {
        "Very High": "bg-red-500/20 text-red-400 border-red-500/30",
        "High": "bg-amber-500/20 text-amber-400 border-amber-500/30",
        "Medium": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
        "Low": "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
    };

    return (
        <div className="p-6 rounded-2xl border border-border bg-surface-elevated space-y-4 font-mono text-xs">
            {/* Header & Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                    <Layers size={14} className="text-accent" />
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                        Cross-Service Matrix &amp; Health Evaluation
                    </h3>
                    <span className="text-[10px] text-muted">({filtered.length} services)</span>
                </div>

                <div className="flex items-center gap-2">
                    {/* Search Input */}
                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-2 text-muted" />
                        <input
                            type="text"
                            placeholder="Filter services..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-[#080b11] border border-border rounded-lg pl-8 pr-3 py-1 text-[11px] text-white focus:outline-none focus:border-accent/40 w-44"
                        />
                    </div>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-[#080b11] border border-border rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-accent/40"
                    >
                        <option value="ALL">All States</option>
                        <option value="Critical">Critical</option>
                        <option value="Degraded">Degraded</option>
                        <option value="Healthy">Healthy</option>
                        <option value="Unknown">Unknown</option>
                    </select>
                </div>
            </div>

            {/* Matrix Table */}
            {filtered.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center text-center border border-dashed border-border rounded-xl p-4">
                    <Clock size={20} className="text-muted mb-2 opacity-50" />
                    <p className="text-xs text-white font-medium font-sans">No matching services found</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border/80 text-[10px] text-muted uppercase tracking-wider">
                                <th className="pb-2 pl-2">Service</th>
                                <th className="pb-2">Health State</th>
                                <th className="pb-2">Priority</th>
                                <th className="pb-2">Failure Share</th>
                                <th className="pb-2">Error Rate</th>
                                <th className="pb-2">Latency P95</th>
                                <th className="pb-2">Requests</th>
                                <th className="pb-2 pr-2 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 text-[11px]">
                            {filtered.map((s) => (
                                <tr
                                    key={s.service}
                                    onClick={() => onSelectService(s)}
                                    className="hover:bg-[#080b11]/80 transition-colors cursor-pointer group"
                                >
                                    {/* Service Name & Project */}
                                    <td className="py-3 pl-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-white group-hover:text-accent transition-colors">
                                                {s.service}
                                            </span>
                                            {s.activeIssuesCount > 0 && (
                                                <span className="px-1.5 py-0.2 rounded bg-red-500/15 text-red-400 text-[9px] font-bold">
                                                    {s.activeIssuesCount} issues
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Health Badge & Deterministic Reason Tooltip */}
                                    <td className="py-3">
                                        <div className="group/health relative inline-block">
                                            <span
                                                className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${healthBadgeClass[s.health]}`}
                                            >
                                                {s.health}
                                            </span>
                                            <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/health:block z-20 w-52 p-2 rounded-lg bg-[#04060a] border border-border text-[10px] text-zinc-300 shadow-xl pointer-events-none font-sans">
                                                {s.healthReason}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Investigation Priority */}
                                    <td className="py-3">
                                        <div className="group/prio relative inline-block">
                                            <span
                                                className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold ${priorityBadgeClass[s.investigationPriority.level] || priorityBadgeClass["Low"]}`}
                                            >
                                                {s.investigationPriority.level}
                                            </span>
                                            <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/prio:block z-20 w-56 p-2 rounded-lg bg-[#04060a] border border-border text-[10px] text-zinc-300 shadow-xl pointer-events-none font-sans">
                                                <div className="font-semibold text-white mb-1">Priority Drivers:</div>
                                                <ul className="list-disc pl-3 space-y-0.5">
                                                    {s.investigationPriority.reasons.map((r, i) => (
                                                        <li key={i}>{r}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Failure Share Bar */}
                                    <td className="py-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 rounded-full bg-[#080b11] border border-border overflow-hidden">
                                                <div
                                                    className="h-full bg-red-500 rounded-full"
                                                    style={{ width: `${Math.min(100, s.failureContributionPct)}%` }}
                                                />
                                            </div>
                                            <span className="text-zinc-300 text-[10px]">
                                                {s.failureContributionPct}%
                                            </span>
                                        </div>
                                    </td>

                                    {/* Error Rate */}
                                    <td className="py-3">
                                        <span className={`font-semibold ${s.errorRate > 0 ? "text-red-400" : "text-zinc-400"}`}>
                                            {s.errorRate}%
                                        </span>
                                    </td>

                                    {/* Latency P95 */}
                                    <td className="py-3 text-zinc-300">
                                        {s.p95LatencyMs !== null ? `${s.p95LatencyMs}ms` : "-"}
                                    </td>

                                    {/* Requests */}
                                    <td className="py-3 text-zinc-300">
                                        {s.requestCount}
                                    </td>

                                    {/* Action Drilldown */}
                                    <td className="py-3 pr-2 text-right">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectService(s);
                                            }}
                                            className="halo-btn halo-btn-ghost halo-btn-xs"
                                        >
                                            <span>Inspect</span>
                                            <ArrowRight size={11} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
