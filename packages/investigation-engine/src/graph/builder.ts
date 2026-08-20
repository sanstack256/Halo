import type { Evidence } from "../types/evidence";
import type { EvidenceGraph, EvidenceNode, EvidenceEdge, RelationshipType } from "../types/graph";
import type { AnomalySignal } from "../types/anomaly";

const MAX_EDGES_PER_PAIR = 1;
const TEMPORAL_WINDOW_MS = 5 * 60 * 1000;
const CAUSAL_WINDOW_MS = 10 * 60 * 1000;

export function buildEvidenceGraph(
    evidence: Evidence[],
    anomalies?: AnomalySignal[]
): EvidenceGraph {
    const nodes: EvidenceNode[] = evidence.map((item) => ({
        id: item.id,
        evidence: item,
    }));

    if (evidence.length < 2) {
        return { nodes, edges: [] };
    }

    const edges: EvidenceEdge[] = [];
    const edgeSet = new Set<string>();

    const addEdge = (
        fromId: string,
        toId: string,
        rel: RelationshipType,
        confidence: number,
        evidenceIds: string[]
    ) => {
        if (fromId === toId) return;
        const normalizedConfidence = Math.max(0, Math.min(1, confidence));
        if (normalizedConfidence <= 0) return;

        const key = `${fromId}:${toId}:${rel}`;
        if (edgeSet.has(key)) return;
        edgeSet.add(key);

        edges.push({
            from: fromId,
            to: toId,
            relationship: rel,
            confidence: normalizedConfidence,
            evidenceIds: Array.from(new Set(evidenceIds)),
        });
    };

    const chronological = [...evidence].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // 1. Temporal Precedence & Tracing
    for (let i = 0; i < chronological.length; i++) {
        const left = chronological[i];
        for (let j = i + 1; j < chronological.length; j++) {
            const right = chronological[j];
            const delta = right.timestamp.getTime() - left.timestamp.getTime();
            if (delta > CAUSAL_WINDOW_MS) break;
            if (delta <= 0) continue;

            // Direct causal triggers
            if (
                left.type === "DEPLOYMENT" &&
                (right.type === "ERROR" || (typeof right.status === "number" && right.status >= 400)) &&
                left.service === right.service
            ) {
                const proximity = 1 - delta / CAUSAL_WINDOW_MS;
                addEdge(left.id, right.id, "TRIGGERS", 0.6 + 0.35 * proximity, [left.id, right.id]);
            } else if (
                (left.type === "CONFIG" || left.type === "FEATURE_FLAG") &&
                (right.type === "ERROR" || (typeof right.status === "number" && right.status >= 400)) &&
                (left.service === right.service || left.resource === right.resource)
            ) {
                addEdge(left.id, right.id, "MODIFIES", 0.75, [left.id, right.id]);
            } else if (
                left.type === "INFRASTRUCTURE" &&
                (right.type === "ERROR" || (typeof right.status === "number" && right.status >= 400))
            ) {
                addEdge(left.id, right.id, "AFFECTS", 0.8, [left.id, right.id]);
            } else if (delta <= TEMPORAL_WINDOW_MS) {
                const proximity = 1 - delta / TEMPORAL_WINDOW_MS;
                addEdge(left.id, right.id, "PRECEDES", 0.5 * proximity, [left.id, right.id]);
            }
        }
    }

    // 2. Identity Correlations (Distributed Tracing, Request ID, Service, Release, Resource)
    for (let i = 0; i < evidence.length; i++) {
        const left = evidence[i];
        for (let j = i + 1; j < evidence.length; j++) {
            const right = evidence[j];

            if (left.traceId && right.traceId && left.traceId === right.traceId) {
                addEdge(left.id, right.id, "SAME_TRACE", 1.0, [left.id, right.id]);
            }

            if (left.requestId && right.requestId && left.requestId === right.requestId) {
                addEdge(left.id, right.id, "SAME_REQUEST", 1.0, [left.id, right.id]);
            }

            if (left.service && right.service && left.service === right.service) {
                addEdge(left.id, right.id, "SAME_SERVICE", 0.55, [left.id, right.id]);
            }

            if (left.release && right.release && left.release === right.release) {
                addEdge(left.id, right.id, "SAME_RELEASE", 0.8, [left.id, right.id]);
            }

            if (left.resource && right.resource && left.resource === right.resource) {
                addEdge(left.id, right.id, "SAME_RESOURCE", 0.75, [left.id, right.id]);
            }

            // Cross-service dependencies (Third-party, DB, Queue)
            if (
                left.service !== right.service &&
                left.resource &&
                right.resource &&
                left.resource === right.resource
            ) {
                addEdge(left.id, right.id, "DEPENDS_ON", 0.85, [left.id, right.id]);
            }
        }
    }

    return { nodes, edges };
}
