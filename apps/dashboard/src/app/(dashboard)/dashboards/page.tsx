import Link from "next/link";
import { getOverviewData } from "@/actions/overview";
import { Activity, LayoutDashboard, Radio, Server } from "lucide-react";

export default async function DashboardsPage() {
    const data = await getOverviewData();

    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Dashboards</h1>
                <p className="halo-page-description">Pre-configured observability dashboards powered by live telemetry data.</p>
            </div>

            <div className="grid grid-cols-3 gap-6">
                <Link href="/dashboards/system" className="halo-card p-6 hover:border-accent/40 transition-colors block">
                    <div className="flex items-center gap-3 mb-4">
                        <Activity className="text-accent" size={20} />
                        <h2 className="text-base font-semibold">System Health</h2>
                    </div>
                    <p className="text-sm text-secondary mb-4">Overall error counts, crash-free session rates, and project performance overview.</p>
                    <div className="text-2xl font-bold text-white">{data.systemHealth.crashFreeRate}% <span className="text-xs font-normal text-muted">crash-free</span></div>
                </Link>

                <Link href="/dashboards/services" className="halo-card p-6 hover:border-accent/40 transition-colors block">
                    <div className="flex items-center gap-3 mb-4">
                        <Server className="text-accent" size={20} />
                        <h2 className="text-base font-semibold">Service Health</h2>
                    </div>
                    <p className="text-sm text-secondary mb-4">Per-service breakdown, failure rate tracking, and telemetry activity.</p>
                    <div className="text-2xl font-bold text-white">{data.serviceHealth.length} <span className="text-xs font-normal text-muted">active services</span></div>
                </Link>

                <Link href="/dashboards/slo" className="halo-card p-6 hover:border-accent/40 transition-colors block">
                    <div className="flex items-center gap-3 mb-4">
                        <Radio className="text-accent" size={20} />
                        <h2 className="text-base font-semibold">SLO & Error Budget</h2>
                    </div>
                    <p className="text-sm text-secondary mb-4">Service Level Objectives, error budget burn rates, and availability targets.</p>
                    <div className="text-2xl font-bold text-white">99.9% <span className="text-xs font-normal text-muted">target availability</span></div>
                </Link>
            </div>
        </div>
    );
}
