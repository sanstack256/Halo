"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Activity,
    ArrowLeft,
    BellRing,
    Check,
    Clock,
    Edit3,
    FolderKanban,
    Globe,
    MoreHorizontal,
    Pause,
    Play,
    Radio,
    ShieldAlert,
    Smartphone,
    Sparkles,
    Trash2,
    Volume2,
    VolumeX,
    X,
} from "lucide-react";
import { toggleMonitorStatus, deleteMonitor, type OrgMonitor } from "@/actions/monitor";
import type { MonitorType, MonitorStatus } from "@/generated/prisma/client";

import {
    MONITOR_TYPE_DEFINITIONS,
    getMonitorTypeDefinition,
} from "@/lib/monitors/definitions";

const TYPE_CONFIG: Record<
    MonitorType,
    { label: string; icon: any; colorClass: string; borderClass: string }
> = {
    ERROR: {
        label: MONITOR_TYPE_DEFINITIONS.ERROR.shortLabel,
        icon: MONITOR_TYPE_DEFINITIONS.ERROR.icon,
        colorClass: MONITOR_TYPE_DEFINITIONS.ERROR.colorClass,
        borderClass: MONITOR_TYPE_DEFINITIONS.ERROR.borderClass,
    },
    METRIC: {
        label: MONITOR_TYPE_DEFINITIONS.METRIC.shortLabel,
        icon: MONITOR_TYPE_DEFINITIONS.METRIC.icon,
        colorClass: MONITOR_TYPE_DEFINITIONS.METRIC.colorClass,
        borderClass: MONITOR_TYPE_DEFINITIONS.METRIC.borderClass,
    },
    CRON: {
        label: MONITOR_TYPE_DEFINITIONS.CRON.shortLabel,
        icon: MONITOR_TYPE_DEFINITIONS.CRON.icon,
        colorClass: MONITOR_TYPE_DEFINITIONS.CRON.colorClass,
        borderClass: MONITOR_TYPE_DEFINITIONS.CRON.borderClass,
    },
    UPTIME: {
        label: MONITOR_TYPE_DEFINITIONS.UPTIME.shortLabel,
        icon: MONITOR_TYPE_DEFINITIONS.UPTIME.icon,
        colorClass: MONITOR_TYPE_DEFINITIONS.UPTIME.colorClass,
        borderClass: MONITOR_TYPE_DEFINITIONS.UPTIME.borderClass,
    },
    MOBILE_BUILD: {
        label: MONITOR_TYPE_DEFINITIONS.MOBILE_BUILD.shortLabel,
        icon: MONITOR_TYPE_DEFINITIONS.MOBILE_BUILD.icon,
        colorClass: MONITOR_TYPE_DEFINITIONS.MOBILE_BUILD.colorClass,
        borderClass: MONITOR_TYPE_DEFINITIONS.MOBILE_BUILD.borderClass,
    },
};

interface MonitorDetailHeaderProps {
    monitor: OrgMonitor;
}

