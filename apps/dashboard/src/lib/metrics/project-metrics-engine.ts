import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getOrganization } from "@/lib/organization";
import { parseTimeRange, calculateMetricComparison, type ResolvedTimeRange } from "@/lib/analytics/time";
import type {
  MetricsFilterParams,
  ProjectMetricsIntelligence,
  ProjectHealthSnapshot,
  TimeSeriesBucket,
  TopErrorIssueSummary,
  ErrorBehaviorData,
  RequestPerformanceData,
  ServiceHealthDistribution,
  ServiceHealthMetric,
  ReleaseImpactData,
  ReleaseImpactMetric,
  ErrorConcentrationData,
  ErrorConcentrationItem,
  UserImpactData,
  TelemetryCoverageData,
  CoverageDimension,
  TemporalAnomaliesData,
  TemporalAnomaly,
  ProjectTrendsData,
  TrendComparisonPoint,
  CoverageStatus,
  MetricComparison,
} from "./types";

interface TelemetryUserRecord {
  id?: string;
  email?: string;
  username?: string;
  key?: string;
}

interface EventFilterWhere {
  projectId: string;
  environmentId?: string;
  service?: string;
  release?: string;
  timestamp?: {
    gte: Date;
    lte: Date;
  };
}

export function isFailedStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase().trim();
  if (
    normalized === "error" ||
    normalized === "failed" ||
    normalized === "failure" ||
    normalized === "timeout" ||
    normalized === "timed_out" ||
    normalized === "500" ||
    normalized === "502" ||
    normalized === "503" ||
    normalized === "504"
  ) {
    return true;
  }
  const numeric = Number(status);
  if (Number.isFinite(numeric)) {
    return numeric >= 400;
  }
  return false;
}

export function calculatePercentile(values: number[], percentileRank: number): number | null {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileRank / 100) * sorted.length) - 1;
  const clampedIndex = Math.max(0, Math.min(index, sorted.length - 1));
  return sorted[clampedIndex];
}

export function resolveTimeWindow(filter: MetricsFilterParams): ResolvedTimeRange {
  if (filter.timeRange === "custom" && filter.from && filter.to) {
    const start = new Date(filter.from);
    const end = new Date(filter.to);
    const durationMs = Math.max(end.getTime() - start.getTime(), 60 * 1000);
    const comparisonStart = new Date(start.getTime() - durationMs);
    const comparisonEnd = new Date(start.getTime());
    let bucketCount = 24;
    if (durationMs <= 3600 * 1000) bucketCount = 12;
    else if (durationMs <= 86400 * 1000) bucketCount = 24;
    else bucketCount = 30;

    return {
      key: "24h", // fallback key compatible with ResolvedTimeRange
      start,
      end,
      comparisonStart,
      comparisonEnd,
      bucketCount,
      bucketIntervalMs: Math.floor(durationMs / bucketCount),
    };
  }

  return parseTimeRange(filter.timeRange, "PREVIOUS_PERIOD");
}

