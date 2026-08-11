import type { Evidence } from "@halo/investigation-engine";

type EventEnvironment = {
    name: string;
};

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

    requestId: string | null;

    traceId: string | null;

    durationMs: number | null;

    sessionId: string | null;

    tags: unknown;

    breadcrumbs: unknown;

    user: unknown;

    fingerprint: string | null;

    projectId: string;

    environmentId: string;

    environment?: EventEnvironment | null;
};

/**
 * Convert a persisted Halo Event into the normalized
 * evidence representation consumed by the investigation
 * engine.
 *
 * This function deliberately preserves information rather
 * than trying to interpret causality. Causality belongs to
 * the investigation engine.
 */
export function eventToEvidence(
    event: EventForEvidence,
): Evidence {
    const sourceMetadata =
        isRecord(event.metadata)
            ? event.metadata
            : {};

    /*
     * Prefer normalized Event columns.
     *
     * Metadata fallbacks exist for compatibility with
     * older events created before these fields became
     * first-class database columns.
     */
    const service =
        event.service ??
        getString(
            sourceMetadata.service,
        ) ??
        "unknown";

    const resource =
        event.resource ??
        getString(
            sourceMetadata.resource,
        );

    const operation =
        event.operation ??
        getString(
            sourceMetadata.operation,
        );

    const requestId =
        event.requestId ??
        getString(
            sourceMetadata.requestId,
        );

    const traceId =
        event.traceId ??
        getString(
            sourceMetadata.traceId,
        );

    const spanId =
        getString(
            sourceMetadata.spanId,
        );

    const parentSpanId =
        getString(
            sourceMetadata.parentSpanId,
        );

    const environment =
        event.environment?.name ??
        getString(
            sourceMetadata.environment,
        );

    /*
     * Preserve both the human-readable error details
     * and the original structured context.
     *
     * The stack is also kept in metadata because Evidence
     * has a single description field.
     */
    const metadata: Record<
        string,
        unknown
    > = {
        ...sourceMetadata,

        projectId:
            event.projectId,

        environmentId:
            event.environmentId,

        sdkName:
            event.sdkName ??
            undefined,

        sdkVersion:
            event.sdkVersion ??
            undefined,

        sessionId:
            event.sessionId ??
            undefined,

        fingerprint:
            event.fingerprint ??
            undefined,

        breadcrumbs:
            event.breadcrumbs ??
            undefined,

        user:
            event.user ??
            undefined,

        stack:
            event.stack ??
            undefined,

        requestId:
            requestId ??
            undefined,

        traceId:
            traceId ??
            undefined,

        spanId:
            spanId ??
            undefined,

        parentSpanId:
            parentSpanId ??
            undefined,
    };

    removeUndefinedValues(
        metadata,
    );

    return {
        id: event.id,

        type:
            mapEventType(
                event.type,
            ),

        timestamp:
            event.timestamp,

        source:
            event.sdkName ??
            "halo",

        service,

        title:
            event.title,

        /*
         * Keep the primary message readable while
         * preserving the stack separately in metadata.
         */
        description:
            event.message ??
            event.stack ??
            undefined,

        release:
            event.release ??
            undefined,

        environment:
            environment ??
            undefined,

        traceId:
            traceId ??
            undefined,

        spanId:
            spanId ??
            undefined,

        parentSpanId:
            parentSpanId ??
            undefined,

        requestId:
            requestId ??
            undefined,

        operation:
            operation ??
            undefined,

        resource:
            resource ??
            undefined,

        durationMs:
            event.durationMs ??
            undefined,

        status:
            event.status ??
            undefined,

        tags:
            normalizeTags(
                event.tags,
            ),

        metadata,
    };
}

/**
 * Convert and chronologically order evidence.
 *
 * Investigation should reason over the actual event
 * sequence, not database retrieval order.
 */
export function eventsToEvidence(
    events: EventForEvidence[],
): Evidence[] {
    return events
        .map(eventToEvidence)
        .sort(
            (a, b) =>
                a.timestamp.getTime() -
                b.timestamp.getTime(),
        );
}

function mapEventType(
    type: string,
): Evidence["type"] {
    switch (type) {
        case "ERROR":
            return "ERROR";

        case "LOG":
            return "LOG";

        case "TRACE":
            return "TRACE";

        /*
         * The normalized Evidence model does not
         * currently have a MESSAGE type.
         *
         * Represent it as LOG while preserving the
         * original Event type inside metadata.
         */
        case "MESSAGE":
            return "LOG";

        default:
            return "LOG";
    }
}

function isRecord(
    value: unknown,
): value is Record<
    string,
    unknown
> {
    return (
        typeof value ===
        "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}

function getString(
    value: unknown,
): string | undefined {
    return typeof value ===
        "string"
        ? value
        : undefined;
}

function normalizeTags(
    value: unknown,
):
    | Record<string, string>
    | undefined {
    if (!isRecord(value)) {
        return undefined;
    }

    const tags: Record<
        string,
        string
    > = {};

    for (const [
        key,
        rawValue,
    ] of Object.entries(value)) {
        if (
            typeof rawValue ===
            "string"
        ) {
            tags[key] =
                rawValue;

            continue;
        }

        if (
            typeof rawValue ===
            "number" ||
            typeof rawValue ===
            "boolean"
        ) {
            tags[key] =
                String(rawValue);
        }
    }

    return Object.keys(tags)
        .length > 0
        ? tags
        : undefined;
}

function removeUndefinedValues(
    object: Record<
        string,
        unknown
    >,
) {
    for (const key of Object.keys(
        object,
    )) {
        if (
            object[key] ===
            undefined
        ) {
            delete object[key];
        }
    }
}