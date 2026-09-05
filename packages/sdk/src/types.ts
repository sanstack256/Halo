export interface HaloOptions {
    apiKey: string;

    /**
     * Halo backend endpoint base URL (e.g. "https://app.halo.run/api" or "http://localhost:3000/api").
     * In browser environments, defaults to "/api".
     * In Node/server environments, defaults to process.env.HALO_ENDPOINT.
     */
    endpoint?: string;

    /**
     * Automatically install runtime
     * instrumentation.
     *
     * Defaults to true.
     */
    autoCapture?: boolean;

    /**
     * Automatically instrument fetch().
     *
     * Defaults to true.
     */
    captureHttp?: boolean;

    service?: string;

    environment?: string;

    release?: string;

    sessionId?: string;

    enabled?: boolean;

    /**
     * Maximum number of breadcrumbs
     * kept in memory.
     */
    maxBreadcrumbs?: number;

    /**
     * URL fragments that should not
     * be instrumented.
     */
    ignoreUrls?: string[];

    /**
     * Capture a small allowlist of
     * safe HTTP headers.
     *
     * Sensitive headers are never
     * captured.
     */
    captureHttpHeaders?: boolean;
}

export type HaloEventType =
    | "ERROR"
    | "LOG"
    | "MESSAGE"
    | "TRACE";

export type HaloSeverity =
    | "INFO"
    | "WARNING"
    | "ERROR"
    | "FATAL";

export interface HaloUser {
    id?: string;
    email?: string;
    username?: string;
}

export type HaloTagValue =
    | string
    | number
    | boolean;

export interface HaloBreadcrumb {
    timestamp?: string;

    category: string;

    message: string;

    data?: Record<string, unknown>;
}

export interface HaloCaptureOptions {
    type:
        | "ERROR"
        | "MESSAGE"
        | "TRACE";

    title: string;

    message?: string;

    severity?: HaloSeverity;

    timestamp?: string;

    stack?: string;

    fingerprint?: string;

    metadata?: Record<string, unknown>;

    tags?: Record<
        string,
        HaloTagValue
    >;

    breadcrumbs?: HaloBreadcrumb[];

    user?: HaloUser;

    sessionId?: string;

    sessionStartedAt?: string;

    /**
     * HTTP / distributed tracing
     * correlation.
     */
    requestId?: string;

    traceId?: string;

    service?: string;

    resource?: string;

    operation?: string;

    status?: string | number;

    durationMs?: number;
}