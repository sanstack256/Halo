import { getAlertById } from "@/actions/alert";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
    Activity,
    ArrowLeft,
    Bell,
    BellRing,
    CheckCheck,
    Clock,
    Globe,
    Mail,
    Radio,
    ShieldAlert,
    ShieldCheck,
    Smartphone,
    Webhook,
    Zap,
} from "lucide-react";
import { RelativeTime } from "@/components/ui/relative-time";
import { formatDeterministicDateTime } from "@/lib/date-format";
import { AlertDetailActions } from "@/components/alerts/alert-detail-actions";
import type { MonitorType, NotificationChannel, NotificationOutcome } from "@/generated/prisma/client";
import {
    MONITOR_TYPE_DEFINITIONS,
    getMonitorTypeDefinition,
} from "@/lib/monitors/definitions";

const TYPE_CONFIG: Record<MonitorType, { label: string; icon: any; colorClass: string }> = {
    ERROR: { label: MONITOR_TYPE_DEFINITIONS.ERROR.shortLabel, icon: MONITOR_TYPE_DEFINITIONS.ERROR.icon, colorClass: MONITOR_TYPE_DEFINITIONS.ERROR.colorClass },
    METRIC: { label: MONITOR_TYPE_DEFINITIONS.METRIC.shortLabel, icon: MONITOR_TYPE_DEFINITIONS.METRIC.icon, colorClass: MONITOR_TYPE_DEFINITIONS.METRIC.colorClass },
    CRON: { label: MONITOR_TYPE_DEFINITIONS.CRON.shortLabel, icon: MONITOR_TYPE_DEFINITIONS.CRON.icon, colorClass: MONITOR_TYPE_DEFINITIONS.CRON.colorClass },
    UPTIME: { label: MONITOR_TYPE_DEFINITIONS.UPTIME.shortLabel, icon: MONITOR_TYPE_DEFINITIONS.UPTIME.icon, colorClass: MONITOR_TYPE_DEFINITIONS.UPTIME.colorClass },
    MOBILE_BUILD: { label: MONITOR_TYPE_DEFINITIONS.MOBILE_BUILD.shortLabel, icon: MONITOR_TYPE_DEFINITIONS.MOBILE_BUILD.icon, colorClass: MONITOR_TYPE_DEFINITIONS.MOBILE_BUILD.colorClass },
};

const STATUS_CONFIG = {
    OPEN: { label: "Open", dot: "bg-red-400", badge: "text-red-400 bg-red-500/10 border border-red-500/20" },
    ACKNOWLEDGED: { label: "Acknowledged", dot: "bg-amber-400", badge: "text-amber-400 bg-amber-500/10 border border-amber-500/20" },
    RESOLVED: { label: "Resolved", dot: "bg-emerald-400", badge: "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" },
};

const CHANNEL_ICON: Record<NotificationChannel, any> = {
    EMAIL: Mail,
    WEBHOOK: Webhook,
    IN_APP: Bell,
};

const OUTCOME_CONFIG: Record<NotificationOutcome, { label: string; color: string }> = {
    PENDING: { label: "Pending", color: "text-[var(--text-muted)]" },
    DELIVERED: { label: "Delivered", color: "text-emerald-400" },
    FAILED: { label: "Failed", color: "text-red-400" },
    SKIPPED: { label: "Skipped", color: "text-[var(--text-muted)]" },
};

interface AlertDetailPageProps {
    params: Promise<{ id: string }>;
}

