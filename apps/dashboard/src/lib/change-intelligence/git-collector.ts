/**
 * Git Evidence Collector for Halo Trace Pillar F.
 *
 * Collects real Git commit and change evidence from:
 * 1. The canonical ChangeObservation database store (materialized/ingested changes)
 * 2. Connected GitHub repository API (when credentials and repo are configured on Project)
 *
 * STRICT INVARIANTS:
 * - NO FAKE COMMITS. Commits must be backed by real Git repository evidence or persisted ChangeObservation.
 * - IDEMPOTENT INGESTION. Ingesting the same commit multiple times yields a single canonical record.
 * - TENANT & PROJECT CACHE ISOLATION. Cache keys are strictly scoped by organizationId and projectId.
 * - SECRET ISOLATION. GitHub tokens and API keys are NEVER returned in candidate structures or UI responses.
 */

import { prisma } from "@/lib/prisma";
import {
    type ChangeSourceType,
    type IngestChangeObservationInput,
} from "./types";
import { normalizePath, sanitizeRepositoryPath } from "./path-utils";

interface TenantCacheEntry<T> {
    data: T;
    expiresAt: number;
}

const gitCache = new Map<string, TenantCacheEntry<any>>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

function buildCacheKey(organizationId: string, projectId: string, subKey: string): string {
    return `${organizationId}::${projectId}::${subKey}`;
}

export function clearGitCollectorCache(organizationId?: string): void {
    if (!organizationId) {
        gitCache.clear();
        return;
    }
    for (const key of gitCache.keys()) {
        if (key.startsWith(`${organizationId}::`)) {
            gitCache.delete(key);
        }
    }
}

/**
 * Ingests a change observation into the canonical database store idempotently.
 */
export async function ingestChangeObservation(input: IngestChangeObservationInput) {
    const {
        organizationId,
        projectId,
        sourceType,
        repository,
        commitSha,
        parentCommitSha,
        commitMessage,
        authorIdentity,
        authorTimestamp,
        sourceVersion,
        deploymentReference,
        pullRequestReference,
        changedFiles,
        additions,
        deletions,
        branch,
        ref,
        serviceAssociation,
        codePathAssociation,
        evidenceReferences = [],
        observedAt = new Date(),
        metadata,
    } = input;

    // Build deterministic deduplication key for idempotency
    const repoPart = repository ? repository.trim().toLowerCase() : "default";
    let changeKey: string;
    if (commitSha) {
        changeKey = `${sourceType}:${repoPart}:${commitSha.trim().toLowerCase()}`;
    } else if (deploymentReference) {
        changeKey = `${sourceType}:${deploymentReference.trim()}:${sourceVersion || "v1"}`;
    } else if (pullRequestReference) {
        changeKey = `${sourceType}:${repoPart}:pr-${pullRequestReference.trim()}`;
    } else {
        const timestampStr = authorTimestamp ? new Date(authorTimestamp).toISOString() : new Date(observedAt).toISOString();
        changeKey = `${sourceType}:${serviceAssociation || "general"}:${sourceVersion || "v1"}:${timestampStr}`;
    }

    // Format changedFiles safely
    const formattedFiles = Array.isArray(changedFiles)
        ? changedFiles.map((f) => {
              if (typeof f === "string") {
                  return { filePath: sanitizeRepositoryPath(f) || f };
              }
              return {
                  ...f,
                  filePath: sanitizeRepositoryPath(f.filePath) || f.filePath,
              };
          })
        : null;

    const parsedAuthorDate = authorTimestamp ? new Date(authorTimestamp) : null;
    const parsedObservedDate = new Date(observedAt);

    return prisma.changeObservation.upsert({
        where: {
            projectId_changeKey: {
                projectId,
                changeKey,
            },
        },
        create: {
            organizationId,
            projectId,
            changeKey,
            sourceType,
            repository: repository ? repository.trim() : null,
            commitSha: commitSha ? commitSha.trim() : null,
            parentCommitSha: parentCommitSha ? parentCommitSha.trim() : null,
            commitMessage: commitMessage ? commitMessage.trim() : null,
            authorIdentity: authorIdentity ? authorIdentity.trim() : null, // Historical metadata only
            authorTimestamp: parsedAuthorDate,
            sourceVersion: sourceVersion || null,
            deploymentReference: deploymentReference || null,
            pullRequestReference: pullRequestReference || null,
            changedFiles: formattedFiles ? (formattedFiles as any) : undefined,
            additions: additions ?? null,
            deletions: deletions ?? null,
            branch: branch || null,
            ref: ref || null,
            serviceAssociation: serviceAssociation || null,
            codePathAssociation: codePathAssociation || null,
            evidenceReferences,
            observedAt: parsedObservedDate,
            metadata: metadata ? (metadata as any) : undefined,
        },
        update: {
            commitMessage: commitMessage ? commitMessage.trim() : undefined,
            deploymentReference: deploymentReference || undefined,
            pullRequestReference: pullRequestReference || undefined,
            changedFiles: formattedFiles ? (formattedFiles as any) : undefined,
            additions: additions ?? undefined,
            deletions: deletions ?? undefined,
            evidenceReferences: evidenceReferences.length > 0 ? evidenceReferences : undefined,
            metadata: metadata ? (metadata as any) : undefined,
        },
    });
}

