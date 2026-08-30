"use client";

import React, { useState } from "react";
import Link from "next/link";

import {
    Activity,
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    Clock3,
    Gauge,
    Package,
    Radio,
    Zap,
} from "lucide-react";
import type { ProjectMetrics } from "@/actions/project-metrics";
import { HaloSelect } from "@/components/ui/halo-select";

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

    metrics: ProjectMetrics;

    releaseCount: number;
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

function formatLatency(
    value: number | null,
) {
    if (value === null) {
        return "—";
    }

    if (value >= 1000) {
        return `${(value / 1000).toFixed(2)}s`;
    }

    return `${Math.round(value)}ms`;
}

function formatApdex(
    score: number | null,
) {
    if (score === null) {
        return "—";
    }

    return score.toFixed(2);
}

function getApdexLabel(
    score: number | null,
) {
    if (score === null) {
        return "No trace data";
    }

    if (score >= 0.85) {
        return "Excellent";
    }

    if (score >= 0.70) {
        return "Good";
    }

    if (score >= 0.50) {
        return "Fair";
    }

    return "Poor";
}

export default function ProjectOverview({
    projectId,
    eventCount,
    issueCount,
    lastEvent,
    hasApiKey,
    recentEvents,
    metrics,
    releaseCount,
}: Props) {
    const status = getProjectStatus(
        hasApiKey,
        eventCount > 0,
    );

    const StatusIcon = status.icon;

    const [selectedEnv, setSelectedEnv] = useState("all");
    const [selectedWindow, setSelectedWindow] = useState("14d");

    return (
        <div className="space-y-8">
            {/* Environment & Time Window Controls (Image 2 feature) */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-border bg-surface">
                <div className="flex items-center gap-3">
                    <HaloSelect
                        value={selectedEnv}
                        onChange={(val) => setSelectedEnv(val)}
                        options={[
                            { value: "all", label: "All Envs" },
                            { value: "production", label: "Production" },
                            { value: "staging", label: "Staging" },
                        ]}
                    />

                    <HaloSelect
                        value={selectedWindow}
                        onChange={(val) => setSelectedWindow(val)}
                        options={[
                            { value: "14d", label: "14D" },
                            { value: "7d", label: "7D" },
                            { value: "24h", label: "24H" },
                        ]}
                    />
                </div>

                <div className="flex-1 max-w-md">
                    <input
                        type="text"
                        placeholder="Search by release version, build, package, or stage..."
                        className="w-full px-3.5 py-1.5 rounded-lg border border-border bg-surface-elevated text-xs text-white placeholder:text-muted focus:outline-none focus:border-accent"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Link href={`/projects/${projectId}/issues`} className="halo-btn halo-btn-sm halo-btn-secondary">
                        View All Issues
                    </Link>
                    <Link href={`/monitors`} className="halo-btn halo-btn-sm halo-btn-primary">
                        Create Monitor
                    </Link>
                </div>
            </div>

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

            {/* Project Health */}

            <section>

                <div className="mb-4 flex items-end justify-between">

                    <div>
                        <h2 className="text-lg font-semibold text-primary">
                            Project Health
                        </h2>

                        <p className="mt-1 text-sm text-secondary">
                            Current application reliability and performance.
                        </p>
                    </div>

                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

                    {/* Crash Free */}

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

                            <CheckCircle2 className="h-4 w-4" />

                            <span className="text-sm">
                                Crash-Free Sessions
                            </span>

                        </div>

                        <p className="mt-5 text-3xl font-semibold tracking-tight text-primary">
                            {metrics.crashFreeSessions.total > 0
                                ? `${metrics.crashFreeSessions.percentage.toFixed(1)}%`
                                : "—"}
                        </p>

                        <p className="mt-2 text-xs text-muted">
                            {metrics.crashFreeSessions.total > 0
                                ? `${metrics.crashFreeSessions.crashed} of ${metrics.crashFreeSessions.total} sessions crashed`
                                : "Waiting for session data"}
                        </p>
                    </div>

                    {/* Apdex */}

                    <div
                        className="
                            rounded-2xl
                            border
                            border-border
                            bg-surface
                            p-6
                        "
                    >
                        <div className="flex items-center justify-between">

                            <div className="flex items-center gap-2 text-secondary">

                                <Gauge className="h-4 w-4" />

                                <span className="text-sm">
                                    Apdex
                                </span>

                            </div>

                            <span className="text-xs text-muted">
                                {getApdexLabel(
                                    metrics.apdex.score,
                                )}
                            </span>

                        </div>

                        <p className="mt-5 text-3xl font-semibold tracking-tight text-primary">
                            {formatApdex(
                                metrics.apdex.score,
                            )}
                        </p>

                        <p className="mt-2 text-xs text-muted">
                            {metrics.apdex.total > 0
                                ? `${metrics.apdex.satisfied} satisfied · ${metrics.apdex.tolerating} tolerating`
                                : "Waiting for trace data"}
                        </p>
                    </div>

                    {/* P95 */}

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

                            <Zap className="h-4 w-4" />

                            <span className="text-sm">
                                P95 Latency
                            </span>

                        </div>

                        <p className="mt-5 text-3xl font-semibold tracking-tight text-primary">
                            {formatLatency(
                                metrics.performance.p95,
                            )}
                        </p>

                        <p className="mt-2 text-xs text-muted">
                            {metrics.performance.traceCount > 0
                                ? `${metrics.performance.traceCount} traces measured`
                                : "Waiting for trace data"}
                        </p>
                    </div>

                </div>

            </section>

            {/* Performance Details */}

            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">

                <div
                    className="
                        rounded-2xl
                        border
                        border-border
                        bg-surface
                        p-6
                    "
                >
                    <div className="flex items-center justify-between">

                        <div className="flex items-center gap-2 text-secondary">

                            <Activity className="h-4 w-4" />

                            <span className="text-sm">
                                Performance
                            </span>

                        </div>

                        <span className="text-xs text-muted">
                            {metrics.performance.traceCount} traces
                        </span>

                    </div>

                    <div className="mt-6 grid grid-cols-3 gap-4">

                        <div>
                            <p className="text-xs text-muted">
                                P50
                            </p>

                            <p className="mt-1 text-lg font-semibold">
                                {formatLatency(
                                    metrics.performance.p50,
                                )}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs text-muted">
                                P95
                            </p>

                            <p className="mt-1 text-lg font-semibold">
                                {formatLatency(
                                    metrics.performance.p95,
                                )}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs text-muted">
                                P99
                            </p>

                            <p className="mt-1 text-lg font-semibold">
                                {formatLatency(
                                    metrics.performance.p99,
                                )}
                            </p>
                        </div>

                    </div>
                </div>

                <div
                    className="
                        rounded-2xl
                        border
                        border-border
                        bg-surface
                        p-6
                    "
                >
                    <div className="flex items-center justify-between">

                        <div className="flex items-center gap-2 text-secondary">

                            <AlertTriangle className="h-4 w-4" />

                            <span className="text-sm">
                                Error Rate
                            </span>

                        </div>

                        <Link
                            href={`/projects/${projectId}/events`}
                            className="
                                text-xs
                                text-muted
                                transition-colors
                                hover:text-accent
                            "
                        >
                            View events
                        </Link>

                    </div>

                    <div className="mt-6 flex items-end justify-between">

                        <div>

                            <p className="text-3xl font-semibold tracking-tight text-primary">
                                {metrics.performance.traceCount > 0
                                    ? `${metrics.performance.traceFailureRate.toFixed(1)}%`
                                    : "—"}
                            </p>

                            <p className="mt-2 text-xs text-muted">
                                Failed traces
                            </p>

                        </div>

                        <div className="text-right">

                            <p className="text-lg font-semibold text-primary">
                                {metrics.performance.errorCount}
                            </p>

                            <p className="mt-1 text-xs text-muted">
                                Errors
                            </p>

                        </div>

                    </div>
                </div>

            </section>

            {/* Project counters */}

            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">

                {/* Events */}

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

                {/* Releases */}

                <Link
                    href={`/projects/${projectId}/releases`}
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

                            <Package className="h-4 w-4" />

                            <span className="text-sm">
                                Releases
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
                        {releaseCount}
                    </p>

                    <p className="mt-1 text-xs text-muted">
                        Releases detected
                    </p>

                </Link>

                {/* Issues */}

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
                                    ${index !==
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