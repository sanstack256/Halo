"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
    X,
    ArrowUpRight,
    Copy,
    Terminal,
    Waypoints,
    Globe,
    FileWarning,
    Database,
    Cpu,
    HelpCircle,
    Info,
    Layers,
    Clock,
} from "lucide-react";
import type { CanonicalEvidenceRecord, AnalyticalResultProvenance } from "@/lib/explore/evidence-types";
import { RelativeTime } from "@/components/ui/relative-time";
import { CopyButton } from "./copy-button";
import { EvidenceBadge } from "./evidence-badge";

interface DetailDrawerProps {
    record: CanonicalEvidenceRecord | null;
    provenance?: AnalyticalResultProvenance | null;
    onClose: () => void;
}

export function DetailDrawer({ record, provenance, onClose }: DetailDrawerProps) {
    const [activeTab, setActiveTab] = useState<"overview" | "raw" | "provenance">("overview");

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    if (!record) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Slide-over panel */}
            <div className="relative w-full max-w-xl bg-[#080b11] border-l border-border h-full flex flex-col z-10 shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">
                {/* Header */}
                <div className="p-4 border-b border-border flex items-center justify-between gap-3 bg-surface">
                    <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold bg-accent/10 text-accent border border-accent/20">
                                {record.type}
                            </span>
                            <span className="text-xs text-muted font-mono truncate">
                                ID: {record.id}
                            </span>
                        </div>
                        <h2 className="text-sm font-semibold text-white font-sans truncate">
                            {record.title}
                        </h2>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-lg border border-border bg-surface text-secondary hover:text-white flex items-center justify-center shrink-0"
                        title="Close drawer (Esc)"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Sub-Navigation Tabs */}
                <div className="flex items-center border-b border-border bg-[#06080e] px-4 text-xs font-mono">
                    <button
                        type="button"
                        onClick={() => setActiveTab("overview")}
                        className={`py-2.5 px-3 border-b-2 font-semibold transition-colors ${
                            activeTab === "overview"
                                ? "border-accent text-white"
                                : "border-transparent text-muted hover:text-zinc-300"
                        }`}
                    >
                        Overview & Telemetry
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("raw")}
                        className={`py-2.5 px-3 border-b-2 font-semibold transition-colors ${
                            activeTab === "raw"
                                ? "border-accent text-white"
                                : "border-transparent text-muted hover:text-zinc-300"
                        }`}
                    >
                        Raw Captured Payload
                    </button>
                    {(provenance || record.provenance) && (
                        <button
                            type="button"
                            onClick={() => setActiveTab("provenance")}
                            className={`py-2.5 px-3 border-b-2 font-semibold transition-colors ${
                                activeTab === "provenance"
                                    ? "border-accent text-white"
                                    : "border-transparent text-muted hover:text-zinc-300"
                            }`}
                        >
                            Why This Result?
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
                    {/* TAB 1: OVERVIEW */}
                    {activeTab === "overview" && (
                        <div className="space-y-5">
                            {/* Cross-Investigation Strip */}
                            <div className="space-y-2">
                                <span className="text-[10px] font-mono uppercase font-semibold text-muted block">
                                    Cross-Evidence Navigation
                                </span>
                                <div className="grid grid-cols-2 gap-2">
                                    {record.traceId && (
                                        <Link
                                            href={`/explore/traces?traceId=${encodeURIComponent(record.traceId)}`}
                                            className="p-2.5 rounded-lg bg-surface border border-border hover:border-accent/40 flex items-center justify-between text-zinc-300 hover:text-white transition-colors"
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                <Waypoints size={13} className="text-cyan-400 shrink-0" />
                                                <span className="font-sans truncate">Divergence Finder</span>
                                            </div>
                                            <ArrowUpRight size={12} className="text-muted shrink-0" />
                                        </Link>
                                    )}

                                    {record.requestId && (
                                        <Link
                                            href={`/explore/requests?requestId=${encodeURIComponent(record.requestId)}`}
                                            className="p-2.5 rounded-lg bg-surface border border-border hover:border-accent/40 flex items-center justify-between text-zinc-300 hover:text-white transition-colors"
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                <Globe size={13} className="text-purple-400 shrink-0" />
                                                <span className="font-sans truncate">Request Reconstruction</span>
                                            </div>
                                            <ArrowUpRight size={12} className="text-muted shrink-0" />
                                        </Link>
                                    )}

                                    <Link
                                        href={`/explore/logs?service=${encodeURIComponent(record.service || "")}${record.traceId ? `&search=${encodeURIComponent(record.traceId)}` : ""}`}
                                        className="p-2.5 rounded-lg bg-surface border border-border hover:border-accent/40 flex items-center justify-between text-zinc-300 hover:text-white transition-colors"
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <Terminal size={13} className="text-amber-400 shrink-0" />
                                            <span className="font-sans truncate">Threaded Logs</span>
                                        </div>
                                        <ArrowUpRight size={12} className="text-muted shrink-0" />
                                    </Link>

                                    <Link
                                        href={`/explore/infrastructure?eventId=${encodeURIComponent(record.id)}`}
                                        className="p-2.5 rounded-lg bg-surface border border-border hover:border-accent/40 flex items-center justify-between text-zinc-300 hover:text-white transition-colors"
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <Cpu size={13} className="text-emerald-400 shrink-0" />
                                            <span className="font-sans truncate">Runtime Fingerprint</span>
                                        </div>
                                        <ArrowUpRight size={12} className="text-muted shrink-0" />
                                    </Link>
                                </div>
                            </div>

                            {/* Structured Attributes Grid */}
                            <div className="p-3 rounded-lg bg-surface border border-border space-y-2 font-mono">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted">Timestamp</span>
                                    <span className="text-white flex items-center gap-1.5">
                                        {record.timestamp.toISOString()}
                                        <span className="text-secondary">(<RelativeTime date={record.timestamp} />)</span>
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted">Service</span>
                                    <span className="text-white font-semibold">{record.service || "unspecified"}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted">Environment</span>
                                    <span className="text-white">{record.environmentName}</span>
                                </div>
                                {record.release && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted">Release</span>
                                        <span className="text-indigo-300">{record.release}</span>
                                    </div>
                                )}
                                {record.durationMs !== null && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted">Measured Duration</span>
                                        <span className="text-white">{record.durationMs}ms</span>
                                    </div>
                                )}
                                {record.traceId && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted">Trace ID</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-cyan-300">{record.traceId}</span>
                                            <CopyButton text={record.traceId} label="Trace ID" />
                                        </div>
                                    </div>
                                )}
                                {record.requestId && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted">Request ID</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-purple-300">{record.requestId}</span>
                                            <CopyButton text={record.requestId} label="Request ID" />
                                        </div>
                                    </div>
                                )}
                                {record.sessionId && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted">Session ID</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-blue-300">{record.sessionId}</span>
                                            <CopyButton text={record.sessionId} label="Session ID" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Stack trace if present */}
                            {record.stack && (
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-mono uppercase font-semibold text-muted">
                                            Observed Stack Trace
                                        </span>
                                        <CopyButton text={record.stack} label="Stack" />
                                    </div>
                                    <pre className="p-3 rounded-lg bg-[#04060a] border border-border font-mono text-[11px] text-zinc-300 overflow-x-auto whitespace-pre leading-relaxed">
                                        {record.stack}
                                    </pre>
                                </div>
                            )}

                            {/* Breadcrumbs if present */}
                            {record.breadcrumbs.length > 0 && (
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-mono uppercase font-semibold text-muted">
                                        Prior Execution Breadcrumbs ({record.breadcrumbs.length})
                                    </span>
                                    <div className="space-y-1">
                                        {record.breadcrumbs.map((b, idx) => (
                                            <div
                                                key={idx}
                                                className="p-2 rounded bg-surface border border-border/60 text-[11px] font-mono flex items-start gap-2"
                                            >
                                                <span className="text-accent font-semibold shrink-0">
                                                    [{String(b.category || "breadcrumb")}]
                                                </span>
                                                <span className="text-zinc-300">{String(b.message || "")}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 2: RAW CAPTURED PAYLOAD */}
                    {activeTab === "raw" && (
                        <div className="space-y-3 font-mono">
                            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 font-sans flex items-start gap-2">
                                <Info size={14} className="shrink-0 mt-0.5" />
                                <span>
                                    Displaying unmodified payload captured by the Halo SDK telemetry pipeline.
                                </span>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase font-semibold text-muted">
                                    Event JSON Payload
                                </span>
                                <CopyButton
                                    text={JSON.stringify(
                                        {
                                            id: record.id,
                                            type: record.type,
                                            title: record.title,
                                            message: record.message,
                                            timestamp: record.timestamp,
                                            metadata: record.metadata,
                                            tags: record.tags,
                                            traceId: record.traceId,
                                            requestId: record.requestId,
                                            sessionId: record.sessionId,
                                        },
                                        null,
                                        2
                                    )}
                                    label="JSON"
                                />
                            </div>

                            <pre className="p-3 rounded-lg bg-[#04060a] border border-border text-[11px] text-zinc-300 overflow-x-auto whitespace-pre leading-relaxed">
                                {JSON.stringify(
                                    {
                                        id: record.id,
                                        type: record.type,
                                        title: record.title,
                                        message: record.message,
                                        timestamp: record.timestamp,
                                        metadata: record.metadata,
                                        tags: record.tags,
                                        traceId: record.traceId,
                                        requestId: record.requestId,
                                        sessionId: record.sessionId,
                                    },
                                    null,
                                    2
                                )}
                            </pre>
                        </div>
                    )}

                    {/* TAB 3: PROVENANCE (WHY THIS RESULT?) */}
                    {activeTab === "provenance" && (
                        <div className="space-y-4 font-mono">
                            <div className="p-3.5 rounded-xl bg-accent/10 border border-accent/30 space-y-1.5 font-sans">
                                <span className="text-[10px] uppercase font-bold text-accent block font-mono">
                                    PROVENANCE JUSTIFICATION
                                </span>
                                <p className="text-xs text-white leading-relaxed">
                                    {provenance?.summary || record.provenance?.description || "Derived from canonical event telemetry."}
                                </p>
                            </div>

                            {/* What Halo can & cannot establish */}
                            {provenance && (
                                <div className="space-y-3 font-sans text-xs">
                                    <div className="p-3 rounded-lg bg-surface border border-emerald-500/30 space-y-1.5">
                                        <span className="text-[10px] font-mono uppercase font-bold text-emerald-400 block">
                                            WHAT CAN BE ESTABLISHED FROM OBSERVED TELEMETRY
                                        </span>
                                        <ul className="space-y-1 text-zinc-300 list-disc list-inside text-[11px]">
                                            {provenance.canBeEstablished.map((item, idx) => (
                                                <li key={idx}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="p-3 rounded-lg bg-surface border border-border space-y-1.5">
                                        <span className="text-[10px] font-mono uppercase font-bold text-amber-400 block">
                                            WHAT CANNOT BE ESTABLISHED WITHOUT ADDITIONAL INSTRUMENTATION
                                        </span>
                                        <ul className="space-y-1 text-zinc-400 list-disc list-inside text-[11px]">
                                            {provenance.cannotBeEstablished.map((item, idx) => (
                                                <li key={idx}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {/* Underlying Evidence IDs */}
                            <div className="space-y-1.5">
                                <span className="text-[10px] uppercase font-semibold text-muted block">
                                    Underlying Telemetry Evidence IDs
                                </span>
                                <div className="p-3 rounded-lg bg-[#04060a] border border-border space-y-1 text-[11px]">
                                    {(provenance?.basisEvidenceIds || record.provenance?.sourceEventIds || [record.id]).map((eid) => (
                                        <div key={eid} className="flex items-center justify-between text-zinc-300">
                                            <span>{eid}</span>
                                            <CopyButton text={eid} label="ID" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
