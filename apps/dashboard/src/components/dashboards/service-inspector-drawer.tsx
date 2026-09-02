"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    ArrowDownRight,
    ArrowRight,
    CheckCircle2,
    Clock,
    Database,
    GitCommit,
    Layers,
    Radio,
    Server,
    ShieldAlert,
    Sparkles,
    X,
} from "lucide-react";
import type { ServiceDetailedContext, ServiceLandscapeItem } from "@/lib/analytics/types";
import { getServiceDetailedContextAction } from "@/actions/analytics";

interface ServiceInspectorDrawerProps {
    service: ServiceLandscapeItem | null;
    projectId?: string;
    timeRangeKey?: string;
    onClose: () => void;
}

export function ServiceInspectorDrawer({
    service,
    projectId,
    timeRangeKey,
    onClose,
}: ServiceInspectorDrawerProps) {
    const [loading, setLoading] = useState(false);
    const [context, setContext] = useState<ServiceDetailedContext | null>(null);

    useEffect(() => {
        if (!service) {
            setContext(null);
            return;
        }

        let isMounted = true;
        setLoading(true);

        getServiceDetailedContextAction(service.service, service.projectId, timeRangeKey)
            .then((res) => {
                if (isMounted) {
                    setContext(res);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [service, timeRangeKey]);

    if (!service) return null;

    const investigateUrl = `/projects/${service.projectId}/investigations/new?service=${service.service}`;

    return (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/80 flex justify-end font-mono text-xs animate-in fade-in duration-150">
            <div className="w-full max-w-xl bg-[#0b0f16] border-l border-[#222b38] h-full overflow-y-auto p-6 space-y-6 flex flex-col justify-between">
                <div className="space-y-6">
                    {/* Drawer Header */}
                    <div className="flex items-center justify-between border-b border-border pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                                <Server size={18} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-bold text-white tracking-wide font-sans">
                                        {service.service}
                                    </h2>
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                            service.health === "Healthy"
                                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                : service.health === "Degraded"
                                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                                : "bg-red-500/10 text-red-400 border-red-500/20"
                                        }`}
                                    >
                                        {service.health}
                                    </span>
                                </div>
                                <p className="text-[11px] text-muted font-sans">
                                    Project: {service.projectName}
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 text-muted hover:text-white rounded-lg hover:bg-surface"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Primary Action Button */}
                    <div className="p-4 rounded-xl bg-surface border border-accent/30 flex items-center justify-between gap-3">
                        <div>
                            <span className="font-semibold text-white block">Launch Deep Investigation</span>
                            <span className="text-[11px] text-muted font-sans">
                                Automatically pre-populates traces, active issues, and recent releases.
                            </span>
                        </div>
                        <Link
                            href={investigateUrl}
                            className="halo-btn halo-btn-primary halo-btn-sm shrink-0"
                        >
                            <Sparkles size={12} />
                            <span>Analyze Service</span>
                        </Link>
                    </div>

                    {/* Operational Summary Grid */}
                    <div className="grid grid-cols-3 gap-3 text-[11px]">
                        <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                            <span className="text-[10px] text-muted uppercase block">Error Rate</span>
                            <span className={`text-base font-bold ${service.errorRate > 0 ? "text-red-400" : "text-white"}`}>
                                {service.errorRate}%
                            </span>
                        </div>
                        <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                            <span className="text-[10px] text-muted uppercase block">Failure Share</span>
                            <span className="text-base font-bold text-white">
                                {service.failureContributionPct}%
                            </span>
                        </div>
                        <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                            <span className="text-[10px] text-muted uppercase block">P95 Latency</span>
                            <span className="text-base font-bold text-amber-400">
                                {service.p95LatencyMs ? `${service.p95LatencyMs}ms` : "-"}
                            </span>
                        </div>
                    </div>

                    {/* Deterministic Health Rationale */}
                    <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                        <span className="text-[10px] text-muted uppercase font-semibold block">
                            Health Status Rationale
                        </span>
                        <p className="text-[11px] text-zinc-300 font-sans">{service.healthReason}</p>
                    </div>

                    {loading ? (
                        <div className="h-32 flex items-center justify-center text-muted">
                            Loading service context...
                        </div>
                    ) : context ? (
                        <div className="space-y-6">
                            {/* Upstream & Downstream Observed Dependencies */}
                            <div className="space-y-3">
                                <div className="text-[11px] font-semibold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-1.5">
                                    <Layers size={13} className="text-accent" />
                                    <span>Observed Trace Dependencies</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {/* Upstream */}
                                    <div className="p-3 rounded-xl bg-surface border border-border space-y-2">
                                        <span className="text-[10px] text-muted uppercase block">
                                            Upstream Callers ({context.observedDependencies.upstream.length})
                                        </span>
                                        {context.observedDependencies.upstream.length === 0 ? (
                                            <p className="text-muted text-[10px] font-sans">No incoming trace spans.</p>
                                        ) : (
                                            <div className="space-y-1">
                                                {context.observedDependencies.upstream.map((u, i) => (
                                                    <div key={i} className="flex items-center justify-between text-[11px]">
                                                        <span className="text-white font-medium">{u.service}</span>
                                                        <span className="text-muted">{u.callCount} calls</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Downstream */}
                                    <div className="p-3 rounded-xl bg-surface border border-border space-y-2">
                                        <span className="text-[10px] text-muted uppercase block">
                                            Downstream Targets ({context.observedDependencies.downstream.length})
                                        </span>
                                        {context.observedDependencies.downstream.length === 0 ? (
                                            <p className="text-muted text-[10px] font-sans">No downstream calls recorded.</p>
                                        ) : (
                                            <div className="space-y-1">
                                                {context.observedDependencies.downstream.map((d, i) => (
                                                    <div key={i} className="flex items-center justify-between text-[11px]">
                                                        <span className="text-white font-medium">{d.service}</span>
                                                        <span className="text-muted">
                                                            {d.callCount} calls {d.errorRate > 0 && `(${d.errorRate}% err)`}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Active Correlated Issues */}
                            <div className="space-y-3">
                                <div className="text-[11px] font-semibold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-1.5">
                                    <ShieldAlert size={13} className="text-red-400" />
                                    <span>Correlated Active Issues ({context.activeIssues.length})</span>
                                </div>

                                {context.activeIssues.length === 0 ? (
                                    <p className="text-muted text-[11px] font-sans">No active open issues for this service.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {context.activeIssues.map((iss) => (
                                            <Link
                                                key={iss.id}
                                                href={`/projects/${service.projectId}/issues/${iss.id}`}
                                                className="p-2.5 rounded-lg bg-surface border border-border flex items-center justify-between hover:border-accent/40 transition-colors"
                                            >
                                                <div className="space-y-0.5">
                                                    <span className="text-white font-medium block">{iss.title}</span>
                                                    <span className="text-muted text-[10px]">{iss.eventCount} occurrences</span>
                                                </div>
                                                <span className="text-red-400 text-[10px] uppercase font-semibold">
                                                    {iss.severity}
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Recurring Failure Patterns */}
                            {context.recurringFailures.length > 0 && (
                                <div className="space-y-3">
                                    <div className="text-[11px] font-semibold text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-1.5">
                                        <Activity size={13} className="text-amber-400" />
                                        <span>Recurring Failure Fingerprints</span>
                                    </div>

                                    <div className="space-y-2">
                                        {context.recurringFailures.slice(0, 3).map((f, i) => (
                                            <div
                                                key={i}
                                                className="p-2.5 rounded-lg bg-[#080b11] border border-border flex items-center justify-between"
                                            >
                                                <div className="space-y-0.5 max-w-sm">
                                                    <span className="text-zinc-200 font-medium block truncate">{f.title}</span>
                                                    <span className="text-muted text-[9.5px]">FP: {f.fingerprint}</span>
                                                </div>
                                                <span className="text-amber-400 font-bold text-[11px]">
                                                    {f.count}x
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>

                <div className="pt-4 border-t border-border flex items-center justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="halo-btn halo-btn-secondary halo-btn-sm"
                    >
                        Close Inspector
                    </button>
                </div>
            </div>
        </div>
    );
}
