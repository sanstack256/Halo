/**
 * Halo Trace Platform Health & Self-Observability Service (Phase 12 / Pillar K)
 *
 * SECTION 51, 52, 53: Observability of Halo Itself
 * Emits and computes internal operational signals:
 * - Ingestion throughput, latency, errors
 * - Database query connectivity and latency
 * - Investigation engine analysis latency
 * - External integration (GitHub, CODEOWNERS) availability
 * - Replay session capture and storage availability
 * - Background job health
 *
 * CRITICAL INVARIANT:
 * Platform health signals are strictly internal diagnostics and NEVER feed into
 * customer incident root-cause or evidence synthesis logic.
 */

export type PlatformHealthStatus = "HEALTHY" | "DEGRADED" | "PARTIAL" | "UNAVAILABLE";

export type SubsystemName =
    | "INGESTION"
    | "DATABASE"
    | "ANALYSIS"
    | "INTEGRATIONS"
    | "REPLAY"
    | "BACKGROUND_JOBS";

export interface HealthMetricRecord {
    id: string;
    timestamp: number;
    subsystem: SubsystemName;
    metricName: string;
    durationMs?: number;
    success: boolean;
    errorDetails?: string;
}

export interface SubsystemHealth {
    subsystem: SubsystemName;
    status: PlatformHealthStatus;
    latencyP95Ms: number;
    errorRate: number;
    totalOperations: number;
    details: string;
    lastChecked: string;
}

export interface PlatformHealthSummary {
    overallStatus: PlatformHealthStatus;
    checkedAt: string;
    subsystems: Record<SubsystemName, SubsystemHealth>;
    activeWarnings: string[];
}

// In-memory bounded circular metrics buffer (max 1000 entries)
const MAX_METRIC_ENTRIES = 1000;
const metricsBuffer: HealthMetricRecord[] = [];

// Simulated overrides for testing and fault-injection verification
const simulatedOverrides = new Map<SubsystemName, { status: PlatformHealthStatus; reason: string }>();

/**
 * Record an internal platform operational event or latency sample.
 */
export function recordPlatformMetric(
    subsystem: SubsystemName,
    metricName: string,
    durationMs?: number,
    success = true,
    errorDetails?: string
): void {
    if (metricsBuffer.length >= MAX_METRIC_ENTRIES) {
        metricsBuffer.shift();
    }
    metricsBuffer.push({
        id: `plm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: Date.now(),
        subsystem,
        metricName,
        durationMs,
        success,
        errorDetails,
    });
}

/**
 * In-memory simulation override for chaos-style failure testing without infrastructure damage.
 */
export function simulateSubsystemDegradation(
    subsystem: SubsystemName,
    status: PlatformHealthStatus,
    reason: string
): void {
    simulatedOverrides.set(subsystem, { status, reason });
}

/**
 * Clear simulated overrides and reset metric buffers (used in tests).
 */
export function resetPlatformMetrics(): void {
    metricsBuffer.length = 0;
    simulatedOverrides.clear();
}

/**
 * Calculate p95 latency from an array of duration numbers.
 */
function calculateP95(durations: number[]): number {
    if (durations.length === 0) return 0;
    const sorted = [...durations].sort((a, b) => a - b);
    const index = Math.ceil(0.95 * sorted.length) - 1;
    return sorted[Math.max(0, index)] ?? 0;
}

/**
 * Evaluates the real health of a specific subsystem based on recent metrics.
 */
function evaluateSubsystem(subsystem: SubsystemName, windowMs = 300_000): SubsystemHealth {
    const override = simulatedOverrides.get(subsystem);
    if (override) {
        return {
            subsystem,
            status: override.status,
            latencyP95Ms: 0,
            errorRate: override.status === "UNAVAILABLE" ? 1.0 : 0.5,
            totalOperations: 0,
            details: override.reason,
            lastChecked: new Date().toISOString(),
        };
    }

    const cutoff = Date.now() - windowMs;
    const relevant = metricsBuffer.filter((m) => m.subsystem === subsystem && m.timestamp >= cutoff);

    if (relevant.length === 0) {
        return {
            subsystem,
            status: "HEALTHY",
            latencyP95Ms: 0,
            errorRate: 0,
            totalOperations: 0,
            details: "No recent errors observed; operational baseline normal.",
            lastChecked: new Date().toISOString(),
        };
    }

    const errors = relevant.filter((m) => !m.success);
    const durations = relevant.map((m) => m.durationMs).filter((d): d is number => typeof d === "number");
    const p95 = calculateP95(durations);
    const errorRate = relevant.length > 0 ? errors.length / relevant.length : 0;

    let status: PlatformHealthStatus = "HEALTHY";
    let details = `Operational baseline normal. Total operations: ${relevant.length}.`;

    if (errorRate >= 0.5) {
        status = "UNAVAILABLE";
        details = `Critical failure rate (${(errorRate * 100).toFixed(1)}%). Most operations failing.`;
    } else if (errorRate > 0.1 || p95 > 2000) {
        status = "DEGRADED";
        details = `Elevated error rate (${(errorRate * 100).toFixed(1)}%) or high latency (p95=${p95}ms).`;
    } else if (errorRate > 0) {
        status = "PARTIAL";
        details = `Minor intermittent errors observed (${errors.length}/${relevant.length} failed).`;
    }

    return {
        subsystem,
        status,
        latencyP95Ms: p95,
        errorRate: Math.round(errorRate * 1000) / 1000,
        totalOperations: relevant.length,
        details,
        lastChecked: new Date().toISOString(),
    };
}

/**
 * Returns a comprehensive, audit-ready summary of Halo Trace platform health.
 */
export function getPlatformHealthSummary(): PlatformHealthSummary {
    const subsystemsList: SubsystemName[] = [
        "INGESTION",
        "DATABASE",
        "ANALYSIS",
        "INTEGRATIONS",
        "REPLAY",
        "BACKGROUND_JOBS",
    ];

    const subsystems = {} as Record<SubsystemName, SubsystemHealth>;
    const activeWarnings: string[] = [];

    for (const sub of subsystemsList) {
        const health = evaluateSubsystem(sub);
        subsystems[sub] = health;
        if (health.status !== "HEALTHY") {
            activeWarnings.push(`Subsystem ${sub} is ${health.status}: ${health.details}`);
        }
    }

    // Determine overall platform status
    let overallStatus: PlatformHealthStatus = "HEALTHY";
    const statuses = Object.values(subsystems).map((s) => s.status);

    if (statuses.includes("UNAVAILABLE")) {
        // If core database or analysis is unavailable, platform is unavailable
        if (subsystems.DATABASE.status === "UNAVAILABLE" || subsystems.ANALYSIS.status === "UNAVAILABLE") {
            overallStatus = "UNAVAILABLE";
        } else {
            overallStatus = "DEGRADED";
        }
    } else if (statuses.includes("DEGRADED")) {
        overallStatus = "DEGRADED";
    } else if (statuses.includes("PARTIAL")) {
        overallStatus = "PARTIAL";
    }

    return {
        overallStatus,
        checkedAt: new Date().toISOString(),
        subsystems,
        activeWarnings,
    };
}

export const PlatformHealthReporter = {
    recordOperation: (
        subsystem: SubsystemName,
        durationMs: number,
        isError = false,
        errorDetails?: string
    ) => {
        recordPlatformMetric(subsystem, "operation", durationMs, !isError, errorDetails);
    },
    resetMetrics: resetPlatformMetrics,
    simulateDegradation: simulateSubsystemDegradation,
};
