import { eventWithTime } from '@rrweb/types';

declare class ReplayRingBuffer {
    private buffer;
    private maxDurationMs;
    private maxEvents;
    constructor(maxDurationSeconds?: number, maxEvents?: number);
    add(event: eventWithTime): void;
    /**
     * Prunes events that are older than maxDurationMs or beyond maxEvents,
     * while rigorously ensuring that an initial FullSnapshot (type 2) or Meta (type 4)
     * is preserved at the beginning of the buffer so DOM reconstruction never fails.
     */
    prune(referenceTimestamp?: number): void;
    flush(): eventWithTime[];
    getAll(): eventWithTime[];
    clear(): void;
    get length(): number;
}

interface ReplayPrivacyOptions {
    /**
     * If true, masks all user-facing text inside HTML elements with asterisks/bars.
     * Default: true
     */
    maskAllText?: boolean;
    /**
     * Additional CSS selector for elements whose text contents must be masked.
     */
    maskTextSelector?: string;
    /**
     * CSS selector for elements that should be replaced with a placeholder block (blocking media, canvas, sensitive views).
     */
    blockSelector?: string;
    /**
     * CSS selector for elements whose events should be completely ignored.
     */
    ignoreSelector?: string;
    /**
     * URL patterns (regex or string prefix) where session recording should be skipped entirely.
     */
    ignoreUrls?: (string | RegExp)[];
}
interface HaloReplayOptions {
    /**
     * Halo project API key or endpoint config.
     */
    apiKey?: string;
    /**
     * Halo project ID.
     */
    projectId?: string;
    /**
     * Halo backend endpoint base URL (e.g. "https://app.halo.run/api" or "http://localhost:3000/api").
     * Default: "/api"
     */
    endpoint?: string;
    /**
     * Halo session ID to correlate with Halo telemetry.
     */
    sessionId?: string;
    /**
     * Sampling rate between 0.0 (0%) and 1.0 (100%).
     * Sessions that are not sampled normally will still be preserved if an unhandled error occurs when errorTriggered is true.
     * Default: 1.0 (or 0.1 in high-traffic production)
     */
    samplingRate?: number;
    /**
     * When true, preserves the pre-error session buffer and continues recording after an error occurs.
     * Default: true
     */
    errorTriggered?: boolean;
    /**
     * Maximum duration of pre-error recording to keep in memory in seconds.
     * Default: 60 (1 minute)
     */
    preErrorBufferSeconds?: number;
    /**
     * Maximum number of events to retain in the ring buffer before eviction (memory bounding).
     * Default: 5000
     */
    maxBufferEvents?: number;
    /**
     * Maximum recording time after an error occurs before concluding the replay session, in seconds.
     * Default: 30
     */
    postErrorDurationSeconds?: number;
    /**
     * Maximum total session recording duration in minutes.
     * Default: 60
     */
    maxSessionDurationMinutes?: number;
    /**
     * Interval in milliseconds for chunk uploads when recording is actively streaming.
     * Default: 5000 (5 seconds)
     */
    flushIntervalMs?: number;
    /**
     * Privacy masking settings.
     */
    privacy?: ReplayPrivacyOptions;
    /**
     * Target environment name.
     */
    environment?: string;
    /**
     * Capture SPA navigation history transitions.
     * Default: true
     */
    captureNavigation?: boolean;
    /**
     * Capture network fetch / XHR metadata (method, URL, status, duration, traceId).
     * Headers, secrets, cookies, and tokens are NEVER captured.
     * Default: true
     */
    captureNetwork?: boolean;
    /**
     * Capture console errors.
     * Default: true
     */
    captureConsole?: boolean;
    /**
     * Detect user frustration rage clicks (>= 3 clicks within 1000ms in tight radius).
     * Default: true
     */
    detectRageClicks?: boolean;
    /**
     * Threshold number of rapid clicks required to trigger a rage click event.
     * Default: 3
     */
    rageClickThreshold?: number;
    /**
     * Detect dead clicks (clicks on actionable elements that produce zero mutation/request/nav).
     * Default: true
     */
    detectDeadClicks?: boolean;
    /**
     * Inactivity duration in ms before a click with zero effects is flagged as dead click.
     * Default: 2500
     */
    deadClickTimeoutMs?: number;
    /**
     * Enable Canvas 2D and WebGL context operation & frame snapshot recording.
     * Default: false (enable explicitly for graphics / game applications)
     */
    recordCanvas?: boolean;
    /**
     * Current authenticated user context for conditional capture targeting.
     */
    user?: {
        id?: string;
        email?: string;
        username?: string;
        [key: string]: any;
    };
    /**
     * Conditional capture targeting predicate.
     * Return true to record the session, false to skip/abort capture.
     * Evaluated against URL, user context, or application-defined state.
     */
    shouldCapture?: (context: {
        url: string;
        user?: any;
        [key: string]: any;
    }) => boolean;
}
interface FeedbackModalOptions {
    title?: string;
    subtitle?: string;
    namePlaceholder?: string;
    emailPlaceholder?: string;
    commentsPlaceholder?: string;
    submitButtonText?: string;
    cancelButtonText?: string;
    defaultName?: string;
    defaultEmail?: string;
    onSubmit?: (feedback: {
        name?: string;
        email?: string;
        comments: string;
    }) => void | Promise<void>;
    onClose?: () => void;
}
type ReplayPrivacyState = "CAPTURED" | "MASKED" | "BLOCKED" | "NOT_CAPTURED" | "UNAVAILABLE";
interface HistoricalDomNode {
    tagName: string;
    id?: string;
    className?: string;
    classList: string[];
    attributes: Record<string, string>;
    hierarchy: string;
    childCount: number;
    childTags: string[];
    geometry?: {
        x: number;
        y: number;
        width: number;
        height: number;
        top: number;
        left: number;
    };
    textContent?: string;
    privacyState: ReplayPrivacyState;
    selectorPath?: string;
}
interface HistoricalDomSnapshot {
    timestamp: number;
    offsetMs: number;
    rootNodeCount: number;
    selectedNode?: HistoricalDomNode;
}
interface ReplayRageClickPayload {
    count: number;
    targetSelector: string;
    x: number;
    y: number;
    durationMs: number;
    windowStartMs: number;
    windowEndMs: number;
}
interface ReplayDeadClickPayload {
    targetSelector: string;
    x: number;
    y: number;
    inactiveDurationMs: number;
}
interface ReplayLifecyclePayload {
    event: "visibilitychange" | "pagehide" | "beforeunload" | "focus" | "blur";
    state?: string;
}
interface ReplayNavigationPayload {
    from?: string;
    to: string;
    type: "pushState" | "replaceState" | "popstate" | "initial";
}
interface ReplayRequestPayload {
    method: string;
    url: string;
    status?: number;
    durationMs?: number;
    requestId?: string;
    traceId?: string;
    failed?: boolean;
    aborted?: boolean;
    error?: string;
}
interface ReplayConsolePayload {
    level: "log" | "warn" | "error" | "info";
    message: string;
    stack?: string;
}
interface ReplayErrorPayload {
    message: string;
    stack?: string;
    issueId?: string;
    traceId?: string;
}
interface ReplayChunkPayload {
    sessionId: string;
    sequence: number;
    events: eventWithTime[];
    startedAt: string;
    endedAt: string;
    meta?: {
        projectId?: string;
        browser?: string;
        os?: string;
        device?: string;
        url?: string;
        userAgent?: string;
        viewportWidth?: number;
        viewportHeight?: number;
        issueId?: string;
        traceId?: string;
        requestId?: string;
        errorAt?: string;
        hasRageClicks?: boolean;
        hasDeadClicks?: boolean;
        rageClickCount?: number;
        deadClickCount?: number;
    };
    final?: boolean;
}

