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
        <div className="w-full pb-16">

            {/* Back */}

            <Link
                href="/projects"
                className="
                    inline-flex
                    items-center
                    gap-2
                    text-sm
                    text-muted
                    transition-colors
                    hover:text-primary
                "
            >
                <ArrowLeft
                    className="h-4 w-4"
                    strokeWidth={1.8}
                />

                Projects
            </Link>

            {/* Project identity */}

            <header className="mt-6">

                <div className="flex items-center gap-4">

                    <div
                        className="
                            flex
                            h-11
                            w-11
                            shrink-0
                            items-center
                            justify-center
                            rounded-xl
                            border
                            border-accent/15
                            bg-accent/10
                            text-base
                            font-semibold
                            text-accent
                        "
                    >
                        {project.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0">

                        <h1
                            className="
                                truncate
                                text-2xl
                                font-semibold
                                tracking-tight
                                text-primary
                            "
                        >
                            {project.name}
                        </h1>

                        {project.description && (
                            <p className="mt-1 truncate text-sm text-secondary">
                                {project.description}
                            </p>
                        )}

                    </div>

                </div>

            </header>

            {/* Project navigation */}

            <div className="mt-7">
                <ProjectNavigation projectId={id} />
            </div>

            {/* Page content */}

            <main className="mt-8">
                {children}
            </main>

        </div>
    );
}