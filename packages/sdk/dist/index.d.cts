interface HaloOptions {
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
type HaloSeverity = "INFO" | "WARNING" | "ERROR" | "FATAL";
interface HaloUser {
    id?: string;
    email?: string;
    username?: string;
}
type HaloTagValue = string | number | boolean;
interface HaloBreadcrumb {
    timestamp?: string;
    category: string;
    message: string;
    data?: Record<string, unknown>;
}
interface HaloCaptureOptions {
    type: "ERROR" | "MESSAGE" | "TRACE";
    title: string;
    message?: string;
    severity?: HaloSeverity;
    stack?: string;
    fingerprint?: string;
    metadata?: Record<string, unknown>;
    tags?: Record<string, HaloTagValue>;
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

declare class Halo {
    private client;
    private enabled;
    private release?;
    private environment?;
    private user?;
    private queue;
    private tags;
    private breadcrumbs;
    private sessionId?;
    private sessionStartedAt?;
    private maxBreadcrumbs;
    private onEventIngested?;
    constructor(options: HaloOptions);
    startSession(): string;
    endSession(): void;
    getSessionId(): string | undefined;
    setUser(user: HaloUser): void;
    clearUser(): void;
    /**
     * Register a callback that is invoked whenever an event is ingested by the Halo backend.
     */
    onEventIngestedCallback(callback: (result: {
        eventId?: string;
        issueId?: string;
    }) => void): void;
    setTag(key: string, value: HaloTagValue): void;
    removeTag(key: string): void;
    addBreadcrumb(breadcrumb: HaloBreadcrumb): void;
    clearBreadcrumbs(): void;
    flush(): Promise<void>;
    captureMessage(message: string): Promise<void>;
    captureException(error: unknown): Promise<void>;
    capturePerformance(options: {
        title: string;
        durationMs: number;
        operation?: string;
        resource?: string;
        status?: string | number;
        service?: string;
        metadata?: Record<string, unknown>;
        requestId?: string;
        traceId?: string;
    }): Promise<void>;
    capture(event: HaloCaptureOptions): Promise<void>;
}

export { Halo, type HaloBreadcrumb, type HaloCaptureOptions, type HaloOptions, type HaloSeverity, type HaloTagValue, type HaloUser };
