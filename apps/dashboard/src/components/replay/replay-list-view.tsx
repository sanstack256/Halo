"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
    Clock,
    Copy,
    Check,
    Filter,
    MonitorPlay,
    RotateCcw,
    Search,
    TriangleAlert,
    ExternalLink,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    Laptop,
    Smartphone,
    Globe,
} from "lucide-react";
import { RelativeTime } from "@/components/ui/relative-time";
import { HaloSelect } from "@/components/ui/halo-select";
import { formatDeterministicDateTime, formatDeterministicTime } from "@/lib/date-format";
import { getProjectReplaysPaginated, ReplayFilterOptions } from "@/actions/replay";

type ReplaySessionItem = {
    id: string;
    sessionId: string;
    projectId: string;
    environmentId: string;
    browser?: string | null;
    os?: string | null;
    device?: string | null;
    url?: string | null;
    viewportWidth?: number | null;
    viewportHeight?: number | null;
    startedAt: Date | string;
    endedAt?: Date | string | null;
    errorAt?: Date | string | null;
    status: string;
    totalDurationMs?: number | null;
    chunkCount: number;
    issue?: {
        id: string;
        title: string;
        severity: string;
    } | null;
};

type Props = {
    projectId: string;
    initialReplays: ReplaySessionItem[];
    total: number;
    initialPage?: number;
    pageSize?: number;
};

