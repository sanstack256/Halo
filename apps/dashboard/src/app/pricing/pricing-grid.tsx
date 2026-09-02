"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Zap } from "lucide-react";
import Link from "next/link";
import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/plans";

const FEATURE_LABELS: Record<string, string> = {
    errors: "Error tracking",
    logs: "Log ingestion",
    traces: "Distributed tracing",
    metrics: "Metrics explorer",
    requests: "Request monitoring",
    serviceMaps: "Service maps",
    dependencies: "Dependency tracking",
    investigationEngine: "AI investigation engine",
    blastRadius: "Blast-radius analysis",
    historicalComparison: "Historical incident comparison",
    deploymentRegression: "Deployment regression analysis",
    gitCorrelation: "Git & code correlation",
    autofix: "Autofix assistance",
    slos: "SLO tracking",
    errorBudgets: "Error budgets",
    advancedDashboards: "Advanced dashboards",
    spikeProtection: "Spike protection",
    mcpCli: "MCP & CLI access",
    teamInvestigations: "Team investigations",
    sharedDashboards: "Shared dashboards",
    teamOwnership: "Team ownership & routing",
    auditLog: "Audit log",
    customIntegrations: "Custom integrations",
    advancedNotifications: "Advanced notifications",
    orgAnalytics: "Organization analytics",
};

function fmtEvents(n: number): string {
    if (n >= 1_000_000_000) return "Unlimited";
    if (n >= 1_000_000) return `${n / 1_000_000}M`;
    if (n >= 1_000) return `${n / 1_000}K`;
    return n.toLocaleString();
}

