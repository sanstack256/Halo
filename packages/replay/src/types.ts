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
    };
    final?: boolean;
}
