/**
 * Source Code Resolver
 *
 * Routes source resolution requests to the appropriate provider.
 * In production, uses the GitHub Source Provider (no local filesystem access).
 * In test environments, accepts a mock provider for offline testing.
 *
 * Local filesystem access (fs.readFileSync, process.cwd(), /Users/...) is
 * INTENTIONALLY REMOVED. Halo is a multi-tenant SaaS; running on a server,
 * developer machine paths are inaccessible and must never be attempted.
 *
 * Source resolution priority:
 *   1. Exact commitSha (from event release record)
 *   2. Release version string as git ref
 *   3. Configured default branch — only when no version requirement exists
 *   4. If version cannot be determined: commit_unavailable (never silent fallback)
 */

import type { StackFrame, SourceContext } from "./types";
import { resolveAstFromSource } from "./ast-resolver";

const CONTEXT_LINES_BEFORE = 6;
const CONTEXT_LINES_AFTER = 6;

/* -------------------------------------------------------------------------- */
/* Public contract                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Options passed to the active source provider.
 */
export interface SourceResolutionOptions {
    projectId?: string;
    releaseVersion?: string;
    commitSha?: string;
}

/**
 * A pluggable source provider interface.
 *
 * Production uses GitHubSourceProvider.
 * Tests can supply a MockSourceProvider.
 */
export interface ISourceProvider {
    resolveFile(
        filePath: string,
        opts: SourceResolutionOptions
    ): Promise<{ content: string; revision?: string; repositoryFullName?: string } | SourceProviderError>;
}

export interface SourceProviderError {
    status: "file_not_found" | "repository_not_configured" | "commit_unavailable" |
            "source_access_denied" | "rate_limit" | "github_api_error" | "source_revision_unavailable";
    message: string;
    revision?: string;
    repositoryFullName?: string;
}

export function isSourceProviderError(r: unknown): r is SourceProviderError {
    return typeof r === "object" && r !== null && "status" in r && "message" in r;
}

/* -------------------------------------------------------------------------- */
/* Resolve source context (async — used in server actions / API routes)       */
/* -------------------------------------------------------------------------- */

/**
 * Resolves source context from a stack frame using the configured provider.
 *
 * This function is async because the GitHub provider makes network calls.
 * Call this from server components or API route handlers only.
 */
export async function resolveSourceContextAsync(
    frame: StackFrame | undefined,
    provider: ISourceProvider,
    opts: SourceResolutionOptions = {}
): Promise<SourceContext | undefined> {
    if (!frame || !frame.filePath || !frame.lineNumber) {
        return undefined;
    }

    const filePath = frame.filePath || frame.rawFilePath;
    const result = await provider.resolveFile(filePath, opts);

    if (isSourceProviderError(result)) {
        return {
            filePath,
            failingLineNumber: frame.lineNumber,
            failingColumnNumber: frame.columnNumber,
            startLineNumber: frame.lineNumber,
            lines: [],
            resolutionStatus: result.status as SourceContext["resolutionStatus"],
            unavailabilityReason: result.message,
            revision: result.revision,
            repositoryFullName: result.repositoryFullName,
        };
    }

    const { content: fileContent, revision, repositoryFullName } = result;
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

/* -------------------------------------------------------------------------- */
/* Synchronous offline fallback (test environment / engine package only)      */
/* -------------------------------------------------------------------------- */

/**
 * Resolve source context from in-memory source text.
 * Used exclusively in unit tests and the investigation-engine package tests.
 *
 * Does NOT touch the filesystem.
 */
export function resolveSourceContext(
    frame: StackFrame | undefined,
    _projectRoot?: string,
    releaseRevision?: string
): SourceContext | undefined {
    if (!frame || !frame.filePath || !frame.lineNumber) {
        return undefined;
    }

    // Without in-memory source content, we cannot resolve anything.
    // Return an explicit unavailability state rather than attempting local disk reads.
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

export { cleanFilePath } from "./github-source-provider";
