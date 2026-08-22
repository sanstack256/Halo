import { getRequests } from "@/actions/explore";
import { RelativeTime } from "@/components/ui/relative-time";
import { Search } from "lucide-react";

export default async function RequestsPage() {
    const requests = await getRequests();

    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Requests</h1>
                <p className="halo-page-description">HTTP request correlation and payload telemetry.</p>
            </div>

            {requests.length === 0 ? (
                <div className="halo-empty-state">
                    <Search className="halo-empty-state-icon" />
                    <h3 className="halo-empty-state-title">No request telemetry recorded</h3>
                    <p className="halo-empty-state-description">Events associated with requestId will be indexed here.</p>
                </div>
            ) : (
                <div className="halo-table">
                    <div className="halo-table-header grid-cols-[140px_120px_160px_1fr_120px]">
                        <div className="halo-table-col-label">Timestamp</div>
                        <div className="halo-table-col-label">Project</div>
                        <div className="halo-table-col-label">Request ID</div>
                        <div className="halo-table-col-label">Title / Endpoint</div>
                        <div className="halo-table-col-label">Service</div>
                    </div>

                    {requests.map((req) => (
                        <div key={req.id} className="halo-table-row grid-cols-[140px_120px_160px_1fr_120px]">
                            <div className="halo-table-cell">
                                <RelativeTime date={req.timestamp} />
                            </div>
                            <div className="halo-table-cell">{req.projectName}</div>
                            <div className="halo-table-cell-mono text-xs overflow-hidden text-ellipsis">
                                {req.requestId}
                            </div>
                            <div className="halo-table-row-title font-mono text-xs">
                                {req.title}
                            </div>
                            <div className="halo-table-cell-mono">{req.service ?? "-"}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
