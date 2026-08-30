import { NextRequest, NextResponse } from "next/server";

/**
 * Centralized CORS helper for Halo browser telemetry ingestion endpoints.
 * 
 * Supports configured `ALLOWED_ORIGINS` (comma-separated, or "*" for wildcard).
 * Automatically includes production App URLs (NEXT_PUBLIC_APP_URL, BETTER_AUTH_URL, VERCEL_URL).
 * In development, allows localhost and 127.0.0.1.
 */
let hasWarnedCorsInProd = false;

export function getCorsHeaders(request: NextRequest): Record<string, string> {
    const origin = request.headers.get("origin");

    // Gather all valid trusted origins
    const appUrls = [
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.BETTER_AUTH_URL,
        process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    ].filter(Boolean) as string[];

    const configuredOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
        : [];

    const isWildcard = configuredOrigins.includes("*");

    let allowOrigin = "";
    if (origin) {
        if (isWildcard) {
            allowOrigin = origin;
        } else if (
            configuredOrigins.includes(origin) ||
            appUrls.some((u) => u.replace(/\/$/, "") === origin)
        ) {
            allowOrigin = origin;
        } else if (process.env.NODE_ENV !== "production") {
            // In development, permit localhost and loopback interfaces
            if (
                origin.startsWith("http://localhost:") ||
                origin.startsWith("http://127.0.0.1:") ||
                origin === "http://localhost" ||
                origin === "http://127.0.0.1"
            ) {
                allowOrigin = origin;
            }
        } else if (!hasWarnedCorsInProd && configuredOrigins.length === 0) {
            hasWarnedCorsInProd = true;
            console.warn(
                "[Halo CORS] Running in production with no ALLOWED_ORIGINS configured. Set ALLOWED_ORIGINS in environment variables to allow browser telemetry ingestion from your frontend domain."
            );
        }
    }

    const headers: Record<string, string> = {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Halo-SDK-Version, X-Halo-Client",
        "Access-Control-Max-Age": "86400",
    };

    if (allowOrigin) {
        headers["Access-Control-Allow-Origin"] = allowOrigin;
        headers["Vary"] = "Origin";
    }

    return headers;
}

export function handleOptions(request: NextRequest): NextResponse {
    const headers = getCorsHeaders(request);
    return new NextResponse(null, {
        status: 204,
        headers,
    });
}

export function jsonResponse(
    request: NextRequest,
    data: any,
    init?: { status?: number; headers?: Record<string, string> }
): NextResponse {
    const corsHeaders = getCorsHeaders(request);
    return NextResponse.json(data, {
        status: init?.status ?? 200,
        headers: {
            ...corsHeaders,
            ...(init?.headers || {}),
        },
    });
}
