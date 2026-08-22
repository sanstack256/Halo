import { getErrors } from "@/actions/explore";
import { RelativeTime } from "@/components/ui/relative-time";
import { FileWarning } from "lucide-react";

export default async function ExploreErrorsPage() {
    const errors = await getErrors();

    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Explore Errors</h1>
                <p className="halo-page-description">Raw exception occurrences and error event payloads across all projects.</p>
            </div>

            {errors.length === 0 ? (
                <div className="halo-empty-state">
                    <FileWarning className="halo-empty-state-icon" />
                    <h3 className="halo-empty-state-title">No error events recorded</h3>
                    <p className="halo-empty-state-description">Raw error events captured by Halo will appear here.</p>
                </div>
            ) : (
                <div className="halo-table">
                    <div className="halo-table-header grid-cols-[140px_120px_100px_1fr_120px]">
                        <div className="halo-table-col-label">Timestamp</div>
                        <div className="halo-table-col-label">Project</div>
                        <div className="halo-table-col-label">Severity</div>
                        <div className="halo-table-col-label">Error Title</div>
                        <div className="halo-table-col-label">Service</div>
                    </div>

                    {errors.map((err) => (
                        <div key={err.id} className="halo-table-row grid-cols-[140px_120px_100px_1fr_120px]">
                            <div className="halo-table-cell">
                                <RelativeTime date={err.timestamp} />
                            </div>
                            <div className="halo-table-cell">{err.projectName}</div>
                            <div>
                                <span className={`halo-severity halo-severity-${err.severity.toLowerCase()}`}>
                                    {err.severity}
                                </span>
                            </div>
                            <div className="halo-table-row-title font-mono text-xs overflow-hidden text-ellipsis">
                                {err.title}
                            </div>
                            <div className="halo-table-cell-mono">{err.service ?? "-"}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
