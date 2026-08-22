/**
 * Server-side entitlement enforcement for Halo.
 *
 * All feature checks and limit checks must go through this module.
 * Hiding a UI button is NOT enforcement — these functions must be
 * called in server actions and API routes before performing any
 * plan-restricted operation.
 */

import { prisma } from "@/lib/prisma";
import {
    PLANS,
    type PlanFeatures,
    type PlanId,
    type PlanLimits,
} from "@/lib/plans";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getOrgPlan(organizationId: string): Promise<PlanId> {
    try {
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { plan: true },
        });

        if (!org) return "FREE";
        return ((org as any).plan as PlanId) ?? "FREE";
    } catch {
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
        });
        return ((org as any)?.plan as PlanId) ?? "FREE";
    }
}

async function getOrgIdForUser(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { organizationId: true },
    });

    if (!user?.organizationId) {
        throw new Error("User has no organization");
    }

    return user.organizationId;
}

// ---------------------------------------------------------------------------
// Feature entitlement check
// ---------------------------------------------------------------------------

export type FeatureCheckResult =
    | { allowed: true }
    | { allowed: false; requiredPlan: PlanId; currentPlan: PlanId };

/**
 * Check whether the organization owning `userId` has access to a feature.
 * Call this in server actions/route handlers before doing plan-gated work.
 */
export async function checkFeature(
    userId: string,
    feature: keyof PlanFeatures
): Promise<FeatureCheckResult> {
    const orgId = await getOrgIdForUser(userId);
    const planId = await getOrgPlan(orgId);
    const plan = PLANS[planId];

    if (plan.features[feature]) {
        return { allowed: true };
    }

    // Find minimum plan that has this feature
    const planOrder: PlanId[] = ["FREE", "DEVELOPER", "TEAM"];
    const requiredPlan =
        planOrder.find((p) => PLANS[p].features[feature]) ?? "TEAM";

    return { allowed: false, requiredPlan, currentPlan: planId };
}

// ---------------------------------------------------------------------------
// Limit check
// ---------------------------------------------------------------------------

export type LimitKey = keyof PlanLimits;

export type LimitCheckResult =
    | { allowed: true; current: number; max: number | null }
    | { allowed: false; current: number; max: number; currentPlan: PlanId };

/**
 * Check whether the organization is within a specific usage limit.
 * Returns current usage and the plan's maximum.
 */
export async function checkLimit(
    userId: string,
    limit: LimitKey,
    currentUsage: number
): Promise<LimitCheckResult> {
    const orgId = await getOrgIdForUser(userId);
    const planId = await getOrgPlan(orgId);
    const max = PLANS[planId].limits[limit];

    // null means unlimited for this plan
    if (max === null) {
        return { allowed: true, current: currentUsage, max: null };
    }

    if (currentUsage < max) {
        return { allowed: true, current: currentUsage, max };
    }

    return { allowed: false, current: currentUsage, max, currentPlan: planId };
}

// ---------------------------------------------------------------------------
// Convenience: get full plan info for an organization
// ---------------------------------------------------------------------------

export async function getOrgEntitlements(organizationId: string) {
    const planId = await getOrgPlan(organizationId);
    return {
        planId,
        plan: PLANS[planId],
    };
}

/**
 * Get the plan for the organization that owns `userId`.
 * Used in server components to render plan-aware UI.
 */
export async function getUserOrgEntitlements(userId: string) {
    const orgId = await getOrgIdForUser(userId);
    return getOrgEntitlements(orgId);
}
