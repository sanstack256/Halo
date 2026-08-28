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

    await createEvent({
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

    return jsonResponse(request, {
        success: true,
    });
}