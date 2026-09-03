"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    ArrowLeft,
    ArrowUpRight,
    Check,
    Clock,
    Code2,
    Copy,
    ExternalLink,
    FileCode,
    Filter,
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
    Search,
} from "lucide-react";
import { RelativeTime } from "@/components/ui/relative-time";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { EventTypeBadge } from "@/components/events/event-type-badge";
import { BackButton } from "@/components/ui/back-button";
import { formatDeterministicDateTime } from "@/lib/date-format";
import StackTrace from "@/components/events/stack-trace";
import Breadcrumbs from "@/components/events/breadcrumbs";
import Tags from "@/components/events/tags";
import User from "@/components/events/user";

export interface TelemetryDetailEvent {
    id: string;
    type: string;
    severity: string;
    title: string;
    message: string | null;
    timestamp: Date;
    service?: string | null;
    environmentId?: string | null;
    environment?: { name: string } | null;
    sdkName?: string | null;
    sdkVersion?: string | null;
    release?: string | null;
    requestId?: string | null;
    traceId?: string | null;
    durationMs?: number | null;
    operation?: string | null;
    resource?: string | null;
    status?: string | number | null;
    sessionId?: string | null;
    fingerprint?: string | null;
    stack?: string | null;
    breadcrumbs?: any;
    tags?: any;
    user?: any;
    metadata?: any;
    issueId?: string | null;
    issue?: {
        id: string;
        title: string;
        fingerprint?: string | null;
    } | null;
}

interface Props {
    projectId: string;
    event: TelemetryDetailEvent;
}

