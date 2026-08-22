import { Radio } from "lucide-react";

export default function SloDashboardPage() {
    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">SLO & Error Budget Dashboard</h1>
                <p className="halo-page-description">Service Level Objective targets and error budget burn rates.</p>
            </div>

            <div className="halo-stat-row grid-cols-3">
                <div className="halo-stat-card">
                    <div className="halo-stat-label">Target Availability</div>
                    <div className="halo-stat-value">99.9%</div>
                    <div className="halo-stat-sub">3 nines objective</div>
                </div>

                <div className="halo-stat-card">
                    <div className="halo-stat-label">Remaining Error Budget</div>
                    <div className="halo-stat-value text-emerald-400">98.4%</div>
                    <div className="halo-stat-sub">30 day rolling window</div>
                </div>

                <div className="halo-stat-card">
                    <div className="halo-stat-label">Burn Rate</div>
                    <div className="halo-stat-value">0.1x</div>
                    <div className="halo-stat-sub">Normal rate</div>
                </div>
            </div>
        </div>
    );
}
