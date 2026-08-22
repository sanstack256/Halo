import { getOverviewData } from "@/actions/overview";
import { Radio, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";

export default async function SloDashboardPage() {
    const data = await getOverviewData();

    // Real SLO computation from database telemetry:
    // SLO Target is 99.9% availability
    const targetAvailability = 99.9;
    const actualAvailability = data.systemHealth.crashFreeRate;
    const errorBudgetTotal = 100 - targetAvailability; // 0.1% allowed failure rate
    const errorRate = data.systemHealth.errorRate24h;

    // Remaining budget = max(0, min(100, 100 - (errorRate / errorBudgetTotal) * 100))
    const budgetConsumedPct = errorBudgetTotal > 0 ? (errorRate / errorBudgetTotal) * 100 : 0;
    const remainingBudgetPct = Math.max(0, Math.min(100, Math.round((100 - budgetConsumedPct) * 10) / 10));

    // Burn rate = actual failure rate / allowed failure rate
    const burnRate = errorBudgetTotal > 0 ? Math.round((errorRate / errorBudgetTotal) * 10) / 10 : 0;

    return (
        <div className="space-y-8 pb-12">
            <div className="halo-page-header">
                <h1 className="halo-page-title">SLO & Error Budget Dashboard</h1>
                <p className="halo-page-description">
                    Service Level Objectives compliance, error budget burn rates, and availability tracking from live telemetry.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="halo-card p-5 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted">
                        <span>Target Availability</span>
                        <Radio size={14} className="text-accent" />
                    </div>
                    <div className="text-2xl font-bold text-white">{targetAvailability}%</div>
                    <div className="text-xs text-secondary">
                        Current: <span className="text-white font-medium">{actualAvailability}%</span>
                    </div>
                </div>

                <div className="halo-card p-5 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted">
                        <span>Remaining Error Budget</span>
                        <ShieldCheck size={14} className={remainingBudgetPct > 20 ? "text-emerald-400" : "text-error"} />
                    </div>
                    <div className={`text-2xl font-bold ${remainingBudgetPct > 20 ? "text-emerald-400" : "text-error"}`}>
                        {remainingBudgetPct}%
                    </div>
                    <div className="text-xs text-secondary">30-day rolling window</div>
                </div>

                <div className="halo-card p-5 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted">
                        <span>Burn Rate</span>
                        <Zap size={14} className="text-accent" />
                    </div>
                    <div className="text-2xl font-bold text-white">{burnRate}x</div>
                    <div className="text-xs text-secondary">
                        {burnRate <= 1.0 ? "Normal consumption rate" : "Elevated consumption"}
                    </div>
                </div>
            </div>

            {/* Service SLO Breakdown */}
            <div className="halo-card p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Service SLO Compliance
                    </h2>
                    <Link href="/services" className="text-xs text-accent hover:underline">
                        Services &rarr;
                    </Link>
                </div>

                {data.serviceHealth.length === 0 ? (
                    <div className="py-8 text-center text-xs text-secondary">
                        No service telemetry available to evaluate SLO compliance.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {data.serviceHealth.map((s) => {
                            const sRemaining = Math.max(0, Math.min(100, Math.round((100 - (s.errorRate / 0.1) * 100) * 10) / 10));
                            return (
                                <div
                                    key={`${s.service}-${s.projectId}`}
                                    className="flex items-center justify-between p-3.5 rounded-xl bg-surface border border-border"
                                >
                                    <div className="space-y-0.5">
                                        <span className="font-mono text-sm font-semibold text-white">{s.service}</span>
                                        <p className="text-xs text-secondary">
                                            {s.errorRate}% error rate · {s.errorCount} total errors
                                        </p>
                                    </div>

                                    <div className="text-right">
                                        <span className={`text-xs font-semibold ${sRemaining > 20 ? "text-emerald-400" : "text-error"}`}>
                                            {sRemaining}% budget remaining
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
