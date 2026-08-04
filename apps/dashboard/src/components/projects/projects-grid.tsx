import ProjectCard from "@/components/projects/project-card";

type Project = {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
};

type ProjectsGridProps = {
    projects: Project[];
};

export default function ProjectsGrid({
    projects,
}: ProjectsGridProps) {
    return (
        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
                <ProjectCard
                    key={project.id}
                    id={project.id}
                    name={project.name}
                    description={project.description}
                    createdAt={project.createdAt}
                />
            ))}
        </div>
    );
}