"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Activity,
    ArrowUpRight,
    BellRing,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    Edit3,
    Filter,
    FolderKanban,
    Globe,
    MoreHorizontal,
    Plus,
    Radio,
    RotateCcw,
    Search,
    ShieldAlert,
    Smartphone,
    Trash2,
    User,
    Volume2,
    VolumeX,
    X,
} from "lucide-react";
import { RelativeTime } from "@/components/ui/relative-time";
import { HaloSelect } from "@/components/ui/halo-select";
import { CreateMonitorDialog } from "@/components/monitors/create-monitor-dialog";
import { toggleMonitorStatus, deleteMonitor, type OrgMonitor } from "@/actions/monitor";
import type { MonitorType, MonitorStatus } from "@/generated/prisma/client";

interface ProjectOption {
    id: string;
    name: string;
}

interface MonitorsClientProps {
    title?: string;
    description?: string;
    isMineView?: boolean;
    initialMonitors: OrgMonitor[];
    projects: ProjectOption[];
    totalCount: number;
    initialCounts: {
        all: number;
        firing: number;
        healthy: number;
        muted: number;
        disabled: number;
    };
    initialTypeFilter?: string;
    initialStatusFilter?: string;
    initialProjectFilter?: string;
    initialMineFilter?: boolean;
    currentUserId?: string;
}

const TYPE_CONFIG: Record<
    MonitorType,
    { label: string; icon: any; colorClass: string; borderClass: string }
> = {
    ERROR: {
        label: "Error Spike",
        icon: BellRing,
        colorClass: "text-red-400 bg-red-500/10",
        borderClass: "border-red-500/20",
    },
    METRIC: {
        label: "Metric Anomaly",
        icon: Activity,
        colorClass: "text-amber-400 bg-amber-500/10",
        borderClass: "border-amber-500/20",
    },
    CRON: {
        label: "Cron Job",
        icon: Clock,
        colorClass: "text-sky-400 bg-sky-500/10",
        borderClass: "border-sky-500/20",
    },
    UPTIME: {
        label: "Uptime Probe",
        icon: Globe,
        colorClass: "text-emerald-400 bg-emerald-500/10",
        borderClass: "border-emerald-500/20",
    },
    MOBILE_BUILD: {
        label: "Mobile Release",
        icon: Smartphone,
        colorClass: "text-purple-400 bg-purple-500/10",
        borderClass: "border-purple-500/20",
    },
};

const TYPE_DETAILS: Record<MonitorType, { title: string; desc: string; emptyDesc: string }> = {
    ERROR: {
        title: "Error Spike Monitors",
        desc: "Real-time monitors evaluating error frequency bursts and fatal exceptions.",
        emptyDesc: "No error spike monitors configured yet. Set up threshold alerts to track exception surges in production.",
    },
    METRIC: {
        title: "Metric & Latency Monitors",
        desc: "Evaluates API response durations, span latencies, and service degradation.",
        emptyDesc: "No metric monitors configured yet. Set up alerts for P95 latency and request rate anomalies.",
    },
    CRON: {
        title: "Cron & Scheduled Task Monitors",
        desc: "Monitors background workers and scheduled tasks to ensure on-time execution.",
        emptyDesc: "No scheduled cron monitors configured yet. Set up heartbeat monitoring for your periodic jobs.",
    },
    UPTIME: {
        title: "Endpoint Uptime Probes",
        desc: "Continuous HTTP/HTTPS synthetic availability and status code validation.",
        emptyDesc: "No uptime probes configured yet. Set up continuous synthetic checks against your endpoints.",
    },
    MOBILE_BUILD: {
        title: "Mobile Build & Stability Monitors",
        desc: "Tracks mobile release stability and crash-free session ratios.",
        emptyDesc: "No mobile release monitors configured yet. Set up monitors for mobile crash-free stability.",
    },
};

