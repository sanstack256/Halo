import type { Evidence } from "../../types/evidence";
import type { AnomalySignal } from "../../types/anomaly";

const PROBE_PATTERNS = [
    /(?:UNION\s+SELECT|SELECT\s+.*\s+FROM|DROP\s+TABLE|--\s*$|;\s*SHUTDOWN|OR\s+1=1)/i,
    /(?:\.\.\/|\.\.\\|\/etc\/passwd|\/windows\/win\.ini|\/proc\/self)/i,
    /(?:<script|javascript:|onerror\s*=|onload\s*=|alert\()/i,
];

export function detectSecurityAnomalies(evidence: Evidence[]): AnomalySignal[] {
    const anomalies: AnomalySignal[] = [];

    // 1. Auth failure cluster detection (401 / 403 / Unauthorized)
    const authFailures = evidence.filter(
        (e) =>
            e.status === 401 ||
            e.status === 403 ||
            /\b(?:unauthorized|access\s*denied|permission\s*denied|invalid\s*credentials|forbidden)\b/i.test(
                `${e.title} ${e.description || ""}`
            )
    );

    if (authFailures.length >= 3) {
        const services = Array.from(new Set(authFailures.map((e) => e.service)));
        anomalies.push({
            id: `security:auth-failure-storm:${authFailures[0].service}`,
            type: "SECURITY_ANOMALY",
            severity: authFailures.length >= 10 ? "CRITICAL" : "HIGH",
            title: "Authentication / Authorization Storm",
            description: `Elevated cluster of ${authFailures.length} unauthorized or forbidden authentication attempts detected in service(s): ${services.join(", ")}.`,
            service: authFailures[0].service,
            resource: authFailures[0].resource,
            operation: authFailures[0].operation,
            timestamp: authFailures[0].timestamp,
            evidenceIds: authFailures.map((e) => e.id),
            score: Math.min(1.0, 0.6 + authFailures.length * 0.04),
            metrics: {
                failureCount: authFailures.length,
            },
        });
    }

    // 2. Probe / Injection patterns in resources or log titles
    const probeEvidence = evidence.filter((e) => {
        const text = `${e.title} ${e.description || ""} ${e.resource || ""} ${e.operation || ""}`;
        return PROBE_PATTERNS.some((p) => p.test(text));
    });

    if (probeEvidence.length > 0) {
        anomalies.push({
            id: `security:injection-probe:${probeEvidence[0].service}`,
            type: "SECURITY_ANOMALY",
            severity: "HIGH",
            title: "Suspicious Injection / Traversal Probe",
            description: `Observed ${probeEvidence.length} log event(s) containing exploit or traversal probe syntax.`,
            service: probeEvidence[0].service,
            resource: probeEvidence[0].resource,
            timestamp: probeEvidence[0].timestamp,
            evidenceIds: probeEvidence.map((e) => e.id),
            score: 0.85,
            metrics: {
                probeCount: probeEvidence.length,
            },
        });
    }

    return anomalies;
}
