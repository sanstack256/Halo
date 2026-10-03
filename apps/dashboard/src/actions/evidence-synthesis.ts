"use server";

import { prisma } from "@/lib/prisma";
import {
    requireAuthenticatedUser,
    requireProjectAccess,
    requireCapability,
} from "@/lib/authorization";
import {
    synthesizeInvestigationEvidence,
} from "@/lib/evidence-synthesis/synthesis-engine";
import type {
    InvestigationSynthesis,
    EvidenceClaim,
    EvidenceChain,
} from "@/lib/evidence-synthesis/types";

/**
 * Authorize caller for Evidence Synthesis operations.
 * Enforces:
 *   1. User Authentication
 *   2. Project Access & Tenant Boundary
 *   3. Semantic capability: TEAM_EVIDENCE_SYNTHESIS (requires TEAM plan)
 */
async function authorizeSynthesisAccess(projectId: string) {
    const { user } = await requireAuthenticatedUser();
    const access = await requireProjectAccess(projectId);

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true },
    });

    if (!project) {
        throw new Error(`Project ${projectId} not found.`);
    }

    // Server-side authoritative capability check.
    // Throws AuthorizationError("TEAM_PLAN_REQUIRED", ...) on Developer / Free plans.
    await requireCapability(project.organizationId, "TEAM_EVIDENCE_SYNTHESIS");

    return { user, access, organizationId: project.organizationId };
}

/**
 * Resolves full deterministic evidence synthesis for an investigation.
 */
export async function getInvestigationSynthesis(
    investigationId: string
): Promise<InvestigationSynthesis> {
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

    const { organizationId } = await authorizeSynthesisAccess(investigation.projectId);

    return synthesizeInvestigationEvidence({
        investigationId,
        organizationId,
    });
}

/**
 * Retrieves details for a specific claim within an investigation.
 */
export async function getEvidenceClaim(
    claimId: string,
    projectId: string
): Promise<EvidenceClaim | null> {
    const { organizationId } = await authorizeSynthesisAccess(projectId);

    // Find the investigation associated with this project that contains the claim
    const investigations = await prisma.investigation.findMany({
        where: { projectId },
        select: { id: true },
        take: 5,
        orderBy: { updatedAt: "desc" },
    });

    for (const inv of investigations) {
        const synthesis = await synthesizeInvestigationEvidence({
            investigationId: inv.id,
            organizationId,
        });

        const matched = synthesis.claims.find((c) => c.claimId === claimId);
        if (matched) {
            return matched;
        }
    }

    return null;
}

/**
 * Resolves the deterministic evidence chain for an investigation.
 */
export async function getEvidenceChain(
    investigationId: string
): Promise<EvidenceChain> {
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

    const { organizationId } = await authorizeSynthesisAccess(investigation.projectId);

    const synthesis = await synthesizeInvestigationEvidence({
        investigationId,
        organizationId,
    });

    return synthesis.chain;
}
