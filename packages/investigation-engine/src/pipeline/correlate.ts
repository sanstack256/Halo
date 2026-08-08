import type { Evidence } from "../types/evidence";
import type {
    EvidenceEdge,
    EvidenceGraph,
} from "../types/graph";

const TEMPORAL_WINDOW_MS = 5 * 60 * 1000;

export function correlateEvidence(
    evidence: Evidence[]
): EvidenceGraph {
    const nodes = evidence.map(item => ({
        id: item.id,
        evidence: item,
    }));

    const edges: EvidenceEdge[] = [];

    for (let i = 0; i < evidence.length; i++) {
        for (let j = i + 1; j < evidence.length; j++) {
            const left = evidence[i];
            const right = evidence[j];

            const leftTime = left.timestamp.getTime();
            const rightTime = right.timestamp.getTime();

            const timeDifference =
                Math.abs(rightTime - leftTime);

            if (
                rightTime > leftTime &&
                timeDifference <= TEMPORAL_WINDOW_MS
            ) {
                const confidence =
                    1 -
                    timeDifference /
                        TEMPORAL_WINDOW_MS;

                edges.push({
                    from: left.id,
                    to: right.id,
                    relationship: "PRECEDES",
                    confidence,
                    evidenceIds: [
                        left.id,
                        right.id,
                    ],
                });
            }

            if (
                left.service &&
                right.service &&
                left.service === right.service
            ) {
                edges.push({
                    from: left.id,
                    to: right.id,
                    relationship: "SAME_SERVICE",
                    confidence: 1,
                    evidenceIds: [
                        left.id,
                        right.id,
                    ],
                });
            }

            if (
                left.release &&
                right.release &&
                left.release === right.release
            ) {
                edges.push({
                    from: left.id,
                    to: right.id,
                    relationship: "SAME_RELEASE",
                    confidence: 1,
                    evidenceIds: [
                        left.id,
                        right.id,
                    ],
                });
            }

            if (
                left.traceId &&
                right.traceId &&
                left.traceId === right.traceId
            ) {
                edges.push({
                    from: left.id,
                    to: right.id,
                    relationship: "SAME_TRACE",
                    confidence: 1,
                    evidenceIds: [
                        left.id,
                        right.id,
                    ],
                });
            }

            if (
                left.requestId &&
                right.requestId &&
                left.requestId === right.requestId
            ) {
                edges.push({
                    from: left.id,
                    to: right.id,
                    relationship: "SAME_REQUEST",
                    confidence: 1,
                    evidenceIds: [
                        left.id,
                        right.id,
                    ],
                });
            }

            if (
                left.resource &&
                right.resource &&
                left.resource === right.resource
            ) {
                edges.push({
                    from: left.id,
                    to: right.id,
                    relationship: "SAME_RESOURCE",
                    confidence: 1,
                    evidenceIds: [
                        left.id,
                        right.id,
                    ],
                });
            }
        }
    }

    return {
        nodes,
        edges,
    };
}