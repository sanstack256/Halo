import type {
    EvidenceGraph,
} from "../types/graph";

import type {
    Timeline,
    TimelineEventType,
} from "../types/timeline";

export function buildTimeline(
    graph: EvidenceGraph,
): Timeline {
    const events = graph.nodes
        .map(node => {
            const evidence =
                node.evidence;

            return {
                id: node.id,

                timestamp:
                    evidence.timestamp,

                type:
                    getTimelineEventType(
                        evidence.type,
                    ),

                title:
                    evidence.title,

                description:
                    evidence.description,

                evidenceIds: [
                    evidence.id,
                ],
            };
        })
        .sort(
            (a, b) =>
                a.timestamp.getTime() -
                b.timestamp.getTime() ||
                a.id.localeCompare(
                    b.id,
                ),
        );

    return {
        events,
    };
}

function getTimelineEventType(
    type: string,
): TimelineEventType {
    switch (type) {
        case "DEPLOYMENT":
        case "CONFIG":
        case "FEATURE_FLAG":
        case "INFRASTRUCTURE":
        case "TRAFFIC":
            return "CHANGE";

        case "ERROR":
            return "ERROR";

        case "METRIC":
            return "ANOMALY";

        case "LOG":
        case "TRACE":
        case "COMMIT":
        case "THIRD_PARTY":
        default:
            return "OBSERVATION";
    }
}