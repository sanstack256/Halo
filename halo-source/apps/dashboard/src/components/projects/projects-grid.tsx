"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import ProjectCard from "@/components/projects/project-card";

type Project = {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;

    eventCount: number;
    openIssueCount: number;
    lastEventAt: Date | null;
};

type ProjectsGridProps = {
    projects: Project[];
};

export default function ProjectsGrid({
    projects,
}: ProjectsGridProps) {
    const [query, setQuery] = useState("");

    const filteredProjects = useMemo(() => {
        const q = query.trim().toLowerCase();

        if (!q) {
            return projects;
        }

        return projects.filter((project) =>
            project.name.toLowerCase().includes(q)
        );
    }, [projects, query]);

    return (
        <div className="space-y-8">

            <div className="relative max-w-md">

                <Search
                    className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                />

                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search projects..."
                    className="
                        h-11
                        w-full
                        rounded-xl
                        border
                        border-border
                        bg-surface
                        pl-11
                        pr-4
                        text-sm
                        outline-none
                        transition-all
                        placeholder:text-muted
                        focus:border-accent/30
                        focus:ring-2
                        focus:ring-accent/10
                    "
                />

            </div>

            {filteredProjects.length === 0 ? (

                <div className="py-20 text-center">

                    <p className="text-secondary">
                        No matching projects found.
                    </p>

                </div>

            ) : (

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">

                    {filteredProjects.map((project) => (

                        <ProjectCard
                            key={project.id}
                            id={project.id}
                            name={project.name}
                            description={project.description}
                            eventCount={project.eventCount}
                            openIssueCount={project.openIssueCount}
                            lastEventAt={project.lastEventAt}
                        />

                    ))}

                </div>

            )}

        </div>
    );
}