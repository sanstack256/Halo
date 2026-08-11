import Link from "next/link";
import {
    Activity,
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    Clock3,
    Radio,
} from "lucide-react";

type RecentEvent = {
    id: string;
    title: string;
    type: string;
    severity: string;
    timestamp: Date;
    message: string | null;
};

type Props = {
    projectId: string;
    eventCount: number;
    issueCount: number;
    lastEvent: Date | null;
    hasApiKey: boolean;
    recentEvents: RecentEvent[];
};

function getProjectStatus(
    hasApiKey: boolean,
    hasEvents: boolean,
) {
    if (hasEvents) {
        return {
            label: "Receiving events",
            description:
                "Halo is receiving telemetry from this project.",
            icon: Radio,
        };
    }

    if (hasApiKey) {
        return {
            label: "Waiting for events",
            description:
                "Your project is connected. Send an event to begin.",
            icon: Clock3,
        };
    }

    return {
        label: "Setup required",
        description:
            "Generate an API key and connect your application.",
        icon: AlertTriangle,
    };
}

function formatEventTime(date: Date) {
    return date.toLocaleString();
}

export default function ProjectOverview({
    projectId,
    eventCount,
    issueCount,
    lastEvent,
    hasApiKey,
    recentEvents,
}: Props) {
    const status = getProjectStatus(
        hasApiKey,
        eventCount > 0,
    );

    const StatusIcon = status.icon;

    return (
        <div className="space-y-8">

            {/* Status */}

            <section
                className="
                    rounded-2xl
                    border
                    border-border
                    bg-surface
                    p-6
                "
            >
                <div className="flex items-start justify-between gap-6">

                    <div className="flex items-start gap-4">

                        <div
                            className="
                                flex
                                h-10
                                w-10
                                shrink-0
                                items-center
                                justify-center
                                rounded-xl
                                bg-accent/10
                                text-accent
                            "
                        >
                            <StatusIcon
                                className="h-5 w-5"
                                strokeWidth={1.8}
                            />
                        </div>

                        <div>

                            <div className="flex items-center gap-2">

                                <h2 className="font-medium text-primary">
                                    {status.label}
                                </h2>

                                {eventCount > 0 && (
                                    <span
                                        className="
                                            h-1.5
                                            w-1.5
                                            rounded-full
                                            bg-emerald-400
                                        "
                                    />
                                )}

                            </div>

                            <p className="mt-1 text-sm text-secondary">
                                {status.description}
                            </p>

                        </div>

                    </div>

                    {!hasApiKey && (
                        <Link
                            href={`/projects/${projectId}/api-keys`}
                            className="
                                inline-flex
                                shrink-0
                                items-center
                                gap-2
                                rounded-xl
                                bg-accent
                                px-4
                                py-2
                                text-sm
                                font-medium
                                text-white
                                transition-opacity
                                hover:opacity-90
                            "
                        >
                            Generate API Key
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    )}

                </div>
            </section>

            {/* Stats */}

            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">

                <Link
                    href={`/projects/${projectId}/events`}
                    className="
                        group
                        rounded-2xl
                        border
                        border-border
                        bg-surface
                        p-6
                        transition-colors
                        hover:border-accent/20
                        hover:bg-surface-elevated
                    "
                >
                    <div className="flex items-center justify-between">

                        <div className="flex items-center gap-2 text-secondary">

                            <Activity className="h-4 w-4" />

                            <span className="text-sm">
                                Events
                            </span>

                        </div>

                        <ArrowRight
                            className="
                                h-4
                                w-4
                                text-muted
                                opacity-0
                                transition-all
                                group-hover:translate-x-0.5
                                group-hover:text-accent
                                group-hover:opacity-100
                            "
                        />

                    </div>

                    <p className="mt-4 text-3xl font-semibold tracking-tight text-primary">
                        {eventCount}
                    </p>

                    <p className="mt-1 text-xs text-muted">
                        Total events received
                    </p>

                </Link>

                <Link
                    href={`/projects/${projectId}/issues`}
                    className="
                        group
                        rounded-2xl
                        border
                        border-border
                        bg-surface
                        p-6
                        transition-colors
                        hover:border-accent/20
                        hover:bg-surface-elevated
                    "
                >
                    <div className="flex items-center justify-between">

                        <div className="flex items-center gap-2 text-secondary">

                            <AlertTriangle className="h-4 w-4" />

                            <span className="text-sm">
                                Issues
                            </span>

                        </div>

                        <ArrowRight
                            className="
                                h-4
                                w-4
                                text-muted
                                opacity-0
                                transition-all
                                group-hover:translate-x-0.5
                                group-hover:text-accent
                                group-hover:opacity-100
                            "
                        />

                    </div>

                    <p className="mt-4 text-3xl font-semibold tracking-tight text-primary">
                        {issueCount}
                    </p>

                    <p className="mt-1 text-xs text-muted">
                        Issues detected
                    </p>

                </Link>

                <div
                    className="
                        rounded-2xl
                        border
                        border-border
                        bg-surface
                        p-6
                    "
                >
                    <div className="flex items-center gap-2 text-secondary">

                        <Clock3 className="h-4 w-4" />

                        <span className="text-sm">
                            Last Event
                        </span>

                    </div>

                    <p className="mt-4 text-lg font-semibold tracking-tight text-primary">
                        {lastEvent
                            ? lastEvent.toLocaleString()
                            : "Never"}
                    </p>

                    <p className="mt-1 text-xs text-muted">
                        Most recent telemetry
                    </p>

                </div>

            </section>

            {/* Recent activity */}

            <section
                className="
                    overflow-hidden
                    rounded-2xl
                    border
                    border-border
                    bg-surface
                "
            >
                <div
                    className="
                        flex
                        items-center
                        justify-between
                        border-b
                        border-border
                        px-6
                        py-5
                    "
                >
                    <div>

                        <h2 className="font-semibold text-primary">
                            Recent Activity
                        </h2>

                        <p className="mt-1 text-sm text-secondary">
                            The latest events received by Halo.
                        </p>

                    </div>

                    {recentEvents.length > 0 && (
                        <Link
                            href={`/projects/${projectId}/events`}
                            className="
                                inline-flex
                                items-center
                                gap-1.5
                                text-sm
                                text-secondary
                                transition-colors
                                hover:text-primary
                            "
                        >
                            View all
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    )}

                </div>

                {recentEvents.length === 0 ? (

                    <div className="px-6 py-14 text-center">

                        <div
                            className="
                                mx-auto
                                flex
                                h-10
                                w-10
                                items-center
                                justify-center
                                rounded-xl
                                bg-surface-elevated
                                text-muted
                            "
                        >
                            <Activity
                                className="h-5 w-5"
                                strokeWidth={1.7}
                            />
                        </div>

                        <h3 className="mt-4 text-sm font-medium text-primary">
                            No events yet
                        </h3>

                        <p className="mx-auto mt-1 max-w-sm text-sm text-secondary">
                            Once your application sends telemetry,
                            the latest activity will appear here.
                        </p>

                    </div>

                ) : (

                    <div>

                        {recentEvents.map((event, index) => (

                            <Link
                                key={event.id}
                                href={`/projects/${projectId}/events/${event.id}`}
                                className={`
                                    group
                                    flex
                                    items-center
                                    justify-between
                                    gap-6
                                    px-6
                                    py-5
                                    transition-colors
                                    hover:bg-white/[0.02]
                                    ${
                                        index !==
                                        recentEvents.length - 1
                                            ? "border-b border-border"
                                            : ""
                                    }
                                `}
                            >

                                <div className="flex min-w-0 items-start gap-4">

                                    <div
                                        className="
                                            mt-1
                                            flex
                                            h-7
                                            w-7
                                            shrink-0
                                            items-center
                                            justify-center
                                            rounded-lg
                                            bg-accent/10
                                            text-accent
                                        "
                                    >
                                        <CheckCircle2
                                            className="h-3.5 w-3.5"
                                            strokeWidth={1.8}
                                        />
                                    </div>

                                    <div className="min-w-0">

                                        <div className="flex items-center gap-2">

                                            <span
                                                className="
                                                    rounded-md
                                                    border
                                                    border-border
                                                    px-2
                                                    py-0.5
                                                    text-[10px]
                                                    font-medium
                                                    uppercase
                                                    tracking-wide
                                                    text-muted
                                                "
                                            >
                                                {event.type}
                                            </span>

                                        </div>

                                        <p className="mt-2 truncate text-sm font-medium text-primary transition-colors group-hover:text-accent">
                                            {event.title}
                                        </p>

                                        {event.message && (
                                            <p className="mt-1 truncate text-xs text-secondary">
                                                {event.message}
                                            </p>
                                        )}

                                    </div>

                                </div>

                                <div className="shrink-0 text-right">

                                    <p className="text-xs text-muted">
                                        {formatEventTime(
                                            event.timestamp,
                                        )}
                                    </p>

                                    <p className="mt-1 text-xs text-secondary">
                                        {event.severity}
                                    </p>

                                </div>

                            </Link>

                        ))}

                    </div>

                )}

            </section>

            {/* Investigation entry point */}

            {issueCount > 0 && (
                <section
                    className="
                        flex
                        items-center
                        justify-between
                        gap-6
                        rounded-2xl
                        border
                        border-accent/15
                        bg-accent/[0.035]
                        p-6
                    "
                >
                    <div>

                        <h2 className="font-semibold text-primary">
                            Something needs attention
                        </h2>

                        <p className="mt-1 text-sm text-secondary">
                            Halo has detected {issueCount} issue
                            {issueCount !== 1 ? "s" : ""} in this
                            project. Start with an issue to investigate
                            what happened.
                        </p>

                    </div>

                    <Link
                        href={`/projects/${projectId}/issues`}
                        className="
                            inline-flex
                            shrink-0
                            items-center
                            gap-2
                            rounded-xl
                            border
                            border-border
                            bg-surface
                            px-4
                            py-2
                            text-sm
                            font-medium
                            text-primary
                            transition-colors
                            hover:border-accent/30
                            hover:text-accent
                        "
                    >
                        View Issues
                        <ArrowRight className="h-4 w-4" />
                    </Link>

                </section>
            )}

        </div>
    );
}