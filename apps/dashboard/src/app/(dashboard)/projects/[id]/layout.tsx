import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getProjectHeader } from "@/actions/project";
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
        <div className="mx-auto w-full max-w-[1600px] px-10 py-8">

            <Link
                href="/projects"
                className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-primary"
            >
                <ArrowLeft className="h-4 w-4" />
                Projects
            </Link>

            <header className="mt-8">

                <div className="flex items-center gap-5">

                    <div
                        className="
                            flex
                            h-12
                            w-12
                            items-center
                            justify-center
                            rounded-xl
                            bg-accent/10
                            text-lg
                            font-semibold
                            text-accent
                        "
                    >
                        {project.name.charAt(0).toUpperCase()}
                    </div>

                    <div>

                        <h1 className="text-5xl font-semibold tracking-[-0.05em]">
                            {project.name}
                        </h1>

                        {project.description && (
                            <p className="mt-1 text-secondary">
                                {project.description}
                            </p>
                        )}

                    </div>

                </div>

            </header>

            <div className="mt-10">
                <ProjectNavigation projectId={id} />
            </div>

            <main className="mt-10">
                {children}
            </main>

        </div>
    );
}