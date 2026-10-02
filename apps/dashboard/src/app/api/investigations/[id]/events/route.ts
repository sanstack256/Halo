import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { requireProjectAccess, requireCapability } from "@/lib/authorization";
import { collaborationHub } from "@/lib/investigation/collaboration-hub";

export const dynamic = "force-dynamic";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id: investigationId } = await context.params;

    // 1. Session Authentication
    const session = await getSession();
    if (!session || !session.user) {
        return new Response(JSON.stringify({ error: "Unauthorized: Authentication required" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    // 2. Fetch Investigation & Project
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
        return new Response(JSON.stringify({ error: "Investigation not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
        });
    }

    // 3. Project Authorization (Phase 1 multi-tenant boundary)
    try {
        await requireProjectAccess(investigation.projectId);
    } catch {
        return new Response(JSON.stringify({ error: "Forbidden: Access denied to project" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
        });
    }

    // 4. Team Capability Entitlement (Phase 1 capability check)
    try {
        await requireCapability(investigation.project.organizationId, "TEAM_INVESTIGATION_ROOMS");
    } catch {
        return new Response(JSON.stringify({ error: "Forbidden: TEAM_PLAN_REQUIRED for Collaborative Investigation Rooms" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
        });
    }

    // 5. Establish SSE Stream
    const encoder = new TextEncoder();
    let unsubscribe: (() => void) | null = null;

    const stream = new ReadableStream({
        start(controller) {
            // Initial CONNECTED handshake
            const initialPayload = {
                type: "CONNECTED",
                investigationId: investigation.id,
                timestamp: new Date().toISOString(),
                payload: {
                    activeParticipants: collaborationHub.getActiveParticipants(investigation.id),
                    user: {
                        id: session.user.id,
                        email: session.user.email,
                    },
                },
            };

            controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialPayload)}\n\n`));

            // Subscribe to subsequent domain events
            unsubscribe = collaborationHub.subscribe(investigation.id, (event) => {
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
                } catch (err) {
                    console.error("[SSE] Controller enqueue error:", err);
                }
            });
        },
        cancel() {
            if (unsubscribe) {
                unsubscribe();
                unsubscribe = null;
            }
        },
    });

    req.signal.addEventListener("abort", () => {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
