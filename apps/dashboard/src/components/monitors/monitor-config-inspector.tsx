import React from "react";
import Link from "next/link";
import {
    Activity,
    ArrowUpRight,
    Bell,
    Clock,
    Code,
    Edit3,
    FolderKanban,
    Globe,
    Layers,
    Mail,
    Sliders,
    User,
    Webhook,
} from "lucide-react";
import { formatDeterministicDateTime } from "@/lib/date-format";
import type { MonitorFullDetails } from "@/actions/monitor";

interface MonitorConfigInspectorProps {
    data: MonitorFullDetails;
}

export function MonitorConfigInspector({ data }: MonitorConfigInspectorProps) {
    const { monitor } = data;

    // Parse alertConfig JSON if present
    const alertConfig = monitor.alertConfig as any;
    const webhookUrls: string[] = alertConfig?.webhookUrls || (alertConfig?.webhookUrl ? [alertConfig.webhookUrl] : []);
    const emailRecipients: string[] = alertConfig?.emailRecipients || (alertConfig?.email ? [alertConfig.email] : []);

    return (
        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                <div className="flex items-center gap-2">
                    <Sliders size={14} className="text-[var(--accent)]" />
                    <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                        Configuration Inspector
                    </h3>
                </div>
                <Link
                    href={`/monitors/${monitor.id}/edit`}
                    className="halo-btn halo-btn-secondary halo-btn-sm"
                >
                    <Edit3 size={12} />
                    <span>Edit Configuration</span>
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs font-mono">
                {/* 1. Evaluation & Threshold Rules */}
                <div className="space-y-3.5 p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                    <div className="text-[11px] font-semibold text-white uppercase tracking-wider border-b border-[var(--border)]/60 pb-2">
                        Threshold &amp; Evaluation
                    </div>

                    <div className="space-y-1">
                        <span className="text-[10px] text-[var(--text-muted)] uppercase block">Evaluation Mode</span>
                        <span className="text-white font-medium">
                            {monitor.type === "ERROR" && "Error & Crash Detection (Rolling Window)"}
                            {monitor.type === "METRIC" && "Performance Anomaly Threshold"}
                            {monitor.type === "CRON" && "Scheduled Job Health & Missing Heartbeat"}
                            {monitor.type === "UPTIME" && "Service Availability & Synthetic Probe"}
                            {monitor.type === "MOBILE_BUILD" && "Release Health & Stability Target"}
                        </span>
                    </div>

                    {monitor.thresholdValue !== null && (
                        <div className="space-y-1">
                            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Trigger Threshold</span>
                            <span className="text-[var(--accent)] font-bold text-sm">
                                &gt;= {monitor.thresholdValue}{" "}
                                {monitor.type === "METRIC" ? "ms" : monitor.type === "MOBILE_BUILD" ? "%" : "events"}
                            </span>
                        </div>
                    )}

                    {monitor.thresholdWindow !== null && (
                        <div className="space-y-1">
                            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Evaluation Window</span>
                            <span className="text-white">{monitor.thresholdWindow} minutes</span>
                        </div>
                    )}

                    {monitor.query && (
                        <div className="space-y-1">
                            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Filter Expression</span>
                            <code className="p-2 rounded bg-[var(--surface-elevated)] border border-[var(--border)] text-zinc-300 block text-[11px] font-mono break-all">
                                {monitor.query}
                            </code>
                        </div>
                    )}
                </div>

                {/* 2. Target & Endpoint Configuration */}
                <div className="space-y-3.5 p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                    <div className="text-[11px] font-semibold text-white uppercase tracking-wider border-b border-[var(--border)]/60 pb-2">
                        Target &amp; Scope
                    </div>

                    <div className="space-y-1">
                        <span className="text-[10px] text-[var(--text-muted)] uppercase block">Target Project</span>
                        <Link
                            href={`/projects/${monitor.projectId}`}
                            className="text-[var(--accent)] hover:underline flex items-center gap-1 font-medium"
                        >
                            <FolderKanban size={12} />
                            <span>{monitor.projectName}</span>
                        </Link>
                    </div>

                    {monitor.endpointUrl && (
                        <div className="space-y-1">
                            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Probe Endpoint</span>
                            <a
                                href={monitor.endpointUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[var(--accent)] hover:underline flex items-center gap-1.5 truncate"
                            >
                                <Globe size={12} />
                                <span className="truncate">{monitor.endpointUrl}</span>
                                <ArrowUpRight size={11} />
                            </a>
                        </div>
                    )}

                    {monitor.cronSchedule && (
                        <div className="space-y-1">
                            <span className="text-[10px] text-[var(--text-muted)] uppercase block">Cron Schedule</span>
                            <code className="px-2 py-1 rounded bg-[var(--surface-elevated)] border border-[var(--border)] text-sky-400 font-mono inline-block">
                                {monitor.cronSchedule}
                            </code>
                        </div>
                    )}

                    <div className="space-y-1">
                        <span className="text-[10px] text-[var(--text-muted)] uppercase block">Alert Severity</span>
                        <span className={`halo-severity halo-severity-${monitor.severity.toLowerCase()} inline-block`}>
                            {monitor.severity}
                        </span>
                    </div>
                </div>

                {/* 3. Notifications & Lifecycle */}
                <div className="space-y-3.5 p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                    <div className="text-[11px] font-semibold text-white uppercase tracking-wider border-b border-[var(--border)]/60 pb-2">
                        Notifications &amp; Ownership
                    </div>

                    <div className="space-y-1">
                        <span className="text-[10px] text-[var(--text-muted)] uppercase block">Notification Channels</span>
                        {webhookUrls.length === 0 && emailRecipients.length === 0 ? (
                            <span className="text-[var(--text-muted)]">In-App Alerts</span>
                        ) : (
                            <div className="space-y-1">
                                {webhookUrls.map((url, i) => (
                                    <div key={i} className="flex items-center gap-1.5 text-zinc-300 truncate">
                                        <Webhook size={11} className="text-[var(--accent)] shrink-0" />
                                        <span className="truncate">{url}</span>
                                    </div>
                                ))}
                                {emailRecipients.map((email, i) => (
                                    <div key={i} className="flex items-center gap-1.5 text-zinc-300 truncate">
                                        <Mail size={11} className="text-emerald-400 shrink-0" />
                                        <span className="truncate">{email}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-1">
                        <span className="text-[10px] text-[var(--text-muted)] uppercase block">Created By</span>
                        <div className="flex items-center gap-1.5 text-white">
                            <User size={12} className="text-[var(--text-muted)]" />
                            <span>{monitor.creatorName || "Workspace Member"}</span>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <span className="text-[10px] text-[var(--text-muted)] uppercase block">Timestamps</span>
                        <div className="text-[11px] text-[var(--text-secondary)] space-y-0.5">
                            <div>Created: {formatDeterministicDateTime(monitor.createdAt)}</div>
                            <div>Updated: {formatDeterministicDateTime(monitor.updatedAt)}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
