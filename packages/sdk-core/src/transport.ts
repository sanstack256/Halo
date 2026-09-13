import type { HaloEnvelope } from "@halo-trace/sdk-types";

export interface TransportOptions {
    endpoint: string;
    apiKey: string;
    batchSize?: number;
    flushIntervalMs?: number;
    maxQueueSize?: number;
    maxRetries?: number;
    timeoutMs?: number;
    onSuccess?: (result: any) => void;
    onError?: (err: Error) => void;
}

export class BaseTransport {
    private endpoint: string;
    private apiKey: string;
    private batchSize: number;
    private flushIntervalMs: number;
    private maxQueueSize: number;
    private maxRetries: number;
    private timeoutMs: number;
    private queue: HaloEnvelope[] = [];
    private timer: any = null;
    private isFlushing: boolean = false;
    private isClosed: boolean = false;

    constructor(options: TransportOptions) {
        this.endpoint = options.endpoint.replace(/\/$/, "");
        this.apiKey = options.apiKey;
        this.batchSize = Math.max(1, options.batchSize || 30);
        this.flushIntervalMs = Math.max(100, options.flushIntervalMs || 2000);
        this.maxQueueSize = Math.max(10, options.maxQueueSize || 500);
        this.maxRetries = options.maxRetries ?? 3;
        this.timeoutMs = options.timeoutMs || 10000;

        this.startTimer();
    }

    public send(event: HaloEnvelope): void {
        if (this.isClosed) return;

        if (this.queue.length >= this.maxQueueSize) {
            // Evict oldest non-error event if possible, or oldest event
            const nonErrIdx = this.queue.findIndex((e) => e.eventType !== "ERROR");
            if (nonErrIdx >= 0) {
                this.queue.splice(nonErrIdx, 1);
            } else {
                this.queue.shift();
            }
        }

        this.queue.push(event);

        if (this.queue.length >= this.batchSize || event.eventType === "ERROR") {
            void this.flush();
        }
    }

    public async flush(): Promise<void> {
        if (this.isFlushing || this.queue.length === 0) return;
        this.isFlushing = true;

        const batch = this.queue.splice(0, this.batchSize);

        try {
            await this.postBatchWithRetry(batch);
        } catch (err: any) {
            // Failure isolation: Put back items if not closed, but bound
            if (!this.isClosed) {
                const space = this.maxQueueSize - this.queue.length;
                if (space > 0) {
                    this.queue.unshift(...batch.slice(0, space));
                }
            }
        } finally {
            this.isFlushing = false;
        }
    }

    private async postBatchWithRetry(batch: HaloEnvelope[]): Promise<any> {
        let attempt = 0;
        let delay = 300;

        while (attempt <= this.maxRetries) {
            try {
                const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
                const timer = controller ? setTimeout(() => controller.abort(), this.timeoutMs) : null;

                const url = `${this.endpoint}/ingest/events`;
                const payload = batch.length === 1 ? batch[0] : { events: batch };

                const res = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    body: JSON.stringify(payload),
                    signal: controller ? controller.signal : undefined,
                });

                if (timer) clearTimeout(timer);

                if (!res.ok) {
                    if (res.status === 401 || res.status === 403 || res.status === 400) {
                        // Unrecoverable authorization or client schema error, do not retry
                        const txt = await res.text().catch(() => "");
                        throw new Error(`Ingest HTTP ${res.status}: ${txt}`);
                    }
                    throw new Error(`Ingest HTTP ${res.status}`);
                }

                return await res.json().catch(() => ({}));
            } catch (err: any) {
                attempt++;
                if (attempt > this.maxRetries || err.message?.includes("HTTP 401") || err.message?.includes("HTTP 403")) {
                    throw err;
                }
                // Exponential backoff with jitter
                const jitter = Math.random() * 200;
                await new Promise((r) => setTimeout(r, delay + jitter));
                delay *= 2;
            }
        }
    }

    public flushImmediate(beaconPreferred: boolean = false): void {
        if (this.queue.length === 0) return;
        const batch = this.queue.splice(0, this.queue.length);
        const url = `${this.endpoint}/ingest/events`;
        const payload = batch.length === 1 ? batch[0] : { events: batch };
        const data = JSON.stringify(payload);

        if (beaconPreferred && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
            try {
                const blob = new Blob([data], { type: "application/json" });
                // Note: sendBeacon doesn't allow custom Authorization header, so use fetch with keepalive if possible
            } catch {
                // fallback
            }
        }

        if (typeof fetch === "function") {
            try {
                void fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${this.apiKey}`,
                    },
                    body: data,
                    keepalive: true,
                }).catch(() => {});
            } catch {
                // ignore
            }
        }
    }

    public close(): void {
        this.isClosed = true;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.flushImmediate();
    }

    private startTimer(): void {
        if (typeof setInterval === "function") {
            this.timer = setInterval(() => {
                void this.flush();
            }, this.flushIntervalMs);
            if (this.timer && typeof this.timer.unref === "function") {
                this.timer.unref(); // Avoid keeping Node process alive
            }
        }
    }
}
