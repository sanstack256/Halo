import type { Evidence } from "./evidence";

export type AnomalyType =
    | "RATE_BURST"
    | "LATENCY_SPIKE"
    | "ERROR_DISTRIBUTION_SHIFT"
    | "NOVEL_PATTERN"
    | "RESOURCE_SATURATION"
    | "CASCADING_FAILURE"
    | "SECURITY_ANOMALY"
    | "CONTRACT_VIOLATION"
    | "SILENT_DEGRADATION"
    | "RECURRING_CYCLE";

export type AnomalySeverity =
    | "LOW"
    | "MEDIUM"
    | "HIGH"
    | "CRITICAL";

export interface AnomalySignal {
    id: string;
    type: AnomalyType;
    severity: AnomalySeverity;
    title: string;
    description: string;
    service: string;
    resource?: string;
    operation?: string;
    timestamp: Date;
    evidenceIds: string[];
    score: number; // 0 to 1 normalized anomaly intensity
    baselineScore?: number;
    metrics?: Record<string, number | string | boolean>;
}

export interface StatisticalBaseline {
    service: string;
    windowMinutes: number;
    meanRate: number;
    stdDevRate: number;
    p50DurationMs: number;
    p95DurationMs: number;
    p99DurationMs: number;
    errorRate: number;
    sampleCount: number;
}
