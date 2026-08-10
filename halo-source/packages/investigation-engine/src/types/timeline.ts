export type TimelineEventType =
    | "CHANGE"
    | "ANOMALY"
    | "ERROR"
    | "OBSERVATION"
    | "ACTION";

export interface TimelineEvent {
    id: string;

    timestamp: Date;

    type: TimelineEventType;

    title: string;

    description?: string;

    evidenceIds: string[];
}

export interface Timeline {
    events: TimelineEvent[];
}