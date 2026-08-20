import type { Evidence } from "../../types/evidence";
import type { AnomalySignal, StatisticalBaseline } from "../../types/anomaly";

export function detectLatencyAnomalies(
    evidence: Evidence[],
    baselines: Map<string, StatisticalBaseline>
): AnomalySignal[] {
    const anomalies: AnomalySignal[] = [];

    const byService = new Map<string, Evidence[]>();
    for (const item of evidence) {
        if (typeof item.durationMs === "number" && item.durationMs > 0) {
            const list = byService.get(item.service) || [];
            list.push(item);
            byService.set(item.service, list);
        }
    }

    for (const [service, items] of byService.entries()) {
        const baseline = baselines.get(service);
        if (!baseline || baseline.p95DurationMs <= 0 || items.length < 3) {
            continue;
        }

        // Outliers exceeding 3x p95 latency or > 10,000ms
        const threshold = Math.max(2000, baseline.p95DurationMs * 2.5);
        const outliers = items.filter((e) => (e.durationMs || 0) >= threshold);

        if (outliers.length >= 2) {
            const maxDuration = Math.max(...outliers.map((o) => o.durationMs || 0));
            const avgOutlier = Math.round(
                outliers.reduce((sum, o) => sum + (o.durationMs || 0), 0) / outliers.length
            );

            anomalies.push({
                id: `latency-spike:${service}:${outliers[0].id}`,
                type: "LATENCY_SPIKE",
                severity: maxDuration >= 10_000 || outliers.length >= 5 ? "CRITICAL" : "HIGH",
                title: `Latency Degradation Spike (avg ${avgOutlier}ms)`,
                description: `Service "${service}" observed ${outliers.length} requests with severe latency degradation exceeding baseline thresholds (max ${maxDuration}ms vs p95 ${baseline.p95DurationMs}ms).`,
                service,
                resource: outliers[0].resource,
                operation: outliers[0].operation,
                timestamp: outliers[0].timestamp,
                evidenceIds: outliers.map((o) => o.id),
                score: Math.min(1.0, 0.6 + (maxDuration / threshold) * 0.1),
                metrics: {
                    outlierCount: outliers.length,
                    averageDurationMs: avgOutlier,
                    maxDurationMs: maxDuration,
                    baselineP95Ms: baseline.p95DurationMs,
                },
            });
        }
    }

    return anomalies;
}
