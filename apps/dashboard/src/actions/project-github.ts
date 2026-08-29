"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getProject } from "@/actions/project";
import { revalidatePath } from "next/cache";

export interface SafeGitHubConfig {
    configured: boolean;
    owner?: string;
    repo?: string;
    defaultBranch?: string;
    hasCustomToken?: boolean;
    installationId?: string;
}

export interface GitHubConnectionTestResult {
    success: boolean;
    repositoryFullName?: string;
    defaultBranch?: string;
    isPrivate?: boolean;
    errorMessage?: string;
}

/**
 * Return GitHub accounts that can be used as a repository owner. The stored
 * owner is always included so a token that cannot list organizations does not
 * make an existing configuration impossible to edit.
 */
export async function getProjectGitHubOwners(projectId: string): Promise<string[]> {
    const session = await getSession();
    if (!session) {
        throw new Error("Unauthorized");
    }

    const project = await getProject(projectId);
    if (!project) {
        throw new Error("Project not found");
    }

    const githubConfig = await prisma.project.findUnique({
        where: { id: projectId },
        select: { githubRepoOwner: true, githubToken: true },
    });

    const owners = new Set<string>();
    if (githubConfig?.githubRepoOwner) {
        owners.add(githubConfig.githubRepoOwner);
    }

    const token = githubConfig?.githubToken || process.env.GITHUB_TOKEN;
    if (!token) {
        return [...owners];
    }

    const headers = {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "Halo-Investigation-Engine",
    };

    try {
        const [userResponse, organizationsResponse] = await Promise.all([
            fetch("https://api.github.com/user", { headers, next: { revalidate: 0 } }),
            fetch("https://api.github.com/user/orgs", { headers, next: { revalidate: 0 } }),
        ]);

        if (userResponse.ok) {
            const user = await userResponse.json() as { login?: string };
            if (user.login) owners.add(user.login);
        }

        if (organizationsResponse.ok) {
            const organizations = await organizationsResponse.json() as Array<{ login?: string }>;
            for (const organization of organizations) {
                if (organization.login) owners.add(organization.login);
            }
        }
    } catch {
        // Manual owner entry remains available when GitHub cannot be reached.
    }

    return [...owners].sort((a, b) => a.localeCompare(b));
}

/** Return the project's stored PAT to an authorized project member on demand. */
export async function revealProjectGitHubToken(projectId: string): Promise<string | null> {
    const session = await getSession();
    if (!session) {
        throw new Error("Unauthorized");
    }

    const project = await getProject(projectId);
    if (!project) {
        throw new Error("Project not found");
    }

    const githubConfig = await prisma.project.findUnique({
        where: { id: projectId },
        select: { githubToken: true },
    });

    return githubConfig?.githubToken ?? null;
}

/**
 * Retrieve the safe public GitHub configuration for a project.
 * Tokens are NEVER returned to the client.
 */
export async function getProjectGitHubConfig(
    projectId: string
): Promise<SafeGitHubConfig> {
    const session = await getSession();
    if (!session) {
        throw new Error("Unauthorized");
    }

    const project = await getProject(projectId);
    if (!project) {
        throw new Error("Project not found");
    }

    const p = await prisma.project.findUnique({
        where: { id: projectId },
        select: {
            githubRepoOwner: true,
            githubRepoName: true,
            githubToken: true,
            githubDefaultBranch: true,
            githubInstallationId: true,
        },
    });

    if (!p || !p.githubRepoOwner || !p.githubRepoName) {
        return { configured: false };
    }

    return {
        configured: true,
        owner: p.githubRepoOwner,
        repo: p.githubRepoName,
        defaultBranch: p.githubDefaultBranch ?? "main",
        hasCustomToken: Boolean(p.githubToken),
        installationId: p.githubInstallationId ?? undefined,
    };
}

/**
 * Update project GitHub repository configuration.
 * Server-side tokens are saved securely and never logged.
 */
