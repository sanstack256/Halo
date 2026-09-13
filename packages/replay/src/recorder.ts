import { record } from "rrweb";
import type { eventWithTime } from "@rrweb/types";
import { buildMaskerConfig, isUrlIgnored, sanitizeUrl } from "./masker";
import { ReplayRingBuffer } from "./ring-buffer";
import { ReplayUploader } from "./uploader";
import type {
    HaloReplayOptions,
    ReplayNavigationPayload,
    ReplayRequestPayload,
    ReplayConsolePayload,
    ReplayRageClickPayload,
    ReplayDeadClickPayload,
    ReplayLifecyclePayload,
} from "./types";

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

    // Frustration signals & lifecycle instrumentation
    private recentClicks: Array<{ time: number; x: number; y: number; selector: string }> = [];
    private lastRageEmitTime: number = 0;
    private pendingDeadClicks: Map<number, { timer: any; selector: string; x: number; y: number }> = new Map();
    private deadClickIdCounter: number = 0;
    private hasRageClicks: boolean = false;
    private hasDeadClicks: boolean = false;
    private rageClickCount: number = 0;
    private deadClickCount: number = 0;
    private clickListener: ((e: MouseEvent) => void) | null = null;
    private visibilityListener: (() => void) | null = null;
    private pagehideListener: ((e: PageTransitionEvent) => void) | null = null;
    private beforeunloadListener: (() => void) | null = null;

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
            detectRageClicks: options.detectRageClicks ?? true,
            rageClickThreshold: options.rageClickThreshold ?? 3,
            detectDeadClicks: options.detectDeadClicks ?? true,
            deadClickTimeoutMs: options.deadClickTimeoutMs ?? 2500,
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

    public getHasRageClicks(): boolean {
        return this.hasRageClicks;
    }

    public getHasDeadClicks(): boolean {
        return this.hasDeadClicks;
    }

    public getRageClickCount(): number {
        return this.rageClickCount;
    }

    public getDeadClickCount(): number {
        return this.deadClickCount;
    }

    public setIssueId(issueId: string): void {
        this.uploader.setIssueId(issueId);
    }

    public start(): void {
        if (typeof window === "undefined" || typeof document === "undefined") {
            return;
        }

        // Loop Prevention: Do not record inside Halo Replay viewer to prevent recursive capture
        if (
            (window as any).__HALO_REPLAY_VIEWER_ACTIVE__ ||
            document.querySelector("[data-halo-replay-player]") ||
            /(\/projects\/[^/]+\/replays\/[^/]+)/.test(window.location.pathname)
        ) {
            console.warn("[Halo Replay] Recording disabled inside Halo Replay viewer to prevent recursive capture.");
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

            // Instrument frustration signals (rage clicks & dead clicks)
            if (this.options.detectRageClicks !== false || this.options.detectDeadClicks !== false) {
                this.setupFrustrationInstrumentation();
            }

            // Instrument page lifecycle events
            this.setupLifecycleInstrumentation();

            // Cap maximum session duration
            const maxDurationMs = (this.options.maxSessionDurationMinutes ?? 60) * 60 * 1000;
            this.maxSessionTimeout = setTimeout(() => {
                this.stop();
            }, maxDurationMs);

            // Hook global error handlers for error-triggered capture
            if (this.options.errorTriggered) {
                this.setupErrorListeners();
            }
        } catch (err) {
            console.error("[Halo Replay] Failed to start recording:", err);
        }
    }

    private notifyMutationOrEffect(): void {
        if (this.pendingDeadClicks.size === 0) return;
        for (const [id, item] of this.pendingDeadClicks.entries()) {
            clearTimeout(item.timer);
            this.pendingDeadClicks.delete(id);
        }
    }

    private handleEvent(event: eventWithTime): void {
        this.recordedEvents.push(event);
        if (this.recordedEvents.length > (this.options.maxBufferEvents ?? 5000)) {
            this.recordedEvents.shift();
        }

        // Only genuine DOM mutations (source 0), form inputs (source 5), or navigation/requests resolve pending dead clicks.
        // Mouse moves (source 1) and pointer clicks/ups/downs (source 2) do NOT cancel dead clicks.
        if (event.type === 3) {
            const src = (event.data as any)?.source;
            if (src === 0 || src === 5) {
                this.notifyMutationOrEffect();
            }
        } else if (
            event.type === 5 &&
            (event.data as any)?.tag !== "halo:dead-click" &&
            (event.data as any)?.tag !== "halo:rage-click" &&
            (event.data as any)?.tag !== "halo:lifecycle"
        ) {
            this.notifyMutationOrEffect();
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

        // Immediate flush with error and frustration metadata
        this.uploader.flush(false, {
            errorAt: errorTimestamp,
            hasRageClicks: this.hasRageClicks,
            hasDeadClicks: this.hasDeadClicks,
            rageClickCount: this.rageClickCount,
            deadClickCount: this.deadClickCount,
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
        this.uploader.flush(true, {
            hasRageClicks: this.hasRageClicks,
            hasDeadClicks: this.hasDeadClicks,
            rageClickCount: this.rageClickCount,
            deadClickCount: this.deadClickCount,
        });
    }

    private setupFrustrationInstrumentation(): void {
        if (typeof window === "undefined" || typeof document === "undefined") return;

        this.clickListener = (e: MouseEvent) => {
            const now = Date.now();
            const x = e.clientX;
            const y = e.clientY;
            const target = e.target as HTMLElement | null;
            const targetSelector = getElementSelector(target);

            // 1. Rage Click Detection
            if (this.options.detectRageClicks !== false) {
                // Keep clicks within 1000ms window
                this.recentClicks = this.recentClicks.filter((c) => now - c.time <= 1000);
                this.recentClicks.push({ time: now, x, y, selector: targetSelector });

                const threshold = this.options.rageClickThreshold ?? 3;
                // Cluster clicks by proximity (<= 35px radius) or same target selector
                const cluster = this.recentClicks.filter(
                    (c) => c.selector === targetSelector || Math.hypot(c.x - x, c.y - y) <= 35
                );

                if (cluster.length >= threshold && now - this.lastRageEmitTime > 1000) {
                    this.lastRageEmitTime = now;
                    this.hasRageClicks = true;
                    this.rageClickCount++;

                    this.recordCustomEvent<ReplayRageClickPayload>("halo:rage-click", {
                        count: cluster.length,
                        targetSelector,
                        x,
                        y,
                        durationMs: now - cluster[0].time,
                        windowStartMs: cluster[0].time,
                        windowEndMs: now,
                    });
                }
            }

            // 2. Dead Click Detection
            if (this.options.detectDeadClicks !== false && target && target instanceof HTMLElement) {
                const isActionable =
                    target.matches(
                        "button, button *, a, a *, input, select, textarea, [role='button'], [role='tab'], [role='menuitem'], [onclick], .btn, .button"
                    ) ||
                    (typeof window.getComputedStyle === "function" &&
                        window.getComputedStyle(target).cursor === "pointer");

                if (isActionable) {
                    const clickId = ++this.deadClickIdCounter;
                    const timeoutMs = this.options.deadClickTimeoutMs ?? 2500;

                    const timer = setTimeout(() => {
                        if (this.pendingDeadClicks.has(clickId)) {
                            this.pendingDeadClicks.delete(clickId);
                            this.hasDeadClicks = true;
                            this.deadClickCount++;

                            this.recordCustomEvent<ReplayDeadClickPayload>("halo:dead-click", {
                                targetSelector,
                                x,
                                y,
                                inactiveDurationMs: timeoutMs,
                            });
                        }
                    }, timeoutMs);

                    this.pendingDeadClicks.set(clickId, { timer, selector: targetSelector, x, y });
                }
            }
        };

        window.addEventListener("click", this.clickListener, { capture: true, passive: true });
    }

    private setupLifecycleInstrumentation(): void {
        if (typeof window === "undefined" || typeof document === "undefined") return;

        this.visibilityListener = () => {
            const state = document.visibilityState;
            this.recordCustomEvent<ReplayLifecyclePayload>("halo:lifecycle", {
                event: "visibilitychange",
                state,
            });
            if (state === "hidden") {
                this.uploader.flush(false, {
                    hasRageClicks: this.hasRageClicks,
                    hasDeadClicks: this.hasDeadClicks,
                    rageClickCount: this.rageClickCount,
                    deadClickCount: this.deadClickCount,
                });
            }
        };
        document.addEventListener("visibilitychange", this.visibilityListener);

        this.pagehideListener = (e: PageTransitionEvent) => {
            this.recordCustomEvent<ReplayLifecyclePayload>("halo:lifecycle", {
                event: "pagehide",
                state: e.persisted ? "persisted" : "terminated",
            });
            this.flushAndConclude();
        };
        window.addEventListener("pagehide", this.pagehideListener);

        this.beforeunloadListener = () => {
            this.recordCustomEvent<ReplayLifecyclePayload>("halo:lifecycle", {
                event: "beforeunload",
            });
            this.flushAndConclude();
        };
        window.addEventListener("beforeunload", this.beforeunloadListener);
    }

    public stop(): void {
        if (this.stopFn) {
            this.stopFn();
            this.stopFn = null;
        }
        if (this.postErrorTimeout) clearTimeout(this.postErrorTimeout);
        if (this.maxSessionTimeout) clearTimeout(this.maxSessionTimeout);

        // Remove listeners
        if (this.clickListener && typeof window !== "undefined") {
            window.removeEventListener("click", this.clickListener, { capture: true });
            this.clickListener = null;
        }
        if (this.visibilityListener && typeof document !== "undefined") {
            document.removeEventListener("visibilitychange", this.visibilityListener);
            this.visibilityListener = null;
        }
        if (this.pagehideListener && typeof window !== "undefined") {
            window.removeEventListener("pagehide", this.pagehideListener);
            this.pagehideListener = null;
        }
        if (this.beforeunloadListener && typeof window !== "undefined") {
            window.removeEventListener("beforeunload", this.beforeunloadListener);
            this.beforeunloadListener = null;
        }
        for (const [id, item] of this.pendingDeadClicks.entries()) {
            clearTimeout(item.timer);
        }
        this.pendingDeadClicks.clear();

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

function getElementSelector(el: HTMLElement | null): string {
    if (!el || !(el instanceof HTMLElement)) return "unknown";
    if (el.id) return `#${el.id}`;
    let selector = el.tagName.toLowerCase();
    if (el.className && typeof el.className === "string") {
        const firstClass = el.className.trim().split(/\s+/)[0];
        if (firstClass && !firstClass.includes(":") && !firstClass.includes("/") && !firstClass.includes("[")) {
            selector += `.${firstClass}`;
        }
    }
    const name = el.getAttribute("name");
    if (name) {
        selector += `[name="${name}"]`;
    }
    return selector;
}

