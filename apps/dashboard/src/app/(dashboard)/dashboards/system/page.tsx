import { getOverviewData } from "@/actions/overview";
import { Activity, CheckCircle2, ShieldAlert, Zap } from "lucide-react";
import Link from "next/link";

export default async function SystemHealthDashboardPage() {
    const data = await getOverviewData();

    const isHealthy = data.needsAttention.openIssuesCount === 0;

    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">System Health Dashboard</h1>
                <p className="halo-page-description">
                    Live operational telemetry and real-time health indicators across all connected services.
                </p>
            </div>

            {/* Health Status Banner */}
            <div className={`p-5 rounded-2xl border flex items-center justify-between ${
                isHealthy
                    ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/5 border-red-500/20 text-red-400"
            }`}>
                <div className="flex items-center gap-3">
                    {isHealthy ? (
                        <CheckCircle2 size={20} className="text-emerald-400 flex-shrink-0" />
                    ) : (
                        <ShieldAlert size={20} className="text-red-400 flex-shrink-0" />
                    )}
                    <div>
                        <h2 className="text-sm font-semibold text-white">
                            {isHealthy ? "All Systems Operational" : `${data.needsAttention.openIssuesCount} Active Issues Impacting Health`}
                        </h2>
                        <p className="text-xs text-secondary mt-0.5">
                            {isHealthy
                                ? "No critical error spikes or service degradation in the past 24 hours."
                                : `${data.needsAttention.fatalCount} fatal exceptions detected across ${data.needsAttention.criticalServiceCount} critical services.`}
                        </p>
                    </div>
                </div>

                <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                    isHealthy
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-red-500/10 border-red-500/20 text-red-400"
                }`}>
                    {isHealthy ? "Healthy" : "Degraded"}
                </span>
            </div>

            {/* Core Operational Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="halo-card p-5 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted">
                        <span>Apdex Performance</span>
                        <Zap size={14} className="text-accent" />
                    </div>
                    <div className="text-2xl font-bold text-white">{data.systemHealth.apdexScore}</div>
                    <div className="text-xs text-secondary flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${
                            data.systemHealth.apdexRating === "Satisfied"
                                ? "bg-emerald-400"
                                : data.systemHealth.apdexRating === "Tolerating"
                                  ? "bg-yellow-400"
                                  : "bg-red-400"
                        }`} />
                        {data.systemHealth.apdexRating}
                    </div>
                </div>

                <div className="halo-card p-5 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted">
                        <span>Crash-Free Rate</span>
                        <Activity size={14} className="text-accent" />
                    </div>
                    <div className="text-2xl font-bold text-white">{data.systemHealth.crashFreeRate}%</div>
                    <div className="text-xs text-secondary">Across telemetry sessions</div>
                </div>

                <div className="halo-card p-5 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted">
                        <span>24h Total Errors</span>
                        <ShieldAlert size={14} className="text-error" />
                    </div>
                    <div className="text-2xl font-bold text-white">{data.systemHealth.totalErrors24h}</div>
                    <div className="text-xs text-secondary">
                        {data.systemHealth.errorRate24h}% error rate
                    </div>
                </div>

                <div className="halo-card p-5 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted">
                        <span>Active Services</span>
                        <Activity size={14} className="text-accent" />
                    </div>
                    <div className="text-2xl font-bold text-white">{data.systemHealth.activeServiceCount}</div>
                    <div className="text-xs text-secondary">Reporting telemetry</div>
                </div>
            </div>

            {/* Service Health Breakdown */}
            <div className="halo-card p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Monitored Services ({data.serviceHealth.length})
                    </h2>
                    <Link href="/services" className="text-xs text-accent hover:underline">
                        View All Services &rarr;
                    </Link>
                </div>

                {data.serviceHealth.length === 0 ? (
                    <div className="py-8 text-center text-xs text-secondary">
                        No service telemetry reported yet. Connect your applications via the SDK.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {data.serviceHealth.map((s) => (
                            <div
                                key={`${s.service}-${s.projectId}`}
                                className="flex items-center justify-between p-3.5 rounded-xl bg-surface border border-border"
                            >
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-sm font-semibold text-white">{s.service}</span>
                                        <span className="text-xs text-muted">· {s.projectName}</span>
                                    </div>
                                    <p className="text-xs text-secondary">
                                        {s.totalCount} total events · {s.errorCount} errors ({s.errorRate}%)
                                    </p>
                                </div>

                                <span className={`halo-health halo-health-${s.health}`}>
                                    <span className="halo-health-dot" />
                                    {s.health}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
