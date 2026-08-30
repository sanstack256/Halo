import { NextRequest } from "next/server";
import { verifyApiKey } from "@/actions/api-key";
import { createEvent } from "@/actions/event";
import { handleOptions, jsonResponse } from "@/lib/cors";

export async function OPTIONS(request: NextRequest) {
    return handleOptions(request);
}

export async function POST(request: NextRequest) {
    const authorization =
        request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
        return jsonResponse(
            request,
            { error: "Missing API key" },
            { status: 401 }
        );
    }

    const apiKey = authorization.replace(
        "Bearer ",
        ""
    );

    const verified = await verifyApiKey(apiKey);

    if (!verified) {
        return jsonResponse(
            request,
            { error: "Invalid API key" },
            { status: 401 }
        );
    }

    const body = await request.json();

    const event = await createEvent({
        type: body.type,
        severity: body.severity,

        title: body.title,
        message: body.message,

        stack: body.stack,
        fingerprint: body.fingerprint,

        metadata: body.metadata,
        tags: body.tags,
        breadcrumbs: body.breadcrumbs,
        user: body.user,

        timestamp: body.timestamp,

        sdkName: body.sdkName,
        sdkVersion: body.sdkVersion,
        release: body.release,

        service: body.service,
        resource: body.resource,
        operation: body.operation,
        status: body.status,
        durationMs: body.durationMs,

        requestId: body.requestId,
        traceId: body.traceId,

        sessionId: body.sessionId,
        sessionStartedAt:
            body.sessionStartedAt,

        projectId:
            verified.project.id,

        environmentId:
            verified.environment.id,
    });

    // Auto-correlate: If an error event with an issueId was created, associate any matching unlinked ReplaySessions
    if (event.issueId) {
        try {
            const { prisma } = await import("@/lib/prisma");

            if (event.sessionId) {
                await prisma.replaySession.updateMany({
                    where: {
                        sessionId: event.sessionId,
                        issueId: null,
                    },
                    data: {
                        issueId: event.issueId,
                        traceId: event.traceId ?? undefined,
                        requestId: event.requestId ?? undefined,
                    },
                });
            } else {
                // Link recent unassigned replay in the same project
                const recentReplay = await prisma.replaySession.findFirst({
                    where: {
                        projectId: verified.project.id,
                        issueId: null,
                        startedAt: { lte: new Date(event.timestamp.getTime() + 60000) },
                        createdAt: { gte: new Date(event.timestamp.getTime() - 10 * 60000) },
                    },
                    orderBy: { createdAt: "desc" },
                });
                if (recentReplay) {
                    await prisma.replaySession.update({
                        where: { id: recentReplay.id },
                        data: {
                            issueId: event.issueId,
                            traceId: event.traceId ?? undefined,
                            requestId: event.requestId ?? undefined,
                        },
                    });
                }
            }
        } catch (corrErr) {
            console.error("[Halo Ingest] Failed to correlate replay with event:", corrErr);
        }
    }

    return jsonResponse(request, {
        success: true,
        eventId: event.id,
        issueId: event.issueId ?? undefined,
    });
}