import { Radio } from "lucide-react";

export default function SlosMonitorsPage() {
    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Service SLO Monitors</h1>
                <p className="halo-page-description">Burn-rate alert monitors configured on Service Level Objectives.</p>
            </div>

            <div className="halo-empty-state">
                <Radio className="halo-empty-state-icon" />
                <h3 className="halo-empty-state-title">All Service SLOs within budget</h3>
                <p className="halo-empty-state-description">No active SLO burn-rate alerts triggered.</p>
            </div>
        </div>
    );
}
