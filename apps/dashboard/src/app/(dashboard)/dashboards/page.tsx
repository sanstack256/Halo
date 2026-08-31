import Link from "next/link";
import { getOverviewData } from "@/actions/overview";
import { Activity, ArrowRight, GitCommit, LayoutDashboard, Network, Radio, Server } from "lucide-react";

export default async function DashboardsPage() {
    const data = await getOverviewData();

    return (
        <div className="halo-dash-shell">
            {/* Header */}
            <div className="halo-dash-header">
                <div className="halo-dash-title-row">
                    <div className="halo-dash-title-group">
                        <div className="halo-dash-icon-box">
                            <LayoutDashboard size={18} />
                        </div>
                        <div>
                            <h1 className="halo-dash-title">
                                Observability Dashboards
                            </h1>
                            <p className="halo-dash-desc">
                                Deep analytical workspaces powered by synchronized telemetry, distributed traces, and causal correlation.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dashboards Suite Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. System Explorer */}
                <Link
                    href="/dashboards/system"
                    className="halo-panel hover:border-accent/40 hover:bg-surface-elevated/40 transition-all group cursor-pointer"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                                <Activity size={16} />
                            </div>
                            <h2 className="text-sm font-bold text-text group-hover:text-accent transition-colors">
                                System Explorer
                            </h2>
                        </div>
                        <ArrowRight size={14} className="text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                    </div>

                    <p className="text-text-secondary text-xs leading-relaxed">
                        Synchronized multi-signal timeline, automated change explanation engine, and period-over-period delta comparisons.
                    </p>

                    <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-mono">
                        <span className="text-text-muted">Error Rate (24h)</span>
                        <span className="text-text font-bold">{data.systemHealth.errorRate24h}%</span>
                    </div>
                </Link>

                {/* 2. Service Landscape */}
                <Link
                    href="/dashboards/services"
                    className="halo-panel hover:border-accent/40 hover:bg-surface-elevated/40 transition-all group cursor-pointer"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                                <Server size={16} />
                            </div>
                            <h2 className="text-sm font-bold text-text group-hover:text-accent transition-colors">
                                Service Landscape
                            </h2>
                        </div>
                        <ArrowRight size={14} className="text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                    </div>

                    <p className="text-text-secondary text-xs leading-relaxed">
                        Cross-service health matrix, failure contribution rankings, degradation velocity, and deep contextual inspection drawers.
                    </p>

                    <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-mono">
                        <span className="text-text-muted">Active Services</span>
                        <span className="text-text font-bold">{data.systemHealth.activeServiceCount} tracked</span>
                    </div>
                </Link>

                {/* 3. Change Intelligence */}
                <Link
                    href="/dashboards/changes"
                    className="halo-panel hover:border-accent/40 hover:bg-surface-elevated/40 transition-all group cursor-pointer"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                                <GitCommit size={16} />
                            </div>
                            <h2 className="text-sm font-bold text-text group-hover:text-accent transition-colors">
                                Change Intelligence
                            </h2>
                        </div>
                        <ArrowRight size={14} className="text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                    </div>

                    <p className="text-text-secondary text-xs leading-relaxed">
                        Automated pre/post deployment baseline observation window analysis, regression detection, and evidence classification.
                    </p>

                    <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-mono">
                        <span className="text-text-muted">Recent Deployments</span>
                        <span className="text-text font-bold">{data.recentChanges.length} registered</span>
                    </div>
                </Link>

                {/* 4. Dependency Intelligence */}
                <Link
                    href="/dashboards/dependencies"
                    className="halo-panel hover:border-accent/40 hover:bg-surface-elevated/40 transition-all group cursor-pointer"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                                <Network size={16} />
                            </div>
                            <h2 className="text-sm font-bold text-text group-hover:text-accent transition-colors">
                                Dependency Intelligence
                            </h2>
                        </div>
                        <ArrowRight size={14} className="text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                    </div>

                    <p className="text-text-secondary text-xs leading-relaxed">
                        Observed topology graph with trace-level edge provenance, blast radius calculator, and failure propagation chains.
                    </p>

                    <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-mono">
                        <span className="text-text-muted">Topology Engine</span>
                        <span className="text-text font-bold">Distributed Spans</span>
                    </div>
                </Link>

                {/* 5. Reliability Lab */}
                <Link
                    href="/dashboards/reliability"
                    className="halo-panel hover:border-accent/40 hover:bg-surface-elevated/40 transition-all group cursor-pointer"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                <Radio size={16} />
                            </div>
                            <h2 className="text-sm font-bold text-text group-hover:text-accent transition-colors">
                                Reliability Lab
                            </h2>
                        </div>
                        <ArrowRight size={14} className="text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                    </div>

                    <p className="text-text-secondary text-xs leading-relaxed">
                        Long-term reliability posture, SLO compliance, error budget burn multiplier, and recurring fingerprint pattern detector.
                    </p>

                    <div className="pt-2 border-t border-border flex items-center justify-between text-xs font-mono">
                        <span className="text-text-muted">Crash-Free Sessions</span>
                        <span className="text-text font-bold">{data.systemHealth.crashFreeRate}%</span>
                    </div>
                </Link>
            </div>
        </div>
    );
}