export interface CollectedGitData {
    hasGitConfig: boolean;
    repositoryFullName?: string;
    commits: Array<{
        sha: string;
        message: string;
        authorName: string;
        date: Date;
        parentSha?: string;
        files: Array<{
            filePath: string;
            status?: string;
            additions?: number;
            deletions?: number;
            patch?: string;
        }>;
    }>;
    errorReason?: string;
}

/**
 * Fetches real Git commit history from the connected repository if configured.
 * Strictly scopes cache by organizationId and projectId.
 * Never leaks token or credentials.
 */
export async function collectGitHistory(params: {
    organizationId: string;
    projectId: string;
    windowStart?: Date;
    windowEnd?: Date;
}): Promise<CollectedGitData> {
    const { organizationId, projectId, windowStart, windowEnd } = params;

    const cacheKey = buildCacheKey(
        organizationId,
        projectId,
        `git-commits-${windowStart?.getTime() || 0}-${windowEnd?.getTime() || 0}`
    );

    const cached = gitCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }

    const project = await prisma.project.findFirst({
        where: { id: projectId, organizationId },
        select: {
            id: true,
            githubRepoOwner: true,
            githubRepoName: true,
            githubToken: true,
            githubDefaultBranch: true,
        },
    });

    if (!project) {
        return {
            hasGitConfig: false,
            commits: [],
            errorReason: "Project not found or tenant boundary mismatch.",
        };
    }

    if (!project.githubRepoOwner || !project.githubRepoName) {
        return {
            hasGitConfig: false,
            commits: [],
            errorReason: "Repository change history unavailable. Configure repository access to inspect change evidence.",
        };
    }

    const repositoryFullName = `${project.githubRepoOwner}/${project.githubRepoName}`;
    const token = project.githubToken || process.env.GITHUB_TOKEN;

    if (!token) {
        return {
            hasGitConfig: false,
            repositoryFullName,
            commits: [],
            errorReason: "Git repository configured but access token is unavailable.",
        };
    }

    try {
        const commitsUrl = `https://api.github.com/repos/${project.githubRepoOwner}/${project.githubRepoName}/commits?per_page=15`;
        const res = await fetch(commitsUrl, {
            headers: {
                Accept: "application/vnd.github.v3+json",
                Authorization: `Bearer ${token}`,
                "User-Agent": "Halo-Trace-Change-Intelligence",
            },
            next: { revalidate: 30 },
        });

        if (!res.ok) {
            const result: CollectedGitData = {
                hasGitConfig: true,
                repositoryFullName,
                commits: [],
                errorReason: `GitHub API error: HTTP ${res.status}`,
            };
            gitCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
            return result;
        }

        const commitList = (await res.json()) as any[];
        const commits: CollectedGitData["commits"] = [];

        if (Array.isArray(commitList)) {
            for (const item of commitList) {
                const sha = item.sha;
                const message = item.commit?.message || "No commit message";
                const authorName = item.commit?.author?.name || item.author?.login || "Unknown Author";
                const commitDate = new Date(item.commit?.author?.date || item.commit?.committer?.date || Date.now());
                const parentSha = item.parents?.[0]?.sha;

                // Check window bounds if provided
                if (windowEnd && commitDate.getTime() > windowEnd.getTime() + 1000 * 60 * 60) {
                    continue; // Skip commits way outside investigation window
                }

                // Fetch details for files & patches
                let files: Array<{ filePath: string; status?: string; additions?: number; deletions?: number; patch?: string }> = [];
                try {
                    const detailUrl = `https://api.github.com/repos/${project.githubRepoOwner}/${project.githubRepoName}/commits/${sha}`;
                    const detailRes = await fetch(detailUrl, {
                        headers: {
                            Accept: "application/vnd.github.v3+json",
                            Authorization: `Bearer ${token}`,
                            "User-Agent": "Halo-Trace-Change-Intelligence",
                        },
                        next: { revalidate: 60 },
                    });

                    if (detailRes.ok) {
                        const detailJson = (await detailRes.json()) as any;
                        if (Array.isArray(detailJson.files)) {
                            files = detailJson.files.map((f: any) => ({
                                filePath: f.filename,
                                status: f.status,
                                additions: f.additions,
                                deletions: f.deletions,
                                patch: f.patch,
                            }));
                        }
                    }
                } catch {
                    // detail fetch failed, proceed with file-level unknown
                }

                commits.push({
                    sha,
                    message,
                    authorName,
                    date: commitDate,
                    parentSha,
                    files,
                });
            }
        }

        const result: CollectedGitData = {
            hasGitConfig: true,
            repositoryFullName,
            commits,
        };

        gitCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
        return result;
    } catch (err) {
        return {
            hasGitConfig: true,
            repositoryFullName,
            commits: [],
            errorReason: `Git provider connection error: ${(err as Error).message}`,
        };
    }
}
