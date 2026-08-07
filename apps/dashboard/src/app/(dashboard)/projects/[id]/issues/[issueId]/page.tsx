import Link from "next/link";
import { notFound } from "next/navigation";

import { getIssue } from "@/actions/issue";

import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { RelativeTime } from "@/components/ui/relative-time";

type Props = {
    params: Promise<{
        id: string;
        issueId: string;
    }>;
};

export default async function IssuePage({
    params,
}: Props) {
    const { issueId } = await params;

    const issue = await getIssue(issueId);

    if (!issue) {
        notFound();
    }

    return (
        <div className="space-y-10">

            {/* Header */}

            <header className="space-y-5">

                <div className="flex items-center gap-3">

                    <Badge>{issue.status}</Badge>

                    <SeverityBadge severity={issue.severity} />

                </div>

                <h1 className="text-5xl font-semibold tracking-tight">
                    {issue.title}
                </h1>

            </header>

            <div className="grid grid-cols-[1fr_300px] gap-14">

                {/* Timeline */}

                <section>

                    <h2 className="mb-6 text-lg font-semibold">
                        Timeline
                    </h2>

                    <div className="overflow-hidden rounded-2xl border border-border bg-surface">

                        {issue.events.map((event, index) => (

                            <Link
                                key={event.id}
                                href={`/projects/${issue.projectId}/events/${event.id}`}
                                className={`
                                    group
                                    block
                                    px-6
                                    py-5
                                    transition-colors
                                    hover:bg-white/[0.02]
                                    ${index !== issue.events.length - 1 ? "border-b border-border" : ""}
                                `}
                            >

                                <div className="grid grid-cols-[1fr_170px] gap-6">

                                    <div>

                                        <div className="mb-3 flex items-center gap-2">

                                            <Badge>
                                                {event.type}
                                            </Badge>

                                            <SeverityBadge
                                                severity={event.severity}
                                            />

                                        </div>

                                        <h3 className="font-medium transition-colors group-hover:text-accent">
                                            {event.title}
                                        </h3>

                                        {event.message && (
                                            <p className="mt-2 text-sm text-secondary line-clamp-2">
                                                {event.message}
                                            </p>
                                        )}

                                    </div>

                                    <div className="space-y-1 text-right">

                                        <p className="text-sm text-secondary">
                                            <RelativeTime
                                                date={event.timestamp}
                                            />
                                        </p>

                                        <p className="text-xs text-muted">
                                            {event.sdkName ?? "-"}
                                        </p>

                                    </div>

                                </div>

                            </Link>

                        ))}

                    </div>

                </section>

                {/* Sidebar */}

                <aside className="sticky top-8 h-fit">

                    <div className="rounded-2xl border border-border bg-surface p-6">

                        <h3 className="mb-6 text-sm font-semibold uppercase tracking-wide text-muted">
                            Overview
                        </h3>

                        <div className="space-y-5">

                            <div>
                                <p className="text-xs text-muted">
                                    Occurrences
                                </p>

                                <p className="mt-1 text-lg font-semibold">
                                    {issue.eventCount}
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-muted">
                                    First Seen
                                </p>

                                <p className="mt-1">
                                    <RelativeTime date={issue.firstSeen} />
                                </p>
                            </div>

                            <div>
                                <p className="text-xs text-muted">
                                    Last Seen
                                </p>

                                <p className="mt-1">
                                    <RelativeTime date={issue.lastSeen} />
                                </p>
                            </div>

                        </div>

                    </div>

                </aside>

            </div>

        </div>
    );
}