export function PricingGrid() {
    const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
    const [devExpanded, setDevExpanded] = useState(false);

    return (
        <div className="space-y-10">
            {/* Toggle */}
            <div className="flex items-center justify-center gap-3">
                <span className={`text-sm ${billing === "monthly" ? "text-white font-semibold" : "text-secondary"}`}>
                    Monthly
                </span>
                <button
                    type="button"
                    onClick={() => setBilling(billing === "monthly" ? "yearly" : "monthly")}
                    className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                        billing === "yearly" ? "bg-blue-500" : "bg-white/10"
                    }`}
                    aria-label="Toggle annual billing"
                >
                    <span
                        className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                            billing === "yearly" ? "translate-x-6" : "translate-x-0"
                        }`}
                    />
                </button>
                <span className={`text-sm ${billing === "yearly" ? "text-white font-semibold" : "text-secondary"}`}>
                    Yearly
                    <span className="ml-1.5 text-xs text-emerald-400 font-medium">~2 months free</span>
                </span>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                {PLAN_ORDER.map((planId) => {
                    const plan = PLANS[planId];
                    const price = plan.price[billing];
                    const isRecommended = plan.recommended ?? false;

                    const cardStyle =
                        planId === "DEVELOPER"
                            ? "border-blue-500/40 bg-gradient-to-b from-blue-400/10 via-blue-600/8 to-[#08090a] ring-1 ring-blue-500/25"
                            : planId === "TEAM"
                              ? "border-indigo-500/25 bg-gradient-to-b from-indigo-400/8 via-indigo-600/5 to-[#08090a]"
                              : "border-white/8 bg-white/3";

                    // Filter the features for this plan
                    const allFeatures = (Object.entries(plan.features) as [string, boolean][])
                        .filter(([key, enabled]) => {
                            if (!enabled) return false;
                            if (planId === "FREE") return true;
                            if (planId === "DEVELOPER") return !PLANS.FREE.features[key as keyof typeof PLANS.FREE.features];
                            if (planId === "TEAM") return !PLANS.DEVELOPER.features[key as keyof typeof PLANS.DEVELOPER.features];
                            return true;
                        });

                    // For Developer plan, optionally collapse to match height of others (show 5 primary features)
                    const isDev = planId === "DEVELOPER";
                    const visibleFeatures = isDev && !devExpanded ? allFeatures.slice(0, 5) : allFeatures;
                    const hiddenCount = allFeatures.length - visibleFeatures.length;

                    return (
                        <div
                            key={planId}
                            className={`relative rounded-2xl border p-8 flex flex-col gap-6 ${cardStyle} ${isRecommended ? "md:-translate-y-2 border-accent/40" : ""}`}
                        >
                            {isRecommended && (
                                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-accent text-[#05070b] text-xs font-semibold">
                                        <Zap size={11} />
                                        Recommended
                                    </span>
                                </div>
                            )}

                            {/* Header */}
                            <div className="space-y-1.5">
                                <h2 className="text-xl font-bold text-white">{plan.name}</h2>
                                <p className="text-xs text-secondary leading-relaxed min-h-[32px]">{plan.tagline}</p>
                            </div>

                            {/* Price */}
                            <div>
                                <div className="flex items-end gap-1">
                                    {price === 0 ? (
                                        <span className="text-4xl font-extrabold text-white">Free</span>
                                    ) : (
                                        <>
                                            <span className="text-4xl font-extrabold text-white">${price}</span>
                                            <span className="text-sm text-secondary mb-1.5">/mo</span>
                                        </>
                                    )}
                                </div>
                                {billing === "yearly" && price > 0 ? (
                                    <p className="text-xs text-emerald-400 mt-1">
                                        Billed annually — save ~{Math.round((1 - price / PLANS[planId].price.monthly) * 100)}%
                                    </p>
                                ) : (
                                    <div className="h-5" />
                                )}
                            </div>

                            {/* Limits grid */}
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { label: "Projects", value: plan.limits.maxProjects },
                                    { label: "Members", value: plan.limits.maxMembers },
                                    { label: "Events/mo", value: fmtEvents(plan.limits.maxEventsPerMonth), raw: true },
                                    { label: "Retention", value: `${plan.limits.retentionDays}d`, raw: true },
                                ].map(({ label, value, raw }) => (
                                    <div key={label} className="rounded-xl bg-white/4 border border-white/6 px-3 py-2.5 text-center">
                                        <p className="text-sm font-semibold text-white">
                                            {raw ? value : typeof value === "number" && value >= 999 ? "Unlimited" : value}
                                        </p>
                                        <p className="text-xs text-secondary mt-0.5">{label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* CTA */}
                            <Link
                                href="/sign-up"
                                className={`w-full text-center py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
                                    isRecommended
                                        ? "bg-accent hover:bg-accent-hover text-[#05070b]"
                                        : "bg-white/6 hover:bg-white/10 border border-white/10 text-white"
                                }`}
                            >
                                {price === 0 ? "Get started free" : `Start ${plan.name} plan`}
                            </Link>

                            {/* Feature list */}
                            <div className="space-y-2.5 pt-1">
                                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                                    {planId === "FREE" ? "Includes" : `Everything in ${planId === "DEVELOPER" ? "Free" : "Developer"}, plus`}
                                </p>

                                <div className="space-y-2.5">
                                    {visibleFeatures.map(([key]) => (
                                        <div key={key} className="flex items-start gap-2.5 text-sm">
                                            <Check size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                                            <span className="text-secondary">{FEATURE_LABELS[key] ?? key}</span>
                                        </div>
                                    ))}
                                </div>

                                {isDev && (
                                    <button
                                        type="button"
                                        onClick={() => setDevExpanded(!devExpanded)}
                                        className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium pt-1 transition-colors"
                                    >
                                        {devExpanded ? (
                                            <>
                                                <ChevronUp size={13} />
                                                Show fewer features
                                            </>
                                        ) : (
                                            <>
                                                <ChevronDown size={13} />
                                                +{hiddenCount} more advanced features
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer note */}
            <p className="text-center text-xs text-white/30 max-w-xl mx-auto">
                Team plan supports up to 10 members. Additional members available separately.
                All plans include community support. Priority support included on Developer and Team.
            </p>
        </div>
    );
}
