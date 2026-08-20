/**
 * Scrubber and Security Sanitizer for Log Ingestion.
 *
 * 1. Secret Scrubbing: Redacts sensitive secrets (API keys, passwords, bearer tokens).
 * 2. Prompt Injection Defense: Sanitizes untrusted log messages to ensure log content
 *    cannot manipulate investigation policies or system instructions.
 */

// Patterns matching secrets and sensitive credentials
const SECRET_PATTERNS: RegExp[] = [
    // Bearer / OAuth tokens
    /bearer\s+[a-zA-Z0-9_\-\.=:_+/]{16,}/gi,
    // Basic Auth
    /basic\s+[a-zA-Z0-9+/=]{16,}/gi,
    // API keys & secrets
    /(?:api[_-]?key|secret|token|password|passwd|auth[_-]?token|access[_-]?token|private[_-]?key)\s*[:=]\s*["']?([a-zA-Z0-9_\-\.=:_+/]{8,})["']?/gi,
    // AWS keys
    /(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/g,
    // Database connection strings containing passwords
    /(?:postgres|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^:\s]+:([^@\s]+)@/gi,
];

// Patterns commonly used in prompt injection inside logs
const PROMPT_INJECTION_PATTERNS: RegExp[] = [
    /(?:system\s*instruction|system\s*prompt|system\s*override|ignore\s*(?:all\s*)?previous\s*instructions|disregard\s*(?:all\s*)?previous\s*instructions)/gi,
    /(?:new\s*instruction|you\s*are\s*now|roleplay\s*as|developer\s*mode\s*enabled)/gi,
];

export function scrubSecrets(input: string): string {
    if (!input || typeof input !== "string") {
        return "";
    }

    let scrubbed = input;

    // Redact database passwords
    scrubbed = scrubbed.replace(
        /(?:postgres|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/([^:\s]+):([^@\s]+)@/gi,
        (match, user) => match.replace(/:([^@\s]+)@/, `:[REDACTED]@`)
    );

    // Redact general secret patterns
    for (const pattern of SECRET_PATTERNS) {
        scrubbed = scrubbed.replace(pattern, (match) => {
            if (match.toLowerCase().startsWith("bearer ")) {
                return "Bearer [REDACTED]";
            }
            if (match.toLowerCase().startsWith("basic ")) {
                return "Basic [REDACTED]";
            }
            if (match.includes("=")) {
                const parts = match.split("=");
                return `${parts[0]}=[REDACTED]`;
            }
            if (match.includes(":")) {
                const parts = match.split(":");
                return `${parts[0]}: [REDACTED]`;
            }
            return "[REDACTED_SECRET]";
        });
    }

    return scrubbed;
}

export function sanitizeUntrustedLog(input: string): string {
    if (!input || typeof input !== "string") {
        return "";
    }

    let sanitized = scrubSecrets(input);

    // Escape prompt injection triggers by neutralizing control words
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
        sanitized = sanitized.replace(pattern, (match) => `[LOG_TEXT_UNTRUSTED: ${match}]`);
    }

    // Guard against excessive string lengths that could exhaust memory
    if (sanitized.length > 32_000) {
        sanitized = sanitized.slice(0, 32_000) + " ... [TRUNCATED_EXCESSIVE_LENGTH]";
    }

    return sanitized;
}
