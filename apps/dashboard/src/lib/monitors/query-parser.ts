import type { Prisma } from "@/generated/prisma/client";

export interface ParsedMonitorQuery {
    raw: string;
    services: string[];
    environments: string[];
    releases: string[];
    severities: string[];
    types: string[];
    statuses: string[];
    fingerprints: string[];
    freeText: string[];
}

/**
 * Parses a monitor filter expression like "service:web-client severity:ERROR checkout"
 * into a structured object of target attributes and free-text terms.
 */
export function parseMonitorQuery(query?: string | null): ParsedMonitorQuery {
    const result: ParsedMonitorQuery = {
        raw: query || "",
        services: [],
        environments: [],
        releases: [],
        severities: [],
        types: [],
        statuses: [],
        fingerprints: [],
        freeText: [],
    };

    if (!query || !query.trim()) {
        return result;
    }

    // Split tokens respecting possible quotes
    const tokens = query.trim().match(/(?:[^\s"]+|"[^"]*")+/g) || [];

    for (const rawToken of tokens) {
        const token = rawToken.replace(/^"|"$/g, "").trim();
        if (!token) continue;

        const colonIdx = token.indexOf(":");
        if (colonIdx > 0) {
            const key = token.slice(0, colonIdx).toLowerCase();
            const value = token.slice(colonIdx + 1).trim();

            if (!value) continue;

            switch (key) {
                case "service":
                case "app":
                case "application":
                    result.services.push(value);
                    break;
                case "env":
                case "environment":
                    result.environments.push(value);
                    break;
                case "release":
                case "version":
                    result.releases.push(value);
                    break;
                case "severity":
                case "level":
                    result.severities.push(value.toUpperCase());
                    break;
                case "type":
                    result.types.push(value.toUpperCase());
                    break;
                case "status":
                    result.statuses.push(value);
                    break;
                case "fingerprint":
                    result.fingerprints.push(value);
                    break;
                default:
                    result.freeText.push(token);
                    break;
            }
        } else {
            result.freeText.push(token);
        }
    }

    return result;
}

/**
 * Builds Prisma Event where clause conditions for a parsed monitor query.
 */
export function buildQueryWhereConditions(parsed: ParsedMonitorQuery): Prisma.EventWhereInput[] {
    const conditions: Prisma.EventWhereInput[] = [];

    // Service matching: checks event.service OR tags.service OR tags.application OR metadata.service
    for (const service of parsed.services) {
        conditions.push({
            OR: [
                { service: { equals: service, mode: "insensitive" } },
                { service: { contains: service, mode: "insensitive" } },
                // Match JSON tags or metadata if service is embedded there
                { tags: { path: ["service"], string_contains: service } },
                { tags: { path: ["application"], string_contains: service } },
                { metadata: { path: ["service"], string_contains: service } },
                { metadata: { path: ["application"], string_contains: service } },
            ],
        });
    }

    // Environment matching
    for (const env of parsed.environments) {
        conditions.push({
            OR: [
                { environment: { name: { equals: env, mode: "insensitive" } } },
                { tags: { path: ["environment"], string_contains: env } },
            ],
        });
    }

    // Release matching
    for (const rel of parsed.releases) {
        conditions.push({
            OR: [
                { release: { equals: rel, mode: "insensitive" } },
                { release: { contains: rel, mode: "insensitive" } },
            ],
        });
    }

    // Severity matching
    for (const sev of parsed.severities) {
        conditions.push({
            severity: sev as any,
        });
    }

    // Type matching
    for (const t of parsed.types) {
        conditions.push({
            type: t as any,
        });
    }

    // Status matching
    for (const st of parsed.statuses) {
        conditions.push({
            status: { equals: st, mode: "insensitive" },
        });
    }

    // Fingerprint matching
    for (const fp of parsed.fingerprints) {
        conditions.push({
            fingerprint: { equals: fp, mode: "insensitive" },
        });
    }

    // Free-text matching
    for (const text of parsed.freeText) {
        conditions.push({
            OR: [
                { title: { contains: text, mode: "insensitive" } },
                { message: { contains: text, mode: "insensitive" } },
                { fingerprint: { contains: text, mode: "insensitive" } },
                { service: { contains: text, mode: "insensitive" } },
            ],
        });
    }

    return conditions;
}
