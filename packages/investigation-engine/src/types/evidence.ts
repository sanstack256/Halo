export type EvidenceType =
    | "ERROR"
    | "LOG"
    | "TRACE"
    | "METRIC"
    | "DEPLOYMENT"
    | "COMMIT"
    | "CONFIG"
    | "FEATURE_FLAG"
    | "INFRASTRUCTURE"
    | "THIRD_PARTY";

export interface Evidence {
    id: string;

    type: EvidenceType;

    timestamp: Date;

    source: string;

    service: string;

    title: string;

    description?: string;

    release?: string;

    commit?: string;

    environment?: string;

    traceId?: string;

    spanId?: string;

    parentSpanId?: string;

    requestId?: string;

    sessionId?: string;

    operation?: string;

    resource?: string;

    durationMs?: number;

    value?: number;

    status?: string | number;

    fingerprint?: string;

    tags?: Record<string, string>;

    breadcrumbs?: EvidenceBreadcrumb[];

    user?: EvidenceUser;

    scope?: "PRIMARY" | "CONTEXT" | "BASELINE";

    evidenceStatus?: "OBSERVED" | "SUPPORTED" | "INFERRED" | "UNCERTAIN" | "UNKNOWN" | "INSUFFICIENT_EVIDENCE";

    metadata: Record<string, unknown>;
}

export interface EvidenceBreadcrumb {
    timestamp?: Date;

    category: string;

    message: string;

    data?: Record<string, unknown>;
}

export interface EvidenceUser {
    id?: string;

    email?: string;

    username?: string;
}