import type { Evidence } from "../../types/evidence";
import type { AnomalySignal } from "../../types/anomaly";

export function detectDegradationSequences(evidence: Evidence[]): AnomalySignal[] {
    const anomalies: AnomalySignal[] = [];

    const chronological = [...evidence].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Look for degradation sequence within the same service:
    // e.g. latency degradation / warnings -> hard errors / crashes
    const byService = new Map<string, Evidence[]>();
    for (const item of chronological) {
        const list = byService.get(item.service) || [];
        list.push(item);
        byService.set(item.service, list);
    }

    for (const [service, items] of byService.entries()) {
        for (let i = 0; i < items.length - 1; i++) {
            const early = items[i];
            const isDegradation =
                early.type === "METRIC" ||
                (typeof early.durationMs === "number" && early.durationMs >= 1000) ||
                /\b(?:warning|degraded|slow|retry|high\s*latency)\b/i.test(
                    `${early.title} ${early.description || ""}`
                );

            if (!isDegradation) continue;

            const downstreamErrors = items.slice(i + 1).filter(
                (e) =>
                    (e.type === "ERROR" || (typeof e.status === "number" && e.status >= 500)) &&
                    e.timestamp.getTime() - early.timestamp.getTime() <= 10 * 60 * 1000
            );

            if (downstreamErrors.length >= 2) {
                const leadSec = Math.round(
                    (downstreamErrors[0].timestamp.getTime() - early.timestamp.getTime()) / 1000
                );

                anomalies.push({
                    id: `sequence:${service}:${early.id}`,
                    type: "SILENT_DEGRADATION",
                    severity: "HIGH",
                    title: `Pre-Incident Latency / Warning Degradation in ${service}`,
                    description: `Degradation ("${early.title}") preceded severe errors by ${leadSec}s in service "${service}".`,
                    service,
                    resource: early.resource,
                    timestamp: early.timestamp,
                    evidenceIds: [early.id, ...downstreamErrors.map((e) => e.id)],
                    score: 0.82,
                    metrics: {
                        leadTimeSeconds: leadSec,
                        downstreamErrors: downstreamErrors.length,
                    },
                });
                break; // One sequence per service is sufficient
            }
        }
    }

    return anomalies;
}
