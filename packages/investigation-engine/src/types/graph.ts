import type { Evidence } from "./evidence";

export interface EvidenceNode {
    id: string;

    evidence: Evidence;
}

export type RelationshipType =
    | "RELATED_TO"
    | "CAUSED_BY"
    | "DEPLOYED"
    | "MODIFIED"
    | "DEPENDS_ON"
    | "TRIGGERED"
    | "AFFECTS"
    | "OBSERVED_WITH";

export interface EvidenceEdge {
    from: string;

    to: string;

    relationship: RelationshipType;

    confidence: number;
}

export interface EvidenceGraph {
    nodes: EvidenceNode[];

    edges: EvidenceEdge[];
}