declare class HaloFeedbackWidget {
    private container;
    private options;
    private onSubmitHandler;
    constructor(options: FeedbackModalOptions | undefined, onSubmit: (feedback: {
        name?: string;
        email?: string;
        comments: string;
    }) => Promise<void>);
    open(): void;
    close(): void;
}

declare class HaloReplay {
    private options;
    private stopFn;
    private ringBuffer;
    private uploader;
    private isSampled;
    private isStreaming;
    private isErrorTriggered;
    private postErrorTimeout;
    private maxSessionTimeout;
    private sessionId;
    private startedAt;
    private originalPushState;
    private originalReplaceState;
    private originalFetch;
    private originalConsoleLog;
    private originalConsoleInfo;
    private originalConsoleWarn;
    private originalConsoleError;
    private currentUser;
    private currentUrl;
    private recordedEvents;
    private recentClicks;
    private lastRageEmitTime;
    private pendingDeadClicks;
    private deadClickIdCounter;
    private hasRageClicks;
    private hasDeadClicks;
    private rageClickCount;
    private deadClickCount;
    private clickListener;
    private visibilityListener;
    private pagehideListener;
    private beforeunloadListener;
    constructor(options?: HaloReplayOptions);
    setUser(user: {
        id?: string;
        email?: string;
        username?: string;
        [key: string]: any;
    } | null): void;
    getUser(): any;
    private generateSessionId;
    getSessionId(): string;
    getRingBuffer(): ReplayRingBuffer;
    getBufferEvents(): eventWithTime[];
    getRecordedEvents(): eventWithTime[];
    getHasRageClicks(): boolean;
    getHasDeadClicks(): boolean;
    getRageClickCount(): number;
    getDeadClickCount(): number;
    setIssueId(issueId: string): void;
    submitFeedback(feedback: {
        name?: string;
        email?: string;
        comments: string;
    }): Promise<any>;
    openFeedbackModal(options?: FeedbackModalOptions): HaloFeedbackWidget;
    start(): void;
    private notifyMutationOrEffect;
    private handleEvent;
    /**
     * Records a custom event into the rrweb stream and timeline
     */
    recordCustomEvent<T = any>(tag: string, payload: T): void;
    private setupNavigationInstrumentation;
    private setupNetworkInstrumentation;
    private setupConsoleInstrumentation;
    private setupErrorListeners;
    /**
     * Call when an error is captured (e.g. from Halo.captureException).
     * Supports multiple errors in the same session without timeline destruction.
     */
    triggerErrorReplay(errorMeta?: {
        title?: string;
        stack?: string;
        issueId?: string;
        traceId?: string;
    }): void;
    flushAndConclude(): void;
    private setupFrustrationInstrumentation;
    private setupLifecycleInstrumentation;
    stop(): void;
}

