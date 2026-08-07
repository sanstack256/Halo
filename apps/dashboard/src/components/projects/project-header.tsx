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
        <div className="space-y-8">

            <Link
                href="/projects"
                className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-primary"
            >
                <ArrowLeft className="h-4 w-4" />
                Projects
            </Link>

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
                    {name.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0">

                    <h1 className="truncate text-5xl font-semibold tracking-[-0.05em] text-primary">
                        {name}
                    </h1>

                    <p className="mt-1 text-base text-secondary">
                        {description || "No description"}
                    </p>

                </div>

            </div>

        </div>
    );
}