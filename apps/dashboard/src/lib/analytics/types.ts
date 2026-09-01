export type TimeRangeKey = "1h" | "6h" | "24h" | "7d" | "30d";

export type ComparisonMode = "PREVIOUS_PERIOD" | "NONE";

export type EvidenceClassification =
    | "Observed"
    | "Correlated"
    | "Strongly correlated"
    | "Causal evidence established"
    | "Possible"
    | "Insufficient evidence"
    | "Unknown";

export type ReleaseVerdict =
    | "Regression Detected"
    | "Likely Regression"
    | "No Regression Observed"
    | "Insufficient Evidence"
    | "Inconclusive";

export type ServiceHealthStatus = "Healthy" | "Degraded" | "Critical" | "Unknown";

export type TrendDirection = "Improving" | "Stable" | "Degrading" | "Volatile" | "Unknown";

export type QualitativeConfidence = "Very High" | "High" | "Medium" | "Low" | "Insufficient Evidence";

export type InvestigationPriorityLevel = "Very High" | "High" | "Medium" | "Low";

export interface InvestigationPriority {
    level: InvestigationPriorityLevel;
    score: number;
    reasons: string[];
}

export interface SharedEvidenceItem {
    id: string;
    type: "ERROR_SPIKE" | "DEPLOYMENT" | "TRACE_LINK" | "DEPENDENCY_ANOMALY" | "ISSUE_OCCURRENCE" | "MONITOR_TRIGGER" | "HISTORICAL_RECURRENCE";
    title: string;
    description: string;
    timestamp: string;
    relationship: "SUPPORTING" | "COUNTER_EVIDENCE" | "CORRELATED" | "OBSERVED";
    strength: QualitativeConfidence;
    source: string;
    entityId?: string;
    linkUrl?: string;
    metadata?: Record<string, any>;
}

export interface DataProvenance {
    sources: string[];
    projectId?: string;
    projectName?: string;
    environment?: string;
    timeRange: {
        key: TimeRangeKey;
        start: string;
        end: string;
    };
    comparisonRange?: {
        start: string;
        end: string;
    };
    totalEventsAnalyzed: number;
    totalTracesAnalyzed: number;
    totalErrorsAnalyzed: number;
    methodology: string;
    dataQuality: "Complete" | "Partial" | "Insufficient observations" | "No telemetry";
    limitations?: string[];
    lastCalculatedAt: string;
}

export interface MetricComparison {
    current: number | null;
    previous: number | null;
    absoluteDiff: number | null;
    /** Relative percentage change, e.g. +25% or -10% */
    relativeDiffPct: number | null;
    /** Percentage point difference (for rate metrics like error rate), e.g. +2.4pp */
    percentagePointsDiff: number | null;
    isImprovement: boolean | null;
}

export interface TimeBucketPoint {
    timestamp: string;
    formattedTime: string;
    timeZoneAbbr?: string;
    errorCount: number;
    requestCount: number;
    errorRate: number;
    avgLatencyMs: number | null;
    p50LatencyMs: number | null;
    p95LatencyMs: number | null;
    p99LatencyMs: number | null;
    incidentCount: number;
    releaseCount: number;
    monitorTriggerCount: number;
    investigationCount: number;
    affectedServices: string[];
    comparison?: {
        errorCount: number;
        requestCount: number;
        errorRate: number;
        avgLatencyMs: number | null;
        hasObservation?: boolean;
    };
}

export interface TimelineEventMarker {
    id: string;
    timestamp: string;
    type: "RELEASE" | "INCIDENT" | "MONITOR_ALERT" | "INVESTIGATION";
    title: string;
    service?: string;
    severity?: string;
    entityId?: string;
    linkUrl: string;
}

export interface ChangeExplanation {
    detected: boolean;
    headline: string;
    explanation: string;
    whatChanged: string;
    when: string;
    where: string;
    magnitudeDescription: string;
    classification: EvidenceClassification;
    evidenceStrength: QualitativeConfidence;
    affectedServices: Array<{
        service: string;
        errorCount: number;
        shareOfTotalErrorsPct: number;
    }>;
    relatedReleases: Array<{
        id: string;
        version: string;
        service?: string;
        timestamp: string;
        temporalRelation: string;
    }>;
    relatedIncidents: Array<{
        id: string;
        title: string;
        severity: string;
        eventCount: number;
        service?: string;
    }>;
    relatedMonitorAlerts: Array<{
        id: string;
        monitorName: string;
        condition: string;
        status: string;
        triggeredAt: string;
    }>;
    supportingEvidence: string[];
    counterEvidence: string[];
    evidenceItems: SharedEvidenceItem[];
}

