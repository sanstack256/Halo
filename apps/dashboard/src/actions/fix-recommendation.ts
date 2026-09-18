"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getProject } from "@/actions/project";
import { getProjectRecommendationModel } from "@/actions/project-ai";
import { investigateIssueOccurrence } from "@/lib/investigation/run";
import { resolveGitHubSourceContext } from "@/lib/investigation/runtime/github-source-provider";
import { parseStackTrace } from "@/lib/investigation/runtime/stack-parser";
import { detectAutomaticRegression } from "@/lib/investigation/regression/regression-detector";
import { buildInvestigationSnapshot } from "@/lib/investigation/recommendation-engine/investigation-snapshot";
import { generateEngineeringRecommendation } from "@/lib/investigation/recommendation-engine/engine";
import {
    FixRecommendationSchema,
    type FixRecommendation,
    type EvaluatedRegressionCandidate,
} from "@/lib/investigation/recommendation-engine/types";

export interface GenerateFixRecommendationParams {
    projectId: string;
    issueId: string;
    investigationId?: string;
    eventId?: string;
    forceRegenerate?: boolean;
}

/**
 * Computes a deterministic content hash of an investigation's core evidence.
 */
function computeSnapshotHash(evidenceIds: string[], anchorId?: string, sourcePath?: string): string {
    const raw = `${anchorId || ""}:${sourcePath || ""}:${evidenceIds.sort().join(",")}`;
    return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

/**
 * Retrieves the latest persisted recommendation for an issue/investigation,
 * including checking whether it has become stale due to updated telemetry.
 */
export async function getPersistedRecommendation(params: {
    projectId: string;
    issueId: string;
    investigationId?: string;
}) {
    const { projectId, issueId, investigationId } = params;

    const project = await getProject(projectId);
    if (!project) {
        throw new Error(`Project ${projectId} not found or unauthorized.`);
    }

    const latest = await prisma.issueRecommendation.findFirst({
        where: {
            issueId,
            ...(investigationId ? { investigationId } : {}),
        },
        orderBy: { version: "desc" },
    });

    if (!latest) {
        return null;
    }

    return {
        id: latest.id,
        version: latest.version,
        isStale: latest.isStale,
        snapshotHash: latest.snapshotHash,
        recommendation: latest.recommendation as unknown as FixRecommendation,
        modelProvider: latest.modelProvider,
        modelName: latest.modelName,
        createdAt: latest.createdAt,
    };
}

/**
 * Generates an evidence-grounded engineering recommendation on demand.
 */
export async function generateFixRecommendationAction(params: GenerateFixRecommendationParams) {
    const { projectId, issueId, investigationId, eventId, forceRegenerate = false } = params;

    const project = await getProject(projectId);
    if (!project) {
        throw new Error(`Project ${projectId} not found or unauthorized.`);
    }

    // 1. Run investigation to obtain canonical telemetry & source state
    const { investigation, incidentAnchorId } = await investigateIssueOccurrence(
        issueId,
        projectId,
        eventId
    );

    const anchorError = investigation.evidence.find((e) => e.type === "ERROR") || investigation.evidence[0];
    const rawStack = anchorError?.tags?.stack || (anchorError?.metadata?.stack as string | undefined);
    const parsedStack = rawStack ? parseStackTrace(rawStack) : [];
    const primaryFrame = parsedStack.find((f) => f.isApplication && f.lineNumber) || parsedStack[0];

    let resolvedSourceContext = undefined;
    if (primaryFrame) {
        resolvedSourceContext = await resolveGitHubSourceContext({
            projectId,
            frame: primaryFrame,
            releaseVersion: anchorError?.release,
        });
    }

    // 2. Perform release & regression detection from GitHub API and Prisma release records
    const regressionCandidates: EvaluatedRegressionCandidate[] = [];
    try {
        const regressionResult = await detectAutomaticRegression({
            projectId,
            issueId,
            incidentFirstSeen: investigation.evidence[0]?.timestamp ? new Date(investigation.evidence[0].timestamp) : new Date(),
            failingLocation: primaryFrame
                ? {
                      filePath: primaryFrame.filePath,
                      lineNumber: primaryFrame.lineNumber,
                      functionName: primaryFrame.functionName,
                  }
                : undefined,
            releaseVersion: anchorError?.release,
        });

        for (const c of regressionResult.candidates) {
            regressionCandidates.push({
                commitSha: c.commitSha,
                shortSha: c.shortSha,
                message: c.commitMessage,
                author: c.authorName || "Unknown",
                commitDate: c.commitDate ? new Date(c.commitDate) : new Date(),
                deploymentDate: c.deploymentDate ? new Date(c.deploymentDate) : undefined,
                classification:
                    c.confidence === "OBSERVED"
                        ? "CONFIRMED_REGRESSION"
                        : c.codeRelationship === "MODIFIED" || c.codeRelationship === "INTRODUCED"
                        ? "PATH_ASSOCIATED"
                        : "TEMPORALLY_ASSOCIATED",
                classificationReason: c.explanation,
                modifiesFailingFile: c.changedFiles.some((f) => f.isFailingFile),
                modifiesFailingSymbol: c.changedFunctions.some((f) => f.isFailingFunction),
                diffSnippet: c.changedFiles.find((f) => f.isFailingFile)?.patch,
                changedFiles: c.changedFiles.map((f) => f.filePath),
            });
        }
    } catch {
        // Safe degradation if Git API is unreachable
    }

    // 3. Build canonical, immutable InvestigationSnapshot
    const snapshot = buildInvestigationSnapshot({
        incident: {
            issueId,
            title: anchorError?.title || "Unhandled Incident",
            firstSeen: investigation.evidence[0]?.timestamp ? new Date(investigation.evidence[0].timestamp) : new Date(),
            lastSeen: anchorError?.timestamp ? new Date(anchorError.timestamp) : new Date(),
            eventCount: investigation.evidence.length,
            environment: anchorError?.environment || "production",
            service: anchorError?.service || "service",
            release: anchorError?.release,
        },
        rawEvidence: investigation.evidence,
        investigation,
        stackFrames: parsedStack,
        source: resolvedSourceContext,
        release: {
            deployedRelease: anchorError?.release,
            candidates: regressionCandidates,
            stronglySupportedCandidate: regressionCandidates.find(
                (c) => c.classification === "CONFIRMED_REGRESSION"
            ),
        },
    });

    const currentHash = computeSnapshotHash(
        investigation.evidence.map((e) => e.id),
        anchorError?.id,
        resolvedSourceContext?.filePath
    );

    // 4. Check for existing recommendation if not force regenerating
    if (!forceRegenerate) {
        const existing = await prisma.issueRecommendation.findFirst({
            where: {
                issueId,
                ...(investigationId ? { investigationId } : {}),
            },
            orderBy: { version: "desc" },
        });

        if (existing) {
            const isStale = existing.snapshotHash !== currentHash;
            return {
                success: true,
                id: existing.id,
                version: existing.version,
                isStale,
                recommendation: existing.recommendation as unknown as FixRecommendation,
                modelProvider: existing.modelProvider,
                modelName: existing.modelName,
                createdAt: existing.createdAt,
            };
        }
    }

    // 5. Resolve AI recommendation model (Halo Managed, Gemini BYOK, or OpenAI BYOK)
    const customModel = await getProjectRecommendationModel(projectId);

    // 6. Execute single canonical recommendation pipeline
    const pipelineResult = await generateEngineeringRecommendation({
        snapshot,
        customModel,
    });

    const fixRecommendation: FixRecommendation = FixRecommendationSchema.parse(
        pipelineResult.recommendation
    );

    // 7. Determine version number
    const previous = await prisma.issueRecommendation.findFirst({
        where: { issueId },
        orderBy: { version: "desc" },
        select: { version: true },
    });
    const nextVersion = (previous?.version || 0) + 1;

    // 8. Persist recommendation in PostgreSQL
    const persisted = await prisma.issueRecommendation.create({
        data: {
            issueId,
            investigationId: investigationId || null,
            version: nextVersion,
            snapshotHash: currentHash,
            isStale: false,
            recommendation: fixRecommendation as any,
            followUpHistory: [],
            modelProvider: pipelineResult.modelInfo.provider,
            modelName: pipelineResult.modelInfo.model,
        },
    });

    return {
        success: pipelineResult.success,
        id: persisted.id,
        version: persisted.version,
        isStale: false,
        recommendation: fixRecommendation,
        modelProvider: persisted.modelProvider,
        modelName: persisted.modelName,
        createdAt: persisted.createdAt,
    };
}