declare function buildMaskerConfig(options?: ReplayPrivacyOptions): {
    maskAllInputs: boolean;
    maskInputOptions: {
        password: boolean;
        email: boolean;
        tel: boolean;
        text: boolean;
        color: boolean;
        date: boolean;
        'datetime-local': boolean;
        file: boolean;
        image: boolean;
        month: boolean;
        number: boolean;
        range: boolean;
        search: boolean;
        time: boolean;
        url: boolean;
        week: boolean;
        textarea: boolean;
        select: boolean;
    };
    maskTextSelector: string;
    blockSelector: string;
    ignoreSelector: string;
    maskTextFn: (text: string, element?: HTMLElement | null) => string;
    maskInputFn: (text: string, element?: HTMLElement | null) => string;
};
declare function sanitizeUrl(urlStr: string): string;
declare function isUrlIgnored(url: string, ignorePatterns?: (string | RegExp)[]): boolean;

/**
 * Initializes and starts Halo Session Replay in the browser.
 */
declare function initHaloReplay(options?: HaloReplayOptions): HaloReplay;

export { type FeedbackModalOptions, HaloFeedbackWidget, HaloReplay, type HaloReplayOptions, type HistoricalDomNode, type HistoricalDomSnapshot, type ReplayChunkPayload, type ReplayConsolePayload, type ReplayDeadClickPayload, type ReplayErrorPayload, type ReplayLifecyclePayload, type ReplayNavigationPayload, type ReplayPrivacyOptions, type ReplayPrivacyState, type ReplayRageClickPayload, type ReplayRequestPayload, ReplayRingBuffer, buildMaskerConfig, initHaloReplay, isUrlIgnored, sanitizeUrl };
