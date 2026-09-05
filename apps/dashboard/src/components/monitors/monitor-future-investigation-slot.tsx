import React from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CheckCircle2, Clock, HelpCircle, ShieldAlert, Sparkles } from "lucide-react";
import { RelativeTime } from "@/components/ui/relative-time";
import { formatDeterministicDateTime } from "@/lib/date-format";
import type { MonitorFullDetails } from "@/actions/monitor";

interface MonitorFutureInvestigationSlotProps {
    data: MonitorFullDetails;
}

export function MonitorFutureInvestigationSlot({ data }: MonitorFutureInvestigationSlotProps) {
    const { monitor, investigations } = data;

    return (
        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] relative overflow-hidden space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-[var(--accent)]" />
                        <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                            Automated Root-Cause Investigations
                        </h3>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] font-sans max-w-2xl leading-relaxed">
                        Correlates real telemetry, traces, and error events within the monitor's trigger time window to synthesize causal chains and evidence graphs.
                    </p>
                </div>

                <Link
                    href={`/projects/${monitor.projectId}/investigations/new?monitorId=${monitor.id}`}
                    className="halo-btn halo-btn-primary halo-btn-sm shrink-0 font-mono"
                >
                    <span>Launch Investigation</span>
                    <ArrowRight size={12} />
                </Link>
            </div>

            {investigations.length === 0 ? (
                <div className="py-6 flex flex-col items-center justify-center text-center border border-dashed border-[var(--border)] rounded-xl space-y-1.5">
                    <HelpCircle size={20} className="text-zinc-500" />
                    <p className="text-xs text-white font-medium">No investigations recorded for this monitor yet</p>
                    <p className="text-[11px] text-[var(--text-muted)] font-mono max-w-sm">
                        When this monitor triggers an alert or when you click "Launch Investigation", automated causal analysis results will be preserved here.
                    </p>
                </div>
            ) : (
                <div className="divide-y divide-[var(--border)]/60 border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)] font-mono text-xs">
                    {investigations.map((inv) => (
                        <div
                            key={inv.id}
                            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--surface-interactive)] transition-colors"
                        >
                            <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                                        {inv.status}
                                    </span>
                                    <span className="text-white font-semibold truncate">
                                        {inv.title}
                                    </span>
                                </div>
                                <p className="text-[11px] text-[var(--text-secondary)] truncate">
                                    {inv.rootCause ? `Probable cause: ${inv.rootCause}` : inv.summary || "Evidence synthesis completed."}
                                </p>
                                <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)] pt-0.5">
                                    <span>{inv.evidenceCount} evidence items</span>
                                    <span>&bull;</span>
                                    <span>
                                        Triggered <RelativeTime date={inv.startedAt} />
                                    </span>
                                </div>
                            </div>

                            <Link
                                href={`/projects/${monitor.projectId}/investigations/new?monitorId=${monitor.id}${inv.alertId ? `&alertId=${inv.alertId}` : ""}`}
                                className="halo-btn halo-btn-secondary halo-btn-xs shrink-0 self-start sm:self-center"
                            >
                                <span>Inspect Findings</span>
                                <ArrowUpRight size={12} />
                            </Link>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

