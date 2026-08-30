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
    | "CONTRADICTS"
    | "SUPPORTS"
    | "AMPLIFIES"
    | "EXPLAINS"
    | "CHILD_SPAN_OF"
    | "REQUEST_SPAN"
    | "CALLS_SERVICE"
    | "STACK_FRAME_CALLS"
    | "FRAME_LOCATION_OF"
    | "EXECUTES_QUERY"
    | "EMITS_LOG"
    | "CORRELATED_LOG"
    | "DOWNSTREAM_FAILURE_OF"
    | "TEMPORALLY_PRECEDES";

export type TemporalRelationship =
    | "BEFORE"
    | "AFTER"
    | "OVERLAPS"
    | "CONTAINS"
    | "IMMEDIATELY_PRECEDES"
    | "WITHIN_LIFETIME"
    | "TEMPORALLY_CORRELATED"
    | "UNKNOWN";

export type CausalClassification =
    | "Observed"
    | "Inferred"
    | "Likely"
    | "Unknown";

export interface StructuralCodeRelationship {
    relationType: "CALLS" | "CONTAINS" | "FRAME_LOCATION" | "ORIGINATES_FROM" | "NONE";
    functionName?: string;
    filePath?: string;
    lineNumber?: number;
    columnNumber?: number;
    callPath?: string[];
    stackFrame?: string;
    explanation?: string;
}

export interface StrengthFactor {
    factor: string;
    contribution: number;
    explanation: string;
}

export interface EvidenceEdge {
    from: string;
    to: string;
    relationship: RelationshipType;
    confidence: number;
    evidenceIds: string[];
    classification?: CausalClassification;
    temporal?: TemporalRelationship;
    structural?: StructuralCodeRelationship;
    strength?: number;
    strengthFactors?: StrengthFactor[];
    explanation?: string;
    provenance?: string;
}

export interface EvidenceGraph {
    nodes: EvidenceNode[];
    edges: EvidenceEdge[];
}

export interface CausalChainStep {
    evidenceId: string;
    service: string;
    title: string;
    role: "ROOT_CAUSE" | "TRIGGER" | "PROPAGATION" | "SYMPTOM" | "CONTEXT";
    delayMs: number;
    edgeFromPrevious?: EvidenceEdge;
    provenance?: string;
    classification?: CausalClassification;
}

export interface CausalChain {
    id: string;
    rootEvidenceId: string;
    terminalEvidenceId: string;
    steps: CausalChainStep[];
    edges: EvidenceEdge[];
    pathSummary: string[];
    overallConfidence: number;
    overallClassification: CausalClassification;
    explanation: string;
}