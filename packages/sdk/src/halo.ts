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

    private service?: string;

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

    private onEventIngested?: (result: {
        eventId?: string;
        issueId?: string;
    }) => void;

    constructor(
        options: HaloOptions,
    ) {
        let endpoint = options.endpoint;

        if (!endpoint) {
            if (typeof process !== "undefined" && process.env?.HALO_ENDPOINT) {
                endpoint = process.env.HALO_ENDPOINT;
            } else if (typeof window !== "undefined") {
                endpoint = "/api";
            } else if (process.env?.NODE_ENV !== "production") {
                // Development fallback with explicit warning
                endpoint = "http://localhost:3000/api";
                console.warn(
                    "[Halo] No endpoint specified. Defaulting to 'http://localhost:3000/api' for local development. In production, pass 'endpoint' to Halo options or set HALO_ENDPOINT."
                );
            } else {
                throw new Error(
                    "[Halo] 'endpoint' is required when initializing Halo in a production server/runtime environment. Please provide options.endpoint or set HALO_ENDPOINT."
                );
            }
        }

        endpoint = endpoint.replace(/\/$/, "");

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
                    const res = await this.client.post(
                        "/ingest/events",
                        event,
                    );
                    if (res && typeof res === "object") {
                        const parsed = res as { eventId?: string; issueId?: string };
                        this.onEventIngested?.(parsed);

                        // If Replay SDK is active on the window, sync the issueId
                        if (typeof window !== "undefined" && parsed.issueId) {
                            try {
                                (window as any).__HALO_REPLAY__?.setIssueId(parsed.issueId);
                            } catch {
                                // ignore
                            }
                        }
                    }
                    return res;
                },
            );

        this.enabled =
            options.enabled ?? true;

        this.service =
            options.service;

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

        // Sync with browser global session if present, or generate default session for browser
        const globalSessionId = typeof window !== "undefined" ? (window as any).__HALO_SESSION_ID__ : undefined;
        this.sessionId = options.sessionId || globalSessionId || (typeof window !== "undefined" ? createSessionId() : undefined);

        if (this.sessionId) {
            this.sessionStartedAt =
                new Date().toISOString();

            if (typeof window !== "undefined") {
                (window as any).__HALO_SESSION_ID__ = this.sessionId;
                (window as any).__HALO_SDK__ = this;
            }
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

        if (typeof window !== "undefined") {
            (window as any).__HALO_SESSION_ID__ = this.sessionId;
            (window as any).__HALO_SDK__ = this;
        }

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

    /**
     * Register a callback that is invoked whenever an event is ingested by the Halo backend.
     */
    onEventIngestedCallback(
        callback: (result: {
            eventId?: string;
            issueId?: string;
        }) => void,
    ) {
        this.onEventIngested = callback;
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

        // If Replay SDK is running on the client, trigger error replay recording with trace & request context
        if (typeof window !== "undefined" && (window as any).__HALO_REPLAY__) {
            try {
                (window as any).__HALO_REPLAY__.triggerErrorReplay({
                    title: exception.message || exception.name,
                    stack: exception.stack,
                    traceId: context?.traceId,
                    requestId: context?.requestId,
                });
            } catch {
                // ignore
            }
        }

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
                event.service ??
                this.service,

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