"use client";

import React from "react";
import { type InvestigationAvailabilityMatrix, type AvailabilityStatus } from "@/lib/investigation/availability-matrix";

interface InvestigationCoverageCardProps {
    availability?: InvestigationAvailabilityMatrix | null;
}

const STATUS_CONFIG: Record<
    AvailabilityStatus,
    { label: string; icon: string; badgeClass: string }
> = {
    AVAILABLE: {
        label: "Observed",
        icon: "✓",
        badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    },
    PARTIAL: {
        label: "Partial",
        icon: "◐",
        badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    },
    UNAVAILABLE: {
        label: "Unavailable",
        icon: "✕",
        badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    },
    NOT_CONFIGURED: {
        label: "Not configured",
        icon: "—",
        badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/30",
    },
    NOT_OBSERVED: {
        label: "No data observed",
        icon: "○",
        badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/30",
    },
    INSUFFICIENT_EVIDENCE: {
        label: "Insufficient evidence",
        icon: "?",
        badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    },
    INSUFFICIENT_DATA: {
        label: "Insufficient data",
        icon: "?",
        badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    },
};

export function InvestigationCoverageCard({ availability }: InvestigationCoverageCardProps) {
    if (!availability) {
        return null;
    }

    const { dimensions, isFullyObserved, missingIntegrations, epistemicNotes } = availability;
    const dimensionList = Object.values(dimensions);

    return (
        <section
            id="section-coverage-availability"
            aria-label="Investigation Evidence Coverage & Availability"
            className="rounded-xl border border-[#1e2638] bg-[#0c1017] p-4 text-xs font-mono shadow-sm transition-colors"
        >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e2638]/60 pb-3">
                <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-blue-500" aria-hidden="true" />
                    <h2 className="text-sm font-semibold tracking-wide text-slate-200">
                        Investigation Coverage & Evidence Availability
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    {isFullyObserved ? (
                        <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                            Fully Observed
                        </span>
                    ) : (
                        <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                            Bounded Coverage
                        </span>
                    )}
                </div>
            </div>

            {/* Coverage Grid */}
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {dimensionList.map((dim) => {
                    const cfg = STATUS_CONFIG[dim.status] || STATUS_CONFIG.UNAVAILABLE;
                    return (
                        <div
                            key={dim.key}
                            className="flex flex-col justify-between rounded-lg border border-[#1e2638]/50 bg-[#080c14] p-2.5 transition-colors hover:border-[#2b354d]"
                        >
                            <span className="text-[11px] font-medium text-slate-300">
                                {dim.displayName}
                            </span>
                            <div className="mt-2 flex items-center justify-between">
                                <span
                                    className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] ${cfg.badgeClass}`}
                                >
                                    <span aria-hidden="true">{cfg.icon}</span>
                                    <span>{cfg.label}</span>
                                </span>
                                {typeof dim.count === "number" && dim.count > 0 && (
                                    <span className="text-[10px] text-slate-400">
                                        n={dim.count}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Epistemic Disclosures / Missing Integrations */}
            {(missingIntegrations.length > 0 || epistemicNotes.length > 0) && (
                <div className="mt-3 space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-[11px] text-amber-300/90">
                    {missingIntegrations.map((item, idx) => (
                        <div key={`int-${idx}`} className="flex items-start gap-1.5">
                            <span className="text-amber-400 font-bold" aria-hidden="true">Notice:</span>
                            <span>{item}</span>
                        </div>
                    ))}
                    {epistemicNotes.map((note, idx) => (
                        <div key={`note-${idx}`} className="flex items-start gap-1.5">
                            <span className="text-amber-400 font-bold" aria-hidden="true">Boundary:</span>
                            <span>{note}</span>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
