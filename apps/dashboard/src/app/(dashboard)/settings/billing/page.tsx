import { getSession } from "@/lib/session";
import { getOrganization } from "@/lib/organization";
import { getUserOrgEntitlements } from "@/lib/entitlements";
import { PLANS } from "@/lib/plans";
import Link from "next/link";
import { Zap } from "lucide-react";

export default async function BillingPage() {
    const session = await getSession();
    if (!session) return null;
    const org = await getOrganization(session.user.id);
    if (!org) return null;

    const { planId, plan } = await getUserOrgEntitlements(session.user.id);
    const isFree = planId === "FREE";

    return (
        <div className="space-y-8 pb-16">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Subscription</h1>
                <p className="halo-page-description">
                    Manage your organization&apos;s plan and billing.
                </p>
            </div>

            {/* Current plan */}
            <div className="halo-card p-6 space-y-5">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-3">
                    Current Plan
                </h2>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <p className="text-base font-bold text-white">Halo {plan.name}</p>
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                                isFree
                                    ? "text-muted border-border"
                                    : "text-emerald-400 border-emerald-500/20 bg-emerald-500/10"
                            }`}>
                                {isFree ? "Free" : "Active"}
                            </span>
                        </div>
                        <p className="text-xs text-secondary">{plan.tagline}</p>
                        {!isFree && (
                            <p className="text-xs text-secondary">
                                ${plan.price.monthly}/mo · Billed monthly
                            </p>
                        )}
                    </div>

                    {isFree ? (
                        <Link href="/pricing" className="halo-btn halo-btn-primary flex-shrink-0">
                            <Zap size={13} />
                            Upgrade Plan
                        </Link>
                    ) : (
                        <button className="halo-btn halo-btn-secondary flex-shrink-0" disabled>
                            Manage via Stripe (coming soon)
                        </button>
                    )}
                </div>
            </div>

            {/* Compare plans */}
            {isFree && (
                <div className="halo-card p-6">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted border-b border-border pb-3 mb-5">
                        Available Plans
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {(["FREE", "DEVELOPER", "TEAM"] as const).map((pid) => {
                            const p = PLANS[pid];
                            const current = pid === planId;
                            return (
                                <div key={pid} className={`p-4 rounded-xl border ${current ? "border-accent bg-accent/5" : "border-border bg-surface"}`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-semibold text-white">{p.name}</p>
                                        {current && <span className="text-xs text-accent font-medium">Current</span>}
                                    </div>
                                    <p className="text-xs text-secondary mb-3">{p.tagline}</p>
                                    <p className="text-2xl font-bold text-white mb-3">
                                        {p.price.monthly === 0 ? "Free" : `$${p.price.monthly}/mo`}
                                    </p>
                                    {!current && (
                                        <Link href="/pricing" className="halo-btn halo-btn-primary w-full text-center text-xs py-1.5">
                                            See {p.name} plan
                                        </Link>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
