import type { Evidence } from "../types/evidence";
import type { StructuralTemplate } from "../types/template";

/**
 * Fast, deterministic structural template miner (Drain-inspired).
 *
 * Strips dynamic parameters, numbers, UUIDs, hashes, and URLs to cluster
 * raw log messages into structural log templates.
 */

export function extractTemplatePattern(message: string): { pattern: string; id: string; wildcards: number } {
    if (!message || typeof message !== "string") {
        return { pattern: "<*>", id: "empty", wildcards: 1 };
    }

    let pattern = message.trim();

    // 1. URLs and URIs
    pattern = pattern.replace(/https?:\/\/[^\s]+/gi, "<*>");

    // 2. UUIDs / GUIDs
    pattern = pattern.replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, "<*>");

    // 3. Email addresses
    pattern = pattern.replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, "<*>");

    // 4. IPv4 / IPv6 addresses
    pattern = pattern.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?\b/g, "<*>");
    pattern = pattern.replace(/\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g, "<*>");

    // 5. Hexadecimal hashes (e.g. git commits, object IDs, memory addresses)
    pattern = pattern.replace(/\b0x[0-9a-fA-F]+\b/g, "<*>");
    pattern = pattern.replace(/\b[0-9a-fA-F]{16,64}\b/g, "<*>");

    // 6. Quoted strings
    pattern = pattern.replace(/"[^"]*"/g, '"<*>"');
    pattern = pattern.replace(/'[^']*'/g, "'<*>'");

    // 7. Unix / Windows file paths
    pattern = pattern.replace(/(?:\/[a-zA-Z0-9_\-\.]+){2,}/g, "<*>");
    pattern = pattern.replace(/(?:[a-zA-Z]:\\[a-zA-Z0-9_\-\.\\]+)/g, "<*>");

    // 8. Timestamps (ISO or standard date strings)
    pattern = pattern.replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?\b/g, "<*>");

    // 9. Decimal numbers, integers, durations
    pattern = pattern.replace(/\b\d+(?:\.\d+)?(?:ms|s|m|µs|ns|kb|mb|gb|b)?\b/gi, "<*>");

    // 10. Collapse multiple consecutive wildcards
    pattern = pattern.replace(/(?:<\*>\s*){2,}/g, "<*> ");
    pattern = pattern.replace(/<\*>(?:[_-]<\*>)+/g, "<*>");

    pattern = pattern.trim();
    if (pattern.length === 0) {
        pattern = "<*>";
    }

    const wildcards = (pattern.match(/<\*>/g) || []).length;
    const id = generateSimpleHash(pattern);

    return { pattern, id, wildcards };
}

export function mineStructuralTemplates(evidence: Evidence[]): Map<string, StructuralTemplate> {
    const templates = new Map<string, StructuralTemplate>();

    for (const item of evidence) {
        const textToMine = item.title || item.description || item.type;
        const { pattern, id, wildcards } = extractTemplatePattern(textToMine);

        const existing = templates.get(id);
        if (existing) {
            existing.sampleCount++;
            if (!existing.services.includes(item.service)) {
                existing.services.push(item.service);
            }
            if (item.timestamp < existing.firstSeen) {
                existing.firstSeen = item.timestamp;
            }
            if (item.timestamp > existing.lastSeen) {
                existing.lastSeen = item.timestamp;
            }
            if (existing.sampleTitles.length < 5 && !existing.sampleTitles.includes(item.title)) {
                existing.sampleTitles.push(item.title);
            }
        } else {
            const tokenCount = pattern.split(/\s+/).length;
            templates.set(id, {
                id,
                pattern,
                tokenCount,
                wildcardCount: wildcards,
                sampleCount: 1,
                services: [item.service],
                firstSeen: item.timestamp,
                lastSeen: item.timestamp,
                sampleTitles: [item.title],
            });
        }
    }

    return templates;
}

function generateSimpleHash(str: string): string {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return "tpl_" + (hash >>> 0).toString(16);
}
