"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Network,
    Activity,
    Info,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import type { ImpactProjection, ImpactLayer } from "@/lib/issues/issue-intelligence";

interface ImpactViewProps {
    data: ImpactProjection;
}

export function ImpactView({ data }: ImpactViewProps) {
    const { impacts, summary, timeRange } = data;
    const [expandedIssueId, setExpandedIssueId] = useState<string | null>(null);

    const getStatusBadge = (status: ImpactLayer["evidenceStatus"]) => {
        switch (status) {
            case "OBSERVED":
                return (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                        OBSERVED
                    </span>
                );
            case "SUPPORTED":
                return (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                        SUPPORTED
                    </span>
                );
            case "INFERRED":
                return (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold">
                        INFERRED
                    </span>
                );
            case "UNKNOWN":
            default:
                return (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 font-semibold">
                        UNKNOWN
                    </span>
                );
        }
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Impact</h1>
                <p className="text-sm text-secondary mt-1">
                    What does this failure actually affect? Reconstructs observable blast radius layer-by-layer across requests, trace-linked services, operations, and linked sessions.
                </p>
            </div>

            {/* Invariant Note */}
            <div className="p-3.5 rounded-xl bg-[#070a0f] border border-border text-xs font-mono text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Info size={14} className="text-accent shrink-0" />
                    <span>
                        <strong>Evidence Invariant:</strong> Uncollected telemetry is reported as <code className="text-zinc-200">UNKNOWN</code> with an explicit limitation reason. It is never misrepresented as zero. Linked sessions indicate failure event linkage, not assumed business impact.
                    </span>
                </div>
                <span className="text-accent text-[10px] uppercase font-semibold shrink-0">
                    Truthful Boundaries
                </span>
            </div>

            {/* Global Summary Bar (Calibrated KPI Strip) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block">Evaluated Issues</span>
                    <span className="text-2xl font-bold text-white block">{summary.totalEvaluatedIssues}</span>
                    <span className="text-[11px] text-zinc-400">Window: {timeRange.key}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block">Correlated Requests</span>
                    <span className="text-2xl font-bold text-accent block">
                        {summary.totalObservedRequests !== null ? summary.totalObservedRequests.toLocaleString() : "UNKNOWN"}
                    </span>
                    <span className="text-[11px] text-zinc-500 truncate block">
                        {summary.totalObservedRequests !== null ? "Captured request IDs" : "Request context not captured"}
                    </span>
                </div>
                <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block">OBSERVED SERVICES</span>
                    <span className="text-2xl font-bold text-purple-400 block">{summary.totalObservedServices}</span>
                    <span className="text-[11px] text-zinc-400 truncate block">Distinct services in telemetry</span>
                </div>
                <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block">Linked Sessions</span>
                    <span className={`text-2xl font-bold block ${summary.totalObservedSessions !== null ? "text-white" : "text-zinc-400"}`}>
                        {summary.totalObservedSessions !== null ? summary.totalObservedSessions.toLocaleString() : "UNKNOWN"}
                    </span>
                    <span className="text-[11px] text-zinc-500 truncate block" title={summary.sessionLinkageDetail}>
                        {summary.sessionLinkageDetail}
                    </span>
                </div>
            </div>

            {impacts.length === 0 ? (
                <div className="p-10 rounded-xl bg-surface border border-border text-center space-y-2">
                    <Network className="w-8 h-8 text-zinc-500 mx-auto" />
                    <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">No Active Impact Telemetry</h2>
                    <p className="text-xs text-secondary max-w-md mx-auto font-mono">
                        No failure occurrences were observed in the active time window ({timeRange.key}) to calculate impact propagation.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {impacts.map((imp) => {
                        const isExpanded = expandedIssueId === imp.issueId;
                        const svcLayer = imp.layers.find((l) => l.layer === "SERVICES");
                        const opLayer = imp.layers.find((l) => l.layer === "OPERATIONS");
                        const sessLayer = imp.layers.find((l) => l.layer === "SESSIONS");

                        return (
                            <div
                                key={imp.issueId}
                                className="p-4 rounded-xl bg-surface border border-border space-y-3 transition-all duration-150"
                            >
                                {/* Default Compact Summary Row (Section 11) */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="space-y-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h2 className="text-sm font-bold text-white font-mono truncate">{imp.title}</h2>
                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-elevated text-zinc-300 border border-border">
                                                {imp.environment}
                                            </span>
                                        </div>
                                        <div className="text-xs font-mono text-zinc-400 flex items-center gap-2 flex-wrap">
                                            <span>
                                                <strong className="text-white">{imp.layers[0]?.count || 0}</strong> occurrences
                                            </span>
                                            <span>•</span>
                                            <span>
                                                {svcLayer?.count !== null ? (
                                                    <span><strong className="text-white">{svcLayer?.count}</strong> trace-linked service(s)</span>
                                                ) : (
                                                    <span className="text-zinc-500">Trace services: UNKNOWN</span>
                                                )}
                                            </span>
                                            <span>•</span>
                                            <span>
                                                {sessLayer?.count !== null ? (
                                                    <span><strong className="text-white">{sessLayer?.count}</strong> sessions with linked failure events</span>
                                                ) : (
                                                    <span className="text-zinc-500">Linked sessions: UNKNOWN</span>
                                                )}
                                            </span>
                                            <span>•</span>
                                            <span>
                                                {opLayer?.count !== null ? (
                                                    <span><strong className="text-white">{opLayer?.count}</strong> downstream operations</span>
                                                ) : (
                                                    <span className="text-zinc-500">Downstream: UNKNOWN</span>
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => setExpandedIssueId(isExpanded ? null : imp.issueId)}
                                            className="halo-btn halo-btn-secondary halo-btn-xs text-[11px] font-mono"
                                            aria-expanded={isExpanded}
                                        >
                                            <span>{isExpanded ? "Hide Impact Cone" : "Inspect Impact Cone"}</span>
                                            {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                        </button>
                                        <Link
                                            href={`/explore/requests?search=${encodeURIComponent(imp.service)}`}
                                            className="halo-btn halo-btn-ghost halo-btn-xs text-zinc-400 hover:text-white"
                                            title={`Explore ${imp.service} telemetry`}
                                            aria-label={`Explore ${imp.service} telemetry`}
                                        >
                                            <Activity size={13} />
                                            <span>Explore</span>
                                        </Link>
                                    </div>
                                </div>

                                {/* Progressive Disclosure: Full Impact Cone rendered ONLY when expanded */}
                                {isExpanded && (
                                    <div className="space-y-3 pt-3 border-t border-border/80 animate-in fade-in-50 duration-200">
                                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-accent block">
                                            Observable Surface Layers (Impact Cone)
                                        </span>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 text-xs font-mono">
                                            {imp.layers.map((layer, idx) => {
                                                const isUnknown = layer.evidenceStatus === "UNKNOWN";

                                                return (
                                                    <div
                                                        key={layer.layer}
                                                        className={`p-3 rounded-lg border flex flex-col justify-between space-y-1.5 ${
                                                            isUnknown
                                                                ? "bg-[#06080d] border-zinc-800/80"
                                                                : "bg-surface-elevated border-border"
                                                        }`}
                                                    >
                                                        <div className="space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[9px] uppercase font-bold text-zinc-500">
                                                                    Layer {idx + 1}
                                                                </span>
                                                                {getStatusBadge(layer.evidenceStatus)}
                                                            </div>
                                                            <span className="text-white font-semibold block text-[11px] truncate">
                                                                {layer.label}
                                                            </span>
                                                        </div>

                                                        <div className="pt-1.5 border-t border-border/50 space-y-0.5">
                                                            <span
                                                                className={`text-base font-bold font-mono block ${
                                                                    isUnknown ? "text-zinc-500" : "text-white"
                                                                }`}
                                                            >
                                                                {layer.count !== null ? layer.count.toLocaleString() : "UNKNOWN"}
                                                            </span>
                                                            <span className="text-[10px] text-zinc-400 block leading-tight">
                                                                {layer.evidenceDetail}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Details for layers with items */}
                                        {imp.layers.some((l) => l.items && l.items.length > 0) && (
                                            <div className="p-2.5 rounded-lg bg-[#06080d] border border-border/80 space-y-1.5 text-xs font-mono">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                                                    Observed Layer Elements
                                                </span>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {imp.layers.filter((l) => l.items && l.items.length > 0).map((layer) => (
                                                        <div key={layer.layer} className="p-2 rounded bg-surface border border-border space-y-1">
                                                            <span className="text-[10px] uppercase font-bold text-accent block">
                                                                {layer.label} ({layer.items?.length})
                                                            </span>
                                                            <div className="flex items-center gap-1 flex-wrap">
                                                                {layer.items?.map((item, i) => (
                                                                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-zinc-300 font-mono">
                                                                        {item}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
