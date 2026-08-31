"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    ArrowDownRight,
    ArrowRight,
    ArrowUpRight,
    Clock,
    Flame,
    GitCommit,
    Layers,
    Radio,
    Server,
    ShieldAlert,
    Sparkles,
    X,
    Zap,
} from "lucide-react";
import type { ServiceLandscapeItem, ServiceDetailedContext } from "@/lib/analytics/types";
import { getServiceDetailedContextAction } from "@/actions/analytics";
import { formatDeterministicDateTime } from "@/lib/date-format";

interface ServiceInspectorDrawerProps {
    service: ServiceLandscapeItem;
    timeRangeKey?: string;
    onClose: () => void;
}

export function ServiceInspectorDrawer({
    service,
    timeRangeKey = "24h",
    onClose,
}: ServiceInspectorDrawerProps) {
    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState<ServiceDetailedContext | null>(null);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);

        getServiceDetailedContextAction(service.service, service.projectId, timeRangeKey)
            .then((res) => {
                if (isMounted) {
                    setDetail(res);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [service.service, service.projectId, timeRangeKey]);

    const investigateUrl = `/projects/${service.projectId}/investigations/new?service=${service.service}`;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 animate-in fade-in duration-150 font-mono text-xs">
            <div className="relative w-full max-w-xl bg-[var(--surface-elevated)] border-l border-border h-full shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
                <div className="space-y-6">
                    {/* Drawer Header */}
                    <div className="flex items-start justify-between border-b border-border pb-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-accent/15 text-accent border border-accent/30">
                                    <Server size={16} />
                                </span>
                                <h2 className="text-base font-bold text-white tracking-tight">
                                    {service.service}
                                </h2>
                                <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                                        service.health === "Healthy"
                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                            : service.health === "Degraded"
                                            ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                            : service.health === "Critical"
                                            ? "bg-red-500/10 border-red-500/20 text-red-400"
                                            : "bg-zinc-500/10 border-zinc-500/20 text-zinc-400"
                                    }`}
                                >
                                    {service.health}
                                </span>
                            </div>
                            <p className="text-[11px] text-muted font-sans">
                                Project: {service.projectName}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 rounded-lg text-zinc-400 hover:text-white"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Health Explanation Banner */}
                    <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                        <span className="text-[10px] text-muted uppercase block">Health Assessment</span>
                        <p className="text-white font-medium text-xs font-sans">
                            {service.healthReason}
                        </p>
                    </div>

                    {/* Core Metric Cards */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-surface border border-border">
                            <span className="text-[10px] text-muted uppercase block">Error Rate</span>
                            <div className="text-lg font-bold text-white mt-0.5">
                                {service.errorRate}%
                            </div>
                            <span className="text-[10px] text-muted block">
                                {service.errorCount} total errors
                            </span>
                        </div>

                        <div className="p-3 rounded-xl bg-surface border border-border">
                            <span className="text-[10px] text-muted uppercase block">Latency (P95)</span>
                            <div className="text-lg font-bold text-white mt-0.5">
                                {service.p95LatencyMs ? `${service.p95LatencyMs}ms` : "-"}
                            </div>
                            <span className="text-[10px] text-muted block">
                                Avg: {service.avgLatencyMs ? `${service.avgLatencyMs}ms` : "-"}
                            </span>
                        </div>

                        <div className="p-3 rounded-xl bg-surface border border-border">
                            <span className="text-[10px] text-muted uppercase block">Request Volume</span>
                            <div className="text-lg font-bold text-white mt-0.5">
                                {service.totalCount}
                            </div>
                            <span className="text-[10px] text-muted block">
                                {service.failureContributionPct}% failure share
                            </span>
                        </div>
                    </div>

                    {/* Observed Dependencies */}
                    {detail && (
                        <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                            <div className="text-[11px] font-semibold text-white uppercase tracking-wider border-b border-border/60 pb-2">
                                Observed Dependency Connections
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                                <div>
                                    <span className="text-[10px] text-muted uppercase block mb-1">
                                        Upstream Callers
                                    </span>
                                    {detail.observedDependencies.upstream.length === 0 ? (
                                        <span className="text-muted">Direct entrypoint / no callers</span>
                                    ) : (
                                        <div className="space-y-1">
                                            {detail.observedDependencies.upstream.map((u, i) => (
                                                <div
                                                    key={i}
                                                    className="flex items-center justify-between p-1.5 rounded bg-[#080b11] border border-border text-zinc-300"
                                                >
                                                    <div className="flex items-center gap-1.5">
                                                        <ArrowDownRight size={12} className="text-accent" />
                                                        <span>{u.service}</span>
                                                    </div>
                                                    <span className="text-muted text-[10px]">
                                                        {u.callCount} calls
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <span className="text-[10px] text-muted uppercase block mb-1">
                                        Downstream Targets
                                    </span>
                                    {detail.observedDependencies.downstream.length === 0 ? (
                                        <span className="text-muted">No external calls observed</span>
                                    ) : (
                                        <div className="space-y-1">
                                            {detail.observedDependencies.downstream.map((d, i) => (
                                                <div
                                                    key={i}
                                                    className="flex items-center justify-between p-1.5 rounded bg-[#080b11] border border-border text-zinc-300"
                                                >
                                                    <div className="flex items-center gap-1.5">
                                                        <ArrowUpRight size={12} className="text-purple-400" />
                                                        <span>{d.service}</span>
                                                    </div>
                                                    <span className="text-muted text-[10px]">
                                                        {d.avgLatencyMs ? `${d.avgLatencyMs}ms` : "-"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Related Active Issues */}
                    {detail && detail.relatedIssues.length > 0 && (
                        <div className="p-4 rounded-xl bg-surface border border-border space-y-2.5">
                            <div className="text-[11px] font-semibold text-white uppercase tracking-wider border-b border-border/60 pb-2 flex items-center justify-between">
                                <span>Related Active Issues</span>
                                <span className="text-muted font-normal">
                                    ({detail.relatedIssues.length})
                                </span>
                            </div>

                            <div className="space-y-1.5">
                                {detail.relatedIssues.map((iss) => (
                                    <Link
                                        key={iss.id}
                                        href={`/projects/${service.projectId}/issues/${iss.id}`}
                                        className="flex items-center justify-between p-2 rounded-lg bg-[#080b11] border border-border hover:border-border-strong hover:text-white transition-colors group"
                                    >
                                        <div className="space-y-0.5 min-w-0 pr-2">
                                            <div className="font-semibold text-zinc-200 truncate group-hover:text-accent">
                                                {iss.title}
                                            </div>
                                            <span className="text-[10px] text-muted block">
                                                {iss.eventCount} occurrences · Last seen {formatDeterministicDateTime(new Date(iss.lastSeen))}
                                            </span>
                                        </div>
                                        <span className={`halo-severity halo-severity-${iss.severity.toLowerCase()} text-[10px] shrink-0`}>
                                            {iss.severity}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
                    <Link
                        href={`/dashboards/system?projectId=${service.projectId}&service=${service.service}`}
                        className="halo-btn halo-btn-secondary halo-btn-sm"
                    >
                        <span>System Explorer &rarr;</span>
                    </Link>

                    <Link
                        href={investigateUrl}
                        className="halo-btn halo-btn-primary halo-btn-sm"
                    >
                        <Sparkles size={12} />
                        <span>Investigate Service</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
