"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Cpu,
    Search,
    ChevronRight,
    ArrowUpRight,
    CheckCircle2,
    AlertTriangle,
    HelpCircle,
    Server,
    Waypoints,
    FileWarning,
    Info,
} from "lucide-react";
import type { RuntimeFingerprintResult, DiscoveredRuntimeAttribute } from "@/lib/explore/runtime-fingerprint";
import type { CanonicalEvidenceRecord } from "@/lib/explore/evidence-types";
import { ExploreHeader } from "./explore-header";
import { ExploreEmptyState } from "./empty-state";
import { RelativeTime } from "@/components/ui/relative-time";

interface RuntimeFingerprintClientProps {
    fingerprint: RuntimeFingerprintResult | null;
    recentErrors: CanonicalEvidenceRecord[];
    currentEventId?: string;
}

export function RuntimeFingerprintClient({
    fingerprint,
    recentErrors,
    currentEventId,
}: RuntimeFingerprintClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [eventIdInput, setEventIdInput] = useState(currentEventId || "");

    const handleApplyEvent = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        if (eventIdInput.trim()) {
            params.set("eventId", eventIdInput.trim());
        }
        router.push(`/explore/infrastructure?${params.toString()}`);
    };

    const handleSelectError = (id: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("eventId", id);
        router.push(`/explore/infrastructure?${params.toString()}`);
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <ExploreHeader
                title="Infrastructure"
                subtitle="Identify runtime/environment differences associated with a failure."
                icon={Cpu}
                badgeText={fingerprint ? `Failure Event: ${fingerprint.failureEvent.id.slice(0, 8)}` : undefined}
            />

            {/* Event Selector Toolbar */}
            <div className="p-3.5 rounded-xl bg-surface border border-border space-y-3">
                <form onSubmit={handleApplyEvent} className="flex items-center gap-2.5 text-xs">
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                            type="text"
                            value={eventIdInput}
                            onChange={(e) => setEventIdInput(e.target.value)}
                            placeholder="Target failure Event ID..."
                            className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-[#080b11] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent font-mono"
                        />
                    </div>
                    <button type="submit" className="halo-btn halo-btn-primary halo-btn-sm font-sans shrink-0">
                        Generate Fingerprint
                    </button>
                </form>

                {recentErrors.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono pt-1 border-t border-border/60">
                        <span className="text-muted">RECENT FAILURES:</span>
                        {recentErrors.slice(0, 5).map((err) => {
                            const isActive = err.id === fingerprint?.failureEvent.id;
                            return (
                                <button
                                    key={err.id}
                                    type="button"
                                    onClick={() => handleSelectError(err.id)}
                                    className={`px-2 py-0.5 rounded border transition-colors truncate max-w-xs ${
                                        isActive
                                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold"
                                            : "bg-[#06080e] border-border text-zinc-400 hover:text-white hover:border-zinc-500"
                                    }`}
                                >
                                    {err.service || "service"} ({err.id.slice(0, 8)})
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Fingerprint Content */}
            {!fingerprint ? (
                <ExploreEmptyState
                    type="NO_DATA"
                    title="No failure event selected"
                    description="Select a failure occurrence to construct its runtime fingerprint and compare against reference execution telemetry."
                />
            ) : !fingerprint.hasComparableReference ? (
                <ExploreEmptyState
                    type="MISSING_TELEMETRY"
                    title="NO COMPARABLE REFERENCE"
                    description="No successful reference execution matching service and deployment was observed in telemetry. A baseline execution is required to establish environmental divergence."
                />
            ) : (
                <div className="space-y-5">
                    {/* Summary KPI Cards */}
                    <div className="halo-metric-strip grid-cols-2 sm:grid-cols-4">
                        <div className="halo-metric-cell space-y-1">
                            <span className="text-[10px] text-muted uppercase font-semibold font-mono">
                                Total Attributes
                            </span>
                            <span className="text-xl font-bold text-white block font-sans">
                                {fingerprint.attributes.length}
                            </span>
                        </div>
                        <div className="halo-metric-cell space-y-1">
                            <span className="text-[10px] text-muted uppercase font-semibold font-mono">
                                Matching (Common)
                            </span>
                            <span className="text-xl font-bold text-emerald-400 block font-sans">
                                {fingerprint.matchingCount}
                            </span>
                        </div>
                        <div className="halo-metric-cell space-y-1">
                            <span className="text-[10px] text-muted uppercase font-semibold font-mono">
                                Investigation Leads (Different)
                            </span>
                            <span className="text-xl font-bold text-amber-400 block font-sans">
                                {fingerprint.differenceCount}
                            </span>
                        </div>
                        <div className="halo-metric-cell space-y-1">
                            <span className="text-[10px] text-muted uppercase font-semibold font-mono">
                                Unobserved (Unknown)
                            </span>
                            <span className="text-xl font-bold text-zinc-500 block font-sans">
                                {fingerprint.unknownCount}
                            </span>
                        </div>
                    </div>

                    {/* Explanatory Banner */}
                    <div className="p-4 rounded-xl bg-surface border border-border space-y-1.5">
                        <span className="text-[10px] font-mono uppercase font-bold text-accent block">
                            ENVIRONMENTAL DIVERGENCE ANALYSIS
                        </span>
                        <p className="text-xs text-zinc-200 font-sans leading-relaxed">
                            {fingerprint.differenceCount > 0
                                ? `Detected ${fingerprint.differenceCount} attribute difference(s) between failure execution (${fingerprint.failureEvent.id.slice(0, 8)}) and reference (${fingerprint.referenceEvent?.id.slice(0, 8)}). Each difference represents an investigation lead rather than an asserted root cause.`
                                : "No environmental differences observed between failure execution and reference execution across captured runtime metadata."}
                        </p>
                    </div>

                    {/* Fingerprint Comparison Matrix */}
                    <div className="rounded-xl bg-surface border border-border overflow-hidden">
                        <div className="p-3 bg-[#06080e] border-b border-border grid grid-cols-12 gap-3 text-[11px] font-mono font-semibold uppercase text-muted">
                            <div className="col-span-3">Attribute</div>
                            <div className="col-span-3">Failure Execution</div>
                            <div className="col-span-3">Reference Execution</div>
                            <div className="col-span-3 text-right">Observation Status</div>
                        </div>

                        <div className="divide-y divide-border/40 font-mono text-xs">
                            {fingerprint.attributes.map((attr) => {
                                const isDiff = attr.status === "DIFFERENT";
                                const isCommon = attr.status === "MATCHING";
                                const isUnknown = attr.status === "UNKNOWN" || attr.status === "NOT CAPTURED";

                                return (
                                    <div
                                        key={attr.key}
                                        className={`p-3 grid grid-cols-12 gap-3 items-center transition-colors ${
                                            isDiff ? "bg-amber-500/10" : "hover:bg-surface-elevated"
                                        }`}
                                    >
                                        <div className="col-span-3 min-w-0">
                                            <div className="text-white font-semibold truncate font-sans text-xs">
                                                {attr.label}
                                            </div>
                                            <div className="text-[10px] text-muted truncate">
                                                {attr.source}
                                            </div>
                                        </div>

                                        <div className="col-span-3 truncate text-zinc-200">
                                            {attr.failureValue === "NOT CAPTURED" ? (
                                                <span className="text-zinc-600 italic font-sans text-[11px]">NOT CAPTURED</span>
                                            ) : (
                                                <span className={isDiff ? "text-amber-300 font-semibold" : "text-white"}>
                                                    {attr.failureValue}
                                                </span>
                                            )}
                                        </div>

                                        <div className="col-span-3 truncate text-zinc-200">
                                            {attr.referenceValue === "NOT CAPTURED" ? (
                                                <span className="text-zinc-600 italic font-sans text-[11px]">NOT CAPTURED</span>
                                            ) : (
                                                <span className="text-emerald-300">
                                                    {attr.referenceValue}
                                                </span>
                                            )}
                                        </div>

                                        <div className="col-span-3 text-right">
                                            <span
                                                className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                                                    isDiff
                                                        ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                                        : isCommon
                                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                                        : "bg-zinc-800 text-zinc-500 border-zinc-700"
                                                }`}
                                            >
                                                {attr.status}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Correlated Actions */}
                    <div className="flex items-center gap-3">
                        {fingerprint.failureEvent.traceId && (
                            <Link
                                href={`/explore/traces?traceId=${encodeURIComponent(fingerprint.failureEvent.traceId)}`}
                                className="halo-btn halo-btn-secondary halo-btn-sm"
                            >
                                <Waypoints size={13} className="text-cyan-400" />
                                <span>Inspect Divergence in Traces</span>
                                <ArrowUpRight size={12} />
                            </Link>
                        )}
                        <Link
                            href={`/explore/errors?eventId=${encodeURIComponent(fingerprint.failureEvent.id)}`}
                            className="halo-btn halo-btn-secondary halo-btn-sm"
                        >
                            <FileWarning size={13} className="text-red-400" />
                            <span>View Reproduction Recipe</span>
                            <ArrowUpRight size={12} />
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
