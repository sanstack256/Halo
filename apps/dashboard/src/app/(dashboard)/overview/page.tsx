import Link from "next/link";
import { getOverviewData } from "@/actions/overview";
import { RelativeTime } from "@/components/ui/relative-time";
import {
    AlertTriangle,
    ArrowUpRight,
    CheckCircle2,
    Compass,
    GitBranch,
    Layers,
    Radio,
    ShieldAlert,
    Sparkles,
    Zap,
} from "lucide-react";

export default async function OverviewPage() {
    const data = await getOverviewData();

    const hasProjects = data.projects.length > 0;
    const hasActiveIncidents = data.activeIncidents.length > 0;
    const alert = data.needsAttention.primaryAlert;

    return (
        <div className="space-y-8 pb-12">
            {/* Top Page Header */}
            <div className="halo-page-header-row">
                <div>
                    <h1 className="halo-page-title">Overview</h1>
                    <p className="halo-page-description">
                        System health, active incidents, and proactive Halo discoveries.
                    </p>
                </div>

                <div className="halo-page-actions">
                    <Link href="/investigate" className="halo-btn halo-btn-primary">
                        <Compass size={15} />
                        New Investigation
                    </Link>
                </div>
            </div>

            {!hasProjects ? (
                <div className="halo-empty-state">
                    <Sparkles className="halo-empty-state-icon text-accent" />
                    <h2 className="halo-empty-state-title">No projects initialized</h2>
                    <p className="halo-empty-state-description">
                        Install the SDK in your application to enable real-time telemetry streaming and automated root cause analysis.
                    </p>
                    <Link href="/projects" className="halo-btn halo-btn-primary">
                        Configure SDK & Project
                    </Link>
                </div>
            ) : (
                <>
                    {/* 1. DOMINANT NEEDS ATTENTION SECTION */}
                    {hasActiveIncidents && alert ? (
                        <section className="halo-needs-attention">
                            <div className="flex items-center justify-between mb-4">
                                <div className="halo-needs-attention-title">
                                    <AlertTriangle size={16} />
                                    Needs Attention
                                </div>
                                <span className="text-xs font-mono text-error/90 bg-error/10 px-2.5 py-1 rounded-full border border-error/20 font-medium">
                                    {data.needsAttention.openIssuesCount} Active Issue{data.needsAttention.openIssuesCount > 1 ? "s" : ""}
                                </span>
                            </div>

                            <div className="space-y-4">
                                <div className="halo-attention-item border-none p-0 flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div className="space-y-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={`halo-severity halo-severity-${alert.severity.toLowerCase()}`}>
                                                {alert.severity}
                                            </span>
                                            <span className="font-mono text-xs text-muted font-medium">{alert.service}</span>
                                        </div>

                                        <h2 className="text-base font-semibold text-white tracking-tight">
                                            {alert.title}
                                        </h2>

                                        <p className="text-xs text-secondary leading-relaxed">
                                            {alert.occurrenceDescription} &bull; {alert.suspectedCause}
                                        </p>
                                    </div>

                                    <div className="flex-shrink-0 flex items-center gap-2">
                                        <Link
                                            href={`/projects/${alert.projectId}/investigations/new?issueId=${alert.issueId}`}
                                            className="halo-btn halo-btn-primary"
                                        >
                                            Investigate Incident <ArrowUpRight size={14} />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </section>
                    ) : (
                        <section className="p-5 border border-success/20 rounded-xl bg-success/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="text-success" size={20} />
                                <div>
                                    <h2 className="text-sm font-semibold text-white">All Systems Operational</h2>
                                    <p className="text-xs text-secondary mt-0.5">No active incidents or critical error spikes detected in the past 24 hours.</p>
                                </div>
                            </div>
                            <span className="text-xs font-mono text-success bg-success/10 px-2.5 py-1 rounded-full border border-success/20 font-medium">
                                Healthy
                            </span>
                        </section>
                    )}

                    {/* 2. OPERATIONAL SYSTEM HEALTH */}
                    <section className="halo-overview-section">
                        <div className="halo-stat-row grid-cols-4">
                            <div className="halo-stat-card">
                                <div className="halo-stat-label">Apdex Performance</div>
                                <div className="halo-stat-value">{data.systemHealth.apdexScore}</div>
                                <div className="halo-stat-sub flex items-center gap-1.5 mt-1">
                                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                                    {data.systemHealth.apdexRating}
                                </div>
                            </div>

                            <div className="halo-stat-card">
                                <div className="halo-stat-label">Crash-Free Sessions</div>
                                <div className="halo-stat-value">{data.systemHealth.crashFreeRate}%</div>
                                <div className="halo-stat-sub">Across connected runtimes</div>
                            </div>

                            <div className="halo-stat-card">
                                <div className="halo-stat-label">Sessions with Linked Failures</div>
                                <div className="halo-stat-value">~{data.systemHealth.impactedUsers24h}</div>
                                <div className="halo-stat-sub">{data.systemHealth.totalErrors24h} error occurrences</div>
                            </div>

                            <div className="halo-stat-card">
                                <div className="halo-stat-label">24h Error Rate</div>
                                <div className="halo-stat-value">{data.systemHealth.errorRate24h}%</div>
                                <div className="halo-stat-sub">{data.systemHealth.activeServiceCount} active services</div>
                            </div>
                        </div>
                    </section>

                    {/* 3. HALO PROACTIVE DISCOVERIES */}
                    {data.discoveries.length > 0 && (
                        <section className="halo-overview-section">
                            <div className="halo-overview-section-title">
                                <span className="flex items-center gap-2">
                                    <Sparkles size={16} className="text-accent" />
                                    Halo Intelligence Discoveries
                                </span>
                                <Link href="/investigate" className="halo-overview-section-link">
                                    All Investigations &rarr;
                                </Link>
                            </div>

                            <div className="space-y-3">
                                {data.discoveries.map((disc) => (
                                    <div
                                        key={disc.id}
                                        className="halo-card p-5 border-accent/20 bg-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                                    >
                                        <div className="space-y-1.5 min-w-0">
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <span className="halo-metric-pill text-accent bg-accent/10 border-accent/30 font-semibold">
                                                    {disc.confidence}{disc.confidenceScore !== null ? ` (${Math.round(disc.confidenceScore * 100)}%)` : ""}
                                                </span>
                                                <span className="text-xs font-mono text-muted">
                                                    {disc.service} &bull; {disc.projectName}
                                                </span>
                                                {disc.historicalPattern && (
                                                    <span className="text-xs text-warning bg-warning/10 px-2 py-0.5 rounded border border-warning/20">
                                                        {disc.historicalPattern}
                                                    </span>
                                                )}
                                            </div>

                                            <h3 className="text-sm font-semibold text-white">
                                                {disc.title}
                                            </h3>

                                            <p className="text-xs text-secondary leading-relaxed">
                                                {disc.summary}
                                                {disc.supportingEvidenceCount > 0 && (
                                                    <span className="text-muted"> &bull; {disc.supportingEvidenceCount} pieces of supporting evidence evaluated.</span>
                                                )}
                                            </p>
                                        </div>

                                        <div className="flex-shrink-0">
                                            <Link
                                                href={disc.issueId
                                                    ? `/projects/${disc.projectId}/investigations/new?issueId=${disc.issueId}`
                                                    : `/projects/${disc.projectId}/investigations/new`}
                                                className="halo-btn halo-btn-sm halo-btn-primary"
                                            >
                                                Investigate <ArrowUpRight size={13} />
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* 4. ACTIVE INCIDENTS */}
                    <section className="halo-overview-section">
                        <div className="halo-overview-section-title">
                            <span>Active Incidents</span>
                            <Link href="/issues" className="halo-overview-section-link">
                                View all issues &rarr;
                            </Link>
                        </div>

                        {!hasActiveIncidents ? (
                            <div className="halo-empty-state" style={{ minHeight: 140 }}>
                                <p className="halo-empty-state-description">No active unresolved incidents.</p>
                            </div>
                        ) : (
                            <div className="halo-table">
                                <div className="halo-table-header grid-cols-[1fr_120px_140px_100px_140px_120px]">
                                    <div className="halo-table-col-label">Issue</div>
                                    <div className="halo-table-col-label">Service</div>
                                    <div className="halo-table-col-label">Impact Estimate</div>
                                    <div className="halo-table-col-label">Severity</div>
                                    <div className="halo-table-col-label">Last Seen</div>
                                    <div className="halo-table-col-label">Action</div>
                                </div>

                                {data.activeIncidents.map((incident) => (
                                    <div
                                        key={incident.id}
                                        className="halo-table-row grid-cols-[1fr_120px_140px_100px_140px_120px]"
                                    >
                                        <div>
                                            <Link
                                                href={`/projects/${incident.projectId}/issues/${incident.id}`}
                                                className="halo-table-row-title hover:text-accent transition-colors"
                                            >
                                                {incident.title}
                                            </Link>
                                            <div className="halo-table-row-meta">{incident.projectName}</div>
                                        </div>

                                        <div className="halo-table-cell-mono text-xs">{incident.service}</div>

                                        <div className="halo-table-cell text-xs">{incident.occurrenceDescription}</div>

                                        <div>
                                            <span className={`halo-severity halo-severity-${incident.severity.toLowerCase()}`}>
                                                {incident.severity}
                                            </span>
                                        </div>

                                        <div className="halo-table-cell">
                                            <RelativeTime date={incident.lastSeen} />
                                        </div>

                                        <div>
                                            <Link
                                                href={`/projects/${incident.projectId}/investigations/new?issueId=${incident.id}`}
                                                className="halo-btn halo-btn-sm halo-btn-primary"
                                            >
                                                Investigate <ArrowUpRight size={13} />
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* 5. RECENT CHANGES (CORRELATED DEPLOYMENTS) */}
                    {data.recentChanges.length > 0 && (
                        <section className="halo-overview-section">
                            <div className="halo-overview-section-title">
                                <span className="flex items-center gap-2">
                                    <GitBranch size={16} className="text-accent" />
                                    Recent Changes & Correlated Deployments
                                </span>
                                <Link href="/explore/errors" className="halo-overview-section-link">
                                    View changes &rarr;
                                </Link>
                            </div>

                            <div className="halo-table">
                                <div className="halo-table-header grid-cols-[140px_120px_140px_100px_140px]">
                                    <div className="halo-table-col-label">Release Version</div>
                                    <div className="halo-table-col-label">Type</div>
                                    <div className="halo-table-col-label">Project</div>
                                    <div className="halo-table-col-label">Status</div>
                                    <div className="halo-table-col-label">Deployed</div>
                                </div>

                                {data.recentChanges.map((change) => (
                                    <div key={change.id} className="halo-table-row grid-cols-[140px_120px_140px_100px_140px]">
                                        <div>
                                            <span className="halo-release-badge">{change.version}</span>
                                        </div>
                                        <div className="halo-table-cell text-xs capitalize">{change.type}</div>
                                        <div className="halo-table-cell">{change.projectName}</div>
                                        <div>
                                            {change.status === "suspicious" ? (
                                                <span className="text-[11px] font-semibold text-warning bg-warning/10 px-2 py-0.5 rounded border border-warning/20">
                                                    Suspicious
                                                </span>
                                            ) : (
                                                <span className="text-[11px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded border border-success/20">
                                                    Stable
                                                </span>
                                            )}
                                        </div>
                                        <div className="halo-table-cell">
                                            <RelativeTime date={change.timestamp} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* 6. RECENT INVESTIGATIONS */}
                    {data.recentInvestigations.length > 0 && (
                        <section className="halo-overview-section">
                            <div className="halo-overview-section-title">
                                <span className="flex items-center gap-2">
                                    <Compass size={16} className="text-accent" />
                                    Recent Investigations & Verdicts
                                </span>
                                <Link href="/investigate" className="halo-overview-section-link">
                                    View all &rarr;
                                </Link>
                            </div>

                            <div className="halo-table">
                                <div className="halo-table-header grid-cols-[1fr_140px_120px_140px]">
                                    <div className="halo-table-col-label">Incident / Root Cause Verdict</div>
                                    <div className="halo-table-col-label">Project</div>
                                    <div className="halo-table-col-label">Confidence</div>
                                    <div className="halo-table-col-label">Action</div>
                                </div>

                                {data.recentInvestigations.map((inv) => (
                                    <div key={inv.id} className="halo-table-row grid-cols-[1fr_140px_120px_140px]">
                                        <div>
                                            <div className="halo-table-row-title">{inv.title}</div>
                                            <div className="halo-table-row-meta font-medium text-accent">
                                                {inv.rootCauseTitle}
                                            </div>
                                        </div>

                                        <div className="halo-table-cell">{inv.projectName}</div>

                                        <div className="halo-table-cell-mono">
                                            {inv.confidenceScore !== null
                                                ? `${Math.round(inv.confidenceScore * 100)}%`
                                                : "N/A"}
                                        </div>

                                        <div>
                                            <Link
                                                href={inv.issueId
                                                    ? `/projects/${inv.projectId}/investigations/new?issueId=${inv.issueId}`
                                                    : `/projects/${inv.projectId}/investigations/new`}
                                                className="halo-btn halo-btn-sm halo-btn-secondary"
                                            >
                                                View Report <ArrowUpRight size={13} />
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}