import { getProject } from "@/actions/project";
import { getProjectGitHubConfig } from "@/actions/project-github";
import { GitHubSettingsCard } from "./github-settings-card";
import { notFound } from "next/navigation";
import { FolderGit2, Settings } from "lucide-react";

interface ProjectSettingsPageProps {
    params: Promise<{ id: string }>;
}

export default async function ProjectSettingsPage({ params }: ProjectSettingsPageProps) {
    const { id } = await params;
    const project = await getProject(id);

    if (!project) {
        notFound();
    }

    const githubConfig = await getProjectGitHubConfig(id);

    return (
        <div className="space-y-8 pb-16 max-w-5xl">
            <div className="halo-page-header">
                <div className="flex items-center gap-2 text-xs font-mono text-secondary mb-1">
                    <span>Projects</span>
                    <span>/</span>
                    <span className="text-white">{project.name}</span>
                    <span>/</span>
                    <span>Settings</span>
                </div>
                <h1 className="halo-page-title">Project Settings</h1>
                <p className="halo-page-description">
                    Configure repository integrations, client credentials, and environment parameters for <span className="font-semibold text-white">{project.name}</span>.
                </p>
            </div>

            {/* General Project Info */}
            <div className="halo-card p-6 space-y-4 border border-border/80 bg-surface/50 rounded-xl">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-surface-elevated border border-border">
                        <Settings size={20} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold text-white">General Information</h2>
                        <p className="text-xs text-secondary">
                            Basic metadata and identifiers for this project.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-secondary">Project Name</label>
                        <div className="px-3 py-2 text-xs rounded-lg bg-surface-elevated border border-border text-white">
                            {project.name}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-secondary">Project Slug / ID</label>
                        <div className="px-3 py-2 text-xs rounded-lg bg-surface-elevated border border-border text-white font-mono">
                            {project.slug} ({project.id})
                        </div>
                    </div>
                </div>
            </div>

            {/* GitHub Integration */}
            <GitHubSettingsCard projectId={project.id} initialConfig={githubConfig} />
        </div>
    );
}