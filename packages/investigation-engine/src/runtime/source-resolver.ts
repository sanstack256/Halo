import type { StackFrame, SourceContext } from "./types";
import { resolveAstFromSource } from "./ast-resolver";

const CONTEXT_LINES_BEFORE = 6;
const CONTEXT_LINES_AFTER = 6;

/**
 * In-memory source context resolver.
 * Used in tests or when source content is supplied directly.
 * Does NOT access the local filesystem.
 */
export function resolveSourceContextFromContent(
    frame: StackFrame | undefined,
    fileContent: string,
    revision?: string,
    repositoryFullName?: string
): SourceContext | undefined {
    if (!frame || !frame.filePath || !frame.lineNumber) {
        return undefined;
    }

    const filePath = frame.filePath || frame.rawFilePath || "";
    const allLines = fileContent.split("\n");
    const totalLines = allLines.length;
    const targetLineIdx = frame.lineNumber - 1;

    if (targetLineIdx < 0 || targetLineIdx >= totalLines) {
        return {
            filePath,
            failingLineNumber: frame.lineNumber,
            failingColumnNumber: frame.columnNumber,
            startLineNumber: frame.lineNumber,
            lines: [],
            resolutionStatus: "file_not_found",
            unavailabilityReason: `Line ${frame.lineNumber} is out of bounds for ${filePath} (${totalLines} lines).`,
            revision,
            repositoryFullName,
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

    const astResult = resolveAstFromSource(fileContent, frame.lineNumber, frame.columnNumber, filePath);

    const failingStatement = astResult.failingStatement || allLines[targetLineIdx].trim();
    const containingFunction = astResult.containingFunction ||
        (frame.functionName && frame.functionName !== "<anonymous>" ? frame.functionName : undefined);
    const failingExpression = astResult.failingExpression;

    return {
        filePath,
        failingLineNumber: frame.lineNumber,
        failingColumnNumber: frame.columnNumber,
        startLineNumber: startIdx + 1,
        lines,
        containingFunction: containingFunction !== "<anonymous>" ? containingFunction : undefined,
        failingStatement,
        failingExpression,
        resolutionStatus: "exact_file",
        revision,
        repositoryFullName,
    };
}

/**
 * Standard offline source resolver fallback.
 */
export function resolveSourceContext(
    frame: StackFrame | undefined,
    _projectRoot?: string,
    releaseRevision?: string
): SourceContext | undefined {
    if (!frame || !frame.filePath || !frame.lineNumber) {
        return undefined;
    }

    const filePath = frame.filePath || frame.rawFilePath || "";
    return {
        filePath,
        failingLineNumber: frame.lineNumber,
        failingColumnNumber: frame.columnNumber,
        startLineNumber: frame.lineNumber,
        lines: [],
        resolutionStatus: "repository_not_configured",
        unavailabilityReason:
            `Source code is not available in this context. ` +
            `Connect a GitHub repository in Project Settings to enable source resolution for investigations. ` +
            `The source file referenced in the stack trace is: \`${filePath}\`.`,
        revision: releaseRevision,
    };
}

export function cleanFilePath(rawPath: string): string {
    if (!rawPath) return rawPath;
    let clean = rawPath
        .replace(/^webpack:\/\/\/?/, "")
        .replace(/^node:\/\//, "")
        .replace(/^\/{2,}/, "/")
        .replace(/^\/([A-Za-z]:)/, "$1")
        .replace(/\\/g, "/");

    const devMatch = clean.match(/^(?:\/Users|\/home|C:)\/[^/]+(?:\/[^/]+)*?\/(apps\/.*|packages\/.*|src\/.*|lib\/.*|app\/.*)/i);
    if (devMatch) {
        return devMatch[1];
    }

    clean = clean.replace(/^(?:\/Users|\/home|C:)\/[^/]+(?:\/[^/]+)*?\//i, "").replace(/^\/+/, "");
    return clean;
}
