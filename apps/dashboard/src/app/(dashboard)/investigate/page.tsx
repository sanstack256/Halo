import Link from "next/link";
import { getOverviewData } from "@/actions/overview";
import { RelativeTime } from "@/components/ui/relative-time";
import { ArrowUpRight, Compass, Sparkles } from "lucide-react";

export default async function InvestigatePage() {
    const data = await getOverviewData();

    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Investigate</h1>
                <p className="halo-page-description">
                    Select an active issue to trigger Halo's autonomous root cause engine, hypothesis generation, and evidence reconstruction.
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
