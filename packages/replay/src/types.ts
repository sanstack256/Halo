import type { eventWithTime } from "@rrweb/types";

export interface ReplayPrivacyOptions {
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

export interface HaloReplayOptions {
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
}

export type ReplayPrivacyState =
    | "CAPTURED"
    | "MASKED"
    | "BLOCKED"
    | "NOT_CAPTURED"
    | "UNAVAILABLE";

export interface HistoricalDomNode {
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

export interface HistoricalDomSnapshot {
    timestamp: number;
    offsetMs: number;
    rootNodeCount: number;
    selectedNode?: HistoricalDomNode;
}

export interface ReplayRageClickPayload {
    count: number;
    targetSelector: string;
    x: number;
    y: number;
    durationMs: number;
    windowStartMs: number;
    windowEndMs: number;
}

export interface ReplayDeadClickPayload {
    targetSelector: string;
    x: number;
    y: number;
    inactiveDurationMs: number;
}

export interface ReplayLifecyclePayload {
    event: "visibilitychange" | "pagehide" | "beforeunload" | "focus" | "blur";
    state?: string;
}

export interface ReplayNavigationPayload {
    from?: string;
    to: string;
    type: "pushState" | "replaceState" | "popstate" | "initial";
}

export interface ReplayRequestPayload {
    method: string;
    url: string;
    status?: number;
    durationMs?: number;
    requestId?: string;
    traceId?: string;
    failed?: boolean;
}

export interface ReplayConsolePayload {
    level: "log" | "warn" | "error" | "info";
    message: string;
    stack?: string;
}

export interface ReplayErrorPayload {
    message: string;
    stack?: string;
    issueId?: string;
    traceId?: string;
}

export interface ReplayChunkPayload {
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
