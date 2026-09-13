import { record } from "rrweb";
import type { eventWithTime } from "@rrweb/types";
import { buildMaskerConfig, isUrlIgnored, sanitizeUrl } from "./masker";
import { ReplayRingBuffer } from "./ring-buffer";
import { ReplayUploader } from "./uploader";
import { HaloFeedbackWidget } from "./feedback-widget";
import type {
    HaloReplayOptions,
    FeedbackModalOptions,
    ReplayNavigationPayload,
    ReplayRequestPayload,
    ReplayConsolePayload,
    ReplayRageClickPayload,
    ReplayDeadClickPayload,
    ReplayLifecyclePayload,
    ReplayCaptureState,
    ReplayTriggerType,
} from "./types";

export class HaloReplay {
    private options: HaloReplayOptions;
    private stopFn: (() => void) | null = null;
    private ringBuffer: ReplayRingBuffer;
    private uploader: ReplayUploader;
    private captureState: ReplayCaptureState = "DISABLED";
    private triggerType: ReplayTriggerType | null = null;
    private captureReason: string | null = null;
    private triggerTimestamp: string | null = null;
    private sampleRate: number = 0;
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
    private originalConsoleLog: any = null;
    private originalConsoleInfo: any = null;
    private originalConsoleWarn: any = null;
    private originalConsoleError: any = null;
    private currentUser: any = null;
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
        const errorTriggered = options.errorTriggered ?? true;
        // Evidence-triggered architecture:
        // When errorTriggered is true, normal sessions default to sampleRate 0.0 (only investigation triggers persist).
        // If errorTriggered is explicitly false, sampling rate defaults to 1.0 (continuous recording).
        const rawRate = options.sampleRate ?? options.samplingRate ?? (errorTriggered ? 0.0 : 1.0);
        let validatedRate = 0.0;
        if (typeof rawRate === "number" && !isNaN(rawRate) && isFinite(rawRate)) {
            validatedRate = Math.max(0, Math.min(1, rawRate));
        }
        this.sampleRate = validatedRate;
        this.isSampled = this.sampleRate > 0 && Math.random() < this.sampleRate;

        this.options = {
            endpoint: options.endpoint || "/api",
            samplingRate: this.sampleRate,
            sampleRate: this.sampleRate,
            errorTriggered,
            triggerOnFrustration: options.triggerOnFrustration ?? true,
            triggerOnNetworkError: options.triggerOnNetworkError ?? true,
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

        this.currentUser = this.options.user || null;
    }

    public setUser(user: { id?: string; email?: string; username?: string; [key: string]: any } | null): void {
        this.currentUser = user;
        if (typeof window !== "undefined" && user) {
            (window as any).__HALO_USER__ = user;
        }
        if (this.options.shouldCapture && typeof window !== "undefined") {
            const shouldCapture = this.options.shouldCapture({
                url: window.location.href,
                user: this.currentUser,
            });
            if (!shouldCapture && this.stopFn) {
                this.stop();
            }
        }
    }

    public getUser(): any {
        return this.currentUser;
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

    public async submitFeedback(feedback: { name?: string; email?: string; comments: string }): Promise<any> {
        if (!feedback.comments || !feedback.comments.trim()) {
            throw new Error("Feedback comments are required");
        }

        const endpoint = (this.options.endpoint || "/api").replace(/\/$/, "");
        const res = await fetch(`${endpoint}/feedback`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(this.options.apiKey ? { "Authorization": `Bearer ${this.options.apiKey}` } : {}),
            },
            body: JSON.stringify({
                projectId: this.options.projectId,
                replaySessionId: this.sessionId,
                name: feedback.name,
                email: feedback.email,
                comments: feedback.comments,
                url: typeof window !== "undefined" ? window.location.href : undefined,
            }),
        });

