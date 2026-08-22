import { getServices } from "@/actions/services";
import { RelativeTime } from "@/components/ui/relative-time";

export default async function ServicesHealthDashboardPage() {
    const services = await getServices();

    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Services Dashboard</h1>
                <p className="halo-page-description">Detailed service degradation and failure rate dashboard.</p>
            </div>

            {services.length === 0 ? (
                <div className="halo-empty-state">
                    <p className="halo-empty-state-description">No service telemetry available.</p>
                </div>
            ) : (
                <div className="halo-table">
                    <div className="halo-table-header grid-cols-[1fr_140px_120px_100px_140px]">
                        <div className="halo-table-col-label">Service</div>
                        <div className="halo-table-col-label">Project</div>
                        <div className="halo-table-col-label">Health</div>
                        <div className="halo-table-col-label">Error Rate</div>
                        <div className="halo-table-col-label">Last Seen</div>
                    </div>

                    {services.map((s) => (
                        <div key={`${s.service}-${s.projectId}`} className="halo-table-row grid-cols-[1fr_140px_120px_100px_140px]">
                            <div className="halo-table-row-title font-mono">{s.service}</div>
                            <div className="halo-table-cell">{s.projectName}</div>
                            <div>
                                <span className={`halo-health halo-health-${s.health}`}>
                                    <span className="halo-health-dot" />
                                    {s.health}
                                </span>
                            </div>
                            <div className="halo-table-cell-mono">{s.errorRate}%</div>
                            <div className="halo-table-cell">{s.lastSeen ? <RelativeTime date={s.lastSeen} /> : "-"}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
