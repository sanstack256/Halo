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

export type EntityNodeType =
    | "EVENT"
    | "EXCEPTION"
    | "STACK_FRAME"
    | "FUNCTION"
    | "SOURCE_FILE"
    | "REQUEST"
    | "TRACE"
    | "SPAN"
    | "LOG"
    | "DATABASE_OPERATION"
    | "DEPLOYMENT"
    | "COMMIT"
    | "RELEASE"
    | "USER_SESSION"
    | "SERVICE"
    | "FEATURE_FLAG";

export type EntityRelationshipType =
    | "CAUSED"
    | "CALLED"
    | "PRECEDED"
    | "FOLLOWED"
    | "DEPLOYED_WITH"
    | "CHANGED_BY"
    | "DEPENDS_ON"
    | "CORRELATED_WITH"
    | "REPRODUCED_BY";

export interface InvestigationEntityNode {
    id: string;
    type: EntityNodeType;
    label: string;
    subtitle?: string;
    service?: string;
    timestamp?: string | Date;
    location?: string;
    telemetryId?: string;
    provenance: string;
    status?: string | number;
    metadata?: Record<string, unknown>;
    isAnchor?: boolean;
    isRootCauseCandidate?: boolean;
}

export interface InvestigationEntityEdge {
    id: string;
    from: string;
    to: string;
    relationship: EntityRelationshipType;
    label: string;
    classification: CausalClassification;
    strength: number;
    explanation: string;
    supportingEvidence: string[];
    correlationKeys: string[];
    timestamps?: { from?: string | Date; to?: string | Date; deltaMs?: number };
    provenance: string;
}

export interface ComprehensiveEvidenceGraph {
    nodes: InvestigationEntityNode[];
    edges: InvestigationEntityEdge[];
    anchorNodeId?: string;
    summary: {
        totalNodes: number;
        totalEdges: number;
        observedCount: number;
        inferredCount: number;
        correlatedCount: number;
    };
}

export interface CausalChainStep {
    evidenceId: string;
    service: string;
    title: string;
    role: "ROOT_CAUSE" | "CANDIDATE_CAUSE" | "TRIGGER" | "CONTRIBUTOR" | "PROPAGATION" | "STRUCTURAL_CONTEXT" | "SYMPTOM" | "CONTEXT" | "UNRESOLVED";
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