/** Utilities shared by GitHub source resolution and its regression tests. */

const COMMIT_SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

export function isGitCommitSha(value: unknown): value is string {
    return typeof value === "string" && COMMIT_SHA_PATTERN.test(value.trim());
}

/**
 * Finds a commit SHA from normalized event metadata without treating release
 * names, package versions, tags, or arbitrary strings as Git revisions.
 */
export function extractCommitSha(metadata: unknown): string | undefined {
    if (isGitCommitSha(metadata)) {
        return metadata.trim();
    }

    if (!isRecord(metadata)) {
        return undefined;
    }

    const directCandidates = [
        metadata.commitSha,
        metadata.commit_sha,
        metadata.gitSha,
        metadata.git_sha,
        metadata.commit,
        metadata.revision,
    ];

    for (const candidate of directCandidates) {
        if (isGitCommitSha(candidate)) {
            return candidate.trim();
        }
    }

    const git = metadata.git;
    if (isRecord(git)) {
        for (const candidate of [git.sha, git.commitSha, git.commit_sha, git.commit]) {
            if (isGitCommitSha(candidate)) {
                return candidate.trim();
            }
        }

        if (isRecord(git.commit) && isGitCommitSha(git.commit.sha)) {
            return git.commit.sha.trim();
        }
    }

    return undefined;
}

/**
 * Converts a stack-frame location to a repository-relative path. The configured
 * repository name identifies the checkout root; no user, host, or project path
 * is assumed.
 */
export function normalizeRepositoryFilePath(rawPath: string, repositoryName: string): string {
    const repositorySegment = repositoryName
        .trim()
        .replace(/\\/g, "/")
        .split("/")
        .filter(Boolean)
        .at(-1)
        ?.toLowerCase();

    const clean = rawPath.trim()
        .replace(/^file:\/\//i, "")
        .replace(/^webpack:\/\/?/i, "")
        .replace(/^https?:\/\/[^/]+\/?/i, "")
        .replace(/^node:\/\//i, "")
        .replace(/[?#].*$/, "")
        .replace(/\\/g, "/");

    const segments: string[] = [];
    for (const segment of clean.split("/")) {
        if (!segment || segment === ".") continue;
        if (segment === "..") {
            segments.pop();
            continue;
        }
        segments.push(segment);
    }

    if (repositorySegment) {
        const checkoutRootIndex = segments.findIndex(
            (segment) => segment.toLowerCase() === repositorySegment,
        );
        if (checkoutRootIndex >= 0 && checkoutRootIndex < segments.length - 1) {
            return segments.slice(checkoutRootIndex + 1).join("/");
        }
    }

    // A repository name is not always present in browser bundle paths. Keep
    // common source roots while still returning a relative, GitHub-safe path.
    const sourceRootIndex = segments.findIndex((segment) =>
        ["apps", "packages", "src", "lib", "app"].includes(segment.toLowerCase()),
    );
    return (sourceRootIndex >= 0 ? segments.slice(sourceRootIndex) : segments).join("/");
}

/** Select only an exact commit SHA; otherwise use the configured branch. */
export function selectGitHubSourceRef(
    commitSha: string | null | undefined,
    defaultBranch: string | null | undefined,
): { ref: string; commitSha?: string } {
    if (isGitCommitSha(commitSha)) {
        const verifiedCommitSha = commitSha.trim();
        return { ref: verifiedCommitSha, commitSha: verifiedCommitSha };
    }

    return { ref: defaultBranch?.trim() || "main" };
}

export function buildGitHubContentsUrl(owner: string, repository: string, filePath: string, ref: string): string {
    const encodedPath = filePath.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");
    return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`;
}

export function classifyGitHubSourceStatus(status: number):
    | "file_not_found"
    | "source_access_denied"
    | "rate_limit"
    | "github_api_error" {
    if (status === 404) return "file_not_found";
    if (status === 401 || status === 403) return "source_access_denied";
    if (status === 429) return "rate_limit";
    return "github_api_error";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
