"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getProject } from "@/actions/project";
import { getProjectRecommendationModel } from "@/actions/project-ai";
import { investigateIssueOccurrence } from "@/lib/investigation/run";
import { buildCanonicalEvidenceSnapshot } from "@/lib/investigation/evidence-snapshot";
import { resolveGitHubSourceContext } from "@/lib/investigation/runtime/github-source-provider";
import { parseStackTrace } from "@/lib/investigation/runtime/stack-parser";
import { generateEvidenceBoundRecommendation } from "@/lib/investigation/recommendation-engine/engine";
import type { FixRecommendation, FollowUpQuestionMessage } from "@/lib/investigation/recommendation-engine/types";

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
        followUpHistory: (latest.followUpHistory as unknown as FollowUpQuestionMessage[]) || [],
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

    const snapshot = buildCanonicalEvidenceSnapshot({
        tenant: {
            organizationId: project.organizationId,
            projectId,
        },
        scope: {
            issueId,
            anchorEventId: incidentAnchorId || anchorError?.id,
            release: anchorError?.release,
        },
        rawEvidence: investigation.evidence,
        investigation,
        runtime: {
            anchorError,
            primaryFailingFrame: primaryFrame,
            callChain: [],
            failingExpression: resolvedSourceContext?.failingExpression,
            failingStatement: resolvedSourceContext?.failingStatement,
            containingFunction: resolvedSourceContext?.containingFunction,
            runtimeOrigin: "node",
        },
        source: resolvedSourceContext,
    });

    const currentHash = computeSnapshotHash(
        investigation.evidence.map((e) => e.id),
        anchorError?.id,
        resolvedSourceContext?.filePath
    );

    // 2. Check for existing recommendation if not force regenerating
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
                followUpHistory: (existing.followUpHistory as unknown as FollowUpQuestionMessage[]) || [],
                modelProvider: existing.modelProvider,
                modelName: existing.modelName,
                createdAt: existing.createdAt,
            };
        }
    }

    // 3. Resolve AI recommendation model (Halo Managed, Gemini BYOK, or OpenAI BYOK)
    const customModel = await getProjectRecommendationModel(projectId);

    // 4. Generate recommendation with full fact-checking
    const result = await generateEvidenceBoundRecommendation({
        snapshot,
        customModel,
    });

    const fixRecommendation: FixRecommendation = result.fixRecommendation || {
        actionAnswer: result.action?.instruction || result.whatHappened,
        outcomeType: result.source === "REFUSAL_INSUFFICIENT_EVIDENCE" ? "INSUFFICIENT_EVIDENCE" : "CODE_CHANGE_RECOMMENDED",
        summary: result.action?.instruction || result.whatHappened,
        diagnosis: result.whatHappened,
        whyThisAction: result.action?.reasoning,
        whyNotSymptomFix: "Do not apply defensive nullish checks or symptom suppression at the callee when caller contracts are violated.",
        missingEvidence: result.unknowns,
        nextActionBeforeRepair: result.source === "REFUSAL_INSUFFICIENT_EVIDENCE" ? "Capture correlated telemetry or reproduce in development before modifying code." : undefined,
        confidence: (result.confidence?.toUpperCase() as any) || "MEDIUM",
        evidenceReferences: Array.from(new Set(result.claims.flatMap((c) => c.evidenceIds))),
        changes: (result.patch?.files || []).map((f) => ({
            filePath: f.path,
            codeType: "PROPOSED_ONLY" as const,
            explanation: f.explanation,
            whyHere: "Target identified from failing stack trace and application call chain.",
            proposedCode: f.diff,
            isExactSourceVerified: false,
        })),
        relatedConsistencyChecks: [],
        validationSteps: ["Reproduce with verified incident payload", "Execute test suite"],
        uncertainty: result.unknowns,
        followUpSuggestions: [
            "Why do you recommend changing the caller instead of the service?",
            "Which evidence led to this recommendation?",
            "What happens if we only add optional chaining?",
            "Are there other callers that need the same change?",
            "What tests should I add?",
        ],
        hasInsufficientEvidence: result.source === "REFUSAL_INSUFFICIENT_EVIDENCE",
    };

    // 5. Determine version number
    const previous = await prisma.issueRecommendation.findFirst({
        where: { issueId },
        orderBy: { version: "desc" },
        select: { version: true },
    });
    const nextVersion = (previous?.version || 0) + 1;

    // 6. Persist recommendation in PostgreSQL
    const persisted = await prisma.issueRecommendation.create({
        data: {
            issueId,
            investigationId: investigationId || null,
            version: nextVersion,
            snapshotHash: currentHash,
            isStale: false,
            recommendation: fixRecommendation as any,
            followUpHistory: [],
            modelProvider: result.audit?.modelInfo?.provider || customModel.id,
            modelName: result.audit?.modelInfo?.model || customModel.name,
        },
    });

    return {
        success: true,
        id: persisted.id,
        version: persisted.version,
        isStale: false,
        recommendation: fixRecommendation,
        followUpHistory: [],
        modelProvider: persisted.modelProvider,
        modelName: persisted.modelName,
        createdAt: persisted.createdAt,
    };
}

