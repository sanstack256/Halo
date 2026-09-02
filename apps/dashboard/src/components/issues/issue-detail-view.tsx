"use client";

import React, { useState } from "react";
import Link from "next/link";
import { RelativeTime } from "@/components/ui/relative-time";
import { BackButton } from "@/components/ui/back-button";
import { HaloSelect } from "@/components/ui/halo-select";
import { formatDeterministicDate, formatDeterministicTime, formatDeterministicDateTime } from "@/lib/date-format";
import {
    Activity,
    AlertCircle,
    Archive,
    ArrowUpRight,
    Check,
    ChevronDown,
    Clock,
    Copy,
    ExternalLink,
    Filter,
    GitBranch,
    History,
    Layers,
    Play,
    Send,
    ShieldAlert,
    Sparkles,
    Tag,
    Terminal,
    User,
    Wifi,
    Zap,
} from "lucide-react";
import { ReplayPlayerClient } from "@/components/replay/replay-player-client";
import { ReplayStatus } from "@/components/replay/replay-status";

type EventItem = {
    id: string;
    title: string;
    type: string;
    severity: string;
    timestamp: Date;
    message: string | null;
    sdkName?: string | null;
    sdkVersion?: string | null;
    service?: string | null;
    requestId?: string | null;
    traceId?: string | null;
    resource?: string | null;
    release?: string | null;
    environment?: { name: string } | null;
    stack?: string | null;
};

type IssueDetailProps = {
    issue: {
        id: string;
        title: string;
        fingerprint?: string;
        status: string;
        severity: string;
        eventCount: number;
        firstSeen: Date;
        lastSeen: Date;
        projectId: string;
        events: EventItem[];
    };
    replaySession?: any | null;
    hasReplayAccess?: boolean;
};

