import { getOverviewData } from "@/actions/overview";
import { getProject } from "@/actions/project";
import { getProjectGitHubConfig } from "@/actions/project-github";
import { ProjectSettingsForm } from "./project-settings-form";
import { GitHubSettingsCard } from "@/app/(dashboard)/projects/[id]/settings/github-settings-card";

export default async function ProjectSettingsPage() {
    const overview = await getOverviewData();
    const activeProject = overview.projects[0];

    if (!activeProject) {
        return (
            <div className="halo-empty-state">
                <h2 className="halo-empty-state-title">No projects available</h2>
                <p className="halo-empty-state-description">Create a project first to manage project settings.</p>
            </div>
        );
    }

    const projectData = await getProject(activeProject.id);

    if (!projectData) return null;

    const githubConfig = await getProjectGitHubConfig(activeProject.id);

    return (
        <div className="space-y-8 pb-16 max-w-5xl">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Project Settings</h1>
                <p className="halo-page-description">
                    Configure project identifiers, spike protection, auto-resolve rules, and source control for <span className="font-semibold text-white">{projectData.name}</span>.
                </p>
            </div>

            <ProjectSettingsForm
                project={{
                    id: projectData.id,
                    name: projectData.name,
                    slug: projectData.slug,
                    description: projectData.description,
                }}
            />

            <GitHubSettingsCard projectId={projectData.id} initialConfig={githubConfig} />
        </div>
    );
}