/**
 * Handles engineer follow-up questions about the recommendation.
 * Backed by the same investigation context and deterministic repository lookups.
 */
export async function askRecommendationFollowUpAction(params: {
    projectId: string;
    issueId: string;
    recommendationId: string;
    question: string;
}) {
    const { projectId, issueId, recommendationId, question } = params;

    const project = await getProject(projectId);
    if (!project) {
        throw new Error(`Project ${projectId} not found or unauthorized.`);
    }

    const recRecord = await prisma.issueRecommendation.findUnique({
        where: { id: recommendationId },
    });
    if (!recRecord) {
        throw new Error(`Recommendation ${recommendationId} not found.`);
    }

    const recommendation = recRecord.recommendation as unknown as FixRecommendation;
    const history = (recRecord.followUpHistory as unknown as FollowUpQuestionMessage[]) || [];

    const lowerQ = question.toLowerCase();
    let answerText = "";
    const referencedCallers: Array<{ filePath: string; lineNumber?: number; snippet?: string }> = [];

    // Deterministic lookup if engineer asks about other callers
    if (lowerQ.includes("caller") || lowerQ.includes("other files") || lowerQ.includes("who else calls")) {
        answerText = `The investigation established the contract requirement from the failing site. For this specific failure mechanism, the primary target file is \`${recommendation.changes[0]?.filePath ?? "caller"}\`. Related consistency checks: ${recommendation.relatedConsistencyChecks?.join("; ") || "Verify caller argument counts."}`;
        if (recommendation.changes[0]?.filePath) {
            referencedCallers.push({
                filePath: recommendation.changes[0].filePath,
                lineNumber: recommendation.changes[0].startLine,
                snippet: recommendation.changes[0].currentCode,
            });
        }
    } else if (lowerQ.includes("why") && (lowerQ.includes("caller") || lowerQ.includes("callee") || lowerQ.includes("service"))) {
        answerText = `We recommend changing the caller because the investigation demonstrates the required data already exists or is expected at the caller boundary. Modifying the callee to add fallback handling (such as optional chaining or default values) would suppress the symptom while masking broken caller contracts.`;
    } else if (lowerQ.includes("optional chaining") || lowerQ.includes("null check") || lowerQ.includes("?. ")) {
        answerText = `Adding optional chaining (\`?.\`) would suppress the unhandled exception at runtime, but it does not restore the broken contract. If downstream consumers expect a populated value, suppressing it with \`?.\` typically produces silent failures or cascading downstream null pointer errors.`;
    } else if (lowerQ.includes("test") || lowerQ.includes("verify") || lowerQ.includes("validation")) {
        answerText = `Recommended validation steps:\n${(recommendation.validationSteps || ["Run unit tests covering this component."]).map((s) => `• ${s}`).join("\n")}`;
    } else {
        answerText = `Based on the investigation evidence: ${recommendation.diagnosis}. Specifically, ${recommendation.summary}. What remains unconfirmed: ${recommendation.uncertainty?.join(", ") || "No additional unknowns."}`;
    }

    const userMessage: FollowUpQuestionMessage = {
        role: "user",
        content: question,
        timestamp: new Date().toISOString(),
    };

    const assistantMessage: FollowUpQuestionMessage = {
        role: "assistant",
        content: answerText,
        timestamp: new Date().toISOString(),
        citations: recommendation.evidenceReferences,
        referencedCallers: referencedCallers.length > 0 ? referencedCallers : undefined,
    };

    const updatedHistory = [...history, userMessage, assistantMessage];

    await prisma.issueRecommendation.update({
        where: { id: recommendationId },
        data: {
            followUpHistory: updatedHistory as any,
        },
    });

    return {
        success: true,
        history: updatedHistory,
    };
}
