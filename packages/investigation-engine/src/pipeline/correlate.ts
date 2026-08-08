import type { Evidence } from "../types/evidence";
import { sameService } from "../rules/service";
import type {
    EvidenceEdge,
    EvidenceGraph,
} from "../types/graph";

export function correlateEvidence(
    evidence: Evidence[]
): EvidenceGraph {

    const nodes = evidence.map((item) => ({
        id: item.id,
        evidence: item,
    }));

    const edges: EvidenceEdge[] = [];

    for (let i = 0; i < evidence.length; i++) {

        for (
            let j = i + 1;
            j < evidence.length;
            j++
        ) {

            const left = evidence[i];
            const right = evidence[j];

            if (
                sameService(left, right)
            ) {

                edges.push({

                    from: left.id,

                    to: right.id,

                    relationship:
                        "RELATED_TO",

                    confidence: 0.6,

                });

            }

        }

    }

    return {
        nodes,
        edges,
    };
}