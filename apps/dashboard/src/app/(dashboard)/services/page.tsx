import Link from "next/link";
import { getServices } from "@/actions/services";
import { RelativeTime } from "@/components/ui/relative-time";
import { Server } from "lucide-react";

export default async function ServicesPage() {
    const services = await getServices();

    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Services</h1>
                <p className="halo-page-description">
                    Microservice catalog and health status derived real-time from telemetry events.
                </p>
            </div>

            {services.length === 0 ? (
                <div className="halo-empty-state">
                    <Server className="halo-empty-state-icon" />
                    <h3 className="halo-empty-state-title">No service telemetry detected</h3>
                    <p className="halo-empty-state-description">
                        Tag your SDK telemetry events with a <code className="text-xs bg-surface-elevated px-1.5 py-0.5 rounded">service</code> property to auto-populate service health monitoring.
                    </p>
                </div>
            ) : (
                <div className="halo-table">
                    <div className="halo-table-header grid-cols-[1fr_140px_120px_100px_100px_140px]">
                        <div className="halo-table-col-label">Service Name</div>
                        <div className="halo-table-col-label">Project</div>
                        <div className="halo-table-col-label">Health</div>
                        <div className="halo-table-col-label">Error Rate</div>
                        <div className="halo-table-col-label">Total Events</div>
                        <div className="halo-table-col-label">Last Telemetry</div>
                    </div>

                    {services.map((s) => (
                        <div key={`${s.service}-${s.projectId}`} className="halo-table-row grid-cols-[1fr_140px_120px_100px_100px_140px]">
                            <div>
                                <div className="halo-table-row-title font-mono">{s.service}</div>
                            </div>
                            <div className="halo-table-cell">{s.projectName}</div>
                            <div>
                                <span className={`halo-health halo-health-${s.health}`}>
                                    <span className="halo-health-dot" />
                                    {s.health}
                                </span>
                            </div>
                            <div className="halo-table-cell-mono">{s.errorRate}%</div>
                            <div className="halo-table-cell-mono">{s.totalCount}</div>
                            <div className="halo-table-cell">
                                {s.lastSeen ? <RelativeTime date={s.lastSeen} /> : "-"}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
