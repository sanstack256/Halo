import type { ReplayChunkPayload } from "./types";
import type { eventWithTime } from "@rrweb/types";

export class ReplayUploader {
    private endpoint: string;
    private apiKey?: string;
    private projectId?: string;
    private sessionId: string;
    private sequence = 0;
    private queue: eventWithTime[] = [];
    private flushTimer: any = null;
    private flushIntervalMs: number;
    private isUploading = false;
    private environment?: string;
    private issueId?: string;
    private maxQueueEvents = 10000;

    constructor(options: {
        endpoint: string;
        apiKey?: string;
        projectId?: string;
        sessionId: string;
        flushIntervalMs?: number;
        environment?: string;
        issueId?: string;
    }) {
        this.endpoint = options.endpoint.replace(/\/$/, "");
        this.apiKey = options.apiKey;
        this.projectId = options.projectId;
        this.sessionId = options.sessionId;
        this.flushIntervalMs = options.flushIntervalMs ?? 5000;
        this.environment = options.environment;
        this.issueId = options.issueId;
    }

    public setIssueId(issueId: string): void {
        this.issueId = issueId;
    }

    addEvents(events: eventWithTime[]): void {
        this.queue.push(...events);

        // Backpressure safeguard: if offline or server is unreachable, prevent unbounded memory leak
        if (this.queue.length > this.maxQueueEvents) {
            const firstSnapshot = this.queue.find((e) => e.type === 2);
            const excess = this.queue.length - this.maxQueueEvents;
            const remaining = this.queue.slice(excess);
            this.queue = firstSnapshot ? [firstSnapshot, ...remaining.filter((e) => e !== firstSnapshot)] : remaining;
        }

        this.scheduleFlush();
    }

    private scheduleFlush(): void {
        if (this.flushTimer) return;
        this.flushTimer = setTimeout(() => {
            this.flushTimer = null;
            this.flush(false);
        }, this.flushIntervalMs);
    }

    async flush(isFinal = false, extraMeta?: Record<string, any>): Promise<void> {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        if (this.queue.length === 0 && !isFinal) return;

        const eventsToUpload = [...this.queue];
        this.queue = [];

        const startedAt = eventsToUpload.length > 0
            ? new Date(eventsToUpload[0].timestamp).toISOString()
            : new Date().toISOString();

        const endedAt = eventsToUpload.length > 0
            ? new Date(eventsToUpload[eventsToUpload.length - 1].timestamp).toISOString()
            : new Date().toISOString();

        const payload: ReplayChunkPayload = {
            sessionId: this.sessionId,
            sequence: this.sequence++,
            events: eventsToUpload,
            startedAt,
            endedAt,
            meta: {
                projectId: this.projectId,
                browser: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
                os: typeof navigator !== "undefined" ? navigator.platform : undefined,
                url: typeof window !== "undefined" ? window.location.href : undefined,
                userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
                viewportWidth: typeof window !== "undefined" ? window.innerWidth : undefined,
                viewportHeight: typeof window !== "undefined" ? window.innerHeight : undefined,
                issueId: this.issueId,
                ...extraMeta,
            },
            final: isFinal,
        };

        const targetUrl = `${this.endpoint}/ingest/replay`;

        try {
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (this.apiKey) {
                headers["Authorization"] = `Bearer ${this.apiKey}`;
            }

            const bodyStr = JSON.stringify(payload);

            /*
             * Modern browsers support keepalive: true on fetch()
             * which persists across page unloads while preserving
             * the Authorization header (unlike navigator.sendBeacon).
             */
            const res = await fetch(targetUrl, {
                method: "POST",
                headers,
                body: bodyStr,
                keepalive: isFinal,
            });

            if (!res.ok && res.status >= 500 && !isFinal) {
                // Re-queue on 5xx server errors
                this.queue.unshift(...eventsToUpload);
                this.sequence--;
            }
        } catch (err) {
            console.error("[Halo Replay] Failed to upload chunk:", err);
            // Re-queue events on network failure if not final
            if (!isFinal) {
                this.queue.unshift(...eventsToUpload);
                this.sequence--;
            }
        }
    }
}

