"use server";

import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireCapability, AuthorizationError } from "@/lib/authorization";
import { parseTimeRange } from "@/lib/analytics/time";

export type HealthStatus = "Healthy" | "Degraded" | "Critical" | "Unknown";

export type TopologyNode = {
    id: string; // Service name or "UNKNOWN"
    name: string;
    environment: string;
    requestVolume: number;
    errorCount: number;
    errorRate: number | null; // null if requestVolume === 0
    avgLatencyMs: number | null;
    p95LatencyMs: number | null;
    incomingDependenciesCount: number;
    outgoingDependenciesCount: number;
    health: HealthStatus;
    isBottleneck: boolean;
    bottleneckReason?: string;
    operations: string[];
    sampleSizeAssessment: "NONE" | "LOW" | "SUFFICIENT";
};

export type TopologyEdge = {
    id: string; // "source->target"
    source: string;
    target: string;
    callCount: number;
    errorCount: number;
    errorRate: number | null;
    avgLatencyMs: number | null;
    p50LatencyMs: number | null;
    p95LatencyMs: number | null;
    p99LatencyMs: number | null;
    classification: "OBSERVED" | "INFERRED";
    isBottleneck: boolean;
    bottleneckReason?: string;
    operations: { operation: string; callCount: number; errorCount: number }[];
    supportingTraces: string[]; // Sample of trace IDs
    isSelfCall: boolean;
};

export type HeatmapCell = {
    service: string;
    bucketIndex: number;
    bucketStart: Date;
    bucketEnd: Date;
    totalRequests: number;
    failedRequests: number;
    errorRate: number | null; // null if totalRequests === 0
    avgLatencyMs: number | null;
    p95LatencyMs: number | null;
};

export type ServiceFailureHeatmap = {
    timeRange: { key: string; start: Date; end: Date };
    bucketsCount: number;
    services: string[];
    cells: HeatmapCell[];
    metric: "ERROR_RATE" | "FAILURE_COUNT" | "LATENCY_P95";
    metricDefinition: string;
};

export type FailurePropagationStep = {
    stepIndex: number;
    service: string;
    operation: string;
    spanId?: string;
    parentSpanId?: string;
    status: string | null;
    durationMs: number | null;
    timestamp: Date;
    role: "ORIGIN_ROOT_CAUSE" | "TRANSITIVE_PROPAGATOR" | "IMPACTED_SURFACE";
    isFailure: boolean;
    failingEventId?: string;
};

export type ServiceFailurePropagation = {
    traceId: string;
    initiatingEventId: string;
    originService: string;
    impactedService: string;
    chainLength: number;
    steps: FailurePropagationStep[];
    propagationObserved: boolean;
    explanation: string;
};

export type ServiceTopologyResponse = {
    nodes: TopologyNode[];
    edges: TopologyEdge[];
    timeRange: { key: string; start: Date; end: Date };
    totalServices: number;
    totalDependencies: number;
    bottlenecksCount: number;
    isolatedServicesCount: number;
};

