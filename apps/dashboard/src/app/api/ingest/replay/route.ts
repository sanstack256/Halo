import { NextRequest } from "next/server";
import { verifyApiKey } from "@/actions/api-key";
import { prisma } from "@/lib/prisma";
import { getOrgEntitlements } from "@/lib/entitlements";
import { handleOptions, jsonResponse } from "@/lib/cors";

export async function OPTIONS(request: NextRequest) {
    return handleOptions(request);
}

export async function POST(request: NextRequest) {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
        return jsonResponse(
            request,
            { error: "Missing API key" },
            { status: 401 }
        );
    }

    const apiKey = authorization.replace("Bearer ", "");
    const verified = await verifyApiKey(apiKey);

    if (!verified) {
        return jsonResponse(
            request,
            { error: "Invalid API key" },
            { status: 401 }
        );
    }

    // Server-side Plan & Feature Entitlement Enforcement
    const entitlements = await getOrgEntitlements(verified.project.organizationId);

    if (!entitlements.plan.features.sessionReplay) {
        return jsonResponse(
            request,
            {
                error: "Session Replay is not enabled for your plan.",
                requiredPlan: "DEVELOPER",
                currentPlan: entitlements.planId,
            },
            { status: 403 }
        );
    }

    // Limit check: Check monthly replay session count
    if (entitlements.plan.limits.maxReplaySessionsPerMonth !== null) {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const sessionCount = await prisma.replaySession.count({
            where: {
                projectId: verified.project.id,
                createdAt: { gte: startOfMonth },
            },
        });

        if (sessionCount >= entitlements.plan.limits.maxReplaySessionsPerMonth) {
            return jsonResponse(
                request,
                {
                    error: "Monthly Session Replay quota reached for this plan.",
                    currentUsage: sessionCount,
                    max: entitlements.plan.limits.maxReplaySessionsPerMonth,
                },
                { status: 429 }
            );
        }
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse(
            request,
            { error: "Invalid JSON payload" },
            { status: 400 }
        );
    }

    const {
        sessionId,
        sequence = 0,
        events = [],
        startedAt,
        endedAt,
        meta = {},
        final = false,
    } = body;

    if (!sessionId) {
        return jsonResponse(
            request,
            { error: "Missing sessionId" },
            { status: 400 }
        );
    }

    const chunkStarted = startedAt ? new Date(startedAt) : new Date();
    const chunkEnded = endedAt ? new Date(endedAt) : new Date();
    const eventCount = Array.isArray(events) ? events.length : 0;
    const sizeBytes = JSON.stringify(events).length;

    // Calculate expiration based on plan retention
    const retentionDays = entitlements.plan.limits.replayRetentionDays || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + retentionDays);

    // 1. Upsert ReplaySession Metadata
    const replaySession = await prisma.replaySession.upsert({
        where: {
            sessionId,
        },
        create: {
            sessionId,
            projectId: verified.project.id,
            environmentId: verified.environment.id,
            browser: meta.browser,
            os: meta.os,
            device: meta.device,
            url: meta.url,
            userAgent: meta.userAgent,
            viewportWidth: meta.viewportWidth,
            viewportHeight: meta.viewportHeight,
            startedAt: chunkStarted,
            errorAt: meta.errorAt ? new Date(meta.errorAt) : undefined,
            issueId: meta.issueId,
            traceId: meta.traceId,
            requestId: meta.requestId,
            status: final ? "AVAILABLE" : "RECORDING",
            chunkCount: 1,
            expiresAt,
        },
        update: {
            endedAt: final ? chunkEnded : undefined,
            status: final ? "AVAILABLE" : undefined,
            chunkCount: { increment: 1 },
            errorAt: meta.errorAt ? new Date(meta.errorAt) : undefined,
            issueId: meta.issueId || undefined,
            traceId: meta.traceId || undefined,
            requestId: meta.requestId || undefined,
        },
    });

    // 2. Insert ReplayChunk
    if (eventCount > 0) {
        await prisma.replayChunk.upsert({
            where: {
                replaySessionId_sequence: {
                    replaySessionId: replaySession.id,
                    sequence,
                },
            },
            create: {
                replaySessionId: replaySession.id,
                sequence,
                events,
                startedAt: chunkStarted,
                endedAt: chunkEnded,
                eventCount,
                sizeBytes,
            },
            update: {
                events,
                startedAt: chunkStarted,
                endedAt: chunkEnded,
                eventCount,
                sizeBytes,
            },
        });
    }

    // If final, calculate total duration
    if (final) {
        const totalDurationMs = Math.max(0, chunkEnded.getTime() - replaySession.startedAt.getTime());
        await prisma.replaySession.update({
            where: { id: replaySession.id },
            data: {
                totalDurationMs,
                status: "AVAILABLE",
                endedAt: chunkEnded,
            },
        });
    }

    return jsonResponse(request, {
        success: true,
        replaySessionId: replaySession.id,
        sequence,
    });
}
