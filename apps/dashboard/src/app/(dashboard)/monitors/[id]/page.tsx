import { getMonitorById } from "@/actions/monitor";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
    Activity,
    ArrowLeft,
    ArrowUpRight,
    BellRing,
    CheckCircle2,
    Clock,
    FolderKanban,
    Globe,
    Radio,
    ShieldAlert,
    Smartphone,
    Sparkles,
    Trash2,
    Volume2,
    VolumeX,
} from "lucide-react";
import { RelativeTime } from "@/components/ui/relative-time";
import { formatDeterministicDateTime, formatDeterministicDate } from "@/lib/date-format";

interface MonitorDetailPageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function MonitorDetailPage({ params }: MonitorDetailPageProps) {
    const { id } = await params;
    const monitor = await getMonitorById(id);

    if (!monitor) {
        notFound();
    }

    return (
        <div className="space-y-8 pb-16">
            {/* Navigation & Header */}
            <div>
                <Link
                    href="/monitors"
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white mb-4 transition-colors font-mono"
                >
                    <ArrowLeft size={13} />
                    <span>Back to All Monitors</span>
                </Link>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-bold text-white tracking-tight font-sans">
                                {monitor.name}
                            </h1>
                            <span className="px-2 py-0.5 rounded-md border border-white/10 bg-white/5 text-xs font-mono text-zinc-300">
                                {monitor.type}
                            </span>
                        </div>
                        {monitor.description && (
                            <p className="text-xs text-zinc-400 font-sans max-w-2xl">
                                {monitor.description}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-2.5">
                        <Link
                            href={`/monitors/${monitor.id}/edit`}
                            className="halo-btn halo-btn-secondary halo-btn-sm"
                        >
                            <span>Edit Monitor</span>
                        </Link>

                        <Link
                            href={`/projects/${monitor.projectId}/investigations/new`}
                            className="halo-btn halo-btn-primary halo-btn-sm"
                        >
                            <Sparkles size={13} />
                            <span>Launch Investigation</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Overview Key Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                        Current Health
                    </span>
                    <div>
                        {monitor.status === "FIRING" && (
                            <span className="halo-monitor-state-firing text-sm">
                                <span className="halo-monitor-pulse animate-ping" /> FIRING
                            </span>
                        )}
                        {monitor.status === "HEALTHY" && (
                            <span className="halo-monitor-state-healthy text-sm">
                                <span className="halo-monitor-pulse" /> HEALTHY
                            </span>
                        )}
                        {monitor.status === "MUTED" && (
                            <span className="halo-monitor-state-muted text-sm">
                                <span className="halo-monitor-pulse" /> MUTED
                            </span>
                        )}
                        {monitor.status === "DISABLED" && (
                            <span className="halo-monitor-state-disabled text-sm">
                                <span className="halo-monitor-pulse" /> DISABLED
                            </span>
                        )}
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                        Project Scope
                    </span>
                    <Link
                        href={`/projects/${monitor.projectId}`}
                        className="text-xs font-mono text-accent hover:underline flex items-center gap-1 mt-0.5 truncate"
                    >
                        <FolderKanban size={13} />
                        <span className="truncate">{monitor.projectName}</span>
                    </Link>
                </div>

                <div className="p-4 rounded-2xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                        Alert Severity
                    </span>
                    <span className={`halo-severity halo-severity-${monitor.severity.toLowerCase()} mt-0.5 inline-block`}>
                        {monitor.severity}
                    </span>
                </div>

                <div className="p-4 rounded-2xl bg-surface border border-border space-y-1">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                        Last Evaluated
                    </span>
                    <span className="text-xs font-mono text-white block mt-0.5">
                        {monitor.lastEvaluatedAt ? (
                            <RelativeTime date={monitor.lastEvaluatedAt} />
                        ) : (
                            "—"
                        )}
                    </span>
                </div>
            </div>

            {/* Configuration Details Panel */}
            <div className="p-6 rounded-2xl bg-surface border border-border space-y-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-sans border-b border-border pb-3">
                    Monitor Rules & Threshold Configuration
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-mono">
                    <div className="space-y-4">
                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase block mb-1">
                                Evaluation Target
                            </span>
                            <span className="text-white font-semibold">
                                {monitor.type === "ERROR" && "Error frequency threshold in rolling window"}
                                {monitor.type === "METRIC" && "Metric and latency anomaly detection"}
                                {monitor.type === "CRON" && "Scheduled heartbeat execution"}
                                {monitor.type === "UPTIME" && "Synthetic HTTP endpoint probe"}
                                {monitor.type === "MOBILE_BUILD" && "Release stability & crash-free target"}
                            </span>
                        </div>

                        {monitor.thresholdValue !== null && (
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase block mb-1">
                                    Trigger Threshold
                                </span>
                                <span className="text-accent font-bold">
                                    &gt;= {monitor.thresholdValue}{" "}
                                    {monitor.type === "METRIC" ? "ms" : monitor.type === "MOBILE_BUILD" ? "%" : "events"}
                                </span>
                            </div>
                        )}

                        {monitor.thresholdWindow !== null && (
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase block mb-1">
                                    Rolling Time Window
                                </span>
                                <span className="text-white">
                                    {monitor.thresholdWindow} minutes
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        {monitor.query && (
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase block mb-1">
                                    Filter Expression / Query
                                </span>
                                <pre className="p-2.5 rounded-lg bg-[#080b11] border border-white/10 text-xs text-zinc-300 font-mono">
                                    {monitor.query}
                                </pre>
                            </div>
                        )}

                        {monitor.endpointUrl && (
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase block mb-1">
                                    Probe URL
                                </span>
                                <a
                                    href={monitor.endpointUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-accent hover:underline flex items-center gap-1.5 truncate"
                                >
                                    <Globe size={13} />
                                    <span className="truncate">{monitor.endpointUrl}</span>
                                    <ArrowUpRight size={12} />
                                </a>
                            </div>
                        )}

                        {monitor.cronSchedule && (
                            <div>
                                <span className="text-[10px] text-zinc-500 uppercase block mb-1">
                                    Cron Heartbeat Expression
                                </span>
                                <code className="px-2 py-1 rounded bg-[#080b11] border border-white/10 text-sky-400 font-mono">
                                    {monitor.cronSchedule}
                                </code>
                            </div>
                        )}

                        <div>
                            <span className="text-[10px] text-zinc-500 uppercase block mb-1">
                                Created On
                            </span>
                            <span className="text-zinc-400">
                                {formatDeterministicDateTime(monitor.createdAt)}
                                {monitor.creatorName ? ` by ${monitor.creatorName}` : ""}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
