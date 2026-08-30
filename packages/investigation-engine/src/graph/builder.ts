import type { Evidence } from "../types/evidence";
import type { EvidenceGraph } from "../types/graph";
import type { AnomalySignal } from "../types/anomaly";
import { correlateEvidence } from "../pipeline/correlate";

export function buildEvidenceGraph(
    evidence: Evidence[],
    _anomalies?: AnomalySignal[]
): EvidenceGraph {
    return correlateEvidence(evidence);
}
