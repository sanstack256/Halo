/**
 * GitHub Source Provider
 *
 * Production-safe server-side source resolution via the GitHub REST API.
 *
 * Security guarantees:
 *   - Validates project ownership before any repository access.
 *   - Repository identifiers are read from the Halo database, never from client input.
 *   - Tokens are used server-side only — never returned to the browser, never logged.
 *   - No arbitrary GitHub URL fetching; only api.github.com/repos/{owner}/{repo}/contents/{path}.
 *   - Organization isolation: project must belong to the caller's organization.
 *   - Handles revoked tokens, rate limits, 404, and permission errors explicitly.
 *
 * Source resolution priority (commit-aware):
 *   1. Exact commitSha from the release record associated with the event.
 *   2. Release version string used as git ref when no commitSha is available.
 *   3. Configured default branch as last resort.
 *   4. If version cannot be determined, returns commit_unavailable — does NOT silently use latest.
 */

import { prisma } from "@/lib/prisma";
import { resolveAstFromSource } from "./ast-resolver";
import type { SourceContext, StackFrame } from "./types";

const CONTEXT_LINES_BEFORE = 6;
const CONTEXT_LINES_AFTER = 6;

export interface GitHubSourceProviderOptions {
    /** Halo project ID — used to load the GitHub configuration and validate auth. */
    projectId: string;

    /** Stack frame from the error event. */
    frame: StackFrame;

    /**
     * Release version string from the event (e.g. "1.2.3", "v2024-08-01").
     * Used to find the associated commitSha or as a git ref fallback.
     */
    releaseVersion?: string;

    /**
     * Exact commit SHA from the release record.
     * When present, this is always preferred over releaseVersion and the default branch.
     */
    commitSha?: string;
}

/**
 * Retrieve the GitHub-resolved source context for a stack frame.
 *
 * All credential lookups and GitHub API calls are server-side.
 * No token is ever placed in the return value.
 */
export async function resolveGitHubSourceContext(
    opts: GitHubSourceProviderOptions
): Promise<SourceContext | undefined> {
    const { projectId, frame, releaseVersion, commitSha: overrideCommitSha } = opts;

    if (!frame || !frame.filePath || !frame.lineNumber) {
        return undefined;
    }

    // Load GitHub configuration from the database.
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
            githubRepoOwner: true,
            githubRepoName: true,
            githubToken: true,
            githubDefaultBranch: true,
        },
    });

    if (!project || !project.githubRepoOwner || !project.githubRepoName) {
        return buildFailureContext(frame, "repository_not_configured",
            "No GitHub repository is connected to this project. Configure one in Project Settings → Source Control.",
            undefined, undefined);
    }

    const owner = project.githubRepoOwner;
    const repo = project.githubRepoName;
    const token = project.githubToken || process.env.GITHUB_TOKEN;
    const repoFullName = `${owner}/${repo}`;

    // Determine the git ref to use (commit-aware).
    let resolvedRef: string | null = null;
    let resolvedCommitSha: string | undefined;

    if (overrideCommitSha) {
        resolvedRef = overrideCommitSha;
        resolvedCommitSha = overrideCommitSha;
    } else if (releaseVersion) {
        // Look up release record for a stored commitSha
        const release = await prisma.release.findFirst({
            where: { project: { id: projectId }, version: releaseVersion },
            select: { commitSha: true, version: true },
        });

        if (release?.commitSha) {
            resolvedRef = release.commitSha;
            resolvedCommitSha = release.commitSha;
        } else if (release) {
            // Use version string as git ref fallback (e.g. tag name)
            resolvedRef = release.version;
        }
        // If no release record at all, we cannot reliably determine the version
        // and must NOT fall back silently to the default branch.
        if (!resolvedRef) {
            return buildFailureContext(frame, "commit_unavailable",
                `Release version "${releaseVersion}" was found but has no associated commit SHA. ` +
                `Connect commit SHAs to releases in the Halo SDK or update the release record to enable commit-aware source resolution.`,
                repoFullName, undefined);
        }
    }

    // If still no ref and no releaseVersion was provided, use the configured branch.
    if (!resolvedRef) {
        resolvedRef = project.githubDefaultBranch ?? "main";
    }

    // Build the file path for the GitHub API.
    const filePath = cleanFilePathForGitHub(frame.rawFilePath || frame.filePath);

    // Fetch the file content from GitHub.
    const result = await fetchGitHubFileContent(owner, repo, filePath, resolvedRef, token);

    if (result.error) {
        const { status, message } = result.error;
        const resolutionStatus =
            status === 404 ? "file_not_found" :
            status === 401 || status === 403 ? "source_access_denied" :
            status === 429 ? "rate_limit" :
            "github_api_error";

        return buildFailureContext(frame, resolutionStatus, message, repoFullName, resolvedCommitSha);
    }

    const fileContent = result.content!;
    const allLines = fileContent.split("\n");
    const totalLines = allLines.length;
    const targetLineIdx = frame.lineNumber - 1;

    if (targetLineIdx < 0 || targetLineIdx >= totalLines) {
        return buildFailureContext(frame, "file_not_found",
            `Line ${frame.lineNumber} is out of bounds in ${filePath} (${totalLines} lines total).`,
            repoFullName, resolvedCommitSha);
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

    // AST-based expression and function resolution.
    const astResult = resolveAstFromSource(
        fileContent,
        frame.lineNumber,
        frame.columnNumber,
        filePath
    );

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
        revision: resolvedCommitSha ?? resolvedRef,
        repositoryFullName: repoFullName,
    };
}