export async function updateProjectGitHubConfig(
    projectId: string,
    config: {
        owner: string;
        repo: string;
        token?: string;
        defaultBranch?: string;
        installationId?: string;
    }
): Promise<{ success: boolean }> {
    const session = await getSession();
    if (!session) {
        throw new Error("Unauthorized");
    }

    const project = await getProject(projectId);
    if (!project) {
        throw new Error("Project not found");
    }

    const cleanOwner = config.owner.trim().replace(/^https?:\/\/github\.com\//, "").split("/")[0] || "";
    const cleanRepo = config.repo.trim().replace(/^https?:\/\/github\.com\//, "").split("/").pop() || "";
    const cleanBranch = config.defaultBranch?.trim() || "main";

    if (!cleanOwner || !cleanRepo) {
        throw new Error("Repository owner and repository name are required.");
    }

    const updateData: {
        githubRepoOwner: string;
        githubRepoName: string;
        githubDefaultBranch: string;
        githubInstallationId?: string | null;
        githubToken?: string;
    } = {
        githubRepoOwner: cleanOwner,
        githubRepoName: cleanRepo,
        githubDefaultBranch: cleanBranch,
        githubInstallationId: config.installationId ? config.installationId.trim() : null,
    };

    if (config.token !== undefined && config.token.trim().length > 0) {
        updateData.githubToken = config.token.trim();
    }

    await prisma.project.update({
        where: { id: projectId },
        data: updateData,
    });

    revalidatePath(`/projects/${projectId}/settings`);
    return { success: true };
}

/**
 * Disconnect GitHub repository from project.
 */
export async function disconnectProjectGitHub(
    projectId: string
): Promise<{ success: boolean }> {
    const session = await getSession();
    if (!session) {
        throw new Error("Unauthorized");
    }

    const project = await getProject(projectId);
    if (!project) {
        throw new Error("Project not found");
    }

    await prisma.project.update({
        where: { id: projectId },
        data: {
            githubRepoOwner: null,
            githubRepoName: null,
            githubToken: null,
            githubDefaultBranch: "main",
            githubInstallationId: null,
        },
    });

    revalidatePath(`/projects/${projectId}/settings`);
    return { success: true };
}

/**
 * Test connectivity and authorization with the connected GitHub repository.
 */
export async function testGitHubConnection(
    projectId: string
): Promise<GitHubConnectionTestResult> {
    const session = await getSession();
    if (!session) {
        throw new Error("Unauthorized");
    }

    const authorizedProject = await getProject(projectId);
    if (!authorizedProject) {
        throw new Error("Project not found");
    }

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
        return {
            success: false,
            errorMessage: "No GitHub repository configured for this project.",
        };
    }

    const token = project.githubToken || process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Halo-Investigation-Engine",
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    try {
        const url = `https://api.github.com/repos/${encodeURIComponent(project.githubRepoOwner)}/${encodeURIComponent(project.githubRepoName)}`;
        const res = await fetch(url, { headers, next: { revalidate: 0 } });

        if (res.status === 404) {
            return {
                success: false,
                errorMessage: `Repository \`${project.githubRepoOwner}/${project.githubRepoName}\` was not found on GitHub. Verify spelling or grant access to private repos.`,
            };
        }

        if (res.status === 401 || res.status === 403) {
            return {
                success: false,
                errorMessage: "GitHub API authentication failed. Check token permissions or rate limits.",
            };
        }

        if (!res.ok) {
            return {
                success: false,
                errorMessage: `GitHub returned status ${res.status}: ${res.statusText}`,
            };
        }

        const data = await res.json();

        // Repository metadata is visible with GitHub's implicit Metadata
        // permission. Probe Contents separately because source reconstruction
        // requires it and a metadata-only token must not be shown as verified.
        if (token) {
            const contentsUrl = `https://api.github.com/repos/${encodeURIComponent(project.githubRepoOwner)}/${encodeURIComponent(project.githubRepoName)}/contents?ref=${encodeURIComponent(data.default_branch || "main")}`;
            const contentsRes = await fetch(contentsUrl, { headers, next: { revalidate: 0 } });

            if (!contentsRes.ok) {
                let githubMessage: string | undefined;
                try {
                    const body = await contentsRes.json() as { message?: string };
                    githubMessage = body.message;
                } catch {
                    // The status below remains useful if GitHub sent no JSON body.
                }

                if (contentsRes.status === 401 || contentsRes.status === 403) {
                    return {
                        success: false,
                        repositoryFullName: data.full_name,
                        defaultBranch: data.default_branch,
                        isPrivate: data.private,
                        errorMessage: `GitHub denied Contents access for this token${githubMessage ? `: ${githubMessage}` : "."} Ensure this fine-grained PAT is granted to ${project.githubRepoOwner}/${project.githubRepoName}, has Repository permissions → Contents → Read-only, and is approved if the organization requires approval.`,
                    };
                }

                return {
                    success: false,
                    repositoryFullName: data.full_name,
                    defaultBranch: data.default_branch,
                    isPrivate: data.private,
                    errorMessage: `GitHub could not verify Contents access (status ${contentsRes.status}).`,
                };
            }
        }

        return {
            success: true,
            repositoryFullName: data.full_name,
            defaultBranch: data.default_branch,
            isPrivate: data.private,
        };
    } catch (err) {
        return {
            success: false,
            errorMessage: `Network error connecting to GitHub: ${err instanceof Error ? err.message : "Unknown error"}`,
        };
    }
}
