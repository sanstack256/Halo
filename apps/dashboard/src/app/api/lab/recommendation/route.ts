/**
 * GET /api/lab/recommendation?issueId=<id>
 *
 * Reliability Lab endpoint — fetches the latest persisted recommendation
 * for a given issueId. Used by the lab to poll for results after triggering
 * the investigation via POST /api/lab/investigate.
 *
 * Auth: same API key used for event ingestion.
 * Returns the persisted FixRecommendation JSON or 404 if not yet available.
 */

import { NextRequest } from "next/server";
import { verifyApiKey } from "@/actions/api-key";
import { getPersistedRecommendation } from "@/actions/fix-recommendation";
import { handleOptions, jsonResponse } from "@/lib/cors";

export async function OPTIONS(request: NextRequest) {
    return handleOptions(request);
}

export async function GET(request: NextRequest) {
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

    // ── Parse query params ────────────────────────────────────────────────────
    const issueId = request.nextUrl.searchParams.get("issueId");
    const investigationId = request.nextUrl.searchParams.get("investigationId") ?? undefined;

    if (!issueId) {
        return jsonResponse(request, { error: "issueId query param is required" }, { status: 400 });
    }

    const projectId = verified.project.id;

    // ── Fetch recommendation ──────────────────────────────────────────────────
    try {
        const result = await getPersistedRecommendation({
            projectId,
            issueId,
            investigationId,
        });

        if (!result) {
            return jsonResponse(request, { ready: false }, { status: 404 });
        }

        return jsonResponse(request, {
            ready: true,
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
        console.error("[Lab] Failed to fetch recommendation for issue", issueId, err);
        return jsonResponse(
            request,
            { error: message },
            { status: 500 }
        );
    }
}
