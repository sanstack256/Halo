import type { Evidence } from "@halo/investigation-engine";

type EventForEvidence = {
    id: string;
    type: string;
    title: string;
    message: string | null;
    stack: string | null;
    metadata: unknown;
    timestamp: Date;

    sdkName: string | null;
    sdkVersion: string | null;
    release: string | null;

    projectId: string;
    environmentId: string;
};

export function eventToEvidence(
    event: EventForEvidence
): Evidence {
    const metadata =
        isRecord(event.metadata)
            ? event.metadata
            : {};

    return {
        id: event.id,

        type: mapEventType(event.type),

        timestamp: event.timestamp,

        source:
            event.sdkName ??
            "halo",

        service:
            getString(
                metadata.service
            ) ??
            "unknown",

        title: event.title,

        description:
            event.message ??
            event.stack ??
            undefined,

        resource:
            getString(
                metadata.resource
            ),

        operation:
            getString(
                metadata.operation
            ),

        release:
            event.release ??
            undefined,

        environment:
            getString(
                metadata.environment
            ),

        metadata,
    };
}

export function eventsToEvidence(
    events: EventForEvidence[]
): Evidence[] {
    return events.map(
        eventToEvidence
    );
}

function mapEventType(
    type: string
): Evidence["type"] {
    switch (type) {
        case "ERROR":
            return "ERROR";

        case "LOG":
            return "LOG";

        default:
            return "LOG";
    }
}

function isRecord(
    value: unknown
): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}

function getString(
    value: unknown
): string | undefined {
    return typeof value === "string"
        ? value
        : undefined;
}