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

    let body: any;
    try {
        body = await request.json();
    } catch {
        return jsonResponse(request, { error: "Invalid JSON payload" }, { status: 400 });
    }

    const rawEvents: any[] = Array.isArray(body?.events) ? body.events : [body];

    if (rawEvents.length === 0) {
        return jsonResponse(request, { error: "No events provided" }, { status: 400 });
    }

    const processedEvents: any[] = [];

    for (const item of rawEvents) {
        if (!item || typeof item !== "object") continue;

        // Preserve envelope fields in metadata
        const enrichedMetadata = {
            ...(item.metadata || {}),
            ...(item.runtime ? { runtime: item.runtime } : {}),
            ...(item.platform ? { platform: item.platform } : {}),
            ...(item.spanId ? { spanId: item.spanId } : {}),
            ...(item.parentSpanId ? { parentSpanId: item.parentSpanId } : {}),
            ...(item.evidenceStatus ? { evidenceStatus: item.evidenceStatus } : {}),
            ...(item.clock ? { clock: item.clock } : {}),
        };

        const event = await createEvent({
            type: item.type || item.eventType || "MESSAGE",
            severity: item.severity || "INFO",

            title: item.title || "Event",
            message: item.message,

            stack: item.stack,
            fingerprint: item.fingerprint,

            metadata: enrichedMetadata,
            tags: item.tags,
            breadcrumbs: item.breadcrumbs,
            user: item.user,

            timestamp: item.timestamp || new Date().toISOString(),

            sdkName: item.sdkName,
            sdkVersion: item.sdkVersion,
            release: item.release,

            service: item.service,
            resource: item.resource,
            operation: item.operation,
            status: item.status,
            durationMs: item.durationMs,

            requestId: item.requestId,
            traceId: item.traceId,

            sessionId: item.sessionId,
            sessionStartedAt: item.sessionStartedAt,

            projectId: verified.project.id,
            environmentId: verified.environment.id,
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

        processedEvents.push(event);
    }

    if (Array.isArray(body?.events)) {
        return jsonResponse(request, {
            success: true,
            processedCount: processedEvents.length,
            eventIds: processedEvents.map((e) => e.id),
        });
    }

    const single = processedEvents[0];
    return jsonResponse(request, {
        success: true,
        eventId: single?.id,
        issueId: single?.issueId ?? undefined,
    });
}