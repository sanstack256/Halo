/**
 * POST /api/lab/investigate
 *
 * Reliability Lab endpoint — triggers Halo's engineering recommendation engine
 * for a given issueId. The request must carry a valid project API key.
 *
 * This endpoint is intentionally minimal:
 *   - Auth: same API key used for event ingestion
 *   - Body: { issueId: string }
 *   - Returns: the full recommendation object (or error)
 *
 * It does NOT expose any ground-truth or evaluation data.
 * It calls the same generateFixRecommendationAction() used by the dashboard UI.
 */

import { NextRequest } from "next/server";
import { verifyApiKey } from "@/actions/api-key";
import { generateFixRecommendationAction } from "@/actions/fix-recommendation";
import { handleOptions, jsonResponse } from "@/lib/cors";

export async function OPTIONS(request: NextRequest) {
    return handleOptions(request);
}

export async function POST(request: NextRequest) {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
        return jsonResponse(request, { error: "Missing Authorization header" }, { status: 401 });
    }

    const apiKey = authorization.replace("Bearer ", "");
    const verified = await verifyApiKey(apiKey);

    if (!verified) {
        return jsonResponse(request, { error: "Invalid API key" }, { status: 401 });
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let body: { issueId?: string; eventId?: string; forceRegenerate?: boolean };
    try {
        body = await request.json();
    } catch {
        return jsonResponse(request, { error: "Invalid JSON" }, { status: 400 });
    }

    const { issueId, eventId, forceRegenerate = false } = body;

    if (!issueId) {
        return jsonResponse(request, { error: "issueId is required" }, { status: 400 });
    }

    const projectId = verified.project.id;

    // ── Trigger recommendation engine ─────────────────────────────────────────
    try {
        const result = await generateFixRecommendationAction({
            projectId,
            issueId,
            eventId,
            forceRegenerate,
        });

        return jsonResponse(request, {
            success: result.success,
            id: result.id,
            version: result.version,
            isStale: result.isStale,
            recommendation: result.recommendation,
            modelProvider: result.modelProvider,
            modelName: result.modelName,
            createdAt: result.createdAt,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[Lab] Investigation failed for issue", issueId, err);
        return jsonResponse(
            request,
            { error: message, detail: String(err) },
            { status: 500 }
        );
    }
}