export function MonitorsClient({
    title,
    description,
    isMineView = false,
    initialMonitors,
    projects,
    totalCount,
    initialCounts,
    initialTypeFilter,
    initialStatusFilter,
    initialProjectFilter,
    initialMineFilter,
    currentUserId,
}: MonitorsClientProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [monitors, setMonitors] = useState<OrgMonitor[]>(initialMonitors);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedProject, setSelectedProject] = useState(initialProjectFilter || "ALL");
    const [selectedType, setSelectedType] = useState(initialTypeFilter || "ALL");
    const [selectedStatus, setSelectedStatus] = useState(initialStatusFilter || "ALL");
    const [sortBy, setSortBy] = useState<"lastEvaluatedAt" | "name" | "type" | "status">("lastEvaluatedAt");
    const [onlyMine, setOnlyMine] = useState(Boolean(initialMineFilter || isMineView));

    // Dynamic header resolution
    const activeTypeDetail = selectedType !== "ALL" ? TYPE_DETAILS[selectedType as MonitorType] : undefined;
    const resolvedTitle = title || activeTypeDetail?.title || "Monitors";
    const resolvedDescription = description || activeTypeDetail?.desc || "Continuous anomaly detection, threshold alerts, and synthetic endpoint monitors.";

    // Client-side pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 15;

    // Synchronize client state when props change (e.g. navigation via sidebar)
    React.useEffect(() => {
        setMonitors(initialMonitors);
        setSelectedProject(initialProjectFilter || "ALL");
        setSelectedType(initialTypeFilter || "ALL");
        setSelectedStatus(initialStatusFilter || "ALL");
        setOnlyMine(Boolean(initialMineFilter || isMineView));
        setCurrentPage(1);
    }, [initialMonitors, initialProjectFilter, initialTypeFilter, initialStatusFilter, initialMineFilter, isMineView]);

    // Filter and sort monitors
    const filteredMonitors = useMemo(() => {
        return monitors
            .filter((m) => {
                if (selectedProject !== "ALL" && m.projectId !== selectedProject) return false;
                if (selectedType !== "ALL" && m.type !== selectedType) return false;
                if (selectedStatus !== "ALL" && m.status !== selectedStatus) return false;
                if (onlyMine && currentUserId && m.creatorId !== currentUserId) return false;

                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase().trim();
                    const matchName = m.name.toLowerCase().includes(q);
                    const matchDesc = m.description?.toLowerCase().includes(q);
                    const matchQuery = m.query?.toLowerCase().includes(q);
                    const matchUrl = m.endpointUrl?.toLowerCase().includes(q);
                    const matchProject = m.projectName.toLowerCase().includes(q);
                    if (!matchName && !matchDesc && !matchQuery && !matchUrl && !matchProject) return false;
                }

                return true;
            })
            .sort((a, b) => {
                if (sortBy === "name") {
                    return a.name.localeCompare(b.name);
                }
                if (sortBy === "type") {
                    return a.type.localeCompare(b.type);
                }
                if (sortBy === "status") {
                    return a.status.localeCompare(b.status);
                }
                // default lastEvaluatedAt / updatedAt
                const timeA = new Date(a.lastEvaluatedAt || a.updatedAt).getTime();
                const timeB = new Date(b.lastEvaluatedAt || b.updatedAt).getTime();
                return timeB - timeA;
            });
    }, [monitors, selectedProject, selectedType, selectedStatus, onlyMine, currentUserId, searchQuery, sortBy]);

    // Paginated subset
    const totalPages = Math.ceil(filteredMonitors.length / PAGE_SIZE) || 1;
    const paginatedMonitors = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredMonitors.slice(start, start + PAGE_SIZE);
    }, [filteredMonitors, currentPage]);

    const hasActiveFilters =
        selectedProject !== "ALL" ||
        selectedType !== "ALL" ||
        selectedStatus !== "ALL" ||
        (!isMineView && onlyMine) ||
        searchQuery.trim().length > 0;

    const clearFilters = () => {
        setSelectedProject("ALL");
        setSelectedType("ALL");
        setSelectedStatus("ALL");
        if (!isMineView) setOnlyMine(false);
        setSearchQuery("");
        setCurrentPage(1);
    };

    const handleToggleMute = async (e: React.MouseEvent, m: OrgMonitor) => {
        e.stopPropagation();
        const nextStatus = m.status === "MUTED" ? "HEALTHY" : "MUTED";
        setMonitors((prev) =>
            prev.map((item) => (item.id === m.id ? { ...item, status: nextStatus } : item))
        );

        try {
            await toggleMonitorStatus(m.id, nextStatus);
            startTransition(() => {
                router.refresh();
            });
        } catch (err) {
            // Revert on error
            setMonitors((prev) =>
                prev.map((item) => (item.id === m.id ? { ...item, status: m.status } : item))
            );
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this monitor?")) return;

        setMonitors((prev) => prev.filter((item) => item.id !== id));
        try {
            await deleteMonitor(id);
            startTransition(() => {
                router.refresh();
            });
        } catch (err) {
            router.refresh();
        }
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="halo-page-header mb-0">
                    <div className="flex items-center gap-3">
                        <h1 className="halo-page-title mb-0">{resolvedTitle}</h1>
                        <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono font-medium text-zinc-300">
                            {filteredMonitors.length} {filteredMonitors.length === 1 ? "monitor" : "monitors"}
                        </span>
                    </div>
                    <p className="halo-page-description mt-1">
                        {resolvedDescription}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <CreateMonitorDialog
                        projects={projects}
                        initialType={selectedType !== "ALL" ? (selectedType as MonitorType) : (initialTypeFilter as MonitorType | undefined)}
                    />
                </div>
            </div>

            {/* Toolbar Filter Controls */}
            <div className="p-3.5 rounded-2xl bg-surface border border-border flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[200px] max-w-sm">
                        <Search
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
                        />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search monitors by name, target, URL..."
                            className="w-full h-8 pl-8 pr-7 rounded-lg border border-border bg-[#080b11] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent font-mono"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Project Selector */}
                    {projects.length > 1 && (
                        <HaloSelect
                            value={selectedProject}
                            onChange={(val) => {
                                setSelectedProject(val);
                                setCurrentPage(1);
                            }}
                            options={[
                                { value: "ALL", label: "All Projects" },
                                ...projects.map((p) => ({ value: p.id, label: p.name })),
                            ]}
                        />
                    )}

                    {/* Monitor Type */}
                    <HaloSelect
                        value={selectedType}
                        onChange={(val) => {
                            setSelectedType(val);
                            setCurrentPage(1);
                        }}
                        options={[
                            { value: "ALL", label: "All Types" },
                            { value: "ERROR", label: "Error Spikes" },
                            { value: "METRIC", label: "Metric Anomalies" },
                            { value: "CRON", label: "Cron Jobs" },
                            { value: "UPTIME", label: "Uptime Probes" },
                            { value: "MOBILE_BUILD", label: "Mobile Builds" },
                        ]}
                    />

                    {/* Status Filter */}
                    <HaloSelect
                        value={selectedStatus}
                        onChange={(val) => {
                            setSelectedStatus(val);
                            setCurrentPage(1);
                        }}
                        options={[
                            { value: "ALL", label: "All Statuses" },
                            { value: "HEALTHY", label: "Healthy" },
                            { value: "FIRING", label: "Firing" },
                            { value: "MUTED", label: "Muted" },
                            { value: "DISABLED", label: "Disabled" },
                        ]}
                    />

                    {/* Sort */}
                    <HaloSelect
                        value={sortBy}
                        onChange={(val) => setSortBy(val as any)}
                        options={[
                            { value: "lastEvaluatedAt", label: "Sort: Last Evaluated" },
                            { value: "name", label: "Sort: Name" },
                            { value: "type", label: "Sort: Type" },
                            { value: "status", label: "Sort: Status" },
                        ]}
                    />

                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="halo-btn halo-btn-xs halo-btn-secondary"
                        >
                            <RotateCcw size={12} />
                            <span>Reset</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Monitor Table / Inventory */}
            {filteredMonitors.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-surface border border-border space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 mx-auto">
                        <BellRing size={24} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
                            {hasActiveFilters
                                ? "No matching monitors found"
                                : isMineView
                                ? "No monitors created by you yet"
                                : activeTypeDetail
                                ? `No ${activeTypeDetail.title.toLowerCase()} configured yet`
                                : "No monitors configured yet"}
                        </h3>
                        <p className="text-xs text-zinc-400 font-sans max-w-md mx-auto mt-1">
                            {hasActiveFilters
                                ? "No monitors match your current search and filter combination. Try adjusting or clearing filters."
                                : isMineView
                                ? "Monitors created by your account will appear here for dedicated ownership, quick edits, and alert management."
                                : activeTypeDetail
                                ? activeTypeDetail.emptyDesc
                                : "Monitors continuously track error surges, latency thresholds, scheduled cron jobs, and endpoint uptime."}
                        </p>
                    </div>
                    <div>
                        {hasActiveFilters ? (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="halo-btn halo-btn-secondary halo-btn-sm"
                            >
                                <RotateCcw size={13} />
                                <span>Clear Filters</span>
                            </button>
                        ) : (
                            <CreateMonitorDialog
                                projects={projects}
                                initialType={selectedType !== "ALL" ? (selectedType as MonitorType) : (initialTypeFilter as MonitorType | undefined)}
                                trigger={
                                    <button type="button" className="halo-btn halo-btn-primary halo-btn-sm">
                                        <Plus size={14} />
                                        <span>Create First Monitor</span>
                                    </button>
                                }
                            />
                        )}
                    </div>
                </div>
            ) : (
                <div className="halo-table">
                    {/* Header */}
                    <div className="halo-table-header grid-cols-[1fr_150px_120px_110px_130px_120px_130px]">
                        <div className="halo-table-col-label">Monitor Target</div>
                        <div className="halo-table-col-label">Type</div>
                        <div className="halo-table-col-label">Project</div>
                        <div className="halo-table-col-label">Status</div>
                        <div className="halo-table-col-label">Criteria</div>
                        <div className="halo-table-col-label">Last Evaluated</div>
                        <div className="halo-table-col-label text-right">Actions</div>
                    </div>

                    {/* Rows */}
                    {paginatedMonitors.map((m) => {
                        const typeInfo = TYPE_CONFIG[m.type] || TYPE_CONFIG.ERROR;
                        const TypeIcon = typeInfo.icon;
                        const isOwner = Boolean(currentUserId && m.creatorId === currentUserId);

                        return (
                            <div
                                key={m.id}
                                onClick={() => router.push(`/monitors/${m.id}`)}
                                className="halo-table-row grid-cols-[1fr_150px_120px_110px_130px_120px_130px] cursor-pointer hover:bg-white/[0.03] transition-colors"
                            >
                                {/* Name and Description / Owner */}
                                <div className="min-w-0 pr-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-white text-xs truncate">
                                            {m.name}
                                        </span>
                                        {isOwner && (
                                            <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-accent/10 border border-accent/20 text-accent">
                                                Owner
                                            </span>
                                        )}
                                    </div>
                                    {m.description ? (
                                        <p className="text-[11px] text-zinc-400 font-sans truncate mt-0.5">
                                            {m.description}
                                        </p>
                                    ) : (
                                        <p className="text-[11px] text-zinc-500 font-mono truncate mt-0.5">
                                            {m.query || m.endpointUrl || m.cronSchedule || "Standard anomaly detector"}
                                        </p>
                                    )}
                                </div>

                                {/* Type Pill */}
                                <div>
                                    <span
                                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-mono font-medium ${typeInfo.colorClass} ${typeInfo.borderClass}`}
                                    >
                                        <TypeIcon size={12} className="shrink-0" />
                                        <span>{typeInfo.label}</span>
                                    </span>
                                </div>

                                {/* Project */}
                                <div>
                                    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-300 font-mono truncate">
                                        <FolderKanban size={12} className="text-zinc-500 shrink-0" />
                                        <span className="truncate">{m.projectName}</span>
                                    </span>
                                </div>

                                {/* Health / Status */}
                                <div>
                                    {m.status === "FIRING" && (
                                        <span className="halo-monitor-state-firing">
                                            <span className="halo-monitor-pulse animate-ping" /> Firing
                                        </span>
                                    )}
                                    {m.status === "HEALTHY" && (
                                        <span className="halo-monitor-state-healthy">
                                            <span className="halo-monitor-pulse" /> Healthy
                                        </span>
                                    )}
                                    {m.status === "MUTED" && (
                                        <span className="halo-monitor-state-muted">
                                            <span className="halo-monitor-pulse" /> Muted
                                        </span>
                                    )}
                                    {m.status === "DISABLED" && (
                                        <span className="halo-monitor-state-disabled">
                                            <span className="halo-monitor-pulse" /> Disabled
                                        </span>
                                    )}
                                </div>

                                {/* Threshold Criteria */}
                                <div className="text-xs font-mono text-zinc-400 truncate">
                                    {m.type === "ERROR" && (
                                        <span>
                                            {m.thresholdValue !== null
                                                ? `>= ${m.thresholdValue} in ${m.thresholdWindow !== null ? `${m.thresholdWindow}m` : "window"}`
                                                : m.query || "Error surge"}
                                        </span>
                                    )}
                                    {m.type === "METRIC" && (
                                        <span>
                                            {m.thresholdValue !== null
                                                ? `> ${m.thresholdValue}ms${m.thresholdWindow !== null ? ` in ${m.thresholdWindow}m` : ""}`
                                                : "Metric anomaly"}
                                        </span>
                                    )}
                                    {m.type === "CRON" && (
                                        <span className="text-sky-400">
                                            {m.cronSchedule || "Scheduled heartbeat"}
                                        </span>
                                    )}
                                    {m.type === "UPTIME" && (
                                        <span className="text-emerald-400 truncate">
                                            {m.endpointUrl ? "HTTP 200 Probe" : "Endpoint Probe"}
                                        </span>
                                    )}
                                    {m.type === "MOBILE_BUILD" && (
                                        <span>
                                            {m.thresholdValue !== null
                                                ? `>= ${m.thresholdValue}% crash-free`
                                                : "Stability tracking"}
                                        </span>
                                    )}
                                </div>

                                {/* Last Evaluated */}
                                <div className="text-xs font-mono text-zinc-400">
                                    <RelativeTime date={m.lastEvaluatedAt || m.updatedAt} />
                                </div>

                                {/* Row Actions */}
                                <div className="flex items-center justify-end gap-1.5">
                                    <Link
                                        href={`/monitors/${m.id}/edit`}
                                        onClick={(e) => e.stopPropagation()}
                                        title="Edit Monitor"
                                        aria-label={`Edit ${m.name}`}
                                        className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
                                    >
                                        <Edit3 size={13} />
                                    </Link>

                                    <button
                                        type="button"
                                        title={m.status === "MUTED" ? "Unmute Monitor" : "Mute Monitor"}
                                        aria-label={m.status === "MUTED" ? `Unmute ${m.name}` : `Mute ${m.name}`}
                                        onClick={(e) => handleToggleMute(e, m)}
                                        className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
                                    >
                                        {m.status === "MUTED" ? <Volume2 size={13} /> : <VolumeX size={13} />}
                                    </button>

                                    <button
                                        type="button"
                                        title="Delete Monitor"
                                        aria-label={`Delete ${m.name}`}
                                        onClick={(e) => handleDelete(e, m.id)}
                                        className="p-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/15 transition-colors"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border pt-4 text-xs font-mono text-zinc-400">
                    <div>
                        Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                        {Math.min(currentPage * PAGE_SIZE, filteredMonitors.length)} of{" "}
                        {filteredMonitors.length} monitors
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="halo-btn halo-btn-xs halo-btn-secondary disabled:opacity-40"
                        >
                            <ChevronLeft size={13} />
                            <span>Previous</span>
                        </button>

                        <span className="px-2 font-bold text-white">
                            {currentPage} / {totalPages}
                        </span>

                        <button
                            type="button"
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="halo-btn halo-btn-xs halo-btn-secondary disabled:opacity-40"
                        >
                            <span>Next</span>
                            <ChevronRight size={13} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
