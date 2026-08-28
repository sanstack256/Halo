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

export function isSensitiveKey(key: string): boolean {
    return SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
}

export function redactSensitiveString(str: string): string {
    if (!str || typeof str !== "string") return str;

    let clean = str;
    clean = clean.replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, "Bearer [REDACTED]");
    clean = clean.replace(/Basic\s+[a-zA-Z0-9+/=]+/gi, "Basic [REDACTED]");
    clean = clean.replace(/([?&](?:token|key|api_key|password|secret|auth)=)[^&]+/gi, "$1[REDACTED]");
    return clean;
}

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
