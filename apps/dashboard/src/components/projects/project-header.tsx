import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Props = {
    name: string;
    description: string | null;
};

export default function ProjectHeader({
    name,
    description,
}: Props) {
    return (
        <div>
            <Link
                href="/projects"
                className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-zinc-300"
            >
                <ArrowLeft className="h-4 w-4" />
                Projects
            </Link>

            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
                <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-sky-500/15 text-xl font-semibold text-sky-400">
                        {name.charAt(0).toUpperCase()}
                    </div>

                    <div>
                        <h1 className="text-3xl font-semibold text-white">
                            {name}
                        </h1>

                        <p className="mt-1 text-zinc-400">
                            {description || "No description"}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}