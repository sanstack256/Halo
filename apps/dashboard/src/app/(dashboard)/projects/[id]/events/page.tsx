import Link from "next/link";
import {
    Activity,
    ArrowRight,
    Inbox,
} from "lucide-react";

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
        <div className="space-y-8 pb-16">

            <PageHeader
                title="Events"
                description="Every event received from your application."
            />

            {events.length === 0 ? (
                <div
                    className="
                        overflow-hidden
                        rounded-2xl
                        border
                        border-border
                        bg-surface
                    "
                >
                    <div className="flex flex-col items-center px-6 py-24 text-center">

                        <div
                            className="
                                flex
                                h-14
                                w-14
                                items-center
                                justify-center
                                rounded-2xl
                                bg-accent/10
                                text-accent
                            "
                        >
                            <Inbox
                                className="h-6 w-6"
                                strokeWidth={1.8}
                            />
                        </div>

                        <h2 className="mt-5 text-lg font-semibold text-primary">
                            No events yet
                        </h2>

                        <p className="mt-2 max-w-md text-sm leading-6 text-secondary">
                            Once your application sends telemetry to this
                            project, events will appear here.
                        </p>

                        <Link
                            href={`/projects/${id}/sdk`}
                            className="
                                mt-6
                                inline-flex
                                items-center
                                gap-2
                                rounded-xl
                                bg-accent
                                px-4
                                py-2.5
                                text-sm
                                font-medium
                                text-white
                                transition-opacity
                                hover:opacity-90
                            "
                        >
                            Install SDK
                            <ArrowRight className="h-4 w-4" />
                        </Link>

                    </div>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between">

                        <div className="flex items-center gap-2 text-sm text-secondary">
                            <Activity className="h-4 w-4 text-muted" />

                            <span>
                                {events.length} event
                                {events.length !== 1 ? "s" : ""}
                            </span>
                        </div>

                    </div>

                    <div
                        className="
                            overflow-hidden
                            rounded-2xl
                            border
                            border-border
                            bg-surface
                        "
                    >
                        {/* Header */}

                        <div
                            className="
                                grid
                                grid-cols-[minmax(0,1fr)_130px_150px_170px]
                                items-center
                                gap-6
                                border-b
                                border-border
                                px-6
                                py-3
                                text-xs
                                font-medium
                                uppercase
                                tracking-wide
                                text-muted
                            "
                        >
                            <span>Event</span>
                            <span>Severity</span>
                            <span>SDK</span>
                            <span className="text-right">
                                Time
                            </span>
                        </div>

                        {events.map((event, index) => (
                            <Link
                                key={event.id}
                                href={`/projects/${id}/events/${event.id}`}
                                className="
                                    group
                                    block
                                    transition-colors
                                    hover:bg-surface-interactive
                                "
                            >
                                <div
                                    className={`
                                        grid
                                        grid-cols-[minmax(0,1fr)_130px_150px_170px]
                                        items-center
                                        gap-6
                                        px-6
                                        py-5
                                        ${
                                            index !== events.length - 1
                                                ? "border-b border-border"
                                                : ""
                                        }
                                    `}
                                >
                                    {/* Event */}

                                    <div className="min-w-0">

                                        <div className="mb-2 flex items-center gap-2">

                                            <Badge>
                                                {event.type}
                                            </Badge>


                                        </div>

                                        <p className="truncate text-[15px] font-medium text-primary transition-colors group-hover:text-accent">
                                            {event.title}
                                        </p>

                                        {event.message && (
                                            <p className="mt-1 truncate text-sm text-secondary">
                                                {event.message}
                                            </p>
                                        )}

                                    </div>

                                    {/* Severity */}

                                    <div>
                                        <SeverityBadge
                                            severity={event.severity}
                                        />
                                    </div>

                                    {/* SDK */}

                                    <div className="min-w-0">

                                        <p className="truncate text-sm text-secondary">
                                            {event.sdkName ?? "Unknown SDK"}
                                        </p>

                                        {event.sdkVersion && (
                                            <p className="mt-1 text-xs text-muted">
                                                v{event.sdkVersion}
                                            </p>
                                        )}

                                    </div>

                                    {/* Time */}

                                    <div className="text-right">

                                        <p className="text-sm text-secondary">
                                            <RelativeTime
                                                date={event.timestamp}
                                            />
                                        </p>

                                        <p className="mt-1 text-xs text-muted">
                                            {event.timestamp.toLocaleString()}
                                        </p>

                                    </div>

                                </div>
                            </Link>
                        ))}
                    </div>
                </>
            )}

        </div>
    );
}