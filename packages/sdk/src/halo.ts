import { HaloClient } from "./client";
import { registerGlobalHandlers } from "./capture";
import { EventQueue } from "./queue";

import type {
    HaloBreadcrumb,
    HaloCaptureOptions,
    HaloOptions,
    HaloTagValue,
    HaloUser,
} from "./types";

const SDK_NAME = "@halo/sdk";
const SDK_VERSION = "0.1.0";

export class Halo {
    private client: HaloClient;

    private enabled: boolean;

    private release?: string;

    private environment?: string;

    private user?: HaloUser;

    private queue: EventQueue;

    private tags: Record<string, HaloTagValue> = {};

    private breadcrumbs: HaloBreadcrumb[] = [];

    constructor(options: HaloOptions) {
        this.client = new HaloClient(
            options.endpoint ??
            "http://localhost:3000/api",
            options.apiKey
        );

        this.queue = new EventQueue(async (event: unknown) => {
            await this.client.post(
                "/ingest/events",
                event
            );
        });

        this.enabled = options.enabled ?? true;

        this.release = options.release;

        this.environment = options.environment;

        if (options.autoCapture) {
            registerGlobalHandlers(this);
        }
    }

    setUser(user: HaloUser) {
        this.user = user;
    }

    clearUser() {
        this.user = undefined;
    }

    setTag(
        key: string,
        value: HaloTagValue
    ) {
        this.tags[key] = value;
    }

    removeTag(key: string) {
        delete this.tags[key];
    }

    addBreadcrumb(
        breadcrumb: HaloBreadcrumb
    ) {
        this.breadcrumbs.push({
            ...breadcrumb,
            timestamp:
                breadcrumb.timestamp ??
                new Date().toISOString(),
        });

        if (this.breadcrumbs.length > 100) {
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
        message: string
    ) {
        return this.capture({
            type: "MESSAGE",

            title: message,

            message,

            severity: "INFO",
        });
    }

    async captureException(
        error: unknown
    ) {
        const exception =
            error instanceof Error
                ? error
                : new Error(String(error));

        return this.capture({
            type: "ERROR",

            title: exception.name,
            message: exception.message,
            severity: "ERROR",
            stack: exception.stack,
        });
    }

    async capture(
        event: HaloCaptureOptions
    ) {
        if (!this.enabled) {
            return;
        }

        return this.queue.enqueue({
            type: event.type,

            title: event.title,

            message: event.message,

            severity:
                event.severity ??
                "INFO",

            timestamp:
                new Date().toISOString(),

            stack: event.stack,

            fingerprint:
                event.fingerprint,

            metadata:
                event.metadata,

            tags: {
                ...this.tags,
                ...(event.tags ?? {}),
            },

            breadcrumbs: [
                ...this.breadcrumbs,
                ...(event.breadcrumbs ?? []),
            ],

            user:
                event.user ??
                this.user,

            sdkName: SDK_NAME,

            sdkVersion: SDK_VERSION,

            release: this.release,

            environment: this.environment,

            service: event.service,
            resource: event.resource,
            operation: event.operation,
            status: event.status,
            durationMs: event.durationMs,
        });
    }
}