export default async function AlertDetailPage({ params }: AlertDetailPageProps) {
    const { id } = await params;
    const { alert, notifications } = await getAlertById(id);

    if (!alert) return notFound();

    const statusCfg = STATUS_CONFIG[alert.status];
    const typeCfg = TYPE_CONFIG[alert.monitorType as MonitorType] ?? TYPE_CONFIG.ERROR;
    const TypeIcon = typeCfg.icon;

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Breadcrumb / back */}
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] flex-wrap">
                <Link href="/monitors/alerts" className="flex items-center gap-1 hover:text-white transition-colors">
                    <ArrowLeft size={12} />
                    Alert Rules
                </Link>
                <span>/</span>
                <Link href={`/monitors/${alert.monitorId}`} className="hover:text-white transition-colors">
                    {alert.monitorName}
                </Link>
                <span>/</span>
                <span className="text-white font-mono">{alert.id.slice(0, 12)}</span>
            </div>

            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
                <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                            {statusCfg.label}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${typeCfg.colorClass}`}>
                            <TypeIcon size={10} />
                            {typeCfg.label}
                        </span>
                    </div>
                    <h1 className="text-xl font-semibold text-white tracking-tight">{alert.monitorName}</h1>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">{alert.conditionSummary}</p>
                </div>

                <AlertDetailActions alert={alert} />
            </div>

            {/* Automated Investigation Diagnostic Panel */}
            <div className="p-4 rounded-xl border border-[var(--border)] bg-gradient-to-r from-[var(--surface-elevated)] to-[var(--surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Zap size={14} className="text-[var(--accent)]" />
                        <span className="text-white font-semibold">Autonomous Diagnostic &amp; Investigation Engine</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] font-sans">
                        {alert.investigation
                            ? alert.investigation.rootCause
                                ? `Root Cause Verdict: ${alert.investigation.rootCause}`
                                : `Automated investigation completed (${alert.investigation.status})`
                            : "Run multi-dimensional causal analysis on correlated events, traces, and releases around this trigger."}
                    </p>
                </div>
                <Link
                    href={`/projects/${alert.projectId}/investigations/new?monitorId=${alert.monitorId}&alertId=${alert.id}`}
                    className="halo-btn halo-btn-primary halo-btn-sm shrink-0"
                >
                    <Zap size={12} />
                    <span>{alert.investigation ? "View Investigation Report" : "Launch Full Investigation"}</span>
                </Link>
            </div>

            {/* Metadata grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                    {
                        label: "Triggered",
                        value: <RelativeTime date={alert.triggeredAt} />,
                        sub: formatDeterministicDateTime(alert.triggeredAt),
                    },
                    alert.acknowledgedAt && {
                        label: "Acknowledged",
                        value: <RelativeTime date={alert.acknowledgedAt} />,
                        sub: formatDeterministicDateTime(alert.acknowledgedAt),
                    },
                    alert.resolvedAt && {
                        label: "Resolved",
                        value: <RelativeTime date={alert.resolvedAt} />,
                        sub: formatDeterministicDateTime(alert.resolvedAt),
                    },
                    {
                        label: "Project",
                        value: <span className="text-white">{alert.projectName}</span>,
                        sub: null,
                    },
                    alert.observedValue != null && {
                        label: "Observed Value",
                        value: <span className="text-red-400 font-mono font-semibold">{alert.observedValue}</span>,
                        sub: alert.thresholdValue != null ? `Threshold: ${alert.thresholdValue}` : null,
                    },
                    {
                        label: "Notifications",
                        value: (
                            <span className="font-mono text-white">
                                {alert.deliveredCount}/{alert.notificationCount} delivered
                            </span>
                        ),
                        sub: alert.failedCount > 0 ? `${alert.failedCount} failed` : null,
                    },
                ]
                    .filter(Boolean)
                    .map((item: any, idx) => (
                        <div
                            key={idx}
                            className="p-3 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] space-y-1"
                        >
                            <div className="text-xs text-[var(--text-muted)]">{item.label}</div>
                            <div className="text-sm font-medium">{item.value}</div>
                            {item.sub && <div className="text-xs text-[var(--text-muted)]">{item.sub}</div>}
                        </div>
                    ))}
            </div>

            {/* Monitor link */}
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] flex items-center justify-between">
                <div>
                    <div className="text-xs text-[var(--text-muted)] mb-0.5">Source Monitor</div>
                    <Link
                        href={`/monitors/${alert.monitorId}`}
                        className="text-sm font-medium text-[var(--accent)] hover:underline"
                    >
                        {alert.monitorName}
                    </Link>
                </div>
                <Link
                    href={`/monitors/${alert.monitorId}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:text-white hover:border-white/30 transition-colors"
                >
                    View Monitor
                    <ShieldAlert size={12} />
                </Link>
            </div>

            {/* Operator notes */}
            {alert.notes && (
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]">
                    <div className="text-xs text-[var(--text-muted)] mb-2">Notes</div>
                    <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{alert.notes}</p>
                </div>
            )}

            {/* Notification log */}
            <div>
                <h2 className="text-sm font-semibold text-white mb-3">Notification Log</h2>
                {notifications.length === 0 ? (
                    <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] text-center">
                        <Bell size={18} className="text-[var(--text-muted)] mx-auto mb-2" />
                        <p className="text-xs text-[var(--text-muted)]">No notifications dispatched for this alert.</p>
                    </div>
                ) : (
                    <div className="border border-[var(--border)] rounded-xl overflow-hidden">
                        <table className="w-full text-xs font-mono">
                            <thead>
                                <tr className="border-b border-[var(--border)] bg-[var(--surface-elevated)]">
                                    <th className="text-left px-4 py-2.5 text-[var(--text-muted)] font-medium">Channel</th>
                                    <th className="text-left px-4 py-2.5 text-[var(--text-muted)] font-medium">Destination</th>
                                    <th className="text-left px-4 py-2.5 text-[var(--text-muted)] font-medium">Outcome</th>
                                    <th className="text-left px-4 py-2.5 text-[var(--text-muted)] font-medium">Attempted</th>
                                    <th className="text-left px-4 py-2.5 text-[var(--text-muted)] font-medium">Failure Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                {notifications.map((n) => {
                                    const ChannelIcon = CHANNEL_ICON[n.channel] ?? Bell;
                                    const outcomeCfg = OUTCOME_CONFIG[n.outcome];
                                    return (
                                        <tr key={n.id} className="border-b border-[var(--border)]/60">
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
                                                    <ChannelIcon size={12} />
                                                    {n.channel}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-[var(--text-secondary)]">
                                                {n.destination ?? <span className="text-[var(--text-muted)]">—</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={outcomeCfg.color}>{outcomeCfg.label}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <RelativeTime date={n.attemptedAt} />
                                            </td>
                                            <td className="px-4 py-3 text-red-400">
                                                {n.failReason ?? <span className="text-[var(--text-muted)]">—</span>}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
