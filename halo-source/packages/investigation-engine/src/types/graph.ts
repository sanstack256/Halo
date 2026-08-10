import type { Evidence } from "./evidence";

export interface EvidenceNode {
    id: string;
    evidence: Evidence;
}

export type RelationshipType =
    | "PRECEDES"
    | "FOLLOWS"
    | "SAME_SERVICE"
    | "SAME_RELEASE"
    | "SAME_TRACE"
    | "SAME_REQUEST"
    | "SAME_RESOURCE"
    | "DEPENDS_ON"
    | "AFFECTS"
    | "TRIGGERS"
    | "MODIFIES"
    | "CORRELATED_WITH"
    | "CAUSES"
    | "CONTRADICTS";

export interface EvidenceEdge {
    from: string;
    to: string;
    relationship: RelationshipType;
    confidence: number;
    evidenceIds: string[];
}

export interface EvidenceGraph {
    nodes: EvidenceNode[];
    edges: EvidenceEdge[];
}