export function EventDetailView({ projectId, event }: Props) {
    const [copiedJson, setCopiedJson] = useState(false);
    const [copiedId, setCopiedId] = useState(false);
    const [activeTab, setActiveTab] = useState<"overview" | "stack" | "request" | "breadcrumbs" | "tags" | "raw">("overview");

    const copyRawJson = () => {
        navigator.clipboard.writeText(JSON.stringify(event, null, 2));
        setCopiedJson(true);
        setTimeout(() => setCopiedJson(false), 2000);
    };

    const copyEventId = () => {
        navigator.clipboard.writeText(event.id);
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
    };

    const hasRequestInfo = Boolean(
        event.operation || event.resource || event.status || event.durationMs !== null || event.requestId || event.traceId
    );
    const hasStack = Boolean(event.stack);
    const hasBreadcrumbs = Boolean(Array.isArray(event.breadcrumbs) && event.breadcrumbs.length > 0);
    const hasTagsOrUser = Boolean(
        (event.tags && typeof event.tags === "object" && Object.keys(event.tags).length > 0) ||
        (event.user && typeof event.user === "object" && Object.keys(event.user).length > 0) ||
        event.metadata
    );

    return (
        <div className="space-y-6 pb-16">
            {/* 2. TOP AREA / HEADER */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-border pb-5">
                <div className="space-y-2 max-w-3xl">
                    <BackButton fallbackHref={`/projects/${projectId}/events`} label="Events" />

                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <EventTypeBadge type={event.type} />
                        <span className="text-zinc-600">·</span>
                        <SeverityBadge severity={event.severity} />
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
                        {event.title}
                    </h1>

                    {event.message && event.message !== event.title && (
                        <p className="text-xs font-mono text-zinc-400 leading-relaxed">
                            {event.message}
                        </p>
                    )}
                </div>

                {/* Right Header Actions & Identifiers */}
                <div className="flex flex-col md:items-end gap-2 shrink-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        {event.issueId && (
                            <Link
                                href={`/projects/${projectId}/investigations/new?issueId=${event.issueId}&eventId=${event.id}`}
                                className="halo-btn halo-btn-sm halo-btn-primary inline-flex items-center gap-1.5"
                            >
                                <Sparkles size={14} />
                                <span>Investigate</span>
                            </Link>
                        )}
                        <Link
                            href={`/explore?anchorId=${event.id}`}
                            className="halo-btn halo-btn-sm halo-btn-secondary inline-flex items-center gap-1.5"
                        >
                            <Search size={13} className="text-cyan-400" />
                            <span>Evidence Needle</span>
                        </Link>
                        {(event.issue?.id || event.issueId) && (
                            <Link
                                href={`/projects/${projectId}/issues/${event.issue?.id || event.issueId}`}
                                className="halo-btn halo-btn-sm halo-btn-secondary inline-flex items-center gap-1.5"
                            >
                                <span>View Issue</span>
                                <ArrowUpRight size={13} />
                            </Link>
                        )}
                    </div>

                    {/* Timestamp & ID */}
                    <div className="flex items-center gap-2 text-xs font-mono text-secondary pt-1 flex-wrap">
                        <span title={formatDeterministicDateTime(event.timestamp)}>
                            {formatDeterministicDateTime(event.timestamp)}
                        </span>
                        <span className="text-zinc-600">·</span>
                        <RelativeTime date={event.timestamp} />
                        <span className="text-zinc-600">·</span>
                        <button
                            type="button"
                            onClick={copyEventId}
                            className="text-zinc-400 hover:text-white inline-flex items-center gap-1 cursor-pointer"
                            title="Copy Event ID"
                        >
                            <span>ID: <code className="text-zinc-300">{event.id}</code></span>
                            {copiedId ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                        </button>
                    </div>
                </div>
            </div>

            {/* 3. EVENT SUMMARY METADATA GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-surface border border-border space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans tracking-wider">Service</span>
                    <span className="text-zinc-200 font-semibold truncate block">{event.service || "—"}</span>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-border space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans tracking-wider">Environment</span>
                    <span className="text-zinc-200 font-semibold truncate block">{event.environment?.name || "production"}</span>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-border space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans tracking-wider">SDK Runtime</span>
                    <span className="text-zinc-200 truncate block">
                        {event.sdkName ? `${event.sdkName}${event.sdkVersion ? ` v${event.sdkVersion}` : ""}` : "—"}
                    </span>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-border space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans tracking-wider">Release</span>
                    <span className="text-zinc-200 truncate block">{event.release || "—"}</span>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-border space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans tracking-wider">Trace ID</span>
                    <span className="text-zinc-300 font-mono truncate block" title={event.traceId || ""}>
                        {event.traceId ? `${event.traceId.slice(0, 10)}…` : "—"}
                    </span>
                </div>

                <div className="p-3 rounded-xl bg-surface border border-border space-y-0.5">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans tracking-wider">Request ID</span>
                    <span className="text-zinc-300 font-mono truncate block" title={event.requestId || ""}>
                        {event.requestId ? `${event.requestId.slice(0, 10)}…` : "—"}
                    </span>
                </div>
            </div>

            {/* 4. DETAIL NAVIGATION TABS */}
            <div className="flex items-center gap-1 border-b border-border text-xs font-mono overflow-x-auto">
                <button
                    type="button"
                    onClick={() => setActiveTab("overview")}
                    className={`px-3.5 py-2.5 border-b-2 font-medium transition-colors ${
                        activeTab === "overview"
                            ? "border-accent text-white"
                            : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                    Overview
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab("stack")}
                    className={`px-3.5 py-2.5 border-b-2 font-medium transition-colors ${
                        activeTab === "stack"
                            ? "border-accent text-white"
                            : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                    Stack Trace {hasStack ? "" : "(None)"}
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab("request")}
                    className={`px-3.5 py-2.5 border-b-2 font-medium transition-colors ${
                        activeTab === "request"
                            ? "border-accent text-white"
                            : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                    Request Context
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab("breadcrumbs")}
                    className={`px-3.5 py-2.5 border-b-2 font-medium transition-colors ${
                        activeTab === "breadcrumbs"
                            ? "border-accent text-white"
                            : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                    Breadcrumbs {hasBreadcrumbs ? `(${event.breadcrumbs.length})` : "(0)"}
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab("tags")}
                    className={`px-3.5 py-2.5 border-b-2 font-medium transition-colors ${
                        activeTab === "tags"
                            ? "border-accent text-white"
                            : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                    Tags & User
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab("raw")}
                    className={`px-3.5 py-2.5 border-b-2 font-medium transition-colors ${
                        activeTab === "raw"
                            ? "border-accent text-white"
                            : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                >
                    Raw JSON
                </button>
            </div>

            {/* TAB CONTENTS */}
            <div className="space-y-6">
                {/* 5. OVERVIEW SECTION */}
                {activeTab === "overview" && (
                    <div className="space-y-6">
                        {/* Primary Message Box */}
                        <div className="p-5 rounded-xl bg-surface border border-border space-y-2">
                            <span className="text-[10px] text-zinc-500 uppercase font-sans tracking-wider block">
                                Ingested Event Payload / Message
                            </span>
                            <pre className="p-4 rounded-lg bg-[#04060a] border border-white/5 font-mono text-xs text-zinc-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                                {event.message || event.title || "No textual message recorded."}
                            </pre>
                        </div>

                        {/* Correlated Issue & Investigation Link Card */}
                        {(event.issueId || event.issue) && (
                            <div className="p-4 rounded-xl bg-surface border border-border space-y-3 text-xs font-mono">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-zinc-500 uppercase font-sans tracking-wider">
                                        Correlated Grouped Issue
                                    </span>
                                    <Link
                                        href={`/projects/${projectId}/issues/${event.issue?.id || event.issueId}`}
                                        className="text-accent hover:underline inline-flex items-center gap-1 font-medium"
                                    >
                                        <span>Open Issue Triage</span>
                                        <ArrowUpRight size={12} />
                                    </Link>
                                </div>
                                <p className="text-sm font-semibold text-white">
                                    {event.issue?.title || event.title}
                                </p>
                                {event.fingerprint && (
                                    <p className="text-zinc-500 text-[11px] truncate">
                                        fingerprint: <code className="text-zinc-400">{event.fingerprint}</code>
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Stack Trace Preview */}
                        {hasStack ? (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs font-mono">
                                    <span className="text-[10px] text-zinc-500 uppercase font-sans tracking-wider">
                                        Stack Trace Preview
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab("stack")}
                                        className="text-accent hover:underline text-[11px]"
                                    >
                                        View Full Stack
                                    </button>
                                </div>
                                <StackTrace stack={event.stack!} />
                            </div>
                        ) : null}
                    </div>
                )}

                {/* 6. STACK TRACE SECTION */}
                {activeTab === "stack" && (
                    <div className="space-y-4">
                        {hasStack ? (
                            <div className="space-y-2">
                                <StackTrace stack={event.stack!} />
                            </div>
                        ) : (
                            <div className="p-8 text-center rounded-xl bg-surface/30 border border-border text-xs font-mono text-zinc-500">
                                No stack trace was captured for this event record.
                            </div>
                        )}
                    </div>
                )}

                {/* 7. REQUEST CONTEXT SECTION */}
                {activeTab === "request" && (
                    <div className="space-y-4">
                        {hasRequestInfo ? (
                            <div className="p-5 rounded-xl bg-surface border border-border space-y-4 text-xs font-mono">
                                <span className="text-[10px] text-zinc-500 uppercase block font-sans tracking-wider">
                                    Request / Operation Context
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {event.operation && (
                                        <div className="p-3 rounded-lg bg-[#04060a] border border-white/5 space-y-1">
                                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Operation</span>
                                            <span className="text-emerald-400 font-semibold">{event.operation}</span>
                                        </div>
                                    )}
                                    {event.resource && (
                                        <div className="p-3 rounded-lg bg-[#04060a] border border-white/5 space-y-1">
                                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Resource Endpoint</span>
                                            <span className="text-white truncate block">{event.resource}</span>
                                        </div>
                                    )}
                                    {event.status !== null && event.status !== undefined && (
                                        <div className="p-3 rounded-lg bg-[#04060a] border border-white/5 space-y-1">
                                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">HTTP Status</span>
                                            <span className={`font-bold ${Number(event.status) >= 400 ? "text-red-400" : "text-emerald-400"}`}>
                                                {event.status}
                                            </span>
                                        </div>
                                    )}
                                    {event.durationMs !== null && event.durationMs !== undefined && (
                                        <div className="p-3 rounded-lg bg-[#04060a] border border-white/5 space-y-1">
                                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Duration</span>
                                            <span className="text-zinc-200 font-semibold">{event.durationMs}ms</span>
                                        </div>
                                    )}
                                    {event.requestId && (
                                        <div className="p-3 rounded-lg bg-[#04060a] border border-white/5 space-y-1">
                                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Request ID</span>
                                            <span className="text-zinc-300 font-mono text-[11px] truncate block">{event.requestId}</span>
                                        </div>
                                    )}
                                    {event.traceId && (
                                        <div className="p-3 rounded-lg bg-[#04060a] border border-white/5 space-y-1">
                                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Distributed Trace ID</span>
                                            <span className="text-purple-400 font-mono text-[11px] truncate block">{event.traceId}</span>
                                        </div>
                                    )}
                                    {event.sessionId && (
                                        <div className="p-3 rounded-lg bg-[#04060a] border border-white/5 space-y-1">
                                            <span className="text-[10px] text-zinc-500 uppercase block font-sans">Session ID</span>
                                            <span className="text-zinc-300 font-mono text-[11px] truncate block">{event.sessionId}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="p-8 text-center rounded-xl bg-surface/30 border border-border text-xs font-mono text-zinc-500">
                                No HTTP request or network operation telemetry was attached to this event.
                            </div>
                        )}
                    </div>
                )}

                {/* 8. BREADCRUMBS SECTION */}
                {activeTab === "breadcrumbs" && (
                    <div className="space-y-4">
                        {hasBreadcrumbs ? (
                            <Breadcrumbs breadcrumbs={event.breadcrumbs} />
                        ) : (
                            <div className="p-8 text-center rounded-xl bg-surface/30 border border-border text-xs font-mono text-zinc-500">
                                No pre-failure breadcrumbs were captured for this event.
                            </div>
                        )}
                    </div>
                )}

                {/* 9. TAGS & USER SECTION */}
                {activeTab === "tags" && (
                    <div className="space-y-4">
                        {event.tags && <Tags tags={event.tags} />}
                        {event.user && <User user={event.user} />}
                        {event.metadata && (
                            <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                                <span className="text-xs font-mono font-medium text-white">Metadata Context</span>
                                <pre className="p-3 rounded-lg bg-[#04060a] border border-white/5 text-xs font-mono text-zinc-300 overflow-x-auto">
                                    {JSON.stringify(event.metadata, null, 2)}
                                </pre>
                            </div>
                        )}
                        {!hasTagsOrUser && (
                            <div className="p-8 text-center rounded-xl bg-surface/30 border border-border text-xs font-mono text-zinc-500">
                                No custom tags or user identity context were attached to this event.
                            </div>
                        )}
                    </div>
                )}

                {/* 10. RAW JSON SECTION */}
                {activeTab === "raw" && (
                    <div className="p-5 rounded-xl bg-surface border border-border space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-mono text-zinc-400">Complete Telemetry JSON Payload</span>
                            <button
                                type="button"
                                onClick={copyRawJson}
                                className="halo-btn halo-btn-xs halo-btn-secondary inline-flex items-center gap-1.5"
                            >
                                {copiedJson ? (
                                    <>
                                        <Check size={12} className="text-emerald-400" />
                                        <span>Copied</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy size={12} />
                                        <span>Copy JSON</span>
                                    </>
                                )}
                            </button>
                        </div>
                        <pre className="p-4 rounded-lg bg-[#04060a] border border-white/5 text-xs font-mono text-zinc-300 overflow-x-auto max-h-[600px] leading-relaxed">
                            {JSON.stringify(event, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}
