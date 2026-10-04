"use server";

import { prisma } from "@/lib/prisma";
import {
    requireAuthenticatedUser,
    requireProjectAccess,
    requireCapability,
} from "@/lib/authorization";
import {
    verifyRemediationRecommendation,
    getLatestRemediationVerification,
    getRemediationVerificationHistory,
    clearVerificationCache,
} from "@/lib/remediation-verification/verification-engine";
import type {
    RemediationVerificationDomain,
    VerificationHistoryResult,
} from "@/lib/remediation-verification/types";

/**
 * Authorize caller for Remediation Verification operations.
 * Enforces:
 *   1. User Authentication
 *   2. Project Access & Tenant Boundary
 *   3. Semantic capability: TEAM_REMEDIATION_VERIFICATION (requires TEAM plan)
 */
async function authorizeVerificationAccess(projectId: string) {
    const { user } = await requireAuthenticatedUser();
    const access = await requireProjectAccess(projectId);

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true },
    });

    if (!project) {
        throw new Error(`Project ${projectId} not found.`);
    }

    // Authoritative capability check
    await requireCapability(project.organizationId, "TEAM_REMEDIATION_VERIFICATION");

    return { user, access, organizationId: project.organizationId };
}

/**
 * Retrieve the latest verification result for a recommendation.
 */
export async function getRemediationVerification(
    recommendationId: string,
    projectId: string
): Promise<RemediationVerificationDomain | null> {
    const { organizationId } = await authorizeVerificationAccess(projectId);

    // Verify recommendation belongs to the project and organization
    const recommendation = await prisma.remediationRecommendation.findUnique({
        where: { id: recommendationId },
        select: { id: true, projectId: true, organizationId: true },
    });

    if (!recommendation || recommendation.projectId !== projectId || recommendation.organizationId !== organizationId) {
        throw new Error("Unauthorized: Recommendation not found in target project.");
    }

    return getLatestRemediationVerification(recommendationId, projectId);
}

/**
 * Run or recalculate remediation verification for a recommendation.
 */
export async function runRemediationVerification(params: {
    recommendationId: string;
    projectId: string;
    forceFresh?: boolean;
    customPostWindowMs?: number;
}): Promise<RemediationVerificationDomain> {
    const { recommendationId, projectId, forceFresh, customPostWindowMs } = params;
    const { organizationId } = await authorizeVerificationAccess(projectId);

    // Verify recommendation belongs to the project and organization
    const recommendation = await prisma.remediationRecommendation.findUnique({
        where: { id: recommendationId },
        select: { id: true, projectId: true, organizationId: true },
    });

    if (!recommendation || recommendation.projectId !== projectId || recommendation.organizationId !== organizationId) {
        throw new Error("Unauthorized: Recommendation not found in target project.");
    }

    if (forceFresh) {
        clearVerificationCache(organizationId, projectId, recommendationId);
    }

    return verifyRemediationRecommendation({
        recommendationId,
        organizationId,
        projectId,
        forceFresh: Boolean(forceFresh),
        customPostWindowMs,
    });
}

/**
 * Retrieve the complete verification observation history for a recommendation.
 */
export async function getVerificationHistory(
    recommendationId: string,
    projectId: string
): Promise<VerificationHistoryResult> {
    const { organizationId } = await authorizeVerificationAccess(projectId);

    const recommendation = await prisma.remediationRecommendation.findUnique({
        where: { id: recommendationId },
        select: { id: true, projectId: true, organizationId: true },
    });

    if (!recommendation || recommendation.projectId !== projectId || recommendation.organizationId !== organizationId) {
        throw new Error("Unauthorized: Recommendation not found in target project.");
    }

    const history = await getRemediationVerificationHistory(recommendationId, projectId);

    return {
        recommendationId,
        projectId,
        organizationId,
        verifications: history,
        totalCount: history.length,
    };
}
