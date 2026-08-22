import { Cpu } from "lucide-react";

export default function InfrastructureExplorePage() {
    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Infrastructure</h1>
                <p className="halo-page-description">Container, host runtime, and node health signals.</p>
            </div>

            <div className="halo-empty-state">
                <Cpu className="halo-empty-state-icon" />
                <h3 className="halo-empty-state-title">No infrastructure telemetry</h3>
                <p className="halo-empty-state-description">
                    Host metrics, memory pressure events, and runtime environment signals will appear here.
                </p>
            </div>
        </div>
    );
}
