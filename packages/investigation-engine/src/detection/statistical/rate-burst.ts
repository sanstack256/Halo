import type { Evidence } from "../../types/evidence";
import type { AnomalySignal, StatisticalBaseline } from "../../types/anomaly";

const BIN_SIZE_MS = 30 * 1000; // 30-second bins

export function detectRateBursts(
    evidence: Evidence[],
    baselines: Map<string, StatisticalBaseline>
): AnomalySignal[] {
    const anomalies: AnomalySignal[] = [];
    if (evidence.length < 3) {
        return anomalies;
    }

    const byService = new Map<string, Evidence[]>();
    for (const item of evidence) {
        const list = byService.get(item.service) || [];
        list.push(item);
        byService.set(item.service, list);
    }

    for (const [service, items] of byService.entries()) {
        const baseline = baselines.get(service);
        if (!baseline || baseline.sampleCount < 4) {
            continue;
        }

        // Only look for failure bursts (errors or 5xx)
        const errorItems = items.filter(
            (e) => e.type === "ERROR" || (typeof e.status === "number" && e.status >= 400)
        );

        if (errorItems.length < 3) {
            continue;
        }

        // Group into temporal bins
        const bins = new Map<number, Evidence[]>();
        for (const item of errorItems) {
            const binKey = Math.floor(item.timestamp.getTime() / BIN_SIZE_MS) * BIN_SIZE_MS;
            const binList = bins.get(binKey) || [];
            binList.push(item);
            bins.set(binKey, binList);
        }

        // Expected error rate per 30-second bin
        const expectedPerBin = Math.max(0.5, (baseline.meanRate * baseline.errorRate) / 2);

        for (const [binTime, binEvidence] of bins.entries()) {
            const count = binEvidence.length;
            const ratio = count / expectedPerBin;

            if (count >= 3 && ratio >= 2.5) {
                const intensity = Math.min(1.0, 0.5 + (ratio - 2.5) * 0.1);
                anomalies.push({
                    id: `rate-burst:${service}:${binTime}`,
                    type: "RATE_BURST",
                    severity: ratio >= 5 || count >= 10 ? "CRITICAL" : "HIGH",
                    title: `Error Rate Burst (${count} errors in 30s)`,
                    description: `Service "${service}" experienced an error burst with ${count} failures in 30s (${ratio.toFixed(1)}x expected baseline).`,
                    service,
                    resource: binEvidence[0]?.resource,
                    operation: binEvidence[0]?.operation,
                    timestamp: new Date(binTime),
                    evidenceIds: binEvidence.map((e) => e.id),
                    score: intensity,
                    metrics: {
                        burstCount: count,
                        baselineExpectedPerBin: expectedPerBin,
                        ratio,
                    },
                });
            }
        }
    }

    return anomalies;
}
