import { prisma } from "../prisma";
import { parseTimeRange, calculateMetricComparison } from "../analytics/time";

export type HealthStatus = "Healthy" | "Degraded" | "Critical" | "Unknown";

export type HealthReasonCode =
    | "INSUFFICIENT_TELEMETRY"
    | "FATAL_EXCEPTIONS"
    | "ACTIVE_MONITOR_ALERT"
    | "CRITICAL_FAILURE_RATE"
    | "ERROR_RATE_SURGE"
    | "LATENCY_REGRESSION"
    | "ELEVATED_ERROR_RATE"
    | "NORMAL_STABILITY";

export const CANONICAL_HEALTH_THRESHOLDS = {
    CRITICAL_ERROR_RATE_PCT: 20,
    DEGRADED_ERROR_RATE_PCT: 5,
    DEGRADED_ERROR_SURGE_PCT: 50,
    DEGRADED_LATENCY_SURGE_PCT: 50,
};

export type HealthTransition = {
    previousHealth: HealthStatus;
    currentHealth: HealthStatus;
    changedAt: Date;
    triggerReason: string;
};

export interface CanonicalService {
    id: string; // "serviceName"
    name: string;
    description: string | null;
    projectId: string;
    projectName: string;
    environment: string;
    environments: string[];
    owner: string; // e.g. "Unassigned" or team name from tags
    repository: string | null; // e.g. "owner/repo" from project config
    runtime: string | null; // e.g. "Node.js", "Go", "Python" from SDK / tags
    language: string | null;
    framework: string | null;
    currentRelease: string | null;
    firstSeen: Date | null;
    lastSeen: Date | null;
    health: HealthStatus;
    healthReasonCode: HealthReasonCode;
    healthReason: string;
    healthTransition: HealthTransition | null;
    metrics: {
        requestCount: number;
        errorCount: number;
        errorRate: number | null; // null if requestCount === 0
        fatalCount: number;
        avgLatencyMs: number | null;
        p95LatencyMs: number | null;
        dependencyCount: number;
        dependentCount: number;
        activeIssuesCount: number;
    };
    trend: "Improving" | "Stable" | "Degrading" | "Volatile" | "Unknown";
}

export interface ServiceDependencyNode {
    id: string;
    name: string;
    type: "service" | "database" | "cache" | "queue" | "external_api";
    health: HealthStatus;
    isExternal: boolean;
    owner: string;
    environment: string;
    incomingCount: number;
    outgoingCount: number;
    requestVolume: number;
    errorRate: number | null;
    avgLatencyMs: number | null;
}

export interface ServiceDependencyEdge {
    source: string;
    target: string;
    callCount: number;
    errorCount: number;
    errorRate: number | null;
    avgLatencyMs: number | null;
    p95LatencyMs: number | null;
    relationship: "CALLS" | "QUERIES" | "PRODUCES_TO" | "CONSUMES_FROM";
    evidenceSource: "distributed_trace" | "resource_call";
}

export interface ServicesFilterParams {
    organizationId?: string;
    projectId?: string;
    environment?: string;
    timeRangeKey?: string;
    search?: string;
    health?: HealthStatus | "ALL";
    owner?: string;
}

/**
 * Evaluates deterministic, evidence-based health for a service with latency regression detection.
 */
