"use server";

import { prisma } from "@/lib/prisma";
import {
    requireAuthenticatedUser,
    requireProjectAccess,
    requireCapability,
} from "@/lib/authorization";
import {
    generateIncidentMemoryRecord,
    formatMemoryForComparison,
} from "@/lib/investigation/incident-memory/generator";
import {
    compareIncidents,
    rankHistoricalMatches,
    incidentMemoryCache,
    type IncidentComparisonResult,
} from "@/lib/investigation/incident-memory/similarity-engine";
import {
    generateInvestigationPostmortem,
    type GeneratedPostmortem,
} from "@/lib/investigation/incident-memory/postmortem-generator";

/**
 * Authorize caller for an investigation and verify Team Organizational Memory & Continuous Learning entitlement.
 */
async function authorizeIncidentMemoryAccess(investigationId: string) {
    const { user } = await requireAuthenticatedUser();

    const investigation = await prisma.investigation.findUnique({
        where: { id: investigationId },
        select: {
            id: true,
            projectId: true,
            project: {
                select: {
                    id: true,
                    organizationId: true,
                },
            },
        },
    });

    if (!investigation) {
        throw new Error(`Investigation ${investigationId} not found.`);
    }

    const access = await requireProjectAccess(investigation.projectId);
    
    // Verify capability - either TEAM_CONTINUOUS_INCIDENT_LEARNING or TEAM_ORGANIZATIONAL_MEMORY
    try {
        await requireCapability(investigation.project.organizationId, "TEAM_CONTINUOUS_INCIDENT_LEARNING");
    } catch {
        await requireCapability(investigation.project.organizationId, "TEAM_ORGANIZATIONAL_MEMORY");
    }

    return { user, investigation, access };
}

/**
 * Generate or refresh materialized memory for a completed investigation.
 */
export async function generateIncidentMemory(investigationId: string) {
    await authorizeIncidentMemoryAccess(investigationId);
    return generateIncidentMemoryRecord(investigationId);
}

/**
 * Retrieve historically relevant incidents for an investigation.
 * Strict Tenant Boundary: Only compares against completed investigations within
 * the caller's organization and accessible projects.
 */
export async function getRelevantHistoricalIncidents(
    currentInvestigationId: string,
    options?: { forceFresh?: boolean }
): Promise<{
    currentInvestigationId: string;
    totalHistoricalCandidates: number;
    matches: IncidentComparisonResult[];
    explanationSummary: string;
}> {
    const { investigation } = await authorizeIncidentMemoryAccess(
        currentInvestigationId
    );

    // Ensure current investigation has a materialized memory representation
    let currentMemory = await prisma.incidentMemory.findUnique({
        where: { investigationId: currentInvestigationId },
        include: { remediationOutcomes: true },
    });
    if (!currentMemory) {
        await generateIncidentMemoryRecord(currentInvestigationId);
        currentMemory = await prisma.incidentMemory.findUnique({
            where: { investigationId: currentInvestigationId },
            include: { remediationOutcomes: true },
        });
    }

    if (!currentMemory) {
        throw new Error("Failed to generate incident memory representation");
    }

    // Check tenant-safe in-memory cache
    const cacheKey = `${investigation.project.organizationId}:${investigation.projectId}:${currentInvestigationId}:${currentMemory.memoryVersion}`;
    if (!options?.forceFresh) {
        const cached = incidentMemoryCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.data;
        }
    }

    const currentComparisonInput = formatMemoryForComparison(currentMemory);

    // Retrieve historical candidates within the SAME organization (excluding current investigation)
    // and bounded to COMPLETED status
    const candidates = await prisma.incidentMemory.findMany({
        where: {
            organizationId: investigation.project.organizationId,
            investigationId: { not: currentInvestigationId },
            status: "COMPLETED",
        },
        include: {
            remediationOutcomes: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50, // bounded retrieval to prevent N+1 query explosion
    });

    const rawMatches: IncidentComparisonResult[] = [];

    for (const candidate of candidates) {
        const histInput = formatMemoryForComparison(candidate);
        const result = compareIncidents(currentComparisonInput, histInput);

        // Include historical verdicts and recommendations in result
        result.historicalVerdicts = (candidate.humanVerdicts as any[]) || [];
        result.historicalRecommendations = (candidate.recommendations as any[]) || [];

        if (result.classification !== "NO_MEANINGFUL_MATCH") {
            rawMatches.push(result);
        }
    }

    // Apply deterministic ranking (tier > score > outcome relevance > recency > ID)
    const matches = rankHistoricalMatches(rawMatches);

    let explanationSummary = "";
    if (matches.length === 0) {
        explanationSummary = "No relevant historical incidents found matching current failure characteristics.";
    } else {
        const strongCount = matches.filter((m) => m.classification === "STRONG_STRUCTURAL_MATCH").length;
        const regressedCount = matches.filter((m) => m.historicalOutcome === "REGRESSED").length;
        explanationSummary = `Found ${matches.length} historically relevant incident(s) (${strongCount} strong structural match${regressedCount > 0 ? `, ${regressedCount} historical regression caution` : ""}). Historical context is provided for comparison.`;
    }

    const response = {
        currentInvestigationId,
        totalHistoricalCandidates: candidates.length,
        matches,
        explanationSummary,
    };

    // Store in tenant-safe cache with 60s TTL
    incidentMemoryCache.set(cacheKey, {
        data: response,
        expiresAt: Date.now() + 60000,
    });

    return response;
}

