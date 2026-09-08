export type TimeRangePreset = "1h" | "6h" | "24h" | "7d" | "14d" | "30d" | "custom";

export interface MetricsFilterParams {
  timeRange: TimeRangePreset;
  from?: string;
  to?: string;
  environment?: string;
  service?: string;
  release?: string;
}

export interface MetricComparison {
  current: number;
  previous: number | null;
  relativeDiffPct: number | null;
  percentagePointsDiff?: number | null;
  direction: "up" | "down" | "flat" | "insufficient_data";
  isImprovement: boolean;
  timeWindowLabel: string;
  sufficientBaseline: boolean;
}

export interface ProjectHealthSnapshot {
  errorRate: MetricComparison;
  requestVolume: MetricComparison;
  p95LatencyMs: MetricComparison;
  failedRequests: MetricComparison;
  affectedUsers: MetricComparison;
  activeIssues: MetricComparison;
  totalEventsObserved: number;
  hasSufficientSample: boolean;
}

export interface TimeSeriesBucket {
  timestamp: string; // ISO string for bucket start
  hasTelemetry: boolean; // false if no events were observed in this bucket
  requestCount: number;
  errorCount: number;
  failedRequestCount: number;
  errorRate: number | null; // null if requestCount === 0
  p50LatencyMs: number | null;
  p75LatencyMs: number | null;
  p95LatencyMs: number | null;
  p99LatencyMs: number | null;
  activeSessions: number;
}

export interface TopErrorIssueSummary {
  id: string;
  title: string;
  severity: string;
  errorCount: number;
  affectedUsers: number;
  affectedSessions: number;
  firstSeen: string;
  lastSeen: string;
  trend: "escalating" | "stable" | "declining";
}

export interface ErrorBehaviorData {
  timeSeries: TimeSeriesBucket[];
  topIssues: TopErrorIssueSummary[];
  totalErrors: number;
  totalFailedRequests: number;
  hasTelemetry: boolean;
}

export interface RequestPerformanceData {
  timeSeries: TimeSeriesBucket[];
  overallThroughputRps: number;
  overallP50LatencyMs: number | null;
  overallP75LatencyMs: number | null;
  overallP95LatencyMs: number | null;
  overallP99LatencyMs: number | null;
  overallFailureRate: number | null;
  sampleSize: number;
  hasSufficientSample: boolean;
}

export interface ServiceHealthMetric {
  serviceName: string;
  requestVolume: number;
  errorCount: number;
  errorRate: number | null;
  p95LatencyMs: number | null;
  affectedUsers: number;
  activeIssuesCount: number;
  impactRank: number; // Derived purely from: (errorCount * 3) + activeIssuesCount + (p95LatencyMs > 1000 ? 2 : 0)
  impactScoreReason: string;
}

export interface ServiceHealthDistribution {
  services: ServiceHealthMetric[];
  hasTelemetry: boolean;
}

export interface ReleaseImpactMetric {
  version: string;
  createdAt: string;
  environmentName?: string;
  requestCountObserved: number;
  errorCountObserved: number;
  errorRateObserved: number | null;
  p95LatencyMsObserved: number | null;
  affectedUsersObserved: number;
  activeIssuesObserved: number;
  firstEventObservedAt: string | null;
  lastEventObservedAt: string | null;
  observationContext: "Observed telemetry associated with this release identifier";
}

export interface ReleaseImpactData {
  releases: ReleaseImpactMetric[];
  hasTelemetry: boolean;
}

export interface ErrorConcentrationItem {
  dimension: "endpoint" | "service" | "error_type" | "release";
  name: string;
  errorCount: number;
  percentageOfTotalErrors: number;
}

export interface ErrorConcentrationData {
  byEndpoint: ErrorConcentrationItem[];
  byService: ErrorConcentrationItem[];
  byErrorType: ErrorConcentrationItem[];
  totalErrorsObserved: number;
  hasTelemetry: boolean;
}

export interface UserImpactData {
  affectedUsersCount: number;
  affectedSessionsCount: number;
  totalCapturedSessionsCount: number;
  failedSessionsCount: number;
  percentageOfObservedSessionsWithErrors: number | null;
  errorOccurrencesPerAffectedUser: number | null;
  userTelemetryQuality: "identified_users_observed" | "anonymous_sessions_only" | "unavailable";
  qualityMessage: string;
}

export type CoverageStatus = "OBSERVED" | "PARTIAL" | "LIMITED" | "NOT CAPTURED";

export interface CoverageDimension {
  name: string;
  description: string;
  status: CoverageStatus;
  observedCount: number;
  details: string;
}

export interface TelemetryCoverageData {
  dimensions: CoverageDimension[];
  overallObservationTier: CoverageStatus;
  observedTelemetryGaps: string[];
}

export interface TemporalAnomaly {
  id: string;
  type: "error_spike" | "latency_spike" | "traffic_drop" | "new_issue_regression";
  title: string;
  description: string;
  timestamp: string;
  severity: "critical" | "warning" | "info";
  evidenceValue: string;
  baselineValue: string;
  ruleTriggered: string;
}

export interface TemporalAnomaliesData {
  anomalies: TemporalAnomaly[];
  detectionPeriodLabel: string;
  evaluationNote: string;
}

export interface TrendComparisonPoint {
  metricName: string;
  currentValue: string;
  previousValue: string;
  changePct: number | null;
  trendDirection: "improving" | "degrading" | "neutral" | "not_enough_telemetry";
  commentary: string;
}

export interface ProjectTrendsData {
  comparisons: TrendComparisonPoint[];
  evaluationWindowDays: number;
}

export interface ProjectMetricsIntelligence {
  projectId: string;
  projectName: string;
  filterApplied: MetricsFilterParams;
  timeWindow: {
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
    bucketSizeMinutes: number;
  };
  hasTelemetry: boolean;
  totalHistoricalEvents: number;
  healthSnapshot: ProjectHealthSnapshot;
  errorBehavior: ErrorBehaviorData;
  requestPerformance: RequestPerformanceData;
  serviceDistribution: ServiceHealthDistribution;
  releaseImpact: ReleaseImpactData;
  errorConcentration: ErrorConcentrationData;
  userImpact: UserImpactData;
  telemetryCoverage: TelemetryCoverageData;
  temporalAnomalies: TemporalAnomaliesData;
  projectTrends: ProjectTrendsData;
  availableEnvironments: { id: string; name: string }[];
  availableServices: string[];
  availableReleases: string[];
}
