export interface HaloOptions {
    apiKey: string;
    endpoint?: string;

    environment?: string;
    release?: string;

    enabled?: boolean;
}

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
    title: string;

    message?: string;

    severity?: HaloSeverity;

    stack?: string;

    fingerprint?: string;

    metadata?: Record<string, unknown>;

    tags?: Record<string, HaloTagValue>;

    breadcrumbs?: HaloBreadcrumb[];

    user?: HaloUser;
}