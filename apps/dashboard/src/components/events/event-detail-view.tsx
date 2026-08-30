"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    ArrowLeft,
    Check,
    Clock,
    Code2,
    Copy,
    ExternalLink,
    FileCode,
    Layers,
    Play,
    Server,
    ShieldAlert,
    Sparkles,
    Tag,
    Terminal,
    User as UserIcon,
    Wifi,
    Zap,
} from "lucide-react";
import { RelativeTime } from "@/components/ui/relative-time";
import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { BackButton } from "@/components/ui/back-button";
import StackTrace from "@/components/events/stack-trace";
import Breadcrumbs from "@/components/events/breadcrumbs";
import Tags from "@/components/events/tags";
import User from "@/components/events/user";

interface Props {
    projectId: string;
    event: any;
}

export function EventDetailView({ projectId, event }: Props) {
    const [copiedJson, setCopiedJson] = useState(false);
    const [activeTab, setActiveTab] = useState<"overview" | "request" | "breadcrumbs" | "tags" | "raw">("overview");

    const copyRawJson = () => {
        navigator.clipboard.writeText(JSON.stringify(event, null, 2));
        setCopiedJson(true);
        setTimeout(() => setCopiedJson(false), 2000);
    };

    const hasRequestInfo = Boolean(
        event.operation || event.resource || event.status || event.durationMs || event.requestId || event.traceId
    );

    return (
        <div className="space-y-6 pb-16">
            {/* Header / Breadcrumb */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
                <div className="space-y-2">
                    <BackButton fallbackHref={`/projects/${projectId}/events`} label="Back to Events" />

                    <div className="flex items-center gap-2.5 flex-wrap pt-1">
                        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg border bg-surface border-border text-accent">
                            {event.type}
                        </span>
                        <SeverityBadge severity={event.severity} />
                        <span className="text-xs font-mono text-zinc-500">
                            ID: <code className="text-zinc-300">{event.id}</code>
                        </span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                        {event.title}
                    </h1>

                    <div className="flex items-center gap-3 text-xs font-mono text-secondary flex-wrap">
                        <span>{new Date(event.timestamp).toLocaleString()}</span>
                        <span className="text-zinc-600">•</span>
                        <RelativeTime date={event.timestamp} />
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-300">{event.service || "web-client"}</span>
                        {event.release && (
                            <>
                                <span className="text-zinc-600">•</span>
                                <span className="text-indigo-400">Release: {event.release}</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Top Action Bar */}
                <div className="flex items-center gap-2 flex-wrap">
                    {event.issueId && (
                        <Link
                            href={`/projects/${projectId}/investigations/new?issueId=${event.issueId}&eventId=${event.id}`}
                            className="halo-btn halo-btn-sm halo-btn-primary flex items-center gap-1.5 shadow-lg shadow-accent/20"
                        >
                            <Sparkles size={14} />
                            <span>Investigate Event</span>
                        </Link>
                    )}
                    <button
                        type="button"
                        onClick={copyRawJson}
                        className="halo-btn halo-btn-sm halo-btn-secondary flex items-center gap-1.5"
                    >
                        {copiedJson ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        <span>{copiedJson ? "JSON Copied" : "Copy Payload"}</span>
                    </button>
                </div>
            </div>

            {/* Quick Context Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Service</span>
                    <span className="text-accent font-bold truncate block">{event.service || "web-client"}</span>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Environment</span>
                    <span className="text-zinc-300 truncate block">{event.environment?.name || "production"}</span>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">SDK Runtime</span>
                    <span className="text-zinc-300 truncate block">
                        {event.sdkName ? `${event.sdkName}${event.sdkVersion ? ` v${event.sdkVersion}` : ""}` : "Not captured"}
                    </span>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Session ID</span>
                    <span className="text-zinc-400 truncate block">
                        {event.sessionId ? `${event.sessionId.slice(0, 10)}…` : "Not captured"}
                    </span>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Trace ID</span>
                    <span className="text-zinc-400 truncate block">
                        {event.traceId ? `${event.traceId.slice(0, 10)}…` : "Not captured"}
                    </span>
                </div>
                <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Request ID</span>
                    <span className="text-zinc-400 truncate block">
                        {event.requestId ? `${event.requestId.slice(0, 10)}…` : "Not captured"}
                    </span>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 border-b border-border pb-1">
                <button
                    type="button"
                    onClick={() => setActiveTab("overview")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                        activeTab === "overview"
                            ? "bg-accent text-white font-bold"
                            : "text-zinc-400 hover:text-white hover:bg-surface/50"
                    }`}
                >
                    Overview & Stack
                </button>

                {hasRequestInfo && (
                    <button
                        type="button"
                        onClick={() => setActiveTab("request")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                            activeTab === "request"
                                ? "bg-accent text-white font-bold"
                                : "text-zinc-400 hover:text-white hover:bg-surface/50"
                        }`}
                    >
                        Request Context
                    </button>
                )}

                {Array.isArray(event.breadcrumbs) && event.breadcrumbs.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setActiveTab("breadcrumbs")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                            activeTab === "breadcrumbs"
                                ? "bg-accent text-white font-bold"
                                : "text-zinc-400 hover:text-white hover:bg-surface/50"
                        }`}
                    >
                        Breadcrumbs ({event.breadcrumbs.length})
                    </button>
                )}

                {event.tags && typeof event.tags === "object" && Object.keys(event.tags).length > 0 && (
                    <button
                        type="button"
                        onClick={() => setActiveTab("tags")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                            activeTab === "tags"
                                ? "bg-accent text-white font-bold"
                                : "text-zinc-400 hover:text-white hover:bg-surface/50"
                        }`}
                    >
                        Tags & Attributes
                    </button>
                )}

                <button
                    type="button"
                    onClick={() => setActiveTab("raw")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                        activeTab === "raw"
                            ? "bg-accent text-white font-bold"
                            : "text-zinc-400 hover:text-white hover:bg-surface/50"
                    }`}
                >
                    Raw Payload JSON
                </button>
            </div>

            {/* Tab Contents */}
            <div className="space-y-6">
                {activeTab === "overview" && (
                    <div className="space-y-6">
                        {/* Event Message */}
                        <div className="p-5 rounded-2xl bg-surface border border-border space-y-2">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
                                Event Message
                            </h3>
                            <pre className="p-4 rounded-xl bg-[#080b11] border border-white/10 font-mono text-xs text-zinc-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                                {event.message || event.title || "No textual message recorded."}
                            </pre>
                        </div>

                        {/* Stack Trace */}
                        {event.stack ? (
                            <div className="space-y-2">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
                                    Captured Stack Trace
                                </h3>
                                <StackTrace stack={event.stack} />
                            </div>
                        ) : (
                            <div className="p-4 rounded-xl bg-surface/50 border border-border text-xs text-zinc-500 font-mono">
                                No stack trace was captured for this event type.
                            </div>
                        )}

                        {/* User & Session */}
                        {event.user && typeof event.user === "object" && (
                            <div className="space-y-2">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
                                    User & Identity Context
                                </h3>
                                <User user={event.user as any} />
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "request" && hasRequestInfo && (
                    <div className="p-5 rounded-2xl bg-surface border border-border space-y-4 text-xs font-mono">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                            Network & Distributed Trace Context
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {event.operation && (
                                <div className="p-3 rounded-xl bg-[#080b11] border border-white/10 space-y-1">
                                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Operation</span>
                                    <span className="text-emerald-400 font-bold">{event.operation}</span>
                                </div>
                            )}
                            {event.resource && (
                                <div className="p-3 rounded-xl bg-[#080b11] border border-white/10 space-y-1">
                                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Resource Endpoint</span>
                                    <span className="text-white truncate block">{event.resource}</span>
                                </div>
                            )}
                            {event.status != null && (
                                <div className="p-3 rounded-xl bg-[#080b11] border border-white/10 space-y-1">
                                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">HTTP / Return Status</span>
                                    <span className={`font-bold ${Number(event.status) >= 400 ? "text-red-400" : "text-emerald-400"}`}>
                                        {event.status}
                                    </span>
                                </div>
                            )}
                            {event.durationMs != null && (
                                <div className="p-3 rounded-xl bg-[#080b11] border border-white/10 space-y-1">
                                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Latency / Duration</span>
                                    <span className="text-zinc-200 font-bold">{event.durationMs} ms</span>
                                </div>
                            )}
                            {event.traceId && (
                                <div className="p-3 rounded-xl bg-[#080b11] border border-white/10 space-y-1 col-span-2">
                                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Distributed Trace ID</span>
                                    <span className="text-purple-400 truncate block">{event.traceId}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "breadcrumbs" && Array.isArray(event.breadcrumbs) && (
                    <div className="space-y-2">
                        <Breadcrumbs breadcrumbs={event.breadcrumbs as any} />
                    </div>
                )}

                {activeTab === "tags" && event.tags && typeof event.tags === "object" && (
                    <div className="space-y-2">
                        <Tags tags={event.tags as any} />
                    </div>
                )}

                {activeTab === "raw" && (
                    <div className="p-5 rounded-2xl bg-[#080b11] border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-mono uppercase text-zinc-400 font-bold">
                                Complete Ingested Telemetry JSON
                            </span>
                            <button
                                type="button"
                                onClick={copyRawJson}
                                className="halo-btn halo-btn-xs halo-btn-secondary flex items-center gap-1"
                            >
                                <Copy size={12} />
                                <span>Copy JSON</span>
                            </button>
                        </div>
                        <pre className="p-4 rounded-xl bg-surface/50 border border-border/80 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                            <code>{JSON.stringify(event, null, 2)}</code>
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}
