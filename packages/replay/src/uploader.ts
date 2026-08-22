import type { ReplayChunkPayload } from "./types";
import type { eventWithTime } from "@rrweb/types";

export class ReplayUploader {
    private endpoint: string;
    private apiKey?: string;
    private sessionId: string;
    private sequence = 0;
    private queue: eventWithTime[] = [];
    private flushTimer: any = null;
    private flushIntervalMs: number;
    private isUploading = false;
    private environment?: string;

    constructor(options: {
        endpoint: string;
        apiKey?: string;
        sessionId: string;
        flushIntervalMs?: number;
        environment?: string;
    }) {
        this.endpoint = options.endpoint.replace(/\/$/, "");
        this.apiKey = options.apiKey;
        this.sessionId = options.sessionId;
        this.flushIntervalMs = options.flushIntervalMs ?? 5000;
        this.environment = options.environment;
    }

    addEvents(events: eventWithTime[]): void {
        this.queue.push(...events);
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
                browser: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
                os: typeof navigator !== "undefined" ? navigator.platform : undefined,
                url: typeof window !== "undefined" ? window.location.href : undefined,
                userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
                viewportWidth: typeof window !== "undefined" ? window.innerWidth : undefined,
                viewportHeight: typeof window !== "undefined" ? window.innerHeight : undefined,
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

            if (isFinal && typeof navigator !== "undefined" && navigator.sendBeacon) {
                const blob = new Blob([bodyStr], { type: "application/json" });
                navigator.sendBeacon(targetUrl, blob);
            } else {
                await fetch(targetUrl, {
                    method: "POST",
                    headers,
                    body: bodyStr,
                    keepalive: isFinal,
                });
            }
        } catch (err) {
            console.error("[Halo Replay] Failed to upload chunk:", err);
            // Re-queue events on failure if not final
            if (!isFinal) {
                this.queue.unshift(...eventsToUpload);
                this.sequence--;
            }
        }
    }
}
