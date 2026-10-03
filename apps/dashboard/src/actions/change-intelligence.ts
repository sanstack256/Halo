"use server";

import { prisma } from "@/lib/prisma";
import {
    requireAuthenticatedUser,
    requireProjectAccess,
    requireCapability,
} from "@/lib/authorization";
import {
    resolveInvestigationChanges,
} from "@/lib/change-intelligence/change-engine";
import {
    ingestChangeObservation,
} from "@/lib/change-intelligence/git-collector";
import {
    type IngestChangeObservationInput,
    type InvestigationChangeContext,
    type AnalyzedChangeCandidate,
} from "@/lib/change-intelligence/types";

/**
 * Authorize caller for Change Intelligence operations.
 * Enforces:
 *   1. User Authentication
 *   2. Project Access & Tenant Boundary
 *   3. Semantic capability: TEAM_CHANGE_INTELLIGENCE (requires TEAM plan)
 */
async function authorizeChangeAccess(projectId: string) {
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
    await requireCapability(project.organizationId, "TEAM_CHANGE_INTELLIGENCE");

    return { user, access, organizationId: project.organizationId };
}

/**
 * Resolves all correlated change intelligence for an investigation.
 */
export async function getInvestigationChanges(
    investigationId: string
): Promise<InvestigationChangeContext> {
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

    const { organizationId } = await authorizeChangeAccess(investigation.projectId);

    return resolveInvestigationChanges({
        investigationId,
        organizationId,
    });
}

/**
 * Retrieves details for a specific canonical change observation.
 * Strictly verifies project and tenant boundaries.
 * Never exposes credentials or tokens.
 */
export async function getChangeDetails(
    changeId: string,
    projectId: string
): Promise<AnalyzedChangeCandidate | null> {
    const { organizationId } = await authorizeChangeAccess(projectId);

    const obs = await prisma.changeObservation.findFirst({
        where: {
            id: changeId,
            projectId,
            organizationId,
        },
    });

    if (!obs) {
        return null;
    }

    const rawFiles = Array.isArray(obs.changedFiles) ? (obs.changedFiles as any[]) : [];
    const formattedFiles = rawFiles.map((f) => ({
        filePath: f.filePath || String(f),
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
        intersectsFailingPath: false,
        lineIntersection: "UNAVAILABLE" as const,
    }));

    return {
        id: obs.id,
        projectId: obs.projectId,
        organizationId: obs.organizationId,
        changeKey: obs.changeKey,
        sourceType: obs.sourceType as any,
        sourceVersion: obs.sourceVersion,
        repository: obs.repository,
        commitSha: obs.commitSha,
        parentCommitSha: obs.parentCommitSha,
        commitMessage: obs.commitMessage,
        authorIdentity: obs.authorIdentity, // Author != owner != culprit
        authorTimestamp: obs.authorTimestamp,
        branch: obs.branch,
        ref: obs.ref,
        deploymentReference: obs.deploymentReference,
        pullRequestReference: obs.pullRequestReference,
        serviceAssociation: obs.serviceAssociation,
        codePathAssociation: obs.codePathAssociation,
        changedFiles: formattedFiles,
        additions: obs.additions,
        deletions: obs.deletions,
        observedAt: obs.observedAt,
        relationship: "INSUFFICIENT_EVIDENCE",
        evidenceDimensions: {
            temporalAlignment: "NONE",
            serviceIntersection: "NONE",
            fileIntersection: "NONE",
            lineIntersection: "UNAVAILABLE",
            behavioralDivergence: "INSUFFICIENT_EVIDENCE",
            deploymentLinkage: "NOT_OBSERVED",
            directCausalEvidence: "NOT_OBSERVED",
        },
        explanation: {
            matchingSignals: [],
            missingSignals: ["Queried outside investigation context."],
            contradictingSignals: [],
            evidenceReferences: obs.evidenceReferences,
            explanation: "Candidate retrieved in isolation without investigation context.",
        },
        metadata: (obs.metadata as Record<string, any>) || null,
    };
}

/**
 * Computes the impact of a specific change within an investigation's failure graph.
 */
export async function getChangeImpact(
    changeId: string,
    investigationId: string
) {
    const investigation = await prisma.investigation.findUnique({
        where: { id: investigationId },
        select: { projectId: true },
    });

    if (!investigation) {
        throw new Error(`Investigation ${investigationId} not found.`);
    }

    const { organizationId } = await authorizeChangeAccess(investigation.projectId);

    const context = await resolveInvestigationChanges({
        investigationId,
        organizationId,
    });

    const candidate = context.changes.find((c) => c.id === changeId || c.commitSha === changeId);
    if (!candidate) {
        throw new Error(`Change ${changeId} not found in investigation ${investigationId}.`);
    }

    return {
        changeId: candidate.id,
        commitSha: candidate.commitSha,
        sourceType: candidate.sourceType,
        service: candidate.serviceAssociation,
        relationship: candidate.relationship,
        affectedServices: context.affectedServices,
        rootCauseService: context.rootCauseService,
        intersectsFailingPath: candidate.changedFiles.some((f) => f.intersectsFailingPath),
        matchingSignals: candidate.explanation.matchingSignals,
        contradictingSignals: candidate.explanation.contradictingSignals,
        declaredOwner: candidate.declaredOwner,
        ownershipSource: candidate.ownershipSource,
    };
}

/**
 * Ingests a verified change observation into the project's canonical change store.
 * Idempotently merges with existing records.
 */
export async function recordChangeObservation(params: IngestChangeObservationInput) {
    const { organizationId } = await authorizeChangeAccess(params.projectId);

    if (params.organizationId !== organizationId) {
        throw new Error("Tenant isolation violation: organizationId mismatch.");
    }

    return ingestChangeObservation(params);
}
