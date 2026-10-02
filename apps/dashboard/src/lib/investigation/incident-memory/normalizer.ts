/**
 * Normalization utilities for Halo Organizational Failure Memory.
 *
 * Requirements:
 * 1. Historical comparison must not be based on raw ephemeral strings alone.
 * 2. Dynamic UUIDs, request IDs, user IDs, timestamps, hex hashes, and numeric path segments
 *    must be stripped or normalized deterministically so identical failures match.
 * 3. Normalization must be 100% deterministic and pure.
 */

// Regular expressions for dynamic ephemeral patterns
const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const HEX_HASH_REGEX = /\b(0x)?[0-9a-f]{16,64}\b/gi;
const NUMERIC_ID_PATH_REGEX = /\/\d+(\b|\/)/g;
const NUMERIC_PARAM_REGEX = /=\d+(\b|&)/g;
const ISO_TIMESTAMP_REGEX = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/gi;
const WHITESPACE_REGEX = /\s+/g;

/**
 * Normalize an incident or error title by removing dynamic variables and IDs.
 */
export function normalizeIncidentTitle(title: string): string {
    if (!title) return "";
    return title
        .replace(ISO_TIMESTAMP_REGEX, "<TIMESTAMP>")
        .replace(UUID_REGEX, "<UUID>")
        .replace(HEX_HASH_REGEX, "<HASH>")
        .replace(NUMERIC_ID_PATH_REGEX, "/:id$1")
        .replace(NUMERIC_PARAM_REGEX, "=:id$1")
        .replace(WHITESPACE_REGEX, " ")
        .trim();
}

/**
 * Normalize an HTTP or RPC operation endpoint.
 * Example: `POST /api/v1/orders/839412/charge` -> `POST /api/v1/orders/:id/charge`
 */
export function normalizeOperation(operation?: string | null): string {
    if (!operation) return "UNKNOWN_OPERATION";
    return operation
        .replace(UUID_REGEX, ":id")
        .replace(HEX_HASH_REGEX, ":hash")
        .replace(NUMERIC_ID_PATH_REGEX, "/:id$1")
        .trim();
}

/**
 * Extract canonical error type from error message or exception title.
 * Example: `ConnectionTimeoutError: pool exhausted after 30000ms` -> `ConnectionTimeoutError`
 */
export function extractErrorType(title: string): string {
    if (!title) return "UnknownError";
    const colonIdx = title.indexOf(":");
    if (colonIdx > 0 && colonIdx < 50) {
        const candidate = title.slice(0, colonIdx).trim();
        if (/^[A-Za-z0-9_]+Error$/i.test(candidate) || /^[A-Z][A-Za-z0-9_]+Exception$/i.test(candidate)) {
            return candidate;
        }
    }
    const match = title.match(/^([A-Za-z0-9_]+(Error|Exception|Timeout|Failure|Fault))/i);
    if (match) return match[1];

    // Fallback: take first two words
    const words = title.split(/\s+/).slice(0, 2).join("_");
    return words || "UnknownError";
}

/**
 * Generate structural similarity fingerprint for an incident.
 * Combines normalized service, operation, and error classification.
 */
export function generateIncidentFingerprint(params: {
    service: string;
    operation?: string | null;
    errorType?: string | null;
}): string {
    const s = (params.service || "unknown-service").toLowerCase().trim();
    const op = normalizeOperation(params.operation).toLowerCase();
    const err = (params.errorType || "unknown-error").toLowerCase().trim();
    return `${s}::${op}::${err}`;
}

/**
 * Generate a deterministic pattern key for recurring failure clustering.
 * Clusters by primary service and error type.
 */
export function generateFailurePatternKey(service: string, errorType: string): string {
    const s = (service || "unknown-service").toLowerCase().trim();
    const err = (errorType || "unknown-error").toLowerCase().trim();
    return `pattern::${s}::${err}`;
}
