import Link from "next/link";
import { getAllOrgIssues } from "@/actions/issue";
import { RelativeTime } from "@/components/ui/relative-time";
import { ArrowUpRight, BellRing } from "lucide-react";

export default async function WarningsPage() {
    const issues = await getAllOrgIssues({ severity: "WARNING" });

    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Warnings</h1>
                <p className="halo-page-description">
                    Issues tagged with WARNING severity.
                </p>
            </div>

            {issues.length === 0 ? (
                <div className="halo-empty-state">
                    <BellRing className="halo-empty-state-icon" />
                    <h3 className="halo-empty-state-title">No warnings found</h3>
                    <p className="halo-empty-state-description">No WARNING severity issues recorded.</p>
                </div>
            ) : (
                <div className="halo-table">
                    <div className="halo-table-header grid-cols-[1fr_140px_100px_100px_140px_140px]">
                        <div className="halo-table-col-label">Title</div>
                        <div className="halo-table-col-label">Project</div>
                        <div className="halo-table-col-label">Severity</div>
                        <div className="halo-table-col-label">Events</div>
                        <div className="halo-table-col-label">Last Seen</div>
                        <div className="halo-table-col-label">Action</div>
                    </div>

                    {issues.map((issue) => (
                        <div key={issue.id} className="halo-table-row grid-cols-[1fr_140px_100px_100px_140px_140px]">
                            <div>
                                <Link href={`/projects/${issue.projectId}/issues/${issue.id}`} className="halo-table-row-title hover:text-accent">
                                    {issue.title}
                                </Link>
                            </div>
                            <div className="halo-table-cell">{issue.projectName}</div>
                            <div>
                                <span className={`halo-severity halo-severity-${issue.severity.toLowerCase()}`}>
                                    {issue.severity}
                                </span>
                            </div>
                            <div className="halo-table-cell-mono">{issue.eventCount}</div>
                            <div className="halo-table-cell"><RelativeTime date={issue.lastSeen} /></div>
                            <div>
                                <Link href={`/projects/${issue.projectId}/investigations/new?issueId=${issue.id}`} className="halo-btn halo-btn-sm halo-btn-primary">
                                    Investigate <ArrowUpRight size={13} />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
