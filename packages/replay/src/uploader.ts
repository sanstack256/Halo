import type { ReplayChunkPayload } from "./types";
import type { eventWithTime } from "@rrweb/types";
import { sanitizeUrl } from "./masker";

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
    private sessionMeta: Record<string, any> = {};

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

    public setSessionMeta(meta: Record<string, any>): void {
        this.sessionMeta = { ...this.sessionMeta, ...meta };
    }

    public getSequence(): number {
        return this.sequence;
    }

    addEvents(events: eventWithTime[]): void {
        if (!events || events.length === 0) return;
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

        // Evidence-triggered invariant: Never upload or create a session if no events were ever queued
        if (this.queue.length === 0 && (!isFinal || this.sequence === 0)) return;

        if (extraMeta) {
            this.sessionMeta = { ...this.sessionMeta, ...extraMeta };
        }

        const eventsToUpload = [...this.queue];
        this.queue = [];

        const startedAt = eventsToUpload.length > 0
            ? new Date(eventsToUpload[0].timestamp).toISOString()
            : new Date().toISOString();

        const endedAt = eventsToUpload.length > 0
            ? new Date(eventsToUpload[eventsToUpload.length - 1].timestamp).toISOString()
            : new Date().toISOString();

        const rawUserAgent = typeof navigator !== "undefined" ? navigator.userAgent : undefined;
        const rawPlatform = typeof navigator !== "undefined" ? navigator.platform : undefined;

        const payload: ReplayChunkPayload = {
            sessionId: this.sessionId,
            sequence: this.sequence++,
            events: eventsToUpload,
            startedAt,
            endedAt,
            meta: {
                projectId: this.projectId,
                browser: getCleanBrowser(rawUserAgent),
                os: getCleanOs(rawPlatform, rawUserAgent),
                url: typeof window !== "undefined" ? sanitizeUrl(window.location.href) : undefined,
                userAgent: rawUserAgent,
                viewportWidth: typeof window !== "undefined" ? window.innerWidth : undefined,
                viewportHeight: typeof window !== "undefined" ? window.innerHeight : undefined,
                issueId: this.issueId,
                ...this.sessionMeta,
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

function getCleanBrowser(ua?: string): string | undefined {
    if (!ua) return undefined;
    if (/HeadlessChrome/i.test(ua)) return "Headless Chrome";
    if (/Edg(?:e)?\//i.test(ua)) return "Edge";
    if (/OPR\/|Opera/i.test(ua)) return "Opera";
    if (/Chrome\/|CriOS\//i.test(ua)) return "Chrome";
    if (/Firefox\/|FxiOS\//i.test(ua)) return "Firefox";
    if (/Safari\//i.test(ua) && !/Chrome|CriOS/i.test(ua)) return "Safari";
    return "Browser";
}

function getCleanOs(platform?: string, ua?: string): string | undefined {
    const combined = `${platform || ""} ${ua || ""}`;
    if (/iPhone|iPad|iPod/i.test(combined)) return "iOS";
    if (/Macintosh|Mac OS X|MacIntel|macOS|Darwin/i.test(combined)) return "macOS";
    if (/Windows|Win32|Win64/i.test(combined)) return "Windows";
    if (/Android/i.test(combined)) return "Android";
    if (/Linux|X11/i.test(combined)) return "Linux";
    return platform || undefined;
}

