import { HaloClient } from "./client";
import {
    registerGlobalHandlers,
} from "./capture";
import { EventQueue } from "./queue";

import {
    getRequestContext,
} from "./request-context";

import {
    registerHttpInstrumentation,
} from "./http";

import type {
    HaloBreadcrumb,
    HaloCaptureOptions,
    HaloOptions,
    HaloTagValue,
    HaloUser,
} from "./types";

const SDK_NAME =
    "@halo/sdk";

const SDK_VERSION =
    "0.1.0";

function createSessionId() {
    return `hs_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 12)}`;
}

export class Halo {
    private client: HaloClient;

    private enabled: boolean;

    private release?: string;

    private environment?: string;

    private user?: HaloUser;

    private queue: EventQueue;

    private tags: Record<
        string,
        HaloTagValue
    > = {};

    private breadcrumbs:
        HaloBreadcrumb[] = [];

    private sessionId?: string;

    private sessionStartedAt?: string;

    private maxBreadcrumbs: number;

    constructor(
        options: HaloOptions,
    ) {
        const endpoint =
            options.endpoint ??
            "http://localhost:3000/api";

        this.client =
            new HaloClient(
                endpoint,
                options.apiKey,
            );

        this.queue =
            new EventQueue(
                async (
                    event: unknown,
                ) => {
                    await this.client.post(
                        "/ingest/events",
                        event,
                    );
                },
            );

        this.enabled =
            options.enabled ?? true;

        this.release =
            options.release;

        this.environment =
            options.environment;

        this.maxBreadcrumbs =
            Math.max(
                1,
                options.maxBreadcrumbs ??
                    100,
            );

        this.sessionId =
            options.sessionId;

        if (this.sessionId) {
            this.sessionStartedAt =
                new Date().toISOString();
        }

        /*
         * Level 2 automatic
         * instrumentation.
         */
        if (
            options.autoCapture !==
            false
        ) {
            registerGlobalHandlers(
                this,
            );

            if (
                options.captureHttp !==
                false
            ) {
                registerHttpInstrumentation(
                    this,
                    {
                        endpoint,

                        captureHeaders:
                            options.captureHttpHeaders,

                        ignoreUrls:
                            options.ignoreUrls,
                    },
                );
            }
        }
    }

    startSession() {
        this.sessionId =
            createSessionId();

        this.sessionStartedAt =
            new Date().toISOString();

        return this.sessionId;
    }

    endSession() {
        /*
         * lastSeenAt is derived from
         * the final received event.
         *
         * No synthetic event is sent.
         */
    }

    getSessionId() {
        return this.sessionId;
    }

    setUser(
        user: HaloUser,
    ) {
        this.user = user;
    }

    clearUser() {
        this.user = undefined;
    }

    setTag(
        key: string,
        value: HaloTagValue,
    ) {
        this.tags[key] = value;
    }

    removeTag(
        key: string,
    ) {
        delete this.tags[key];
    }

    addBreadcrumb(
        breadcrumb: HaloBreadcrumb,
    ) {
        this.breadcrumbs.push({
            ...breadcrumb,

            timestamp:
                breadcrumb.timestamp ??
                new Date().toISOString(),
        });

        while (
            this.breadcrumbs.length >
            this.maxBreadcrumbs
        ) {
            this.breadcrumbs.shift();
        }
    }

    clearBreadcrumbs() {
        this.breadcrumbs = [];
    }

    async flush() {
        await this.queue.flush();
    }

    async captureMessage(
        message: string,
    ) {
        return this.capture({
            type: "MESSAGE",

            title: message,

            message,

            severity: "INFO",
        });
    }

    async captureException(
        error: unknown,
    ) {
        const exception =
            error instanceof Error
                ? error
                : new Error(
                      String(error),
                  );

        const context =
            getRequestContext();

        return this.capture({
            type: "ERROR",

            title:
                exception.message ||
                exception.name,

            message:
                exception.message,

            severity: "ERROR",

            stack:
                exception.stack,

            requestId:
                context?.requestId,

            traceId:
                context?.traceId,
        });
    }

    async capturePerformance(
        options: {
            title: string;

            durationMs: number;

            operation?: string;

            resource?: string;

            status?: string | number;

            service?: string;

            metadata?: Record<
                string,
                unknown
            >;

            requestId?: string;

            traceId?: string;
        },
    ) {
        return this.capture({
            type: "TRACE",

            title:
                options.title,

            severity: "INFO",

            durationMs:
                options.durationMs,

            operation:
                options.operation,

            resource:
                options.resource,

            status:
                options.status,

            service:
                options.service,

            metadata:
                options.metadata,

            requestId:
                options.requestId,

            traceId:
                options.traceId,
        });
    }

    async capture(
        event: HaloCaptureOptions,
    ) {
        if (!this.enabled) {
            return;
        }

        const context =
            getRequestContext();

        return this.queue.enqueue({
            type:
                event.type,

            title:
                event.title,

            message:
                event.message,

            severity:
                event.severity ??
                "INFO",

            timestamp:
                new Date().toISOString(),

            stack:
                event.stack,

            fingerprint:
                event.fingerprint,

            metadata:
                event.metadata,

            tags: {
                ...this.tags,

                ...(event.tags ??
                    {}),
            },

            breadcrumbs: [
                ...this.breadcrumbs,

                ...(event.breadcrumbs ??
                    []),
            ],

            user:
                event.user ??
                this.user,

            sessionId:
                event.sessionId ??
                this.sessionId,

            sdkName:
                SDK_NAME,

            sdkVersion:
                SDK_VERSION,

            release:
                this.release,

            environment:
                this.environment,

            sessionStartedAt:
                this.sessionStartedAt,

            /*
             * Explicit event context
             * takes priority.
             *
             * Otherwise inherit the
             * active HTTP context.
             */
            requestId:
                event.requestId ??
                context?.requestId,

            traceId:
                event.traceId ??
                context?.traceId,

            service:
                event.service,

            resource:
                event.resource,

            operation:
                event.operation,

            status:
                event.status,

            durationMs:
                event.durationMs,
        });
    }
}