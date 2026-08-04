import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/actions/api-key";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
    const authorization =
        request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
        return NextResponse.json(
            {
                error: "Missing API key",
            },
            {
                status: 401,
            }
        );
    }

    const apiKey = authorization.replace(
        "Bearer ",
        ""
    );

    const verified = await verifyApiKey(apiKey);

    if (!verified) {
        return NextResponse.json(
            {
                error: "Invalid API key",
            },
            {
                status: 401,
            }
        );
    }

    const body = await request.json();

    console.log("Authorization:", authorization);

    console.log("Event:", body);

    await prisma.event.create({
        data: {
            type: body.type,
            severity: body.severity,
            title: body.title,
            message: body.message,

            metadata: undefined,
            timestamp: new Date(body.timestamp),

            sdkName: body.sdkName,
            sdkVersion: body.sdkVersion,
            release: undefined,

            projectId: verified.project.id,
            environmentId: verified.environment.id,
        },
    });

    return NextResponse.json({
        success: true,
    });
}