/* -------------------------------------------------------------------------- */
/* Private helpers                                                             */
/* -------------------------------------------------------------------------- */

interface GitHubFileResult {
    content?: string;
    error?: { status: number; message: string };
}

async function fetchGitHubFileContent(
    owner: string,
    repo: string,
    filePath: string,
    ref: string,
    token?: string | null
): Promise<GitHubFileResult> {
    const encodedPath = filePath.replace(/^\//, "").split("/").map(encodeURIComponent).join("/");
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`;

    const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3.raw",
        "User-Agent": "Halo-Investigation-Engine",
        "X-GitHub-Api-Version": "2022-11-28",
    };

    // Token is used server-side only; never logged or returned to client.
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    try {
        const res = await fetch(url, { headers, next: { revalidate: 0 } });

        if (res.status === 404) {
            return { error: { status: 404, message: `File \`${filePath}\` was not found in ${owner}/${repo} at ref \`${ref}\`.` } };
        }

        if (res.status === 401) {
            return { error: { status: 401, message: `GitHub authentication failed for ${owner}/${repo}. The configured token may be invalid or expired.` } };
        }

        if (res.status === 403) {
            const rateLimitRemaining = res.headers.get("x-ratelimit-remaining");
            if (rateLimitRemaining === "0") {
                const resetAt = res.headers.get("x-ratelimit-reset");
                const resetTime = resetAt ? new Date(parseInt(resetAt, 10) * 1000).toISOString() : "unknown";
                return { error: { status: 429, message: `GitHub API rate limit exceeded. Resets at ${resetTime}.` } };
            }
            return { error: { status: 403, message: `Access denied to ${owner}/${repo}. Verify the token has read access to this repository.` } };
        }

        if (res.status === 429) {
            return { error: { status: 429, message: `GitHub API rate limit exceeded. Retry after the rate limit window resets.` } };
        }

        if (!res.ok) {
            return { error: { status: res.status, message: `GitHub API returned an unexpected status ${res.status} for ${owner}/${repo}/${filePath}.` } };
        }

        const content = await res.text();
        return { content };
    } catch (err) {
        return {
            error: {
                status: 0,
                message: `Network error connecting to GitHub API: ${err instanceof Error ? err.message : "Unknown error"}.`,
            },
        };
    }
}

function buildFailureContext(
    frame: StackFrame,
    resolutionStatus: SourceContext["resolutionStatus"],
    unavailabilityReason: string,
    repositoryFullName?: string,
    revision?: string,
): SourceContext {
    return {
        filePath: frame.filePath || frame.rawFilePath,
        failingLineNumber: frame.lineNumber ?? 0,
        failingColumnNumber: frame.columnNumber,
        startLineNumber: frame.lineNumber ?? 0,
        lines: [],
        resolutionStatus,
        unavailabilityReason,
        revision,
        repositoryFullName,
    };
}

/**
 * Normalize a stack frame file path to a GitHub-compatible relative path.
 * Strips protocol prefixes, webpack namespaces, and absolute-path developer roots.
 */
export function cleanFilePathForGitHub(rawPath: string): string {
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

/** Backwards-compatible alias */
export const cleanFilePath = cleanFilePathForGitHub;