export interface ServiceContributionItem {
    service: string;
    projectId: string;
    projectName: string;
    errorCount: number;
    totalCount: number;
    errorRate: number;
    errorRateComparison?: MetricComparison;
    errorContributionPct: number;
    requestContributionPct: number;
    avgLatencyMs: number | null;
    p95LatencyMs: number | null;
    latencyComparison?: MetricComparison;
    affectedIssuesCount: number;
    health: ServiceHealthStatus;
    investigationPriority: InvestigationPriority;
}

export interface IntervalComparisonAnalysis {
    selectedInterval: {
        start: string;
        end: string;
        formattedTime: string;
        requestCount: number;
        errorCount: number;
        errorRate: number;
        avgLatencyMs: number | null;
    };
    baselineInterval: {
        start: string;
        end: string;
        requestCount: number;
        errorCount: number;
        errorRate: number;
        avgLatencyMs: number | null;
    };
    increasedMetrics: string[];
    decreasedMetrics: string[];
    appearedItems: string[];
    disappearedItems: string[];
    affectedServices: Array<{ service: string; errorCount: number; errorRate: number }>;
    affectedEndpoints: Array<{ endpoint: string; count: number; errorCount: number }>;
    relatedReleases: Array<{ version: string; timestamp: string }>;
    relatedIssues: Array<{ id: string; title: string; severity: string }>;
    relatedMonitors: Array<{ id: string; name: string; condition: string }>;
}

export interface SystemExplorerData {
    timeline: TimeBucketPoint[];
    markers: TimelineEventMarker[];
    summaryMetrics: {
        totalRequests: MetricComparison;
        totalErrors: MetricComparison;
        errorRate: MetricComparison;
        avgLatencyMs: MetricComparison;
        p50LatencyMs: MetricComparison;
        p95LatencyMs: MetricComparison;
        p99LatencyMs: MetricComparison;
        activeIncidentsCount: number;
        monitorsFiringCount: number;
    };
    explanation: ChangeExplanation;
    serviceContributions: ServiceContributionItem[];
    evidenceLedger: SharedEvidenceItem[];
    provenance: DataProvenance;
}

export interface ServiceLandscapeItem {
    service: string;
    projectId: string;
    projectName: string;
    health: ServiceHealthStatus;
    healthReason: string;
    investigationPriority: InvestigationPriority;
    errorCount: number;
    totalCount: number;
    errorRate: number;
    errorRateComparison?: MetricComparison;
    avgLatencyMs: number | null;
    p95LatencyMs: number | null;
    latencyComparison?: MetricComparison;
    requestCount: number;
    failureContributionPct: number;
    trafficSharePct: number;
    dependencyCount: number;
    trend: TrendDirection;
    lastSeen: string | null;
    activeIssuesCount: number;
    recentReleasesCount: number;
    mostRecurringFingerprint?: string;
}

export interface ServiceLandscapeRankings {
    highestFailureContributors: Array<{ service: string; failureContributionPct: number; errorCount: number }>;
    fastestDegrading: Array<{ service: string; errorRateChange: number; currentRate: number }>;
    highestLatencyRegressions: Array<{ service: string; latencyDiffMs: number; currentP95Ms: number }>;
    highestTrafficExposure: Array<{ service: string; requestCount: number; requestSharePct: number }>;
    highestReliabilityRisk: Array<{ service: string; priority: InvestigationPriorityLevel; errorRate: number }>;
    mostRecurringFailures: Array<{ service: string; recurrenceCount: number }>;
}

