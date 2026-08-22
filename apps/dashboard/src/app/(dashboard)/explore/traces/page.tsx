import { getTraces } from "@/actions/explore";
import { RelativeTime } from "@/components/ui/relative-time";
import { Waypoints } from "lucide-react";

export default async function TracesPage() {
    const traces = await getTraces();

    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Traces</h1>
                <p className="halo-page-description">Distributed trace spans and request execution waterfalls.</p>
            </div>

            {traces.length === 0 ? (
                <div className="halo-empty-state">
                    <Waypoints className="halo-empty-state-icon" />
                    <h3 className="halo-empty-state-title">No trace telemetry recorded</h3>
                    <p className="halo-empty-state-description">Trace spans emitted by SDK instruments will appear here.</p>
                </div>
            ) : (
                <div className="halo-table">
                    <div className="halo-table-header grid-cols-[140px_120px_160px_1fr_120px]">
                        <div className="halo-table-col-label">Timestamp</div>
                        <div className="halo-table-col-label">Project</div>
                        <div className="halo-table-col-label">Trace ID</div>
                        <div className="halo-table-col-label">Operation</div>
                        <div className="halo-table-col-label">Service</div>
                    </div>

                    {traces.map((trace) => (
                        <div key={trace.id} className="halo-table-row grid-cols-[140px_120px_160px_1fr_120px]">
                            <div className="halo-table-cell">
                                <RelativeTime date={trace.timestamp} />
                            </div>
                            <div className="halo-table-cell">{trace.projectName}</div>
                            <div className="halo-table-cell-mono text-xs overflow-hidden text-ellipsis">
                                {trace.traceId ?? trace.id}
                            </div>
                            <div className="halo-table-row-title font-mono text-xs">
                                {trace.title}
                            </div>
                            <div className="halo-table-cell-mono">{trace.service ?? "-"}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
