import Link from "next/link";
import { ArrowUpRight, Activity, AlertCircle } from "lucide-react";
import { RelativeTime } from "@/components/ui/relative-time";

type ProjectCardProps = {
    id: string;
    name: string;
    description: string | null;

    eventCount: number;
    openIssueCount: number;
    lastEventAt: Date | null;
};

export default function ProjectCard({
    id,
    name,
    description,
    eventCount,
    openIssueCount,
    lastEventAt,
}: ProjectCardProps) {
    const healthy = openIssueCount === 0;

    return (
        <Link
            href={`/projects/${id}`}
            className="
                group
                block
                rounded-2xl
                border
                border-border
                bg-surface
                p-6
                transition-all
                duration-200
                hover:border-accent/20
                hover:bg-surface-interactive
            "
        >
            <div className="flex items-start justify-between">

                <div className="min-w-0">

                    <h3 className="truncate text-lg font-semibold transition-colors group-hover:text-accent">
                        {name}
                    </h3>

                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-secondary">
                        {description || "No description"}
                    </p>

                </div>

                <ArrowUpRight
                    className="
                        h-4
                        w-4
                        shrink-0
                        text-muted
                        transition-all
                        group-hover:text-accent
                        group-hover:-translate-y-0.5
                        group-hover:translate-x-0.5
                    "
                />

            </div>

            <div className="my-6 border-t border-border" />

            <div className="grid grid-cols-3 gap-5 text-sm">

                <div>

                    <p className="text-muted">
                        Status
                    </p>

                    <div className="mt-2 flex items-center gap-2">

                        <div
                            className={`h-2 w-2 rounded-full ${
                                healthy
                                    ? "bg-success"
                                    : "bg-error"
                            }`}
                        />

                        <span className="text-secondary">
                            {healthy ? "Healthy" : "Attention"}
                        </span>

                    </div>

                </div>

                <div>

                    <p className="text-muted">
                        Events
                    </p>

                    <div className="mt-2 flex items-center gap-2 text-secondary">

                        <Activity className="h-4 w-4" />

                        {eventCount}

                    </div>

                </div>

                <div>

                    <p className="text-muted">
                        Issues
                    </p>

                    <div className="mt-2 flex items-center gap-2 text-secondary">

                        <AlertCircle className="h-4 w-4" />

                        {openIssueCount}

                    </div>

                </div>

            </div>

            <div className="mt-6 border-t border-border pt-4">

                <p className="text-xs text-muted">
                    Last Event
                </p>

                <p className="mt-1 text-sm text-secondary">

                    {lastEventAt ? (
                        <RelativeTime date={lastEventAt} />
                    ) : (
                        "No events received"
                    )}

                </p>

            </div>

        </Link>
    );
}