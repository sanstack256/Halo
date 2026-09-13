const SENSITIVE_QUERY_PARAMS = new Set([
    "token",
    "access_token",
    "refresh_token",
    "id_token",
    "password",
    "passwd",
    "secret",
    "api_key",
    "apikey",
    "auth",
    "key",
    "code",
    "session",
    "ssn",
    "cvv",
    "cvc",
    "credit_card",
    "card_number",
]);

const SENSITIVE_HEADERS = new Set([
    "authorization",
    "cookie",
    "set-cookie",
    "proxy-authorization",
    "x-api-key",
    "x-halo-api-key",
]);

const SENSITIVE_KEY_REGEX = /(password|passwd|secret|api_?key|token|auth|bearer|cvv|cvc|ssn|credit_?card)/i;
const CREDIT_CARD_REGEX = /\b(?:\d{4}[ -]?){3}\d{4}\b|\b\d{15,16}\b/g;
const BEARER_TOKEN_REGEX = /Bearer\s+[A-Za-z0-9_\-\.=]+/gi;

export function sanitizeUrl(rawUrl: string | undefined): string {
    if (!rawUrl || typeof rawUrl !== "string") return "";
    try {
        const parsed = new URL(rawUrl, "http://localhost");
        for (const key of Array.from(parsed.searchParams.keys())) {
            if (SENSITIVE_QUERY_PARAMS.has(key.toLowerCase())) {
                parsed.searchParams.set(key, "[REDACTED]");
            }
        }
        if (rawUrl.startsWith("/")) {
            return parsed.pathname + parsed.search;
        }
        return parsed.toString();
    } catch {
        return rawUrl.replace(/([?&](?:token|password|secret|key|auth)=)[^&]+/gi, "$1[REDACTED]");
    }
}

export function sanitizeHeaders(
    headers: Record<string, string | undefined> | Headers,
    allowlist?: string[]
): Record<string, string> {
    const result: Record<string, string> = {};
    const allowSet = allowlist ? new Set(allowlist.map((h) => h.toLowerCase())) : null;

    const entries: [string, string | null | undefined][] =
        typeof (headers as any)?.entries === "function"
            ? Array.from((headers as Headers).entries())
            : Object.entries(headers);

    for (const [k, v] of entries) {
        if (!v) continue;
        const lower = k.toLowerCase();
        if (SENSITIVE_HEADERS.has(lower)) {
            continue; // Stripped completely
        }
        if (allowSet && !allowSet.has(lower)) {
            continue; // If allowlist configured, only keep allowed
        }
        // Redact any bearer strings that might leak into other headers
        result[k] = String(v).replace(BEARER_TOKEN_REGEX, "Bearer [REDACTED]");
    }

    return result;
}

export function sanitizeText(text: string): string {
    if (!text || typeof text !== "string") return "";
    return text
        .replace(BEARER_TOKEN_REGEX, "Bearer [REDACTED]")
        .replace(CREDIT_CARD_REGEX, "[CARD_REDACTED]");
}

export function sanitizeObject<T>(obj: T, maxDepth: number = 5, currentDepth: number = 0, seen = new WeakSet()): T {
    if (obj === null || typeof obj !== "object") {
        if (typeof obj === "string") {
            return sanitizeText(obj) as unknown as T;
        }
        return obj;
    }

    if (currentDepth >= maxDepth) {
        return "[DEPTH_LIMIT]" as unknown as T;
    }

    if (seen.has(obj as object)) {
        return "[CIRCULAR]" as unknown as T;
    }
    seen.add(obj as object);

    if (Array.isArray(obj)) {
        return obj.map((item) => sanitizeObject(item, maxDepth, currentDepth + 1, seen)) as unknown as T;
    }

    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (SENSITIVE_KEY_REGEX.test(key)) {
            cleaned[key] = "[REDACTED]";
        } else {
            cleaned[key] = sanitizeObject(value, maxDepth, currentDepth + 1, seen);
        }
    }

    return cleaned as T;
}
