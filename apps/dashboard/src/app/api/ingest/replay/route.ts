import { NextRequest } from "next/server";
import { verifyApiKey } from "@/actions/api-key";
import { prisma } from "@/lib/prisma";
import { getOrgEntitlements } from "@/lib/entitlements";
import { handleOptions, jsonResponse } from "@/lib/cors";
import { parseBrowserName, parseOsName } from "@/lib/device-parser";

export async function OPTIONS(request: NextRequest) {
    return handleOptions(request);
}

export async function POST(request: NextRequest) {
    try {
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

        if (events && !Array.isArray(events)) {
            return jsonResponse(
                request,
                { error: "Events payload must be an array" },
                { status: 400 }
            );
        }

        const chunkStarted = startedAt ? new Date(startedAt) : new Date();
        const chunkEnded = endedAt ? new Date(endedAt) : new Date();
        const eventCount = Array.isArray(events) ? events.length : 0;
        const sizeBytes = JSON.stringify(events).length;

        // Evidence-triggered invariant: Never create or persist a replay session if 0 events arrived on sequence 0
        if (eventCount === 0 && sequence === 0) {
            return jsonResponse(request, {
                success: true,
                skipped: true,
                message: "Empty un-triggered session skipped from persistence.",
            });
        }

        // Calculate expiration based on plan retention
        const retentionDays = entitlements.plan.limits.replayRetentionDays || 30;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + retentionDays);

        // If issueId is not provided, look for correlated events in this project
        let resolvedIssueId = meta.issueId;
        if (!resolvedIssueId) {
            const errorTimestamp = meta.errorAt ? new Date(meta.errorAt) : chunkStarted;
            const matchingEvent = await prisma.event.findFirst({
                where: {
                    projectId: verified.project.id,
                    issueId: { not: null },
                    OR: [
                        { sessionId },
                        ...(meta.traceId ? [{ traceId: meta.traceId }] : []),
                        ...(meta.requestId ? [{ requestId: meta.requestId }] : []),
                        // If error-triggered, find error event in this project around the error timestamp
                        ...(meta.errorAt ? [{
                            type: "ERROR" as const,
                            timestamp: {
                                gte: new Date(errorTimestamp.getTime() - 5 * 60000),
                                lte: new Date(errorTimestamp.getTime() + 5 * 60000),
                            },
                        }] : []),
                    ],
                },
                select: { issueId: true },
                orderBy: { timestamp: "desc" },
            });

            if (matchingEvent?.issueId) {
                resolvedIssueId = matchingEvent.issueId;
            }
        }

        // Ensure canonical TelemetrySession exists and is linked
        try {
            await prisma.telemetrySession.upsert({
                where: { id: sessionId },
                create: {
                    id: sessionId,
                    projectId: verified.project.id,
                    environmentId: verified.environment.id,
                    startedAt: chunkStarted,
                    lastSeenAt: chunkEnded,
                    crashedAt: meta.errorAt ? new Date(meta.errorAt) : undefined,
                },
                update: {
                    lastSeenAt: chunkEnded,
                    crashedAt: meta.errorAt ? new Date(meta.errorAt) : undefined,
                },
            });
        } catch (sessionErr) {
            console.warn("[Replay Ingestion] Failed to sync canonical TelemetrySession:", sessionErr);
        }

        const currentDurationMs = Math.max(0, chunkEnded.getTime() - chunkStarted.getTime());

        const sanitizedUrl = sanitizeUrl(meta.url);
        const resolvedBrowser = parseBrowserName(meta.browser || meta.userAgent);
        const resolvedOs = parseOsName(meta.os, meta.browser || meta.userAgent);

        // 1. Upsert ReplaySession Metadata
        const replaySession = await prisma.replaySession.upsert({
            where: {
                sessionId,
            },
            create: {
                sessionId,
                projectId: verified.project.id,
                environmentId: verified.environment.id,
                browser: resolvedBrowser !== "Browser" ? resolvedBrowser : (meta.browser || null),
                os: resolvedOs !== "Unknown OS" ? resolvedOs : (meta.os || null),
                device: meta.device,
                url: sanitizedUrl,
                userAgent: meta.userAgent,
                viewportWidth: meta.viewportWidth,
                viewportHeight: meta.viewportHeight,
                startedAt: chunkStarted,
                endedAt: chunkEnded,
                totalDurationMs: currentDurationMs,
                errorAt: meta.errorAt ? new Date(meta.errorAt) : undefined,
                triggerType: meta.triggerType || (meta.errorAt ? "ERROR" : undefined),
                captureReason: meta.captureReason || (meta.errorAt ? "Unhandled Exception" : undefined),
                triggerTimestamp: meta.triggerTimestamp ? new Date(meta.triggerTimestamp) : (meta.errorAt ? new Date(meta.errorAt) : undefined),
                issueId: resolvedIssueId,
                traceId: meta.traceId,
                requestId: meta.requestId,
                status: final || meta.errorAt ? "AVAILABLE" : "RECORDING",
                chunkCount: 1,
                expiresAt,
            },
            update: {
                endedAt: chunkEnded,
                status: final || meta.errorAt ? "AVAILABLE" : undefined,
                chunkCount: { increment: 1 },
                browser: resolvedBrowser !== "Browser" ? resolvedBrowser : undefined,
                os: resolvedOs !== "Unknown OS" ? resolvedOs : undefined,
                errorAt: meta.errorAt ? new Date(meta.errorAt) : undefined,
                triggerType: meta.triggerType || undefined,
                captureReason: meta.captureReason || undefined,
                triggerTimestamp: meta.triggerTimestamp ? new Date(meta.triggerTimestamp) : undefined,
                issueId: resolvedIssueId || undefined,
                traceId: meta.traceId || undefined,
                requestId: meta.requestId || undefined,
                url: sanitizedUrl || undefined,
            },
        });

        // Auto-correlate any pending feedback submitted with this sessionId
        try {
            await prisma.feedback.updateMany({
                where: {
                    sessionId,
                    replaySessionId: null,
                },
                data: {
                    replaySessionId: replaySession.id,
                },
            });
        } catch (feedbackErr) {
            console.warn("[Replay Ingestion] Failed to correlate pending feedback:", feedbackErr);
        }

        // 2. Insert ReplayChunk
        if (eventCount > 0) {
            const sanitizedEvents = Array.isArray(events)
                ? events.map((ev: any) => {
                      if (ev?.type === 4 && ev.data?.href) {
                          return { ...ev, data: { ...ev.data, href: sanitizeUrl(ev.data.href) } };
                      }
                      return ev;
                  })
                : [];

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
                    events: sanitizedEvents,
                    startedAt: chunkStarted,
                    endedAt: chunkEnded,
                    eventCount,
                    sizeBytes,
                },
                update: {
                    events: sanitizedEvents,
                    startedAt: chunkStarted,
                    endedAt: chunkEnded,
                    eventCount,
                    sizeBytes,
                },
            });
        }

        // Recalculate total duration from earliest start to latest chunk end
        const totalDurationMs = Math.max(0, chunkEnded.getTime() - replaySession.startedAt.getTime());
        await prisma.replaySession.update({
            where: { id: replaySession.id },
            data: {
                totalDurationMs,
                ...(final ? { status: "AVAILABLE" } : {}),
            },
        });

        return jsonResponse(request, {
            success: true,
            replaySessionId: replaySession.id,
            sequence,
        });
    } catch (err: any) {
        console.error("[REPLAY INGESTION 500 CRITICAL]:", err);
        return jsonResponse(
            request,
            {
                error: err?.message || "Internal Ingestion Failure",
                stack: err?.stack,
            },
            { status: 500 }
        );
    }
}

function sanitizeUrl(urlStr?: string | null): string | null {
    if (!urlStr) return null;
    try {
        const parsed = new URL(urlStr);
        const SENSITIVE_PARAM_REGEX = /^(.*_)?(token|auth|key|secret|password|session|jwt|api_key|access_token|refresh_token|credential|code)$/i;
        for (const key of Array.from(parsed.searchParams.keys())) {
            if (SENSITIVE_PARAM_REGEX.test(key)) {
                parsed.searchParams.set(key, "[REDACTED]");
            }
        }
        return parsed.toString();
    } catch {
        return urlStr;
    }
}
