import Link from "next/link";
import { getOverviewData } from "@/actions/overview";
import { getOrgAlerts } from "@/actions/alert";
import { RelativeTime } from "@/components/ui/relative-time";
import { ArrowUpRight, BellRing, Compass, ShieldAlert, Sparkles } from "lucide-react";

export default async function InvestigatePage() {
    const [data, alertsResult] = await Promise.all([
        getOverviewData(),
        getOrgAlerts({ status: "OPEN", pageSize: 5 }),
    ]);

    const activeAlerts = alertsResult.alerts || [];

    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Investigate</h1>
                <p className="halo-page-description">
                    Trigger Halo's autonomous root cause engine, hypothesis generation, and evidence reconstruction from active issues or firing monitors.
                </p>
            </div>

            {/* Prompt Card */}
            <div className="halo-card p-6 border-accent/20 bg-accent/5">
                <div className="flex items-center gap-3 mb-3 text-accent font-medium text-sm">
                    <Sparkles size={18} />
                    Autonomous Root Cause Analysis
                </div>
                <p className="text-sm text-secondary leading-relaxed">
                    Halo analyzes errors, traces, logs, environment context, releases, and causal correlations to present a unified verdict with confidence scoring and fix suggestions.
                </p>
            </div>

            {/* Active Monitor Alerts Section */}
            {activeAlerts.length > 0 && (
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <BellRing size={16} className="text-red-400" />
                        <h2 className="text-base font-semibold text-white">Firing Monitor Alerts</h2>
                    </div>

                    <div className="halo-table">
                        <div className="halo-table-header grid-cols-[1fr_140px_120px_140px_140px]">
                            <div className="halo-table-col-label">Monitor &amp; Condition</div>
                            <div className="halo-table-col-label">Project</div>
                            <div className="halo-table-col-label">Type</div>
                            <div className="halo-table-col-label">Triggered</div>
                            <div className="halo-table-col-label">Action</div>
                        </div>

                        {activeAlerts.map((alert) => (
                            <div key={alert.id} className="halo-table-row grid-cols-[1fr_140px_120px_140px_140px]">
                                <div>
                                    <div className="halo-table-row-title">{alert.monitorName}</div>
                                    <div className="halo-table-row-meta">{alert.conditionSummary}</div>
                                </div>

                                <div className="halo-table-cell">{alert.projectName}</div>

                                <div>
                                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface border border-border text-secondary">
                                        {alert.monitorType}
                                    </span>
                                </div>

                                <div className="halo-table-cell">
                                    <RelativeTime date={alert.triggeredAt} />
                                </div>

                                <div>
                                    <Link
                                        href={`/projects/${alert.projectId}/investigations/new?monitorId=${alert.monitorId}&alertId=${alert.id}`}
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

            <section className="space-y-4">
                <h2 className="text-base font-semibold">Select Issue to Investigate</h2>

                {data.activeIncidents.length === 0 ? (
                    <div className="halo-empty-state">
                        <Compass className="halo-empty-state-icon" />
                        <h3 className="halo-empty-state-title">No open issues found</h3>
                        <p className="halo-empty-state-description">
                            Once your application sends telemetry or error events, open issues will appear here for automated investigation.
                        </p>
                        <Link href="/projects" className="halo-btn halo-btn-secondary">
                            View Projects
                        </Link>
                    </div>
                ) : (
                    <div className="halo-table">
                        <div className="halo-table-header grid-cols-[1fr_140px_100px_140px_140px]">
                            <div className="halo-table-col-label">Issue Title</div>
                            <div className="halo-table-col-label">Project</div>
                            <div className="halo-table-col-label">Severity</div>
                            <div className="halo-table-col-label">Last Seen</div>
                            <div className="halo-table-col-label">Action</div>
                        </div>

                        {data.activeIncidents.map((issue) => (
                            <div key={issue.id} className="halo-table-row grid-cols-[1fr_140px_100px_140px_140px]">
                                <div>
                                    <div className="halo-table-row-title">{issue.title}</div>
                                    <div className="halo-table-row-meta">{issue.eventCount} occurrences</div>
                                </div>

                                <div className="halo-table-cell">{issue.projectName}</div>

                                <div>
                                    <span className={`halo-severity halo-severity-${issue.severity.toLowerCase()}`}>
                                        {issue.severity}
                                    </span>
                                </div>

                                <div className="halo-table-cell">
                                    <RelativeTime date={issue.lastSeen} />
                                </div>

                                <div>
                                    <Link
                                        href={`/projects/${issue.projectId}/investigations/new?issueId=${issue.id}`}
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
        </div>
    );
}

