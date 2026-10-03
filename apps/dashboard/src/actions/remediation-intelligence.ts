"use server";

import { prisma } from "@/lib/prisma";
import {
    requireAuthenticatedUser,
    requireProjectAccess,
    requireCapability,
} from "@/lib/authorization";
import {
    generateRemediationRecommendations,
    getStoredRecommendations,
    updateRecommendationStatus as updateStatusEngine,
    addRecommendationNote as addNoteEngine,
    clearRemediationCache,
} from "@/lib/remediation-intelligence/remediation-engine";
import type {
    RemediationRecommendationDomain,
    RemediationNoteDomain,
    RemediationPlanResult,
    RemediationStatus,
} from "@/lib/remediation-intelligence/types";

/**
 * Authorize caller for Remediation Intelligence operations.
 * Enforces:
 *   1. User Authentication
 *   2. Project Access & Tenant Boundary
 *   3. Semantic capability: TEAM_REMEDIATION_INTELLIGENCE (requires TEAM plan)
 */
async function authorizeRemediationAccess(projectId: string) {
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
    await requireCapability(project.organizationId, "TEAM_REMEDIATION_INTELLIGENCE");

    return { user, access, organizationId: project.organizationId };
}

/**
 * Get or generate recommendations for an investigation.
 */
export async function getInvestigationRecommendations(
    investigationId: string
): Promise<RemediationPlanResult> {
    const investigation = await prisma.investigation.findUnique({
        where: { id: investigationId },
        select: {
            id: true,
            projectId: true,
            project: { select: { organizationId: true } },
        },
    });

    if (!investigation) {
        throw new Error(`Investigation ${investigationId} not found.`);
    }

    const { organizationId } = await authorizeRemediationAccess(investigation.projectId);

    return generateRemediationRecommendations({
        investigationId,
        organizationId,
        projectId: investigation.projectId,
        forceFresh: false,
    });
}

/**
 * Regenerate fresh recommendations for an investigation, recalculating from evidence synthesis.
 */
export async function regenerateInvestigationRecommendations(
    investigationId: string
): Promise<RemediationPlanResult> {
    const investigation = await prisma.investigation.findUnique({
        where: { id: investigationId },
        select: {
            id: true,
            projectId: true,
            project: { select: { organizationId: true } },
        },
    });

    if (!investigation) {
        throw new Error(`Investigation ${investigationId} not found.`);
    }

    const { organizationId } = await authorizeRemediationAccess(investigation.projectId);

    clearRemediationCache(organizationId, investigationId);

    return generateRemediationRecommendations({
        investigationId,
        organizationId,
        projectId: investigation.projectId,
        forceFresh: true,
    });
}

/**
 * Retrieve details for a specific recommendation.
 */
export async function getRecommendationDetails(
    recommendationId: string,
    projectId: string
): Promise<RemediationRecommendationDomain | null> {
    const { organizationId } = await authorizeRemediationAccess(projectId);

    const rec = await prisma.remediationRecommendation.findUnique({
        where: { id: recommendationId },
        include: {
            notes: {
                orderBy: { createdAt: "asc" },
                include: { user: { select: { name: true, email: true } } },
            },
        },
    });

    if (!rec) return null;

    if (rec.organizationId !== organizationId || rec.projectId !== projectId) {
        throw new Error("Tenant isolation violation: Access denied.");
    }

    return {
        id: rec.id,
        organizationId: rec.organizationId,
        projectId: rec.projectId,
        investigationId: rec.investigationId,
        recommendationKey: rec.recommendationKey,
        type: rec.type as any,
        status: rec.status as any,
        supportLevel: rec.supportLevel as any,
        riskLevel: rec.riskLevel as any,
        title: rec.title,
        summary: rec.summary,
        action: rec.action,
        rationale: rec.rationale,
        expectedOutcome: rec.expectedOutcome,
        validationMethod: rec.validationMethod,
        prerequisites: rec.prerequisites,
        evidenceReferences: rec.evidenceReferences,
        supportingClaimIds: rec.supportingClaimIds,
        affectedServices: rec.affectedServices,
        affectedOperations: rec.affectedOperations,
        affectedCodePaths: rec.affectedCodePaths,
        ownerContext: rec.ownerContext as any,
        uncertainty: rec.uncertainty,
        completedAt: rec.completedAt ? rec.completedAt.toISOString() : null,
        completedBy: rec.completedBy,
        dismissedAt: rec.dismissedAt ? rec.dismissedAt.toISOString() : null,
        dismissedBy: rec.dismissedBy,
        dismissalReason: rec.dismissalReason,
        historicalContext: rec.historicalContext as any,
        contradictionNotes: rec.contradictionNotes,
        notes: (rec.notes || []).map((n) => ({
            id: n.id,
            recommendationId: n.recommendationId,
            userId: n.userId,
            userEmail: n.user?.email || null,
            userName: n.user?.name || null,
            content: n.content,
            createdAt: n.createdAt.toISOString(),
        })),
        metadata: rec.metadata as any,
        createdAt: rec.createdAt.toISOString(),
        updatedAt: rec.updatedAt.toISOString(),
    };
}

/**
 * Update the status of a recommendation by human action.
 */
export async function updateRecommendationStatus(params: {
    recommendationId: string;
    projectId: string;
    status: RemediationStatus;
    reason?: string;
}): Promise<RemediationRecommendationDomain> {
    const { recommendationId, projectId, status, reason } = params;
    const { user, organizationId } = await authorizeRemediationAccess(projectId);

    return updateStatusEngine({
        recommendationId,
        projectId,
        organizationId,
        userId: user.id,
        status,
        dismissalReason: reason,
    });
}

/**
 * Record a human note on a recommendation (Human assertion, never automated system fact).
 */
export async function recordRecommendationNote(params: {
    recommendationId: string;
    projectId: string;
    content: string;
}): Promise<RemediationNoteDomain> {
    const { recommendationId, projectId, content } = params;
    const { user, organizationId } = await authorizeRemediationAccess(projectId);

    if (!content || !content.trim()) {
        throw new Error("Note content cannot be empty.");
    }

    return addNoteEngine({
        recommendationId,
        projectId,
        organizationId,
        userId: user.id,
        content: content.trim(),
    });
}
