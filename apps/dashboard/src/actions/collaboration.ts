"use server";

import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser, requireProjectAccess, requireCapability } from "@/lib/authorization";
import {
    collaborationHub,
    type InvestigationArea,
    type ActiveParticipantSummary,
} from "@/lib/investigation/collaboration-hub";
import type {
    InvestigationCommentTargetType,
    PeerVerdictType,
    InvestigationActivityType,
} from "@/generated/prisma/client";

/**
 * Validate that the caller is authenticated, has access to the project owning
 * the investigation, and the organization has the Team collaboration capability.
 */
async function authorizeInvestigationCollaboration(investigationId: string) {
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

    // Verify project authorization (Phase 1 multi-tenant boundary)
    const access = await requireProjectAccess(investigation.projectId);

    // Verify Team capability entitlement (Phase 1 capability resolver)
    await requireCapability(investigation.project.organizationId, "TEAM_INVESTIGATION_ROOMS");

    return { user, investigation, access };
}

export interface InvestigationCollaborationState {
    investigationId: string;
    presence: ActiveParticipantSummary[];
    comments: Array<{
        id: string;
        investigationId: string;
        authorId: string;
        authorName: string;
        authorEmail: string;
        targetType: InvestigationCommentTargetType;
        targetId: string | null;
        evidenceId: string | null;
        metadata: any;
        content: string;
        createdAt: string;
        updatedAt: string;
    }>;
    verdicts: Array<{
        id: string;
        investigationId: string;
        hypothesisId: string;
        authorId: string;
        authorName: string;
        authorEmail: string;
        verdict: PeerVerdictType;
        reasoning: string | null;
        evidenceReferences: string[];
        createdAt: string;
        updatedAt: string;
    }>;
    activities: Array<{
        id: string;
        actorId: string;
        actorName: string;
        actorEmail: string;
        type: InvestigationActivityType;
        summary: string;
        targetType: string | null;
        targetId: string | null;
        metadata: any;
        createdAt: string;
    }>;
    proposedRelations: Array<{
        id: string;
        authorId: string;
        authorName: string;
        sourceId: string;
        targetId: string;
        relationType: string;
        classification: string;
        reasoning: string | null;
        evidenceIds: string[];
        createdAt: string;
    }>;
}

/**
 * Fetch authoritative collaboration state for an investigation.
 */
export async function getInvestigationCollaborationState(
    investigationId: string
): Promise<InvestigationCollaborationState> {
    const { investigation } = await authorizeInvestigationCollaboration(investigationId);

    const [comments, verdicts, activities, proposedRelations] = await Promise.all([
        prisma.investigationComment.findMany({
            where: { investigationId: investigation.id, isDeleted: false },
            orderBy: { createdAt: "asc" },
        }),
        prisma.investigationVerdict.findMany({
            where: { investigationId: investigation.id },
            orderBy: { updatedAt: "desc" },
        }),
        prisma.investigationActivity.findMany({
            where: { investigationId: investigation.id },
            orderBy: { createdAt: "desc" },
            take: 50,
        }),
        prisma.investigationProposedRelation.findMany({
            where: { investigationId: investigation.id },
            orderBy: { createdAt: "asc" },
        }),
    ]);

    const presence = collaborationHub.getActiveParticipants(investigation.id);

    return {
        investigationId: investigation.id,
        presence,
        comments: comments.map((c) => ({
            ...c,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
        })),
        verdicts: verdicts.map((v) => ({
            ...v,
            createdAt: v.createdAt.toISOString(),
            updatedAt: v.updatedAt.toISOString(),
        })),
        activities: activities.map((a) => ({
            ...a,
            createdAt: a.createdAt.toISOString(),
        })),
        proposedRelations: proposedRelations.map((r) => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
        })),
    };
}

/**
 * Send presence heartbeat from client session.
 */
export async function sendPresenceHeartbeat(params: {
    investigationId: string;
    clientId: string;
    currentArea?: InvestigationArea;
}): Promise<ActiveParticipantSummary[]> {
    const { user, investigation } = await authorizeInvestigationCollaboration(
        params.investigationId
    );

    return collaborationHub.recordHeartbeat(investigation.id, {
        clientId: params.clientId,
        userId: user.id,
        userName: user.name || user.email.split("@")[0],
        userEmail: user.email,
        currentArea: params.currentArea,
    });
}

