/**
 * Halo Telemetry Redaction
 *
 * Wraps and extends Halo's deterministic redaction rules to ensure no API keys,
 * passwords, Bearer tokens, or credentials ever enter LLM context.
 */

import { redactSensitiveString as baseRedactSensitiveString } from "@halo/investigation-engine";

export function redactSensitiveData(str: string): string {
    if (!str || typeof str !== "string") return str;

    let clean = baseRedactSensitiveString(str);

    // Redact JWT tokens
    clean = clean.replace(/eyJ[a-zA-Z0-9_\-]+\.eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/g, "[REDACTED_JWT]");

    // Redact common secret prefixes
    clean = clean.replace(/(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}/g, "[REDACTED_GITHUB_TOKEN]");
    clean = clean.replace(/sk-[a-zA-Z0-9]{32,}/g, "[REDACTED_API_KEY]");
    clean = clean.replace(/AIza[0-9A-Za-z-_]{35}/g, "[REDACTED_GOOGLE_KEY]");

    return clean;
}

export function sanitizeForPrompt(str: string): string {
    if (!str || typeof str !== "string") return str;
    let clean = redactSensitiveData(str);

    // Neutralize prompt boundary injection and XML delimiter tags
    clean = clean.replace(
        /<\/?(?:untrusted_production_telemetry|untrusted_repository_source|DATA_PAYLOAD|TELEMETRY_DATA|REPOSITORY_DATA|system|user|assistant)>/gi,
        (match) => `[ESCAPED_DELIMITER: ${match.replace(/[<>]/g, "")}]`
    );

    // Neutralize chat template delimiter tokens
    clean = clean.replace(/\[\/?INST\]/gi, "[ESCAPED_INST]");
    clean = clean.replace(/<\|im_(?:start|end)\|>/gi, "[ESCAPED_IM]");

    return clean;
}
