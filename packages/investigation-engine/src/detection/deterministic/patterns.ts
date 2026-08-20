import type { Evidence } from "../../types/evidence";
import type { AnomalySignal } from "../../types/anomaly";

interface KnownSignature {
    id: string;
    type: AnomalySignal["type"];
    severity: AnomalySignal["severity"];
    title: string;
    description: string;
    match: (evidence: Evidence) => boolean;
    confidence: number;
}

const SIGNATURES: KnownSignature[] = [
    {
        id: "pattern:db-pool-exhaustion",
        type: "RESOURCE_SATURATION",
        severity: "CRITICAL",
        title: "Database Connection Pool Saturation",
        description: "Database connection pool reached maximum capacity or connection acquisition timed out.",
        match: (e) =>
            /\b(?:connection\s*pool|pool\s*timeout|remaining\s*connection\s*slots|too\s*many\s*connections|connection\s*acquisition\s*timeout|pool\s*exhausted|could\s*not\s*obtain\s*connection)\b/i.test(
                `${e.title} ${e.description || ""} ${e.resource || ""}`
            ),
        confidence: 0.95,
    },
    {
        id: "pattern:oom-killer",
        type: "RESOURCE_SATURATION",
        severity: "CRITICAL",
        title: "Out of Memory (OOM) Exhaustion",
        description: "Process memory limit exceeded or system OOM killer terminated the application.",
        match: (e) =>
            /\b(?:out\s*of\s*memory|heap\s*space|heap\s*out\s*of\s*memory|oom-killer|killed\s*process|javascript\s*heap\s*out\s*of\s*memory|enomem)\b/i.test(
                `${e.title} ${e.description || ""}`
            ),
        confidence: 0.95,
    },
    {
        id: "pattern:deadlock",
        type: "RESOURCE_SATURATION",
        severity: "HIGH",
        title: "Database Lock Contention / Deadlock",
        description: "Deadlock detected during concurrent transaction processing or lock acquisition timeout.",
        match: (e) =>
            /\b(?:deadlock\s*detected|lock\s*wait\s*timeout|deadlock\s*found|concurrent\s*update\s*conflict)\b/i.test(
                `${e.title} ${e.description || ""}`
            ),
        confidence: 0.9,
    },
    {
        id: "pattern:file-descriptor-exhaustion",
        type: "RESOURCE_SATURATION",
        severity: "CRITICAL",
        title: "File Descriptor / Socket Exhaustion",
        description: "System exceeded maximum open file descriptors or network socket limits.",
        match: (e) =>
            /\b(?:too\s*many\s*open\s*files|emfile|enfile|no\s*file\s*descriptors)\b/i.test(
                `${e.title} ${e.description || ""}`
            ),
        confidence: 0.9,
    },
    {
        id: "pattern:rate-limit",
        type: "RATE_BURST",
        severity: "HIGH",
        title: "Upstream Rate Limiting / 429 Throttling",
        description: "Requests were throttled or rejected due to exceeding rate limits.",
        match: (e) =>
            e.status === 429 ||
            /\b(?:rate\s*limit|too\s*many\s*requests|quota\s*exceeded|throttled|429\s*too\s*many)\b/i.test(
                `${e.title} ${e.description || ""}`
            ),
        confidence: 0.88,
    },
    {
        id: "pattern:cert-expired",
        type: "CONTRACT_VIOLATION",
        severity: "CRITICAL",
        title: "SSL / TLS Certificate Expiration",
        description: "Security certificate validation failed due to expiration or untrusted authority.",
        match: (e) =>
            /\b(?:certificate\s*has\s*expired|cert_has_expired|ssl\s*handshake\s*failed|x509:\s*certificate|sec_error_expired_certificate)\b/i.test(
                `${e.title} ${e.description || ""}`
            ),
        confidence: 0.95,
    },
    {
        id: "pattern:downstream-timeout",
        type: "CASCADING_FAILURE",
        severity: "HIGH",
        title: "Downstream Socket / Gateway Timeout",
        description: "A network request to an upstream service or resource timed out.",
        match: (e) =>
            e.status === 504 ||
            /\b(?:gateway\s*timeout|socket\s*hang\s*up|econnreset|etimedout|connection\s*refused|econnrefused)\b/i.test(
                `${e.title} ${e.description || ""}`
            ),
        confidence: 0.85,
    },
];

export function detectKnownFailurePatterns(evidence: Evidence[]): AnomalySignal[] {
    const anomalies: AnomalySignal[] = [];
    const matchedEvidenceBySig = new Map<string, Evidence[]>();

    for (const item of evidence) {
        for (const sig of SIGNATURES) {
            if (sig.match(item)) {
                const list = matchedEvidenceBySig.get(sig.id) || [];
                list.push(item);
                matchedEvidenceBySig.set(sig.id, list);
            }
        }
    }

    for (const sig of SIGNATURES) {
        const matched = matchedEvidenceBySig.get(sig.id);
        if (matched && matched.length > 0) {
            const first = matched[0];
            const services = Array.from(new Set(matched.map((m) => m.service)));

            anomalies.push({
                id: `${sig.id}:${first.service}:${first.id}`,
                type: sig.type,
                severity: sig.severity,
                title: sig.title,
                description: `${sig.description} (Observed across ${matched.length} event(s) in service: ${services.join(", ")}).`,
                service: first.service,
                resource: first.resource,
                operation: first.operation,
                timestamp: first.timestamp,
                evidenceIds: matched.map((m) => m.id),
                score: sig.confidence,
                metrics: {
                    matchCount: matched.length,
                    confidence: sig.confidence,
                },
            });
        }
    }

    return anomalies;
}
