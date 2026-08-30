import React from "react";
import Link from "next/link";
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Clock,
    PlusCircle,
    Radio,
    ShieldAlert,
    ShieldCheck,
} from "lucide-react";
import { RelativeTime } from "@/components/ui/relative-time";
import { formatDeterministicDateTime } from "@/lib/date-format";
import type { MonitorFullDetails } from "@/actions/monitor";

interface MonitorActivityLogProps {
    data: MonitorFullDetails;
}

export function MonitorActivityLog({ data }: MonitorActivityLogProps) {
    const { timelineEvents } = data;

    return (
        <div className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Clock size={14} className="text-[var(--accent)]" />
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                        Lifecycle &amp; Activity Log
                    </h3>
                </div>
                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    {timelineEvents.length} recorded events
                </span>
            </div>

            {timelineEvents.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-[var(--text-muted)]">
                    No activity recorded yet.
                </div>
            ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1px] before:bg-[var(--border)]">
                    {timelineEvents.map((evt) => {
                        const isCreated = evt.type === "CREATED";
                        const isTriggered = evt.type === "ALERT_TRIGGERED";
                        const isAck = evt.type === "ALERT_ACKNOWLEDGED";
                        const isResolved = evt.type === "ALERT_RESOLVED";
                        const isEval = evt.type === "EVALUATED";

                        const Icon = isCreated
                            ? PlusCircle
                            : isTriggered
                            ? AlertTriangle
                            : isAck
                            ? Radio
                            : isResolved
                            ? ShieldCheck
                            : Activity;

                        const dotColor = isCreated
                            ? "bg-sky-400 text-sky-400"
                            : isTriggered
                            ? "bg-red-400 text-red-400"
                            : isAck
                            ? "bg-amber-400 text-amber-400"
                            : isResolved
                            ? "bg-emerald-400 text-emerald-400"
                            : "bg-zinc-400 text-zinc-400";

                        return (
                            <div key={evt.id} className="relative group">
                                {/* Node dot */}
                                <div
                                    className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full ${dotColor} ring-4 ring-[var(--surface-elevated)]`}
                                />

                                <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-white/20 transition-colors text-xs font-mono">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2">
                                            <Icon size={12} className={dotColor} />
                                            <span className="text-white font-semibold">{evt.title}</span>
                                        </div>
                                        <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                                            <RelativeTime date={evt.timestamp} />
                                        </span>
                                    </div>

                                    <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                                        {evt.description}
                                    </p>

                                    <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] mt-2 pt-2 border-t border-[var(--border)]/40">
                                        <span>{formatDeterministicDateTime(evt.timestamp)}</span>
                                        {evt.alertId && (
                                            <Link
                                                href={`/monitors/alerts/${evt.alertId}`}
                                                className="text-[var(--accent)] hover:underline"
                                            >
                                                Inspect Alert &rarr;
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
