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

    service: string | null;

    resource: string | null;

    operation: string | null;

    status: string | null;

    durationMs: number | null;

    sessionId: string | null;

    tags: unknown;

    breadcrumbs: unknown;

    user: unknown;

    fingerprint: string | null;

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

        timestamp:
            event.timestamp,

        source:
            event.sdkName ??
            "halo",

        /*
         * These are real normalized Event fields.
         *
         * Fall back to metadata only for compatibility
         * with older events that may have stored them there.
         */
        service:
            event.service ??
            getString(
                metadata.service
            ) ??
            "unknown",

        title:
            event.title,

        description:
            event.message ??
            event.stack ??
            undefined,

        release:
            event.release ??
            undefined,

        environment:
            getString(
                metadata.environment
            ) ??
            undefined,

        resource:
            event.resource ??
            getString(
                metadata.resource
            ),

        operation:
            event.operation ??
            getString(
                metadata.operation
            ),

        durationMs:
            event.durationMs ??
            undefined,

        status:
            event.status ??
            undefined,

        requestId:
            getString(
                metadata.requestId
            ),

        traceId:
            getString(
                metadata.traceId
            ),

        spanId:
            getString(
                metadata.spanId
            ),

        parentSpanId:
            getString(
                metadata.parentSpanId
            ),

        tags:
            isRecord(event.tags)
                ? Object.fromEntries(
                      Object.entries(
                          event.tags
                      ).map(
                          ([key, value]) => [
                              key,
                              String(value),
                          ]
                      )
                  )
                : undefined,

        metadata: {
            ...metadata,

            ...(event.sessionId
                ? {
                      sessionId:
                          event.sessionId,
                  }
                : {}),

            ...(event.fingerprint
                ? {
                      fingerprint:
                          event.fingerprint,
                  }
                : {}),

            ...(event.breadcrumbs
                ? {
                      breadcrumbs:
                          event.breadcrumbs,
                  }
                : {}),

            ...(event.user
                ? {
                      user:
                          event.user,
                  }
                : {}),
        },
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

        case "TRACE":
            return "TRACE";

        case "MESSAGE":
            return "LOG";

        default:
            return "LOG";
    }
}

function isRecord(
    value: unknown
): value is Record<
    string,
    unknown
> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}

function getString(
    value: unknown
): string | undefined {
    return typeof value ===
        "string"
        ? value
        : undefined;
}