export async function getProjectMetricsIntelligence(
  projectIdOrSlug: string,
  filterParams: Partial<MetricsFilterParams> = {}
): Promise<ProjectMetricsIntelligence> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized: You must be logged in to view metrics");
  }

  const organization = await getOrganization(session.user.id);
  if (!organization) {
    throw new Error("Unauthorized: Organization not found");
  }

  const project = await prisma.project.findFirst({
    where: {
      OR: [{ id: projectIdOrSlug }, { slug: projectIdOrSlug }],
      organizationId: organization.id,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      environments: {
        select: { id: true, name: true },
      },
    },
  });

  if (!project) {
    throw new Error("Project not found or unauthorized access");
  }

  const effectiveFilter: MetricsFilterParams = {
    timeRange: filterParams.timeRange || "24h",
    from: filterParams.from,
    to: filterParams.to,
    environment: filterParams.environment,
    service: filterParams.service,
    release: filterParams.release,
  };

  const timeRange = resolveTimeWindow(effectiveFilter);

  // Build Prisma where clauses
  const baseWhere: EventFilterWhere = {
    projectId: project.id,
  };
  if (effectiveFilter.environment && effectiveFilter.environment !== "ALL") {
    baseWhere.environmentId = effectiveFilter.environment;
  }
  if (effectiveFilter.service && effectiveFilter.service !== "ALL") {
    baseWhere.service = effectiveFilter.service;
  }
  if (effectiveFilter.release && effectiveFilter.release !== "ALL") {
    baseWhere.release = effectiveFilter.release;
  }

  // Fetch distinct services and releases for filters
  const [servicesRaw, releasesRaw] = await Promise.all([
    prisma.event.findMany({
      where: { projectId: project.id, service: { not: null } },
      distinct: ["service"],
      select: { service: true },
      take: 50,
    }),
    prisma.release.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      select: { version: true },
      take: 20,
    }),
  ]);

  const availableServices = servicesRaw
    .map((s) => s.service)
    .filter((s): s is string => Boolean(s));
  const availableReleases = releasesRaw.map((r) => r.version);

  // Current window query
  const currentEventsWhere: EventFilterWhere = {
    ...baseWhere,
    timestamp: {
      gte: timeRange.start,
      lte: timeRange.end,
    },
  };

  // Comparison window query
  const previousEventsWhere: EventFilterWhere | null = timeRange.comparisonStart && timeRange.comparisonEnd
    ? {
        ...baseWhere,
        timestamp: {
          gte: timeRange.comparisonStart,
          lte: timeRange.comparisonEnd,
        },
      }
    : null;

  // Concurrent data fetching
  const [
    currentEvents,
    previousEvents,
    currentSessions,
    openIssues,
    allReleases,
  ] = await Promise.all([
    prisma.event.findMany({
      where: currentEventsWhere,
      select: {
        id: true,
        type: true,
        title: true,
        timestamp: true,
        service: true,
        operation: true,
        resource: true,
        status: true,
        durationMs: true,
        user: true,
        sessionId: true,
        issueId: true,
        release: true,
        traceId: true,
        requestId: true,
        breadcrumbs: true,
      },
      orderBy: { timestamp: "asc" },
    }),
    previousEventsWhere
      ? prisma.event.findMany({
          where: previousEventsWhere,
          select: {
            id: true,
            type: true,
            status: true,
            durationMs: true,
            operation: true,
            user: true,
            sessionId: true,
            issueId: true,
          },
        })
      : Promise.resolve([]),
    prisma.telemetrySession.findMany({
      where: {
        projectId: project.id,
        startedAt: {
          gte: timeRange.start,
          lte: timeRange.end,
        },
      },
      select: {
        id: true,
        userKey: true,
        crashedAt: true,
        startedAt: true,
        lastSeenAt: true,
      },
    }),
    prisma.issue.findMany({
      where: {
        projectId: project.id,
        status: "OPEN",
      },
      select: {
        id: true,
        title: true,
        severity: true,
        firstSeen: true,
        lastSeen: true,
        eventCount: true,
      },
      orderBy: { lastSeen: "desc" },
      take: 10,
    }),
    prisma.release.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        version: true,
        createdAt: true,
        eventCount: true,
        errorCount: true,
        traceCount: true,
      },
    }),
  ]);

  const hasTelemetry = currentEvents.length > 0 || currentSessions.length > 0;

  // 1. PROJECT HEALTH SNAPSHOT CALCULATIONS
  const currentRequests = currentEvents.filter(
    (e) => e.type === "TRACE" || e.durationMs !== null || e.operation !== null || e.requestId !== null
  );
  const currentFailedRequests = currentRequests.filter(
    (e) => isFailedStatus(e.status) || e.type === "ERROR"
  );
  const currentErrors = currentEvents.filter((e) => e.type === "ERROR");

  const prevRequests = previousEvents.filter(
    (e) => e.type === "TRACE" || e.durationMs !== null || e.operation !== null
  );
  const prevFailedRequests = prevRequests.filter((e) => isFailedStatus(e.status));

  // Error Rate: failed requests / total requests (or errors / (requests + errors) if only errors logged)
  const currentErrorRate =
    currentRequests.length > 0
      ? (currentFailedRequests.length / currentRequests.length) * 100
      : currentErrors.length > 0
      ? 100
      : null;

  const prevErrorRate =
    prevRequests.length > 0
      ? (prevFailedRequests.length / prevRequests.length) * 100
      : null;

  const errorRateCompRaw = calculateMetricComparison(currentErrorRate, prevErrorRate, true, true);
  const errorRateComp: MetricComparison = {
    current: currentErrorRate ?? 0,
    previous: prevErrorRate,
    relativeDiffPct: errorRateCompRaw.relativeDiffPct,
    percentagePointsDiff: errorRateCompRaw.percentagePointsDiff,
    direction:
      errorRateCompRaw.isImprovement === true
        ? "down"
        : errorRateCompRaw.isImprovement === false
        ? "up"
        : "flat",
    isImprovement: errorRateCompRaw.isImprovement ?? true,
    timeWindowLabel: `vs previous ${timeRange.key}`,
    sufficientBaseline: prevRequests.length >= 5,
  };

  // Request Volume
  const reqVolCompRaw = calculateMetricComparison(currentRequests.length, prevRequests.length, false, false);
  const requestVolumeComp: MetricComparison = {
    current: currentRequests.length,
    previous: prevRequests.length,
    relativeDiffPct: reqVolCompRaw.relativeDiffPct,
    direction:
      currentRequests.length > prevRequests.length
        ? "up"
        : currentRequests.length < prevRequests.length
        ? "down"
        : "flat",
    isImprovement: currentRequests.length >= prevRequests.length,
    timeWindowLabel: `vs previous ${timeRange.key}`,
    sufficientBaseline: previousEvents.length > 0,
  };

  // P95 Latency
  const currentLatencies = currentRequests
    .map((r) => r.durationMs)
    .filter((d): d is number => typeof d === "number" && d >= 0);
  const prevLatencies = prevRequests
    .map((r) => r.durationMs)
    .filter((d): d is number => typeof d === "number" && d >= 0);

  const currentP95 = calculatePercentile(currentLatencies, 95);
  const prevP95 = calculatePercentile(prevLatencies, 95);

  const p95CompRaw = calculateMetricComparison(currentP95, prevP95, false, true);
  const p95LatencyComp: MetricComparison = {
    current: currentP95 ?? 0,
    previous: prevP95,
    relativeDiffPct: p95CompRaw.relativeDiffPct,
    direction:
      p95CompRaw.isImprovement === true
        ? "down"
        : p95CompRaw.isImprovement === false
        ? "up"
        : "flat",
    isImprovement: p95CompRaw.isImprovement ?? true,
    timeWindowLabel: `vs previous ${timeRange.key}`,
    sufficientBaseline: prevLatencies.length >= 5,
  };

  // Failed Requests
  const failedReqCompRaw = calculateMetricComparison(
    currentFailedRequests.length,
    prevFailedRequests.length,
    false,
    true
  );
  const failedRequestsComp: MetricComparison = {
    current: currentFailedRequests.length,
    previous: prevFailedRequests.length,
    relativeDiffPct: failedReqCompRaw.relativeDiffPct,
    direction:
      currentFailedRequests.length > prevFailedRequests.length
        ? "up"
        : currentFailedRequests.length < prevFailedRequests.length
        ? "down"
        : "flat",
    isImprovement: failedReqCompRaw.isImprovement ?? true,
    timeWindowLabel: `vs previous ${timeRange.key}`,
    sufficientBaseline: previousEvents.length > 0,
  };

  // Affected Users: Extract distinct users
  function extractUserIdentifiers(
    events: { user: unknown }[],
    sessions: { userKey: string | null }[]
  ): Set<string> {
    const userSet = new Set<string>();
    for (const session of sessions) {
      if (session.userKey) userSet.add(session.userKey);
    }
    for (const event of events) {
      if (event.user && typeof event.user === "object") {
        const u = event.user as TelemetryUserRecord;
        const id = u.id || u.email || u.username || u.key;
        if (typeof id === "string" && id.trim()) {
          userSet.add(id.trim());
        }
      }
    }
    return userSet;
  }

  const currentAffectedEvents = currentEvents.filter(
    (e) => e.type === "ERROR" || isFailedStatus(e.status)
  );
  const currentAffectedUsersSet = extractUserIdentifiers(currentAffectedEvents, []);
  const previousAffectedEvents = previousEvents.filter(
    (e) => e.type === "ERROR" || isFailedStatus(e.status)
  );
  const previousAffectedUsersSet = extractUserIdentifiers(previousAffectedEvents, []);

  const affectedUsersCount = currentAffectedUsersSet.size;
  const prevAffectedUsersCount = previousAffectedUsersSet.size;

  const usersCompRaw = calculateMetricComparison(affectedUsersCount, prevAffectedUsersCount, false, true);
  const affectedUsersComp: MetricComparison = {
    current: affectedUsersCount,
    previous: prevAffectedUsersCount,
    relativeDiffPct: usersCompRaw.relativeDiffPct,
    direction:
      affectedUsersCount > prevAffectedUsersCount
        ? "up"
        : affectedUsersCount < prevAffectedUsersCount
        ? "down"
        : "flat",
    isImprovement: usersCompRaw.isImprovement ?? true,
    timeWindowLabel: `vs previous ${timeRange.key}`,
    sufficientBaseline: previousEvents.length > 0,
  };

  // Active Issues
  const activeIssuesComp: MetricComparison = {
    current: openIssues.length,
    previous: null,
    relativeDiffPct: null,
    direction: "flat",
    isImprovement: true,
    timeWindowLabel: "current open issues",
    sufficientBaseline: true,
  };

  const healthSnapshot: ProjectHealthSnapshot = {
    errorRate: errorRateComp,
    requestVolume: requestVolumeComp,
    p95LatencyMs: p95LatencyComp,
    failedRequests: failedRequestsComp,
    affectedUsers: affectedUsersComp,
    activeIssues: activeIssuesComp,
    totalEventsObserved: currentEvents.length,
    hasSufficientSample: currentRequests.length >= 5 || currentErrors.length >= 5,
  };

  // 2. TIME-SERIES BUCKETING (Preserving distinction between NO_TELEMETRY vs ZERO_ERRORS)
  const bucketCount = timeRange.bucketCount;
  const intervalMs = timeRange.bucketIntervalMs;
  const timeSeries: TimeSeriesBucket[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const bStartMs = timeRange.start.getTime() + i * intervalMs;
    const bEndMs = bStartMs + intervalMs;
    const bStart = new Date(bStartMs);

    const bucketEvents = currentEvents.filter(
      (e) => e.timestamp.getTime() >= bStartMs && e.timestamp.getTime() < bEndMs
    );
    const bucketSessions = currentSessions.filter(
      (s) => s.startedAt.getTime() >= bStartMs && s.startedAt.getTime() < bEndMs
    );

    const hasTelemetryInBucket = bucketEvents.length > 0 || bucketSessions.length > 0;
    const bRequests = bucketEvents.filter(
      (e) => e.type === "TRACE" || e.durationMs !== null || e.operation !== null || e.requestId !== null
    );
    const bErrors = bucketEvents.filter((e) => e.type === "ERROR");
    const bFailedRequests = bRequests.filter((e) => isFailedStatus(e.status));

    const bLatencies = bRequests
      .map((r) => r.durationMs)
      .filter((d): d is number => typeof d === "number" && d >= 0);

    const bErrorRate =
      bRequests.length > 0
        ? (bFailedRequests.length / bRequests.length) * 100
        : bErrors.length > 0
        ? 100
        : null;

    timeSeries.push({
      timestamp: bStart.toISOString(),
      hasTelemetry: hasTelemetryInBucket,
      requestCount: bRequests.length,
      errorCount: bErrors.length,
      failedRequestCount: bFailedRequests.length,
      errorRate: bErrorRate !== null ? Math.round(bErrorRate * 10) / 10 : null,
      p50LatencyMs: calculatePercentile(bLatencies, 50),
      p75LatencyMs: calculatePercentile(bLatencies, 75),
      p95LatencyMs: calculatePercentile(bLatencies, 95),
      p99LatencyMs: calculatePercentile(bLatencies, 99),
      activeSessions: bucketSessions.length,
    });
  }

  // Top Error Issues Breakdown
  const issueErrorCountMap = new Map<string, { count: number; users: Set<string>; sessions: Set<string>; firstSeen: Date; lastSeen: Date }>();

  for (const ev of currentErrors) {
    if (ev.issueId) {
      const existing = issueErrorCountMap.get(ev.issueId) || {
        count: 0,
        users: new Set<string>(),
        sessions: new Set<string>(),
        firstSeen: ev.timestamp,
        lastSeen: ev.timestamp,
      };
      existing.count++;
      if (ev.user && typeof ev.user === "object") {
        const u = ev.user as TelemetryUserRecord;
        const uid = u.id || u.email || u.key;
        if (uid) existing.users.add(String(uid));
      }
      if (ev.sessionId) existing.sessions.add(ev.sessionId);
      if (ev.timestamp < existing.firstSeen) existing.firstSeen = ev.timestamp;
      if (ev.timestamp > existing.lastSeen) existing.lastSeen = ev.timestamp;
      issueErrorCountMap.set(ev.issueId, existing);
    }
  }

  const topIssues: TopErrorIssueSummary[] = openIssues
    .map((issue) => {
      const stats = issueErrorCountMap.get(issue.id) || {
        count: issue.eventCount,
        users: new Set<string>(),
        sessions: new Set<string>(),
        firstSeen: issue.firstSeen,
        lastSeen: issue.lastSeen,
      };
      return {
        id: issue.id,
        title: issue.title,
        severity: issue.severity,
        errorCount: stats.count,
        affectedUsers: stats.users.size,
        affectedSessions: stats.sessions.size,
        firstSeen: stats.firstSeen.toISOString(),
        lastSeen: stats.lastSeen.toISOString(),
        trend: (stats.count > 10 ? "escalating" : "stable") as "escalating" | "stable" | "declining",
      };
    })
    .sort((a, b) => b.errorCount - a.errorCount)
    .slice(0, 5);

  const errorBehavior: ErrorBehaviorData = {
    timeSeries,
    topIssues,
    totalErrors: currentErrors.length,
    totalFailedRequests: currentFailedRequests.length,
    hasTelemetry,
  };

  // 3. REQUEST PERFORMANCE
  const durationSeconds = Math.max(1, (timeRange.end.getTime() - timeRange.start.getTime()) / 1000);
  const overallThroughputRps = Math.round((currentRequests.length / durationSeconds) * 100) / 100;
  const overallFailureRate =
    currentRequests.length > 0
      ? Math.round((currentFailedRequests.length / currentRequests.length) * 1000) / 10
      : null;

  const requestPerformance: RequestPerformanceData = {
    timeSeries,
    overallThroughputRps,
    overallP50LatencyMs: calculatePercentile(currentLatencies, 50),
    overallP75LatencyMs: calculatePercentile(currentLatencies, 75),
    overallP95LatencyMs: calculatePercentile(currentLatencies, 95),
    overallP99LatencyMs: calculatePercentile(currentLatencies, 99),
    overallFailureRate,
    sampleSize: currentRequests.length,
    hasSufficientSample: currentRequests.length >= 5,
  };

  // 4. SERVICE HEALTH DISTRIBUTION
  const serviceStatsMap = new Map<
    string,
    {
      requests: number;
      errors: number;
      failedRequests: number;
      latencies: number[];
      users: Set<string>;
    }
  >();

  for (const ev of currentEvents) {
    const sName = ev.service || "default";
    const existing = serviceStatsMap.get(sName) || {
      requests: 0,
      errors: 0,
      failedRequests: 0,
      latencies: [],
      users: new Set<string>(),
    };

    if (ev.type === "TRACE" || ev.durationMs !== null || ev.operation !== null) {
      existing.requests++;
      if (typeof ev.durationMs === "number") existing.latencies.push(ev.durationMs);
      if (isFailedStatus(ev.status)) existing.failedRequests++;
    }
    if (ev.type === "ERROR") {
      existing.errors++;
    }
    if (ev.user && typeof ev.user === "object") {
      const u = ev.user as TelemetryUserRecord;
      const uid = u.id || u.email;
      if (uid) existing.users.add(String(uid));
    }
    serviceStatsMap.set(sName, existing);
  }

  const serviceDistributionList: ServiceHealthMetric[] = Array.from(serviceStatsMap.entries()).map(
    ([serviceName, stats]) => {
      const p95 = calculatePercentile(stats.latencies, 95);
      const totalReq = stats.requests;
      const errRate = totalReq > 0 ? (stats.failedRequests / totalReq) * 100 : stats.errors > 0 ? 100 : null;

      // Deterministic impact ranking formula:
      const rankScore = stats.errors * 3 + (p95 && p95 > 1000 ? 5 : 0) + (errRate && errRate > 5 ? 10 : 0);

      const impactScoreReason =
        stats.errors > 0
          ? `${stats.errors} errors observed, ${errRate !== null ? errRate.toFixed(1) : 0}% failure rate`
          : "Zero failures observed; baseline operational throughput";

      return {
        serviceName,
        requestVolume: stats.requests,
        errorCount: stats.errors,
        errorRate: errRate !== null ? Math.round(errRate * 10) / 10 : null,
        p95LatencyMs: p95,
        affectedUsers: stats.users.size,
        activeIssuesCount: 0,
        impactRank: rankScore,
        impactScoreReason,
      };
    }
  );

  serviceDistributionList.sort((a, b) => b.impactRank - a.impactRank);

  const serviceDistribution: ServiceHealthDistribution = {
    services: serviceDistributionList,
    hasTelemetry: serviceDistributionList.length > 0,
  };

  // 5. RELEASE / CHANGE IMPACT
  const releaseImpactList: ReleaseImpactMetric[] = allReleases.map((rel) => {
    const relEvents = currentEvents.filter((e) => e.release === rel.version);
    const relRequests = relEvents.filter(
      (e) => e.type === "TRACE" || e.durationMs !== null || e.operation !== null
    );
    const relErrors = relEvents.filter((e) => e.type === "ERROR");
    const relFailed = relRequests.filter((e) => isFailedStatus(e.status));
    const relLatencies = relRequests
      .map((r) => r.durationMs)
      .filter((d): d is number => typeof d === "number" && d >= 0);

    const relUsers = extractUserIdentifiers(relEvents, []);
    const relErrorRate =
      relRequests.length > 0
        ? (relFailed.length / relRequests.length) * 100
        : relErrors.length > 0
        ? 100
        : null;

    const firstEv = relEvents.length > 0 ? relEvents[0].timestamp.toISOString() : null;
    const lastEv = relEvents.length > 0 ? relEvents[relEvents.length - 1].timestamp.toISOString() : null;

    return {
      version: rel.version,
      createdAt: rel.createdAt.toISOString(),
      requestCountObserved: relRequests.length,
      errorCountObserved: relErrors.length,
      errorRateObserved: relErrorRate !== null ? Math.round(relErrorRate * 10) / 10 : null,
      p95LatencyMsObserved: calculatePercentile(relLatencies, 95),
      affectedUsersObserved: relUsers.size,
      activeIssuesObserved: openIssues.length,
      firstEventObservedAt: firstEv,
      lastEventObservedAt: lastEv,
      observationContext: "Observed telemetry associated with this release identifier",
    };
  });

  const releaseImpact: ReleaseImpactData = {
    releases: releaseImpactList,
    hasTelemetry: releaseImpactList.length > 0 && releaseImpactList.some((r) => r.requestCountObserved > 0 || r.errorCountObserved > 0),
  };

  // 6. ERROR CONCENTRATION
  const endpointErrorMap = new Map<string, number>();
  const serviceErrorMap = new Map<string, number>();
  const errorTypeMap = new Map<string, number>();

  for (const err of currentErrors) {
    const ep = err.operation || err.resource || "Unspecified Endpoint";
    endpointErrorMap.set(ep, (endpointErrorMap.get(ep) || 0) + 1);

    const svc = err.service || "default";
    serviceErrorMap.set(svc, (serviceErrorMap.get(svc) || 0) + 1);

    const type = err.title || "Generic Error";
    errorTypeMap.set(type, (errorTypeMap.get(type) || 0) + 1);
  }

  const totalErrors = currentErrors.length;
  const toConcentrationItems = (
    map: Map<string, number>,
    dimension: ErrorConcentrationItem["dimension"]
  ): ErrorConcentrationItem[] => {
    return Array.from(map.entries())
      .map(([name, count]) => ({
        dimension,
        name,
        errorCount: count,
        percentageOfTotalErrors:
          totalErrors > 0 ? Math.round((count / totalErrors) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 6);
  };

  const errorConcentration: ErrorConcentrationData = {
    byEndpoint: toConcentrationItems(endpointErrorMap, "endpoint"),
    byService: toConcentrationItems(serviceErrorMap, "service"),
    byErrorType: toConcentrationItems(errorTypeMap, "error_type"),
    totalErrorsObserved: totalErrors,
    hasTelemetry: totalErrors > 0,
  };

  // 7. USER IMPACT
  const allIdentifiedUsers = extractUserIdentifiers(currentEvents, currentSessions);
  const totalCapturedSessionsCount = currentSessions.length;
  const failedSessionsCount = currentSessions.filter((s) => s.crashedAt !== null).length;
  const affectedSessionsSet = new Set<string>();

  for (const ev of currentAffectedEvents) {
    if (ev.sessionId) affectedSessionsSet.add(ev.sessionId);
  }
  for (const s of currentSessions) {
    if (s.crashedAt) affectedSessionsSet.add(s.id);
  }

  const affectedSessionsCount = affectedSessionsSet.size;
  const percentageOfObservedSessionsWithErrors =
    totalCapturedSessionsCount > 0
      ? Math.round((affectedSessionsCount / totalCapturedSessionsCount) * 1000) / 10
      : null;

  const errorOccurrencesPerAffectedUser =
    affectedUsersCount > 0
      ? Math.round((currentErrors.length / affectedUsersCount) * 10) / 10
      : null;

  let userTelemetryQuality: UserImpactData["userTelemetryQuality"] = "unavailable";
  let qualityMessage = "User impact unavailable from captured telemetry.";

  if (allIdentifiedUsers.size > 0) {
    userTelemetryQuality = "identified_users_observed";
    qualityMessage = `Derived from ${allIdentifiedUsers.size} unique identified users across observed events.`;
  } else if (totalCapturedSessionsCount > 0) {
    userTelemetryQuality = "anonymous_sessions_only";
    qualityMessage = `User identity not captured; evaluating ${totalCapturedSessionsCount} observed anonymous sessions.`;
  }

  const userImpact: UserImpactData = {
    affectedUsersCount,
    affectedSessionsCount,
    totalCapturedSessionsCount,
    failedSessionsCount,
    percentageOfObservedSessionsWithErrors,
    errorOccurrencesPerAffectedUser,
    userTelemetryQuality,
    qualityMessage,
  };

  // 8. TELEMETRY COVERAGE / EVIDENCE QUALITY
  const tracesObserved = currentRequests.length;
  const errorsObserved = currentErrors.length;
  const sessionsObserved = currentSessions.length;
  const traceLinkageCount = currentEvents.filter((e) => e.traceId && e.requestId).length;
  const dbSpansCount = currentEvents.filter(
    (e) => e.type === "TRACE" && (e.operation?.toLowerCase().includes("sql") || e.operation?.toLowerCase().includes("query") || e.resource?.toLowerCase().includes("db"))
  ).length;

  const getStatus = (count: number, threshold: number): CoverageStatus => {
    if (count >= threshold) return "OBSERVED";
    if (count > 0) return "PARTIAL";
    return "NOT CAPTURED";
  };

  const dimensions: CoverageDimension[] = [
    {
      name: "Request Telemetry",
      description: "HTTP/RPC operations with duration and status tracking",
      status: getStatus(tracesObserved, 10),
      observedCount: tracesObserved,
      details: `${tracesObserved} HTTP / RPC traces captured in time window`,
    },
    {
      name: "Error Telemetry",
      description: "Captured exceptions and unhandled errors",
      status: getStatus(errorsObserved, 1),
      observedCount: errorsObserved,
      details: `${errorsObserved} error events captured`,
    },
    {
      name: "Session Telemetry",
      description: "User session lifecycle and crash state tracking",
      status: getStatus(sessionsObserved, 5),
      observedCount: sessionsObserved,
      details: `${sessionsObserved} client sessions recorded`,
    },
    {
      name: "Distributed Trace Linkage",
      description: "Events correlated with both traceId and requestId",
      status: getStatus(traceLinkageCount, 5),
      observedCount: traceLinkageCount,
      details: `${traceLinkageCount} events have end-to-end trace correlation`,
    },
    {
      name: "Database / Resource Spans",
      description: "Database queries and external service operations captured",
      status: getStatus(dbSpansCount, 5),
      observedCount: dbSpansCount,
      details: `${dbSpansCount} downstream database operations monitored`,
    },
    {
      name: "User Identity Resolution",
      description: "Telemetry enriched with distinct user identifier key",
      status: allIdentifiedUsers.size > 0 ? "OBSERVED" : "NOT CAPTURED",
      observedCount: allIdentifiedUsers.size,
      details:
        allIdentifiedUsers.size > 0
          ? `${allIdentifiedUsers.size} distinct user identities resolved`
          : "Anonymous telemetry without user resolution",
    },
  ];

  const observedDimensionsCount = dimensions.filter((d) => d.status === "OBSERVED").length;
  const overallObservationTier: CoverageStatus =
    observedDimensionsCount >= 4
      ? "OBSERVED"
      : observedDimensionsCount >= 2
      ? "PARTIAL"
      : hasTelemetry
      ? "LIMITED"
      : "NOT CAPTURED";

  const observedTelemetryGaps: string[] = [];
  if (tracesObserved === 0) observedTelemetryGaps.push("No request traces captured in window");
  if (allIdentifiedUsers.size === 0) observedTelemetryGaps.push("User identity attributes not present in events");
  if (traceLinkageCount === 0 && tracesObserved > 0) observedTelemetryGaps.push("Traces lack distributed correlation IDs");
  if (dbSpansCount === 0 && tracesObserved > 0) observedTelemetryGaps.push("No database spans detected");

  const telemetryCoverage: TelemetryCoverageData = {
    dimensions,
    overallObservationTier,
    observedTelemetryGaps,
  };

  // 9. TEMPORAL ANOMALIES (Deterministic rule-based detections)
  const anomalies: TemporalAnomaly[] = [];

  // Rule 1: Error rate spike (> 3x previous period with >= 3 current errors)
  if (
    currentErrorRate !== null &&
    prevErrorRate !== null &&
    prevErrorRate > 0 &&
    currentErrorRate >= prevErrorRate * 3 &&
    currentErrors.length >= 3
  ) {
    anomalies.push({
      id: "anomaly-error-spike",
      type: "error_spike",
      title: "Observed Error Rate Deviation",
      description: `Current error rate (${currentErrorRate.toFixed(1)}%) is ${(
        currentErrorRate / prevErrorRate
      ).toFixed(1)}x higher than baseline (${prevErrorRate.toFixed(1)}%).`,
      timestamp: timeRange.end.toISOString(),
      severity: "critical",
      evidenceValue: `${currentErrorRate.toFixed(1)}% error rate (${currentErrors.length} errors)`,
      baselineValue: `${prevErrorRate.toFixed(1)}% baseline`,
      ruleTriggered: "current_error_rate >= 3.0 * previous_error_rate AND errors >= 3",
    });
  }

  // Rule 2: Latency spike (> 2x previous period p95 with >= 5 requests)
  if (
    currentP95 !== null &&
    prevP95 !== null &&
    prevP95 > 0 &&
    currentP95 >= prevP95 * 2 &&
    currentRequests.length >= 5
  ) {
    anomalies.push({
      id: "anomaly-latency-spike",
      type: "latency_spike",
      title: "Observed P95 Latency Degradation",
      description: `P95 latency reached ${currentP95}ms compared to ${prevP95}ms in previous period (${(
        currentP95 / prevP95
      ).toFixed(1)}x slower).`,
      timestamp: timeRange.end.toISOString(),
      severity: "warning",
      evidenceValue: `${currentP95}ms p95`,
      baselineValue: `${prevP95}ms baseline`,
      ruleTriggered: "current_p95 >= 2.0 * previous_p95 AND samples >= 5",
    });
  }

  // Rule 3: Traffic drop (< 0.5x previous period requests with baseline >= 20)
  if (
    prevRequests.length >= 20 &&
    currentRequests.length < prevRequests.length * 0.5
  ) {
    anomalies.push({
      id: "anomaly-traffic-drop",
      type: "traffic_drop",
      title: "Observed Request Volume Reduction",
      description: `Request throughput dropped from ${prevRequests.length} to ${currentRequests.length} (-${Math.round(
        (1 - currentRequests.length / prevRequests.length) * 100
      )}%).`,
      timestamp: timeRange.end.toISOString(),
      severity: "info",
      evidenceValue: `${currentRequests.length} requests observed`,
      baselineValue: `${prevRequests.length} previous requests`,
      ruleTriggered: "current_requests < 0.5 * previous_requests AND baseline >= 20",
    });
  }

  const temporalAnomalies: TemporalAnomaliesData = {
    anomalies,
    detectionPeriodLabel: `Evaluated across ${timeRange.key} window vs prior period`,
    evaluationNote: "Detections derive strictly from thresholded mathematical deviations on captured telemetry.",
  };

  // 10. PROJECT TRENDS
  const ppDiff = errorRateComp.percentagePointsDiff;
  const trends: TrendComparisonPoint[] = [
    {
      metricName: "Error Rate",
      currentValue: currentErrorRate !== null ? `${currentErrorRate.toFixed(1)}%` : "No requests",
      previousValue: prevErrorRate !== null ? `${prevErrorRate.toFixed(1)}%` : "Not observed",
      changePct: ppDiff ?? null,
      trendDirection:
        ppDiff === null || ppDiff === undefined || !errorRateComp.sufficientBaseline
          ? "not_enough_telemetry"
          : ppDiff < 0
          ? "improving"
          : ppDiff > 0
          ? "degrading"
          : "neutral",
      commentary:
        errorRateComp.sufficientBaseline && ppDiff !== null && ppDiff !== undefined
          ? `${Math.abs(ppDiff)} percentage points difference`
          : "Insufficient baseline telemetry to evaluate longitudinal error rate shift",
    },
    {
      metricName: "P95 Latency",
      currentValue: currentP95 !== null ? `${currentP95}ms` : "No duration data",
      previousValue: prevP95 !== null ? `${prevP95}ms` : "Not observed",
      changePct: p95CompRaw.relativeDiffPct,
      trendDirection:
        p95CompRaw.relativeDiffPct === null || !p95LatencyComp.sufficientBaseline
          ? "not_enough_telemetry"
          : p95CompRaw.relativeDiffPct < 0
          ? "improving"
          : p95CompRaw.relativeDiffPct > 0
          ? "degrading"
          : "neutral",
      commentary:
        p95LatencyComp.sufficientBaseline && p95CompRaw.relativeDiffPct !== null
          ? `${p95CompRaw.relativeDiffPct > 0 ? "+" : ""}${p95CompRaw.relativeDiffPct}% change in tail response time`
          : "Insufficient latency samples in previous window for statistical comparison",
    },
    {
      metricName: "Request Volume",
      currentValue: `${currentRequests.length} requests`,
      previousValue: `${prevRequests.length} requests`,
      changePct: reqVolCompRaw.relativeDiffPct,
      trendDirection:
        reqVolCompRaw.relativeDiffPct === null || !requestVolumeComp.sufficientBaseline
          ? "not_enough_telemetry"
          : reqVolCompRaw.relativeDiffPct >= 0
          ? "improving"
          : "degrading",
      commentary:
        requestVolumeComp.sufficientBaseline && reqVolCompRaw.relativeDiffPct !== null
          ? `${reqVolCompRaw.relativeDiffPct > 0 ? "+" : ""}${reqVolCompRaw.relativeDiffPct}% traffic variation`
          : "Previous window request baseline not available",
    },
  ];

  const projectTrends: ProjectTrendsData = {
    comparisons: trends,
    evaluationWindowDays: Math.ceil(
      (timeRange.end.getTime() - timeRange.start.getTime()) / (24 * 3600 * 1000)
    ),
  };

  return {
    projectId: project.id,
    projectName: project.name,
    filterApplied: effectiveFilter,
    timeWindow: {
      from: timeRange.start.toISOString(),
      to: timeRange.end.toISOString(),
      previousFrom: timeRange.comparisonStart?.toISOString() || "",
      previousTo: timeRange.comparisonEnd?.toISOString() || "",
      bucketSizeMinutes: Math.round(timeRange.bucketIntervalMs / 60000),
    },
    hasTelemetry,
    healthSnapshot,
    errorBehavior,
    requestPerformance,
    serviceDistribution,
    releaseImpact,
    errorConcentration,
    userImpact,
    telemetryCoverage,
    temporalAnomalies,
    projectTrends,
    availableEnvironments: project.environments,
    availableServices,
    availableReleases,
  };
}
