"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Activity,
    Bell,
    BellRing,
    CheckCheck,
    ChevronLeft,
    ChevronRight,
    Clock,
    Filter,
    Globe,
    Radio,
    Search,
    ShieldAlert,
    ShieldCheck,
    Smartphone,
    X,
} from "lucide-react";
import { HaloSelect } from "@/components/ui/halo-select";
import { RelativeTime } from "@/components/ui/relative-time";
import { acknowledgeAlert, resolveAlert, type AlertWithMonitor } from "@/actions/alert";
import type { MonitorAlertStatus, MonitorType } from "@/generated/prisma/client";

const TYPE_CONFIG: Record<MonitorType, { label: string; icon: any; colorClass: string }> = {
    ERROR: { label: "Error Spike", icon: BellRing, colorClass: "text-red-400 bg-red-500/10" },
    METRIC: { label: "Metric Anomaly", icon: Activity, colorClass: "text-amber-400 bg-amber-500/10" },
    CRON: { label: "Cron Job", icon: Clock, colorClass: "text-sky-400 bg-sky-500/10" },
    UPTIME: { label: "Uptime Probe", icon: Globe, colorClass: "text-emerald-400 bg-emerald-500/10" },
    MOBILE_BUILD: { label: "Mobile Release", icon: Smartphone, colorClass: "text-purple-400 bg-purple-500/10" },
};

const STATUS_CONFIG: Record<MonitorAlertStatus, { label: string; dot: string; badge: string }> = {
    OPEN: {
        label: "Open",
        dot: "bg-red-400",
        badge: "text-red-400 bg-red-500/10 border border-red-500/20",
    },
    ACKNOWLEDGED: {
        label: "Acknowledged",
        dot: "bg-amber-400",
        badge: "text-amber-400 bg-amber-500/10 border border-amber-500/20",
    },
    RESOLVED: {
        label: "Resolved",
        dot: "bg-emerald-400",
        badge: "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20",
    },
};

interface ProjectOption { id: string; name: string; }

interface AlertsClientProps {
    initialAlerts: AlertWithMonitor[];
    projects: ProjectOption[];
    totalCount: number;
    initialCounts: { all: number; open: number; acknowledged: number; resolved: number };
    initialProjectFilter?: string;
    initialStatusFilter?: string;
}

