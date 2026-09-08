/**
 * Halo Proposed Patch Validator
 *
 * Deterministically verifies proposed code diffs before they can be displayed to a user.
 * Enforces:
 *   1. Zero direct modification of user repository (patches are strictly proposals).
 *   2. Diff applies cleanly to the verified source snippet resolved at the execution commit.
 *   3. Minimal targeted change (rejects large rewrites / unrelated refactors).
 *   4. TypeScript / JavaScript AST syntax validation on the modified snippet.
 */

import ts from "typescript";
import type { EvidenceSnapshot } from "../evidence-snapshot";
import type { ModelProposedPatch, RecommendationEligibilityVerdict } from "./types";

export interface PatchValidationResult {
    isValid: boolean;
    validationNote: string;
    refusalReason?: string;
    appliedPreview?: string;
}

export function validateProposedPatch(
    patch: ModelProposedPatch | undefined,
    snapshot: EvidenceSnapshot,
    gateVerdict: RecommendationEligibilityVerdict
): PatchValidationResult {
    if (!patch || patch.status !== "AVAILABLE") {
        const reason =
            patch?.refusalReason ??
            gateVerdict.patchReason ??
            "No code patch was proposed for this incident.";
        return {
            isValid: true,
            validationNote: "Patch not proposed (safe refusal).",
            refusalReason: reason,
        };
    }

    // 1. Check Gate Permission
    if (gateVerdict.patchEligibility !== "CAN_GENERATE_PATCH") {
        return {
            isValid: false,
            validationNote: "Gate violation: Model proposed patch when gate marked patch ineligible.",
            refusalReason: `Patch was rejected: ${gateVerdict.patchReason}`,
        };
    }

    // 2. Check source presence
    const source = snapshot.source;
    if (!source || source.resolutionStatus !== "exact_file" || !source.lines || source.lines.length === 0) {
        return {
            isValid: false,
            validationNote: "Source code is missing or unverified.",
            refusalReason: "Cannot validate patch because exact source snippet is unavailable.",
        };
    }

    if (!patch.files || patch.files.length === 0) {
        return {
            isValid: false,
            validationNote: "Patch status is AVAILABLE but files array is empty.",
            refusalReason: "No diff content provided.",
        };
    }

    const patchFile = patch.files[0];

    // 3. Check File Path Match
    const normalizedTarget = patchFile.path.replace(/^[ab]\//, "").toLowerCase();
    const normalizedSource = source.filePath.toLowerCase();
    if (!normalizedSource.endsWith(normalizedTarget) && !normalizedTarget.endsWith(normalizedSource)) {
        return {
            isValid: false,
            validationNote: `Target file mismatch: proposed "${patchFile.path}" but resolved source is "${source.filePath}".`,
            refusalReason: `Patch proposed modifying "${patchFile.path}" which differs from verified source "${source.filePath}".`,
        };
    }

    // 4. Test Diff Application against Source Lines
    const originalText = source.lines.map((l) => l.content).join("\n");
    const applyResult = applyUnifiedDiffToSnippet(originalText, patchFile.diff);

    if (!applyResult.success) {
        return {
            isValid: false,
            validationNote: `Diff failed to apply cleanly to resolved source: ${applyResult.error}`,
            refusalReason:
                "Proposed diff could not be applied cleanly to the verified source lines.",
        };
    }

    // 5. Check Minimality (Max 15 added or removed lines)
    if (applyResult.addedLinesCount > 15 || applyResult.removedLinesCount > 15) {
        return {
            isValid: false,
            validationNote: `Diff exceeds minimality threshold (${applyResult.addedLinesCount} lines added, ${applyResult.removedLinesCount} lines removed).`,
            refusalReason:
                "Proposed diff is too broad. Halo requires minimal, targeted patches.",
        };
    }

    // 6. AST Syntax Check for JS/TS
    const isTs = /\.tsx?$/i.test(source.filePath);
    const isJs = /\.jsx?$/i.test(source.filePath);
    if (isTs || isJs) {
        try {
            const scriptKind = source.filePath.endsWith(".tsx")
                ? ts.ScriptKind.TSX
                : source.filePath.endsWith(".jsx")
                ? ts.ScriptKind.JSX
                : isTs
                ? ts.ScriptKind.TS
                : ts.ScriptKind.JS;

            const sf = ts.createSourceFile(
                "patched-preview.ts",
                applyResult.patchedText,
                ts.ScriptTarget.Latest,
                true,
                scriptKind
            );

            const diagnostics = (sf as any).parseDiagnostics || [];
            if (diagnostics.length > 0) {
                // If there are syntax parse errors
                const firstError = diagnostics[0];
                const msg =
                    typeof firstError.messageText === "string"
                        ? firstError.messageText
                        : firstError.messageText?.messageText;
                return {
                    isValid: false,
                    validationNote: `Syntax validation failed on patched code: ${msg}`,
                    refusalReason: "Proposed patch introduces a syntax error.",
                };
            }
        } catch {
            // If parser throws unexpectedly, reject patch
            return {
                isValid: false,
                validationNote: "AST parser crashed during syntax check.",
                refusalReason: "Patched code could not be verified by AST parser.",
            };
        }
    }

    return {
        isValid: true,
        validationNote: `Proposed patch verified: cleanly applies to ${source.filePath} at line ${source.failingLineNumber} (Syntax validated).`,
        appliedPreview: applyResult.patchedText,
    };
}

interface DiffApplyResult {
    success: boolean;
    error?: string;
    patchedText: string;
    addedLinesCount: number;
    removedLinesCount: number;
}

/**
 * Deterministic unified diff applier for single file snippets.
 */
export function applyUnifiedDiffToSnippet(originalText: string, diffText: string): DiffApplyResult {
    const origLines = originalText.split(/\r?\n/);
    const diffLines = diffText.split(/\r?\n/);

    let addedLinesCount = 0;
    let removedLinesCount = 0;

    const removedPatterns: string[] = [];
    const addedReplacements: string[] = [];

    for (const dLine of diffLines) {
        if (dLine.startsWith("---") || dLine.startsWith("+++") || dLine.startsWith("@@")) {
            continue;
        }

        if (dLine.startsWith("-")) {
            removedPatterns.push(dLine.slice(1).trim());
            removedLinesCount++;
        } else if (dLine.startsWith("+")) {
            addedReplacements.push(dLine.slice(1));
            addedLinesCount++;
        }
    }

    if (removedPatterns.length === 0 && addedReplacements.length === 0) {
        return {
            success: false,
            error: "Diff contains no addition or removal lines.",
            patchedText: originalText,
            addedLinesCount: 0,
            removedLinesCount: 0,
        };
    }

    // Verify that all removed lines actually exist in the snippet
    let patchedText = originalText;
    for (const pattern of removedPatterns) {
        if (pattern.length > 0) {
            const hasMatch = origLines.some((l) => l.trim() === pattern || l.includes(pattern));
            if (!hasMatch) {
                return {
                    success: false,
                    error: `Removed line "${pattern}" does not match any line in verified source.`,
                    patchedText: originalText,
                    addedLinesCount,
                    removedLinesCount,
                };
            }
        }
    }

    // Simulate simple patch replacement
    if (removedPatterns.length > 0) {
        for (let i = 0; i < removedPatterns.length; i++) {
            const target = removedPatterns[i];
            const replacement = addedReplacements[i] ?? "";
            if (target.length > 0) {
                patchedText = patchedText.replace(target, replacement.trim());
            }
        }
    } else {
        // Pure insertion
        patchedText = `${originalText}\n${addedReplacements.join("\n")}`;
    }

    return {
        success: true,
        patchedText,
        addedLinesCount,
        removedLinesCount,
    };
}
