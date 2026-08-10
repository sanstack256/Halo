import type {
    EvidenceGraph,
} from "../types/graph";

import type {
    Timeline,
    TimelineEventType,
} from "../types/timeline";

export function buildTimeline(
    graph: EvidenceGraph
): Timeline {
    const events = graph.nodes.map(node => {
        const evidence = node.evidence;

        let type: TimelineEventType = "OBSERVATION";

        if (evidence.type === "DEPLOYMENT") {
            type = "CHANGE";
        } else if (evidence.type === "ERROR") {
            type = "ERROR";
        } else if (
            evidence.type === "CONFIG" ||
            evidence.type === "FEATURE_FLAG" ||
            evidence.type === "INFRASTRUCTURE"
        ) {
            type = "CHANGE";
        }

        return {
            id: node.id,
            timestamp: evidence.timestamp,
            type,
            title: evidence.title,
            description: evidence.description,
            evidenceIds: [node.id],
        };
    });

    return {
        events: events.sort(
            (a, b) =>
                a.timestamp.getTime() -
                b.timestamp.getTime()
        ),
    };
}