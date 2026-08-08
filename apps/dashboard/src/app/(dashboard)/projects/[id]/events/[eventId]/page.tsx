import { notFound } from "next/navigation";

import { getEvent } from "@/actions/event";

import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { RelativeTime } from "@/components/ui/relative-time";

import StackTrace from "@/components/events/stack-trace";
import Breadcrumbs from "@/components/events/breadcrumbs";

type Props = {
    params: Promise<{
        id: string;
        eventId: string;
    }>;
};

export default async function EventPage({
    params,
}: Props) {
    const { eventId } = await params;

    const event = await getEvent(eventId);

    if (!event) {
        notFound();
    }

    return (
        <div className="space-y-10">

            {/* Header */}

            <header className="space-y-5">

                <div className="flex items-center gap-2">

                    <Badge>
                        {event.type}
                    </Badge>

                    <SeverityBadge
                        severity={event.severity}
                    />

                </div>

                <h1 className="text-5xl font-semibold tracking-tight">
                    {event.title}
                </h1>

                <div className="flex flex-wrap items-center gap-4 text-sm text-secondary">

                    <RelativeTime
                        date={event.timestamp}
                    />

                    <span>•</span>

                    <span>
                        {event.sdkName ?? "-"}{" "}
                        {event.sdkVersion ?? ""}
                    </span>

                    <span>•</span>

                    <span>
                        {event.release ?? "No release"}
                    </span>

                </div>

            </header>

            <div className="grid grid-cols-[1fr_320px] gap-14">

                {/* Left */}

                <div className="space-y-10">

                    <section>

                        <h2 className="mb-5 text-lg font-semibold">
                            Message
                        </h2>

                        <div className="rounded-xl bg-surface p-6">

                            <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-7 text-secondary">

                                {event.message ?? "No message"}

                            </pre>

                        </div>

                    </section>

                    {event.stack && (
                        <StackTrace
                            stack={event.stack}
                        />
                    )}

                    {Array.isArray(event.breadcrumbs) &&
                        event.breadcrumbs.length > 0 && (
                            <Breadcrumbs
                                breadcrumbs={
                                    event.breadcrumbs as {
                                        category: string;
                                        message: string;
                                        timestamp?: string;
                                    }[]
                                }
                            />
                        )}

                    <section>

                        <h2 className="mb-5 text-lg font-semibold">
                            Metadata
                        </h2>

                        <div className="overflow-hidden rounded-xl bg-surface">

                            <pre className="overflow-x-auto p-6 font-mono text-sm leading-7 text-secondary">

                                {JSON.stringify(
                                    event.metadata,
                                    null,
                                    2
                                )}

                            </pre>

                        </div>

                    </section>

                </div>

                {/* Right */}

                <aside className="sticky top-8 h-fit">

                    <div className="rounded-xl border border-border bg-surface p-6">

                        <h2 className="mb-6 text-sm font-semibold uppercase tracking-wide text-muted">
                            Evidence
                        </h2>

                        <div className="space-y-6">

                            <div>

                                <p className="text-xs text-muted">
                                    Timestamp
                                </p>

                                <p className="mt-1">
                                    {event.timestamp.toLocaleString()}
                                </p>

                            </div>

                            <div>

                                <p className="text-xs text-muted">
                                    Issue
                                </p>

                                <p className="mt-1">
                                    {event.issue?.title ?? "-"}
                                </p>

                            </div>

                            <div>

                                <p className="text-xs text-muted">
                                    SDK
                                </p>

                                <p className="mt-1">
                                    {event.sdkName ?? "-"}{" "}
                                    {event.sdkVersion ?? ""}
                                </p>

                            </div>

                            <div>

                                <p className="text-xs text-muted">
                                    Release
                                </p>

                                <p className="mt-1">
                                    {event.release ?? "-"}
                                </p>

                            </div>

                        </div>

                    </div>

                </aside>

            </div>

        </div>
    );
}