import Link from "next/link";
import { getAllOrgIssues } from "@/actions/issue";
import { RelativeTime } from "@/components/ui/relative-time";
import { BellRing } from "lucide-react";

export default async function HealthyMonitorsPage() {
    const issues = await getAllOrgIssues();
    const healthy = issues.filter(
        (issue) => issue.severity !== "FATAL" && (issue.status !== "OPEN" || issue.eventCount <= 5)
    );

    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Healthy Monitors</h1>
                <p className="halo-page-description">Monitors currently operating within normal parameters.</p>
            </div>

            {healthy.length === 0 ? (
                <div className="halo-empty-state">
                    <BellRing className="halo-empty-state-icon" />
                    <h3 className="halo-empty-state-title">No healthy monitors listed</h3>
                    <p className="halo-empty-state-description">Monitors will appear here once telemetry is evaluated.</p>
                </div>
            ) : (
                <div className="halo-table">
                    <div className="halo-table-header grid-cols-[1fr_140px_120px_100px_140px]">
                        <div className="halo-table-col-label">Monitor Target</div>
                        <div className="halo-table-col-label">Project</div>
                        <div className="halo-table-col-label">State</div>
                        <div className="halo-table-col-label">Severity</div>
                        <div className="halo-table-col-label">Last Checked</div>
                    </div>

                    {healthy.map((issue) => (
                        <div key={issue.id} className="halo-table-row grid-cols-[1fr_140px_120px_100px_140px]">
                            <div className="halo-table-row-title">{issue.title}</div>
                            <div className="halo-table-cell">{issue.projectName}</div>
                            <div>
                                <span className="halo-monitor-state-healthy">
                                    <span className="halo-monitor-pulse" /> Ok
                                </span>
                            </div>
                            <div>
                                <span className={`halo-severity halo-severity-${issue.severity.toLowerCase()}`}>
                                    {issue.severity}
                                </span>
                            </div>
                            <div className="halo-table-cell"><RelativeTime date={issue.lastSeen} /></div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
