/**
 * HALO TRACE — PILLAR G DOMAIN TYPES
 * Evidence Synthesis & Investigation Reasoning
 *
 * Deterministic domain representations for cross-pillar evidence synthesis,
 * independent evidence verification, minimum sufficient evidence chains,
 * and structured 9-part investigation narratives.
 */

export type EvidenceStatus =
    | "ESTABLISHED"
    | "SUPPORTED"
    | "CONTRADICTED"
    | "UNKNOWN"
    | "UNAVAILABLE";

export type EvidenceSourceType =
    | "RUNTIME"
    | "TRACE"
    | "STACK"
    | "DIFFERENTIAL"
    | "TOPOLOGY"
    | "REPLAY"
    | "CHANGE"
    | "DEPLOYMENT"
    | "OWNERSHIP"
    | "MEMORY"
    | "COLLABORATION"
    | "POSTMORTEM";

export interface EvidenceReference {
    id: string;
    sourceType: EvidenceSourceType;
    label: string;
    targetId: string;
    url?: string;
    timestamp?: string | Date;
    metadata?: Record<string, unknown>;
}

export interface EvidenceClaim {
    claimId: string;
    investigationId: string;
    statement: string;
    status: EvidenceStatus;
    sourceTypes: EvidenceSourceType[];
    evidenceReferences: EvidenceReference[];
    supportingClaims: string[];
    contradictingClaims: string[];
    independentSourceCount: number;
    firstObservedAt?: string | Date;
    lastObservedAt?: string | Date;
    relatedServices: string[];
    relatedOperations: string[];
    relatedCodePaths: string[];
    metadata?: Record<string, unknown>;
}

export type EvidenceChainRelationship =
    | "OBSERVED_IN"
    | "CAUSED_EXECUTION_OF"
    | "CALLED"
    | "PROPAGATED_TO"
    | "INTERSECTS"
    | "DEPLOYED_AS"
    | "OWNED_BY"
    | "DIFFERS_FROM"
    | "CORRELATED_WITH"
    | "HISTORICALLY_RESEMBLES"
    | "TEMPORALLY_RELATED";

export type EvidenceChainEdgeStatus =
    | "OBSERVED"
    | "SUPPORTED"
    | "INFERRED"
    | "UNKNOWN"
    | "CONTRADICTED";

export type EvidenceChainNodeType =
    | "FAILURE"
    | "ERROR_EVENT"
    | "REQUEST"
    | "SERVICE"
    | "OPERATION"
    | "STACK_FRAME"
    | "CHANGED_FILE"
    | "COMMIT"
    | "DEPLOYMENT"
    | "BASELINE"
    | "OWNER";

export interface EvidenceChainNode {
    id: string;
    type: EvidenceChainNodeType;
    label: string;
    status: EvidenceStatus;
    timestamp?: string | Date;
    source: EvidenceSourceType;
    evidenceReferences: EvidenceReference[];
    metadata?: Record<string, unknown>;
}

export interface EvidenceChainEdge {
    id: string;
    from: string;
    to: string;
    relationship: EvidenceChainRelationship;
    status: EvidenceChainEdgeStatus;
    evidenceCount: number;
    evidenceReferences: EvidenceReference[];
    explanation?: string;
}

export interface EvidenceChain {
    nodes: EvidenceChainNode[];
    edges: EvidenceChainEdge[];
    minimumChainNodeIds: string[];
    supportingNodeIds: string[];
}

export type NarrativeSectionId =
    | "what-happened"
    | "where-it-happened"
    | "how-it-propagated"
    | "what-changed"
    | "why-halo-supports"
    | "what-contradicts"
    | "historical-context"
    | "ownership-context"
    | "what-remains-unknown";

export interface NarrativeBulletPoint {
    text: string;
    references: EvidenceReference[];
    status: EvidenceStatus;
    contradictionNote?: string;
}

export interface InvestigationNarrativeSection {
    id: NarrativeSectionId;
    title: string;
    summary: string;
    claims: EvidenceClaim[];
    bulletPoints: NarrativeBulletPoint[];
}

export interface InvestigationNarrative {
    sections: InvestigationNarrativeSection[];
    generatedAt: string;
}

export interface RootCauseEvidenceMap {
    canonicalRootCause: string;
    confidenceScore: number;
    confidenceLevel?: string;
    observedSources: EvidenceSourceType[];
    supportedDimensions: string[];
    contradictedDimensions: string[];
    unknownDimensions: string[];
    explanation: string;
}

export interface SynthesisStatistics {
    totalClaims: number;
    establishedCount: number;
    supportedCount: number;
    contradictedCount: number;
    unknownCount: number;
    independentSourceCategories: number;
}

export interface InvestigationSynthesis {
    investigationId: string;
    projectId: string;
    organizationId: string;
    generatedAt: string;
    version: string;
    rootCauseMap: RootCauseEvidenceMap;
    claims: EvidenceClaim[];
    establishedClaims: EvidenceClaim[];
    supportedClaims: EvidenceClaim[];
    contradictedClaims: EvidenceClaim[];
    unknownClaims: EvidenceClaim[];
    chain: EvidenceChain;
    narrative: InvestigationNarrative;
    statistics: SynthesisStatistics;
}
