import Link from "next/link";
import { getAllOrgIssues } from "@/actions/issue";
import { RelativeTime } from "@/components/ui/relative-time";
import { ArrowUpRight, BellRing } from "lucide-react";

export default async function MonitorsPage() {
    const issues = await getAllOrgIssues();

    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Monitors</h1>
                <p className="halo-page-description">Alert monitors and anomaly detectors derived real-time from active issues.</p>
            </div>

            {issues.length === 0 ? (
                <div className="halo-empty-state">
                    <BellRing className="halo-empty-state-icon" />
                    <h3 className="halo-empty-state-title">No monitors configured</h3>
                    <p className="halo-empty-state-description">Monitors will automatically track error spikes, crash rates, and SLO violations.</p>
                </div>
            ) : (
                <div className="halo-table">
                    <div className="halo-table-header grid-cols-[1fr_140px_120px_100px_140px_140px]">
                        <div className="halo-table-col-label">Monitor Target (Issue)</div>
                        <div className="halo-table-col-label">Project</div>
                        <div className="halo-table-col-label">State</div>
                        <div className="halo-table-col-label">Severity</div>
                        <div className="halo-table-col-label">Last Triggered</div>
                        <div className="halo-table-col-label">Action</div>
                    </div>

                    {issues.map((issue) => {
                        const isFiring = issue.severity === "FATAL" || (issue.status === "OPEN" && issue.eventCount > 5);

                        return (
                            <div key={issue.id} className="halo-table-row grid-cols-[1fr_140px_120px_100px_140px_140px]">
                                <div>
                                    <div className="halo-table-row-title">{issue.title}</div>
                                    <div className="halo-table-row-meta">{issue.eventCount} threshold triggers</div>
                                </div>

                                <div className="halo-table-cell">{issue.projectName}</div>

                                <div>
                                    {isFiring ? (
                                        <span className="halo-monitor-state-firing">
                                            <span className="halo-monitor-pulse" /> Firing
                                        </span>
                                    ) : (
                                        <span className="halo-monitor-state-healthy">
                                            <span className="halo-monitor-pulse" /> Ok
                                        </span>
                                    )}
                                </div>

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
                        );
                    })}
                </div>
            )}
        </div>
    );
}