// Helper: Calculate exact percentiles
function calculatePercentile(values: number[], percentile: number): number | null {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

// Bounded time range resolver (max 30 days)
function resolveBoundedTimeRange(timeRangeKey?: string, customStart?: Date, customEnd?: Date) {
    const key = timeRangeKey || "24h";
    let { start, end } = parseTimeRange(key);

    if (customStart && customEnd && customStart < customEnd) {
        start = customStart;
        end = customEnd;
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (start < thirtyDaysAgo) {
        start = thirtyDaysAgo;
    }

    return { key, start, end };
}

/**
 * 1. Authoritative Cross-Service Topology Derivation
 */
export async function getServiceTopology(params: {
    projectId: string;
    timeRangeKey?: string;
    customStart?: Date;
    customEnd?: Date;
    environment?: string;
    providedUserId?: string;
}): Promise<ServiceTopologyResponse> {
    const { projectId, timeRangeKey, customStart, customEnd, environment, providedUserId } = params;

    // 1. Authoritative Phase 1 check: Authenticate and verify user belongs to project organization
    const { organization } = await requireProjectAccess(projectId, providedUserId);

    // 2. Authoritative Phase 1 check: Verify organization has Team Cross-Service Topology capability
    await requireCapability(organization.id, "TEAM_CROSS_SERVICE_TOPOLOGY");

    const timeRange = resolveBoundedTimeRange(timeRangeKey, customStart, customEnd);

    // 3. Query events bounded by projectId and timeRange
    const eventWhere: any = {
        projectId,
        timestamp: { gte: timeRange.start, lte: timeRange.end },
    };
    if (environment && environment !== "ALL") {
        eventWhere.environment = { name: environment };
    }

    const events = await prisma.event.findMany({
        where: eventWhere,
        select: {
            id: true,
            service: true,
            operation: true,
            title: true,
            status: true,
            severity: true,
            type: true,
            durationMs: true,
            traceId: true,
            requestId: true,
            timestamp: true,
            metadata: true,
            tags: true,
        },
        orderBy: { timestamp: "asc" },
        take: 5000, // Safe bounded query
    });

    // 4. Group spans by traceId for authoritative parent-child distributed trace reconstruction
    const traceMap = new Map<string, typeof events>();
    const serviceStats = new Map<string, {
        requests: number;
        errors: number;
        durations: number[];
        operations: Set<string>;
    }>();

    for (const ev of events) {
        const serviceName = ev.service?.trim() || "UNKNOWN";

        let stats = serviceStats.get(serviceName);
        if (!stats) {
            stats = { requests: 0, errors: 0, durations: [], operations: new Set() };
            serviceStats.set(serviceName, stats);
        }

        stats.requests++;
        const isError = Boolean(
            ev.severity === "ERROR" ||
            ev.severity === "FATAL" ||
            ev.type === "ERROR" ||
            (ev.status && String(ev.status).startsWith("5"))
        );

        if (isError) stats.errors++;
        if (typeof ev.durationMs === "number" && ev.durationMs >= 0) {
            stats.durations.push(ev.durationMs);
        }
        if (ev.operation) {
            stats.operations.add(ev.operation);
        } else if (ev.title) {
            stats.operations.add(ev.title);
        }

        if (ev.traceId) {
            const list = traceMap.get(ev.traceId) || [];
            list.push(ev);
            traceMap.set(ev.traceId, list);
        }
    }

    // 5. Derive directed service dependencies from actual parent-child trace spans
    type EdgeAccumulator = {
        source: string;
        target: string;
        callCount: number;
        errorCount: number;
        durations: number[];
        operationsMap: Map<string, { callCount: number; errorCount: number }>;
        supportingTracesSet: Set<string>;
        isSelfCall: boolean;
    };

    const edgesMap = new Map<string, EdgeAccumulator>();

    for (const [traceId, spanList] of traceMap.entries()) {
        // Map spans by their spanId from metadata or tags or id
        const spanIdMap = new Map<string, typeof spanList[0]>();
        for (const span of spanList) {
            const meta = (span.metadata as Record<string, any>) || {};
            const tags = (span.tags as Record<string, any>) || {};
            const spanId = meta.spanId || tags.spanId || span.id;
            spanIdMap.set(String(spanId), span);
        }

        // Connect child to parent using parentSpanId
        for (const childSpan of spanList) {
            const childMeta = (childSpan.metadata as Record<string, any>) || {};
            const childTags = (childSpan.tags as Record<string, any>) || {};
            const parentSpanId = childMeta.parentSpanId || childTags.parentSpanId;

            if (parentSpanId && spanIdMap.has(String(parentSpanId))) {
                const parentSpan = spanIdMap.get(String(parentSpanId))!;
                const sourceService = parentSpan.service?.trim() || "UNKNOWN";
                const targetService = childSpan.service?.trim() || "UNKNOWN";

                const isSelfCall = sourceService === targetService;
                const edgeKey = `${sourceService}->${targetService}`;

                let edge = edgesMap.get(edgeKey);
                if (!edge) {
                    edge = {
                        source: sourceService,
                        target: targetService,
                        callCount: 0,
                        errorCount: 0,
                        durations: [],
                        operationsMap: new Map(),
                        supportingTracesSet: new Set(),
                        isSelfCall,
                    };
                    edgesMap.set(edgeKey, edge);
                }

                edge.callCount++;
                const isChildError = Boolean(
                    childSpan.severity === "ERROR" ||
                    childSpan.severity === "FATAL" ||
                    childSpan.type === "ERROR" ||
                    (childSpan.status && String(childSpan.status).startsWith("5"))
                );

                if (isChildError) edge.errorCount++;

                if (typeof childSpan.durationMs === "number" && childSpan.durationMs >= 0) {
                    edge.durations.push(childSpan.durationMs);
                }

                const opName = childSpan.operation || childSpan.title || "operation";
                const opStats = edge.operationsMap.get(opName) || { callCount: 0, errorCount: 0 };
                opStats.callCount++;
                if (isChildError) opStats.errorCount++;
                edge.operationsMap.set(opName, opStats);

                if (edge.supportingTracesSet.size < 10) {
                    edge.supportingTracesSet.add(traceId);
                }
            }
        }
    }

    // 6. Calculate median duration across project to calibrate bottleneck threshold
    const allDurations: number[] = [];
    for (const stats of serviceStats.values()) {
        allDurations.push(...stats.durations);
    }
    const projectMedianLatency = calculatePercentile(allDurations, 50) || 50;

    // 7. Build Nodes and classify Health & Bottlenecks
    const nodes: TopologyNode[] = [];
    const incomingEdgeCounts = new Map<string, number>();
    const outgoingEdgeCounts = new Map<string, number>();

    for (const edge of edgesMap.values()) {
        if (!edge.isSelfCall) {
            outgoingEdgeCounts.set(edge.source, (outgoingEdgeCounts.get(edge.source) || 0) + 1);
            incomingEdgeCounts.set(edge.target, (incomingEdgeCounts.get(edge.target) || 0) + 1);
        }
    }

    let bottlenecksCount = 0;
    let isolatedCount = 0;

    for (const [serviceName, stats] of serviceStats.entries()) {
        const errorRate = stats.requests > 0 ? stats.errors / stats.requests : null;
        const avgLat = stats.durations.length > 0
            ? Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length)
            : null;
        const p95Lat = calculatePercentile(stats.durations, 95);

        // Health Status Definition
        let health: HealthStatus = "Healthy";
        if (stats.requests === 0) {
            health = "Unknown";
        } else if (errorRate !== null && errorRate >= 0.2) {
            health = "Critical";
        } else if (errorRate !== null && errorRate >= 0.05) {
            health = "Degraded";
        }

        // Bottleneck Definition (Explicit Mathematical Criterion):
        // 1. p95 latency >= 3x project median with sample size >= 3, OR
        // 2. error rate >= 20% with sample size >= 5
        let isBottleneck = false;
        let bottleneckReason: string | undefined;

        if (stats.durations.length >= 3 && p95Lat !== null && p95Lat >= projectMedianLatency * 3) {
            isBottleneck = true;
            bottleneckReason = `Extreme tail latency: p95 duration (${p95Lat}ms) is ≥3x project median (${projectMedianLatency}ms).`;
            bottlenecksCount++;
        } else if (stats.requests >= 5 && errorRate !== null && errorRate >= 0.2) {
            isBottleneck = true;
            bottleneckReason = `Severe error concentration: ${Math.round(errorRate * 100)}% failure rate over ${stats.requests} requests.`;
            bottlenecksCount++;
        }

        const incomingCount = incomingEdgeCounts.get(serviceName) || 0;
        const outgoingCount = outgoingEdgeCounts.get(serviceName) || 0;
        if (incomingCount === 0 && outgoingCount === 0) {
            isolatedCount++;
        }

        nodes.push({
            id: serviceName,
            name: serviceName === "UNKNOWN" ? "Unknown Service" : serviceName,
            environment: environment || "Production",
            requestVolume: stats.requests,
            errorCount: stats.errors,
            errorRate,
            avgLatencyMs: avgLat,
            p95LatencyMs: p95Lat,
            incomingDependenciesCount: incomingCount,
            outgoingDependenciesCount: outgoingCount,
            health,
            isBottleneck,
            bottleneckReason,
            operations: Array.from(stats.operations).slice(0, 15),
            sampleSizeAssessment:
                stats.requests === 0 ? "NONE" : stats.requests < 3 ? "LOW" : "SUFFICIENT",
        });
    }

    // Sort nodes deterministically: bottlenecks first, then by request volume desc, then by name asc
    nodes.sort((a, b) => {
        if (a.isBottleneck !== b.isBottleneck) return a.isBottleneck ? -1 : 1;
        if (b.requestVolume !== a.requestVolume) return b.requestVolume - a.requestVolume;
        return a.name.localeCompare(b.name);
    });

    // 8. Build Edges and classify Edge Bottlenecks
    const edges: TopologyEdge[] = [];

    for (const edge of edgesMap.values()) {
        const errorRate = edge.callCount > 0 ? edge.errorCount / edge.callCount : null;
        const avgLat = edge.durations.length > 0
            ? Math.round(edge.durations.reduce((a, b) => a + b, 0) / edge.durations.length)
            : null;
        const p50Lat = calculatePercentile(edge.durations, 50);
        const p95Lat = calculatePercentile(edge.durations, 95);
        const p99Lat = calculatePercentile(edge.durations, 99);

        let isBottleneck = false;
        let bottleneckReason: string | undefined;

        if (edge.durations.length >= 3 && p95Lat !== null && p95Lat >= projectMedianLatency * 3) {
            isBottleneck = true;
            bottleneckReason = `High dependency latency: p95 response time is ${p95Lat}ms (≥3x median).`;
        } else if (edge.callCount >= 5 && errorRate !== null && errorRate >= 0.2) {
            isBottleneck = true;
            bottleneckReason = `Failing dependency: ${Math.round(errorRate * 100)}% of calls from ${edge.source} to ${edge.target} failed.`;
        }

        const operations = Array.from(edge.operationsMap.entries()).map(([op, opStat]) => ({
            operation: op,
            callCount: opStat.callCount,
            errorCount: opStat.errorCount,
        }));

        edges.push({
            id: `${edge.source}->${edge.target}`,
            source: edge.source,
            target: edge.target,
            callCount: edge.callCount,
            errorCount: edge.errorCount,
            errorRate,
            avgLatencyMs: avgLat,
            p50LatencyMs: p50Lat,
            p95LatencyMs: p95Lat,
            p99LatencyMs: p99Lat,
            classification: "OBSERVED",
            isBottleneck,
            bottleneckReason,
            operations,
            supportingTraces: Array.from(edge.supportingTracesSet),
            isSelfCall: edge.isSelfCall,
        });
    }

    // Sort edges deterministically: errors desc, then callCount desc, then id asc
    edges.sort((a, b) => {
        if (b.errorCount !== a.errorCount) return b.errorCount - a.errorCount;
        if (b.callCount !== a.callCount) return b.callCount - a.callCount;
        return a.id.localeCompare(b.id);
    });

    return {
        nodes,
        edges,
        timeRange,
        totalServices: nodes.length,
        totalDependencies: edges.filter((e) => !e.isSelfCall).length,
        bottlenecksCount,
        isolatedServicesCount: isolatedCount,
    };
}

/**
 * 2. Service Failure Heatmap Derivation
 */
export async function getFailureHeatmap(params: {
    projectId: string;
    timeRangeKey?: string;
    customStart?: Date;
    customEnd?: Date;
    metric?: "ERROR_RATE" | "FAILURE_COUNT" | "LATENCY_P95";
    environment?: string;
    providedUserId?: string;
}): Promise<ServiceFailureHeatmap> {
    const { projectId, timeRangeKey, customStart, customEnd, metric = "ERROR_RATE", environment, providedUserId } = params;

    const { organization } = await requireProjectAccess(projectId, providedUserId);
    await requireCapability(organization.id, "TEAM_CROSS_SERVICE_TOPOLOGY");

    const timeRange = resolveBoundedTimeRange(timeRangeKey, customStart, customEnd);
    const BUCKETS_COUNT = 12; // 12 discrete time slices across the window
    const durationTotalMs = timeRange.end.getTime() - timeRange.start.getTime();
    const bucketDurationMs = durationTotalMs / BUCKETS_COUNT;

    const eventWhere: any = {
        projectId,
        timestamp: { gte: timeRange.start, lte: timeRange.end },
    };
    if (environment && environment !== "ALL") {
        eventWhere.environment = { name: environment };
    }

    const events = await prisma.event.findMany({
        where: eventWhere,
        select: {
            service: true,
            status: true,
            severity: true,
            type: true,
            durationMs: true,
            timestamp: true,
        },
        take: 5000,
    });

    const serviceSet = new Set<string>();
    for (const ev of events) {
        serviceSet.add(ev.service?.trim() || "UNKNOWN");
    }
    const services = Array.from(serviceSet).sort();

    // Initialize cells: services x BUCKETS_COUNT
    const bucketStats = new Map<string, {
        total: number;
        errors: number;
        durations: number[];
    }>();

    for (const ev of events) {
        const sName = ev.service?.trim() || "UNKNOWN";
        const offsetMs = ev.timestamp.getTime() - timeRange.start.getTime();
        const rawBucketIndex = Math.floor(offsetMs / bucketDurationMs);
        const bucketIndex = Math.max(0, Math.min(rawBucketIndex, BUCKETS_COUNT - 1));

        const cellKey = `${sName}:${bucketIndex}`;
        let b = bucketStats.get(cellKey);
        if (!b) {
            b = { total: 0, errors: 0, durations: [] };
            bucketStats.set(cellKey, b);
        }

        b.total++;
        const isError = Boolean(
            ev.severity === "ERROR" ||
            ev.severity === "FATAL" ||
            ev.type === "ERROR" ||
            (ev.status && String(ev.status).startsWith("5"))
        );

        if (isError) b.errors++;
        if (typeof ev.durationMs === "number" && ev.durationMs >= 0) {
            b.durations.push(ev.durationMs);
        }
    }

    const cells: HeatmapCell[] = [];
    for (const sName of services) {
        for (let i = 0; i < BUCKETS_COUNT; i++) {
            const bStart = new Date(timeRange.start.getTime() + i * bucketDurationMs);
            const bEnd = new Date(timeRange.start.getTime() + (i + 1) * bucketDurationMs);
            const key = `${sName}:${i}`;
            const stats = bucketStats.get(key);

            if (!stats || stats.total === 0) {
                cells.push({
                    service: sName,
                    bucketIndex: i,
                    bucketStart: bStart,
                    bucketEnd: bEnd,
                    totalRequests: 0,
                    failedRequests: 0,
                    errorRate: null,
                    avgLatencyMs: null,
                    p95LatencyMs: null,
                });
            } else {
                const errorRate = stats.errors / stats.total;
                const avgLat = stats.durations.length > 0
                    ? Math.round(stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length)
                    : null;
                const p95Lat = calculatePercentile(stats.durations, 95);

                cells.push({
                    service: sName,
                    bucketIndex: i,
                    bucketStart: bStart,
                    bucketEnd: bEnd,
                    totalRequests: stats.total,
                    failedRequests: stats.errors,
                    errorRate,
                    avgLatencyMs: avgLat,
                    p95LatencyMs: p95Lat,
                });
            }
        }
    }

    const metricDefinition =
        metric === "ERROR_RATE"
            ? "Error Rate: failedRequests / totalRequests (Traffic-normalized, null when 0 requests)."
            : metric === "FAILURE_COUNT"
            ? "Failure Count: Absolute volume of failed requests."
            : "p95 Latency: 95th percentile execution duration in ms.";

    return {
        timeRange,
        bucketsCount: BUCKETS_COUNT,
        services,
        cells,
        metric,
        metricDefinition,
    };
}

/**
 * 3. Cross-Service Failure Propagation Reconstructor
 */
export async function getServiceFailurePropagation(params: {
    projectId: string;
    eventId: string;
    providedUserId?: string;
}): Promise<ServiceFailurePropagation> {
    const { projectId, eventId, providedUserId } = params;

    const { organization } = await requireProjectAccess(projectId, providedUserId);
    await requireCapability(organization.id, "TEAM_CROSS_SERVICE_TOPOLOGY");

    const targetEvent = await prisma.event.findUnique({
        where: { id: eventId },
    });

    if (!targetEvent || targetEvent.projectId !== projectId) {
        throw new AuthorizationError(
            "FORBIDDEN",
            "Event not found or does not belong to this project"
        );
    }

    const traceId = targetEvent.traceId;
    if (!traceId) {
        return {
            traceId: "NONE",
            initiatingEventId: eventId,
            originService: targetEvent.service || "UNKNOWN",
            impactedService: targetEvent.service || "UNKNOWN",
            chainLength: 1,
            steps: [
                {
                    stepIndex: 1,
                    service: targetEvent.service || "UNKNOWN",
                    operation: targetEvent.operation || targetEvent.title || "operation",
                    status: targetEvent.status,
                    durationMs: targetEvent.durationMs,
                    timestamp: targetEvent.timestamp,
                    role: "ORIGIN_ROOT_CAUSE",
                    isFailure: true,
                    failingEventId: targetEvent.id,
                },
            ],
            propagationObserved: false,
            explanation: "No distributed traceId present; cross-service propagation cannot be established without trace context.",
        };
    }

    // Retrieve all spans in this distributed trace
    const traceEvents = await prisma.event.findMany({
        where: { projectId, traceId },
        orderBy: { timestamp: "asc" },
    });

    const steps: FailurePropagationStep[] = [];
    const participatingServices = new Set<string>();

    for (let i = 0; i < traceEvents.length; i++) {
        const ev = traceEvents[i];
        const sName = ev.service?.trim() || "UNKNOWN";
        participatingServices.add(sName);

        const isError = Boolean(
            ev.id === targetEvent.id ||
            ev.severity === "ERROR" ||
            ev.severity === "FATAL" ||
            ev.type === "ERROR" ||
            (ev.status && String(ev.status).startsWith("5"))
        );

        const meta = (ev.metadata as Record<string, any>) || {};
        const tags = (ev.tags as Record<string, any>) || {};

        let role: FailurePropagationStep["role"] = "TRANSITIVE_PROPAGATOR";
        if (i === 0) {
            role = "ORIGIN_ROOT_CAUSE";
        } else if (i === traceEvents.length - 1) {
            role = "IMPACTED_SURFACE";
        }

        steps.push({
            stepIndex: i + 1,
            service: sName,
            operation: ev.operation || ev.title || "operation",
            spanId: meta.spanId || tags.spanId,
            parentSpanId: meta.parentSpanId || tags.parentSpanId,
            status: ev.status,
            durationMs: ev.durationMs,
            timestamp: ev.timestamp,
            role,
            isFailure: isError,
            failingEventId: isError ? ev.id : undefined,
        });
    }

    const originService = steps[0]?.service || "UNKNOWN";
    const impactedService = steps[steps.length - 1]?.service || originService;
    const propagationObserved = participatingServices.size > 1;

    const explanation = propagationObserved
        ? `Observed cross-service failure propagation across ${participatingServices.size} services (${Array.from(participatingServices).join(" → ")}) within distributed trace ${traceId}.`
        : `Execution remained confined within ${originService}; no cross-service propagation observed.`;

    return {
        traceId,
        initiatingEventId: eventId,
        originService,
        impactedService,
        chainLength: steps.length,
        steps,
        propagationObserved,
        explanation,
    };
}
