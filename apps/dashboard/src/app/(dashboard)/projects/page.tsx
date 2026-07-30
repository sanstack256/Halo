import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import CreateProjectDialog from "@/components/projects/create-project-dialog";

export default function ProjectsPage() {
    return (
        <div className="mx-auto max-w-7xl p-8">
            <div>
                <h1 className="text-3xl font-semibold text-white">
                    Projects
                </h1>

                <p className="mt-2 text-zinc-400">
                    Create and manage the applications that send events to Halo.
                </p>
            </div>

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
        </div>
    );
}