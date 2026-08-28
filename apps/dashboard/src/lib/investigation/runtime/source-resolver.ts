import fs from "fs";
import path from "path";
import type { StackFrame, SourceContext } from "./types";
import { resolveAstFromSource } from "./ast-resolver";

const CONTEXT_LINES_BEFORE = 6;
const CONTEXT_LINES_AFTER = 6;

/**
 * Real Source Code Resolver
 *
 * Implements a strict Source Provider architecture:
 *   1. Direct absolute path from stack frame (highest priority — enables external applications like halo-test2)
 *   2. Configured projectRoot + relative path
 *   3. process.cwd() + relative path
 *   4. Parent directory + relative path
 *   5. Unresolvable — returns explicit unavailabilityReason, NEVER substitutes Halo's own files.
 *
 * Source inspection:
 *   - Uses TypeScript AST parser to locate the exact node at (line, column)
 *   - Resolves the exact failing expression (e.g. `profile.settings`, `results.find`)
 *   - Resolves containing function and enclosing statement
 */
export function resolveSourceContext(
    frame: StackFrame | undefined,
    projectRoot?: string,
    releaseRevision?: string
): SourceContext | undefined {
    if (!frame || !frame.filePath || !frame.lineNumber) {
        return undefined;
    }

    const resolvedFilePath = findActualSourceFile(frame.rawFilePath || frame.filePath, projectRoot);

    if (!resolvedFilePath) {
        const unavailabilityReason = buildUnavailabilityReason(frame.rawFilePath || frame.filePath, projectRoot);
        return {
            filePath: frame.filePath,
            failingLineNumber: frame.lineNumber,
            failingColumnNumber: frame.columnNumber,
            startLineNumber: frame.lineNumber,
            lines: [],
            resolutionStatus: releaseRevision ? "source_revision_unavailable" : "file_not_found",
            unavailabilityReason,
            revision: releaseRevision,
        };
    }

    try {
        const fileContent = fs.readFileSync(resolvedFilePath, "utf-8");
        const allLines = fileContent.split("\n");
        const totalLines = allLines.length;

        const targetLineIdx = frame.lineNumber - 1; // 0-indexed
        if (targetLineIdx < 0 || targetLineIdx >= totalLines) {
            return {
                filePath: resolvedFilePath,
                failingLineNumber: frame.lineNumber,
                failingColumnNumber: frame.columnNumber,
                startLineNumber: frame.lineNumber,
                lines: [],
                resolutionStatus: "file_not_found",
                unavailabilityReason: `Line ${frame.lineNumber} is out of bounds for ${resolvedFilePath} (${totalLines} lines).`,
                revision: releaseRevision,
            };
        }

        const startIdx = Math.max(0, targetLineIdx - CONTEXT_LINES_BEFORE);
        const endIdx = Math.min(totalLines - 1, targetLineIdx + CONTEXT_LINES_AFTER);

        const lines = [];
        for (let i = startIdx; i <= endIdx; i++) {
            lines.push({
                lineNumber: i + 1,
                content: allLines[i],
                isFailingLine: i === targetLineIdx,
            });
        }

        // 1. First attempt: AST-based expression and function resolution
        const astResult = resolveAstFromSource(
            fileContent,
            frame.lineNumber,
            frame.columnNumber,
            resolvedFilePath
        );

        // 2. Fallbacks if AST did not resolve a specific field
        const failingStatement =
            astResult.failingStatement || allLines[targetLineIdx].trim();

        const containingFunction =
            astResult.containingFunction ||
            detectContainingFunctionFallback(allLines, targetLineIdx) ||
            (frame.functionName && frame.functionName !== "<anonymous>" ? frame.functionName : undefined);

        const failingExpression =
            astResult.failingExpression ||
            extractFailingExpressionFallback(failingStatement, frame.columnNumber);

        return {
            filePath: resolvedFilePath,
            failingLineNumber: frame.lineNumber,
            failingColumnNumber: frame.columnNumber,
            startLineNumber: startIdx + 1,
            lines,
            containingFunction:
                containingFunction && containingFunction !== "<anonymous>"
                    ? containingFunction
                    : undefined,
            failingStatement,
            failingExpression,
            resolutionStatus: "exact_file",
            revision: releaseRevision,
        };
    } catch (err) {
        return {
            filePath: resolvedFilePath,
            failingLineNumber: frame.lineNumber,
            failingColumnNumber: frame.columnNumber,
            startLineNumber: frame.lineNumber,
            lines: [],
            resolutionStatus: "file_not_found",
            unavailabilityReason: `Could not read file at ${resolvedFilePath}: ${err instanceof Error ? err.message : "unknown error"}.`,
            revision: releaseRevision,
        };
    }
}

/**
 * Locate the real source file on disk.
 */
