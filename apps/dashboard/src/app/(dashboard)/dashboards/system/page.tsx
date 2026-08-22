import { getOverviewData } from "@/actions/overview";

export default async function SystemHealthDashboardPage() {
    const data = await getOverviewData();

    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">System Health Dashboard</h1>
                <p className="halo-page-description">Real-time operational health overview across all connected environments.</p>
            </div>

            <div className="grid grid-cols-4 gap-4">
                <div className="halo-stat-card">
                    <div className="halo-stat-label">Apdex Performance</div>
                    <div className="halo-stat-value">{data.systemHealth.apdexScore}</div>
                    <div className="halo-stat-sub">{data.systemHealth.apdexRating}</div>
                </div>
                <div className="halo-stat-card">
                    <div className="halo-stat-label">Crash-Free Rate</div>
                    <div className="halo-stat-value">{data.systemHealth.crashFreeRate}%</div>
                </div>
                <div className="halo-stat-card">
                    <div className="halo-stat-label">24h Errors</div>
                    <div className="halo-stat-value">{data.systemHealth.totalErrors24h}</div>
                </div>
                <div className="halo-stat-card">
                    <div className="halo-stat-label">Impacted Users</div>
                    <div className="halo-stat-value">~{data.systemHealth.impactedUsers24h}</div>
                </div>
            </div>
        </div>
    );
}