export function evaluateCanonicalHealth(stats: {
    requestCount: number;
    errorCount: number;
    fatalCount: number;
    hasFiringAlert: boolean;
    errorRateSurgePct: number | null;
    avgLatencyMs?: number | null;
    p95LatencyMs?: number | null;
    baselineAvgLatencyMs?: number | null;
    baselineP95LatencyMs?: number | null;
    latencySurgePct?: number | null;
}): { health: HealthStatus; healthReasonCode: HealthReasonCode; healthReason: string } {
    if (stats.requestCount === 0) {
        return {
            health: "Unknown",
            healthReasonCode: "INSUFFICIENT_TELEMETRY",
            healthReason: "Insufficient telemetry in the selected time window.",
        };
    }

    const errorRate = (stats.errorCount / stats.requestCount) * 100;

    if (stats.fatalCount > 0) {
        return {
            health: "Critical",
            healthReasonCode: "FATAL_EXCEPTIONS",
            healthReason: `${stats.fatalCount} fatal exception(s) recorded with ${errorRate.toFixed(1)}% failure rate.`,
        };
    }

    if (stats.hasFiringAlert) {
        return {
            health: "Critical",
            healthReasonCode: "ACTIVE_MONITOR_ALERT",
            healthReason: "Active firing monitor alert associated with this service.",
        };
    }

    if (errorRate >= CANONICAL_HEALTH_THRESHOLDS.CRITICAL_ERROR_RATE_PCT) {
        return {
            health: "Critical",
            healthReasonCode: "CRITICAL_FAILURE_RATE",
            healthReason: `Critical failure rate of ${errorRate.toFixed(1)}% (${stats.errorCount} errors across ${stats.requestCount} requests).`,
        };
    }

    if (typeof stats.errorRateSurgePct === "number" && stats.errorRateSurgePct > CANONICAL_HEALTH_THRESHOLDS.DEGRADED_ERROR_SURGE_PCT) {
        return {
            health: "Degraded",
            healthReasonCode: "ERROR_RATE_SURGE",
            healthReason: `Error rate increased ${(stats.errorRateSurgePct / 100 + 1).toFixed(1)}× compared to baseline (${errorRate.toFixed(1)}%).`,
        };
    }

    if (typeof stats.latencySurgePct === "number" && stats.latencySurgePct > CANONICAL_HEALTH_THRESHOLDS.DEGRADED_LATENCY_SURGE_PCT) {
        return {
            health: "Degraded",
            healthReasonCode: "LATENCY_REGRESSION",
            healthReason: `p95 latency regressed by ${stats.latencySurgePct.toFixed(0)}% (${stats.baselineP95LatencyMs ?? "?"}ms → ${stats.p95LatencyMs ?? "?"}ms) compared to baseline.`,
        };
    }

    if (errorRate >= CANONICAL_HEALTH_THRESHOLDS.DEGRADED_ERROR_RATE_PCT) {
        return {
            health: "Degraded",
            healthReasonCode: "ELEVATED_ERROR_RATE",
            healthReason: `Elevated error rate of ${errorRate.toFixed(1)}% (${stats.errorCount} errors across ${stats.requestCount} requests).`,
        };
    }

    // Healthy state with evidence-backed rationale
    let latencyText = "";
    if (typeof stats.p95LatencyMs === "number") {
        if (typeof stats.baselineP95LatencyMs === "number" && typeof stats.latencySurgePct === "number") {
            latencyText = `stable p95 latency (${stats.p95LatencyMs}ms vs ${stats.baselineP95LatencyMs}ms baseline)`;
        } else {
            latencyText = `${stats.p95LatencyMs}ms p95 latency`;
        }
    } else {
        latencyText = "no latency regressions";
    }

    return {
        health: "Healthy",
        healthReasonCode: "NORMAL_STABILITY",
        healthReason: `Operating normally with low error rate (${errorRate.toFixed(1)}%) and ${latencyText}.`,
    };
}

/**
 * Single source of truth for canonical service discovery, health calculation, and metrics.
 */