export interface ServiceDetailedContext {
    service: string;
    projectId: string;
    projectName: string;
    health: ServiceHealthStatus;
    healthReason: string;
    investigationPriority: InvestigationPriority;
    metrics: {
        errorRate: number;
        errorCount: number;
        requestCount: number;
        avgLatencyMs: number | null;
        p95LatencyMs: number | null;
        failureContributionPct: number;
        trafficSharePct: number;
        trend: TrendDirection;
    };
    observedDependencies: {
        upstream: Array<{ service: string; callCount: number; errorRate: number; avgLatencyMs: number | null }>;
        downstream: Array<{ service: string; callCount: number; errorRate: number; avgLatencyMs: number | null }>;
    };
    recentChanges: Array<{
        id: string;
        version: string;
        timestamp: string;
        eventCount: number;
        errorCount: number;
    }>;
    activeIssues: Array<{
        id: string;
        title: string;
        severity: string;
        status: string;
        eventCount: number;
        lastSeen: string;
    }>;
    recurringFailures: Array<{
        fingerprint: string;
        title: string;
        count: number;
        firstSeen: string;
        lastSeen: string;
    }>;
    recentInvestigations: Array<{
        id: string;
        title: string;
        status: string;
        rootCause: string | null;
        confidenceScore: number | null;
        createdAt: string;
    }>;
    timeDistribution: Array<{
        timestamp: string;
        formattedTime: string;
        errorCount: number;
        requestCount: number;
    }>;
}

export interface ServiceLandscapeData {
    services: ServiceLandscapeItem[];
    rankings: ServiceLandscapeRankings;
    summary: {
        totalServices: number;
        healthyCount: number;
        degradedCount: number;
        criticalCount: number;
        unknownCount: number;
    };
    provenance: DataProvenance;
}

export interface ChangeImpactItem {
    id: string;
    version: string;
    projectId: string;
    projectName: string;
    service?: string;
    environment?: string;
    commitSha?: string | null;
    timestamp: string;
    scope: string;
    baselineWindow: { start: string; end: string; totalEvents: number; errorCount: number; errorRate: number; avgLatencyMs: number | null };
    observationWindow: { start: string; end: string; totalEvents: number; errorCount: number; errorRate: number; avgLatencyMs: number | null };
    metricsDiff: {
        errorRate: MetricComparison;
        errorCount: MetricComparison;
        requestCount: MetricComparison;
        avgLatencyMs: MetricComparison;
    };
    verdict: ReleaseVerdict;
    impactClassification: EvidenceClassification;
    evidenceStrength: QualitativeConfidence;
    regressionDetected: boolean;
    regressionSeverity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    regressionReason?: string;
    sampleSizeAssessment: {
        baselineEvents: number;
        observationEvents: number;
        isSufficient: boolean;
        notes: string;
    };
    relatedIssuesCount: number;
    relatedMonitorsCount: number;
    relatedInvestigationsCount: number;
}

export interface ChangeImpactDeepAnalysis {
    change: ChangeImpactItem;
    observedChanges: string[];
    likelyRelatedChanges: string[];
    unrelatedChanges: string[];
    counterEvidence: string[];
    insufficientEvidenceNotes: string[];
    relatedIssues: Array<{
        id: string;
        title: string;
        severity: string;
        firstSeen: string;
        lastSeen: string;
        eventCount: number;
    }>;
    relatedMonitorAlerts: Array<{
        id: string;
        monitorName: string;
        status: string;
        condition: string;
        triggeredAt: string;
    }>;
    relatedInvestigations: Array<{
        id: string;
        title: string;
        rootCause: string | null;
        confidenceScore: number | null;
        createdAt: string;
    }>;
    telemetryBreakdown: Array<{
        timestamp: string;
        formattedTime: string;
        errorCount: number;
        requestCount: number;
    }>;
    evidenceItems: SharedEvidenceItem[];
}

export interface ChangeIntelligenceData {
    changes: ChangeImpactItem[];
    summary: {
        totalChanges: number;
        regressionsDetected: number;
        likelyRegressions: number;
        stableChanges: number;
        insufficientDataCount: number;
    };
    provenance: DataProvenance;
}

export interface DependencyNode {
    id: string;
    name: string;
    type: "SERVICE" | "DATABASE" | "ENDPOINT" | "EXTERNAL";
    projectId: string;
    projectName: string;
    health: ServiceHealthStatus;
    errorRate: number;
    totalCalls: number;
    avgLatencyMs: number | null;
    recentIssueCount: number;
    recentReleaseCount: number;
    // Layout coordinates
    x?: number;
    y?: number;
    tier?: number;
}

