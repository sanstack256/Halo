import type { Evidence } from "../../types/evidence";
import type { AnomalySignal, StatisticalBaseline } from "../../types/anomaly";

export function detectDistributionShifts(
    evidence: Evidence[],
    baselines: Map<string, StatisticalBaseline>
): AnomalySignal[] {
    const anomalies: AnomalySignal[] = [];

    const byService = new Map<string, Evidence[]>();
    for (const item of evidence) {
        const list = byService.get(item.service) || [];
        list.push(item);
        byService.set(item.service, list);
    }

    for (const [service, items] of byService.entries()) {
        const baseline = baselines.get(service);
        if (!baseline || items.length < 5) {
            continue;
        }

        const errorCount = items.filter(
            (e) => e.type === "ERROR" || (typeof e.status === "number" && e.status >= 400)
        ).length;

        const currentErrorRate = errorCount / items.length;

        // If error rate is high (> 40%) and has multiple distinct errors
        if (currentErrorRate >= 0.4 && errorCount >= 3) {
            const errorItems = items.filter(
                (e) => e.type === "ERROR" || (typeof e.status === "number" && e.status >= 400)
            );

            anomalies.push({
                id: `dist-shift:${service}:${errorItems[0].id}`,
                type: "ERROR_DISTRIBUTION_SHIFT",
                severity: currentErrorRate >= 0.7 ? "CRITICAL" : "HIGH",
                title: `Elevated Error Ratio (${Math.round(currentErrorRate * 100)}% failures)`,
                description: `Service "${service}" has an anomalous failure ratio of ${Math.round(currentErrorRate * 100)}% across ${items.length} observed events.`,
                service,
                resource: errorItems[0].resource,
                operation: errorItems[0].operation,
                timestamp: errorItems[0].timestamp,
                evidenceIds: errorItems.map((e) => e.id),
                score: Math.min(1.0, 0.5 + currentErrorRate * 0.4),
                metrics: {
                    errorCount,
                    totalCount: items.length,
                    errorRatio: currentErrorRate,
                },
            });
        }
    }

    return anomalies;
}
