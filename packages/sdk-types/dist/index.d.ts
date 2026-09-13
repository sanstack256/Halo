/**
 * Canonical contracts and types for the Halo Telemetry Platform.
 */
type HaloEventType = "ERROR" | "LOG" | "MESSAGE" | "TRACE" | "METRIC" | "NAV" | "LIFECYCLE";
type HaloSeverity = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "FATAL";
type EvidenceStatus = "OBSERVED" | "SUPPORTED" | "INFERRED" | "UNCERTAIN" | "UNKNOWN";
type HaloTagValue = string | number | boolean;
type HaloContext = Record<string, unknown>;
interface HaloUser {
    id?: string;
    email?: string;
    username?: string;
    ipAddress?: string;
    [key: string]: unknown;
}
interface HaloBreadcrumb {
    timestamp: string;
    category: "navigation" | "click" | "input" | "console" | "request" | "response" | "error" | "lifecycle" | "custom" | "performance" | "trace" | string;
    message: string;
    level?: HaloSeverity;
    data?: Record<string, unknown>;
}
interface HaloTraceContext {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    sampled?: boolean;
    traceFlags?: string;
    traceState?: string;
    baggage?: Record<string, string>;
}
interface HaloRuntimeInfo {
    name: "browser" | "node" | "edge" | "react-native" | "unknown";
    version?: string;
    engine?: string;
    platform?: string;
}
interface HaloClientClock {
    clientTimestamp: number;
    clientTimestampIso: string;
    timezoneOffsetMinutes: number;
}
/**
 * Common Canonical Envelope for all telemetry events transmitted by Halo SDKs.
 */
interface HaloEnvelope<TData = Record<string, unknown>> {
    eventId: string;
    eventType: HaloEventType;
    timestamp: string;
    timestampPrecision: "ms" | "ns";
    projectId?: string;
    sessionId?: string;
    sessionStartedAt?: string;
    traceId?: string;
    spanId?: string;
    parentSpanId?: string;
    requestId?: string;
    user?: HaloUser;
    environment?: string;
    release?: string;
    service?: string;
    deployment?: string;
    sdkName: string;
    sdkVersion: string;
    runtime: HaloRuntimeInfo;
    platform: string;
    clock: HaloClientClock;
    evidenceStatus: EvidenceStatus;
    sequence?: number;
    title: string;
    message?: string;
    severity: HaloSeverity;
    stack?: string;
    fingerprint?: string;
    durationMs?: number;
    operation?: string;
    resource?: string;
    status?: string | number;
    tags: Record<string, HaloTagValue>;
    breadcrumbs: HaloBreadcrumb[];
    metadata: Record<string, unknown>;
    data?: TData;
}
interface HaloCaptureOptions {
    type?: HaloEventType;
    title: string;
    message?: string;
    severity?: HaloSeverity;
    timestamp?: string;
    stack?: string;
    fingerprint?: string;
    metadata?: Record<string, unknown>;
    tags?: Record<string, HaloTagValue>;
    breadcrumbs?: HaloBreadcrumb[];
    user?: HaloUser;
    sessionId?: string;
    sessionStartedAt?: string;
    requestId?: string;
    traceId?: string;
    spanId?: string;
    parentSpanId?: string;
    service?: string;
    resource?: string;
    operation?: string;
    status?: string | number;
    durationMs?: number;
    data?: Record<string, unknown>;
}
interface HaloReplayConfig {
    enabled?: boolean;
    errorTriggered?: boolean;
    samplingRate?: number;
    preErrorBufferSeconds?: number;
    postErrorDurationSeconds?: number;
    maxBufferEvents?: number;
    flushIntervalMs?: number;
    recordCanvas?: boolean;
    privacy?: {
        maskAllText?: boolean;
        maskTextSelector?: string;
        blockSelector?: string;
        ignoreSelector?: string;
        ignoreUrls?: (string | RegExp)[];
    };
}
interface HaloPrivacyOptions {
    maskAllInputs?: boolean;
    maskAllText?: boolean;
    maskSelectors?: string[];
    blockSelectors?: string[];
    ignoreUrls?: (string | RegExp)[];
    allowlistHeaders?: string[];
    allowlistBodyUrls?: (string | RegExp)[];
    redactKeys?: (string | RegExp)[];
}
interface HaloOptions {
    apiKey: string;
    endpoint?: string;
    environment?: string;
    release?: string;
    service?: string;
    deployment?: string;
    sessionId?: string;
    enabled?: boolean;
    autoCapture?: boolean;
    captureHttp?: boolean;
    captureConsole?: boolean;
    captureNavigation?: boolean;
    capturePerformance?: boolean;
    maxBreadcrumbs?: number;
    tracesSampleRate?: number;
    samplingRate?: number;
    targetPredicate?: (context: {
        user?: HaloUser;
        url?: string;
        route?: string;
    }) => boolean;
    privacy?: HaloPrivacyOptions;
    replay?: HaloReplayConfig;
}
type SessionState = "IDLE" | "INITIALIZING" | "RECORDING" | "ERROR_TRIGGERED" | "POST_ERROR_RECORDING" | "FLUSHING" | "STOPPED";

export type { EvidenceStatus, HaloBreadcrumb, HaloCaptureOptions, HaloClientClock, HaloContext, HaloEnvelope, HaloEventType, HaloOptions, HaloPrivacyOptions, HaloReplayConfig, HaloRuntimeInfo, HaloSeverity, HaloTagValue, HaloTraceContext, HaloUser, SessionState };
