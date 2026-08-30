import React from "react";
import Link from "next/link";
import { ArrowRight, Bot, Cpu, Sparkles } from "lucide-react";
import type { MonitorFullDetails } from "@/actions/monitor";

interface MonitorFutureInvestigationSlotProps {
    data: MonitorFullDetails;
}

export function MonitorFutureInvestigationSlot({ data }: MonitorFutureInvestigationSlotProps) {
    const { monitor } = data;

    return (
        <div className="p-6 rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[var(--surface-elevated)] to-[var(--surface)] relative overflow-hidden space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-[var(--accent)]" />
                        <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                            Diagnostic &amp; Investigation Engine
                        </h3>
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] font-sans max-w-xl leading-relaxed">
                        Correlate this monitor's trigger conditions with trace spans, error occurrences, and release deployments in{" "}
                        <span className="text-white font-medium">{monitor.projectName}</span>.
                    </p>
                </div>

                <Link
                    href={`/projects/${monitor.projectId}/investigations/new`}
                    className="halo-btn halo-btn-primary halo-btn-sm shrink-0 font-mono"
                >
                    <Sparkles size={13} />
                    <span>Launch Investigation</span>
                    <ArrowRight size={12} />
                </Link>
            </div>
        </div>
    );
}
