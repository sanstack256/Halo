import { record } from "rrweb";
import type { eventWithTime } from "@rrweb/types";
import { buildMaskerConfig, isUrlIgnored } from "./masker";
import { ReplayRingBuffer } from "./ring-buffer";
import { ReplayUploader } from "./uploader";
import type { HaloReplayOptions } from "./types";

export class HaloReplay {
    private options: HaloReplayOptions;
    private stopFn: (() => void) | null = null;
    private ringBuffer: ReplayRingBuffer;
    private uploader: ReplayUploader;
    private isSampled = false;
    private isStreaming = false;
    private isErrorTriggered = false;
    private postErrorTimeout: any = null;
    private maxSessionTimeout: any = null;
    private sessionId: string;
    private startedAt: number;

    constructor(options: HaloReplayOptions = {}) {
        this.options = {
            endpoint: options.endpoint || "/api",
            samplingRate: options.samplingRate ?? 1.0,
            errorTriggered: options.errorTriggered ?? true,
            preErrorBufferSeconds: options.preErrorBufferSeconds ?? 60,
            postErrorDurationSeconds: options.postErrorDurationSeconds ?? 30,
            maxSessionDurationMinutes: options.maxSessionDurationMinutes ?? 60,
            flushIntervalMs: options.flushIntervalMs ?? 5000,
            ...options,
        };

        this.sessionId = options.sessionId || this.generateSessionId();
        this.startedAt = Date.now();
        this.ringBuffer = new ReplayRingBuffer(this.options.preErrorBufferSeconds);
        this.uploader = new ReplayUploader({
            endpoint: this.options.endpoint!,
            apiKey: this.options.apiKey,
            sessionId: this.sessionId,
            flushIntervalMs: this.options.flushIntervalMs,
            environment: this.options.environment,
        });

        // Determine if this session is randomly sampled
        this.isSampled = Math.random() < (this.options.samplingRate ?? 1.0);
    }

    private generateSessionId(): string {
        return `hr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    public getSessionId(): string {
        return this.sessionId;
    }

    public start(): void {
        if (typeof window === "undefined" || typeof document === "undefined") {
            return;
        }

        if (isUrlIgnored(window.location.href, this.options.privacy?.ignoreUrls)) {
            return;
        }

        const maskerConfig = buildMaskerConfig(this.options.privacy);

        try {
            this.stopFn = record({
                emit: (event: eventWithTime) => {
                    this.handleEvent(event);
                },
                maskAllInputs: maskerConfig.maskAllInputs,
                maskInputOptions: maskerConfig.maskInputOptions,
                maskTextFn: maskerConfig.maskTextFn,
                maskInputFn: maskerConfig.maskInputFn,
                blockSelector: maskerConfig.blockSelector,
                maskTextSelector: maskerConfig.maskTextSelector,
                ignoreSelector: maskerConfig.ignoreSelector,
                recordCanvas: false,
                inlineImages: false,
                collectFonts: false,
            }) || null;

            // Cap maximum session duration
            const maxDurationMs = (this.options.maxSessionDurationMinutes ?? 60) * 60 * 1000;
            this.maxSessionTimeout = setTimeout(() => {
                this.stop();
            }, maxDurationMs);

            // Hook global error handlers for error-triggered capture
            if (this.options.errorTriggered) {
                this.setupErrorListeners();
            }

            // Hook page unload to finalize upload
            if (typeof window !== "undefined") {
                window.addEventListener("beforeunload", () => {
                    this.flushAndConclude();
                });
            }
        } catch (err) {
            console.error("[Halo Replay] Failed to start recording:", err);
        }
    }

    private handleEvent(event: eventWithTime): void {
        if (this.isStreaming || this.isSampled) {
            // Actively streaming session chunks
            this.uploader.addEvents([event]);
        } else {
            // In error-triggered mode: keep in ring buffer until an error occurs
            this.ringBuffer.add(event);
        }
    }

    private setupErrorListeners(): void {
        if (typeof window === "undefined") return;

        window.addEventListener("error", (e) => {
            this.triggerErrorReplay({
                title: e.message || "Unhandled Error",
                stack: e.error?.stack,
            });
        });

        window.addEventListener("unhandledrejection", (e) => {
            const reason = e.reason;
            this.triggerErrorReplay({
                title: typeof reason === "string" ? reason : reason?.message || "Unhandled Promise Rejection",
                stack: reason?.stack,
            });
        });
    }

    /**
     * Call when an error is captured (e.g. from Halo.captureException).
     */
    public triggerErrorReplay(errorMeta?: { title?: string; stack?: string; issueId?: string; traceId?: string }): void {
        if (this.isErrorTriggered) return;
        this.isErrorTriggered = true;

        // Flush all pre-error events from ring buffer into uploader
        const preErrorEvents = this.ringBuffer.flush();
        this.uploader.addEvents(preErrorEvents);
        this.isStreaming = true;

        // Immediate flush with error metadata
        this.uploader.flush(false, {
            errorAt: new Date().toISOString(),
            ...errorMeta,
        });

        // Continue recording for postErrorDurationSeconds then finalize
        const postDurationMs = (this.options.postErrorDurationSeconds ?? 30) * 1000;
        this.postErrorTimeout = setTimeout(() => {
            this.flushAndConclude();
        }, postDurationMs);
    }

    public flushAndConclude(): void {
        this.uploader.flush(true);
    }

    public stop(): void {
        if (this.stopFn) {
            this.stopFn();
            this.stopFn = null;
        }
        if (this.postErrorTimeout) clearTimeout(this.postErrorTimeout);
        if (this.maxSessionTimeout) clearTimeout(this.maxSessionTimeout);
        this.flushAndConclude();
    }
}
