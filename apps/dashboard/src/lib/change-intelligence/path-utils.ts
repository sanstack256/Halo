/**
 * Path and line intersection utilities for Change Intelligence.
 *
 * Enforces strict security against path traversal and provides
 * deterministic line-range intersection checking against Git patches.
 */

import { sanitizeRepositoryPath } from "../ownership/codeowners-parser";
import { type SignalLevel } from "./types";

export { sanitizeRepositoryPath };

/**
 * Normalizes repository-relative paths for comparison.
 */
export function normalizePath(rawPath: string): string {
    const sanitized = sanitizeRepositoryPath(rawPath);
    if (!sanitized) return "";
    return sanitized.toLowerCase();
}

/**
 * Determines whether a changed file path intersects a failing stack frame path.
 */
export function doesPathIntersect(changedPath: string, failingPath: string): boolean {
    const normChanged = normalizePath(changedPath);
    const normFailing = normalizePath(failingPath);

    if (!normChanged || !normFailing) return false;

    // Exact match
    if (normChanged === normFailing) return true;

    // Suffix / basename match if path segments are structurally aligned
    const changedSegments = normChanged.split("/");
    const failingSegments = normFailing.split("/");

    const changedName = changedSegments[changedSegments.length - 1];
    const failingName = failingSegments[failingSegments.length - 1];

    if (changedName !== failingName) return false;

    // Compare trailing segments
    const minLen = Math.min(changedSegments.length, failingSegments.length);
    for (let i = 1; i <= minLen; i++) {
        if (changedSegments[changedSegments.length - i] !== failingSegments[failingSegments.length - i]) {
            return false;
        }
    }

    return true;
}

export interface DiffHunkRange {
    start: number;
    count: number;
}

/**
 * Extracts added/modified line ranges from a unified diff patch string.
 * Example header: @@ -10,4 +12,6 @@ -> modified starts at line 12 with 6 lines.
 */
export function parsePatchModifiedRanges(patch?: string): DiffHunkRange[] {
    if (!patch || typeof patch !== "string") return [];

    const ranges: DiffHunkRange[] = [];
    const hunkHeaderRegex = /@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s+@@/g;

    let match: RegExpExecArray | null;
    while ((match = hunkHeaderRegex.exec(patch)) !== null) {
        const start = parseInt(match[1], 10);
        const count = match[2] !== undefined ? parseInt(match[2], 10) : 1;
        if (!isNaN(start)) {
            ranges.push({ start, count: Math.max(1, count) });
        }
    }

    return ranges;
}

/**
 * Evaluates whether a failing line number intersects changed lines in a patch.
 *
 * CRITICAL RULE: If only file-level evidence exists (no patch or no failing line number),
 * returns UNAVAILABLE, NEVER false or NONE.
 */
export function evaluateLineIntersection(
    patch?: string,
    failingLineNumber?: number
): SignalLevel | "UNAVAILABLE" {
    if (!patch || failingLineNumber === undefined || failingLineNumber === null || failingLineNumber <= 0) {
        return "UNAVAILABLE";
    }

    const ranges = parsePatchModifiedRanges(patch);
    if (ranges.length === 0) {
        return "UNAVAILABLE";
    }

    for (const range of ranges) {
        const rangeEnd = range.start + range.count - 1;
        if (failingLineNumber >= range.start && failingLineNumber <= rangeEnd) {
            return "HIGH";
        }
        // Within 10 lines of the modified range -> proximity signal
        if (Math.abs(failingLineNumber - range.start) <= 10 || Math.abs(failingLineNumber - rangeEnd) <= 10) {
            return "MEDIUM";
        }
    }

    return "NONE";
}
