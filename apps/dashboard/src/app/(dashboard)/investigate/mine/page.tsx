import Link from "next/link";
import { getOverviewData } from "@/actions/overview";
import { RelativeTime } from "@/components/ui/relative-time";
import { ArrowUpRight, Compass } from "lucide-react";

export default async function MyInvestigationsPage() {
    const data = await getOverviewData();

    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">My Investigations</h1>
                <p className="halo-page-description">
                    Investigations created by or assigned to you.
                </p>
            </div>

            {data.activeIncidents.length === 0 ? (
                <div className="halo-empty-state">
                    <Compass className="halo-empty-state-icon" />
                    <h3 className="halo-empty-state-title">No assigned investigations</h3>
                    <p className="halo-empty-state-description">
                        When you start an investigation or get assigned to an incident, it will appear here.
                    </p>
                    <Link href="/investigate" className="halo-btn halo-btn-primary">
                        New Investigation
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
                                    className="halo-btn halo-btn-sm halo-btn-secondary"
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