export function ReplayListView({
    projectId,
    initialReplays,
    total: initialTotal,
    initialPage = 1,
    pageSize = 20,
}: Props) {
    const [isPending, startTransition] = useTransition();
    const [replays, setReplays] = useState<ReplaySessionItem[]>(initialReplays);
    const [total, setTotal] = useState(initialTotal);
    const [page, setPage] = useState(initialPage);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [sortBy, setSortBy] = useState<"startedAt" | "duration" | "errorAt">("startedAt");
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleCopy = (e: React.MouseEvent, text: string) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopiedId(text);
        setTimeout(() => setCopiedId(null), 1500);
    };

    const fetchFiltered = (newOptions: Partial<ReplayFilterOptions> = {}) => {
        startTransition(async () => {
            const result = await getProjectReplaysPaginated(projectId, {
                search: newOptions.search !== undefined ? newOptions.search : search,
                status: newOptions.status !== undefined ? newOptions.status : statusFilter,
                sortBy: newOptions.sortBy !== undefined ? newOptions.sortBy : sortBy,
                page: newOptions.page !== undefined ? newOptions.page : 1,
                pageSize,
            });
            setReplays(result.replays as any);
            setTotal(result.total);
            setPage(result.page);
        });
    };

    const handleSearchChange = (val: string) => {
        setSearch(val);
        fetchFiltered({ search: val, page: 1 });
    };

    const handleStatusChange = (val: string) => {
        setStatusFilter(val);
        fetchFiltered({ status: val, page: 1 });
    };

    const handleSortChange = (val: string) => {
        const sort = val as "startedAt" | "duration" | "errorAt";
        setSortBy(sort);
        fetchFiltered({ sortBy: sort, page: 1 });
    };

    const formatDuration = (ms?: number | null) => {
        if (!ms || ms <= 0) return "< 1s";
        const totalSeconds = Math.round(ms / 1000);
        if (totalSeconds < 60) return `${totalSeconds}s`;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}m ${seconds}s`;
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <div className="space-y-6">
            {/* Header & Overview Stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2.5">
                        <MonitorPlay className="h-5 w-5 text-accent" />
                        DOM Session Replays
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                        Time-synchronized browser recordings correlated directly with exceptions, traces, and requests.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-zinc-400 bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg">
                        {total} {total === 1 ? "Session" : "Sessions"} Recorded
                    </span>
                    <Link
                        href={`/projects/${projectId}/sdk`}
                        className="halo-btn halo-btn-secondary halo-btn-sm text-xs gap-1.5"
                    >
                        Replay SDK Setup
                    </Link>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#0d1117] border border-white/10 rounded-xl">
                <div className="flex items-center gap-3 flex-1 min-w-[260px]">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                        <input
                            type="text"
                            placeholder="Search by session ID, issue, or URL..."
                            value={search}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="w-full bg-[#161b22] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-accent/60"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <HaloSelect
                        value={statusFilter}
                        onChange={handleStatusChange}
                        options={[
                            { value: "ALL", label: "All Statuses" },
                            { value: "AVAILABLE", label: "Available" },
                            { value: "RECORDING", label: "Recording" },
                            { value: "PROCESSING", label: "Processing" },
                        ]}
                    />

                    <HaloSelect
                        value={sortBy}
                        onChange={handleSortChange}
                        options={[
                            { value: "startedAt", label: "Newest First" },
                            { value: "duration", label: "Longest Duration" },
                            { value: "errorAt", label: "Error Captured" },
                        ]}
                    />

                    <button
                        onClick={() => fetchFiltered()}
                        disabled={isPending}
                        className="halo-btn halo-btn-secondary halo-btn-sm text-xs p-2"
                        title="Refresh replay list"
                    >
                        <RotateCcw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* Replay Table */}
            {replays.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-white/10 rounded-xl bg-[#080b11] p-8 space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto text-accent">
                        <MonitorPlay className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-white">No session replays found</h3>
                        <p className="text-xs text-zinc-400 max-w-md mx-auto">
                            {search || statusFilter !== "ALL"
                                ? "No replays match your current search and filter criteria."
                                : "Install @halo-trace/replay in your frontend client to capture real DOM sessions and correlate them with runtime exceptions."}
                        </p>
                    </div>
                    <div className="pt-2">
                        <Link
                            href={`/projects/${projectId}/sdk`}
                            className="halo-btn halo-btn-primary halo-btn-sm text-xs"
                        >
                            View Integration Guide
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="border border-white/10 rounded-xl overflow-hidden bg-[#0a0d14]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 bg-[#0d1117] text-zinc-400 font-medium">
                                    <th className="py-3 px-4">Session Identity</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4">Duration</th>
                                    <th className="py-3 px-4">Viewport / OS</th>
                                    <th className="py-3 px-4">Associated Issue / Error</th>
                                    <th className="py-3 px-4">Recorded</th>
                                    <th className="py-3 px-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/[0.06]">
                                {replays.map((replay) => {
                                    const startedDate = new Date(replay.startedAt);
                                    const hasError = Boolean(replay.errorAt || replay.issue);

                                    return (
                                        <tr
                                            key={replay.id}
                                            className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                                        >
                                            {/* Session ID */}
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                    <Link
                                                        href={`/projects/${projectId}/replays/${replay.id}`}
                                                        className="font-mono text-zinc-200 hover:text-accent font-medium truncate max-w-[180px]"
                                                    >
                                                        {replay.sessionId}
                                                    </Link>
                                                    <button
                                                        onClick={(e) => handleCopy(e, replay.sessionId)}
                                                        className="text-zinc-500 hover:text-zinc-300 transition-colors"
                                                        title="Copy Session ID"
                                                    >
                                                        {copiedId === replay.sessionId ? (
                                                            <Check className="h-3 w-3 text-teal-400" />
                                                        ) : (
                                                            <Copy className="h-3 w-3" />
                                                        )}
                                                    </button>
                                                </div>
                                                {replay.url && (
                                                    <div className="text-[11px] text-zinc-500 font-mono truncate max-w-[200px] mt-0.5">
                                                        {replay.url}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Status Badge */}
                                            <td className="py-3 px-4">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                                                        replay.status === "AVAILABLE"
                                                            ? "bg-teal-500/10 border-teal-500/30 text-teal-300"
                                                            : replay.status === "RECORDING"
                                                            ? "bg-blue-500/10 border-blue-500/30 text-blue-300 animate-pulse"
                                                            : "bg-zinc-800 border-zinc-700 text-zinc-400"
                                                    }`}
                                                >
                                                    <span
                                                        className={`w-1.5 h-1.5 rounded-full ${
                                                            replay.status === "AVAILABLE"
                                                                ? "bg-teal-400"
                                                                : replay.status === "RECORDING"
                                                                ? "bg-blue-400"
                                                                : "bg-zinc-500"
                                                        }`}
                                                    />
                                                    {replay.status}
                                                </span>
                                            </td>

                                            {/* Duration */}
                                            <td className="py-3 px-4 font-mono text-zinc-300">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="h-3 w-3 text-zinc-500" />
                                                    {formatDuration(replay.totalDurationMs)}
                                                </div>
                                                <span className="text-[10px] text-zinc-500">
                                                    {replay.chunkCount} {replay.chunkCount === 1 ? "chunk" : "chunks"}
                                                </span>
                                            </td>

                                            {/* Viewport / OS */}
                                            <td className="py-3 px-4 text-zinc-400">
                                                <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-300">
                                                    {replay.viewportWidth && replay.viewportHeight ? (
                                                        <>
                                                            <Laptop className="h-3 w-3 text-zinc-500" />
                                                            {replay.viewportWidth}×{replay.viewportHeight}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Globe className="h-3 w-3 text-zinc-500" />
                                                            Recorded Viewport
                                                        </>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-zinc-500 truncate max-w-[140px] mt-0.5">
                                                    {replay.os || replay.browser || "Standard Browser"}
                                                </div>
                                            </td>

                                            {/* Correlated Issue */}
                                            <td className="py-3 px-4">
                                                {replay.issue ? (
                                                    <Link
                                                        href={`/projects/${projectId}/issues/${replay.issue.id}`}
                                                        className="flex items-center gap-1.5 text-red-300 hover:text-red-200 transition-colors truncate max-w-[220px]"
                                                    >
                                                        <TriangleAlert className="h-3.5 w-3.5 text-red-400 shrink-0" />
                                                        <span className="truncate font-medium">{replay.issue.title}</span>
                                                    </Link>
                                                ) : replay.errorAt ? (
                                                    <span className="inline-flex items-center gap-1 text-red-400 text-[11px]">
                                                        <TriangleAlert className="h-3 w-3 shrink-0" />
                                                        Exception at {formatDeterministicTime(new Date(replay.errorAt))}
                                                    </span>
                                                ) : (
                                                    <span className="text-zinc-500 text-[11px]">Normal Session</span>
                                                )}
                                            </td>

                                            {/* Recorded Timestamp */}
                                            <td className="py-3 px-4 text-zinc-400 font-mono text-[11px]">
                                                <div>
                                                    <RelativeTime date={startedDate} />
                                                </div>
                                                <div className="text-[10px] text-zinc-500">
                                                    {formatDeterministicDateTime(startedDate)}
                                                </div>
                                            </td>

                                            {/* Action Button */}
                                            <td className="py-3 px-4 text-right">
                                                <Link
                                                    href={`/projects/${projectId}/replays/${replay.id}`}
                                                    className="halo-btn halo-btn-secondary halo-btn-sm text-xs gap-1.5 inline-flex"
                                                >
                                                    <MonitorPlay className="h-3.5 w-3.5 text-accent" />
                                                    Play
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-[#0d1117] text-xs text-zinc-400">
                            <span>
                                Page {page} of {totalPages} ({total} total)
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => fetchFiltered({ page: Math.max(1, page - 1) })}
                                    disabled={page <= 1 || isPending}
                                    className="halo-btn halo-btn-secondary halo-btn-sm text-xs p-1.5 disabled:opacity-30"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    onClick={() => fetchFiltered({ page: Math.min(totalPages, page + 1) })}
                                    disabled={page >= totalPages || isPending}
                                    className="halo-btn halo-btn-secondary halo-btn-sm text-xs p-1.5 disabled:opacity-30"
                                >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
