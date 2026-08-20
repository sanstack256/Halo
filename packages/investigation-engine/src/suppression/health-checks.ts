import type { Evidence } from "../types/evidence";

const HEALTH_CHECK_PATTERNS = [
    /\b(?:healthz|livez|readyz|health_?check|\/health|\/ping|\/status|heartbeat)\b/i,
];

export function isBenignHealthCheck(evidence: Evidence): boolean {
    const text = `${evidence.title} ${evidence.description || ""} ${evidence.resource || ""} ${evidence.operation || ""}`;
    const matchesPattern = HEALTH_CHECK_PATTERNS.some((p) => p.test(text));

    if (!matchesPattern) {
        return false;
    }

    // A health check that is 200/OK or type LOG is benign noise
    if (evidence.type === "LOG" || evidence.status === 200 || evidence.status === "OK" || evidence.status === "healthy") {
        return true;
    }

    return false;
}

export function filterHealthCheckNoise(evidence: Evidence[]): {
    filtered: Evidence[];
    suppressedCount: number;
} {
    const filtered: Evidence[] = [];
    let suppressedCount = 0;

    for (const item of evidence) {
        if (isBenignHealthCheck(item)) {
            suppressedCount++;
        } else {
            filtered.push(item);
        }
    }

    // If filtering removed everything, preserve the original so we never return empty unexpectedly
    if (filtered.length === 0 && evidence.length > 0) {
        return { filtered: evidence, suppressedCount: 0 };
    }

    return { filtered, suppressedCount };
}
