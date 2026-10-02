/**
 * Production-Safe CODEOWNERS Parser & Path Matcher
 *
 * Implements GitHub-compatible CODEOWNERS syntax with strict defensive security:
 * - Full pattern support: exact paths, wildcards (*, **), directories (trailing /).
 * - GitHub rule precedence: later matching rules override earlier ones.
 * - Multiple declared owners preserved (never arbitrarily picks one).
 * - Path traversal protection: rejects ../, escaping root, null bytes.
 * - Resilience: survives malformed lines, huge content, whitespace variations without throwing.
 */

export interface CodeownerRule {
    pattern: string;
    regex: RegExp;
    owners: string[];
    lineNumber: number;
    rawLine: string;
}

export interface ParsedCodeowners {
    rules: CodeownerRule[];
    sourceLocation?: string;
    commitSha?: string;
    totalRules: number;
}

export interface CodePathOwnershipMatch {
    filePath: string;
    matchingRule?: CodeownerRule;
    owners: string[];
    isDeclared: boolean;
    source: "CODEOWNERS";
    location?: string;
    commitSha?: string;
}

/**
 * Standard CODEOWNERS discovery paths in Git repositories.
 */
export const CODEOWNERS_CANDIDATE_PATHS = [
    ".github/CODEOWNERS",
    "CODEOWNERS",
    "docs/CODEOWNERS",
] as const;

/**
 * Validates and sanitizes a repository-relative path to prevent directory traversal.
 * Returns normalized path (e.g. "apps/payments/refund.ts") or throws/returns null on traversal attempt.
 */
export function sanitizeRepositoryPath(targetPath: string): string | null {
    if (!targetPath || typeof targetPath !== "string") {
        return null;
    }

    // Check for null bytes
    if (targetPath.includes("\0")) {
        return null;
    }

    // Replace Windows backslashes with forward slashes
    let normalized = targetPath.replace(/\\/g, "/").trim();

    // Check for directory traversal attempts
    const segments = normalized.split("/");
    for (const segment of segments) {
        if (segment === ".." || segment === ".") {
            return null; // Reject traversal or relative dot-segments
        }
    }

    if (normalized.includes("../") || normalized.startsWith("/")) {
        // Strip leading slash if any
        normalized = normalized.replace(/^\/+/, "");
        if (normalized.includes("..")) {
            return null;
        }
    }

    return normalized;
}

/**
 * Converts a gitignore/CODEOWNERS glob pattern into a safe regular expression.
 */
export function patternToRegex(pattern: string): RegExp | null {
    try {
        let p = pattern.trim();
        if (!p) return null;

        // If pattern starts with a slash, it is anchored at repo root
        const anchoredAtStart = p.startsWith("/");
        if (anchoredAtStart) {
            p = p.slice(1);
        }

        // If pattern ends with slash, it matches any file within that directory
        const isDirectory = p.endsWith("/");
        if (isDirectory) {
            p = p.slice(0, -1);
        }

        // Escape regex special chars except * and ?
        let escaped = p.replace(/[.+^${}()|[\]\\]/g, "\\$&");

        // Handle ** (matches across directory boundaries)
        escaped = escaped.replace(/\*\*/g, "___DOUBLE_STAR___");
        // Handle single * (matches within directory segment)
        escaped = escaped.replace(/\*/g, "[^/]*");
        // Restore double star
        escaped = escaped.replace(/___DOUBLE_STAR___/g, ".*");
        // Handle ?
        escaped = escaped.replace(/\?/g, "[^/]");

        let regexStr = "";
        if (anchoredAtStart) {
            regexStr = `^${escaped}`;
        } else {
            // Can match at root or in subdirectory
            regexStr = `(^|/)${escaped}`;
        }

        if (isDirectory) {
            regexStr += `(/.*)?$`;
        } else {
            regexStr += `(/.*)?$`;
        }

        return new RegExp(regexStr);
    } catch {
        return null;
    }
}

/**
 * Parses raw CODEOWNERS file content safely.
 * Resilient against malformed lines, unknown tokens, comments, and huge files.
 */
export function parseCodeownersContent(
    content: string,
    options?: { sourceLocation?: string; commitSha?: string }
): ParsedCodeowners {
    const rules: CodeownerRule[] = [];
    if (!content || typeof content !== "string") {
        return { rules: [], totalRules: 0, ...options };
    }

    const lines = content.split(/\r?\n/);
    const MAX_LINES = 10000; // DoS protection against unbounded files
    const linesToProcess = lines.slice(0, MAX_LINES);

    for (let i = 0; i < linesToProcess.length; i++) {
        const rawLine = linesToProcess[i];
        const trimmed = rawLine.trim();

        // Skip comments and empty lines
        if (!trimmed || trimmed.startsWith("#")) {
            continue;
        }

        // Extract tokens: <pattern> <owner1> <owner2> ...
        // Strip trailing comment if present
        let cleanLine = trimmed;
        const commentIdx = cleanLine.indexOf(" #");
        if (commentIdx !== -1) {
            cleanLine = cleanLine.slice(0, commentIdx).trim();
        }

        const tokens = cleanLine.split(/\s+/).filter(Boolean);
        if (tokens.length < 2) {
            // Missing pattern or owner, ignore safely
            continue;
        }

        const pattern = tokens[0];
        const rawOwners = tokens.slice(1);

        // Sanitize and deduplicate owners while preserving all distinct declared owners
        const ownersSet = new Set<string>();
        for (const o of rawOwners) {
            if (o.startsWith("@") || o.includes("@")) {
                ownersSet.add(o.trim());
            } else if (o.length > 0) {
                ownersSet.add(o.trim());
            }
        }

        if (ownersSet.size === 0) {
            continue;
        }

        const regex = patternToRegex(pattern);
        if (!regex) {
            continue;
        }

        rules.push({
            pattern,
            regex,
            owners: Array.from(ownersSet),
            lineNumber: i + 1,
            rawLine: trimmed,
        });
    }

    return {
        rules,
        totalRules: rules.length,
        sourceLocation: options?.sourceLocation,
        commitSha: options?.commitSha,
    };
}

/**
 * Resolves ownership for a given file path against parsed CODEOWNERS rules.
 * Implements Git CODEOWNERS standard: the last matching rule takes precedence.
 */
export function resolveCodeownersForPath(
    parsed: ParsedCodeowners,
    filePath: string
): CodePathOwnershipMatch {
    const sanitized = sanitizeRepositoryPath(filePath);
    if (!sanitized) {
        return {
            filePath,
            owners: [],
            isDeclared: false,
            source: "CODEOWNERS",
            location: parsed.sourceLocation,
            commitSha: parsed.commitSha,
        };
    }

    let lastMatch: CodeownerRule | undefined = undefined;

    // Evaluate in order; last match wins
    for (const rule of parsed.rules) {
        if (rule.regex.test(sanitized)) {
            lastMatch = rule;
        }
    }

    if (!lastMatch) {
        return {
            filePath: sanitized,
            owners: [],
            isDeclared: false,
            source: "CODEOWNERS",
            location: parsed.sourceLocation,
            commitSha: parsed.commitSha,
        };
    }

    return {
        filePath: sanitized,
        matchingRule: lastMatch,
        owners: lastMatch.owners,
        isDeclared: true,
        source: "CODEOWNERS",
        location: parsed.sourceLocation,
        commitSha: parsed.commitSha,
    };
}
