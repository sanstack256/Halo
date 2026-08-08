import type {
    EvidenceGraph,
} from "../types/graph";

import type {
    Timeline,
} from "../types/timeline";

export function buildTimeline(
    graph: EvidenceGraph
): Timeline {

    return {
        events: graph.nodes.map((node) => ({

            id: node.id,

            timestamp:
                node.evidence.timestamp,

            type: "OBSERVATION",

            title:
                node.evidence.title,

            description:
                node.evidence.description,

            evidenceIds: [
                node.id,
            ],

        })),
    };
}