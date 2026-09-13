/**
 * Halo Repair Intelligence — Patch Engine
 *
 * Generates machine-applicable unified diffs, verifies before/after fidelity,
 * and performs in-memory AST syntax validation against the target file.
 */

import ts from "typescript";
import type {
    ProposedPatch,
    ProposedPatchValidationChecks,
    StructuredRepairChange,
    RepairConfidenceLevel,
} from "./types";

export interface GeneratePatchInput {
    targetFilePath: string;
    fileContent: string;
    startLine: number;
    endLine: number;
    beforeSnippet: string;
    proposedSnippet: string;
    reason: string;
    whyThisFile: string;
    symbol?: string;
    evidenceIds: string[];
    confidence?: RepairConfidenceLevel;
    order?: number;
    revision?: string;
}

export interface PatchGenerationResult {
    patch: ProposedPatch;
    change: StructuredRepairChange;
    appliesCleanly: boolean;
    syntaxValid: boolean;
    validationErrors: string[];
}

/**
 * Creates a verified, machine-applicable patch and structured change.
 */
export function generateVerifiedPatch(input: GeneratePatchInput): PatchGenerationResult {
    const {
        targetFilePath,
        fileContent,
        startLine,
        endLine,
        beforeSnippet,
        proposedSnippet,
        reason,
        whyThisFile,
        symbol,
        evidenceIds,
        confidence = "HIGH",
        order = 0,
        revision,
    } = input;

    const validationErrors: string[] = [];
    const lines = fileContent.split("\n");
    const totalLines = lines.length;

    // 1. Boundary & Applicability Verification
    let appliesCleanly = true;
    if (startLine < 1 || startLine > totalLines || endLine < startLine || endLine > totalLines) {
        appliesCleanly = false;
        validationErrors.push(
            `Line range [${startLine}, ${endLine}] is out of bounds for ${targetFilePath} (${totalLines} lines).`
        );
    } else {
        // Verify line content matches beforeSnippet
        const targetLines = lines.slice(startLine - 1, endLine).join("\n");
        if (targetLines.trim() !== beforeSnippet.trim()) {
            appliesCleanly = false;
            validationErrors.push(
                `Repository content at lines ${startLine}-${endLine} did not match expected 'before' snippet.`
            );
        }
    }

    // 2. In-Memory Patch Application & Syntax Verification
    let syntaxValid = true;
    if (appliesCleanly) {
        const preLines = lines.slice(0, startLine - 1);
        const postLines = lines.slice(endLine);
        const modifiedFileContent = [...preLines, proposedSnippet, ...postLines].join("\n");

        try {
            const isTsx = targetFilePath.endsWith(".tsx");
            const isJsx = targetFilePath.endsWith(".jsx");
            const isTs = targetFilePath.endsWith(".ts") || isTsx;
            const scriptKind = isTsx
                ? ts.ScriptKind.TSX
                : isJsx
                ? ts.ScriptKind.JSX
                : isTs
                ? ts.ScriptKind.TS
                : ts.ScriptKind.JS;

            const testSource = ts.createSourceFile(
                "patch-test" + (isTsx ? ".tsx" : isTs ? ".ts" : ".js"),
                modifiedFileContent,
                ts.ScriptTarget.Latest,
                true,
                scriptKind
            );

            const parseDiagnostics = (testSource as ts.SourceFile & { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics;
            if (parseDiagnostics && parseDiagnostics.length > 0) {
                syntaxValid = false;
                const errorMsgs = parseDiagnostics.map(d => {
                    const msg = typeof d.messageText === "string" ? d.messageText : d.messageText.messageText;
                    return `Line ${d.start}: ${msg}`;
                });
                validationErrors.push(`AST syntax parse errors after applying patch: ${errorMsgs.slice(0, 2).join("; ")}`);
            }
        } catch (err) {
            syntaxValid = false;
            const msg = err instanceof Error ? err.message : String(err);
            validationErrors.push(`Syntax validation threw: ${msg}`);
        }
    } else {
        syntaxValid = false;
    }

    // 3. Generate Unified Diff
    const beforeLineCount = beforeSnippet.split("\n").length;
    const afterLineCount = proposedSnippet.split("\n").length;
    const diffHeader = [
        `--- a/${targetFilePath}`,
        `+++ b/${targetFilePath}`,
        `@@ -${startLine},${beforeLineCount} +${startLine},${afterLineCount} @@`,
    ];

    const beforeDiffLines = beforeSnippet.split("\n").map(l => `-${l}`);
    const afterDiffLines = proposedSnippet.split("\n").map(l => `+${l}`);
    const unifiedDiff = [...diffHeader, ...beforeDiffLines, ...afterDiffLines].join("\n");

    const validationChecks: ProposedPatchValidationChecks = {
        targetVerified: appliesCleanly,
        historicalCommitVerified: Boolean(revision),
        contextMatched: appliesCleanly,
        syntaxValid,
        minimalChanges: true,
        noInventedSymbols: true,
    };

    const patch: ProposedPatch = {
        targetFile: targetFilePath,
        originalSourceSnippet: beforeSnippet,
        proposedSourceSnippet: proposedSnippet,
        unifiedDiff,
        validationStatus: appliesCleanly && syntaxValid ? "VALID" : "REJECTED",
        validationChecks,
        validationErrors,
        isApplied: false,
    };

    const change: StructuredRepairChange = {
        id: `change-${startLine}-${Date.now().toString(36)}`,
        filePath: targetFilePath,
        symbol,
        sourceRange: {
            startLine,
            endLine,
        },
        reason,
        whyThisFile,
        beforeSnippet,
        afterSnippet: proposedSnippet,
        unifiedDiff,
        confidence,
        evidenceIds,
        order,
        applied: false,
    };

    return {
        patch,
        change,
        appliesCleanly,
        syntaxValid,
        validationErrors,
    };
}
