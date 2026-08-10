import { FolderOpen } from "lucide-react";

import { getProjects } from "@/actions/project";

import CreateProjectDialog from "@/components/projects/create-project-dialog";
import ProjectsGrid from "@/components/projects/projects-grid";
import { PageHeader } from "@/components/ui/page-header";

export default async function ProjectsPage() {
    const projects = await getProjects();

    return (
        <div className="space-y-10">

            <PageHeader
                title="Projects"
                description="Manage the applications connected to Halo."
                action={<CreateProjectDialog />}
            />

            {projects.length === 0 ? (

                <div className="rounded-2xl border border-border bg-surface py-24">

                    <div className="mx-auto flex max-w-md flex-col items-center text-center">

                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">

                            <FolderOpen className="h-8 w-8 text-accent" />

                        </div>

                        <h2 className="mt-6 text-2xl font-semibold">
                            No projects yet
                        </h2>

                        <p className="mt-3 text-secondary">
                            Create your first project to start sending events to Halo.
                        </p>

                        <div className="mt-8">

                            <CreateProjectDialog />

                        </div>

                    </div>

                </div>

            ) : (

                <>

                    <div className="flex items-center justify-between">

                        <p className="text-sm text-secondary">
                            {projects.length} project{projects.length !== 1 ? "s" : ""}
                        </p>

                        {/* Search will go here */}

                    </div>

                    <ProjectsGrid
                        projects={projects}
                    />

                </>

            )}

        </div>
    );
}