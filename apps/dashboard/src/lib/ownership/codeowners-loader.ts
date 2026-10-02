/**
 * CODEOWNERS Loader with Local & GitHub Source Integration
 *
 * Checks canonical locations (.github/CODEOWNERS, CODEOWNERS, docs/CODEOWNERS)
 * from local filesystem or configured GitHub repository.
 * Scoped strictly to project and organization boundaries.
 */

import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import {
    parseCodeownersContent,
    CODEOWNERS_CANDIDATE_PATHS,
    type ParsedCodeowners,
} from "./codeowners-parser";
import { buildGitHubContentsUrl } from "../investigation/runtime/github-source-utils";

// Memory cache for parsed CODEOWNERS scoped strictly by org:project:ref
const codeownersCache = new Map<string, { data: ParsedCodeowners; cachedAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute TTL

/**
 * Builds isolated cache key preventing cross-tenant leakage.
 */
function buildCacheKey(organizationId: string, projectId: string, ref: string): string {
    return `${organizationId}::${projectId}::${ref}`;
}

export function clearCodeownersCache(): void {
    codeownersCache.clear();
}

/**
 * Attempts to load and parse CODEOWNERS for a given project.
 */
export async function loadProjectCodeowners(
    projectId: string,
    organizationId: string,
    commitShaOrRef?: string
): Promise<ParsedCodeowners | null> {
    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            organizationId, // Enforce tenant boundary
        },
        select: {
            id: true,
            organizationId: true,
            githubRepoOwner: true,
            githubRepoName: true,
            githubToken: true,
            githubDefaultBranch: true,
        },
    });

    if (!project) {
        return null;
    }

    const ref = commitShaOrRef || project.githubDefaultBranch || "main";
    const cacheKey = buildCacheKey(organizationId, projectId, ref);

    const cached = codeownersCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return cached.data;
    }

    // 1. Try local filesystem candidates (useful for local dev, test runs, test suites)
    for (const relPath of CODEOWNERS_CANDIDATE_PATHS) {
        const localPath = path.resolve(process.cwd(), relPath);
        if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
            try {
                const content = fs.readFileSync(localPath, "utf-8");
                const parsed = parseCodeownersContent(content, {
                    sourceLocation: relPath,
                    commitSha: commitShaOrRef || "local",
                });
                codeownersCache.set(cacheKey, { data: parsed, cachedAt: Date.now() });
                return parsed;
            } catch {
                // fall through
            }
        }
    }

    // 2. Try GitHub REST API if repository is configured
    if (project.githubRepoOwner && project.githubRepoName) {
        const owner = project.githubRepoOwner;
        const repo = project.githubRepoName;
        const token = project.githubToken || process.env.GITHUB_TOKEN;

        for (const relPath of CODEOWNERS_CANDIDATE_PATHS) {
            try {
                const url = buildGitHubContentsUrl(owner, repo, relPath, ref);
                const headers: Record<string, string> = {
                    Accept: "application/vnd.github.v3.raw",
                    "User-Agent": "Halo-Ownership-Engine",
                    "X-GitHub-Api-Version": "2022-11-28",
                };
                if (token) {
                    headers.Authorization = `Bearer ${token}`;
                }

                const res = await fetch(url, { headers, ...({ next: { revalidate: 0 } } as any) });
                if (res.ok) {
                    const content = await res.text();
                    const parsed = parseCodeownersContent(content, {
                        sourceLocation: `${owner}/${repo}/${relPath}`,
                        commitSha: ref,
                    });
                    codeownersCache.set(cacheKey, { data: parsed, cachedAt: Date.now() });
                    return parsed;
                }
            } catch {
                // Next candidate path
            }
        }
    }

    return null;
}