export function AlertsClient({
    initialAlerts,
    projects,
    totalCount,
    initialCounts,
    initialProjectFilter,
    initialStatusFilter,
}: AlertsClientProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [alerts, setAlerts] = useState<AlertWithMonitor[]>(initialAlerts);
    const [counts, setCounts] = useState(initialCounts);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedProject, setSelectedProject] = useState(initialProjectFilter || "ALL");
    const [selectedStatus, setSelectedStatus] = useState(initialStatusFilter || "ALL");
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 20;

    const projectOptions = [
        { value: "ALL", label: "All Projects" },
        ...projects.map((p) => ({ value: p.id, label: p.name })),
    ];

    const statusOptions = [
        { value: "ALL", label: "All Status" },
        { value: "OPEN", label: "Open" },
        { value: "ACKNOWLEDGED", label: "Acknowledged" },
        { value: "RESOLVED", label: "Resolved" },
    ];

    const filtered = useMemo(() => {
        return alerts.filter((a) => {
            if (selectedProject !== "ALL" && a.projectId !== selectedProject) return false;
            if (selectedStatus !== "ALL" && a.status !== selectedStatus) return false;
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                if (
                    !a.monitorName.toLowerCase().includes(q) &&
                    !a.conditionSummary.toLowerCase().includes(q) &&
                    !a.projectName.toLowerCase().includes(q)
                ) return false;
            }
            return true;
        });
    }, [alerts, selectedProject, selectedStatus, searchQuery]);

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
    const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const hasActiveFilters = selectedProject !== "ALL" || selectedStatus !== "ALL" || searchQuery.trim();

    function clearFilters() {
        setSearchQuery("");
        setSelectedProject("ALL");
        setSelectedStatus("ALL");
        setCurrentPage(1);
    }

    async function handleAcknowledge(alertId: string, e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();
        startTransition(async () => {
            const result = await acknowledgeAlert(alertId);
            if (result.success) {
                setAlerts((prev) =>
                    prev.map((a) =>
                        a.id === alertId
                            ? { ...a, status: "ACKNOWLEDGED", acknowledgedAt: new Date() }
                            : a
                    )
                );
                setCounts((prev) => ({
                    ...prev,
                    open: Math.max(0, prev.open - 1),
                    acknowledged: prev.acknowledged + 1,
                }));
            }
        });
    }

    async function handleResolve(alertId: string, e: React.MouseEvent) {
        e.stopPropagation();
        e.preventDefault();
        startTransition(async () => {
            const result = await resolveAlert(alertId);
            if (result.success) {
                setAlerts((prev) =>
                    prev.map((a) => {
                        if (a.id !== alertId) return a;
                        const wasAck = a.status === "ACKNOWLEDGED";
                        return { ...a, status: "RESOLVED", resolvedAt: new Date() };
                    })
                );
                setCounts((prev) => {
                    const wasAck = alerts.find((a) => a.id === alertId)?.status === "ACKNOWLEDGED";
                    return {
                        ...prev,
                        open: wasAck ? prev.open : Math.max(0, prev.open - 1),
                        acknowledged: wasAck ? Math.max(0, prev.acknowledged - 1) : prev.acknowledged,
                        resolved: prev.resolved + 1,
                    };
                });
            }
        });
    }

    return (
        <div className="space-y-6">
            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold text-white tracking-tight">Alerts</h1>
                    <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                        Monitor-triggered alert events and their resolution lifecycle.
                    </p>
                </div>
            </div>

            {/* ── Status summary cards ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { key: "all", label: "Total", count: counts.all, color: "text-white" },
                    { key: "OPEN", label: "Open", count: counts.open, color: "text-red-400" },
                    { key: "ACKNOWLEDGED", label: "Acknowledged", count: counts.acknowledged, color: "text-amber-400" },
                    { key: "RESOLVED", label: "Resolved", count: counts.resolved, color: "text-emerald-400" },
                ].map(({ key, label, count, color }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => {
                            setSelectedStatus(key === "all" ? "ALL" : key);
                            setCurrentPage(1);
                        }}
                        className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                            (selectedStatus === key || (key === "all" && selectedStatus === "ALL"))
                                ? "border-[var(--accent)]/40 bg-[var(--accent)]/5"
                                : "border-[var(--border)] bg-[var(--surface-elevated)] hover:border-white/20"
                        }`}
                    >
                        <div className={`text-2xl font-semibold tabular-nums ${color}`}>{count}</div>
                        <div className="text-xs text-[var(--text-muted)] mt-0.5">{label}</div>
                    </button>
                ))}
            </div>

            {/* ── Filter bar ───────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        placeholder="Search alerts…"
                        className="w-full h-8 pl-8 pr-3 text-xs font-mono bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]/50 transition-colors"
                    />
                </div>

                <HaloSelect
                    value={selectedProject}
                    onChange={(v) => { setSelectedProject(v); setCurrentPage(1); }}
                    options={projectOptions}
                    ariaLabel="Filter by project"
                    className="min-w-[140px]"
                />

                <HaloSelect
                    value={selectedStatus}
                    onChange={(v) => { setSelectedStatus(v); setCurrentPage(1); }}
                    options={statusOptions}
                    ariaLabel="Filter by status"
                    className="min-w-[130px]"
                />

                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="flex items-center gap-1.5 h-8 px-3 text-xs font-mono text-[var(--text-muted)] hover:text-white border border-[var(--border)] rounded-lg transition-colors"
                    >
                        <X size={11} />
                        Clear
                    </button>
                )}
            </div>

            {/* ── Table ────────────────────────────────────────────────────── */}
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-12 h-12 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-center mb-4">
                        <ShieldCheck size={22} className="text-[var(--text-muted)]" />
                    </div>
                    <p className="text-sm font-medium text-white">
                        {hasActiveFilters ? "No matching alerts" : "No alerts yet"}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs">
                        {hasActiveFilters
                            ? "Try adjusting your filters."
                            : "Alerts will appear here when monitors trigger conditions."}
                    </p>
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="mt-3 text-xs text-[var(--accent)] hover:underline"
                        >
                            Clear filters
                        </button>
                    )}
                </div>
            ) : (
                <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                    <table className="w-full text-xs font-mono">
                        <thead>
                            <tr className="border-b border-[var(--border)] bg-[var(--surface-elevated)]">
                                <th className="text-left px-4 py-2.5 text-[var(--text-muted)] font-medium">Status</th>
                                <th className="text-left px-4 py-2.5 text-[var(--text-muted)] font-medium">Monitor</th>
                                <th className="text-left px-4 py-2.5 text-[var(--text-muted)] font-medium">Condition</th>
                                <th className="text-left px-4 py-2.5 text-[var(--text-muted)] font-medium">Project</th>
                                <th className="text-left px-4 py-2.5 text-[var(--text-muted)] font-medium">Triggered</th>
                                <th className="text-left px-4 py-2.5 text-[var(--text-muted)] font-medium">Notifications</th>
                                <th className="text-right px-4 py-2.5 text-[var(--text-muted)] font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paged.map((alert, i) => {
                                const statusCfg = STATUS_CONFIG[alert.status];
                                const typeCfg = TYPE_CONFIG[alert.monitorType as MonitorType] ?? TYPE_CONFIG.ERROR;
                                const TypeIcon = typeCfg.icon;
                                return (
                                    <tr
                                        key={alert.id}
                                        className={`border-b border-[var(--border)]/60 hover:bg-[var(--surface-interactive)] transition-colors ${isPending ? "opacity-70" : ""}`}
                                    >
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.badge}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                                                {statusCfg.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`p-1 rounded-md ${typeCfg.colorClass}`}>
                                                    <TypeIcon size={10} />
                                                </span>
                                                <Link
                                                    href={`/monitors/alerts/${alert.id}`}
                                                    className="text-white hover:text-[var(--accent)] transition-colors font-medium truncate max-w-[160px] block"
                                                >
                                                    {alert.monitorName}
                                                </Link>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-[var(--text-secondary)] truncate max-w-[200px] block" title={alert.conditionSummary}>
                                                {alert.conditionSummary}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-[var(--text-muted)]">{alert.projectName}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <RelativeTime date={alert.triggeredAt} />
                                        </td>
                                        <td className="px-4 py-3">
                                            {alert.notificationCount === 0 ? (
                                                <span className="text-[var(--text-muted)]">—</span>
                                            ) : (
                                                <span className={`inline-flex items-center gap-1 ${alert.failedCount > 0 ? "text-red-400" : "text-emerald-400"}`}>
                                                    <Bell size={10} />
                                                    {alert.deliveredCount}/{alert.notificationCount}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {alert.status === "OPEN" && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleAcknowledge(alert.id, e)}
                                                        disabled={isPending}
                                                        title="Acknowledge"
                                                        className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                                                    >
                                                        <Radio size={10} />
                                                        Ack
                                                    </button>
                                                )}
                                                {(alert.status === "OPEN" || alert.status === "ACKNOWLEDGED") && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleResolve(alert.id, e)}
                                                        disabled={isPending}
                                                        title="Resolve"
                                                        className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                                                    >
                                                        <CheckCheck size={10} />
                                                        Resolve
                                                    </button>
                                                )}
                                                <Link
                                                    href={`/monitors/alerts/${alert.id}`}
                                                    className="flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:border-white/30 transition-colors"
                                                >
                                                    Details
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--surface-elevated)]">
                            <span className="text-xs text-[var(--text-muted)]">
                                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-1.5 rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:text-white disabled:opacity-30 transition-colors"
                                >
                                    <ChevronLeft size={13} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-1.5 rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:text-white disabled:opacity-30 transition-colors"
                                >
                                    <ChevronRight size={13} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
