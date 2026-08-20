import type { Evidence } from "../../types/evidence";
import type { AnomalySignal } from "../../types/anomaly";

const CASCADE_WINDOW_MS = 60 * 1000; // 60 seconds

export function detectCascadingFailures(evidence: Evidence[]): AnomalySignal[] {
    const anomalies: AnomalySignal[] = [];

    const errors = evidence
        .filter((e) => e.type === "ERROR" || (typeof e.status === "number" && e.status >= 400))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (errors.length < 3) {
        return anomalies;
    }

    const services = Array.from(new Set(errors.map((e) => e.service)));
    if (services.length < 2) {
        return anomalies;
    }

    // Check if errors spread sequentially across services
    const cascadeChains: Evidence[][] = [];
    let currentChain: Evidence[] = [errors[0]];

    for (let i = 1; i < errors.length; i++) {
        const prev = currentChain[currentChain.length - 1];
        const curr = errors[i];
        const delta = curr.timestamp.getTime() - prev.timestamp.getTime();

        if (delta >= 0 && delta <= CASCADE_WINDOW_MS) {
            currentChain.push(curr);
        } else {
            if (currentChain.length >= 3) {
                cascadeChains.push(currentChain);
            }
            currentChain = [curr];
        }
    }

    if (currentChain.length >= 3) {
        cascadeChains.push(currentChain);
    }

    for (const chain of cascadeChains) {
        const chainServices = Array.from(new Set(chain.map((c) => c.service)));
        if (chainServices.length >= 2) {
            const initiating = chain[0];
            const durationSec = Math.round(
                (chain[chain.length - 1].timestamp.getTime() - initiating.timestamp.getTime()) / 1000
            );

            anomalies.push({
                id: `cascade:${initiating.service}:${initiating.id}`,
                type: "CASCADING_FAILURE",
                severity: chainServices.length >= 3 ? "CRITICAL" : "HIGH",
                title: `Cascading Multi-Service Failure initiated by ${initiating.service}`,
                description: `A cascading failure propagated across ${chainServices.length} services (${chainServices.join(" → ")}) within ${durationSec}s. Initiating error: "${initiating.title}".`,
                service: initiating.service,
                resource: initiating.resource,
                timestamp: initiating.timestamp,
                evidenceIds: chain.map((c) => c.id),
                score: Math.min(1.0, 0.7 + chainServices.length * 0.1),
                metrics: {
                    servicesInvolved: chainServices.length,
                    durationSeconds: durationSec,
                    chainLength: chain.length,
                    initiatingService: initiating.service,
                },
            });
        }
    }

    return anomalies;
}