/**
 * Add an evidence-anchored or contextual investigation comment.
 */
export async function addInvestigationComment(params: {
    investigationId: string;
    targetType: InvestigationCommentTargetType;
    targetId?: string;
    evidenceId?: string;
    content: string;
    metadata?: any;
    idempotencyKey?: string;
}) {
    const { user, investigation } = await authorizeInvestigationCollaboration(
        params.investigationId
    );

    if (!params.content || !params.content.trim()) {
        throw new Error("Comment content cannot be empty.");
    }

    // Idempotency protection
    if (params.idempotencyKey) {
        const existing = await prisma.investigationComment.findUnique({
            where: { idempotencyKey: params.idempotencyKey },
        });
        if (existing) {
            return existing;
        }
    }

    // Verify real evidence existence if evidenceId is specified
    if (params.evidenceId) {
        const evidenceEvent = await prisma.event.findFirst({
            where: {
                id: params.evidenceId,
                projectId: investigation.projectId,
            },
        });
        if (!evidenceEvent) {
            throw new Error(`Referenced evidence event ${params.evidenceId} not found in project.`);
        }
    }

    const authorName = user.name || user.email.split("@")[0];

    const comment = await prisma.investigationComment.create({
        data: {
            investigationId: investigation.id,
            authorId: user.id,
            authorName,
            authorEmail: user.email,
            targetType: params.targetType,
            targetId: params.targetId || null,
            evidenceId: params.evidenceId || null,
            metadata: params.metadata || null,
            content: params.content.trim(),
            idempotencyKey: params.idempotencyKey || null,
        },
    });

    const targetDesc = params.targetType === "INVESTIGATION"
        ? "investigation"
        : `${params.targetType.toLowerCase()} ${params.targetId ? `(${params.targetId})` : ""}`;

    const activity = await prisma.investigationActivity.create({
        data: {
            investigationId: investigation.id,
            actorId: user.id,
            actorName: authorName,
            actorEmail: user.email,
            type: "COMMENT_ADDED",
            summary: `${authorName} commented on ${targetDesc}`,
            targetType: params.targetType,
            targetId: params.targetId || null,
            metadata: { commentId: comment.id, preview: comment.content.slice(0, 100) },
        },
    });

    // Realtime broadcast to active room participants
    collaborationHub.broadcast(investigation.id, {
        type: "COMMENT_ADDED",
        investigationId: investigation.id,
        timestamp: new Date().toISOString(),
        payload: {
            comment: {
                ...comment,
                createdAt: comment.createdAt.toISOString(),
                updatedAt: comment.updatedAt.toISOString(),
            },
        },
    });

    collaborationHub.broadcast(investigation.id, {
        type: "ACTIVITY_RECORDED",
        investigationId: investigation.id,
        timestamp: new Date().toISOString(),
        payload: {
            activity: {
                ...activity,
                createdAt: activity.createdAt.toISOString(),
            },
        },
    });

    return comment;
}

/**
 * Edit an existing comment. Preserves author ownership and appends activity.
 */
export async function editInvestigationComment(params: {
    commentId: string;
    content: string;
}) {
    const { user } = await requireAuthenticatedUser();

    const comment = await prisma.investigationComment.findUnique({
        where: { id: params.commentId },
        include: {
            investigation: {
                select: {
                    id: true,
                    projectId: true,
                    project: { select: { organizationId: true } },
                },
            },
        },
    });

    if (!comment) throw new Error("Comment not found.");

    const access = await requireProjectAccess(comment.investigation.projectId);
    await requireCapability(comment.investigation.project.organizationId, "TEAM_INVESTIGATION_ROOMS");

    // Only author or admin/owner may edit
    if (comment.authorId !== user.id && access.membership.role === "MEMBER") {
        throw new Error("Unauthorized: Only the comment author or an admin may edit comments.");
    }

    if (!params.content || !params.content.trim()) {
        throw new Error("Comment content cannot be empty.");
    }

    const updated = await prisma.investigationComment.update({
        where: { id: comment.id },
        data: { content: params.content.trim() },
    });

    const authorName = user.name || user.email.split("@")[0];
    const activity = await prisma.investigationActivity.create({
        data: {
            investigationId: comment.investigationId,
            actorId: user.id,
            actorName: authorName,
            actorEmail: user.email,
            type: "COMMENT_EDITED",
            summary: `${authorName} edited a comment`,
            targetType: comment.targetType,
            targetId: comment.targetId,
            metadata: { commentId: comment.id },
        },
    });

    collaborationHub.broadcast(comment.investigationId, {
        type: "COMMENT_EDITED",
        investigationId: comment.investigationId,
        timestamp: new Date().toISOString(),
        payload: {
            comment: {
                ...updated,
                createdAt: updated.createdAt.toISOString(),
                updatedAt: updated.updatedAt.toISOString(),
            },
        },
    });

    collaborationHub.broadcast(comment.investigationId, {
        type: "ACTIVITY_RECORDED",
        investigationId: comment.investigationId,
        timestamp: new Date().toISOString(),
        payload: {
            activity: {
                ...activity,
                createdAt: activity.createdAt.toISOString(),
            },
        },
    });

    return updated;
}

