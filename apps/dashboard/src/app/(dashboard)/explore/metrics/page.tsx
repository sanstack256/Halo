import { getOverviewData } from "@/actions/overview";
import { BarChart3 } from "lucide-react";

export default async function MetricsPage() {
    const data = await getOverviewData();

    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Metrics</h1>
                <p className="halo-page-description">Aggregated system performance metrics and session statistics.</p>
            </div>

            <div className="halo-stat-row grid-cols-3">
                <div className="halo-stat-card">
                    <div className="halo-stat-label">Apdex Rating</div>
                    <div className="halo-stat-value">{data.systemHealth.apdexScore}</div>
                    <div className="halo-stat-sub">{data.systemHealth.apdexRating}</div>
                </div>

                <div className="halo-stat-card">
                    <div className="halo-stat-label">Crash-Free Rate</div>
                    <div className="halo-stat-value">{data.systemHealth.crashFreeRate}%</div>
                    <div className="halo-stat-sub">Telemetry session health</div>
                </div>

                <div className="halo-stat-card">
                    <div className="halo-stat-label">24h Error Rate</div>
                    <div className="halo-stat-value">{data.systemHealth.errorRate24h}%</div>
                    <div className="halo-stat-sub">{data.systemHealth.totalErrors24h} total error events</div>
                </div>
            </div>
        </div>
    );
}