export interface DependencyEdge {
    id: string;
    source: string;
    target: string;
    callCount: number;
    errorCount: number;
    errorRate: number;
    avgLatencyMs: number | null;
    p95LatencyMs: number | null;
    lastObservedAt: string;
    isCriticalPath?: boolean;
    evidence: {
        type: "TRACE_SPAN" | "REQUEST_HEADER" | "SERVICE_METADATA";
        observedSampleCount: number;
        description: string;
    };
}

export interface CriticalPathItem {
    pathId: string;
    nodes: string[];
    callVolume: number;
    avgLatencyMs: number;
    totalErrors: number;
    errorRate: number;
    evidenceSampleCount: number;
}

export interface BlastRadiusResult {
    selectedEntity: string;
    directlyAffected: Array<{ id: string; name: string; reason: string }>;
    observedPropagation: Array<{ id: string; name: string; hops: number; observedErrorRate: number; evidence: string }>;
    potentialExposure: Array<{ id: string; name: string; hops: number; connectionType: string }>;
    unobserved: Array<{ id: string; name: string }>;
}

export interface DependencyIntelligenceData {
    nodes: DependencyNode[];
    edges: DependencyEdge[];
    criticalPaths: CriticalPathItem[];
    observedCallTotal: number;
    provenance: DataProvenance;
}

export interface ReliabilityPostureMetric {
    title: string;
    value: number | string;
    unit?: string;
    target?: number;
    status: "HEALTHY" | "DEGRADED" | "CRITICAL" | "UNAVAILABLE";
    definition: string;
    methodology: string;
    comparison?: MetricComparison;
}

export interface ReliabilityDebtItem {
    id: string;
    fingerprint: string;
    title: string;
    occurrenceCount: number;
    affectedServices: string[];
    affectedReleases: string[];
    affectedEndpoints: string[];
    firstSeen: string;
    lastSeen: string;
    recurrenceTrend: TrendDirection;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    evidenceQuality: QualitativeConfidence;
    estimatedReliabilityImpactMinutes: number;
}

export interface OccurrenceComparison {
    fingerprint: string;
    title: string;
    currentOccurrence: {
        timestamp: string;
        service: string;
        release?: string;
        errorCount: number;
        errorRate: number;
        avgLatencyMs: number | null;
    };
    previousOccurrence: {
        timestamp: string;
        service: string;
        release?: string;
        errorCount: number;
        errorRate: number;
        avgLatencyMs: number | null;
    };
    differences: string[];
    sharedAttributes: string[];
}

export interface RecurringPatternItem {
    id: string;
    fingerprint: string;
    title: string;
    occurrenceCount: number;
    affectedServices: string[];
    affectedReleases: string[];
    affectedEndpoints: string[];
    firstObservedAt: string;
    lastObservedAt: string;
    trend: TrendDirection;
    activeIssueId?: string;
    sampleStack?: string | null;
    historicalMatchesCount: number;
}

export interface ReliabilityLabData {
    posture: {
        availabilityPct: ReliabilityPostureMetric;
        errorBudgetRemainingPct: ReliabilityPostureMetric;
        errorBudgetConsumedPct: ReliabilityPostureMetric;
        burnRateMultiplier: ReliabilityPostureMetric;
        crashFreeSessionPct: ReliabilityPostureMetric;
        incidentFrequencyPerDay: ReliabilityPostureMetric;
        overallTrend: TrendDirection;
    };
    errorBudget: {
        isConfigured: boolean;
        budgetStatus: "Remaining" | "Consumed" | "Exhausted" | "Insufficient Evidence";
        targetAvailability: number;
        actualAvailability: number | null;
        allowedFailureRatePct: number;
        actualFailureRatePct: number | null;
        budgetConsumedPct: number | null;
        budgetRemainingPct: number | null;
        burnRate: number | null;
        burnRateAssessment: string;
    };
    trajectory: Array<{
        timestamp: string;
        formattedTime: string;
        timeZoneAbbr?: string;
        availabilityPct: number | null;
        errorRate: number;
        incidentCount: number;
        releaseCount: number;
        monitorTriggerCount: number;
        hasObservation?: boolean;
    }>;
    contributors: Array<{
        service: string;
        failedRequestCount: number;
        failedRequestSharePct: number;
        errorBudgetConsumedPct: number;
        downtimeMinutesEstimate: number;
        trend: TrendDirection;
    }>;
    reliabilityDebt: ReliabilityDebtItem[];
    recurringPatterns: RecurringPatternItem[];
    provenance: DataProvenance;
}