/**
 * Delete a comment using a durable tombstone (isDeleted: true).
 */
export async function deleteInvestigationComment(commentId: string) {
    const { user } = await requireAuthenticatedUser();

    const comment = await prisma.investigationComment.findUnique({
        where: { id: commentId },
        include: {
            investigation: {
                select: {
                    id: true,
                    projectId: true,
                    project: { select: { organizationId: true } },
                },
            },
        },
    });

    if (!comment) throw new Error("Comment not found.");

    const access = await requireProjectAccess(comment.investigation.projectId);
    await requireCapability(comment.investigation.project.organizationId, "TEAM_INVESTIGATION_ROOMS");

    // Only author or admin/owner may delete
    if (comment.authorId !== user.id && access.membership.role === "MEMBER") {
        throw new Error("Unauthorized: Only the comment author or an admin may delete comments.");
    }

    const deleted = await prisma.investigationComment.update({
        where: { id: comment.id },
        data: { isDeleted: true },
    });

    const authorName = user.name || user.email.split("@")[0];
    const activity = await prisma.investigationActivity.create({
        data: {
            investigationId: comment.investigationId,
            actorId: user.id,
            actorName: authorName,
            actorEmail: user.email,
            type: "COMMENT_DELETED",
            summary: `${authorName} deleted a comment`,
            targetType: comment.targetType,
            targetId: comment.targetId,
            metadata: { commentId: comment.id },
        },
    });

    collaborationHub.broadcast(comment.investigationId, {
        type: "COMMENT_DELETED",
        investigationId: comment.investigationId,
        timestamp: new Date().toISOString(),
        payload: { commentId: comment.id },
    });

    collaborationHub.broadcast(comment.investigationId, {
        type: "ACTIVITY_RECORDED",
        investigationId: comment.investigationId,
        timestamp: new Date().toISOString(),
        payload: {
            activity: {
                ...activity,
                createdAt: activity.createdAt.toISOString(),
            },
        },
    });

    return deleted;
}

/**
 * Record or update a peer verdict on an investigation hypothesis.
 *
 * CRITICAL INVARIANT: Peer verdicts represent human engineering positions
 * and NEVER automatically modify or overwrite Halo's deterministic root-cause
 * confidence or engine verdict.
 */
