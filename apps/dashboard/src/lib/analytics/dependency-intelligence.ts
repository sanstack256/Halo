import { prisma } from "@/lib/prisma";
import type {
    DependencyIntelligenceData,
    DependencyNode,
    DependencyEdge,
    BlastRadiusResult,
    ServiceHealthStatus,
    DataProvenance,
    CriticalPathItem,
} from "./types";
import { parseTimeRange } from "./time";
import { computeDynamicGraphLayout } from "./graph-layout";
export { computeBlastRadius } from "./blast-radius";

export interface DependencyIntelligenceParams {
    organizationId: string;
    projectId?: string;
    environment?: string;
    timeRangeKey?: string;
    userTimezone?: string;
}

export async function fetchDependencyIntelligenceAnalytics(
    params: DependencyIntelligenceParams
): Promise<DependencyIntelligenceData> {
    const timeRange = parseTimeRange(params.timeRangeKey, "NONE");

    // 1. Resolve Projects
    const projectWhere: any = { organizationId: params.organizationId };
    if (params.projectId && params.projectId !== "ALL") {
        projectWhere.id = params.projectId;
    }

    const projects = await prisma.project.findMany({
        where: projectWhere,
        select: { id: true, name: true },
    });

    const projectIds = projects.map((p) => p.id);
    const projectNameMap = new Map(projects.map((p) => [p.id, p.name]));

    if (projectIds.length === 0) {
        return createEmptyDependencyData(timeRange, params);
    }

    // 2. Query Events with traceId, service, resource, and duration
    const eventFilter: any = {
        projectId: { in: projectIds },
        timestamp: {
            gte: timeRange.start,
            lte: timeRange.end,
        },
    };

    if (params.environment && params.environment !== "ALL") {
        eventFilter.environment = { name: params.environment };
    }

    const [events, issues, releases] = await Promise.all([
        prisma.event.findMany({
            where: eventFilter,
            select: {
                id: true,
                type: true,
                service: true,
                resource: true,
                operation: true,
                traceId: true,
                durationMs: true,
                timestamp: true,
                projectId: true,
                metadata: true,
            },
            orderBy: { timestamp: "asc" },
        }),
        prisma.issue.findMany({
            where: { projectId: { in: projectIds }, status: "OPEN" },
            select: { id: true, title: true, projectId: true },
        }),
        prisma.release.findMany({
            where: { projectId: { in: projectIds } },
            select: { id: true, version: true, projectId: true },
        }),
    ]);

    // 3. Extract Nodes (Services & Resources)
    type NodeAccumulator = {
        name: string;
        type: DependencyNode["type"];
        projectId: string;
        errorCount: number;
        totalCount: number;
        durations: number[];
    };

    const nodeMap = new Map<string, NodeAccumulator>();

    for (const evt of events) {
        const sName = evt.service || "web-service";
        const nodeKey = `service:${sName}`;

        const node = nodeMap.get(nodeKey) || {
            name: sName,
            type: "SERVICE",
            projectId: evt.projectId,
            errorCount: 0,
            totalCount: 0,
            durations: [],
        };

        node.totalCount++;
        if (evt.type === "ERROR") node.errorCount++;
        if (typeof evt.durationMs === "number" && evt.durationMs > 0) node.durations.push(evt.durationMs);
        nodeMap.set(nodeKey, node);

        // Also identify database / resource targets from resource attribute
        if (evt.resource && evt.resource !== sName) {
            const rKey = `resource:${evt.resource}`;
            const rNode = nodeMap.get(rKey) || {
                name: evt.resource,
                type: evt.resource.includes("db") || evt.resource.includes("postgres") || evt.resource.includes("sql")
                    ? "DATABASE"
                    : "EXTERNAL",
                projectId: evt.projectId,
                errorCount: 0,
                totalCount: 0,
                durations: [],
            };
            rNode.totalCount++;
            if (evt.type === "ERROR") rNode.errorCount++;
            nodeMap.set(rKey, rNode);
        }
    }

    // 4. Reconstruct Edges from Shared Trace Spans and Resource Relationships
    type EdgeKey = `${string}->${string}`;
    type EdgeAccumulator = {
        source: string;
        target: string;
        callCount: number;
        errorCount: number;
        durations: number[];
        lastObservedAt: Date;
        evidenceType: DependencyEdge["evidence"]["type"];
        sampleTracesCount: number;
    };

    const edgeMap = new Map<EdgeKey, EdgeAccumulator>();

    // Group events by traceId to identify cross-service calls
    const traceGroups = new Map<string, typeof events>();
    for (const evt of events) {
        if (!evt.traceId) continue;
        const group = traceGroups.get(evt.traceId) || [];
        group.push(evt);
        traceGroups.set(evt.traceId, group);
    }

    // Traverse trace cascades
    for (const [traceId, spanList] of traceGroups.entries()) {
        if (spanList.length < 2) continue;
        // Sort spans chronologically
        spanList.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        for (let i = 0; i < spanList.length - 1; i++) {
            const src = spanList[i].service || "web-service";
            const dst = spanList[i + 1].service || spanList[i + 1].resource || "downstream-service";

            if (src === dst) continue;

            const edgeKey: EdgeKey = `${src}->${dst}`;
            const existing = edgeMap.get(edgeKey) || {
                source: src,
                target: dst,
                callCount: 0,
                errorCount: 0,
                durations: [],
                lastObservedAt: spanList[i].timestamp,
                evidenceType: "TRACE_SPAN",
                sampleTracesCount: 0,
            };

            existing.callCount++;
            existing.sampleTracesCount++;
            if (spanList[i + 1].type === "ERROR") existing.errorCount++;
            if (typeof spanList[i + 1].durationMs === "number" && spanList[i + 1].durationMs! > 0) {
                existing.durations.push(spanList[i + 1].durationMs!);
            }
            if (spanList[i].timestamp > existing.lastObservedAt) {
                existing.lastObservedAt = spanList[i].timestamp;
            }
            edgeMap.set(edgeKey, existing);
        }
    }

    // Connect services directly to their recorded resources
    for (const evt of events) {
        if (evt.resource && evt.service && evt.resource !== evt.service) {
            const edgeKey: EdgeKey = `${evt.service}->${evt.resource}`;
            const existing = edgeMap.get(edgeKey) || {
                source: evt.service,
                target: evt.resource,
                callCount: 0,
                errorCount: 0,
                durations: [],
                lastObservedAt: evt.timestamp,
                evidenceType: "SERVICE_METADATA",
                sampleTracesCount: 1,
            };
            existing.callCount++;
            if (evt.type === "ERROR") existing.errorCount++;
            if (typeof evt.durationMs === "number" && evt.durationMs > 0) existing.durations.push(evt.durationMs);
            if (evt.timestamp > existing.lastObservedAt) existing.lastObservedAt = evt.timestamp;
            edgeMap.set(edgeKey, existing);
        }
    }

    // 5. Build Dependency Nodes
    const rawNodesList: DependencyNode[] = Array.from(nodeMap.values()).map((n) => {
        const errorRate = n.totalCount > 0 ? Math.round((n.errorCount / n.totalCount) * 1000) / 10 : 0;
        n.durations.sort((a, b) => a - b);
        const avgLatency =
            n.durations.length > 0
                ? Math.round(n.durations.reduce((a, b) => a + b, 0) / n.durations.length)
                : null;

        const health: ServiceHealthStatus =
            n.totalCount === 0 ? "Unknown" : errorRate >= 20 ? "Critical" : errorRate >= 5 ? "Degraded" : "Healthy";

        const recentIssueCount = issues.filter(
            (i) => i.projectId === n.projectId && i.title.toLowerCase().includes(n.name.toLowerCase())
        ).length;

        const recentReleaseCount = releases.filter((r) => r.projectId === n.projectId).length;

        return {
            id: n.name,
            name: n.name,
            type: n.type,
            projectId: n.projectId,
            projectName: projectNameMap.get(n.projectId) || "Unknown",
            health,
            errorRate,
            totalCalls: n.totalCount,
            avgLatencyMs: avgLatency,
            recentIssueCount,
            recentReleaseCount,
        };
    });

    // 6. Build Dependency Edges
    const rawEdgesList: DependencyEdge[] = Array.from(edgeMap.values()).map((e) => {
        const errorRate = e.callCount > 0 ? Math.round((e.errorCount / e.callCount) * 1000) / 10 : 0;
        e.durations.sort((a, b) => a - b);
        const avgLatency =
            e.durations.length > 0 ? Math.round(e.durations.reduce((a, b) => a + b, 0) / e.durations.length) : null;
        const p95Latency =
            e.durations.length > 0 ? e.durations[Math.floor(e.durations.length * 0.95)] || e.durations[e.durations.length - 1] : null;

        const description =
            e.evidenceType === "TRACE_SPAN"
                ? `Observed ${e.sampleTracesCount} distributed trace execution spans linking '${e.source}' to '${e.target}'.`
                : `Observed ${e.callCount} request metadata telemetry records calling target '${e.target}'.`;

        return {
            id: `${e.source}->${e.target}`,
            source: e.source,
            target: e.target,
            callCount: e.callCount,
            errorCount: e.errorCount,
            errorRate,
            avgLatencyMs: avgLatency,
            p95LatencyMs: p95Latency,
            lastObservedAt: e.lastObservedAt.toISOString(),
            evidence: {
                type: e.evidenceType,
                observedSampleCount: e.sampleTracesCount || e.callCount,
                description,
            },
        };
    });

    // 7. Compute Collision-Free Dynamic Layout and Critical Paths
    const layouted = computeDynamicGraphLayout(rawNodesList, rawEdgesList);
    const observedCallTotal = rawEdgesList.reduce((sum, e) => sum + e.callCount, 0);

    const limitations: string[] = [];
    if (traceGroups.size < 5) {
        limitations.push("Trace coverage is limited (< 5 traces); relationships are derived primarily from recorded service metadata.");
    }

    const dataQuality: DataProvenance["dataQuality"] =
        rawNodesList.length === 0 ? "No telemetry" : "Complete";

    const provenance: DataProvenance = {
        sources: ["Distributed Trace Collector", "Service Telemetry Index", "Resource Dependency Graph"],
        projectId: params.projectId !== "ALL" ? params.projectId : undefined,
        projectName: params.projectId && params.projectId !== "ALL" ? projectNameMap.get(params.projectId) : "All Organization Projects",
        environment: params.environment || "All Environments",
        timeRange: {
            key: timeRange.key,
            start: timeRange.start.toISOString(),
            end: timeRange.end.toISOString(),
        },
        totalEventsAnalyzed: events.length,
        totalTracesAnalyzed: traceGroups.size,
        totalErrorsAnalyzed: events.filter((e) => e.type === "ERROR").length,
        methodology: "Trace correlation and causal span linking. Edges drawn exclusively from observed distributed trace spans and request telemetry.",
        dataQuality,
        limitations,
        lastCalculatedAt: new Date().toISOString(),
    };

    return {
        nodes: layouted.nodes,
        edges: layouted.edges,
        criticalPaths: layouted.criticalPaths,
        observedCallTotal,
        provenance,
    };
}

function createEmptyDependencyData(timeRange: any, params: DependencyIntelligenceParams): DependencyIntelligenceData {
    return {
        nodes: [],
        edges: [],
        criticalPaths: [],
        observedCallTotal: 0,
        provenance: {
            sources: ["Distributed Trace Collector"],
            timeRange: {
                key: timeRange.key,
                start: timeRange.start.toISOString(),
                end: timeRange.end.toISOString(),
            },
            totalEventsAnalyzed: 0,
            totalTracesAnalyzed: 0,
            totalErrorsAnalyzed: 0,
            methodology: "Distributed trace span graph.",
            dataQuality: "No telemetry",
            lastCalculatedAt: new Date().toISOString(),
        },
    };
}
