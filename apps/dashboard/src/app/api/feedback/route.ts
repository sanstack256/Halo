import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
    });
}

export async function POST(request: NextRequest) {
    try {
        let body: any;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
        }

        const { projectId, replaySessionId, name, email, comments, url } = body || {};

        if (!comments || typeof comments !== "string" || comments.trim() === "") {
            return NextResponse.json({ error: "Comments field is required" }, { status: 400 });
        }

        let resolvedProjectId = projectId;
        let resolvedReplaySessionDbId: string | null = null;

        // If replaySessionId is provided, resolve to canonical database ID and project ID if missing
        if (replaySessionId) {
            const replay = await prisma.replaySession.findFirst({
                where: {
                    OR: [
                        { id: replaySessionId },
                        { sessionId: replaySessionId },
                    ],
                },
                select: { id: true, projectId: true },
            });

            if (replay) {
                resolvedReplaySessionDbId = replay.id;
                if (!resolvedProjectId) {
                    resolvedProjectId = replay.projectId;
                }
            }
        }

        // If projectId is still missing, attempt resolution from Authorization header or first active project
        if (!resolvedProjectId) {
            const authHeader = request.headers.get("authorization");
            if (authHeader && authHeader.startsWith("Bearer ")) {
                const apiKey = authHeader.replace("Bearer ", "");
                const crypto = await import("crypto");
                const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
                const keyRecord = await prisma.apiKey.findFirst({
                    where: { keyHash },
                    select: { projectId: true },
                });
                if (keyRecord) {
                    resolvedProjectId = keyRecord.projectId;
                }
            }
        }

        if (!resolvedProjectId) {
            const defaultProj = await prisma.project.findFirst({ select: { id: true } });
            if (defaultProj) resolvedProjectId = defaultProj.id;
        }

        if (!resolvedProjectId) {
            return NextResponse.json({ error: "Missing or invalid projectId" }, { status: 400 });
        }

        const feedback = await prisma.feedback.create({
            data: {
                projectId: resolvedProjectId,
                sessionId: replaySessionId ? String(replaySessionId) : null,
                replaySessionId: resolvedReplaySessionDbId,
                name: name ? String(name).slice(0, 200) : null,
                email: email ? String(email).slice(0, 200) : null,
                comments: String(comments).slice(0, 5000),
                url: url ? String(url).slice(0, 1000) : null,
            },
        });

        return NextResponse.json({
            success: true,
            feedbackId: feedback.id,
            replaySessionId: feedback.replaySessionId,
        }, {
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch (err: any) {
        console.error("[Feedback Ingest API] Error saving feedback:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
