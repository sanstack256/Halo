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

    metadata: Record<string, unknown>;
}