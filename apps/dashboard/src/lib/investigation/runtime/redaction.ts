/**
 * Centralized Privacy & Redaction Boundary
 *
 * Ensures passwords, bearer tokens, cookies, authorization headers, and secrets
 * are NEVER exposed in reconstructed runtime telemetry.
 */

const SENSITIVE_KEY_PATTERNS = [
    /password/i,
    /secret/i,
    /token/i,
    /authorization/i,
    /api[_-]?key/i,
    /auth/i,
    /cookie/i,
    /session[_-]?token/i,
    /private[_-]?key/i,
    /credit[_-]?card/i,
    /cvv/i,
    /ssn/i,
];

/**
 * Redact sensitive fields within arbitrary JSON metadata or telemetry objects.
 */
export function redactSensitiveData<T>(input: T): T {
    if (input === null || input === undefined) {
        return input;
    }

    if (typeof input === "string") {
        return redactSensitiveString(input) as unknown as T;
    }

    if (Array.isArray(input)) {
        return input.map(item => redactSensitiveData(item)) as unknown as T;
    }

    if (typeof input === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
            if (isSensitiveKey(key)) {
                result[key] = "[REDACTED]";
            } else {
                result[key] = redactSensitiveData(value);
            }
        }
        return result as T;
    }

    return input;
}

/**
 * Check if a dictionary or header key is sensitive.
 */
export function isSensitiveKey(key: string): boolean {
    return SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
}

/**
 * Redact sensitive tokens within string patterns (Bearer tokens, Basic auth, API keys).
 */
export function redactSensitiveString(str: string): string {
    if (!str || typeof str !== "string") return str;

    let clean = str;

    // Bearer tokens: "Bearer eyJhbG..." -> "Bearer [REDACTED]"
    clean = clean.replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, "Bearer [REDACTED]");

    // Basic auth: "Basic dXNlcjpwYXNz" -> "Basic [REDACTED]"
    clean = clean.replace(/Basic\s+[a-zA-Z0-9+/=]+/gi, "Basic [REDACTED]");

    // Query param tokens: "?token=xyz" or "&api_key=xyz"
    clean = clean.replace(/([?&](?:token|key|api_key|password|secret|auth)=)[^&]+/gi, "$1[REDACTED]");

    return clean;
}

/**
 * Filter headers against sensitive keys and safe allowlist.
 */
export function sanitizeHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
    if (!headers) return undefined;

    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
        if (isSensitiveKey(key)) {
            result[key] = "[REDACTED]";
        } else {
            result[key] = redactSensitiveString(value);
        }
    }

    return result;
}
