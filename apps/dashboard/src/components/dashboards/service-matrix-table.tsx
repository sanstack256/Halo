"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Clock,
    Layers,
    Search,
    Server,
} from "lucide-react";
import type { ServiceLandscapeItem, ServiceHealthStatus } from "@/lib/analytics/types";
import { HaloSelect, type HaloSelectOption } from "@/components/ui/halo-select";

const MATRIX_STATUS_OPTIONS: HaloSelectOption[] = [
    { value: "ALL", label: "All States" },
    { value: "Critical", label: "Critical" },
    { value: "Degraded", label: "Degraded" },
    { value: "Healthy", label: "Healthy" },
    { value: "Unknown", label: "Unknown" },
];

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
        Healthy: "halo-badge-healthy",
        Degraded: "halo-badge-degraded",
        Critical: "halo-badge-critical",
        Unknown: "halo-badge-neutral",
    };

    const priorityBadgeClass: Record<string, string> = {
        "Very High": "halo-badge-critical",
        "High": "halo-badge-degraded",
        "Medium": "halo-badge-info",
        "Low": "halo-badge-neutral",
    };

    return (
        <div className="halo-panel">
            {/* Header & Filter Controls */}
            <div className="halo-panel-header">
                <div className="halo-panel-title-group">
                    <Layers size={15} className="text-accent" />
                    <h3 className="halo-panel-title">
                        Cross-Service Matrix &amp; Health Evaluation
                    </h3>
                    <span className="halo-panel-subtitle">({filtered.length} {filtered.length === 1 ? "service" : "services"})</span>
                </div>

                <div className="flex items-center gap-2">
                    {/* Search Input */}
                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-2 text-text-muted" />
                        <input
                            type="text"
                            placeholder="Filter services..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-[#080b11] border border-border rounded-lg pl-8 pr-3 py-1 text-xs text-text focus:outline-none focus:border-border-strong w-44 font-sans"
                        />
                    </div>

                    {/* Status Filter */}
                    <HaloSelect
                        value={statusFilter}
                        onChange={(val) => setStatusFilter(val)}
                        options={MATRIX_STATUS_OPTIONS}
                        ariaLabel="Filter by status"
                    />
                </div>
            </div>

            {/* Matrix Table */}
            {filtered.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center text-center border border-dashed border-border rounded-xl p-4">
                    <Clock size={20} className="text-text-muted mb-2 opacity-50" />
                    <p className="text-xs text-text font-medium">No matching services found</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border text-[11px] font-medium text-text-muted">
                                <th className="pb-2.5 pl-2">Service</th>
                                <th className="pb-2.5">Health State</th>
                                <th className="pb-2.5">Priority</th>
                                <th className="pb-2.5">Failure Share</th>
                                <th className="pb-2.5">Error Rate</th>
                                <th className="pb-2.5">Latency P95</th>
                                <th className="pb-2.5">Requests</th>
                                <th className="pb-2.5 pr-2 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border text-xs">
                            {filtered.map((s) => (
                                <tr
                                    key={s.service}
                                    onClick={() => onSelectService(s)}
                                    className="hover:bg-surface-interactive/60 transition-colors cursor-pointer group"
                                >
                                    {/* Service Name */}
                                    <td className="py-3 pl-2">
                                        <div className="flex items-center gap-2">
                                            <Server size={13} className="text-accent shrink-0" />
                                            <span className="font-semibold text-text group-hover:text-accent transition-colors">
                                                {s.service}
                                            </span>
                                            {s.activeIssuesCount > 0 && (
                                                <span className="halo-badge halo-badge-critical text-[10px] py-0">
                                                    {s.activeIssuesCount} issues
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Health Badge */}
                                    <td className="py-3">
                                        <div className="group/health relative inline-block">
                                            <span
                                                className={`halo-badge ${healthBadgeClass[s.health]}`}
                                            >
                                                {s.health}
                                            </span>
                                            <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/health:block z-20 w-52 p-2 rounded-lg bg-[#04060a] border border-border text-[11px] text-text-secondary shadow-xl pointer-events-none font-sans">
                                                {s.healthReason}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Investigation Priority */}
                                    <td className="py-3">
                                        <div className="group/prio relative inline-block">
                                            <span
                                                className={`halo-badge ${priorityBadgeClass[s.investigationPriority.level] || "halo-badge-neutral"}`}
                                            >
                                                {s.investigationPriority.level}
                                            </span>
                                            {s.investigationPriority.reasons && s.investigationPriority.reasons.length > 0 && (
                                                <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover/prio:block z-20 w-56 p-2 rounded-lg bg-[#04060a] border border-border text-[11px] text-text-secondary shadow-xl pointer-events-none font-sans">
                                                    {s.investigationPriority.reasons.join(", ")}
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    {/* Failure Share */}
                                    <td className="py-3 font-mono text-[11.5px]">
                                        <div className="flex items-center gap-2">
                                            <div className="w-14 h-1.5 bg-[#06080d] rounded-full overflow-hidden border border-border">
                                                <div
                                                    className="h-full bg-error rounded-full"
                                                    style={{ width: `${Math.min(100, s.failureContributionPct)}%` }}
                                                />
                                            </div>
                                            <span className={s.failureContributionPct > 0 ? "text-error font-semibold" : "text-text-muted"}>
                                                {s.failureContributionPct}%
                                            </span>
                                        </div>
                                    </td>

                                    {/* Error Rate */}
                                    <td className="py-3 font-mono text-[11.5px]">
                                        <span className={s.errorRate >= 20 ? "text-error font-semibold" : s.errorRate >= 5 ? "text-warning font-semibold" : "text-text"}>
                                            {s.errorRate}%
                                        </span>
                                    </td>

                                    {/* Latency P95 */}
                                    <td className="py-3 font-mono text-[11.5px] text-text-secondary">
                                        {s.p95LatencyMs !== null ? `${s.p95LatencyMs}ms` : "—"}
                                    </td>

                                    {/* Requests */}
                                    <td className="py-3 font-mono text-[11.5px] text-text-secondary">
                                        {s.requestCount.toLocaleString()}
                                    </td>

                                    {/* Action */}
                                    <td className="py-3 pr-2 text-right">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectService(s);
                                            }}
                                            className="halo-filter-btn text-[11px] h-7 px-2.5"
                                        >
                                            Inspect &rarr;
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
