export type TimeRangePreset = "1h" | "6h" | "24h" | "7d" | "30d" | "custom";

export type PrimaryChartMetric = "error_rate" | "requests" | "p95_latency" | "failed_requests";

export type TimeBucketState = "OBSERVED_VALUE" | "OBSERVED_ZERO" | "NO_TELEMETRY" | "INSUFFICIENT_SAMPLE";

export type CoverageState = "OBSERVED" | "PARTIAL" | "LIMITED" | "NOT CAPTURED" | "UNAVAILABLE";

export interface MetricsFilterParams {
  timeRange: TimeRangePreset;
  from?: string;
  to?: string;
  environment?: string;
  service?: string;
  release?: string;
}

export interface MetricOverviewItem {
  label: "ERROR RATE" | "REQUESTS" | "P95 LATENCY" | "AFFECTED USERS";
  value: string;
  rawNumber: number | null;
  delta: string;
  deltaDirection: "up" | "down" | "flat" | null;
  isImprovement: boolean | null;
  qualityState: "OBSERVED" | "LIMITED" | "INSUFFICIENT" | "NOT_CAPTURED";
  qualityLabel: string;
}

export interface PrimaryTelemetryOverviewData {
  errorRate: MetricOverviewItem;
  requests: MetricOverviewItem;
  p95Latency: MetricOverviewItem;
  affectedUsers: MetricOverviewItem;
  selectedTimeRangeLabel: string;
  hasTelemetry: boolean;
}

export interface PrimaryChartBucket {
  timestamp: string; // ISO string
  formattedTime: string; // "Sep 8, 21:00 UTC"
  compactTime: string; // "21:00 UTC"
  state: TimeBucketState;
  requestCount: number;
  failedRequestCount: number;
  errorCount: number;
  errorRate: number | null;
  p50LatencyMs: number | null;
  p75LatencyMs: number | null;
  p95LatencyMs: number | null;
  p99LatencyMs: number | null;
  dataStateLabel: string;
}

export interface ObservedChangeRow {
  metric: string;
  change: string;
  time: string;
  actionLabel: string;
  actionHref: string;
}

export interface ObservedChangesData {
  state: "has_changes" | "no_changes" | "insufficient_baseline";
  message?: string;
  changes: ObservedChangeRow[];
}

export interface FailureConcentrationRow {
  rank: number;
  name: string;
  errorCount: number;
  percentageOfTotalErrors: number;
  affectedUsers: number | null;
  actionHref: string;
}

export interface FailureConcentrationData {
  dimension: "endpoint" | "service" | "error_type";
  endpointAttributionAvailable: boolean;
  totalErrors: number;
  byEndpoint: FailureConcentrationRow[];
  byService: FailureConcentrationRow[];
  byErrorType: FailureConcentrationRow[];
}

export interface ServicePerformanceRow {
  service: string;
  requests: number;
  errors: number;
  errorRate: number | null;
  p95LatencyMs: number | null;
  affectedUsers: number | null;
  actionHref: string;
}

export interface ServicePerformanceData {
  services: ServicePerformanceRow[];
  hasTelemetry: boolean;
}

export interface ReleaseBehaviorRow {
  version: string;
  deployedAt: string;
  requestCount: number;
  errorCount: number;
  errorRate: number | null;
  p95LatencyMs: number | null;
  temporalRelationship: string;
  actionHref: string;
}

export interface ReleaseMarker {
  version: string;
  deployedAt: string;
  timestampMs: number;
}

export interface ReleaseBehaviorData {
  releases: ReleaseBehaviorRow[];
  timelineMarkers: ReleaseMarker[];
  hasTelemetry: boolean;
}

export interface UserImpactData {
  affectedUsersCount: number | null;
  affectedSessionsCount: number | null;
  sessionsWithErrorsCount: number | null;
  percentageOfSessionsWithErrors: number | null;
  errorsPerAffectedUser: number | null;
  summarySentence: string;
  hasIdentityTelemetry: boolean;
}

export interface CoverageSignalItem {
  signal: string;
  state: CoverageState;
  observedCount: number | null;
  detail: string;
}

export interface TelemetryCoverageData {
  signals: CoverageSignalItem[];
}

export interface ProjectTrendRow {
  metricName: "ERROR RATE" | "P95 LATENCY" | "REQUEST VOLUME";
  current: string;
  previous: string;
  delta: string;
  status: string;
}

export interface LongTermTrendData {
  rows: ProjectTrendRow[];
  hasBaseline: boolean;
}

export interface RedesignedProjectMetricsIntelligence {
  projectId: string;
  projectName: string;
  filterApplied: MetricsFilterParams;
  totalHistoricalEvents: number;
  hasTelemetry: boolean;
  timeWindow: {
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
    label: string;
  };
  telemetryOverview: PrimaryTelemetryOverviewData;
  primaryChart: {
    buckets: PrimaryChartBucket[];
  };
  observedChanges: ObservedChangesData;
  failureConcentration: FailureConcentrationData;
  servicePerformance: ServicePerformanceData;
  releaseBehavior: ReleaseBehaviorData;
  userImpact: UserImpactData;
  telemetryCoverage: TelemetryCoverageData;
  longTermTrend: LongTermTrendData;
  availableEnvironments: { id: string; name: string }[];
  availableServices: string[];
  availableReleases: string[];
}
