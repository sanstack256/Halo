/**
 * HALO TRACE — PILLAR I DOMAIN TYPES
 * Remediation Verification & Resolution Intelligence
 *
 * Deterministic domain representations for post-change telemetry verification,
 * before/after comparison windows, failure signature matching, regression signals,
 * qualitative verification strength, and epistemic uncertainty.
 */

export type VerificationResult =
    | "RESOLVED"
    | "IMPROVED"
    | "NOT_RESOLVED"
    | "REGRESSED"
    | "UNKNOWN"
    | "INSUFFICIENT_DATA";

export type VerificationStrength =
    | "HIGH"
    | "MEDIUM"
    | "LOW";

export interface TemporalAnchor {
    type: "DEPLOYMENT" | "CHANGE_OBSERVATION" | "HUMAN_COMPLETION" | "EXPLICIT_TIMESTAMP";
    timestamp: string; // ISO string
    referenceId?: string;
    label?: string;
}

export interface MetricWindowComparison {
    sampleCount: number;
    failureCount: number;
    failureRate: number; // 0.0 to 1.0
    p50LatencyMs?: number | null;
    p95LatencyMs?: number | null;
    p99LatencyMs?: number | null;
    windowStart: string; // ISO string
    windowEnd: string;   // ISO string
}

export interface FailureSignatureComparison {
    targetService: string;
    targetOperation?: string | null;
    originalFingerprint?: string | null;
    originalErrorTitle?: string | null;
    baselineOccurrences: number;
    postChangeOccurrences: number;
    stillObserved: boolean;
    changePercentage: number; // e.g. -100% for completely gone, -50% for halved, +20% for increased
}

export interface RegressionSignal {
    type:
        | "NEW_FAILURE_SIGNATURE"
        | "INCREASED_LATENCY"
        | "NEW_DOWNSTREAM_CASCADE"
        | "INCREASED_ERROR_RATE";
    service: string;
    operation?: string | null;
    fingerprint?: string | null;
    description: string;
    baselineValue?: number | string | null;
    postChangeValue?: number | string | null;
    evidenceReferenceId?: string | null;
}

export interface DifferentialVerificationContext {
    hasBaseline: boolean;
    baselineCount: number;
    durationMultiplier?: number | null;
    structuralDivergenceDetected: boolean;
    details?: string;
}

export interface TopologyVerificationContext {
    originalCascadePath: string[]; // e.g. ["checkout", "billing", "notification"]
    postCascadePath: string[];     // e.g. ["checkout", "billing"]
    cascadeReduced: boolean;
    newDownstreamServices: string[];
    details?: string;
}

export interface ReplayVerificationContext {
    hasPostReplay: boolean;
    replaySessionId?: string;
    reproducedFailure: boolean;
    details?: string;
}

export interface RemediationVerificationDomain {
    id: string;
    organizationId: string;
    projectId: string;
    investigationId: string;
    recommendationId: string;
    result: VerificationResult;
    strength: VerificationStrength;
    baseline: MetricWindowComparison;
    postChange: MetricWindowComparison;
    failureComparison: FailureSignatureComparison;
    temporalAnchor: TemporalAnchor;
    regressionSignals: RegressionSignal[];
    differentialContext?: DifferentialVerificationContext | null;
    topologyContext?: TopologyVerificationContext | null;
    replayContext?: ReplayVerificationContext | null;
    evidenceReferences: string[];
    uncertainty: string;
    explanation: string;
    verifiedAt: string;
    createdAt: string;
    updatedAt: string;
}

export interface VerifyRemediationParams {
    recommendationId: string;
    organizationId: string;
    projectId: string;
    forceFresh?: boolean;
    customPostWindowMs?: number;
}

export interface VerificationHistoryResult {
    recommendationId: string;
    projectId: string;
    organizationId: string;
    verifications: RemediationVerificationDomain[];
    totalCount: number;
}
