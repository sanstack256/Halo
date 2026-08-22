import { Database } from "lucide-react";

export default function DatabaseExplorePage() {
    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Database Telemetry</h1>
                <p className="halo-page-description">Database query traces, latency bottlenecks, and connection errors.</p>
            </div>

            <div className="halo-empty-state">
                <Database className="halo-empty-state-icon" />
                <h3 className="halo-empty-state-title">No database queries recorded</h3>
                <p className="halo-empty-state-description">
                    SQL query spans and ORM trace events recorded by the SDK will be cataloged here.
                </p>
            </div>
        </div>
    );
}
