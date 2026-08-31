"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Bell,
    CheckCheck,
    Radio,
    ShieldAlert,
    ShieldCheck,
    Zap,
} from "lucide-react";
import { RelativeTime } from "@/components/ui/relative-time";
import { formatDeterministicDateTime } from "@/lib/date-format";
import { acknowledgeAlert, resolveAlert } from "@/actions/alert";
import type { MonitorFullDetails } from "@/actions/monitor";

interface MonitorTriggerHistoryProps {
    data: MonitorFullDetails;
}

export function MonitorTriggerHistory({ data }: MonitorTriggerHistoryProps) {
    const { monitor, alerts } = data;
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleAcknowledge = (alertId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        startTransition(async () => {
            await acknowledgeAlert(alertId);
            router.refresh();
        });
    };

    const handleResolve = (alertId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        startTransition(async () => {
            await resolveAlert(alertId);
            router.refresh();
        });
    };

    return (
        <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShieldAlert size={14} className="text-red-400" />
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                        Triggered Alert History
                    </h3>
                </div>
                <Link
                    href={`/monitors/alerts?monitor=${monitor.id}`}
                    className="text-xs text-[var(--accent)] hover:underline font-mono"
                >
                    View in Alert Rules &rarr;
                </Link>
            </div>

            {alerts.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center border border-dashed border-[var(--border)] rounded-xl">
                    <ShieldCheck size={24} className="text-emerald-400/60 mb-2" />
                    <p className="text-xs text-white font-medium">No alerts triggered</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5 max-w-sm">
                        This monitor has not detected any violation of its configured threshold parameters.
                    </p>
                </div>
            ) : (
                <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)]">
                    <table className="w-full text-xs font-mono">
                        <thead>
                            <tr className="border-b border-[var(--border)] bg-[var(--surface-elevated)]">
                                <th className="text-left px-4 py-2.5 text-[var(--text-muted)] font-medium">Status</th>
                                <th className="text-left px-4 py-2.5 text-[var(--text-muted)] font-medium">Condition &amp; Target</th>
                                <th className="text-left px-4 py-2.5 text-[var(--text-muted)] font-medium">Triggered</th>
                                <th className="text-left px-4 py-2.5 text-[var(--text-muted)] font-medium">Observed</th>
                                <th className="text-left px-4 py-2.5 text-[var(--text-muted)] font-medium">Notifications</th>
                                <th className="text-right px-4 py-2.5 text-[var(--text-muted)] font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {alerts.map((a) => {
                                const isFiring = a.status === "OPEN";
                                const isAck = a.status === "ACKNOWLEDGED";
                                const isResolved = a.status === "RESOLVED";

                                const statusBadgeClass = isFiring
                                    ? "text-red-400 bg-red-500/10 border-red-500/20"
                                    : isAck
                                    ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                                    : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

                                const dotColor = isFiring
                                    ? "bg-red-400"
                                    : isAck
                                    ? "bg-amber-400"
                                    : "bg-emerald-400";

                                return (
                                    <tr
                                        key={a.id}
                                        className="border-b border-[var(--border)]/60 hover:bg-[var(--surface-interactive)] transition-colors"
                                    >
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClass}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                                                {a.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="space-y-0.5 max-w-xs">
                                                <div className="text-white font-medium truncate" title={a.conditionSummary}>
                                                    {a.conditionSummary}
                                                </div>
                                                {a.notes && (
                                                    <div className="text-[11px] text-[var(--text-muted)] truncate" title={a.notes}>
                                                        Note: {a.notes}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="space-y-0.5">
                                                <span className="text-white block">
                                                    <RelativeTime date={a.triggeredAt} />
                                                </span>
                                                <span className="text-[10px] text-[var(--text-muted)] block">
                                                    {formatDeterministicDateTime(a.triggeredAt)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {a.observedValue !== null ? (
                                                <span className="text-red-400 font-semibold">
                                                    {a.observedValue} {a.thresholdValue !== null ? `/ >=${a.thresholdValue}` : ""}
                                                </span>
                                            ) : (
                                                <span className="text-[var(--text-muted)]">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {a.notificationCount === 0 ? (
                                                <span className="text-[var(--text-muted)]">—</span>
                                            ) : (
                                                <span className={`inline-flex items-center gap-1 ${a.failedCount > 0 ? "text-red-400" : "text-emerald-400"}`}>
                                                    <Bell size={11} />
                                                    {a.deliveredCount}/{a.notificationCount}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {isFiring && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleAcknowledge(a.id, e)}
                                                        disabled={isPending}
                                                        className="px-2 py-1 text-xs rounded-md border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        <Radio size={10} />
                                                        Ack
                                                    </button>
                                                )}
                                                {(isFiring || isAck) && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleResolve(a.id, e)}
                                                        disabled={isPending}
                                                        className="px-2 py-1 text-xs rounded-md border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50 flex items-center gap-1"
                                                    >
                                                        <CheckCheck size={10} />
                                                        Resolve
                                                    </button>
                                                )}
                                                <Link
                                                    href={`/monitors/alerts/${a.id}`}
                                                    className="px-2 py-1 text-xs rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:text-white transition-colors"
                                                >
                                                    Details &rarr;
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