        if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.error || `Failed to submit feedback: ${res.status}`);
        }

        return await res.json();
    }

    public openFeedbackModal(options?: FeedbackModalOptions): HaloFeedbackWidget {
        const widget = new HaloFeedbackWidget(options, (data) => this.submitFeedback(data));
        widget.open();
        return widget;
    }

    public getCaptureState(): ReplayCaptureState {
        return this.captureState;
    }

    public getTriggerType(): ReplayTriggerType | null {
        return this.triggerType;
    }

    public getCaptureReason(): string | null {
        return this.captureReason;
    }

    public getTriggerTimestamp(): string | null {
        return this.triggerTimestamp;
    }

    public getSampleRate(): number {
        return this.sampleRate;
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
            this.captureState = "DISABLED";
            return;
        }

        if (isUrlIgnored(window.location.href, this.options.privacy?.ignoreUrls)) {
            this.captureState = "DISABLED";
            return;
        }

        if (this.options.shouldCapture) {
            try {
                const allowed = this.options.shouldCapture({
                    url: window.location.href,
                    user: this.currentUser,
                });
                if (!allowed) {
                    this.captureState = "DISABLED";
                    return;
                }
            } catch (err) {
                console.warn("[Halo Replay] shouldCapture evaluation error:", err);
            }
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
                recordCanvas: Boolean(this.options.recordCanvas),
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

            // Establish capture state:
            if (this.isSampled && !this.options.errorTriggered) {
                // Continuous session sampling explicitly chosen (errorTriggered false)
                this.captureState = "CAPTURING";
                this.isStreaming = true;
                this.triggerType = "SAMPLE";
                this.captureReason = `Normal session sampled (${Math.round(this.sampleRate * 100)}%)`;
                this.triggerTimestamp = new Date().toISOString();
                this.uploader.setSessionMeta({
                    triggerType: this.triggerType,
                    captureReason: this.captureReason,
                    triggerTimestamp: this.triggerTimestamp,
                });
            } else {
                // Evidence-triggered architecture:
                // Start in OBSERVING state. Keep all events in local bounded ring buffer.
                // 0 HTTP requests to /api/ingest/replay until a trigger occurs.
                this.captureState = "OBSERVING";
                this.isStreaming = false;
            }
        } catch (err) {
            console.error("[Halo Replay] Failed to start recording:", err);
            this.captureState = "DISABLED";
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

        // Sanitize href in rrweb Meta events (type 4) to strip sensitive tokens/keys from recorded stream
        if (event.type === 4 && (event.data as any)?.href) {
            (event.data as any).href = sanitizeUrl((event.data as any).href);
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

        if (this.captureState === "CAPTURING") {
            // Actively streaming triggered/sampled session chunks
            this.uploader.addEvents([event]);
        } else if (this.captureState === "OBSERVING") {
            // In evidence observation mode: keep in local ring buffer until an error/trigger occurs
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

                // Network 5xx trigger: server error condition
                if (response.status >= 500 && this.options.triggerOnNetworkError !== false) {
                    this.triggerCapture("NETWORK_5XX", {
                        reason: `HTTP ${response.status} on ${sanitizeUrl(urlStr)}`,
                        meta: { requestId, traceId },
                    });
                }

                return response;
            } catch (err: any) {
                const durationMs = Date.now() - start;
                const isAborted = err?.name === "AbortError" || Boolean((init as any)?.signal?.aborted);
                this.recordCustomEvent<ReplayRequestPayload>("halo:request", {
                    method,
                    url: sanitizeUrl(urlStr),
                    status: 0,
                    durationMs,
                    requestId,
                    traceId,
                    failed: true,
                    aborted: isAborted,
                    error: err?.message || String(err),
                });

                if (this.options.triggerOnNetworkError !== false) {
                    this.triggerCapture("NETWORK_5XX", {
                        reason: `Network request failure on ${sanitizeUrl(urlStr)}: ${err?.message || err}`,
                        meta: { requestId, traceId },
                    });
                }
                throw err;
            }
        };
    }

    private setupConsoleInstrumentation(): void {
        if (typeof console === "undefined") return;

        this.originalConsoleLog = console.log.bind(console);
        this.originalConsoleInfo = console.info.bind(console);
        this.originalConsoleWarn = console.warn.bind(console);
        this.originalConsoleError = console.error.bind(console);

        const createConsoleWrapper = (level: "log" | "info" | "warn" | "error", originalFn: any) => {
            return (...args: any[]) => {
                originalFn.apply(console, args);
                const message = args
                    .map((a) => (typeof a === "string" ? a : a?.message || JSON.stringify(a)))
                    .join(" ");

                this.recordCustomEvent<ReplayConsolePayload>("halo:console", {
                    level,
                    message: message.slice(0, 1000),
                });
            };
        };

        console.log = createConsoleWrapper("log", this.originalConsoleLog);
        console.info = createConsoleWrapper("info", this.originalConsoleInfo);
        console.warn = createConsoleWrapper("warn", this.originalConsoleWarn);
        console.error = createConsoleWrapper("error", this.originalConsoleError);
    }

    private setupErrorListeners(): void {
        if (typeof window === "undefined") return;

        window.addEventListener("error", (e) => {
            this.triggerCapture("ERROR", {
                reason: e.message || "Unhandled Error",
                error: e.error,
                meta: { stack: e.error?.stack },
            });
        });

        window.addEventListener("unhandledrejection", (e) => {
            const reason = e.reason;
            const message = typeof reason === "string" ? reason : reason?.message || "Unhandled Promise Rejection";
            this.triggerCapture("UNHANDLED_REJECTION", {
                reason: message,
                error: reason,
                meta: { stack: reason?.stack },
            });
        });
    }

    /**
     * Unified trigger handler for evidence-based session persistence.
     * Transitions state from OBSERVING -> CAPTURING on first trigger,
     * flushes pre-trigger ring buffer, and schedules post-trigger aftermath capture.
     * Subsequent triggers in the same session append timeline markers without duplicate sessions.
     */
    public triggerCapture(
        triggerTypeOrOptions: ReplayTriggerType | { type?: ReplayTriggerType; reason?: string; error?: any; meta?: Record<string, any> },
        details?: { reason?: string; error?: any; meta?: Record<string, any> }
    ): void {
        if (this.captureState === "DISABLED" || this.captureState === "DISCARDED") {
            return;
        }

        let triggerType: ReplayTriggerType;
        let effectiveDetails = details;

        if (typeof triggerTypeOrOptions === "object" && triggerTypeOrOptions !== null) {
            triggerType = (triggerTypeOrOptions.type || "MANUAL") as ReplayTriggerType;
            effectiveDetails = {
                reason: triggerTypeOrOptions.reason,
                error: triggerTypeOrOptions.error,
                meta: triggerTypeOrOptions.meta,
                ...details,
            };
        } else {
            triggerType = triggerTypeOrOptions;
        }

        const now = new Date().toISOString();
        const reason = effectiveDetails?.reason || triggerType;

        // Invariant: Multiple triggers in the same session are safe.
        // If already capturing, append a timeline marker and extend the post-trigger countdown.
        if (this.captureState === "CAPTURING") {
            this.recordCustomEvent("halo:trigger", {
                triggerType,
                reason,
                timestamp: now,
                ...details?.meta,
            });

            if (this.postErrorTimeout) {
                clearTimeout(this.postErrorTimeout);
            }
            const postDurationMs = (this.options.postErrorDurationSeconds ?? 30) * 1000;
            this.postErrorTimeout = setTimeout(() => {
                this.flushAndConclude();
            }, postDurationMs);
            return;
        }

        // Transition from OBSERVING -> CAPTURING
        this.captureState = "CAPTURING";
        this.isStreaming = true;
        this.isErrorTriggered = true;
        this.triggerType = triggerType;
        this.captureReason = reason;
        this.triggerTimestamp = now;

        // Record initial trigger marker
        this.recordCustomEvent("halo:trigger", {
            triggerType,
            reason,
            timestamp: now,
            ...details?.meta,
        });

        // 1. Freeze/flush all pre-trigger events from the ring buffer into the uploader
        const preTriggerEvents = this.ringBuffer.flush();
        this.uploader.addEvents(preTriggerEvents);

        // 2. Configure uploader session metadata
        this.uploader.setSessionMeta({
            triggerType: this.triggerType,
            captureReason: this.captureReason,
            triggerTimestamp: this.triggerTimestamp,
            errorAt: triggerType === "ERROR" || triggerType === "UNHANDLED_REJECTION" ? this.triggerTimestamp : undefined,
            hasRageClicks: this.hasRageClicks,
            hasDeadClicks: this.hasDeadClicks,
            rageClickCount: this.rageClickCount,
            deadClickCount: this.deadClickCount,
            ...details?.meta,
        });

        // 3. Immediate flush of the pre-trigger buffer so session row & chunks persist in backend
        this.uploader.flush(false);

        // 4. Schedule post-trigger aftermath capture window
        if (this.postErrorTimeout) {
            clearTimeout(this.postErrorTimeout);
        }
        const postDurationMs = (this.options.postErrorDurationSeconds ?? 30) * 1000;
        this.postErrorTimeout = setTimeout(() => {
            this.flushAndConclude();
        }, postDurationMs);
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

        this.triggerCapture("ERROR", {
            reason: errorMeta?.title || "Unhandled Exception",
            meta: {
                errorAt: errorTimestamp,
                ...errorMeta,
            },
        });
    }

    /**
     * Explicit developer capture API (e.g. halo.replay.capture()).
     * Captures pre-trigger evidence and begins persistence.
     */
    public capture(options?: { reason?: string }): void {
        this.triggerCapture("MANUAL", {
            reason: options?.reason || "Developer-triggered capture",
        });
    }

    public flushAndConclude(): void {
        if (this.captureState === "CAPTURING") {
            this.captureState = "FLUSHING";
            this.uploader.flush(true, {
                hasRageClicks: this.hasRageClicks,
                hasDeadClicks: this.hasDeadClicks,
                rageClickCount: this.rageClickCount,
                deadClickCount: this.deadClickCount,
            });
            this.captureState = "PERSISTED";
        } else if (this.captureState === "OBSERVING") {
            // Invariant: Un-triggered normal sessions discard the buffer.
            // 0 HTTP requests, 0 DB records.
            this.captureState = "DISCARDED";
            this.ringBuffer.flush();
        }
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

                    if (this.options.triggerOnFrustration !== false) {
                        this.triggerCapture("RAGE_CLICK", {
                            reason: `Rage click burst (${cluster.length} rapid clicks on ${targetSelector})`,
                        });
                    }
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

                            if (this.options.triggerOnFrustration !== false) {
                                this.triggerCapture("DEAD_CLICK", {
                                    reason: `Dead click on actionable element (${targetSelector})`,
                                });
                            }
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
            if (state === "hidden" && this.captureState === "CAPTURING") {
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
        if (this.originalConsoleLog && typeof console !== "undefined") {
            console.log = this.originalConsoleLog;
        }
        if (this.originalConsoleInfo && typeof console !== "undefined") {
            console.info = this.originalConsoleInfo;
        }
        if (this.originalConsoleWarn && typeof console !== "undefined") {
            console.warn = this.originalConsoleWarn;
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

