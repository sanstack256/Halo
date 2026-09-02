"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Server,
    Activity,
    AlertCircle,
    ShieldAlert,
    HelpCircle,
    CheckCircle2,
    Sparkles,
    ExternalLink,
    ArrowUpRight,
    ArrowLeft,
    GitBranch,
    Clock,
    Database,
    Network,
    Layers,
    Code,
    Cpu,
    TrendingUp,
    AlertTriangle,
} from "lucide-react";
import type { CanonicalService, HealthStatus } from "@/lib/services/service-registry";
import { RelativeTime } from "@/components/ui/relative-time";

interface ServiceDetailClientProps {
    service: CanonicalService;
    upstreamDependencies: Array<{ service: string; callCount: number; errorRate: number | null; avgLatencyMs: number | null }>;
    downstreamDependencies: Array<{ service: string; type: string; callCount: number; errorRate: number | null; avgLatencyMs: number | null }>;
    recentReleases: Array<{ id: string; version: string; commitSha: string | null; createdAt: Date }>;
    recentIssues: Array<{ id: string; title: string; severity: string; status: string; eventCount: number; lastSeen: Date }>;
}

export function ServiceDetailClient({
    service,
    upstreamDependencies,
    downstreamDependencies,
    recentReleases,
    recentIssues,
}: ServiceDetailClientProps) {
    const [activeTab, setActiveTab] = useState<"overview" | "dependencies" | "health" | "activity">("overview");

    const getHealthBadge = (health: HealthStatus) => {
        switch (health) {
            case "Healthy":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        Healthy
                    </span>
                );
            case "Degraded":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-mono font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        Degraded
                    </span>
                );
            case "Critical":
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-mono font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        Critical
                    </span>
                );
            case "Unknown":
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs font-mono font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                        Unknown (Insufficient Telemetry)
                    </span>
                );
        }
    };

    const openIssuesCount = recentIssues.filter((i) => i.status === "OPEN").length;

    return (
        <div className="space-y-6 pb-12">
            {/* Back link */}
            <div>
                <Link
                    href="/services"
                    className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors font-mono"
                >
                    <ArrowLeft size={13} />
                    <span>Back to Services Inventory</span>
                </Link>
            </div>

            {/* Service Header */}
            <div className="p-6 rounded-xl bg-surface border border-border space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-bold text-white font-mono tracking-tight">
                                {service.name}
                            </h1>
                            {getHealthBadge(service.health)}
                            {service.currentRelease && (
                                <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-elevated border border-border text-zinc-300">
                                    Release: {service.currentRelease}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-4 text-xs font-mono text-zinc-400 flex-wrap">
                            <span>Project: <strong className="text-zinc-200">{service.projectName}</strong></span>
                            <span>•</span>
                            <span>Environment: <strong className="text-zinc-200">{service.environment}</strong></span>
                            <span>•</span>
                            <span>Owner: <strong className="text-zinc-200">{service.owner}</strong></span>
                            {service.repository && (
                                <>
                                    <span>•</span>
                                    <span className="inline-flex items-center gap-1 text-zinc-300">
                                        <GitBranch size={11} />
                                        <span>{service.repository}</span>
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Action Handoffs */}
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                        {service.health === "Critical" && (
                            <Link
                                href={`/projects/${service.projectId}/investigations/new?service=${encodeURIComponent(
                                    service.name
                                )}`}
                                className="halo-btn halo-btn-primary halo-btn-sm"
                            >
                                <ShieldAlert size={13} />
                                <span>Investigate Critical State</span>
                            </Link>
                        )}
                        {service.health === "Degraded" && (
                            <Link
                                href={`/projects/${service.projectId}/investigations/new?service=${encodeURIComponent(
                                    service.name
                                )}`}
                                className="halo-btn halo-btn-primary halo-btn-sm"
                            >
                                <Sparkles size={13} />
                                <span>Investigate Degradation</span>
                            </Link>
                        )}
                        <Link
                            href={`/issues?service=${encodeURIComponent(service.name)}`}
                            className="halo-btn halo-btn-secondary halo-btn-sm"
                        >
                            <AlertCircle size={13} />
                            <span>View Issues</span>
                        </Link>
                        <Link
                            href={`/explore?service=${encodeURIComponent(service.name)}`}
                            className="halo-btn halo-btn-secondary halo-btn-sm"
                        >
                            <ExternalLink size={13} />
                            <span>Explore Telemetry</span>
                        </Link>
                    </div>
                </div>

                {/* Local Tabs */}
                <div className="flex items-center gap-1 border-t border-border pt-4">
                    <button
                        onClick={() => setActiveTab("overview")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                            activeTab === "overview"
                                ? "bg-accent text-accent-foreground font-semibold shadow-sm"
                                : "text-zinc-400 hover:text-white"
                        }`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab("dependencies")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                            activeTab === "dependencies"
                                ? "bg-accent text-accent-foreground font-semibold shadow-sm"
                                : "text-zinc-400 hover:text-white"
                        }`}
                    >
                        Dependencies ({upstreamDependencies.length + downstreamDependencies.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("health")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                            activeTab === "health"
                                ? "bg-accent text-accent-foreground font-semibold shadow-sm"
                                : "text-zinc-400 hover:text-white"
                        }`}
                    >
                        Health & Telemetry
                    </button>
                    <button
                        onClick={() => setActiveTab("activity")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                            activeTab === "activity"
                                ? "bg-accent text-accent-foreground font-semibold shadow-sm"
                                : "text-zinc-400 hover:text-white"
                        }`}
                    >
                        Activity & Releases
                    </button>
                </div>
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === "overview" && (
                <div className="space-y-6">
                    {/* Key Health Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="p-4 rounded-xl bg-surface border border-border space-y-1">
                            <span className="text-[10px] text-zinc-500 uppercase font-mono block">Request Volume</span>
                            <span className="text-2xl font-bold text-white font-mono block">
                                {service.metrics.requestCount > 0
                                    ? service.metrics.requestCount.toLocaleString()
                                    : "No data"}
                            </span>
                            <span className="text-[11px] text-zinc-400 font-mono">Trend: {service.trend}</span>
                        </div>

                        <div className="p-4 rounded-xl bg-surface border border-border space-y-1">
                            <span className="text-[10px] text-zinc-500 uppercase font-mono block">Error Rate</span>
                            <span
                                className={`text-2xl font-bold font-mono block ${
                                    service.metrics.errorRate !== null && service.metrics.errorRate >= 20
                                        ? "text-red-400"
                                        : service.metrics.errorRate !== null && service.metrics.errorRate >= 5
                                        ? "text-amber-400"
                                        : "text-zinc-200"
                                }`}
                            >
                                {service.metrics.errorRate !== null ? `${service.metrics.errorRate.toFixed(1)}%` : "—"}
                            </span>
                            <span className="text-[11px] text-zinc-400 font-mono">
                                {service.metrics.errorCount} total errors
                            </span>
                        </div>

                        <div className="p-4 rounded-xl bg-surface border border-border space-y-1">
                            <span className="text-[10px] text-zinc-500 uppercase font-mono block">p95 Latency</span>
                            <span className="text-2xl font-bold text-white font-mono block">
                                {service.metrics.p95LatencyMs !== null ? `${service.metrics.p95LatencyMs}ms` : "—"}
                            </span>
                            <span className="text-[11px] text-zinc-400 font-mono">
                                Avg: {service.metrics.avgLatencyMs ? `${service.metrics.avgLatencyMs}ms` : "—"}
                            </span>
                        </div>

                        <div className="p-4 rounded-xl bg-surface border border-border space-y-1">
                            <span className="text-[10px] text-zinc-500 uppercase font-mono block">Dependencies</span>
                            <span className="text-2xl font-bold text-white font-mono block">
                                {upstreamDependencies.length + downstreamDependencies.length}
                            </span>
                            <span className="text-[11px] text-zinc-400 font-mono">
                                {upstreamDependencies.length} callers • {downstreamDependencies.length} targets
                            </span>
                        </div>
                    </div>

                    {/* Evidence-Backed Health Rationale */}
                    <div className="p-4 rounded-xl bg-[#080c12] border border-border space-y-2">
                        <span className="text-[10px] uppercase font-mono text-zinc-400 font-bold block">
                            Operational Health Assessment
                        </span>
                        <p className="text-xs font-mono text-zinc-300 leading-relaxed">
                            {service.healthReason}
                        </p>
                    </div>

                    {/* Service Issues & Releases Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Issues associated with service */}
                        <div className="p-5 rounded-xl bg-surface border border-border space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle size={15} className="text-accent" />
                                        <h3 className="text-sm font-bold text-white font-mono">Issues History</h3>
                                    </div>
                                    <span className="text-[10px] text-zinc-500 block font-mono">
                                        {openIssuesCount} active open • {recentIssues.length} total records
                                    </span>
                                </div>
                                <Link
                                    href={`/issues?service=${encodeURIComponent(service.name)}`}
                                    className="text-xs text-accent hover:underline font-mono inline-flex items-center gap-1"
                                >
                                    <span>View all in Issues</span>
                                    <ArrowUpRight size={11} />
                                </Link>
                            </div>

                            {recentIssues.length === 0 ? (
                                <div className="p-4 rounded-lg bg-surface-elevated text-xs font-mono text-zinc-500 text-center">
                                    No issue records recorded for this service.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {recentIssues.map((issue) => (
                                        <Link
                                            key={issue.id}
                                            href={`/issues/${issue.id}`}
                                            className="p-3 rounded-lg bg-surface-elevated border border-border hover:border-accent/40 block transition-all group"
                                        >
                                            <div className="flex items-center justify-between text-xs font-mono">
                                                <span className="text-white font-semibold group-hover:text-accent truncate">
                                                    {issue.title}
                                                </span>
                                                <span
                                                    className={`px-1.5 py-0.2 rounded text-[10px] ${
                                                        issue.status === "OPEN"
                                                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                                            : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                                                    }`}
                                                >
                                                    {issue.status}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-zinc-500 font-mono mt-1">
                                                {issue.eventCount} occurrences • Last seen <RelativeTime date={issue.lastSeen} />
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Recent Releases */}
                        <div className="p-5 rounded-xl bg-surface border border-border space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <GitBranch size={15} className="text-purple-400" />
                                    <h3 className="text-sm font-bold text-white font-mono">Project Release History</h3>
                                </div>
                                <Link
                                    href="/dashboards/changes"
                                    className="text-xs text-purple-400 hover:underline font-mono inline-flex items-center gap-1"
                                >
                                    <span>Change Intelligence</span>
                                    <ArrowUpRight size={11} />
                                </Link>
                            </div>

                            {recentReleases.length === 0 ? (
                                <div className="p-4 rounded-lg bg-surface-elevated text-xs font-mono text-zinc-500 text-center">
                                    No formal release records recorded for this project.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {recentReleases.map((rel) => (
                                        <div
                                            key={rel.id}
                                            className="p-3 rounded-lg bg-surface-elevated border border-border text-xs font-mono flex items-center justify-between"
                                        >
                                            <div className="space-y-0.5">
                                                <span className="text-white font-bold block">{rel.version}</span>
                                                {rel.commitSha && (
                                                    <span className="text-[10px] text-zinc-500">
                                                        Commit: {rel.commitSha.slice(0, 7)}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[11px] text-zinc-400">
                                                <RelativeTime date={rel.createdAt} />
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: DEPENDENCIES */}
            {activeTab === "dependencies" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Upstream Callers */}
                    <div className="p-5 rounded-xl bg-surface border border-border space-y-4">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <h3 className="text-sm font-bold text-white font-mono">
                                Called By / Upstream ({upstreamDependencies.length})
                            </h3>
                            <span className="text-[10px] font-mono text-zinc-500">Callers</span>
                        </div>

                        {upstreamDependencies.length === 0 ? (
                            <div className="p-6 rounded-lg bg-surface-elevated text-xs font-mono text-zinc-500 text-center">
                                No upstream callers detected in trace telemetry.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {upstreamDependencies.map((dep) => (
                                    <div
                                        key={dep.service}
                                        className="p-3 rounded-lg bg-surface-elevated border border-border flex items-center justify-between text-xs font-mono"
                                    >
                                        <div className="space-y-0.5">
                                            <Link
                                                href={`/services/${encodeURIComponent(dep.service)}`}
                                                className="text-white font-bold hover:text-accent block"
                                            >
                                                {dep.service}
                                            </Link>
                                            <span className="text-[11px] text-zinc-500">
                                                {dep.callCount} calls recorded
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            {dep.errorRate !== null ? (
                                                <span className={dep.errorRate >= 5 ? "text-amber-400" : "text-zinc-300"}>
                                                    {dep.errorRate.toFixed(1)}% err
                                                </span>
                                            ) : (
                                                <span className="text-zinc-600">—</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Downstream Targets */}
                    <div className="p-5 rounded-xl bg-surface border border-border space-y-4">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <h3 className="text-sm font-bold text-white font-mono">
                                Depends On / Downstream ({downstreamDependencies.length})
                            </h3>
                            <span className="text-[10px] font-mono text-zinc-500">Targets</span>
                        </div>

                        {downstreamDependencies.length === 0 ? (
                            <div className="p-6 rounded-lg bg-surface-elevated text-xs font-mono text-zinc-500 text-center">
                                No downstream dependencies observed in telemetry.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {downstreamDependencies.map((dep) => (
                                    <div
                                        key={dep.service}
                                        className="p-3 rounded-lg bg-surface-elevated border border-border flex items-center justify-between text-xs font-mono"
                                    >
                                        <div className="space-y-0.5">
                                            <span className="text-white font-bold block">{dep.service}</span>
                                            <span className="text-[11px] text-zinc-500 uppercase">{dep.type}</span>
                                        </div>
                                        <div className="text-right">
                                            {dep.errorRate !== null ? (
                                                <span className={dep.errorRate >= 5 ? "text-amber-400" : "text-zinc-300"}>
                                                    {dep.errorRate.toFixed(1)}% err
                                                </span>
                                            ) : (
                                                <span className="text-zinc-600">—</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 3: HEALTH & TELEMETRY */}
            {activeTab === "health" && (
                <div className="p-6 rounded-xl bg-surface border border-border space-y-4">
                    <h3 className="text-sm font-bold text-white font-mono">Detailed Telemetry Assessment</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                        <div className="p-3 rounded-lg bg-surface-elevated border border-border">
                            <span className="text-[10px] text-zinc-500 uppercase block">Total Telemetry</span>
                            <span className="text-base font-bold text-white mt-1 block">
                                {service.metrics.requestCount > 0
                                    ? `${service.metrics.requestCount.toLocaleString()} events`
                                    : "No data"}
                            </span>
                        </div>
                        <div className="p-3 rounded-lg bg-surface-elevated border border-border">
                            <span className="text-[10px] text-zinc-500 uppercase block">Fatal Exceptions</span>
                            <span className="text-base font-bold text-red-400 mt-1 block">
                                {service.metrics.fatalCount}
                            </span>
                        </div>
                        <div className="p-3 rounded-lg bg-surface-elevated border border-border">
                            <span className="text-[10px] text-zinc-500 uppercase block">First Discovered</span>
                            <span className="text-base font-bold text-zinc-300 mt-1 block">
                                {service.firstSeen ? <RelativeTime date={service.firstSeen} /> : "N/A"}
                            </span>
                        </div>
                        <div className="p-3 rounded-lg bg-surface-elevated border border-border">
                            <span className="text-[10px] text-zinc-500 uppercase block">Last Activity</span>
                            <span className="text-base font-bold text-zinc-300 mt-1 block">
                                {service.lastSeen ? <RelativeTime date={service.lastSeen} /> : "N/A"}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 4: ACTIVITY */}
            {activeTab === "activity" && (
                <div className="p-6 rounded-xl bg-surface border border-border space-y-4">
                    <h3 className="text-sm font-bold text-white font-mono">Operational Activity Stream</h3>
                    <div className="space-y-3">
                        {service.healthTransition && (
                            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs font-mono flex items-center justify-between">
                                <span className="text-amber-400">
                                    Health transition: {service.healthTransition.previousHealth} → {service.healthTransition.currentHealth}
                                </span>
                                <span className="text-zinc-500">
                                    <RelativeTime date={service.healthTransition.changedAt} />
                                </span>
                            </div>
                        )}
                        {recentReleases.map((rel) => (
                            <div
                                key={rel.id}
                                className="p-3 rounded-lg bg-surface-elevated border border-border text-xs font-mono flex items-center justify-between"
                            >
                                <span className="text-zinc-300">Deployment release: {rel.version}</span>
                                <span className="text-zinc-500">
                                    <RelativeTime date={rel.createdAt} />
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
