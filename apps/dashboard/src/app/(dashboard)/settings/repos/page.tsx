import { getSession } from "@/lib/session";
import { getOverviewData } from "@/actions/overview";
import { getProjectGitHubConfig } from "@/actions/project-github";
import { GitHubSettingsCard } from "@/app/(dashboard)/projects/[id]/settings/github-settings-card";
import { GitBranch } from "lucide-react";

export default async function Page() {
    const session = await getSession();
    if (!session) return null;

    const overview = await getOverviewData();
    const activeProject = overview.projects[0];

    if (!activeProject) {
        return (
            <div className="space-y-8 pb-16">
                <div className="halo-page-header">
                    <h1 className="halo-page-title">Repositories (GitHub)</h1>
                    <p className="halo-page-description">Link source code repositories for commit correlation and code-level insights.</p>
                </div>
                <div className="halo-empty-state">
                    <h2 className="halo-empty-state-title">No projects available</h2>
                    <p className="halo-empty-state-description">Create a project first to link a GitHub repository.</p>
                </div>
            </div>
        );
    }

    const githubConfig = await getProjectGitHubConfig(activeProject.id);

    return (
        <div className="space-y-8 pb-16 max-w-5xl">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Source Control &amp; Repositories</h1>
                <p className="halo-page-description">
                    Connect GitHub repositories for <span className="font-semibold text-white">{activeProject.name}</span> to enable commit correlation, AST line inspection, and exact source reconstruction.
                </p>
            </div>

            <GitHubSettingsCard projectId={activeProject.id} initialConfig={githubConfig} />
        </div>
    );
}

