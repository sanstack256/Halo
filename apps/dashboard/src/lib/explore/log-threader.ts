import {
    getEventsInTimeRange,
    type CanonicalQueryFilter,
} from "./canonical-evidence-access";
import type {
    CanonicalEvidenceRecord,
    RelationshipType,
} from "./evidence-types";

export type ThreadStrength = "DIRECT" | "LINKED" | "CONTEXTUAL";

export interface LogThreadNode {
    id: string;
    record: CanonicalEvidenceRecord;
    relationshipType: RelationshipType;
    linkageReason: string;
    parentSpanId: string | null;
    isFailureBoundary: boolean;
    depth: number;
}

export interface CompressedLogCluster {
    id: string;
    isCompressed: boolean;
    nodes: LogThreadNode[];
    count: number;
    firstTimestamp: Date;
    lastTimestamp: Date;
    summaryMessage: string;
    underlyingEventIds: string[];
}

export interface ThreadTelemetryGap {
    fromTimestamp: Date;
    toTimestamp: Date;
    durationMs: number;
    description: string;
}

export interface LogThread {
    threadId: string;
    threadKey: string;
    threadType: "TRACE" | "REQUEST" | "SESSION" | "SERVICE_WINDOW";
    strength: ThreadStrength;
    service: string;
    startTime: Date;
    endTime: Date;
    durationMs: number;
    totalEventCount: number;
    errorCount: number;
    clusters: CompressedLogCluster[];
    gaps: ThreadTelemetryGap[];
}

export async function constructLogThreads(
    filter: CanonicalQueryFilter,
    orgId: string
): Promise<{ threads: LogThread[]; unthreadedCount: number }> {
    // Query canonical logs and errors
    const { records } = await getEventsInTimeRange(
        {
            ...filter,
            types: ["LOG", "MESSAGE", "ERROR"],
            limit: Math.min(filter.limit ?? 150, 200),
        },
        orgId
    );

    if (records.length === 0) {
        return { threads: [], unthreadedCount: 0 };
    }

    // Bucket records by strict correlation priority: trace ID > request ID > session ID
    const traceBuckets = new Map<string, CanonicalEvidenceRecord[]>();
    const requestBuckets = new Map<string, CanonicalEvidenceRecord[]>();
    const sessionBuckets = new Map<string, CanonicalEvidenceRecord[]>();
    const unthreaded: CanonicalEvidenceRecord[] = [];

    for (const record of records) {
        if (record.traceId) {
            const list = traceBuckets.get(record.traceId) || [];
            list.push(record);
            traceBuckets.set(record.traceId, list);
        } else if (record.requestId) {
            const list = requestBuckets.get(record.requestId) || [];
            list.push(record);
            requestBuckets.set(record.requestId, list);
        } else if (record.sessionId) {
            const list = sessionBuckets.get(record.sessionId) || [];
            list.push(record);
            sessionBuckets.set(record.sessionId, list);
        } else {
            unthreaded.push(record);
        }
    }

    const threads: LogThread[] = [];

    // 1. Trace threads (DIRECT)
    for (const [traceId, logs] of traceBuckets.entries()) {
        threads.push(buildExecutionThread(`trace:${traceId}`, "TRACE", "DIRECT", logs));
    }

    // 2. Request threads (DIRECT / REQUEST_LINK)
    for (const [requestId, logs] of requestBuckets.entries()) {
        threads.push(buildExecutionThread(`request:${requestId}`, "REQUEST", "DIRECT", logs));
    }

    // 3. Session threads (LINKED)
    for (const [sessionId, logs] of sessionBuckets.entries()) {
        threads.push(buildExecutionThread(`session:${sessionId}`, "SESSION", "LINKED", logs));
    }

    // 4. Contextual unthreaded logs
    if (unthreaded.length > 0) {
        const contextualClusters = clusterContextualLogs(unthreaded);
        for (const cluster of contextualClusters) {
            threads.push(
                buildExecutionThread(
                    `contextual:${cluster[0].service || "service"}:${cluster[0].timestamp.getTime()}`,
                    "SERVICE_WINDOW",
                    "CONTEXTUAL",
                    cluster
                )
            );
        }
    }

    threads.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    return { threads, unthreadedCount: unthreaded.length };
}

