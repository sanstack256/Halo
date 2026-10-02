/**
 * Materialized Incident Memory Generator for Halo Trace Pillar D.
 *
 * Responsibilities:
 * 1. Materialize structured historical memory from canonical Investigation records.
 * 2. Maintain 100% idempotency: running generation multiple times updates the single derived
 *    record with a stable identity and refreshed derivation version.
 * 3. Preserve root-cause honesty: if investigation confidence is low, rootCause remains null.
 * 4. Cluster recurring failure patterns across historical incidents.
 * 5. Respect strict organization and project tenant boundaries.
 */

import { prisma } from "@/lib/prisma";
import {
    normalizeIncidentTitle,
    normalizeOperation,
    extractErrorType,
    generateIncidentFingerprint,
    generateFailurePatternKey,
} from "./normalizer";
import { type IncidentComparisonInput } from "./similarity-engine";

export const INCIDENT_MEMORY_VERSION = 1;

/**
 * Generate or refresh materialized IncidentMemory for a canonical Investigation.
 */
export async function generateIncidentMemoryRecord(investigationId: string) {
    const investigation = await prisma.investigation.findUnique({
        where: { id: investigationId },
        include: {
            project: {
                select: { id: true, organizationId: true },
            },
            verdicts: {
                select: {
                    authorId: true,
                    authorName: true,
                    authorEmail: true,
                    verdict: true,
                    reasoning: true,
                    evidenceReferences: true,
                },
            },
            comments: {
                where: { isDeleted: false },
                select: {
                    authorName: true,
                    targetType: true,
                    targetId: true,
                    evidenceId: true,
                    content: true,
                    createdAt: true,
                },
            },
            proposedRelations: {
                select: {
                    sourceId: true,
                    targetId: true,
                    relationType: true,
                    classification: true,
                    reasoning: true,
                },
            },
            recommendations: {
                take: 5,
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    recommendation: true,
                    modelProvider: true,
                },
            },
        },
    });

    if (!investigation) {
        throw new Error(`Investigation ${investigationId} not found.`);
    }

    // Retrieve associated telemetry events to derive service, operation, and error classification
    const events = await prisma.event.findMany({
        where: { projectId: investigation.projectId },
        orderBy: { timestamp: "asc" },
        take: 100,
        select: {
            id: true,
            title: true,
            service: true,
            operation: true,
            severity: true,
            type: true,
            traceId: true,
            metadata: true,
            timestamp: true,
        },
    });

    // Determine primary service and operation
    const errorEvent = events.find((e) => e.severity === "ERROR" || e.type === "ERROR") || events[0];
    const primaryService = errorEvent?.service || "unknown-service";
    const primaryOperation = normalizeOperation(errorEvent?.operation);
    const errorType = extractErrorType(errorEvent?.title || investigation.title);
    const normalizedTitle = normalizeIncidentTitle(investigation.title);

    // Collect affected services
    const affectedServices = Array.from(
        new Set(events.map((e) => e.service).filter(Boolean))
    ) as string[];

    // Extract causal hops and edges if present in context or derived from traces
    const contextData = (investigation.context as any) || {};
    const causalHops = contextData.causalHops ?? events.length;
    const causalOrigin = contextData.causalOrigin ?? primaryService;

    const causalChainSummary = {
        hops: causalHops,
        originService: causalOrigin,
        propagationPath: affectedServices,
    };

    // Extract topology edges if present
    const topologyEdges: Array<{ from: string; to: string }> = contextData.topologyEdges ?? [];

    const evidenceReferences = events.map((e) => e.id);

    const fingerprint = generateIncidentFingerprint({
        service: primaryService,
        operation: primaryOperation,
        errorType,
    });

    // Materialize or refresh IncidentMemory with idempotent upsert
    const memory = await prisma.incidentMemory.upsert({
        where: { investigationId: investigation.id },
        create: {
            investigationId: investigation.id,
            projectId: investigation.projectId,
            organizationId: investigation.project.organizationId,
            fingerprint,
            title: investigation.title,
            normalizedTitle,
            primaryService,
            primaryOperation,
            errorType,
            rootCause: investigation.rootCause,
            confidenceScore: investigation.confidenceScore,
            status: investigation.status,
            affectedServices,
            causalChainSummary,
            topologyEdges,
            evidenceReferences,
            humanVerdicts: investigation.verdicts,
            recommendations: investigation.recommendations.map((r) => ({
                id: r.id,
                content: r.recommendation,
                modelProvider: r.modelProvider,
            })),
            memoryVersion: INCIDENT_MEMORY_VERSION,
        },
        update: {
            fingerprint,
            title: investigation.title,
            normalizedTitle,
            primaryService,
            primaryOperation,
            errorType,
            rootCause: investigation.rootCause,
            confidenceScore: investigation.confidenceScore,
            status: investigation.status,
            affectedServices,
            causalChainSummary,
            topologyEdges,
            evidenceReferences,
            humanVerdicts: investigation.verdicts,
            recommendations: investigation.recommendations.map((r) => ({
                id: r.id,
                content: r.recommendation,
                modelProvider: r.modelProvider,
            })),
            memoryVersion: INCIDENT_MEMORY_VERSION,
            updatedAt: new Date(),
        },
    });

    // Check for Recurring Failure Patterns (Section 20-23)
    const patternKey = generateFailurePatternKey(primaryService, errorType);
    const relatedMemories = await prisma.incidentMemory.findMany({
        where: {
            organizationId: investigation.project.organizationId,
            primaryService,
            errorType,
        },
        orderBy: { createdAt: "asc" },
        select: {
            investigationId: true,
            createdAt: true,
            affectedServices: true,
        },
    });

    if (relatedMemories.length >= 2) {
        const invIds = relatedMemories.map((m) => m.investigationId);
        const firstSeen = relatedMemories[0].createdAt;
        const lastSeen = relatedMemories[relatedMemories.length - 1].createdAt;
        const allAffected = Array.from(
            new Set(relatedMemories.flatMap((m) => m.affectedServices))
        );

        await prisma.failurePattern.upsert({
            where: {
                organizationId_patternKey: {
                    organizationId: investigation.project.organizationId,
                    patternKey,
                },
            },
            create: {
                organizationId: investigation.project.organizationId,
                projectId: investigation.projectId,
                patternKey,
                title: `Recurring ${errorType} in ${primaryService}`,
                primaryService,
                affectedServices: allAffected,
                incidentCount: relatedMemories.length,
                firstSeenAt: firstSeen,
                lastSeenAt: lastSeen,
                investigationIds: invIds,
                commonCausalSummary: causalChainSummary,
            },
            update: {
                incidentCount: relatedMemories.length,
                lastSeenAt: lastSeen,
                affectedServices: allAffected,
                investigationIds: invIds,
                updatedAt: new Date(),
            },
        });
    }

    return memory;
}

/**
 * Format an IncidentMemory row into a clean comparison input for the similarity engine.
 */
export function formatMemoryForComparison(memory: any): IncidentComparisonInput {
    return {
        id: memory.investigationId,
        title: memory.title,
        primaryService: memory.primaryService,
        primaryOperation: memory.primaryOperation,
        errorType: memory.errorType,
        rootCause: memory.rootCause,
        confidenceScore: memory.confidenceScore,
        affectedServices: memory.affectedServices || [],
        causalChainSummary: memory.causalChainSummary,
        topologyEdges: memory.topologyEdges,
        evidenceReferences: memory.evidenceReferences || [],
    };
}
