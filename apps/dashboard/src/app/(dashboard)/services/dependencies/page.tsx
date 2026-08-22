import { getServices } from "@/actions/services";
import { RelativeTime } from "@/components/ui/relative-time";
import { Network } from "lucide-react";

export default async function ServiceDependenciesPage() {
    const services = await getServices();

    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Service Dependencies</h1>
                <p className="halo-page-description">External APIs, databases, and upstream dependencies mapped from trace spans.</p>
            </div>

            {services.length === 0 ? (
                <div className="halo-empty-state">
                    <Network className="halo-empty-state-icon" />
                    <h3 className="halo-empty-state-title">No service dependencies discovered</h3>
                    <p className="halo-empty-state-description">Dependency graph will be auto-generated as cross-service trace calls occur.</p>
                </div>
            ) : (
                <div className="halo-table">
                    <div className="halo-table-header grid-cols-[1fr_140px_120px_100px_140px]">
                        <div className="halo-table-col-label">Service</div>
                        <div className="halo-table-col-label">Project</div>
                        <div className="halo-table-col-label">Health</div>
                        <div className="halo-table-col-label">Spans Recorded</div>
                        <div className="halo-table-col-label">Last Activity</div>
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
                            <div className="halo-table-cell-mono">{s.traceCount}</div>
                            <div className="halo-table-cell">{s.lastSeen ? <RelativeTime date={s.lastSeen} /> : "-"}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