export async function queryCanonicalServices(params: ServicesFilterParams): Promise<{
    services: CanonicalService[];
    summary: {
        total: number;
        healthy: number;
        degraded: number;
        critical: number;
        unknown: number;
    };
    timeRange: { key: string; start: Date; end: Date };
}> {
    const timeRange = parseTimeRange(params.timeRangeKey || "24h", "PREVIOUS_PERIOD");

    // 1. Resolve organization & projects
    const projectWhere: any = {};
    if (params.organizationId) {
        projectWhere.organizationId = params.organizationId;
    }
    if (params.projectId && params.projectId !== "ALL") {
        projectWhere.id = params.projectId;
    }

    const projects = await prisma.project.findMany({
        where: projectWhere,
        select: {
            id: true,
            name: true,
            slug: true,
            githubRepoOwner: true,
            githubRepoName: true,
            environments: { select: { id: true, name: true } },
        },
    });

    if (projects.length === 0) {
        return {
            services: [],
            summary: { total: 0, healthy: 0, degraded: 0, critical: 0, unknown: 0 },
            timeRange: { key: timeRange.key, start: timeRange.start, end: timeRange.end },
        };
    }

    const projectIds = projects.map((p) => p.id);
    const projectMap = new Map(projects.map((p) => [p.id, p]));

    // 2. Build Event query filters for current & baseline windows
    const eventFilter: any = {
        projectId: { in: projectIds },
        service: { not: null },
        timestamp: { gte: timeRange.start, lte: timeRange.end },
    };
    if (params.environment && params.environment !== "ALL") {
        eventFilter.environment = { name: params.environment };
    }

    const compEventFilter: any = {
        projectId: { in: projectIds },
        service: { not: null },
        timestamp: { gte: timeRange.comparisonStart!, lte: timeRange.comparisonEnd! },
    };
    if (params.environment && params.environment !== "ALL") {
        compEventFilter.environment = { name: params.environment };
    }

    // 3. Query telemetry, releases, issues, firing alerts, and all-time discovered services in parallel
    const [currentEvents, comparisonEvents, releases, issues, firingAlerts, allTimeServices] = await Promise.all([
        prisma.event.findMany({
            where: eventFilter,
            select: {
                id: true,
                type: true,
                severity: true,
                timestamp: true,
                durationMs: true,
                service: true,
                projectId: true,
                traceId: true,
                resource: true,
                operation: true,
                release: true,
                tags: true,
                environment: { select: { name: true } },
            },
        }),
        prisma.event.findMany({
            where: compEventFilter,
            select: {
                id: true,
                type: true,
                durationMs: true,
                service: true,
                projectId: true,
            },
        }),
        prisma.release.findMany({
            where: {
                projectId: { in: projectIds },
            },
            orderBy: { createdAt: "desc" },
            take: 20,
        }),
        prisma.issue.findMany({
            where: {
                projectId: { in: projectIds },
                status: "OPEN",
            },
            select: { id: true, title: true, severity: true, projectId: true },
        }),
        prisma.monitorAlert.findMany({
            where: {
                status: "OPEN",
                monitor: { projectId: { in: projectIds } },
            },
            select: { id: true, monitor: { select: { name: true, query: true } } },
        }),
        prisma.event.groupBy({
            by: ["service", "projectId"],
            where: {
                projectId: { in: projectIds },
                service: { not: null },
            },
            _min: { timestamp: true },
            _max: { timestamp: true },
        }),
    ]);

    // 4. Build Aggregations per Service
    type ServiceAccumulator = {
        service: string;
        projectId: string;
        environments: Set<string>;
        firstSeen: Date | null;
        lastSeen: Date | null;
        currentEventsCount: number;
        errorCount: number;
        fatalCount: number;
        durations: number[];
        traceIds: Set<string>;
        releasesWithTime: Array<{ release: string; timestamp: Date }>;
        tagsList: any[];
    };

    const serviceMap = new Map<string, ServiceAccumulator>();

    // Initialize with all discovered services across all time
    for (const item of allTimeServices) {
        if (!item.service) continue;
        const key = `${item.service}::${item.projectId}`;
        serviceMap.set(key, {
            service: item.service,
            projectId: item.projectId,
            environments: new Set<string>(),
            firstSeen: item._min.timestamp || null,
            lastSeen: item._max.timestamp || null,
            currentEventsCount: 0,
            errorCount: 0,
            fatalCount: 0,
            durations: [],
            traceIds: new Set<string>(),
            releasesWithTime: [],
            tagsList: [],
        });
    }

    // Process current window events
    for (const evt of currentEvents) {
        if (!evt.service) continue;
        const key = `${evt.service}::${evt.projectId}`;
        let acc = serviceMap.get(key);
        if (!acc) {
            acc = {
                service: evt.service,
                projectId: evt.projectId,
                environments: new Set<string>(),
                firstSeen: evt.timestamp,
                lastSeen: evt.timestamp,
                currentEventsCount: 0,
                errorCount: 0,
                fatalCount: 0,
                durations: [],
                traceIds: new Set<string>(),
                releasesWithTime: [],
                tagsList: [],
            };
            serviceMap.set(key, acc);
        }

        acc.currentEventsCount++;
        if (evt.environment?.name) acc.environments.add(evt.environment.name);
        if (evt.type === "ERROR") acc.errorCount++;
        if (evt.severity === "FATAL") acc.fatalCount++;
        if (typeof evt.durationMs === "number" && evt.durationMs > 0) acc.durations.push(evt.durationMs);
        if (evt.traceId) acc.traceIds.add(evt.traceId);
        if (evt.release) acc.releasesWithTime.push({ release: evt.release, timestamp: evt.timestamp });
        if (evt.tags) acc.tagsList.push(evt.tags);

        if (!acc.lastSeen || evt.timestamp > acc.lastSeen) {
            acc.lastSeen = evt.timestamp;
        }
    }

    // Process comparison events for baseline calculations
    const compMap = new Map<string, { totalCount: number; errorCount: number; durations: number[] }>();
    for (const evt of comparisonEvents) {
        if (!evt.service) continue;
        const key = `${evt.service}::${evt.projectId}`;
        const entry = compMap.get(key) || { totalCount: 0, errorCount: 0, durations: [] };
        entry.totalCount++;
        if (evt.type === "ERROR") entry.errorCount++;
        if (typeof evt.durationMs === "number" && evt.durationMs > 0) entry.durations.push(evt.durationMs);
        compMap.set(key, entry);
    }

    // 5. Evaluate Canonical Health & Metadata for Each Service
    const allServices: CanonicalService[] = [];

    for (const acc of serviceMap.values()) {
        const proj = projectMap.get(acc.projectId);
        const projectName = proj ? proj.name : "Unknown";
        const repository = proj && proj.githubRepoOwner && proj.githubRepoName
            ? `${proj.githubRepoOwner}/${proj.githubRepoName}`
            : null;

        const requestCount = acc.currentEventsCount;
        const errorCount = acc.errorCount;
        const fatalCount = acc.fatalCount;
        const errorRate = requestCount > 0 ? Math.round((errorCount / requestCount) * 1000) / 10 : null;

        acc.durations.sort((a, b) => a - b);
        const avgLatencyMs = acc.durations.length > 0
            ? Math.round(acc.durations.reduce((sum, d) => sum + d, 0) / acc.durations.length)
            : null;
        const p95LatencyMs = acc.durations.length > 0
            ? acc.durations[Math.floor(acc.durations.length * 0.95)] || acc.durations[acc.durations.length - 1]
            : null;

        // Baseline comparison
        const comp = compMap.get(`${acc.service}::${acc.projectId}`);
        const prevErrorRate = comp && comp.totalCount > 0 ? (comp.errorCount / comp.totalCount) * 100 : null;
        const errorComparison = calculateMetricComparison(errorRate || 0, prevErrorRate, true, true);

        let baselineAvgLatencyMs: number | null = null;
        let baselineP95LatencyMs: number | null = null;
        let latencySurgePct: number | null = null;

        if (comp && comp.durations.length > 0) {
            comp.durations.sort((a, b) => a - b);
            baselineAvgLatencyMs = Math.round(comp.durations.reduce((a, b) => a + b, 0) / comp.durations.length);
            baselineP95LatencyMs = comp.durations[Math.floor(comp.durations.length * 0.95)] || comp.durations[comp.durations.length - 1];
            if (p95LatencyMs !== null && baselineP95LatencyMs !== null && baselineP95LatencyMs > 0) {
                latencySurgePct = Math.round(((p95LatencyMs - baselineP95LatencyMs) / baselineP95LatencyMs) * 100);
            }
        }

        // Check active monitor alerts
        const hasFiringAlert = firingAlerts.some(
            (a) => a.monitor.query?.toLowerCase().includes(acc.service.toLowerCase()) ||
                   a.monitor.name?.toLowerCase().includes(acc.service.toLowerCase())
        );

        // Evaluate Current Health via shared canonical function
        const { health, healthReasonCode, healthReason } = evaluateCanonicalHealth({
            requestCount,
            errorCount,
            fatalCount,
            hasFiringAlert,
            errorRateSurgePct: errorComparison.relativeDiffPct,
            avgLatencyMs,
            p95LatencyMs,
            baselineAvgLatencyMs,
            baselineP95LatencyMs,
            latencySurgePct,
        });

        // Evaluate Previous Health for Transition Detection
        let previousHealth: HealthStatus = "Healthy";
        if (!comp || comp.totalCount === 0) {
            previousHealth = "Unknown";
        } else {
            const prevRate = (comp.errorCount / comp.totalCount) * 100;
            if (prevRate >= CANONICAL_HEALTH_THRESHOLDS.CRITICAL_ERROR_RATE_PCT) previousHealth = "Critical";
            else if (prevRate >= CANONICAL_HEALTH_THRESHOLDS.DEGRADED_ERROR_RATE_PCT) previousHealth = "Degraded";
            else previousHealth = "Healthy";
        }

        let healthTransition: HealthTransition | null = null;
        if (health !== previousHealth && previousHealth !== "Unknown" && health !== "Unknown") {
            healthTransition = {
                previousHealth,
                currentHealth: health,
                changedAt: acc.lastSeen || new Date(),
                triggerReason: healthReason,
            };
        }

        // Extract runtime / framework / owner from tags if available
        let owner = "Unassigned";
        let runtime: string | null = null;
        let framework: string | null = null;
        let language: string | null = null;

        for (const tags of acc.tagsList) {
            if (typeof tags === "object" && tags !== null) {
                if ((tags as any).owner) owner = String((tags as any).owner);
                if ((tags as any).team) owner = String((tags as any).team);
                if ((tags as any).runtime) runtime = String((tags as any).runtime);
                if ((tags as any).framework) framework = String((tags as any).framework);
                if ((tags as any).language) language = String((tags as any).language);
            }
        }

        // Determine canonical active release version (sorted by latest event timestamp)
        let currentRelease: string | null = null;
        if (acc.releasesWithTime.length > 0) {
            acc.releasesWithTime.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            currentRelease = acc.releasesWithTime[0].release;
        } else {
            const latestRel = releases.find((r) => r.projectId === acc.projectId);
            if (latestRel) currentRelease = latestRel.version;
        }

        // Count active issues
        const activeIssuesCount = issues.filter(
            (i) => i.projectId === acc.projectId && i.title.toLowerCase().includes(acc.service.toLowerCase())
        ).length;

        // Trend calculation
        let trend: CanonicalService["trend"] = "Stable";
        if (requestCount === 0) {
            trend = "Unknown";
        } else if (errorComparison.relativeDiffPct !== null) {
            if (errorComparison.relativeDiffPct > 30) trend = "Degrading";
            else if (errorComparison.relativeDiffPct < -30) trend = "Improving";
            else trend = "Stable";
        } else if (errorRate !== null && errorRate > 15) {
            trend = "Volatile";
        }

        const envList = Array.from(acc.environments);
        const primaryEnv = envList.length > 0 ? envList[0] : (params.environment && params.environment !== "ALL" ? params.environment : "Production");

        allServices.push({
            id: acc.service,
            name: acc.service,
            description: null,
            projectId: acc.projectId,
            projectName,
            environment: primaryEnv,
            environments: envList.length > 0 ? envList : [primaryEnv],
            owner,
            repository,
            runtime,
            language,
            framework,
            currentRelease,
            firstSeen: acc.firstSeen,
            lastSeen: acc.lastSeen,
            health,
            healthReasonCode,
            healthReason,
            healthTransition,
            metrics: {
                requestCount,
                errorCount,
                errorRate,
                fatalCount,
                avgLatencyMs,
                p95LatencyMs,
                dependencyCount: Math.max(0, acc.traceIds.size),
                dependentCount: 0,
                activeIssuesCount,
            },
            trend,
        });
    }

    // 6. Calculate Summary based on ALL discovered services
    const summary = {
        total: allServices.length,
        healthy: allServices.filter((s) => s.health === "Healthy").length,
        degraded: allServices.filter((s) => s.health === "Degraded").length,
        critical: allServices.filter((s) => s.health === "Critical").length,
        unknown: allServices.filter((s) => s.health === "Unknown").length,
    };

    // 7. Apply Filters & Sorting
    let filtered = [...allServices];

    if (params.search && params.search.trim().length > 0) {
        const q = params.search.trim().toLowerCase();
        filtered = filtered.filter(
            (s) =>
                s.name.toLowerCase().includes(q) ||
                s.projectName.toLowerCase().includes(q) ||
                (s.repository && s.repository.toLowerCase().includes(q)) ||
                s.owner.toLowerCase().includes(q) ||
                s.environment.toLowerCase().includes(q)
        );
    }

    if (params.health && params.health !== "ALL") {
        filtered = filtered.filter((s) => s.health === params.health);
    }

    if (params.environment && params.environment !== "ALL") {
        filtered = filtered.filter((s) => s.environment.toLowerCase() === params.environment!.toLowerCase() || s.environments.includes(params.environment!));
    }

    if (params.owner && params.owner !== "ALL") {
        filtered = filtered.filter((s) => s.owner === params.owner);
    }

    // Default sorting: Most operationally important first (Critical -> Degraded -> Unknown -> Healthy, then by errorCount & requestCount)
    const healthWeight: Record<HealthStatus, number> = {
        Critical: 4,
        Degraded: 3,
        Unknown: 2,
        Healthy: 1,
    };

    filtered.sort((a, b) => {
        const diff = healthWeight[b.health] - healthWeight[a.health];
        if (diff !== 0) return diff;
        return b.metrics.errorCount - a.metrics.errorCount || b.metrics.requestCount - a.metrics.requestCount;
    });

    return {
        services: filtered,
        summary,
        timeRange: { key: timeRange.key, start: timeRange.start, end: timeRange.end },
    };
}

