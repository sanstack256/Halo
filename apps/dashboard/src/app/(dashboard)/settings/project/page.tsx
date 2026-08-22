import { getOverviewData } from "@/actions/overview";
import { getProject } from "@/actions/project";
import { ProjectSettingsForm } from "./project-settings-form";

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

    return (
        <div className="space-y-8 pb-16">
            <div className="halo-page-header">
                <h1 className="halo-page-title">Project Settings</h1>
                <p className="halo-page-description">
                    Configure project identifiers, spike protection, auto-resolve rules, and security options for <span className="font-semibold text-white">{projectData.name}</span>.
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
        </div>
    );
}
