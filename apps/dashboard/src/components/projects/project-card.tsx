import Link from "next/link";

type ProjectCardProps = {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
};

export default function ProjectCard({
    id,
    name,
    description,
    createdAt,
}: ProjectCardProps) {
    return (
        <Link
            href={`/projects/${id}`}
            className="
                group
                block
                rounded-2xl
                border
                border-zinc-800
                bg-zinc-950
                p-6
                transition
                hover:border-zinc-700
                hover:bg-zinc-900/70
            "
        >
            <div className="flex items-start justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white">
                        {name}
                    </h3>

                    <p className="mt-2 text-sm text-zinc-400">
                        {description || "No description"}
                    </p>
                </div>
            </div>

            <div className="mt-6 text-xs text-zinc-500">
                Created {createdAt.toLocaleDateString()}
            </div>
        </Link>
    );
}