export type ChangeType =
    | "DEPLOYMENT"
    | "CONFIG"
    | "FEATURE_FLAG"
    | "INFRASTRUCTURE"
    | "TRAFFIC"
    | "SERVICE"
    | "UNKNOWN";

export interface Change {
    id: string;

    type: ChangeType;

    title: string;

    description?: string;

    timestamp: Date;

    evidenceIds: string[];
}