export function MonitorDetailHeader({ monitor }: MonitorDetailHeaderProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [currentStatus, setCurrentStatus] = useState<MonitorStatus>(monitor.status);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const typeCfg = TYPE_CONFIG[monitor.type] || TYPE_CONFIG.ERROR;
    const TypeIcon = typeCfg.icon;

    const handleStatusChange = (newStatus: MonitorStatus) => {
        setErrorMessage(null);
        startTransition(async () => {
            try {
                const prev = currentStatus;
                setCurrentStatus(newStatus);
                const success = await toggleMonitorStatus(monitor.id, newStatus);
                if (!success) {
                    setCurrentStatus(prev);
                    setErrorMessage("Failed to update monitor status.");
                } else {
                    router.refresh();
                }
            } catch (err: any) {
                setErrorMessage(err?.message || "Failed to update monitor status.");
            }
        });
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        setErrorMessage(null);
        try {
            const success = await deleteMonitor(monitor.id);
            if (success) {
                router.push("/monitors");
                router.refresh();
            } else {
                setIsDeleting(false);
                setErrorMessage("Failed to delete monitor.");
            }
        } catch (err: any) {
            setIsDeleting(false);
            setErrorMessage(err?.message || "Failed to delete monitor.");
        }
    };

    return (
        <div className="space-y-4">
            {/* Back to monitors breadcrumb */}
            <div className="flex items-center justify-between">
                <Link
                    href="/monitors"
                    className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-white transition-colors font-mono"
                >
                    <ArrowLeft size={13} />
                    <span>Back to Monitor Overview</span>
                </Link>
                <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-muted)]">
                    <span>Project:</span>
                    <Link
                        href={`/projects/${monitor.projectId}`}
                        className="text-white hover:text-[var(--accent)] transition-colors flex items-center gap-1"
                    >
                        <FolderKanban size={12} />
                        <span>{monitor.projectName}</span>
                    </Link>
                </div>
            </div>

            {errorMessage && (
                <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-xs font-mono text-red-400">
                    {errorMessage}
                </div>
            )}

            {/* Main Header Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className={`p-1.5 rounded-lg ${typeCfg.colorClass} border ${typeCfg.borderClass}`}>
                            <TypeIcon size={16} />
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight font-sans">
                            {monitor.name}
                        </h1>

                        {/* Monitor Type Badge */}
                        <span className="px-2.5 py-0.5 rounded-full border border-white/10 bg-white/5 text-xs font-mono text-zinc-300">
                            {typeCfg.label}
                        </span>

                        {/* Severity Badge */}
                        <span className={`halo-severity halo-severity-${monitor.severity.toLowerCase()}`}>
                            {monitor.severity}
                        </span>

                        {/* Status Badge */}
                        <div>
                            {currentStatus === "FIRING" && (
                                <span className="halo-monitor-state-firing text-xs px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
                                    <span className="halo-monitor-pulse animate-ping" /> FIRING
                                </span>
                            )}
                            {currentStatus === "HEALTHY" && (
                                <span className="halo-monitor-state-healthy text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                    <span className="halo-monitor-pulse" /> HEALTHY
                                </span>
                            )}
                            {currentStatus === "MUTED" && (
                                <span className="halo-monitor-state-muted text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                                    <span className="halo-monitor-pulse" /> MUTED
                                </span>
                            )}
                            {currentStatus === "DISABLED" && (
                                <span className="halo-monitor-state-disabled text-xs px-2.5 py-0.5 rounded-full bg-zinc-500/10 border border-zinc-500/20">
                                    <span className="halo-monitor-pulse" /> DISABLED
                                </span>
                            )}
                        </div>
                    </div>

                    {monitor.description && (
                        <p className="text-xs text-[var(--text-secondary)] font-sans max-w-3xl leading-relaxed">
                            {monitor.description}
                        </p>
                    )}
                </div>

                {/* Header Action Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Status Toggle Action */}
                    {currentStatus === "DISABLED" ? (
                        <button
                            type="button"
                            onClick={() => handleStatusChange("HEALTHY")}
                            disabled={isPending}
                            className="halo-btn halo-btn-secondary halo-btn-sm text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                        >
                            <Play size={13} />
                            <span>{isPending ? "Enabling..." : "Enable Monitor"}</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => handleStatusChange("DISABLED")}
                            disabled={isPending}
                            className="halo-btn halo-btn-secondary halo-btn-sm text-zinc-400 hover:text-white disabled:opacity-50"
                        >
                            <Pause size={13} />
                            <span>{isPending ? "Updating..." : "Pause Monitor"}</span>
                        </button>
                    )}

                    {/* Mute / Unmute Toggle */}
                    {currentStatus === "MUTED" ? (
                        <button
                            type="button"
                            onClick={() => handleStatusChange("HEALTHY")}
                            disabled={isPending}
                            className="halo-btn halo-btn-secondary halo-btn-sm text-amber-400 hover:text-amber-300 disabled:opacity-50"
                        >
                            <Volume2 size={13} />
                            <span>Unmute</span>
                        </button>
                    ) : currentStatus !== "DISABLED" && (
                        <button
                            type="button"
                            onClick={() => handleStatusChange("MUTED")}
                            disabled={isPending}
                            className="halo-btn halo-btn-secondary halo-btn-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
                        >
                            <VolumeX size={13} />
                            <span>Mute Alerts</span>
                        </button>
                    )}

                    {/* Edit Monitor */}
                    <Link
                        href={`/monitors/${monitor.id}/edit`}
                        className="halo-btn halo-btn-secondary halo-btn-sm"
                    >
                        <Edit3 size={13} />
                        <span>Edit</span>
                    </Link>

                    {/* Launch Investigation */}
                    <Link
                        href={`/projects/${monitor.projectId}/investigations/new`}
                        className="halo-btn halo-btn-primary halo-btn-sm"
                    >
                        <span>Investigate</span>
                    </Link>

                    {/* Delete Action */}
                    <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/30 transition-colors"
                        title="Delete Monitor"
                        aria-label="Delete Monitor"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                    <div className="w-full max-w-md p-6 rounded-2xl bg-[#0b0f16] border border-[#222b38] space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                                    <Trash2 size={18} />
                                </div>
                                <h3 className="text-sm font-semibold text-white">Delete Monitor</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(false)}
                                className="text-[var(--text-muted)] hover:text-white"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                            Are you sure you want to permanently delete{" "}
                            <span className="text-white font-semibold">"{monitor.name}"</span>? This will remove all associated alert records and evaluation state.
                        </p>
                        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--border)]">
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isDeleting}
                                className="halo-btn halo-btn-secondary halo-btn-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="halo-btn halo-btn-danger halo-btn-sm bg-red-600 hover:bg-red-700 text-white"
                            >
                                {isDeleting ? "Deleting..." : "Delete Permanently"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
