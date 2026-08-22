import Link from "next/link";
import { getOverviewData } from "@/actions/overview";
import { RelativeTime } from "@/components/ui/relative-time";
import { ArrowUpRight, Compass } from "lucide-react";

export default async function ActiveInvestigationsPage() {
    const data = await getOverviewData();
    const activeList = data.activeIncidents.filter((i) => i.eventCount > 0);

    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Active Investigations</h1>
                <p className="halo-page-description">
                    Issues currently undergoing continuous automated triage and evidence synthesis.
                </p>
            </div>

            {activeList.length === 0 ? (
                <div className="halo-empty-state">
                    <Compass className="halo-empty-state-icon" />
                    <h3 className="halo-empty-state-title">No active investigations</h3>
                    <p className="halo-empty-state-description">
                        All clear. No active failures require immediate investigation.
                    </p>
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

                    {activeList.map((issue) => (
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
                                    Open Workspace <ArrowUpRight size={13} />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
