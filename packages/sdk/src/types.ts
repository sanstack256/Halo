export interface HaloOptions {
    apiKey: string;
    endpoint?: string;
    autoCapture?: boolean;

    environment?: string;
    release?: string;

    sessionId?: string;

    enabled?: boolean;
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

    stack?: string;

    fingerprint?: string;

    metadata?: Record<string, unknown>;

    tags?: Record<string, HaloTagValue>;

    breadcrumbs?: HaloBreadcrumb[];

    user?: HaloUser;

    sessionId?: string;

    sessionStartedAt?: string;

    service?: string;

    resource?: string;

    operation?: string;

    status?: string | number;

    durationMs?: number;
}