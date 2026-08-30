"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
    ArrowUpRight,
    Check,
    Clock,
    Code2,
    Copy,
    ExternalLink,
    FileCode,
    Filter,
    Layers,
    Server,
    Tag,
    Terminal,
    User as UserIcon,
    X,
} from "lucide-react";
import { RelativeTime } from "@/components/ui/relative-time";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { EventTypeBadge } from "@/components/events/event-type-badge";
import { formatDeterministicDateTime } from "@/lib/date-format";
import StackTrace from "@/components/events/stack-trace";
import Breadcrumbs from "@/components/events/breadcrumbs";
import Tags from "@/components/events/tags";
import User from "@/components/events/user";

export interface DrawerTelemetryEvent {
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
    event: DrawerTelemetryEvent | null;
    onClose: () => void;
    onFilterService?: (service: string) => void;
    onFilterTrace?: (traceId: string) => void;
}

export function EventDetailDrawer({
    projectId,
    event,
    onClose,
    onFilterService,
    onFilterTrace,
}: Props) {
    const [copiedJson, setCopiedJson] = useState(false);
    const [activeTab, setActiveTab] = useState<"overview" | "request" | "stack" | "breadcrumbs" | "tags" | "raw">("overview");

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        if (event) {
            window.addEventListener("keydown", handleKeyDown);
        }
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [event, onClose]);

    if (!event) return null;

    const copyRawJson = () => {
        navigator.clipboard.writeText(JSON.stringify(event, null, 2));
        setCopiedJson(true);
        setTimeout(() => setCopiedJson(false), 2000);
    };

    const hasRequestInfo = Boolean(
        event.operation || event.resource || event.status || event.durationMs || event.requestId || event.traceId
    );
    const hasStack = Boolean(event.stack);
    const hasBreadcrumbs = Boolean(event.breadcrumbs);
    const hasTagsOrUser = Boolean(event.tags || event.user || event.metadata);

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Sliding Drawer Panel */}
            <div className="relative z-10 w-full max-w-2xl bg-[#080b11] border-l border-border shadow-2xl flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-200">
                {/* Header */}
                <div className="p-5 border-b border-border space-y-3 bg-surface/50">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <EventTypeBadge type={event.type} />
                            <SeverityBadge severity={event.severity} />
                            <span className="text-xs font-mono text-zinc-500">
                                ID: <code className="text-zinc-400 font-mono">{event.id}</code>
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                            aria-label="Close event drawer"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-white tracking-tight leading-snug">
                            {event.title}
                        </h2>
                        {event.message && event.message !== event.title && (
                            <p className="text-xs font-mono text-zinc-400 mt-1 line-clamp-2">
                                {event.message}
                            </p>
                        )}
                    </div>

                    {/* Quick Action Links */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap text-xs font-mono">
                        {(event.issue?.id || event.issueId) && (
                            <Link
                                href={`/projects/${projectId}/issues/${event.issue?.id || event.issueId}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent-soft text-accent border border-accent/20 hover:bg-accent/15 transition-colors font-medium"
                            >
                                <span>View Issue</span>
                                <ArrowUpRight size={12} />
                            </Link>
                        )}

                        {event.traceId && onFilterTrace && (
                            <button
                                type="button"
                                onClick={() => onFilterTrace(event.traceId!)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface border border-border text-zinc-300 hover:text-white hover:bg-surface-elevated transition-colors"
                            >
                                <Filter size={11} />
                                <span>Trace: {event.traceId.slice(0, 8)}...</span>
                            </button>
                        )}

                        {event.service && onFilterService && (
                            <button
                                type="button"
                                onClick={() => onFilterService(event.service!)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface border border-border text-zinc-300 hover:text-white hover:bg-surface-elevated transition-colors"
                            >
                                <Filter size={11} />
                                <span>Service: {event.service}</span>
                            </button>
                        )}

                        <div className="ml-auto text-[11px] text-zinc-400 flex items-center gap-1.5">
                            <Clock size={12} className="text-zinc-500" />
                            <span>{formatDeterministicDateTime(event.timestamp)}</span>
                            <span className="text-zinc-600">·</span>
                            <RelativeTime date={event.timestamp} />
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 px-5 border-b border-border bg-surface/30 text-xs font-mono overflow-x-auto">
                    <button
                        type="button"
                        onClick={() => setActiveTab("overview")}
                        className={`px-3 py-2.5 border-b-2 font-medium transition-colors ${
                            activeTab === "overview"
                                ? "border-accent text-white"
                                : "border-transparent text-zinc-400 hover:text-zinc-200"
                        }`}
                    >
                        Overview
                    </button>

                    {hasRequestInfo && (
                        <button
                            type="button"
                            onClick={() => setActiveTab("request")}
                            className={`px-3 py-2.5 border-b-2 font-medium transition-colors ${
                                activeTab === "request"
                                ? "border-accent text-white"
                                : "border-transparent text-zinc-400 hover:text-zinc-200"
                            }`}
                        >
                            Request / Context
                        </button>
                    )}

                    {hasStack && (
                        <button
                            type="button"
                            onClick={() => setActiveTab("stack")}
                            className={`px-3 py-2.5 border-b-2 font-medium transition-colors ${
                                activeTab === "stack"
                                ? "border-accent text-white"
                                : "border-transparent text-zinc-400 hover:text-zinc-200"
                            }`}
                        >
                            Stack Trace
                        </button>
                    )}

                    {hasBreadcrumbs && (
                        <button
                            type="button"
                            onClick={() => setActiveTab("breadcrumbs")}
                            className={`px-3 py-2.5 border-b-2 font-medium transition-colors ${
                                activeTab === "breadcrumbs"
                                ? "border-accent text-white"
                                : "border-transparent text-zinc-400 hover:text-zinc-200"
                            }`}
                        >
                            Breadcrumbs
                        </button>
                    )}

                    {hasTagsOrUser && (
                        <button
                            type="button"
                            onClick={() => setActiveTab("tags")}
                            className={`px-3 py-2.5 border-b-2 font-medium transition-colors ${
                                activeTab === "tags"
                                ? "border-accent text-white"
                                : "border-transparent text-zinc-400 hover:text-zinc-200"
                            }`}
                        >
                            Tags & User
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setActiveTab("raw")}
                        className={`px-3 py-2.5 border-b-2 font-medium transition-colors ${
                            activeTab === "raw"
                                ? "border-accent text-white"
                                : "border-transparent text-zinc-400 hover:text-zinc-200"
                        }`}
                    >
                        Raw JSON
                    </button>
                </div>

                {/* Tab Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {activeTab === "overview" && (
                        <div className="space-y-4">
                            {/* Metadata Grid */}
                            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                                <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Service</span>
                                    <span className="text-zinc-200 font-semibold block">{event.service || "—"}</span>
                                </div>
                                <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Environment</span>
                                    <span className="text-zinc-200 font-semibold block">{event.environment?.name || "production"}</span>
                                </div>
                                <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">SDK</span>
                                    <span className="text-zinc-200 font-semibold block">
                                        {event.sdkName ? `${event.sdkName}${event.sdkVersion ? ` v${event.sdkVersion}` : ""}` : "—"}
                                    </span>
                                </div>
                                <div className="p-3 rounded-xl bg-surface border border-border space-y-1">
                                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Release</span>
                                    <span className="text-zinc-200 font-semibold block">{event.release || "—"}</span>
                                </div>
                            </div>

                            {/* Fingerprint & Correlated Issue */}
                            {(event.fingerprint || event.issue) && (
                                <div className="p-4 rounded-xl bg-surface border border-border space-y-2 text-xs font-mono">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-zinc-500 uppercase font-sans">Correlated Issue</span>
                                        {event.issue?.id && (
                                            <Link
                                                href={`/projects/${projectId}/issues/${event.issue.id}`}
                                                className="text-accent hover:underline flex items-center gap-1"
                                            >
                                                <span>Go to Issue</span>
                                                <ArrowUpRight size={11} />
                                            </Link>
                                        )}
                                    </div>
                                    <p className="text-white font-medium">{event.issue?.title || event.title}</p>
                                    {event.fingerprint && (
                                        <p className="text-zinc-500 text-[11px] truncate">
                                            fingerprint: <code className="text-zinc-400">{event.fingerprint}</code>
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Stack Trace Preview */}
                            {event.stack && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs font-mono">
                                        <span className="text-[10px] text-zinc-500 uppercase font-sans">Stack Trace</span>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab("stack")}
                                            className="text-accent hover:underline text-[11px]"
                                        >
                                            View Full Stack
                                        </button>
                                    </div>
                                    <StackTrace stack={event.stack} />
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "request" && (
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-surface border border-border space-y-3 text-xs font-mono">
                                <span className="text-[10px] text-zinc-500 uppercase block font-sans">Request / Operation Details</span>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <span className="text-zinc-500 block text-[10px]">Operation</span>
                                        <span className="text-zinc-200">{event.operation || "—"}</span>
                                    </div>
                                    <div>
                                        <span className="text-zinc-500 block text-[10px]">Resource</span>
                                        <span className="text-zinc-200 truncate block">{event.resource || "—"}</span>
                                    </div>
                                    <div>
                                        <span className="text-zinc-500 block text-[10px]">HTTP Status</span>
                                        <span className="text-zinc-200">{event.status || "—"}</span>
                                    </div>
                                    <div>
                                        <span className="text-zinc-500 block text-[10px]">Duration</span>
                                        <span className="text-zinc-200">{event.durationMs !== null && event.durationMs !== undefined ? `${event.durationMs}ms` : "—"}</span>
                                    </div>
                                    <div>
                                        <span className="text-zinc-500 block text-[10px]">Request ID</span>
                                        <span className="text-zinc-200 font-mono text-[11px] truncate block">{event.requestId || "—"}</span>
                                    </div>
                                    <div>
                                        <span className="text-zinc-500 block text-[10px]">Trace ID</span>
                                        <span className="text-zinc-200 font-mono text-[11px] truncate block">{event.traceId || "—"}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "stack" && event.stack && (
                        <StackTrace stack={event.stack} />
                    )}

                    {activeTab === "breadcrumbs" && event.breadcrumbs && (
                        <Breadcrumbs breadcrumbs={event.breadcrumbs} />
                    )}

                    {activeTab === "tags" && (
                        <div className="space-y-4">
                            {event.tags && <Tags tags={event.tags} />}
                            {event.user && <User user={event.user} />}
                            {event.metadata && (
                                <div className="p-4 rounded-xl bg-surface border border-border space-y-2">
                                    <span className="text-xs font-mono font-medium text-white">Metadata</span>
                                    <pre className="p-3 rounded-lg bg-[#04060a] border border-white/5 text-xs font-mono text-zinc-300 overflow-x-auto">
                                        {JSON.stringify(event.metadata, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "raw" && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-mono text-zinc-400">Complete Event JSON Payload</span>
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
                            <pre className="p-4 rounded-xl bg-[#04060a] border border-white/5 text-xs font-mono text-zinc-300 overflow-x-auto max-h-[500px]">
                                {JSON.stringify(event, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