export async function recordPeerVerdict(params: {
    investigationId: string;
    hypothesisId: string;
    verdict: PeerVerdictType;
    reasoning?: string;
    evidenceReferences?: string[];
    idempotencyKey?: string;
}) {
    const { user, investigation } = await authorizeInvestigationCollaboration(
        params.investigationId
    );

    const validVerdicts: PeerVerdictType[] = [
        "SUPPORTED",
        "DISPUTED",
        "NEEDS_EVIDENCE",
        "UNRESOLVED",
    ];
    if (!validVerdicts.includes(params.verdict)) {
        throw new Error(`Invalid verdict value: ${params.verdict}`);
    }

    // Verify referenced evidence exists
    if (params.evidenceReferences && params.evidenceReferences.length > 0) {
        const found = await prisma.event.findMany({
            where: {
                id: { in: params.evidenceReferences },
                projectId: investigation.projectId,
            },
            select: { id: true },
        });
        if (found.length !== params.evidenceReferences.length) {
            throw new Error("One or more referenced evidence IDs do not exist in project telemetry.");
        }
    }

    const authorName = user.name || user.email.split("@")[0];

    const verdict = await prisma.investigationVerdict.upsert({
        where: {
            investigationId_hypothesisId_authorId: {
                investigationId: investigation.id,
                hypothesisId: params.hypothesisId,
                authorId: user.id,
            },
        },
        create: {
            investigationId: investigation.id,
            hypothesisId: params.hypothesisId,
            authorId: user.id,
            authorName,
            authorEmail: user.email,
            verdict: params.verdict,
            reasoning: params.reasoning?.trim() || null,
            evidenceReferences: params.evidenceReferences || [],
            idempotencyKey: params.idempotencyKey || null,
        },
        update: {
            verdict: params.verdict,
            reasoning: params.reasoning?.trim() || null,
            evidenceReferences: params.evidenceReferences || [],
        },
    });

    const activity = await prisma.investigationActivity.create({
        data: {
            investigationId: investigation.id,
            actorId: user.id,
            actorName: authorName,
            actorEmail: user.email,
            type: "VERDICT_RECORDED",
            summary: `${authorName} marked hypothesis ${params.hypothesisId} as ${params.verdict}`,
            targetType: "HYPOTHESIS",
            targetId: params.hypothesisId,
            metadata: {
                verdict: params.verdict,
                reasoning: params.reasoning || null,
                evidenceCount: params.evidenceReferences?.length || 0,
            },
        },
    });

    collaborationHub.broadcast(investigation.id, {
        type: "VERDICT_RECORDED",
        investigationId: investigation.id,
        timestamp: new Date().toISOString(),
        payload: {
            verdict: {
                ...verdict,
                createdAt: verdict.createdAt.toISOString(),
                updatedAt: verdict.updatedAt.toISOString(),
            },
        },
    });

    collaborationHub.broadcast(investigation.id, {
        type: "ACTIVITY_RECORDED",
        investigationId: investigation.id,
        timestamp: new Date().toISOString(),
        payload: {
            activity: {
                ...activity,
                createdAt: activity.createdAt.toISOString(),
            },
        },
    });

    return verdict;
}

/**
 * Propose a human-suggested causal or dependency relationship.
 *
 * CRITICAL INVARIANT: Human-proposed relationships are explicitly tagged
 * as HUMAN_PROPOSED and are NEVER presented as OBSERVED or INFERRED.
 */
export async function proposeHumanRelation(params: {
    investigationId: string;
    sourceId: string;
    targetId: string;
    relationType: string;
    reasoning?: string;
    evidenceIds?: string[];
}) {
    const { user, investigation } = await authorizeInvestigationCollaboration(
        params.investigationId
    );

    const authorName = user.name || user.email.split("@")[0];

    const proposed = await prisma.investigationProposedRelation.create({
        data: {
            investigationId: investigation.id,
            authorId: user.id,
            authorName,
            sourceId: params.sourceId,
            targetId: params.targetId,
            relationType: params.relationType,
            classification: "HUMAN_PROPOSED",
            reasoning: params.reasoning?.trim() || null,
            evidenceIds: params.evidenceIds || [],
        },
    });

    const activity = await prisma.investigationActivity.create({
        data: {
            investigationId: investigation.id,
            actorId: user.id,
            actorName: authorName,
            actorEmail: user.email,
            type: "RELATIONSHIP_PROPOSED",
            summary: `${authorName} proposed relation ${params.sourceId} -> ${params.targetId}`,
            targetType: "CAUSAL_EDGE",
            targetId: `${params.sourceId}->${params.targetId}`,
            metadata: { relationType: params.relationType, classification: "HUMAN_PROPOSED" },
        },
    });

    collaborationHub.broadcast(investigation.id, {
        type: "RELATION_PROPOSED",
        investigationId: investigation.id,
        timestamp: new Date().toISOString(),
        payload: {
            relation: {
                ...proposed,
                createdAt: proposed.createdAt.toISOString(),
            },
        },
    });

    collaborationHub.broadcast(investigation.id, {
        type: "ACTIVITY_RECORDED",
        investigationId: investigation.id,
        timestamp: new Date().toISOString(),
        payload: {
            activity: {
                ...activity,
                createdAt: activity.createdAt.toISOString(),
            },
        },
    });

    return proposed;
}
