import { record } from "rrweb";
import type { eventWithTime } from "@rrweb/types";
import { buildMaskerConfig, isUrlIgnored, sanitizeUrl } from "./masker";
import { ReplayRingBuffer } from "./ring-buffer";
import { ReplayUploader } from "./uploader";
import type { HaloReplayOptions, ReplayNavigationPayload, ReplayRequestPayload, ReplayConsolePayload } from "./types";

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
    private originalPushState: any = null;
    private originalReplaceState: any = null;
    private originalFetch: any = null;
    private originalConsoleError: any = null;
    private currentUrl: string = "";
    private recordedEvents: eventWithTime[] = [];

    constructor(options: HaloReplayOptions = {}) {
        this.options = {
            endpoint: options.endpoint || "/api",
            samplingRate: options.samplingRate ?? 1.0,
            errorTriggered: options.errorTriggered ?? true,
            preErrorBufferSeconds: options.preErrorBufferSeconds ?? 60,
            maxBufferEvents: options.maxBufferEvents ?? 5000,
            postErrorDurationSeconds: options.postErrorDurationSeconds ?? 30,
            maxSessionDurationMinutes: options.maxSessionDurationMinutes ?? 60,
            flushIntervalMs: options.flushIntervalMs ?? 5000,
            captureNavigation: options.captureNavigation ?? true,
            captureNetwork: options.captureNetwork ?? true,
            captureConsole: options.captureConsole ?? true,
            ...options,
        };

        // Canonical session identity resolution:
        // 1. Explicit options.sessionId
        // 2. Browser sessionStorage (preserves session across page reloads in same tab)
        // 3. window.__HALO_SESSION_ID__ (synced with @halo-trace/sdk)
        // 4. Canonical generateSessionId()
        let canonicalId = options.sessionId;
        if (!canonicalId && typeof window !== "undefined") {
            try {
                canonicalId = window.sessionStorage?.getItem("halo_session_id") || undefined;
            } catch {}
            if (!canonicalId) {
                canonicalId = (window as any).__HALO_SESSION_ID__;
            }
        }
        if (!canonicalId) {
            canonicalId = this.generateSessionId();
        }

        this.sessionId = canonicalId;

        if (typeof window !== "undefined") {
            try {
                window.sessionStorage?.setItem("halo_session_id", this.sessionId);
            } catch {}
            (window as any).__HALO_SESSION_ID__ = this.sessionId;
            (window as any).__HALO_REPLAY__ = this;
            this.currentUrl = window.location.href;
        }

        this.startedAt = Date.now();
        this.ringBuffer = new ReplayRingBuffer(
            this.options.preErrorBufferSeconds,
            this.options.maxBufferEvents
        );
        this.uploader = new ReplayUploader({
            endpoint: this.options.endpoint!,
            apiKey: this.options.apiKey,
            projectId: this.options.projectId,
            sessionId: this.sessionId,
            flushIntervalMs: this.options.flushIntervalMs,
            environment: this.options.environment,
        });

        // Determine if this session is randomly sampled
        this.isSampled = Math.random() < (this.options.samplingRate ?? 1.0);
    }

    private generateSessionId(): string {
        return `hs_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    }

    public getSessionId(): string {
        return this.sessionId;
    }

    public getRingBuffer(): ReplayRingBuffer {
        return this.ringBuffer;
    }

    public getBufferEvents(): eventWithTime[] {
        return this.ringBuffer.getAll();
    }

    public getRecordedEvents(): eventWithTime[] {
        return [...this.recordedEvents];
    }

    public setIssueId(issueId: string): void {
        this.uploader.setIssueId(issueId);
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

            // Instrument SPA navigation
            if (this.options.captureNavigation) {
                this.setupNavigationInstrumentation();
            }

            // Instrument safe network request metadata
            if (this.options.captureNetwork) {
                this.setupNetworkInstrumentation();
            }

            // Instrument console error tracking
            if (this.options.captureConsole) {
                this.setupConsoleInstrumentation();
            }

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
        this.recordedEvents.push(event);
        if (this.recordedEvents.length > (this.options.maxBufferEvents ?? 5000)) {
            this.recordedEvents.shift();
        }

        if (this.isStreaming || (this.isSampled && !this.options.errorTriggered)) {
            // Actively streaming session chunks
            this.uploader.addEvents([event]);
        } else {
            // In error-triggered mode: keep in ring buffer until an error occurs
            this.ringBuffer.add(event);
        }
    }

    /**
     * Records a custom event into the rrweb stream and timeline
     */
    public recordCustomEvent<T = any>(tag: string, payload: T): void {
        const customEvent: eventWithTime = {
            type: 5, // Custom in rrweb
            data: {
                tag,
                payload,
            },
            timestamp: Date.now(),
        };
        this.handleEvent(customEvent);
    }

    private setupNavigationInstrumentation(): void {
        if (typeof window === "undefined" || !window.history) return;

        const notifyNavigation = (toUrl: string, type: "pushState" | "replaceState" | "popstate") => {
            const sanitized = sanitizeUrl(toUrl);
            const fromSanitized = sanitizeUrl(this.currentUrl);
            this.currentUrl = toUrl;

            this.recordCustomEvent<ReplayNavigationPayload>("halo:navigation", {
                from: fromSanitized,
                to: sanitized,
                type,
            });
        };

        this.originalPushState = window.history.pushState.bind(window.history);
        window.history.pushState = (...args: any[]) => {
            const res = this.originalPushState.apply(window.history, args);
            const targetUrl = args[2] ? String(args[2]) : window.location.href;
            notifyNavigation(targetUrl, "pushState");
            return res;
        };

        this.originalReplaceState = window.history.replaceState.bind(window.history);
        window.history.replaceState = (...args: any[]) => {
            const res = this.originalReplaceState.apply(window.history, args);
            const targetUrl = args[2] ? String(args[2]) : window.location.href;
            notifyNavigation(targetUrl, "replaceState");
            return res;
        };

        window.addEventListener("popstate", () => {
            notifyNavigation(window.location.href, "popstate");
        });
    }

    private setupNetworkInstrumentation(): void {
        if (typeof window === "undefined" || !window.fetch) return;

        this.originalFetch = window.fetch.bind(window);
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            const start = Date.now();
            const urlStr = typeof input === "string" ? input : (input instanceof URL ? input.toString() : input.url);
            const method = (init?.method || "GET").toUpperCase();

            // Ignore internal Halo ingestion calls to prevent self-referential loops
            if (urlStr.includes("/api/ingest/")) {
                return this.originalFetch(input, init);
            }

            // Extract distributed trace/request headers if present
            let traceId: string | undefined;
            let requestId: string | undefined;
            if (init?.headers) {
                const headers = init.headers;
                if (headers instanceof Headers) {
                    traceId = headers.get("x-trace-id") || headers.get("traceparent") || undefined;
                    requestId = headers.get("x-request-id") || undefined;
                } else if (typeof headers === "object") {
                    traceId = (headers as any)["x-trace-id"] || (headers as any)["traceparent"];
                    requestId = (headers as any)["x-request-id"];
                }
            }

            try {
                const response = await this.originalFetch(input, init);
                const durationMs = Date.now() - start;

                this.recordCustomEvent<ReplayRequestPayload>("halo:request", {
                    method,
                    url: sanitizeUrl(urlStr),
                    status: response.status,
                    durationMs,
                    requestId,
                    traceId,
                    failed: !response.ok,
                });

                return response;
            } catch (err: any) {
                const durationMs = Date.now() - start;
                this.recordCustomEvent<ReplayRequestPayload>("halo:request", {
                    method,
                    url: sanitizeUrl(urlStr),
                    durationMs,
                    requestId,
                    traceId,
                    failed: true,
                });
                throw err;
            }
        };
    }

    private setupConsoleInstrumentation(): void {
        if (typeof console === "undefined") return;

        this.originalConsoleError = console.error.bind(console);
        console.error = (...args: any[]) => {
            this.originalConsoleError.apply(console, args);
            const message = args
                .map((a) => (typeof a === "string" ? a : a?.message || JSON.stringify(a)))
                .join(" ");

            this.recordCustomEvent<ReplayConsolePayload>("halo:console", {
                level: "error",
                message: message.slice(0, 1000),
            });
        };
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
     * Supports multiple errors in the same session without timeline destruction.
     */
    public triggerErrorReplay(errorMeta?: { title?: string; stack?: string; issueId?: string; traceId?: string }): void {
        const errorTimestamp = new Date().toISOString();

        // Record error marker in custom events
        this.recordCustomEvent("halo:error", {
            message: errorMeta?.title || "Unhandled Exception",
            stack: errorMeta?.stack,
            issueId: errorMeta?.issueId,
            traceId: errorMeta?.traceId,
            timestamp: errorTimestamp,
        });

        if (!this.isErrorTriggered) {
            this.isErrorTriggered = true;

            // Flush all pre-error events from ring buffer into uploader
            const preErrorEvents = this.ringBuffer.flush();
            this.uploader.addEvents(preErrorEvents);
            this.isStreaming = true;
        }

        // Immediate flush with error metadata
        this.uploader.flush(false, {
            errorAt: errorTimestamp,
            ...errorMeta,
        });

        // Reset or extend post-error capture window
        if (this.postErrorTimeout) {
            clearTimeout(this.postErrorTimeout);
        }

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

        // Restore original browser hooks
        if (this.originalPushState && typeof window !== "undefined" && window.history) {
            window.history.pushState = this.originalPushState;
        }
        if (this.originalReplaceState && typeof window !== "undefined" && window.history) {
            window.history.replaceState = this.originalReplaceState;
        }
        if (this.originalFetch && typeof window !== "undefined") {
            window.fetch = this.originalFetch;
        }
        if (this.originalConsoleError && typeof console !== "undefined") {
            console.error = this.originalConsoleError;
        }

        this.flushAndConclude();
    }
}

