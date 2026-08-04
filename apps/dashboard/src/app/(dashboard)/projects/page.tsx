import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import CreateProjectDialog from "@/components/projects/create-project-dialog";
import { getProjects } from "@/actions/project";
import ProjectsGrid from "@/components/projects/projects-grid";
import ProjectCard from "@/components/projects/project-card";


export default async function ProjectsPage() {
    const projects = await getProjects();
    return (
        <div className="mx-auto max-w-7xl p-8">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-semibold text-white">
                        Projects
                    </h1>

                    <p className="mt-2 text-zinc-400">
                        Create and manage the applications that send events to Halo.
                    </p>
                </div>

                <CreateProjectDialog />
            </div>

            {projects.length === 0 ? (
                <div className="mt-16 flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950 py-24">
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                        <FolderOpen className="h-10 w-10 text-zinc-500" />
                    </div>

                    <h2 className="mt-6 text-xl font-semibold text-white">
                        No projects yet
                    </h2>

                    <p className="mt-2 max-w-md text-center text-zinc-500">
                        Create your first project to start monitoring your application.
                    </p>

                    <CreateProjectDialog />
                </div>
            ) : (
                <div className="mt-10">
                    <p className="text-zinc-400">
                        {projects.length} project{projects.length !== 1 ? "s" : ""}
                    </p>

                    <ProjectsGrid projects={projects} />
                </div>
            )}
        </div>
    );
}