import Link from "next/link";
import { notFound } from "next/navigation";
import {
    ArrowLeft,
    ExternalLink,
} from "lucide-react";

import { getEvent } from "@/actions/event";

import { Badge } from "@/components/ui/badge";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { RelativeTime } from "@/components/ui/relative-time";

import StackTrace from "@/components/events/stack-trace";
import Breadcrumbs from "@/components/events/breadcrumbs";
import Tags from "@/components/events/tags";
import User from "@/components/events/user";

import { BackButton } from "@/components/ui/back-button";

type Props = {
    params: Promise<{
        id: string;
        eventId: string;
    }>;
};

export default async function EventPage({
    params,
}: Props) {
    const { id, eventId } = await params;

    const event = await getEvent(eventId);

    if (!event) {
        notFound();
    }

    return (
        <div className="space-y-8 pb-16">

            {/* Back */}

            <BackButton fallbackHref={`/projects/${id}/events`} label="Back to Events" />

            {/* Header */}

            <header className="space-y-5">

                <div className="flex flex-wrap items-center gap-2">

                    <Badge>
                        {event.type}
                    </Badge>

                    <SeverityBadge
                        severity={event.severity}
                    />


                </div>

                <div>

                    <h1
                        className="
                            max-w-4xl
                            text-3xl
                            font-semibold
                            tracking-[-0.035em]
                            text-primary
                        "
                    >
                        {event.title}
                    </h1>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-secondary">

                        <RelativeTime
                            date={event.timestamp}
                        />

                        <span className="text-muted">
                            •
                        </span>

                        <span>
                            {event.timestamp.toLocaleString()}
                        </span>

                        <span className="text-muted">
                            •
                        </span>

                        <span>
                            {event.sdkName ?? "Unknown SDK"}
                            {event.sdkVersion
                                ? ` v${event.sdkVersion}`
                                : ""}
                        </span>

                        {event.release && (
                            <>
                                <span className="text-muted">
                                    •
                                </span>

                                <span>
                                    {event.release}
                                </span>
                            </>
                        )}

                    </div>

                </div>

            </header>

            {/* Content */}

            <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-10">

                {/* Main evidence */}

                <div className="min-w-0 space-y-8">

                    {/* Message */}

                    <section>

                        <SectionTitle>
                            Message
                        </SectionTitle>

                        <div
                            className="
                                overflow-hidden
                                rounded-xl
                                border
                                border-border
                                bg-surface
                            "
                        >
                            <pre
                                className="
                                    overflow-x-auto
                                    whitespace-pre-wrap
                                    break-words
                                    p-6
                                    font-mono
                                    text-sm
                                    leading-7
                                    text-secondary
                                "
                            >
                                {event.message ?? "No message recorded."}
                            </pre>
                        </div>

                    </section>

                    {/* Stack */}

                    {event.stack && (
                        <StackTrace
                            stack={event.stack}
                        />
                    )}

                    {/* Breadcrumbs */}

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

                    {/* User */}

                    {event.user &&
                        typeof event.user === "object" && (
                            <User
                                user={
                                    event.user as {
                                        id?: string;
                                        email?: string;
                                        username?: string;
                                    }
                                }
                            />
                        )}

                    {/* Tags */}

                    {event.tags &&
                        typeof event.tags === "object" &&
                        Object.keys(
                            event.tags as Record<string, unknown>
                        ).length > 0 && (
                            <Tags
                                tags={
                                    event.tags as Record<
                                        string,
                                        unknown
                                    >
                                }
                            />
                        )}

                    {/* Metadata */}

                    {event.metadata &&
                        typeof event.metadata === "object" && (
                            <section>

                                <SectionTitle>
                                    Metadata
                                </SectionTitle>

                                <div
                                    className="
                                        overflow-hidden
                                        rounded-xl
                                        border
                                        border-border
                                        bg-surface
                                    "
                                >
                                    <pre
                                        className="
                                            max-h-[520px]
                                            overflow-auto
                                            p-6
                                            font-mono
                                            text-sm
                                            leading-7
                                            text-secondary
                                        "
                                    >
                                        {JSON.stringify(
                                            event.metadata,
                                            null,
                                            2
                                        )}
                                    </pre>
                                </div>

                            </section>
                        )}

                </div>

                {/* Evidence sidebar */}

                <aside className="min-w-0">

                    <div
                        className="
                            sticky
                            top-6
                            overflow-hidden
                            rounded-xl
                            border
                            border-border
                            bg-surface
                        "
                    >

                        <div className="border-b border-border px-5 py-4">

                            <h2 className="text-sm font-semibold text-primary">
                                Event details
                            </h2>

                        </div>

                        <div className="divide-y divide-border">

                            <DetailRow
                                label="Timestamp"
                                value={event.timestamp.toLocaleString()}
                            />

                            <DetailRow
                                label="Event type"
                                value={event.type}
                            />

                            <DetailRow
                                label="Severity"
                                value={event.severity}
                            />

                            <DetailRow
                                label="SDK"
                                value={
                                    event.sdkName
                                        ? `${event.sdkName}${
                                              event.sdkVersion
                                                  ? ` v${event.sdkVersion}`
                                                  : ""
                                          }`
                                        : "-"
                                }
                            />

                            <DetailRow
                                label="Release"
                                value={event.release ?? "-"}
                            />

                            <DetailRow
                                label="Event ID"
                                value={event.id}
                                mono
                            />

                        </div>

                        {/* Issue */}

                        <div className="border-t border-border p-5">

                            <p className="text-xs font-medium uppercase tracking-wide text-muted">
                                Issue
                            </p>

                            {event.issue ? (
                                <Link
                                    href={`/projects/${id}/issues/${event.issue.id}`}
                                    className="
                                        mt-3
                                        flex
                                        items-start
                                        justify-between
                                        gap-3
                                        rounded-lg
                                        border
                                        border-border
                                        bg-background
                                        p-3
                                        transition-colors
                                        hover:border-accent/30
                                        hover:text-accent
                                    "
                                >
                                    <span className="min-w-0 text-sm font-medium">
                                        {event.issue.title}
                                    </span>

                                    <ExternalLink
                                        className="
                                            mt-0.5
                                            h-4
                                            w-4
                                            shrink-0
                                            text-muted
                                        "
                                        strokeWidth={1.8}
                                    />
                                </Link>
                            ) : (
                                <p className="mt-3 text-sm text-muted">
                                    No associated issue.
                                </p>
                            )}

                        </div>

                    </div>

                </aside>

            </div>

        </div>
    );
}

function SectionTitle({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <h2 className="mb-4 text-lg font-semibold text-primary">
            {children}
        </h2>
    );
}

function DetailRow({
    label,
    value,
    mono = false,
}: {
    label: string;
    value: string;
    mono?: boolean;
}) {
    return (
        <div className="px-5 py-4">

            <p className="text-xs text-muted">
                {label}
            </p>

            <p
                className={`
                    mt-1
                    break-words
                    text-sm
                    text-secondary
                    ${mono ? "font-mono text-xs" : ""}
                `}
            >
                {value}
            </p>

        </div>
    );
}