/**
 * Retrieve comprehensive details for a specific historical incident to display in drawer/preview.
 */
export async function getHistoricalIncidentDetails(historicalInvestigationId: string) {
    const { investigation } = await authorizeIncidentMemoryAccess(
        historicalInvestigationId
    );

    const memory = await prisma.incidentMemory.findUnique({
        where: { investigationId: historicalInvestigationId },
        include: {
            remediationOutcomes: true,
            investigation: {
                select: {
                    id: true,
                    title: true,
                    summary: true,
                    rootCause: true,
                    confidenceScore: true,
                    status: true,
                    createdAt: true,
                    completedAt: true,
                },
            },
        },
    });

    if (!memory) {
        throw new Error(`Incident memory for ${historicalInvestigationId} not found.`);
    }

    return {
        investigationId: memory.investigationId,
        projectId: memory.projectId,
        title: memory.title,
        normalizedTitle: memory.normalizedTitle,
        primaryService: memory.primaryService,
        primaryOperation: memory.primaryOperation,
        errorType: memory.errorType,
        rootCause: memory.rootCause,
        confidenceScore: memory.confidenceScore,
        status: memory.status,
        affectedServices: memory.affectedServices,
        causalChainSummary: memory.causalChainSummary,
        topologyEdges: memory.topologyEdges,
        evidenceReferences: memory.evidenceReferences,
        humanVerdicts: memory.humanVerdicts,
        recommendations: memory.recommendations,
        verifiedOutcome: memory.verifiedOutcome,
        verificationStrength: memory.verificationStrength,
        changeCharacteristics: memory.changeCharacteristics,
        ownershipContext: memory.ownershipContext,
        resolvedAt: memory.resolvedAt ? memory.resolvedAt.toISOString() : null,
        remediationOutcomes: memory.remediationOutcomes.map((o) => ({
            id: o.id,
            remediationType: o.remediationType,
            verificationResult: o.verificationResult,
            verificationStrength: o.verificationStrength,
            actionSummary: o.actionSummary,
            evidenceReferences: o.evidenceReferences,
            observedAt: o.observedAt.toISOString(),
        })),
        createdAt: memory.createdAt.toISOString(),
    };
}

/**
 * Retrieve recurring failure patterns for an organization or project.
 */
export async function getRecurringFailurePatterns(projectId: string) {
    const access = await requireProjectAccess(projectId);
    try {
        await requireCapability(access.organization.id, "TEAM_CONTINUOUS_INCIDENT_LEARNING");
    } catch {
        await requireCapability(access.organization.id, "TEAM_ORGANIZATIONAL_MEMORY");
    }

    const patterns = await prisma.failurePattern.findMany({
        where: { organizationId: access.organization.id },
        orderBy: { lastSeenAt: "desc" },
        take: 20,
    });

    return patterns.map((p) => ({
        id: p.id,
        patternKey: p.patternKey,
        title: p.title,
        primaryService: p.primaryService,
        affectedServices: p.affectedServices,
        incidentCount: p.incidentCount,
        firstSeenAt: p.firstSeenAt.toISOString(),
        lastSeenAt: p.lastSeenAt.toISOString(),
        investigationIds: p.investigationIds,
        commonCausalSummary: p.commonCausalSummary,
        verifiedResolutionCount: p.verifiedResolutionCount,
        improvementCount: p.improvementCount,
        nonResolutionCount: p.nonResolutionCount,
        regressionCount: p.regressionCount,
        status: p.status,
        commonChanges: p.commonChanges,
        historicalRemediations: p.historicalRemediations,
    }));
}

/**
 * Generate an evidence-backed postmortem report for an investigation.
 */
export async function generateInvestigationPostmortemAction(investigationId: string): Promise<GeneratedPostmortem> {
    await authorizeIncidentMemoryAccess(investigationId);
    return generateInvestigationPostmortem(investigationId);
}
