"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Activity,
    Globe,
    Server,
    ArrowDown,
    Split,
    Database,
    Waypoints,
    Search,
    ChevronRight,
    ArrowUpRight,
    Layers,
    Clock,
    Lock,
} from "lucide-react";
import type { RequestReconstruction, RequestDiffResult } from "@/lib/explore/request-reconstruction";
import type { CanonicalEvidenceRecord } from "@/lib/explore/evidence-types";
import { ExploreHeader } from "./explore-header";
import { ExploreEmptyState } from "./empty-state";
import { RelativeTime } from "@/components/ui/relative-time";
import { CopyButton } from "./copy-button";

interface RequestReconstructionClientProps {
    reconstruction: RequestReconstruction | null;
    diff: RequestDiffResult | null;
    recentRequests: CanonicalEvidenceRecord[];
    currentRequestId?: string;
    compareRequestId?: string;
}

export function RequestReconstructionClient({
    reconstruction,
    diff,
    recentRequests,
    currentRequestId,
    compareRequestId,
}: RequestReconstructionClientProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [reqInput, setReqInput] = useState(currentRequestId || "");
    const [compareInput, setCompareInput] = useState(compareRequestId || "");

    const handleApplyRequest = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        if (reqInput.trim()) params.set("requestId", reqInput.trim());
        if (compareInput.trim()) {
            params.set("compareRequestId", compareInput.trim());
        } else {
            params.delete("compareRequestId");
        }
        router.push(`/explore/requests?${params.toString()}`);
    };

    const handleSelectRecent = (rid: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("requestId", rid);
        router.push(`/explore/requests?${params.toString()}`);
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <ExploreHeader
                title="Requests"
                subtitle="Reconstruct what actually happened to one request from ingress to completion."
                icon={Globe}
                badgeText={reconstruction ? `Request: ${reconstruction.requestId.slice(0, 8)}` : undefined}
            />

            {/* Request Identifier Toolbar */}
            <div className="p-3.5 rounded-xl bg-surface border border-border space-y-3">
                <form onSubmit={handleApplyRequest} className="flex flex-wrap items-center gap-2.5 text-xs">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                            type="text"
                            value={reqInput}
                            onChange={(e) => setReqInput(e.target.value)}
                            placeholder="Target Request ID..."
                            className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-[#080b11] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent font-mono"
                        />
                    </div>

                    <div className="relative flex-1 min-w-[220px]">
                        <Split size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                            type="text"
                            value={compareInput}
                            onChange={(e) => setCompareInput(e.target.value)}
                            placeholder="Compare Request ID (optional)..."
                            className="w-full h-9 pl-8 pr-3 rounded-lg border border-border bg-[#080b11] text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent font-mono"
                        />
                    </div>

                    <button type="submit" className="halo-btn halo-btn-primary halo-btn-sm font-sans shrink-0">
                        Reconstruct Request
                    </button>
                </form>

                {/* Recent Request Chips */}
                {recentRequests.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-mono pt-1 border-t border-border/60">
                        <span className="text-muted">RECENT REQUESTS:</span>
                        {recentRequests.slice(0, 6).map((req) => {
                            const rid = req.requestId || req.id;
                            const isActive = rid === reconstruction?.requestId;
                            return (
                                <button
                                    key={req.id}
                                    type="button"
                                    onClick={() => handleSelectRecent(rid)}
                                    className={`px-2 py-0.5 rounded border transition-colors ${
                                        isActive
                                            ? "bg-purple-500/15 border-purple-500 text-purple-300 font-bold"
                                            : "bg-[#06080e] border-border text-zinc-400 hover:text-white hover:border-zinc-500"
                                    }`}
                                >
                                    {req.service || "service"} ({rid.slice(0, 8)})
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Reconstruction Execution Document */}
            {!reconstruction ? (
                <ExploreEmptyState
                    type="MISSING_TELEMETRY"
                    title="No request telemetry observed"
                    description="No telemetry matching the target request identifier was observed. Select a recent request from the list or submit an active Request ID."
                />
            ) : (
                <div className="space-y-6">
                    {/* Execution Document Container */}
                    <div className="rounded-xl bg-surface border border-border overflow-hidden divide-y divide-border">
                        {/* Document Title Header */}
                        <div className="p-4 bg-[#06080e] flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/30">
                                        HTTP REQUEST DOCUMENT
                                    </span>
                                    <span className="font-mono text-white font-bold">{reconstruction.requestId}</span>
                                </div>
                                <div className="text-[11px] text-secondary font-mono flex items-center gap-2">
                                    <span>Time: {reconstruction.ingress.timestamp.toISOString()}</span>
                                    <span>•</span>
                                    <span>(<RelativeTime date={reconstruction.ingress.timestamp} />)</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {reconstruction.traceId && (
                                    <Link
                                        href={`/explore/traces?traceId=${encodeURIComponent(reconstruction.traceId)}`}
                                        className="halo-btn halo-btn-xs halo-btn-secondary"
                                    >
                                        <Waypoints size={12} className="text-cyan-400" />
                                        <span>Inspect Trace</span>
                                        <ArrowUpRight size={11} />
                                    </Link>
                                )}
                            </div>
                        </div>

                        {/* SECTION 1: INGRESS */}
                        <div className="p-5 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-mono font-bold text-accent">
                                <span className="px-1.5 py-0.2 rounded bg-accent/20 text-accent">1</span>
                                <span>SECTION 1: INGRESS</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                                <div className="p-3 rounded-lg bg-[#04060a] border border-border space-y-1.5">
                                    <div className="text-muted text-[10px] uppercase">Route & Method</div>
                                    <div className="text-white font-semibold text-sm flex items-center gap-2">
                                        <span className="text-accent">{reconstruction.ingress.method}</span>
                                        <span className="truncate">{reconstruction.ingress.url}</span>
                                    </div>
                                    {reconstruction.ingress.host && (
                                        <div className="text-secondary text-[11px]">Host: {reconstruction.ingress.host}</div>
                                    )}
                                </div>

                                <div className="p-3 rounded-lg bg-[#04060a] border border-border space-y-1.5">
                                    <div className="text-muted text-[10px] uppercase">Client Ingress Metadata</div>
                                    <div className="text-zinc-300 text-xs">
                                        IP: {reconstruction.ingress.clientMetadata.ip || "Not captured"}
                                    </div>
                                    <div className="text-zinc-400 text-[11px] truncate" title={reconstruction.ingress.clientMetadata.userAgent}>
                                        User-Agent: {reconstruction.ingress.clientMetadata.userAgent || "Not captured"}
                                    </div>
                                </div>
                            </div>

                            {/* Captured Headers */}
                            <div className="p-3 rounded-lg bg-[#04060a] border border-border space-y-1.5 text-xs font-mono">
                                <div className="text-muted text-[10px] uppercase">Captured Headers</div>
                                {Object.keys(reconstruction.ingress.capturedHeaders).length > 0 ? (
                                    <div className="space-y-1">
                                        {Object.entries(reconstruction.ingress.capturedHeaders).map(([k, v]) => (
                                            <div key={k} className="flex items-baseline justify-between text-[11px]">
                                                <span className="text-zinc-400">{k}</span>
                                                <span className="text-white truncate max-w-sm">{v}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-zinc-500 italic text-[11px]">
                                        [No safe HTTP headers captured in telemetry]
                                    </div>
                                )}
                            </div>

                            {/* Honest Body Indicator */}
                            <div className="p-2.5 rounded-lg bg-[#04060a] border border-border/60 text-xs font-mono text-zinc-500 flex items-center justify-between">
                                <span className="text-[10px] uppercase font-semibold">Request Body</span>
                                <span className="italic text-[11px]">
                                    {reconstruction.ingress.bodyCaptured
                                        ? "REQUEST BODY CAPTURED"
                                        : "REQUEST BODY NOT CAPTURED"}
                                </span>
                            </div>
                        </div>

                        {/* SECTION 2: PROCESSING */}
                        <div className="p-5 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-mono font-bold text-accent">
                                <span className="px-1.5 py-0.2 rounded bg-accent/20 text-accent">2</span>
                                <span>SECTION 2: PROCESSING</span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                                <div className="p-3 rounded-lg bg-[#04060a] border border-border space-y-1">
                                    <span className="text-muted text-[10px] uppercase">Target Service</span>
                                    <span className="text-white font-bold block">{reconstruction.processing.service}</span>
                                </div>
                                <div className="p-3 rounded-lg bg-[#04060a] border border-border space-y-1">
                                    <span className="text-muted text-[10px] uppercase">Handler / Operation</span>
                                    <span className="text-white font-semibold block truncate">
                                        {reconstruction.processing.handler || "Unspecified"}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg bg-[#04060a] border border-border space-y-1">
                                    <span className="text-muted text-[10px] uppercase">Processing Duration</span>
                                    <span className="text-white font-bold block">
                                        {reconstruction.processing.durationMs ? `${reconstruction.processing.durationMs}ms` : "Unmeasured"}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg bg-[#04060a] border border-border space-y-1">
                                    <span className="text-muted text-[10px] uppercase">Environment</span>
                                    <span className="text-white block">{reconstruction.processing.environment}</span>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 3: OUTBOUND */}
                        <div className="p-5 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-mono font-bold text-accent">
                                <span className="px-1.5 py-0.2 rounded bg-accent/20 text-accent">3</span>
                                <span>SECTION 3: OUTBOUND DEPENDENCIES ({reconstruction.outboundCalls.length})</span>
                            </div>

                            {reconstruction.outboundCalls.length === 0 ? (
                                <div className="p-4 rounded-lg bg-[#04060a] border border-border text-center text-xs text-zinc-500 font-mono italic">
                                    [No downstream HTTP or database telemetry observed for this request]
                                </div>
                            ) : (
                                <div className="space-y-1.5 font-mono text-xs">
                                    {reconstruction.outboundCalls.map((call) => (
                                        <div
                                            key={call.id}
                                            className="p-3 rounded-lg bg-[#04060a] border border-border flex items-center justify-between gap-3 text-xs"
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                {call.type === "DATABASE" ? (
                                                    <Database size={13} className="text-emerald-400 shrink-0" />
                                                ) : (
                                                    <Globe size={13} className="text-cyan-400 shrink-0" />
                                                )}
                                                <span className="text-secondary uppercase text-[10px] font-bold shrink-0">
                                                    [{call.type}]
                                                </span>
                                                <span className="text-white font-semibold truncate">{call.target}</span>
                                                <span className="text-muted truncate text-[11px]">{call.operation}</span>
                                            </div>

                                            <div className="flex items-center gap-3 shrink-0 text-muted text-[11px]">
                                                {call.durationMs && <span>{call.durationMs}ms</span>}
                                                {call.status && <span className="text-zinc-300">[{call.status}]</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* SECTION 4: RESPONSE */}
                        <div className="p-5 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-mono font-bold text-accent">
                                <span className="px-1.5 py-0.2 rounded bg-accent/20 text-accent">4</span>
                                <span>SECTION 4: RESPONSE</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                                <div className="p-3 rounded-lg bg-[#04060a] border border-border space-y-1">
                                    <span className="text-muted text-[10px] uppercase">HTTP Status Code</span>
                                    <span
                                        className={`text-base font-bold block ${
                                            String(reconstruction.response.status).startsWith("2")
                                                ? "text-emerald-400"
                                                : "text-red-400"
                                        }`}
                                    >
                                        {reconstruction.response.status}
                                    </span>
                                </div>

                                <div className="p-3 rounded-lg bg-[#04060a] border border-border space-y-1">
                                    <span className="text-muted text-[10px] uppercase">Total Roundtrip Duration</span>
                                    <span className="text-base font-bold text-white block">
                                        {reconstruction.response.durationMs ? `${reconstruction.response.durationMs}ms` : "Unmeasured"}
                                    </span>
                                </div>
                            </div>

                            <div className="p-2.5 rounded-lg bg-[#04060a] border border-border/60 text-xs font-mono text-zinc-500 flex items-center justify-between">
                                <span className="text-[10px] uppercase font-semibold">Response Payload</span>
                                <span className="italic text-[11px]">
                                    {reconstruction.response.bodyCaptured
                                        ? "RESPONSE BODY CAPTURED"
                                        : "RESPONSE BODY NOT CAPTURED"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Request Diff Viewer (if compare request exists) */}
                    {diff && (
                        <div className="rounded-xl bg-surface border border-border overflow-hidden">
                            <div className="p-3.5 bg-[#06080e] border-b border-border flex items-center justify-between text-xs font-mono">
                                <span className="text-muted uppercase font-semibold">
                                    REQUEST COMPARISON DIFF
                                </span>
                                <span className="text-secondary text-[11px]">
                                    {diff.currentRequestId.slice(0, 8)} vs {diff.referenceRequestId.slice(0, 8)}
                                </span>
                            </div>

                            <div className="divide-y divide-border/40 font-mono text-xs">
                                {diff.diffs.map((d, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-3 grid grid-cols-12 gap-3 items-center ${
                                            !d.isIdentical ? "bg-amber-500/10" : ""
                                        }`}
                                    >
                                        <div className="col-span-3 text-secondary text-[11px]">{d.field}</div>
                                        <div className="col-span-4 text-white truncate font-semibold">
                                            {d.currentValue}
                                        </div>
                                        <div className="col-span-4 text-zinc-300 truncate">
                                            {d.referenceValue}
                                        </div>
                                        <div className="col-span-1 text-right">
                                            <span
                                                className={`text-[10px] font-bold ${
                                                    d.isIdentical ? "text-emerald-400" : "text-amber-400"
                                                }`}
                                            >
                                                {d.isIdentical ? "IDENTICAL" : "DIFF"}
                                            </span>
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
}
