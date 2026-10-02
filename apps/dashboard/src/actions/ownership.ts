"use server";

import { prisma } from "@/lib/prisma";
import {
    requireAuthenticatedUser,
    requireProjectAccess,
    requireCapability,
} from "@/lib/authorization";
import {
    resolveServiceOwnership,
    resolveInvestigationOwnership,
    type ServiceOwnershipResult,
    type InvestigationOwnershipContext,
} from "@/lib/ownership/ownership-engine";

/**
 * Authorize caller for ownership intelligence operations.
 * Enforces:
 *   1. Authentication
 *   2. Project Access & Tenant Boundary
 *   3. Semantic capability: TEAM_OWNERSHIP_INTELLIGENCE (requires TEAM plan)
 */
async function authorizeOwnershipAccess(projectId: string) {
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
    await requireCapability(project.organizationId, "TEAM_OWNERSHIP_INTELLIGENCE");

    return { user, access, organizationId: project.organizationId };
}

/**
 * Resolves ownership context for an ongoing or completed investigation.
 */
export async function getInvestigationOwnership(
    investigationId: string
): Promise<InvestigationOwnershipContext> {
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

    const { organizationId } = await authorizeOwnershipAccess(investigation.projectId);

    return resolveInvestigationOwnership({
        investigationId,
        organizationId,
    });
}

/**
 * Resolves ownership for an individual service within a project.
 */
export async function getServiceOwnership(
    projectId: string,
    serviceName: string,
    sourcePath?: string
): Promise<ServiceOwnershipResult> {
    const { organizationId } = await authorizeOwnershipAccess(projectId);

    return resolveServiceOwnership({
        serviceName,
        projectId,
        organizationId,
        sourcePath,
    });
}

/**
 * Declares or updates explicit service ownership configuration.
 * Strictly records previous owner in history to support historical audits.
 */
export async function configureServiceOwnership(params: {
    projectId: string;
    serviceName: string;
    declaredOwner: string;
    declaredTeam?: string;
    ownerType?: "TEAM" | "INDIVIDUAL" | "EXTERNAL_GROUP";
    sourcePath?: string;
    repositoryUrl?: string;
    commitSha?: string;
    reason?: string;
}) {
    const {
        projectId,
        serviceName,
        declaredOwner,
        declaredTeam,
        ownerType = "TEAM",
        sourcePath,
        repositoryUrl,
        commitSha,
        reason,
    } = params;

    const { organizationId } = await authorizeOwnershipAccess(projectId);

    // Check existing configuration
    const existing = await prisma.serviceOwnership.findFirst({
        where: {
            organizationId,
            projectId,
            serviceName,
            source: "SERVICE_CONFIG",
        },
    });

    // Record change history if owner changed
    if (existing && existing.declaredOwner !== declaredOwner) {
        await prisma.serviceOwnershipHistory.create({
            data: {
                organizationId,
                projectId,
                serviceName,
                previousOwner: existing.declaredOwner,
                newOwner: declaredOwner,
                source: "SERVICE_CONFIG",
                sourceVersion: commitSha || undefined,
                reason: reason || "Updated service ownership configuration",
            },
        });
    }

    // Upsert explicit service ownership record
    const result = await prisma.serviceOwnership.upsert({
        where: {
            organizationId_projectId_serviceName_source: {
                organizationId,
                projectId,
                serviceName,
                source: "SERVICE_CONFIG",
            },
        },
        update: {
            declaredOwner,
            declaredTeam: declaredTeam || declaredOwner,
            ownerType,
            classification: "DECLARED",
            sourcePath: sourcePath || null,
            repositoryUrl: repositoryUrl || null,
            commitSha: commitSha || null,
            confidenceLevel: "HIGH",
            updatedAt: new Date(),
        },
        create: {
            organizationId,
            projectId,
            serviceName,
            declaredOwner,
            declaredTeam: declaredTeam || declaredOwner,
            ownerType,
            classification: "DECLARED",
            source: "SERVICE_CONFIG",
            sourcePath: sourcePath || null,
            repositoryUrl: repositoryUrl || null,
            commitSha: commitSha || null,
            confidenceLevel: "HIGH",
        },
    });

    return result;
}

/**
 * Records a human ownership assertion.
 * Strictly tagged as HUMAN ASSERTION; never silently promotes to declared ownership.
 */
export async function recordHumanOwnershipAssertion(params: {
    projectId: string;
    serviceName: string;
    proposedOwner: string;
    statement: string;
    scope?: string;
}) {
    const { projectId, serviceName, proposedOwner, statement, scope } = params;
    const { user, organizationId } = await authorizeOwnershipAccess(projectId);

    return prisma.serviceOwnershipAssertion.create({
        data: {
            organizationId,
            projectId,
            serviceName,
            authorId: user.id,
            authorName: user.name || "Anonymous Engineer",
            authorEmail: user.email,
            statement,
            proposedOwner,
            scope: scope || `service: ${serviceName}`,
            classification: "HUMAN_ASSERTION",
        },
    });
}

/**
 * Retrieves ownership audit trail / change history for a service.
 */
export async function getServiceOwnershipHistory(
    projectId: string,
    serviceName: string
) {
    const { organizationId } = await authorizeOwnershipAccess(projectId);

    return prisma.serviceOwnershipHistory.findMany({
        where: {
            organizationId,
            serviceName,
            OR: [{ projectId }, { projectId: null }],
        },
        orderBy: { changedAt: "desc" },
    });
}
