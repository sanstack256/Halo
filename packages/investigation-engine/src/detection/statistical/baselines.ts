import type { Evidence } from "../../types/evidence";
import type { StatisticalBaseline } from "../../types/anomaly";

export function computeBaselines(evidence: Evidence[]): Map<string, StatisticalBaseline> {
    const baselines = new Map<string, StatisticalBaseline>();
    if (evidence.length === 0) {
        return baselines;
    }

    const byService = new Map<string, Evidence[]>();
    for (const item of evidence) {
        const list = byService.get(item.service) || [];
        list.push(item);
        byService.set(item.service, list);
    }

    const timestamps = evidence.map((e) => e.timestamp.getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const totalMinutes = Math.max(1, (maxTime - minTime) / (60 * 1000));

    for (const [service, items] of byService.entries()) {
        const errorCount = items.filter(
            (e) => e.type === "ERROR" || (typeof e.status === "number" && e.status >= 400)
        ).length;

        const durations = items
            .map((e) => e.durationMs)
            .filter((d): d is number => typeof d === "number" && d >= 0)
            .sort((a, b) => a - b);

        const meanRate = items.length / totalMinutes;
        const errorRate = items.length > 0 ? errorCount / items.length : 0;

        let p50 = 0;
        let p95 = 0;
        let p99 = 0;

        if (durations.length > 0) {
            p50 = durations[Math.floor(durations.length * 0.5)];
            p95 = durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))];
            p99 = durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.99))];
        }

        baselines.set(service, {
            service,
            windowMinutes: totalMinutes,
            meanRate,
            stdDevRate: Math.max(0.1, Math.sqrt(meanRate)),
            p50DurationMs: p50,
            p95DurationMs: p95,
            p99DurationMs: p99,
            errorRate,
            sampleCount: items.length,
        });
    }

    return baselines;
}