/**
 * Builds evidence-based service dependencies from real distributed traces and recorded resource calls.
 */
export async function queryCanonicalDependencies(params: ServicesFilterParams): Promise<{
    nodes: ServiceDependencyNode[];
    edges: ServiceDependencyEdge[];
    timeRange: { key: string; start: Date; end: Date };
}> {
    const { services, timeRange } = await queryCanonicalServices(params);

    const projectWhere: any = {};
    if (params.organizationId) projectWhere.organizationId = params.organizationId;
    if (params.projectId && params.projectId !== "ALL") projectWhere.id = params.projectId;

    const projects = await prisma.project.findMany({
        where: projectWhere,
        select: { id: true },
    });
    const projectIds = projects.map((p) => p.id);

    const eventWhere: any = {
        projectId: { in: projectIds },
        timestamp: { gte: timeRange.start, lte: timeRange.end },
        OR: [
            { traceId: { not: null } },
            { resource: { not: null } },
        ],
    };
    if (params.environment && params.environment !== "ALL") {
        eventWhere.environment = { name: params.environment };
    }

    const events = await prisma.event.findMany({
        where: eventWhere,
        select: {
            id: true,
            type: true,
            service: true,
            resource: true,
            operation: true,
            traceId: true,
            durationMs: true,
            timestamp: true,
        },
    });

    const nodesMap = new Map<string, ServiceDependencyNode>();
    const edgesMap = new Map<string, {
        source: string;
        target: string;
        callCount: number;
        errorCount: number;
        durations: number[];
        relationship: ServiceDependencyEdge["relationship"];
        evidenceSource: ServiceDependencyEdge["evidenceSource"];
    }>();

    // 1. Add all canonical services as base nodes
    for (const s of services) {
        nodesMap.set(s.name, {
            id: s.name,
            name: s.name,
            type: "service",
            health: s.health,
            isExternal: false,
            owner: s.owner,
            environment: s.environment,
            incomingCount: 0,
            outgoingCount: 0,
            requestVolume: s.metrics.requestCount,
            errorRate: s.metrics.errorRate,
            avgLatencyMs: s.metrics.avgLatencyMs,
        });
    }

    // 2. Extract Trace Spans
    const traceMap = new Map<string, typeof events>();
    for (const evt of events) {
        if (!evt.traceId) continue;
        const list = traceMap.get(evt.traceId) || [];
        list.push(evt);
        traceMap.set(evt.traceId, list);
    }

    for (const [, spanList] of traceMap.entries()) {
        spanList.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        for (let i = 0; i < spanList.length - 1; i++) {
            const current = spanList[i];
            const next = spanList[i + 1];

            if (current.service && next.service && current.service !== next.service) {
                const edgeKey = `${current.service}->${next.service}`;
                const edge = edgesMap.get(edgeKey) || {
                    source: current.service,
                    target: next.service,
                    callCount: 0,
                    errorCount: 0,
                    durations: [],
                    relationship: "CALLS" as const,
                    evidenceSource: "distributed_trace" as const,
                };
                edge.callCount++;
                if (next.type === "ERROR") edge.errorCount++;
                if (typeof next.durationMs === "number" && next.durationMs > 0) edge.durations.push(next.durationMs);
                edgesMap.set(edgeKey, edge);

                // Ensure nodes exist
                if (!nodesMap.has(current.service)) {
                    nodesMap.set(current.service, {
                        id: current.service,
                        name: current.service,
                        type: "service",
                        health: "Healthy",
                        isExternal: false,
                        owner: "Unassigned",
                        environment: "Production",
                        incomingCount: 0,
                        outgoingCount: 0,
                        requestVolume: 0,
                        errorRate: null,
                        avgLatencyMs: null,
                    });
                }
                if (!nodesMap.has(next.service)) {
                    nodesMap.set(next.service, {
                        id: next.service,
                        name: next.service,
                        type: "service",
                        health: "Healthy",
                        isExternal: false,
                        owner: "Unassigned",
                        environment: "Production",
                        incomingCount: 0,
                        outgoingCount: 0,
                        requestVolume: 0,
                        errorRate: null,
                        avgLatencyMs: null,
                    });
                }
            }
        }
    }

    // 3. Extract Observed Resource Calls (e.g. databases, caches, external APIs)
    for (const evt of events) {
        if (!evt.service || !evt.resource) continue;
        const res = evt.resource.trim();
        if (res.length === 0 || res.toLowerCase() === evt.service.toLowerCase()) continue;

        let resType: ServiceDependencyNode["type"] = "external_api";
        let relationship: ServiceDependencyEdge["relationship"] = "CALLS";
        const lowerRes = res.toLowerCase();

        if (lowerRes.includes("postgres") || lowerRes.includes("mysql") || lowerRes.includes("mongo") || lowerRes.includes("db") || lowerRes.includes("database")) {
            resType = "database";
            relationship = "QUERIES";
        } else if (lowerRes.includes("redis") || lowerRes.includes("memcached") || lowerRes.includes("cache")) {
            resType = "cache";
            relationship = "QUERIES";
        } else if (lowerRes.includes("kafka") || lowerRes.includes("rabbitmq") || lowerRes.includes("sqs") || lowerRes.includes("queue")) {
            resType = "queue";
            relationship = "PRODUCES_TO";
        }

        if (!nodesMap.has(res)) {
            nodesMap.set(res, {
                id: res,
                name: res,
                type: resType,
                health: "Healthy",
                isExternal: true,
                owner: "Infrastructure",
                environment: "Production",
                incomingCount: 0,
                outgoingCount: 0,
                requestVolume: 0,
                errorRate: null,
                avgLatencyMs: null,
            });
        }

        const edgeKey = `${evt.service}->${res}`;
        const edge = edgesMap.get(edgeKey) || {
            source: evt.service,
            target: res,
            callCount: 0,
            errorCount: 0,
            durations: [],
            relationship,
            evidenceSource: "resource_call" as const,
        };
        edge.callCount++;
        if (evt.type === "ERROR") edge.errorCount++;
        if (typeof evt.durationMs === "number" && evt.durationMs > 0) edge.durations.push(evt.durationMs);
        edgesMap.set(edgeKey, edge);
    }

    // 4. Calculate Incoming / Outgoing Counts and Edge Metrics
    const edges: ServiceDependencyEdge[] = [];
    for (const rawEdge of edgesMap.values()) {
        const srcNode = nodesMap.get(rawEdge.source);
        const tgtNode = nodesMap.get(rawEdge.target);
        if (srcNode) srcNode.outgoingCount++;
        if (tgtNode) tgtNode.incomingCount++;

        const errorRate = rawEdge.callCount > 0 ? Math.round((rawEdge.errorCount / rawEdge.callCount) * 1000) / 10 : null;
        rawEdge.durations.sort((a, b) => a - b);
        const avgLatencyMs = rawEdge.durations.length > 0
            ? Math.round(rawEdge.durations.reduce((a, b) => a + b, 0) / rawEdge.durations.length)
            : null;
        const p95LatencyMs = rawEdge.durations.length > 0
            ? rawEdge.durations[Math.floor(rawEdge.durations.length * 0.95)] || rawEdge.durations[rawEdge.durations.length - 1]
            : null;

        edges.push({
            source: rawEdge.source,
            target: rawEdge.target,
            callCount: rawEdge.callCount,
            errorCount: rawEdge.errorCount,
            errorRate,
            avgLatencyMs,
            p95LatencyMs,
            relationship: rawEdge.relationship,
            evidenceSource: rawEdge.evidenceSource,
        });
    }

    // Update node metrics
    for (const edge of edges) {
        const tgtNode = nodesMap.get(edge.target);
        if (tgtNode && tgtNode.isExternal) {
            tgtNode.requestVolume += edge.callCount;
            if (edge.errorRate !== null) {
                if (edge.errorRate >= CANONICAL_HEALTH_THRESHOLDS.CRITICAL_ERROR_RATE_PCT) tgtNode.health = "Critical";
                else if (edge.errorRate >= CANONICAL_HEALTH_THRESHOLDS.DEGRADED_ERROR_RATE_PCT) tgtNode.health = "Degraded";
            }
        }
    }

    return {
        nodes: Array.from(nodesMap.values()),
        edges,
        timeRange: { key: timeRange.key, start: timeRange.start, end: timeRange.end },
    };
}
