import { NextRequest, NextResponse } from "next/server";

/**
 * Centralized CORS helper for Halo browser telemetry ingestion endpoints.
 * 
 * Configurable via `ALLOWED_ORIGINS` env var (comma-separated).
 * Defaults to allowing common local dev ports (`http://localhost:3000`, `http://localhost:3001`, `http://127.0.0.1:3000`, `http://127.0.0.1:3001`).
 */
const DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
];

export function getCorsHeaders(request: NextRequest): Record<string, string> {
    const origin = request.headers.get("origin");
    
    const configuredOrigins = process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
        : DEFAULT_ALLOWED_ORIGINS;

    // Check if request origin matches allowed origins
    let allowOrigin = "";
    if (origin) {
        if (configuredOrigins.includes(origin) || (process.env.NODE_ENV !== "production" && origin.startsWith("http://localhost:"))) {
            allowOrigin = origin;
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
