import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getOrganization } from "@/lib/organization";
import { calculateMetricComparison } from "@/lib/analytics/time";
import { formatUtcDateTime, formatUtcTime } from "./formatters";
import type {
  MetricsFilterParams,
  RedesignedProjectMetricsIntelligence,
  PrimaryTelemetryOverviewData,
  MetricOverviewItem,
  PrimaryChartBucket,
  ObservedChangesData,
  ObservedChangeRow,
  FailureConcentrationData,
  FailureConcentrationRow,
  ServicePerformanceData,
  ServicePerformanceRow,
  ReleaseBehaviorData,
  ReleaseBehaviorRow,
  ReleaseMarker,
  UserImpactData,
  TelemetryCoverageData,
  CoverageSignalItem,
  LongTermTrendData,
  ProjectTrendRow,
  TimeBucketState,
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

import { isFailedStatus, calculatePercentile, resolveTimeWindow, calculateErrorRate } from "./calculations";
export { isFailedStatus, calculatePercentile, resolveTimeWindow, calculateErrorRate };

export async function getProjectMetricsIntelligence(
  projectIdOrSlug: string,
  filterParams: Partial<MetricsFilterParams> = {}
): Promise<RedesignedProjectMetricsIntelligence> {
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
    allReleases,
    totalHistoricalEvents,
    replaySessionCount,
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
    prisma.release.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        version: true,
        createdAt: true,
        firstSeen: true,
        lastSeen: true,
        eventCount: true,
        errorCount: true,
        traceCount: true,
      },
    }),
    prisma.event.count({
      where: { projectId: project.id },
    }),
    prisma.replaySession.count({
      where: { projectId: project.id },
    }),
  ]);

  const hasTelemetry = currentEvents.length > 0 || currentSessions.length > 0;

  // Extract identified users helper
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

  // 1. PRIMARY TELEMETRY POPULATIONS
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

  // ERROR RATE CALCULATION: failed requests / observed requests * 100
  // Handled strictly through calculateErrorRate to guarantee 0/0 is null (undefined), never 100%
  const errorRateResult = calculateErrorRate(
    currentRequests.length,
    currentFailedRequests.length,
    currentErrors.length,
    hasTelemetry
  );
  const currentErrorRate = errorRateResult.value;

  const prevErrorRateResult = calculateErrorRate(
    prevRequests.length,
    prevFailedRequests.length,
    previousEvents.filter((e) => e.type === "ERROR").length,
    previousEvents.length > 0
  );
  const prevErrorRate = prevErrorRateResult.value;

  const errorRateComp = calculateMetricComparison(currentErrorRate, prevErrorRate, true, true);
  const hasErrorRateBaseline = prevRequests.length >= 5 && currentErrorRate !== null && errorRateComp.percentagePointsDiff !== null;

  let errorRateQualityState: MetricOverviewItem["qualityState"] = "OBSERVED";
  let errorRateQualityLabel = "Observed";

  if (errorRateResult.state === "INVALID_DENOMINATOR") {
    errorRateQualityState = "INSUFFICIENT";
    errorRateQualityLabel = "Undefined — 0 requests";
  } else if (errorRateResult.state === "NO_TELEMETRY") {
    errorRateQualityState = "NOT_CAPTURED";
    errorRateQualityLabel = "No telemetry";
  } else if (errorRateResult.state === "INSUFFICIENT_SAMPLE") {
    errorRateQualityState = "LIMITED";
    errorRateQualityLabel = "Limited sample";
  }

  const errorRateOverview: MetricOverviewItem = {
    label: "ERROR RATE",
    value: currentErrorRate !== null ? `${currentErrorRate.toFixed(1)}%` : "—",
    rawNumber: currentErrorRate,
    delta: hasErrorRateBaseline
      ? `${errorRateComp.percentagePointsDiff! > 0 ? "↑" : errorRateComp.percentagePointsDiff! < 0 ? "↓" : "—"} ${Math.abs(errorRateComp.percentagePointsDiff!)} pp`
      : "Baseline unavailable",
    deltaDirection:
      hasErrorRateBaseline
        ? errorRateComp.percentagePointsDiff! > 0
          ? "up"
          : errorRateComp.percentagePointsDiff! < 0
          ? "down"
          : "flat"
        : null,
    isImprovement: errorRateComp.isImprovement,
    qualityState: errorRateQualityState,
    qualityLabel: errorRateQualityLabel,
  };

  // REQUESTS CALCULATION
  const reqVolComp = calculateMetricComparison(currentRequests.length, prevRequests.length, false, false);
  const hasRequestsBaseline = previousEvents.length > 0 && reqVolComp.relativeDiffPct !== null;

  const requestsOverview: MetricOverviewItem = {
    label: "REQUESTS",
    value: currentRequests.length.toLocaleString(),
    rawNumber: currentRequests.length,
    delta: hasRequestsBaseline
      ? `${reqVolComp.relativeDiffPct! > 0 ? "↑" : reqVolComp.relativeDiffPct! < 0 ? "↓" : "—"} ${Math.abs(reqVolComp.relativeDiffPct!)}%`
      : "Baseline unavailable",
    deltaDirection:
      hasRequestsBaseline
        ? reqVolComp.relativeDiffPct! > 0
          ? "up"
          : reqVolComp.relativeDiffPct! < 0
          ? "down"
          : "flat"
        : null,
    isImprovement: reqVolComp.isImprovement,
    qualityState: currentRequests.length > 0 ? "OBSERVED" : "NOT_CAPTURED",
    qualityLabel: currentRequests.length > 0 ? "Observed" : "Not captured",
  };

  // P95 LATENCY CALCULATION
  const currentLatencies = currentRequests
    .map((r) => r.durationMs)
    .filter((d): d is number => typeof d === "number" && d >= 0);
  const prevLatencies = prevRequests
    .map((r) => r.durationMs)
    .filter((d): d is number => typeof d === "number" && d >= 0);

  const currentP95 = calculatePercentile(currentLatencies, 95);
  const prevP95 = calculatePercentile(prevLatencies, 95);

  const p95Comp = calculateMetricComparison(currentP95, prevP95, false, true);
  const hasP95Baseline = prevLatencies.length >= 5 && p95Comp.relativeDiffPct !== null;

  const p95LatencyOverview: MetricOverviewItem = {
    label: "P95 LATENCY",
    value: currentP95 !== null ? `${currentP95}ms` : "—",
    rawNumber: currentP95,
    delta: hasP95Baseline
      ? `${p95Comp.relativeDiffPct! > 0 ? "↑" : p95Comp.relativeDiffPct! < 0 ? "↓" : "—"} ${Math.abs(p95Comp.relativeDiffPct!)}%`
      : "Baseline unavailable",
    deltaDirection:
      hasP95Baseline
        ? p95Comp.relativeDiffPct! > 0
          ? "up"
          : p95Comp.relativeDiffPct! < 0
          ? "down"
          : "flat"
        : null,
    isImprovement: p95Comp.isImprovement,
    qualityState:
      currentLatencies.length === 0
        ? "NOT_CAPTURED"
        : currentLatencies.length < 5
        ? "LIMITED"
        : "OBSERVED",
    qualityLabel:
      currentLatencies.length === 0
        ? "No duration traces"
        : currentLatencies.length < 5
        ? "Limited sample"
        : "Observed",
  };

  // AFFECTED USERS CALCULATION
  const allIdentifiedUsers = extractUserIdentifiers(currentEvents, currentSessions);
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
  const hasUsersBaseline = previousEvents.length > 0 && allIdentifiedUsers.size > 0;
  const usersDiff = affectedUsersCount - prevAffectedUsersCount;

  const affectedUsersOverview: MetricOverviewItem = {
    label: "AFFECTED USERS",
    value: allIdentifiedUsers.size > 0 ? affectedUsersCount.toLocaleString() : "—",
    rawNumber: allIdentifiedUsers.size > 0 ? affectedUsersCount : null,
    delta: hasUsersBaseline
      ? `${usersDiff > 0 ? "↑" : usersDiff < 0 ? "↓" : "—"} ${Math.abs(usersDiff)}`
      : "Baseline unavailable",
    deltaDirection:
      hasUsersBaseline
        ? usersDiff > 0
          ? "up"
          : usersDiff < 0
          ? "down"
          : "flat"
        : null,
    isImprovement: usersDiff <= 0,
    qualityState: allIdentifiedUsers.size > 0 ? "OBSERVED" : "NOT_CAPTURED",
    qualityLabel: allIdentifiedUsers.size > 0 ? "Observed" : "Identity not captured",
  };

  const telemetryOverview: PrimaryTelemetryOverviewData = {
    errorRate: errorRateOverview,
    requests: requestsOverview,
    p95Latency: p95LatencyOverview,
    affectedUsers: affectedUsersOverview,
    selectedTimeRangeLabel: effectiveFilter.timeRange === "custom" ? "Custom Range" : `Last ${effectiveFilter.timeRange.toUpperCase()}`,
    hasTelemetry,
  };

  // 2. PRIMARY SWITCHABLE TIME-SERIES CHART
  const bucketCount = timeRange.bucketCount;
  const intervalMs = timeRange.bucketIntervalMs;
  const primaryBuckets: PrimaryChartBucket[] = [];

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

    const bErrorRateResult = calculateErrorRate(
      bRequests.length,
      bFailedRequests.length,
      bErrors.length,
      hasTelemetryInBucket
    );

    let bucketState: TimeBucketState = bErrorRateResult.state;
    let dataStateLabel = bErrorRateResult.label;

    if (!hasTelemetryInBucket) {
      bucketState = "NO_TELEMETRY";
      dataStateLabel = "No telemetry observed";
    } else if (bRequests.length === 0 && bErrors.length === 0) {
      bucketState = "OBSERVED_ZERO";
      dataStateLabel = "0 requests, 0 errors observed";
    }

    primaryBuckets.push({
      timestamp: bStart.toISOString(),
      formattedTime: formatUtcDateTime(bStart),
      compactTime: formatUtcTime(bStart),
      state: bucketState,
      requestCount: bRequests.length,
      failedRequestCount: bFailedRequests.length,
      errorCount: bErrors.length,
      errorRate: bErrorRateResult.value,
      p50LatencyMs: calculatePercentile(bLatencies, 50),
      p75LatencyMs: calculatePercentile(bLatencies, 75),
      p95LatencyMs: calculatePercentile(bLatencies, 95),
      p99LatencyMs: calculatePercentile(bLatencies, 99),
      dataStateLabel,
    });
  }

  // 3. OBSERVED CHANGES (Max 3 rows, deterministic)
  const changes: ObservedChangeRow[] = [];
  const evalTime = formatUtcTime(timeRange.end);

  if (hasErrorRateBaseline && errorRateComp.percentagePointsDiff !== null && Math.abs(errorRateComp.percentagePointsDiff) >= 3.0) {
    changes.push({
      metric: "ERROR RATE",
      change: `${errorRateComp.percentagePointsDiff > 0 ? "↑" : "↓"} ${Math.abs(errorRateComp.percentagePointsDiff)} pp`,
      time: evalTime,
      actionLabel: "View errors →",
      actionHref: `/projects/${project.id}/events?type=ERROR`,
    });
  }

  if (hasP95Baseline && currentP95 !== null && prevP95 !== null && Math.abs(currentP95 - prevP95) >= 40) {
    const latDiff = currentP95 - prevP95;
    changes.push({
      metric: "LATENCY (P95)",
      change: `${latDiff > 0 ? "↑" : "↓"} ${Math.abs(latDiff)}ms`,
      time: evalTime,
      actionLabel: "View requests →",
      actionHref: `/projects/${project.id}/events?type=TRACE`,
    });
  }

  if (hasRequestsBaseline && reqVolComp.relativeDiffPct !== null && Math.abs(reqVolComp.relativeDiffPct) >= 15.0) {
    changes.push({
      metric: "REQUEST VOLUME",
      change: `${reqVolComp.relativeDiffPct > 0 ? "↑" : "↓"} ${Math.abs(reqVolComp.relativeDiffPct)}%`,
      time: evalTime,
      actionLabel: "Explore →",
      actionHref: `/projects/${project.id}/events`,
    });
  }

  let observedChangesState: ObservedChangesData["state"] = "no_changes";
  let observedChangesMessage: string | undefined = undefined;

  if (!hasErrorRateBaseline && !hasRequestsBaseline && !hasP95Baseline) {
    observedChangesState = "insufficient_baseline";
    observedChangesMessage = "Changes not evaluated — insufficient baseline telemetry.";
  } else if (changes.length === 0) {
    observedChangesState = "no_changes";
    observedChangesMessage = "No significant observed changes in this interval.";
  } else {
    observedChangesState = "has_changes";
  }

  const observedChanges: ObservedChangesData = {
    state: observedChangesState,
    message: observedChangesMessage,
    changes: changes.slice(0, 3),
  };

  // 4. FAILURE CONCENTRATION
  const endpointMap = new Map<string, { count: number; users: Set<string> }>();
  const serviceMap = new Map<string, { count: number; users: Set<string> }>();
  const errorTypeMap = new Map<string, { count: number; users: Set<string> }>();

  let hasExplicitEndpoints = false;

  for (const err of currentErrors) {
    const ep = err.operation || err.resource;
    if (ep && ep.trim()) {
      hasExplicitEndpoints = true;
      const key = ep.trim();
      const existing = endpointMap.get(key) || { count: 0, users: new Set<string>() };
      existing.count++;
      if (err.user && typeof err.user === "object") {
        const uid = (err.user as TelemetryUserRecord).id || (err.user as TelemetryUserRecord).email;
        if (uid) existing.users.add(uid);
      }
      endpointMap.set(key, existing);
    }

    const svc = (err.service && err.service.trim()) || "default";
    const svcExisting = serviceMap.get(svc) || { count: 0, users: new Set<string>() };
    svcExisting.count++;
    if (err.user && typeof err.user === "object") {
      const uid = (err.user as TelemetryUserRecord).id || (err.user as TelemetryUserRecord).email;
      if (uid) svcExisting.users.add(uid);
    }
    serviceMap.set(svc, svcExisting);

    const type = (err.title && err.title.trim()) || "Error";
    const typeExisting = errorTypeMap.get(type) || { count: 0, users: new Set<string>() };
    typeExisting.count++;
    if (err.user && typeof err.user === "object") {
      const uid = (err.user as TelemetryUserRecord).id || (err.user as TelemetryUserRecord).email;
      if (uid) typeExisting.users.add(uid);
    }
    errorTypeMap.set(type, typeExisting);
  }

  const totalErrors = currentErrors.length;
  const toConcentrationRows = (
    map: Map<string, { count: number; users: Set<string> }>,
    baseExploreQuery: string
  ): FailureConcentrationRow[] => {
    return Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([name, data], idx) => ({
        rank: idx + 1,
        name,
        errorCount: data.count,
        percentageOfTotalErrors:
          totalErrors > 0 ? Math.round((data.count / totalErrors) * 1000) / 10 : 0,
        affectedUsers: data.users.size > 0 ? data.users.size : null,
        actionHref: `/projects/${project.id}/events?type=ERROR&${baseExploreQuery}=${encodeURIComponent(name)}`,
      }));
  };

  const failureConcentration: FailureConcentrationData = {
    dimension: "endpoint",
    endpointAttributionAvailable: hasExplicitEndpoints,
    totalErrors,
    byEndpoint: toConcentrationRows(endpointMap, "operation"),
    byService: toConcentrationRows(serviceMap, "service"),
    byErrorType: toConcentrationRows(errorTypeMap, "query"),
  };

  // 5. SERVICE PERFORMANCE (Sorted by errors descending)
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
    const sName = (ev.service && ev.service.trim()) || "default";
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
      const uid = (ev.user as TelemetryUserRecord).id || (ev.user as TelemetryUserRecord).email;
      if (uid) existing.users.add(uid);
    }
    serviceStatsMap.set(sName, existing);
  }

  const servicePerformanceRows: ServicePerformanceRow[] = Array.from(serviceStatsMap.entries())
    .map(([serviceName, stats]) => {
      const p95 = calculatePercentile(stats.latencies, 95);
      const errRate = calculateErrorRate(stats.requests, stats.failedRequests, stats.errors, true).value;

      return {
        service: serviceName,
        requests: stats.requests,
        errors: stats.errors,
        errorRate: errRate,
        p95LatencyMs: p95,
        affectedUsers: stats.users.size > 0 ? stats.users.size : null,
        actionHref: `?service=${encodeURIComponent(serviceName)}`,
      };
    })
    .sort((a, b) => b.errors - a.errors);

  const servicePerformance: ServicePerformanceData = {
    services: servicePerformanceRows,
    hasTelemetry: servicePerformanceRows.length > 0,
  };

  // 6. RELEASE BEHAVIOR
  const releaseTimelineMarkers: ReleaseMarker[] = [];
  const releaseBehaviorRows: ReleaseBehaviorRow[] = allReleases.map((rel) => {
    const relEvents = currentEvents.filter((e) => e.release === rel.version);
    const relRequests = relEvents.filter(
      (e) => e.type === "TRACE" || e.durationMs !== null || e.operation !== null
    );
    const relErrors = relEvents.filter((e) => e.type === "ERROR");
    const relFailed = relRequests.filter((e) => isFailedStatus(e.status));
    const relLatencies = relRequests
      .map((r) => r.durationMs)
      .filter((d): d is number => typeof d === "number" && d >= 0);

    const relErrorRate = calculateErrorRate(relRequests.length, relFailed.length, relErrors.length, true).value;

    releaseTimelineMarkers.push({
      version: rel.version,
      deployedAt: formatUtcDateTime(rel.createdAt),
      timestampMs: rel.createdAt.getTime(),
    });

    return {
      version: rel.version,
      deployedAt: formatUtcDateTime(rel.createdAt),
      requestCount: relRequests.length,
      errorCount: relErrors.length,
      errorRate: relErrorRate !== null ? Math.round(relErrorRate * 10) / 10 : null,
      p95LatencyMs: calculatePercentile(relLatencies, 95),
      temporalRelationship: "Observed after release",
      actionHref: `?release=${encodeURIComponent(rel.version)}`,
    };
  });

  const releaseBehavior: ReleaseBehaviorData = {
    releases: releaseBehaviorRows,
    timelineMarkers: releaseTimelineMarkers,
    hasTelemetry: releaseBehaviorRows.length > 0 && releaseBehaviorRows.some((r) => r.requestCount > 0 || r.errorCount > 0),
  };

  // 7. USER IMPACT
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
  const percentageOfSessionsWithErrors =
    totalCapturedSessionsCount > 0
      ? Math.round((affectedSessionsCount / totalCapturedSessionsCount) * 1000) / 10
      : null;

  const errorsPerAffectedUser =
    affectedUsersCount > 0
      ? Math.round((currentErrors.length / affectedUsersCount) * 10) / 10
      : null;

  let summarySentence = "User impact unavailable from captured identity telemetry.";
  if (allIdentifiedUsers.size > 0) {
    summarySentence = `${affectedUsersCount} of ${allIdentifiedUsers.size} identified users experienced at least one observed error.`;
  } else if (totalCapturedSessionsCount > 0) {
    summarySentence = `${affectedSessionsCount} of ${totalCapturedSessionsCount} observed anonymous sessions experienced at least one error.`;
  }

  const userImpact: UserImpactData = {
    affectedUsersCount: allIdentifiedUsers.size > 0 ? affectedUsersCount : null,
    affectedSessionsCount: totalCapturedSessionsCount > 0 ? affectedSessionsCount : null,
    sessionsWithErrorsCount: totalCapturedSessionsCount > 0 ? failedSessionsCount : null,
    percentageOfSessionsWithErrors,
    errorsPerAffectedUser,
    summarySentence,
    hasIdentityTelemetry: allIdentifiedUsers.size > 0,
  };

  // 8. TELEMETRY COVERAGE (2-column matrix of 8 signals)
  const tracesObserved = currentRequests.length;
  const errorsObserved = currentErrors.length;
  const sessionsObserved = currentSessions.length;
  const traceLinkageCount = currentEvents.filter((e) => e.traceId && e.requestId).length;
  const dbSpansCount = currentEvents.filter(
    (e) => e.type === "TRACE" && (e.operation?.toLowerCase().includes("sql") || e.operation?.toLowerCase().includes("query") || e.resource?.toLowerCase().includes("db"))
  ).length;

  const signals: CoverageSignalItem[] = [
    {
      signal: "Request telemetry",
      state: tracesObserved >= 10 ? "OBSERVED" : tracesObserved > 0 ? "PARTIAL" : "NOT CAPTURED",
      observedCount: tracesObserved,
      detail: `${tracesObserved} HTTP / RPC traces`,
    },
    {
      signal: "Error telemetry",
      state: errorsObserved >= 1 ? "OBSERVED" : "NOT CAPTURED",
      observedCount: errorsObserved,
      detail: `${errorsObserved} caught exceptions`,
    },
    {
      signal: "Trace linkage",
      state: traceLinkageCount >= 5 ? "OBSERVED" : traceLinkageCount > 0 ? "PARTIAL" : "NOT CAPTURED",
      observedCount: traceLinkageCount,
      detail: `${traceLinkageCount} correlated events`,
    },
    {
      signal: "Database/resource spans",
      state: dbSpansCount >= 5 ? "OBSERVED" : dbSpansCount > 0 ? "PARTIAL" : "NOT CAPTURED",
      observedCount: dbSpansCount,
      detail: `${dbSpansCount} query operations`,
    },
    {
      signal: "Session telemetry",
      state: sessionsObserved >= 5 ? "OBSERVED" : sessionsObserved > 0 ? "PARTIAL" : "NOT CAPTURED",
      observedCount: sessionsObserved,
      detail: `${sessionsObserved} client sessions`,
    },
    {
      signal: "User identity",
      state: allIdentifiedUsers.size > 0 ? "OBSERVED" : "NOT CAPTURED",
      observedCount: allIdentifiedUsers.size > 0 ? allIdentifiedUsers.size : null,
      detail: allIdentifiedUsers.size > 0 ? `${allIdentifiedUsers.size} user identities` : "Anonymous telemetry",
    },
    {
      signal: "Replay",
      state: replaySessionCount > 0 ? "OBSERVED" : "NOT CAPTURED",
      observedCount: replaySessionCount,
      detail: `${replaySessionCount} session recordings`,
    },
    {
      signal: "Source resolution",
      state: currentEvents.some((e) => e.breadcrumbs !== null) ? "OBSERVED" : "LIMITED",
      observedCount: null,
      detail: "Stack frame source mapping",
    },
  ];

  const telemetryCoverage: TelemetryCoverageData = {
    signals,
  };

  // 9. LONG-TERM TREND (3 rows)
  const hasTrendBaseline = previousEvents.length > 0;

  const trendRows: ProjectTrendRow[] = [
    {
      metricName: "ERROR RATE",
      current: currentErrorRate !== null ? `${currentErrorRate.toFixed(1)}%` : "—",
      previous: hasErrorRateBaseline && prevErrorRate !== null ? `${prevErrorRate.toFixed(1)}%` : "No observed baseline",
      delta: hasErrorRateBaseline && errorRateComp.percentagePointsDiff !== null
        ? `${errorRateComp.percentagePointsDiff > 0 ? "↑" : "↓"} ${Math.abs(errorRateComp.percentagePointsDiff)} pp`
        : "—",
      status: hasErrorRateBaseline ? (errorRateComp.isImprovement ? "Improving" : "Degrading") : "Baseline unavailable",
    },
    {
      metricName: "P95 LATENCY",
      current: currentP95 !== null ? `${currentP95}ms` : "—",
      previous: hasP95Baseline && prevP95 !== null ? `${prevP95}ms` : "No observed baseline",
      delta: hasP95Baseline && p95Comp.relativeDiffPct !== null
        ? `${p95Comp.relativeDiffPct > 0 ? "↑" : "↓"} ${Math.abs(p95Comp.relativeDiffPct)}%`
        : "—",
      status: hasP95Baseline ? (p95Comp.isImprovement ? "Improving" : "Degrading") : "Baseline unavailable",
    },
    {
      metricName: "REQUEST VOLUME",
      current: currentRequests.length.toLocaleString(),
      previous: hasRequestsBaseline ? prevRequests.length.toLocaleString() : "No observed baseline",
      delta: hasRequestsBaseline && reqVolComp.relativeDiffPct !== null
        ? `${reqVolComp.relativeDiffPct > 0 ? "↑" : "↓"} ${Math.abs(reqVolComp.relativeDiffPct)}%`
        : "—",
      status: hasRequestsBaseline ? (reqVolComp.isImprovement ? "Healthy" : "Reduced") : "Baseline unavailable",
    },
  ];

  const longTermTrend: LongTermTrendData = {
    rows: trendRows,
    hasBaseline: hasTrendBaseline,
  };

  return {
    projectId: project.id,
    projectName: project.name,
    filterApplied: effectiveFilter,
    totalHistoricalEvents,
    hasTelemetry,
    timeWindow: {
      from: timeRange.start.toISOString(),
      to: timeRange.end.toISOString(),
      previousFrom: timeRange.comparisonStart?.toISOString() || "",
      previousTo: timeRange.comparisonEnd?.toISOString() || "",
      label: effectiveFilter.timeRange === "custom" ? "Custom Range" : `Last ${effectiveFilter.timeRange.toUpperCase()}`,
    },
    telemetryOverview,
    primaryChart: {
      buckets: primaryBuckets,
    },
    observedChanges,
    failureConcentration,
    servicePerformance,
    releaseBehavior,
    userImpact,
    telemetryCoverage,
    longTermTrend,
    availableEnvironments: project.environments,
    availableServices,
    availableReleases,
  };
}
