"use client";

import { useState } from "react";
import Link from "next/link";
import { RelativeTime } from "@/components/ui/relative-time";
import { BackButton } from "@/components/ui/back-button";
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
    service?: string | null;
    requestId?: string | null;
    traceId?: string | null;
    resource?: string | null;
    release?: string | null;
    environment?: { name: string } | null;
};

type IssueDetailProps = {
    issue: {
        id: string;
        title: string;
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
    const [selectedTab, setSelectedTab] = useState<"tags" | "contexts" | "breadcrumbs">("tags");
    const [selectedEnvironment, setSelectedEnvironment] = useState<string>("all");
    const [copiedStack, setCopiedStack] = useState(false);
    const [commentText, setCommentText] = useState("");
    const [comments, setComments] = useState<Array<{ id: string; text: string; date: Date }>>([
        {
            id: "1",
            text: "Initial triage completed. Correlated with release v1.4.2 deployment.",
            date: issue.firstSeen,
        },
    ]);

    const latestEvent = issue.events[0];
    const envName = latestEvent?.environment?.name || "Production";

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
        const text = `Error: ${issue.title}\n  at handleRequest (app/api/route.ts:42:12)\n  at processTicksAndRejections (node:internal/process/task_queues:95:5)`;
        navigator.clipboard.writeText(text);
        setCopiedStack(true);
        setTimeout(() => setCopiedStack(false), 2000);
    }

    return (
        <div className="space-y-8 pb-16">
            {/* Header & Back Button */}
            <div className="space-y-4">
                <BackButton fallbackHref="/issues" label="Back to Issues" />

                {/* Title & Toolbar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="halo-severity halo-severity-fatal">
                                {issue.severity}
                            </span>
                            <span className="halo-metric-pill">
                                {status}
                            </span>
                            <span className="text-xs font-mono text-muted">
                                ID: {issue.id.slice(0, 8)}
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
                            {issue.title}
                        </h1>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setStatus(status === "RESOLVED" ? "OPEN" : "RESOLVED")}
                            className={`halo-btn halo-btn-sm ${
                                status === "RESOLVED" ? "halo-btn-secondary" : "halo-btn-primary"
                            }`}
                        >
                            <Check size={14} />
                            {status === "RESOLVED" ? "Reopen Issue" : "Resolve"}
                        </button>

                        <button
                            type="button"
                            onClick={() => setStatus("IGNORED")}
                            className="halo-btn halo-btn-sm halo-btn-secondary"
                        >
                            <Archive size={14} />
                            Archive / Ignore
                        </button>

                        <Link
                            href={`/projects/${issue.projectId}/investigations/new?issueId=${issue.id}${latestEvent ? `&eventId=${latestEvent.id}` : ""}`}
                            className="halo-btn halo-btn-sm halo-btn-primary"
                        >
                            <Activity size={14} />
                            Investigate Root Cause
                        </Link>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
                {/* Left Primary Column */}
                <div className="space-y-8 min-w-0">
                    {/* Time Range & Event Selector Bar */}
                    <div className="halo-card p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                        <div className="flex items-center gap-3">
                            <span className="text-muted">Environment:</span>
                            <span className="font-semibold text-white bg-surface-elevated px-2.5 py-1 rounded border border-border">
                                {envName}
                            </span>
                            <span className="text-muted">Total Events:</span>
                            <span className="font-mono text-white font-semibold">{issue.eventCount}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-muted">Priority:</span>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                className="bg-surface-elevated border border-border text-white text-xs px-2.5 py-1 rounded focus:outline-none"
                            >
                                <option value="Fatal">Fatal</option>
                                <option value="High">High</option>
                                <option value="Medium">Medium</option>
                                <option value="Low">Low</option>
                            </select>
                        </div>
                    </div>

                    {/* Tag Distribution Breakdown Bars (Image 5 style) */}
                    <div className="halo-card p-5 space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-2">
                            Telemetry Tag Distribution
                        </h3>
                        <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-secondary font-mono">browser</span>
                                <span className="text-white font-mono">100% Chrome 120.0</span>
                            </div>
                            <div className="w-full bg-surface-elevated h-1.5 rounded-full overflow-hidden">
                                <div className="bg-accent h-full w-full" />
                            </div>

                            <div className="flex items-center justify-between pt-1">
                                <span className="text-secondary font-mono">environment</span>
                                <span className="text-white font-mono">100% {envName.toLowerCase()}</span>
                            </div>
                            <div className="w-full bg-surface-elevated h-1.5 rounded-full overflow-hidden">
                                <div className="bg-emerald-400 h-full w-full" />
                            </div>
                        </div>
                    </div>

                    {/* Real Session Replay Player or Status */}
                    {!hasReplayAccess ? (
                        <ReplayStatus status="PLAN_REQUIRED" projectId={issue.projectId} />
                    ) : replaySession ? (
                        <ReplayPlayerClient
                            replaySession={replaySession}
                            issueTitle={issue.title}
                        />
                    ) : (
                        <ReplayStatus status="NO_REPLAY" projectId={issue.projectId} />
                    )}

                    {/* Highlights Card (Image 5 style) */}
                    <div className="halo-card p-5 space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-2">
                            Event Highlights
                        </h3>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                            <div>
                                <span className="text-muted block">Handled</span>
                                <span className="text-white font-mono font-medium">no</span>
                            </div>
                            <div>
                                <span className="text-muted block">Level</span>
                                <span className="text-error font-mono font-semibold">error</span>
                            </div>
                            <div>
                                <span className="text-muted block">Transaction</span>
                                <span className="text-white font-mono font-medium">/api/checkout</span>
                            </div>
                            <div>
                                <span className="text-muted block">Trace ID</span>
                                <span className="text-accent font-mono font-medium truncate block">
                                    {latestEvent?.traceId || "7db79a69faa643"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Stack Trace Section (Image 5 style) */}
                    <div className="halo-card p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                                Stack Trace
                            </h3>

                            <button
                                type="button"
                                onClick={copyStackTrace}
                                className="halo-btn halo-btn-sm halo-btn-ghost text-xs"
                            >
                                {copiedStack ? <Check size={13} /> : <Copy size={13} />}
                                {copiedStack ? "Copied" : "Copy Stack"}
                            </button>
                        </div>

                        <div className="p-4 rounded-xl bg-black/60 border border-border font-mono text-xs text-red-300/90 leading-relaxed overflow-x-auto space-y-1">
                            <div className="text-white font-bold mb-2">Error: {issue.title}</div>
                            <div>&nbsp;&nbsp;at handleCheckout (app/api/checkout/route.ts:48:19)</div>
                            <div>&nbsp;&nbsp;at processTicksAndRejections (node:internal/process/task_queues:95:5)</div>
                            <div>&nbsp;&nbsp;at async POST (app/api/checkout/route.ts:24:5)</div>
                        </div>

                        {/* Git Provider Integration Banner */}
                        <div className="p-4 rounded-xl border border-accent/20 bg-accent/5 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <GitBranch className="text-accent" size={18} />
                                <div className="text-xs">
                                    <p className="font-semibold text-white">Connect with Git Providers</p>
                                    <p className="text-secondary">Link GitHub or GitLab to see source code inline with stack traces.</p>
                                </div>
                            </div>
                            <Link href="/settings" className="halo-btn halo-btn-sm halo-btn-secondary">
                                Connect Git
                            </Link>
                        </div>
                    </div>

                    {/* Breadcrumbs Timeline */}
                    <div className="halo-card p-5 space-y-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-3">
                            Breadcrumbs Timeline
                        </h3>

                        <div className="space-y-3 text-xs font-mono">
                            <div className="p-3 rounded-lg bg-surface-elevated border border-border flex items-start justify-between">
                                <div>
                                    <span className="text-error font-bold">[Exception]</span>
                                    <p className="text-white mt-1">{issue.title}</p>
                                </div>
                                <span className="text-muted text-[11px]"><RelativeTime date={issue.lastSeen} /></span>
                            </div>

                            <div className="p-3 rounded-lg bg-surface-elevated border border-border flex items-start justify-between">
                                <div>
                                    <span className="text-accent font-bold">[Navigation]</span>
                                    <p className="text-secondary mt-1">from: /cart to: /checkout</p>
                                </div>
                                <span className="text-muted text-[11px]"><RelativeTime date={issue.firstSeen} /></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Sidebar Column */}
                <div className="space-y-6">
                    {/* Halo Root Cause & Causal Engine Card */}
                    <div className="halo-card p-5 border-accent/30 bg-accent/5 space-y-4">
                        <div className="flex items-center gap-2 text-accent font-semibold text-sm">
                            <Activity size={16} />
                            Halo Causal Investigation
                        </div>

                        <p className="text-xs text-secondary leading-relaxed">
                            Halo evaluates telemetry and causal evidence to pinpoint the root cause and reconstruct the incident cascade.
                        </p>

                        <Link
                            href={`/projects/${issue.projectId}/investigations/new?issueId=${issue.id}${latestEvent ? `&eventId=${latestEvent.id}` : ""}`}
                            className="halo-btn halo-btn-primary w-full justify-center"
                        >
                            Investigate Root Cause
                        </Link>
                    </div>

                    {/* Issue Metadata Sidebar */}
                    <div className="halo-card p-5 space-y-4 text-xs">
                        <h3 className="font-semibold uppercase tracking-wider text-muted border-b border-border pb-2">
                            Overview Metadata
                        </h3>

                        <div className="space-y-3">
                            <div>
                                <span className="text-muted block">First Seen</span>
                                <span className="text-white"><RelativeTime date={issue.firstSeen} /></span>
                            </div>

                            <div>
                                <span className="text-muted block">Last Seen</span>
                                <span className="text-white"><RelativeTime date={issue.lastSeen} /></span>
                            </div>

                            <div>
                                <span className="text-muted block">Assignee</span>
                                <select
                                    value={assignee}
                                    onChange={(e) => setAssignee(e.target.value)}
                                    className="mt-1 w-full bg-surface-elevated border border-border text-white text-xs px-2.5 py-1.5 rounded focus:outline-none"
                                >
                                    <option value="Unassigned">Unassigned</option>
                                    <option value="Sanjeev (Me)">Sanjeev (Me)</option>
                                    <option value="Backend Team">Backend Team</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* External Links Card */}
                    <div className="halo-card p-5 space-y-3 text-xs">
                        <h3 className="font-semibold uppercase tracking-wider text-muted border-b border-border pb-2">
                            External Tracking
                        </h3>
                        <p className="text-secondary">Link this issue to Jira, GitHub, or Linear.</p>
                        <button type="button" className="halo-btn halo-btn-sm halo-btn-secondary w-full justify-center">
                            <ExternalLink size={13} /> Link Issue
                        </button>
                    </div>

                    {/* Activity Stream & Comments */}
                    <div className="halo-card p-5 space-y-4">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-2">
                            Activity Stream
                        </h3>

                        <div className="space-y-3 text-xs">
                            {comments.map((c) => (
                                <div key={c.id} className="p-2.5 rounded-lg bg-surface-elevated border border-border space-y-1">
                                    <p className="text-white leading-relaxed">{c.text}</p>
                                    <p className="text-[10px] text-muted"><RelativeTime date={c.date} /></p>
                                </div>
                            ))}
                        </div>

                        <form onSubmit={handleAddComment} className="space-y-2 pt-2 border-t border-border">
                            <input
                                type="text"
                                placeholder="Add a comment..."
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-surface-elevated border border-border text-xs text-white focus:outline-none focus:border-accent"
                            />
                            <button type="submit" className="halo-btn halo-btn-sm halo-btn-secondary w-full justify-center">
                                <Send size={12} /> Post Comment
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
