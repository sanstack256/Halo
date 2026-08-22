import { getServices } from "@/actions/services";
import { RelativeTime } from "@/components/ui/relative-time";
import { Server } from "lucide-react";

export default async function HealthyServicesPage() {
    const services = await getServices();
    const filtered = services.filter((s) => s.health === "healthy");

    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Healthy Services</h1>
                <p className="halo-page-description">Services operating within normal error budgets (&lt; 5% error rate).</p>
            </div>

            {filtered.length === 0 ? (
                <div className="halo-empty-state">
                    <Server className="halo-empty-state-icon" />
                    <h3 className="halo-empty-state-title">No healthy services</h3>
                    <p className="halo-empty-state-description">No services currently categorized as healthy.</p>
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

                    {filtered.map((s) => (
                        <div key={`${s.service}-${s.projectId}`} className="halo-table-row grid-cols-[1fr_140px_120px_100px_100px_140px]">
                            <div className="halo-table-row-title font-mono">{s.service}</div>
                            <div className="halo-table-cell">{s.projectName}</div>
                            <div>
                                <span className={`halo-health halo-health-${s.health}`}>
                                    <span className="halo-health-dot" />
                                    {s.health}
                                </span>
                            </div>
                            <div className="halo-table-cell-mono">{s.errorRate}%</div>
                            <div className="halo-table-cell-mono">{s.totalCount}</div>
                            <div className="halo-table-cell">{s.lastSeen ? <RelativeTime date={s.lastSeen} /> : "-"}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