function buildExecutionThread(
    threadKey: string,
    threadType: LogThread["threadType"],
    strength: ThreadStrength,
    rawRecords: CanonicalEvidenceRecord[]
): LogThread {
    // Sort strictly by monotonic timestamp
    const sorted = [...rawRecords].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    const startTime = sorted[0].timestamp;
    const endTime = sorted[sorted.length - 1].timestamp;
    const durationMs = Math.max(0, endTime.getTime() - startTime.getTime());

    let errorCount = 0;
    const nodes: LogThreadNode[] = sorted.map((rec) => {
        const hasError =
            rec.type === "ERROR" ||
            rec.severity === "ERROR" ||
            rec.severity === "FATAL" ||
            (rec.status && String(rec.status).startsWith("5"));

        if (hasError) errorCount++;

        let relationshipType: RelationshipType = "TEMPORAL_CONTEXT";
        let linkageReason = "Contextually grouped in service execution window";

        if (strength === "DIRECT") {
            if (rec.traceId) {
                relationshipType = "TRACE_LINK";
                linkageReason = `Shared distributed trace (${rec.traceId})`;
            } else {
                relationshipType = "REQUEST_LINK";
                linkageReason = `Shared request correlation (${rec.requestId})`;
            }
        } else if (strength === "LINKED") {
            relationshipType = "SESSION_LINK";
            linkageReason = `Client session correlation (${rec.sessionId})`;
        }

        // Structural depth from operation hierarchy if captured
        let depth = 0;
        const op = rec.operation || "";
        if (op.includes(".") || op.includes("/")) {
            depth = Math.min(2, op.split(/[./]/).length - 1);
        }

        return {
            id: rec.id,
            record: rec,
            relationshipType,
            linkageReason,
            parentSpanId: (rec.metadata.parentSpanId as string) || null,
            isFailureBoundary: Boolean(hasError),
            depth,
        };
    });

    // Detect telemetry gaps (> 1200ms without observations)
    const gaps: ThreadTelemetryGap[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
        const curr = sorted[i].timestamp;
        const next = sorted[i + 1].timestamp;
        const diff = next.getTime() - curr.getTime();

        if (diff > 1200) {
            gaps.push({
                fromTimestamp: curr,
                toTimestamp: next,
                durationMs: diff,
                description: `TELEMETRY GAP: ${(diff / 1000).toFixed(2)}s elapsed without observed log telemetry`,
            });
        }
    }

    const clusters = compressRepetitiveNodes(nodes);

    return {
        threadId: threadKey,
        threadKey,
        threadType,
        strength,
        service: sorted[0].service || "unknown-service",
        startTime,
        endTime,
        durationMs,
        totalEventCount: nodes.length,
        errorCount,
        clusters,
        gaps,
    };
}

function compressRepetitiveNodes(nodes: LogThreadNode[]): CompressedLogCluster[] {
    const clusters: CompressedLogCluster[] = [];
    let currentRun: LogThreadNode[] = [];

    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        // Never compress failure boundaries or state transition endpoints
        if (node.isFailureBoundary || node.record.severity === "WARNING") {
            if (currentRun.length > 0) {
                clusters.push(createCluster(currentRun));
                currentRun = [];
            }
            clusters.push({
                id: `node-${node.id}`,
                isCompressed: false,
                nodes: [node],
                count: 1,
                firstTimestamp: node.record.timestamp,
                lastTimestamp: node.record.timestamp,
                summaryMessage: node.record.message || node.record.title,
                underlyingEventIds: [node.id],
            });
        } else {
            currentRun.push(node);
        }
    }

    if (currentRun.length > 0) {
        clusters.push(createCluster(currentRun));
    }

    return clusters;
}

function createCluster(nodes: LogThreadNode[]): CompressedLogCluster {
    if (nodes.length < 3) {
        return {
            id: `uncompressed-${nodes[0].id}`,
            isCompressed: false,
            nodes,
            count: nodes.length,
            firstTimestamp: nodes[0].record.timestamp,
            lastTimestamp: nodes[nodes.length - 1].record.timestamp,
            summaryMessage: nodes[0].record.message || nodes[0].record.title,
            underlyingEventIds: nodes.map((n) => n.id),
        };
    }

    return {
        id: `compressed-${nodes[0].id}-${nodes[nodes.length - 1].id}`,
        isCompressed: true,
        nodes,
        count: nodes.length,
        firstTimestamp: nodes[0].record.timestamp,
        lastTimestamp: nodes[nodes.length - 1].record.timestamp,
        summaryMessage: `${nodes.length} repeated transition observations (${nodes[0].record.service || "service"})`,
        underlyingEventIds: nodes.map((n) => n.id),
    };
}

function clusterContextualLogs(records: CanonicalEvidenceRecord[]): CanonicalEvidenceRecord[][] {
    const sorted = [...records].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    const clusters: CanonicalEvidenceRecord[][] = [];
    let currentCluster: CanonicalEvidenceRecord[] = [];

    for (const rec of sorted) {
        if (currentCluster.length === 0) {
            currentCluster.push(rec);
            continue;
        }

        const prev = currentCluster[currentCluster.length - 1];
        const timeDiffMs = rec.timestamp.getTime() - prev.timestamp.getTime();

        if (rec.service === prev.service && timeDiffMs < 5000) {
            currentCluster.push(rec);
        } else {
            clusters.push(currentCluster);
            currentCluster = [rec];
        }
    }

    if (currentCluster.length > 0) {
        clusters.push(currentCluster);
    }

    return clusters;
}
