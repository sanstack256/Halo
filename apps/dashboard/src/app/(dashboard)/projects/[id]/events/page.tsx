import { notFound } from "next/navigation";
import { getProject } from "@/actions/project";

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default async function EventsPage({
    params,
}: Props) {
    const { id } = await params;

    const project = await getProject(id);

    if (!project) {
        notFound();
    }

    return (
        <div className="mx-auto max-w-7xl p-8">
            <h1 className="text-3xl font-semibold text-white">
                Events
            </h1>

            <p className="mt-2 text-zinc-400">
                {project.name}
            </p>
        </div>
    );
}