"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import type { PlanFeatures, PlanId } from "@/lib/plans";
import { PLANS } from "@/lib/plans";

type FeatureGateProps = {
    /** The plan required for this feature */
    requiredPlan: PlanId;
    /** The user's current plan */
    currentPlan: PlanId;
    /** Human-readable feature name */
    featureName: string;
    /** Short description of what the feature does */
    featureDescription?: string;
    /** When allowed, render children */
    children: React.ReactNode;
    /** Optional: render inline (no card wrapper) */
    inline?: boolean;
};

/**
 * Wraps a feature in a plan gate.
 *
 * If the user's current plan includes the feature, renders children.
 * Otherwise renders a clear "upgrade required" prompt that shows what the
 * feature is, what plan unlocks it, and a CTA.
 *
 * Never hides features completely — the user should always see what they're
 * missing and know how to unlock it.
 */
export function FeatureGate({
    requiredPlan,
    currentPlan,
    featureName,
    featureDescription,
    children,
    inline = false,
}: FeatureGateProps) {
    const planOrder: PlanId[] = ["FREE", "DEVELOPER", "TEAM"];
    const currentIndex = planOrder.indexOf(currentPlan);
    const requiredIndex = planOrder.indexOf(requiredPlan);
    const hasAccess = currentIndex >= requiredIndex;

    if (hasAccess) {
        return <>{children}</>;
    }

    const requiredPlanName = PLANS[requiredPlan].name;

    if (inline) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface text-sm text-secondary">
                <Lock size={13} className="text-muted flex-shrink-0" />
                <span>{featureName}</span>
                <span className="text-xs text-muted">·</span>
                <Link
                    href="/settings/billing"
                    className="text-xs text-accent hover:underline font-medium"
                >
                    {requiredPlanName}+
                </Link>
            </div>
        );
    }

    return (
        <div className="halo-card p-8 flex flex-col items-center text-center gap-4 border-dashed">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-surface-elevated border border-border">
                <Lock size={18} className="text-muted" />
            </div>

            <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-white">{featureName}</h3>
                {featureDescription && (
                    <p className="text-xs text-secondary leading-relaxed max-w-sm">
                        {featureDescription}
                    </p>
                )}
            </div>

            <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-muted">
                    Available on{" "}
                    <span className="text-white font-medium">{requiredPlanName}</span> and
                    above.
                </p>
                <Link
                    href="/settings/billing"
                    className="halo-btn halo-btn-primary halo-btn-sm"
                >
                    Upgrade to {requiredPlanName}
                </Link>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Convenience wrapper — accepts server-fetched entitlement data directly
// ---------------------------------------------------------------------------

type FeatureGateFromEntitlementProps = {
    /** Result from getUserOrgEntitlements().plan.features[feature] */
    hasAccess: boolean;
    requiredPlan: PlanId;
    featureName: string;
    featureDescription?: string;
    children: React.ReactNode;
    inline?: boolean;
};

export function FeatureGateFromEntitlement({
    hasAccess,
    requiredPlan,
    featureName,
    featureDescription,
    children,
    inline = false,
}: FeatureGateFromEntitlementProps) {
    if (hasAccess) return <>{children}</>;

    return (
        <FeatureGate
            requiredPlan={requiredPlan}
            currentPlan="FREE" // Conservative fallback for rendering
            featureName={featureName}
            featureDescription={featureDescription}
            inline={inline}
        >
            {children}
        </FeatureGate>
    );
}
