import React from "react";
import {
    Activity,
    AlertTriangle,
    Bell,
    CheckCircle2,
    Clock,
    Flame,
    Radio,
    ShieldAlert,
    ShieldCheck,
    Zap,
} from "lucide-react";
import { RelativeTime } from "@/components/ui/relative-time";
import { formatDeterministicDateTime } from "@/lib/date-format";
import type { MonitorFullDetails } from "@/actions/monitor";

interface MonitorHealthSummaryProps {
    data: MonitorFullDetails;
}

export function MonitorHealthSummary({ data }: MonitorHealthSummaryProps) {
    const { monitor, stats } = data;

    const isFiring = monitor.status === "FIRING";
    const isMuted = monitor.status === "MUTED";
    const isDisabled = monitor.status === "DISABLED";
    const isHealthy = monitor.status === "HEALTHY";

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Operational Health State Card */}
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-mono">
                    <span className="uppercase tracking-wider">Health Status</span>
                    {isHealthy && <CheckCircle2 size={13} className="text-emerald-400" />}
                    {isFiring && <Flame size={13} className="text-red-400 animate-pulse" />}
                    {isMuted && <Radio size={13} className="text-amber-400" />}
                    {isDisabled && <Clock size={13} className="text-zinc-500" />}
                </div>

                <div className="flex items-center gap-2">
                    {isHealthy && (
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
                            <span className="text-sm font-semibold text-white">Healthy</span>
                        </div>
                    )}
                    {isFiring && (
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                            <span className="text-sm font-semibold text-red-400">Firing Alert</span>
                        </div>
                    )}
                    {isMuted && (
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                            <span className="text-sm font-semibold text-amber-400">Alerts Muted</span>
                        </div>
                    )}
                    {isDisabled && (
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
                            <span className="text-sm font-semibold text-zinc-400">Disabled</span>
                        </div>
                    )}
                </div>

                <p className="text-[11px] text-[var(--text-muted)] font-mono truncate">
                    {isFiring && stats.openAlerts > 0
                        ? `${stats.openAlerts} active trigger condition`
                        : isHealthy
                        ? "Normal operating parameters"
                        : isMuted
                        ? "Evaluations active, notifications silenced"
                        : "Evaluation scheduled paused"}
                </p>
            </div>

            {/* Last Evaluation Card */}
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-mono">
                    <span className="uppercase tracking-wider">Last Evaluation</span>
                    <Clock size={13} className="text-[var(--text-muted)]" />
                </div>
                <div className="text-sm font-semibold text-white font-mono">
                    {monitor.lastEvaluatedAt ? (
                        <RelativeTime date={monitor.lastEvaluatedAt} />
                    ) : (
                        <span className="text-[var(--text-muted)] font-normal">Pending first run</span>
                    )}
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono truncate">
                    {monitor.lastEvaluatedAt
                        ? formatDeterministicDateTime(monitor.lastEvaluatedAt)
                        : "No evaluations recorded yet"}
                </p>
            </div>

            {/* Last Trigger / Failure Card */}
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-mono">
                    <span className="uppercase tracking-wider">Last Triggered</span>
                    <AlertTriangle size={13} className="text-[var(--text-muted)]" />
                </div>
                <div className="text-sm font-semibold text-white font-mono">
                    {stats.lastTriggeredAt ? (
                        <span className="text-red-400">
                            <RelativeTime date={stats.lastTriggeredAt} />
                        </span>
                    ) : (
                        <span className="text-emerald-400/80 font-normal">No triggers</span>
                    )}
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono truncate">
                    {stats.lastTriggeredAt
                        ? formatDeterministicDateTime(stats.lastTriggeredAt)
                        : "Zero condition violations"}
                </p>
            </div>

            {/* Alert Lifecycle Matrix */}
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-mono">
                    <span className="uppercase tracking-wider">Alert Lifecycle</span>
                    <Bell size={13} className="text-[var(--text-muted)]" />
                </div>
                <div className="flex items-center gap-3 text-xs font-mono">
                    <div className="flex items-center gap-1">
                        <span className="text-red-400 font-semibold">{stats.openAlerts}</span>
                        <span className="text-[var(--text-muted)]">open</span>
                    </div>
                    <span className="text-[var(--border)]">/</span>
                    <div className="flex items-center gap-1">
                        <span className="text-amber-400 font-semibold">{stats.acknowledgedAlerts}</span>
                        <span className="text-[var(--text-muted)]">ack</span>
                    </div>
                    <span className="text-[var(--border)]">/</span>
                    <div className="flex items-center gap-1">
                        <span className="text-emerald-400 font-semibold">{stats.resolvedAlerts}</span>
                        <span className="text-[var(--text-muted)]">res</span>
                    </div>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono truncate">
                    {stats.totalAlerts} total recorded alerts
                </p>
            </div>
        </div>
    );
}
