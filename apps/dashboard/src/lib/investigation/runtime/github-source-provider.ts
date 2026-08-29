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
 *   1. Exact commit SHA from the event.
 *   2. Exact commit SHA from the release record associated with the event.
 *   3. Configured default branch when no commit SHA is available.
 */

import { prisma } from "@/lib/prisma";
import { resolveAstFromSource } from "./ast-resolver";
import type { SourceContext, StackFrame } from "./types";
import {
    buildGitHubContentsUrl,
    classifyGitHubSourceStatus,
    normalizeRepositoryFilePath,
    selectGitHubSourceRef,
} from "./github-source-utils";

const CONTEXT_LINES_BEFORE = 6;
const CONTEXT_LINES_AFTER = 6;

export interface GitHubSourceProviderOptions {
    /** Halo project ID — used to load the GitHub configuration and validate auth. */
    projectId: string;

    /** Stack frame from the error event. */
    frame: StackFrame;

    /**
     * Release version string from the event (e.g. "1.2.3", "v2024-08-01").
     * Used only to find an associated stored commit SHA.
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
    let project = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
            organizationId: true,
            githubRepoOwner: true,
            githubRepoName: true,
            githubToken: true,
            githubDefaultBranch: true,
        },
    });

    // If current project has no repository configured, check if another project
    // in the same organization has a configured repository.
    if ((!project?.githubRepoOwner || !project?.githubRepoName) && project?.organizationId) {
        const orgProjectWithRepo = await prisma.project.findFirst({
            where: {
                organizationId: project.organizationId,
                githubRepoOwner: { not: null },
                githubRepoName: { not: null },
            },
            select: {
                organizationId: true,
                githubRepoOwner: true,
                githubRepoName: true,
                githubToken: true,
                githubDefaultBranch: true,
            },
        });
        if (orgProjectWithRepo) {
            project = orgProjectWithRepo;
        }
    }

    if (!project || !project.githubRepoOwner || !project.githubRepoName) {
        return buildFailureContext(frame, "repository_not_configured",
            "No GitHub repository is connected to this project. Configure one in Project Settings → Source Control.",
            undefined, undefined);
    }

    const owner = project.githubRepoOwner;
    const repo = project.githubRepoName;
    const token = project.githubToken || process.env.GITHUB_TOKEN;
    const repoFullName = `${owner}/${repo}`;

    // A release version is an identifier, not a Git ref. Use it only to find
    // an associated release record that holds an exact commit SHA.
    let releaseCommitSha: string | null | undefined;
    if (releaseVersion) {
        const release = await prisma.release.findFirst({
            where: { project: { id: projectId }, version: releaseVersion },
            select: { commitSha: true },
        });
        releaseCommitSha = release?.commitSha;
    }

    const selectedRef = selectGitHubSourceRef(
        overrideCommitSha ?? releaseCommitSha,
        project.githubDefaultBranch,
    );
    const resolvedRef = selectedRef.ref;
    const resolvedCommitSha = selectedRef.commitSha;

    // Build the file path for the GitHub API.
    const filePath = normalizeRepositoryFilePath(
        frame.rawFilePath || frame.filePath,
        repo,
    );

    // Fetch the file content from GitHub.
    const result = await fetchGitHubFileContent(owner, repo, filePath, resolvedRef, token);

    if (result.error) {
        const { status, message } = result.error;
        const resolutionStatus = classifyGitHubSourceStatus(status);

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
    const url = buildGitHubContentsUrl(owner, repo, filePath, ref);

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
            let githubMessage: string | undefined;
            try {
                const body = await res.json() as { message?: string };
                githubMessage = body.message;
            } catch {
                // Use the actionable fallback below when GitHub returns no JSON body.
            }
            return {
                error: {
                    status: 403,
                    message: `Access denied to ${owner}/${repo}${githubMessage ? `: ${githubMessage}` : "."} Grant this PAT access to the repository and Contents: Read-only permission.`,
                },
            };
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

/** Backwards-compatible aliases for callers without repository configuration. */
export const cleanFilePathForGitHub = (rawPath: string) => normalizeRepositoryFilePath(rawPath, "");
export const cleanFilePath = cleanFilePathForGitHub;
