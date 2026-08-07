import Link from "next/link";

import { getEvents } from "@/actions/event";

import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { RelativeTime } from "@/components/ui/relative-time";
import { PageHeader } from "@/components/ui/page-header";

type Props = {
    params: Promise<{
        id: string;
    }>;
};

export default async function EventsPage({
    params,
}: Props) {
    const { id } = await params;

    const events = await getEvents(id);

    return (
        <div className="space-y-10">

            <PageHeader
                title="Events"
                description="Every event received from your SDK."
            />

            <div className="overflow-hidden rounded-2xl border border-border bg-surface">

                {/* Header */}

                <div className="grid grid-cols-[1.8fr_140px_140px_170px] border-b border-border px-6 py-3 text-xs font-medium uppercase tracking-wide text-muted">

                    <span>Event</span>
                    <span>Severity</span>
                    <span>SDK</span>
                    <span className="text-right">Time</span>

                </div>

                {events.map((event, index) => (

                    <Link
                        key={event.id}
                        href={`/projects/${id}/events/${event.id}`}
                        className="block"
                    >

                        <div
                            className={`
                                grid
                                grid-cols-[1.8fr_140px_140px_170px]
                                items-center
                                gap-6
                                px-6
                                py-5
                                transition-colors
                                hover:bg-white/[0.02]
                                ${index !== events.length - 1 ? "border-b border-border" : ""}
                            `}
                        >

                            {/* Event */}

                            <div className="min-w-0">

                                <div className="mb-2 flex items-center gap-2">

                                    <Badge>
                                        {event.type}
                                    </Badge>

                                </div>

                                <p className="truncate font-medium">
                                    {event.title}
                                </p>

                                {event.message && (
                                    <p className="mt-1 truncate text-sm text-secondary">
                                        {event.message}
                                    </p>
                                )}

                            </div>

                            {/* Severity */}

                            <SeverityBadge severity={event.severity} />

                            {/* SDK */}

                            <div className="text-sm text-secondary">

                                {event.sdkName ?? "-"}

                            </div>

                            {/* Time */}

                            <div className="text-right text-sm text-muted">

                                <RelativeTime
                                    date={event.timestamp}
                                />

                            </div>

                        </div>

                    </Link>

                ))}

            </div>

        </div>
    );
}