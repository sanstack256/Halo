/**
 * Materialized Incident Memory Generator for Halo Trace Pillars D & J.
 *
 * Responsibilities:
 * 1. Materialize structured historical memory from canonical Investigation records.
 * 2. Maintain 100% idempotency: running generation multiple times updates the single derived
 *    record with a stable identity and refreshed derivation version.
 * 3. Preserve root-cause honesty: if investigation confidence is low, rootCause remains null.
 * 4. Cluster recurring failure patterns across historical incidents (requiring >= 2 distinct incidents).
 * 5. Track verified remediation outcomes, negative learning (REGRESSED / NOT_RESOLVED), and pattern evolution.
 * 6. Respect strict organization and project tenant boundaries.
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

    // Query any RemediationVerifications and RemediationRecommendations for this investigation
    const verifications = await prisma.remediationVerification.findMany({
        where: { investigationId },
        orderBy: { verifiedAt: "desc" },
    });

    const remediationRecs = await prisma.remediationRecommendation.findMany({
        where: { investigationId },
        include: { verifications: true },
    });

    // Query any change observations for change characteristics
    const changeObservations = await prisma.changeObservation.findMany({
        where: { projectId: investigation.projectId },
        orderBy: { observedAt: "desc" },
        take: 5,
    });

    // Determine primary service and operation
    const errorEvent = events.find((e) => e.severity === "ERROR" || e.type === "ERROR") || events[0];
    const primaryService = errorEvent?.service || "unknown-service";
    const primaryOperation = normalizeOperation(errorEvent?.operation);
    const errorType = extractErrorType(errorEvent?.title || investigation.title);
    const normalizedTitle = normalizeIncidentTitle(investigation.title);

    // Query service ownership
    const serviceOwnership = await prisma.serviceOwnership.findFirst({
        where: { projectId: investigation.projectId, serviceName: primaryService },
    });

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

    // Determine verified outcome
    const latestVerification = verifications[0];
    const verifiedOutcome = latestVerification?.result ?? null;
    const verificationStrength = latestVerification?.strength ?? null;
    const resolvedAt = verifiedOutcome === "RESOLVED" ? latestVerification?.verifiedAt : null;

    // Build change characteristics if changes observed
    let changeCharacteristics: any = null;
    if (changeObservations.length > 0) {
        const latestChange = changeObservations[0];
        changeCharacteristics = {
            commitSha: latestChange.commitSha,
            changeType: latestChange.sourceType,
            filesChanged: latestChange.changedFiles,
            deploymentLinked: Boolean(latestChange.deploymentReference),
        };
    }

    // Build ownership context if declared
    let ownershipContext: any = null;
    if (serviceOwnership) {
        ownershipContext = {
            teamName: serviceOwnership.declaredTeam || serviceOwnership.declaredOwner,
            classification: serviceOwnership.classification,
        };
    }

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
            createdAt: investigation.createdAt,
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
            verifiedOutcome,
            verificationStrength,
            changeCharacteristics,
            ownershipContext,
            resolvedAt,
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
            verifiedOutcome,
            verificationStrength,
            changeCharacteristics,
            ownershipContext,
            resolvedAt,
            memoryVersion: INCIDENT_MEMORY_VERSION,
            updatedAt: new Date(),
        },
    });

    // Populate HistoricalRemediationOutcome records
    for (const rec of remediationRecs) {
        for (const ver of rec.verifications) {
            const outcomeId = `hro_${ver.id}`;
            await prisma.historicalRemediationOutcome.upsert({
                where: { id: outcomeId },
                create: {
                    id: outcomeId,
                    organizationId: investigation.project.organizationId,
                    projectId: investigation.projectId,
                    incidentMemoryId: memory.id,
                    recommendationId: rec.id,
                    verificationId: ver.id,
                    remediationType: rec.type,
                    verificationResult: ver.result,
                    verificationStrength: ver.strength,
                    actionSummary: rec.action,
                    evidenceReferences: ver.evidenceReferences,
                    observedAt: ver.verifiedAt,
                },
                update: {
                    verificationResult: ver.result,
                    verificationStrength: ver.strength,
                    actionSummary: rec.action,
                    evidenceReferences: ver.evidenceReferences,
                },
            });
        }
    }

    // Check for Recurring Failure Patterns (Sections 11, 12, 28, 29, 30)
    const patternKey = generateFailurePatternKey(primaryService, errorType);
    const relatedMemories = await prisma.incidentMemory.findMany({
        where: {
            organizationId: investigation.project.organizationId,
            primaryService,
            errorType,
        },
        orderBy: { createdAt: "asc" },
        include: { remediationOutcomes: true },
    });

    // Invariant: Patterns strictly require >= 2 distinct historical investigations
    if (relatedMemories.length >= 2) {
        const invIds = relatedMemories.map((m) => m.investigationId);
        const firstSeen = relatedMemories[0].createdAt;
        const lastSeen = relatedMemories[relatedMemories.length - 1].createdAt;
        const allAffected = Array.from(
            new Set(relatedMemories.flatMap((m) => m.affectedServices))
        );

        // Calculate verified outcome distributions across the pattern
        let resolvedCount = 0;
        let improvedCount = 0;
        let notResolvedCount = 0;
        let regressedCount = 0;

        const remediationMap: Record<string, { resolved: number; regressed: number; notResolved: number; total: number }> = {};

        for (const m of relatedMemories) {
            if (m.verifiedOutcome === "RESOLVED") resolvedCount++;
            else if (m.verifiedOutcome === "IMPROVED") improvedCount++;
            else if (m.verifiedOutcome === "NOT_RESOLVED") notResolvedCount++;
            else if (m.verifiedOutcome === "REGRESSED") regressedCount++;

            for (const out of m.remediationOutcomes) {
                const typeKey = out.remediationType || "UNKNOWN";
                if (!remediationMap[typeKey]) {
                    remediationMap[typeKey] = { resolved: 0, regressed: 0, notResolved: 0, total: 0 };
                }
                remediationMap[typeKey].total++;
                if (out.verificationResult === "RESOLVED") remediationMap[typeKey].resolved++;
                else if (out.verificationResult === "REGRESSED") remediationMap[typeKey].regressed++;
                else if (out.verificationResult === "NOT_RESOLVED") remediationMap[typeKey].notResolved++;
            }
        }

        // Pattern status classification (Section 29)
        let patternStatus = "STABLE";
        if (regressedCount > 0 && resolvedCount > 0) {
            patternStatus = "UNSTABLE"; // Mixed positive and regressive outcomes
        } else if (notResolvedCount > 0 || improvedCount > 0) {
            patternStatus = "EVOLVING";
        }

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
                verifiedResolutionCount: resolvedCount,
                improvementCount: improvedCount,
                nonResolutionCount: notResolvedCount,
                regressionCount: regressedCount,
                status: patternStatus,
                historicalRemediations: remediationMap,
            },
            update: {
                incidentCount: relatedMemories.length,
                lastSeenAt: lastSeen,
                affectedServices: allAffected,
                investigationIds: invIds,
                verifiedResolutionCount: resolvedCount,
                improvementCount: improvedCount,
                nonResolutionCount: notResolvedCount,
                regressionCount: regressedCount,
                status: patternStatus,
                historicalRemediations: remediationMap,
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
    const remediations = (memory.remediationOutcomes || []).map((o: any) => ({
        type: o.remediationType || "UNKNOWN",
        actionSummary: o.actionSummary || "Remediation action",
        result: o.verificationResult,
        strength: o.verificationStrength,
        evidenceReferences: o.evidenceReferences || [],
    }));

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
        changeCharacteristics: memory.changeCharacteristics,
        ownershipContext: memory.ownershipContext,
        verifiedOutcome: memory.verifiedOutcome,
        verificationStrength: memory.verificationStrength,
        historicalRemediations: remediations,
        remediationContext: remediations.length > 0 ? {
            types: remediations.map((r: any) => r.type),
            latestResult: remediations[0]?.result,
            latestStrength: remediations[0]?.strength,
        } : null,
        createdAt: memory.createdAt,
        observedAt: memory.createdAt,
    };
}
