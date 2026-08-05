import Link from "next/link";
import { getProjectHeader } from "@/actions/project";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProjectNavigation } from "@/components/projects/project-navigation";

type Props = {
    children: React.ReactNode;
    params: Promise<{
        id: string;
    }>;
};

export default async function ProjectLayout({
    children,
    params,
}: Props) {
    const { id } = await params;

    const project = await getProjectHeader(id);

    if (!project) {
        notFound();
    }

    return (
        <div className="mx-auto max-w-7xl p-8">

            <Link
                href="/projects"
                className="mb-8 flex items-center gap-2 text-sm text-muted-foreground hover:text-white"
            >
                <ArrowLeft className="h-4 w-4" />
                Projects
            </Link>

            <div className="mb-8 rounded-xl border p-8">

                <div className="flex items-center gap-4">

                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-sky-950 text-3xl font-bold text-sky-400">
                        {project.name.charAt(0).toUpperCase()}
                    </div>

                    <div>
                        <h1 className="text-5xl font-bold">
                            {project.name}
                        </h1>

                        <p className="mt-2 text-muted-foreground">
                            {project.description}
                        </p>
                    </div>

                </div>

            </div>

            <ProjectNavigation projectId={id} />

            <div className="mt-8">
                {children}
            </div>

        </div>
    );
}