import { NextRequest, NextResponse } from "next/server";

import { verifyApiKey } from "@/actions/api-key";
import { createEvent } from "@/actions/event";

export async function POST(request: NextRequest) {
    const authorization =
        request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
        return NextResponse.json(
            { error: "Missing API key" },
            { status: 401 }
        );
    }

    const apiKey = authorization.replace(
        "Bearer ",
        ""
    );

    console.log("Received API key:", apiKey);

    const verified = await verifyApiKey(apiKey);

    console.log("Verification result:", verified);
    
    if (!verified) {
        return NextResponse.json(
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

        timestamp: body.timestamp,

        sdkName: body.sdkName,
        sdkVersion: body.sdkVersion,
        release: body.release,

        projectId: verified.project.id,
        environmentId: verified.environment.id,
    });

    return NextResponse.json({
        success: true,
    });
}