function findActualSourceFile(rawPath: string, projectRoot?: string): string | null {
    if (!rawPath) return null;

    // 1. Absolute path check (highest priority)
    if (path.isAbsolute(rawPath)) {
        try {
            if (fs.existsSync(rawPath) && fs.statSync(rawPath).isFile()) {
                return rawPath;
            }
        } catch {
            // Inaccessible — continue
        }
    }

    const clean = rawPath.replace(/^\.\//, "").replace(/^\//, "");

    // 2. Candidate paths
    const candidates: string[] = [];

    if (projectRoot) {
        candidates.push(path.join(/*turbopackIgnore: true*/ projectRoot, clean));
        candidates.push(path.join(/*turbopackIgnore: true*/ projectRoot, "src", clean));
        candidates.push(path.join(/*turbopackIgnore: true*/ projectRoot, "app", clean));
    }

    const cwd = process.cwd();
    candidates.push(path.join(/*turbopackIgnore: true*/ cwd, clean));
    candidates.push(path.join(/*turbopackIgnore: true*/ cwd, "apps", "dashboard", clean));
    candidates.push(path.join(/*turbopackIgnore: true*/ cwd, "apps", "dashboard", "src", clean));

    const parentDir = path.resolve(/*turbopackIgnore: true*/ cwd, "..");
    candidates.push(path.join(/*turbopackIgnore: true*/ parentDir, clean));

    if (process.env.HOME) {
        candidates.push(path.join(/*turbopackIgnore: true*/ process.env.HOME, "Development", clean));
    }

    for (const candidate of candidates) {
        try {
            if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                return candidate;
            }
        } catch {
            // Skip inaccessible paths
        }
    }

    return null;
}

function buildUnavailabilityReason(rawPath: string, projectRoot?: string): string {
    if (!rawPath) {
        return "No file path was recorded in the stack frame.";
    }

    if (path.isAbsolute(rawPath)) {
        return (
            `The source file \`${rawPath}\` is not accessible on the current host. ` +
            `This file exists in the external application that generated the event, not in Halo's codebase. ` +
            (projectRoot
                ? `Project source root is configured as \`${projectRoot}\` but the absolute path does not match.`
                : `Configure a source repository integration in Project Settings to enable remote source resolution.`)
        );
    }

    return (
        `The relative path \`${rawPath}\` could not be resolved under any known source root. ` +
        `Configure a source repository integration in Project Settings to enable remote source resolution.`
    );
}

function detectContainingFunctionFallback(lines: string[], targetLineIdx: number): string | undefined {
    for (let i = targetLineIdx; i >= Math.max(0, targetLineIdx - 40); i--) {
        const line = lines[i];

        const funcMatch = line.match(/(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(/);
        if (funcMatch) return funcMatch[1];

        const arrowMatch = line.match(
            /(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>/
        );
        if (arrowMatch) return arrowMatch[1];

        const methodMatch = line.match(
            /^\s*(?:async\s+)?(?:public|private|protected|static\s+)?([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/
        );
        if (methodMatch && !["if", "for", "while", "switch", "catch"].includes(methodMatch[1])) {
            return methodMatch[1];
        }

        const defaultFuncMatch = line.match(/export\s+default\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)?/);
        if (defaultFuncMatch && defaultFuncMatch[1]) return defaultFuncMatch[1];
    }

    return undefined;
}

function extractFailingExpressionFallback(statement: string, columnNumber?: number): string | undefined {
    if (!statement) return undefined;

    const trimmed = statement.trim();
    const propChainRegex = /([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)+)/g;
    type ChainMatch = { text: string; start: number; end: number };
    const chains: ChainMatch[] = [];
    let m: RegExpExecArray | null;

    while ((m = propChainRegex.exec(trimmed)) !== null) {
        chains.push({ text: m[1], start: m.index, end: m.index + m[1].length });
    }

    if (chains.length === 0) {
        const callMatch = trimmed.match(/([a-zA-Z_$][a-zA-Z0-9_$]*\.[a-zA-Z_$][a-zA-Z0-9_$]*\s*\()/);
        if (callMatch) return callMatch[1].replace(/\s*\($/, "");
        return undefined;
    }

    if (chains.length === 1) {
        return chains[0].text;
    }

    if (columnNumber !== undefined && columnNumber > 0) {
        const leadingWhitespace = statement.length - statement.trimStart().length;
        const adjustedCol = Math.max(0, columnNumber - 1 - leadingWhitespace);

        const containing = chains.find(
            (c) => adjustedCol >= c.start && adjustedCol <= c.end
        );
        if (containing) return containing.text;

        let closest = chains[0];
        let minDist = Math.abs(adjustedCol - chains[0].start);
        for (const c of chains) {
            const dist = Math.min(
                Math.abs(adjustedCol - c.start),
                Math.abs(adjustedCol - c.end)
            );
            if (dist < minDist) {
                minDist = dist;
                closest = c;
            }
        }
        return closest.text;
    }

    const rhsMatch = trimmed.match(/(?:return|=)\s+(.+)/);
    if (rhsMatch) {
        const rhs = rhsMatch[1].trim();
        const rhsChains: ChainMatch[] = [];
        while ((m = propChainRegex.exec(rhs)) !== null) {
            rhsChains.push({ text: m[1], start: m.index, end: m.index + m[1].length });
        }
        if (rhsChains.length > 0) return rhsChains[0].text;
    }

    return chains[0].text;
}

export function cleanFilePath(rawPath: string): string {
    if (!rawPath) return rawPath;
    return rawPath
        .replace(/^webpack:\/\/\//, "")
        .replace(/^webpack:\/\//, "")
        .replace(/^node:\/\//, "")
        .replace(/^\/{2,}/, "/")
        .replace(/^\/([A-Za-z]:)/, "$1");
}