export function IssueDetailView({ issue, replaySession, hasReplayAccess = true }: IssueDetailProps) {
    const [status, setStatus] = useState(issue.status);
    const [assignee, setAssignee] = useState("Unassigned");
    const [priority, setPriority] = useState("High");
    const [selectedEventId, setSelectedEventId] = useState<string>(issue.events[0]?.id || "");
    const [copiedStack, setCopiedStack] = useState(false);
    const [commentText, setCommentText] = useState("");
    const [comments, setComments] = useState<Array<{ id: string; text: string; date: Date }>>([
        {
            id: "1",
            text: "Initial triage completed. Correlated with production telemetry events.",
            date: issue.firstSeen,
        },
    ]);

    const activeEvent = issue.events.find((e) => e.id === selectedEventId) || issue.events[0];
    const envName = activeEvent?.environment?.name || "Production";

    // Extract unique affected services and environments
    const affectedServices = Array.from(
        new Set(issue.events.map((e) => e.service || "web-client"))
    );
    const affectedEnvs = Array.from(
        new Set(issue.events.map((e) => e.environment?.name || "production"))
    );
    const affectedReleases = Array.from(
        new Set(issue.events.map((e) => e.release).filter(Boolean))
    );

    function handleAddComment(e: React.FormEvent) {
        e.preventDefault();
        if (!commentText.trim()) return;
        setComments([
            ...comments,
            { id: `c-${Date.now()}`, text: commentText.trim(), date: new Date() },
        ]);
        setCommentText("");
    }

    function copyStackTrace() {
        const text = activeEvent?.stack || `Error: ${issue.title}`;
        navigator.clipboard.writeText(text);
        setCopiedStack(true);
        setTimeout(() => setCopiedStack(false), 2000);
    }

    return (
        <div className="space-y-6 pb-16">
            {/* Header & Back Navigation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
                <div className="space-y-2">
                    <BackButton fallbackHref={`/projects/${issue.projectId}/issues`} label="Back to Issues" />

                    <div className="flex items-center gap-2.5 flex-wrap pt-1">
                        <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
                            status === "RESOLVED"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                : status === "IGNORED"
                                ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                                : "bg-red-500/10 text-red-400 border-red-500/20"
                        }`}>
                            {status}
                        </span>
                        <span className="halo-severity halo-severity-fatal">
                            {issue.severity}
                        </span>
                        <span className="text-xs font-mono text-zinc-500">
                            Fingerprint: <code className="text-zinc-300">{issue.fingerprint || issue.id.slice(0, 12)}</code>
                        </span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                        {issue.title}
                    </h1>

                    <div className="flex items-center gap-3 text-xs font-mono text-secondary flex-wrap">
                        <span>First seen: {formatDeterministicDate(issue.firstSeen)}</span>
                        <span className="text-zinc-600">•</span>
                        <span>Last seen: <RelativeTime date={issue.lastSeen} /></span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-white font-bold">{issue.eventCount} total occurrences</span>
                    </div>
                </div>

                {/* Top Action Bar */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setStatus(status === "RESOLVED" ? "OPEN" : "RESOLVED")}
                        className={`halo-btn halo-btn-sm ${
                            status === "RESOLVED" ? "halo-btn-secondary" : "halo-btn-primary"
                        }`}
                    >
                        <Check size={14} />
                        <span>{status === "RESOLVED" ? "Reopen" : "Resolve"}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setStatus(status === "IGNORED" ? "OPEN" : "IGNORED")}
                        className="halo-btn halo-btn-sm halo-btn-secondary"
                    >
                        <Archive size={14} />
                        <span>{status === "IGNORED" ? "Unignore" : "Ignore"}</span>
                    </button>

                    <Link
                        href={`/projects/${issue.projectId}/investigations/new?issueId=${issue.id}${activeEvent ? `&eventId=${activeEvent.id}` : ""}`}
                        className="halo-btn halo-btn-sm halo-btn-primary flex items-center gap-1.5 shadow-lg shadow-accent/20"
                    >
                        <Sparkles size={14} />
                        <span>Investigate Occurrence</span>
                    </Link>
                </div>
            </div>

            {/* Quick Aggregate Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Total Occurrences</span>
                    <span className="text-base font-bold text-white block">{issue.eventCount}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Affected Services</span>
                    <span className="text-accent font-bold truncate block">
                        {affectedServices.join(", ") || "web-client"}
                    </span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Environments</span>
                    <span className="text-zinc-300 truncate block">
                        {affectedEnvs.join(", ") || "production"}
                    </span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase block font-sans">Releases Affected</span>
                    <span className="text-indigo-400 truncate block">
                        {affectedReleases.length > 0 ? affectedReleases.join(", ") : "Unspecified"}
                    </span>
                </div>
            </div>

            {/* Main Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
                {/* Left Column: Occurrences & Stack Trace */}
                <div className="space-y-6 min-w-0">
                    {/* Occurrences / Representative Events Table */}
                    <div className="p-5 rounded-xl bg-[#080b11] border border-border space-y-4">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div className="flex items-center gap-2">
                                <History className="w-4 h-4 text-accent" />
                                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                                    Captured Occurrences ({issue.events.length})
                                </h3>
                            </div>
                            <span className="text-[11px] font-mono text-zinc-400">
                                Select occurrence to investigate
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse font-mono">
                                <thead>
                                    <tr className="border-b border-white/10 text-muted uppercase text-[10px]">
                                        <th className="py-2.5 px-3">Occurrence Time</th>
                                        <th className="py-2.5 px-3">Service</th>
                                        <th className="py-2.5 px-3">Environment</th>
                                        <th className="py-2.5 px-3">Trace ID</th>
                                        <th className="py-2.5 px-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {issue.events.map((ev) => {
                                        const isSelected = activeEvent?.id === ev.id;

                                        return (
                                            <tr
                                                key={ev.id}
                                                onClick={() => setSelectedEventId(ev.id)}
                                                className={`cursor-pointer transition-colors ${
                                                    isSelected
                                                        ? "bg-accent/15 text-white"
                                                        : "hover:bg-surface/50 text-zinc-300"
                                                }`}
                                            >
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                    <span className="font-semibold">{formatDeterministicTime(ev.timestamp)}</span>
                                                    <span className="text-[10px] text-zinc-500 ml-2">
                                                        ({formatDeterministicDate(ev.timestamp)})
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-accent truncate">
                                                    {ev.service || "web-client"}
                                                </td>
                                                <td className="py-2.5 px-3 text-zinc-400">
                                                    {ev.environment?.name || "production"}
                                                </td>
                                                <td className="py-2.5 px-3 text-zinc-500 truncate max-w-[120px]">
                                                    {ev.traceId ? `${ev.traceId.slice(0, 10)}…` : "—"}
                                                </td>
                                                <td className="py-2.5 px-3 text-right">
                                                    <Link
                                                        href={`/projects/${issue.projectId}/investigations/new?issueId=${issue.id}&eventId=${ev.id}`}
                                                        className="px-2.5 py-1 rounded bg-accent/20 hover:bg-accent text-white border border-accent text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                                                    >
                                                        <Sparkles size={11} />
                                                        <span>Investigate</span>
                                                    </Link>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Stack Trace for Selected Occurrence */}
                    <div className="p-5 rounded-xl bg-surface border border-border space-y-4">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                                    Occurrence Stack Trace
                                </h3>
                                <p className="text-[11px] text-zinc-400 font-mono mt-0.5">
                                    Event ID: <code className="text-accent">{activeEvent?.id}</code>
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={copyStackTrace}
                                className="halo-btn halo-btn-xs halo-btn-secondary"
                            >
                                {copiedStack ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                <span>{copiedStack ? "Copied" : "Copy Stack"}</span>
                            </button>
                        </div>

                        {activeEvent?.stack ? (
                            <pre className="p-4 rounded-xl bg-[#080b11] border border-white/10 font-mono text-xs text-red-300 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                                {activeEvent.stack}
                            </pre>
                        ) : (
                            <div className="p-4 rounded-xl bg-[#080b11] border border-white/10 font-mono text-xs text-zinc-400 space-y-1">
                                <div className="text-white font-bold">Error: {issue.title}</div>
                                <div>&nbsp;&nbsp;at handleCheckout (app/api/checkout/route.ts:48:19)</div>
                                <div>&nbsp;&nbsp;at processTicksAndRejections (node:internal/process/task_queues:95:5)</div>
                            </div>
                        )}

                        {/* Git Provider Inline Link */}
                        <div className="p-3.5 rounded-xl border border-accent/20 bg-accent/5 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <GitBranch className="text-accent shrink-0" size={16} />
                                <div className="text-xs">
                                    <p className="font-semibold text-white">Connect Git Provider</p>
                                    <p className="text-secondary text-[11px]">Link GitHub or GitLab to see source code inline with stack traces.</p>
                                </div>
                            </div>
                            <Link href={`/projects/${issue.projectId}/settings`} className="halo-btn halo-btn-xs halo-btn-secondary shrink-0">
                                Connect Git
                            </Link>
                        </div>
                    </div>

                    {/* Session Replay */}
                    {replaySession ? (
                        <div className="p-5 rounded-xl bg-surface border border-border space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                                Correlated User Session Replay
                            </h3>
                            <ReplayPlayerClient
                                replaySession={replaySession}
                                issueTitle={issue.title}
                            />
                        </div>
                    ) : (
                        <ReplayStatus status="NO_REPLAY" projectId={issue.projectId} />
                    )}
                </div>

                {/* Right Column: Investigation Launchpad & Metadata */}
                <div className="space-y-6">
                    {/* Launchpad Card */}
                    <div className="p-5 rounded-xl bg-accent/10 border border-accent/30 space-y-4">
                        <div className="flex items-center gap-2 text-accent font-bold text-sm">
                            <Sparkles size={16} />
                            <span>Halo Causal Investigation</span>
                        </div>
                        <p className="text-xs text-secondary leading-relaxed">
                            Evaluate active telemetry, stack frames, upstream requests, and Git regressions to pinpoint the exact root cause.
                        </p>
                        <Link
                            href={`/projects/${issue.projectId}/investigations/new?issueId=${issue.id}${activeEvent ? `&eventId=${activeEvent.id}` : ""}`}
                            className="halo-btn halo-btn-primary w-full justify-center shadow-lg shadow-accent/20"
                        >
                            <Sparkles size={14} />
                            <span>Investigate Issue</span>
                        </Link>
                    </div>

                    {/* Issue Metadata Drawer */}
                    <div className="p-5 rounded-xl bg-surface border border-border space-y-4 text-xs font-mono">
                        <h3 className="font-bold uppercase tracking-wider text-zinc-400 border-b border-border pb-2">
                            Overview Metadata
                        </h3>

                        <div className="space-y-3">
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase block font-sans">First Occurrence</span>
                                <span className="text-white font-semibold">{formatDeterministicDateTime(issue.firstSeen)}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase block font-sans">Last Occurrence</span>
                                <span className="text-white font-semibold">{formatDeterministicDateTime(issue.lastSeen)}</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase block font-sans mb-1">Triage Assignee</span>
                                <HaloSelect
                                    value={assignee}
                                    onChange={(val) => setAssignee(val)}
                                    className="w-full"
                                    options={[
                                        { value: "Unassigned", label: "Unassigned" },
                                        { value: "Sanjeev (Me)", label: "Sanjeev (Me)" },
                                        { value: "Backend Team", label: "Backend Team" },
                                        { value: "Frontend Team", label: "Frontend Team" },
                                    ]}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Activity Stream / Comments */}
                    <div className="p-5 rounded-xl bg-surface border border-border space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-border pb-2">
                            Activity Stream & Notes
                        </h3>

                        <div className="space-y-2.5 text-xs">
                            {comments.map((c) => (
                                <div key={c.id} className="p-2.5 rounded-xl bg-[#080b11] border border-white/5 space-y-1">
                                    <p className="text-zinc-200 leading-relaxed text-xs">{c.text}</p>
                                    <p className="text-[10px] font-mono text-muted"><RelativeTime date={c.date} /></p>
                                </div>
                            ))}
                        </div>

                        <form onSubmit={handleAddComment} className="space-y-2 pt-2 border-t border-border">
                            <input
                                type="text"
                                placeholder="Add team note..."
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-[#080b11] border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-accent"
                            />
                            <button type="submit" className="halo-btn halo-btn-xs halo-btn-secondary w-full justify-center">
                                <Send size={11} /> Post Note
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
