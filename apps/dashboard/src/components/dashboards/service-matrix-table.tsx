"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
    Activity,
    AlertTriangle,
    ArrowUpDown,
    CheckCircle2,
    Clock,
    Flame,
    HelpCircle,
    Info,
    Layers,
    Radio,
    Search,
    Server,
    ShieldAlert,
    Sparkles,
    TrendingDown,
    TrendingUp,
    X,
} from "lucide-react";
import type { ServiceLandscapeItem, ServiceHealthStatus, TrendDirection } from "@/lib/analytics/types";
import { ServiceInspectorDrawer } from "./service-inspector-drawer";

interface ServiceMatrixTableProps {
    services: ServiceLandscapeItem[];
    timeRangeKey?: string;
}

export function ServiceMatrixTable({ services, timeRangeKey = "24h" }: ServiceMatrixTableProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [sortField, setSortField] = useState<keyof ServiceLandscapeItem>("failureContributionPct");
    const [sortAsc, setSortAsc] = useState(false);
    const [selectedService, setSelectedService] = useState<ServiceLandscapeItem | null>(null);

    const handleSort = (field: keyof ServiceLandscapeItem) => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(false);
        }
    };

    const filteredServices = useMemo(() => {
        return services
            .filter((s) => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase().trim();
                return s.service.toLowerCase().includes(q) || s.projectName.toLowerCase().includes(q);
            })
            .sort((a, b) => {
                let valA = a[sortField];
                let valB = b[sortField];

                if (typeof valA === "string") {
                    return sortAsc
                        ? (valA as string).localeCompare(valB as string)
                        : (valB as string).localeCompare(valA as string);
                }

                const numA = (valA as number) || 0;
                const numB = (valB as number) || 0;
                return sortAsc ? numA - numB : numB - numA;
            });
    }, [services, searchQuery, sortField, sortAsc]);

    return (
        <div className="p-6 rounded-2xl border border-border bg-surface-elevated space-y-4 font-mono text-xs">
            {/* Header & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div className="flex items-center gap-2">
                    <Server size={14} className="text-accent" />
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                        Cross-Service Health &amp; Failure Matrix
                    </h3>
                    <span className="text-[11px] text-muted font-normal">
                        ({filteredServices.length} active services)
                    </span>
                </div>

                <div className="relative w-full sm:w-64">
                    <Search
                        size={13}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                    />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter services by name..."
                        className="w-full h-8 pl-8 pr-7 rounded-lg border border-border bg-[#080b11] text-xs text-white placeholder:text-muted focus:outline-none focus:border-accent"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-white"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Matrix Table */}
            {filteredServices.length === 0 ? (
                <div className="py-12 text-center text-muted">
                    No services found matching &quot;{searchQuery}&quot;.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border/80 text-[10px] uppercase text-muted tracking-wider">
                                <th
                                    className="py-2.5 px-3 cursor-pointer hover:text-white"
                                    onClick={() => handleSort("service")}
                                >
                                    <div className="flex items-center gap-1">
                                        <span>Service</span>
                                        <ArrowUpDown size={10} />
                                    </div>
                                </th>
                                <th
                                    className="py-2.5 px-3 cursor-pointer hover:text-white"
                                    onClick={() => handleSort("health")}
                                >
                                    <div className="flex items-center gap-1">
                                        <span>Health</span>
                                        <ArrowUpDown size={10} />
                                    </div>
                                </th>
                                <th
                                    className="py-2.5 px-3 cursor-pointer hover:text-white"
                                    onClick={() => handleSort("errorRate")}
                                >
                                    <div className="flex items-center gap-1">
                                        <span>Error Rate</span>
                                        <ArrowUpDown size={10} />
                                    </div>
                                </th>
                                <th
                                    className="py-2.5 px-3 cursor-pointer hover:text-white"
                                    onClick={() => handleSort("failureContributionPct")}
                                >
                                    <div className="flex items-center gap-1">
                                        <span>Failure Share</span>
                                        <ArrowUpDown size={10} />
                                    </div>
                                </th>
                                <th
                                    className="py-2.5 px-3 cursor-pointer hover:text-white"
                                    onClick={() => handleSort("avgLatencyMs")}
                                >
                                    <div className="flex items-center gap-1">
                                        <span>Latency (Avg/P95)</span>
                                        <ArrowUpDown size={10} />
                                    </div>
                                </th>
                                <th
                                    className="py-2.5 px-3 cursor-pointer hover:text-white"
                                    onClick={() => handleSort("totalCount")}
                                >
                                    <div className="flex items-center gap-1">
                                        <span>Volume</span>
                                        <ArrowUpDown size={10} />
                                    </div>
                                </th>
                                <th
                                    className="py-2.5 px-3 cursor-pointer hover:text-white"
                                    onClick={() => handleSort("trend")}
                                >
                                    <div className="flex items-center gap-1">
                                        <span>Trend</span>
                                        <ArrowUpDown size={10} />
                                    </div>
                                </th>
                                <th className="py-2.5 px-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {filteredServices.map((s) => {
                                const isSelected = selectedService?.service === s.service;

                                return (
                                    <tr
                                        key={`${s.service}-${s.projectId}`}
                                        onClick={() => setSelectedService(s)}
                                        className={`transition-colors cursor-pointer ${
                                            isSelected
                                                ? "bg-accent/10"
                                                : "hover:bg-white/[0.02]"
                                        }`}
                                    >
                                        {/* Service & Project */}
                                        <td className="py-3 px-3">
                                            <div className="font-semibold text-white flex items-center gap-1.5">
                                                <Layers size={13} className="text-accent" />
                                                <span>{s.service}</span>
                                            </div>
                                            <span className="text-[10px] text-muted block mt-0.5">
                                                {s.projectName}
                                            </span>
                                        </td>

                                        {/* Health Badge with Rationale Tooltip */}
                                        <td className="py-3 px-3">
                                            <div className="group relative inline-block">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                                                        s.health === "Healthy"
                                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                            : s.health === "Degraded"
                                                            ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                                            : s.health === "Critical"
                                                            ? "bg-red-500/10 border-red-500/20 text-red-400 animate-pulse"
                                                            : "bg-zinc-500/10 border-zinc-500/20 text-zinc-400"
                                                    }`}
                                                >
                                                    <span
                                                        className={`w-1.5 h-1.5 rounded-full ${
                                                            s.health === "Healthy"
                                                                ? "bg-emerald-400"
                                                                : s.health === "Degraded"
                                                                ? "bg-amber-400"
                                                                : s.health === "Critical"
                                                                ? "bg-red-400"
                                                                : "bg-zinc-400"
                                                        }`}
                                                    />
                                                    <span>{s.health}</span>
                                                </span>

                                                {/* Tooltip */}
                                                <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-30 p-2 rounded-lg bg-black/90 border border-border text-[10px] text-zinc-300 font-sans shadow-xl w-48">
                                                    {s.healthReason}
                                                </div>
                                            </div>
                                        </td>

                                        {/* Error Rate */}
                                        <td className="py-3 px-3">
                                            <span
                                                className={`font-semibold ${
                                                    s.errorRate >= 20
                                                        ? "text-red-400"
                                                        : s.errorRate >= 5
                                                        ? "text-amber-400"
                                                        : "text-white"
                                                }`}
                                            >
                                                {s.errorRate}%
                                            </span>
                                            {s.errorRateComparison?.relativeDiffPct !== null && s.errorRateComparison?.relativeDiffPct !== 0 && (
                                                <span
                                                    className={`text-[10px] block mt-0.5 ${
                                                        (s.errorRateComparison?.relativeDiffPct || 0) > 0
                                                            ? "text-red-400"
                                                            : "text-emerald-400"
                                                    }`}
                                                >
                                                    {(s.errorRateComparison?.relativeDiffPct || 0) > 0 ? "+" : ""}
                                                    {s.errorRateComparison?.relativeDiffPct}%
                                                </span>
                                            )}
                                        </td>

                                        {/* Failure Share Bar */}
                                        <td className="py-3 px-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center justify-between text-[11px]">
                                                    <span className="text-white font-medium">
                                                        {s.failureContributionPct}%
                                                    </span>
                                                    <span className="text-[10px] text-muted">
                                                        ({s.errorCount} errs)
                                                    </span>
                                                </div>
                                                <div className="w-24 h-1.5 bg-surface rounded-full overflow-hidden border border-border/60">
                                                    <div
                                                        className="h-full bg-red-400 rounded-full"
                                                        style={{ width: `${Math.min(100, s.failureContributionPct)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>

                                        {/* Latency */}
                                        <td className="py-3 px-3">
                                            <span className="text-white">
                                                {s.avgLatencyMs !== null ? `${s.avgLatencyMs}ms` : "-"}
                                            </span>
                                            {s.p95LatencyMs !== null && (
                                                <span className="text-[10px] text-muted block mt-0.5">
                                                    P95: {s.p95LatencyMs}ms
                                                </span>
                                            )}
                                        </td>

                                        {/* Total Requests */}
                                        <td className="py-3 px-3">
                                            <span className="text-zinc-200">{s.totalCount} reqs</span>
                                        </td>

                                        {/* Trend */}
                                        <td className="py-3 px-3">
                                            <span
                                                className={`inline-flex items-center gap-1 text-[11px] ${
                                                    s.trend === "Improving"
                                                        ? "text-emerald-400"
                                                        : s.trend === "Degrading"
                                                        ? "text-red-400"
                                                        : s.trend === "Volatile"
                                                        ? "text-amber-400"
                                                        : "text-zinc-400"
                                                }`}
                                            >
                                                {s.trend === "Improving" && <TrendingDown size={12} />}
                                                {s.trend === "Degrading" && <TrendingUp size={12} />}
                                                <span>{s.trend}</span>
                                            </span>
                                        </td>

                                        {/* Inspect Action */}
                                        <td className="py-3 px-3 text-right">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedService(s);
                                                }}
                                                className="halo-btn halo-btn-secondary halo-btn-xs text-[10px]"
                                            >
                                                <span>Inspect</span>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Service Deep Inspector Drawer */}
            {selectedService && (
                <ServiceInspectorDrawer
                    service={selectedService}
                    timeRangeKey={timeRangeKey}
                    onClose={() => setSelectedService(null)}
                />
            )}
        </div>
    );
}
