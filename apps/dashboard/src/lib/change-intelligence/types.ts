/**
 * Halo Trace — Pillar F: Change Intelligence & Causal Change Analysis
 * Core domain types and evidence structures.
 *
 * CRITICAL ARCHITECTURAL INVARIANTS:
 * 1. TEMPORAL IS NOT CAUSAL. Temporal proximity is only one signal.
 * 2. AUTHOR != OWNER != CULPRIT. Authors are purely historical metadata.
 * 3. NO BLAME TERMINOLOGY. No blameScore, culprit, or fault attribution.
 * 4. NO SILENT ASSUMPTIONS. Missing data is explicitly UNKNOWN / NOT_OBSERVED / UNAVAILABLE.
 * 5. CONTRADICTIONS SURFACED. Contradictory evidence explicitly weakens relationships.
 * 6. ROOT CAUSE IMMUTABILITY. Change intelligence NEVER mutates rootCause or confidenceScore.
 */

export type ChangeSourceType =
    | "GIT_COMMIT"
    | "DEPLOYMENT_EVENT"
    | "PULL_REQUEST"
    | "CONFIGURATION_CHANGE"
    | "DEPENDENCY_CHANGE"
    | "FEATURE_FLAG_CHANGE";

export type ChangeRelationshipType =
    | "UNRELATED"
    | "TEMPORALLY_RELATED"
    | "SERVICE_RELATED"
    | "CODE_PATH_RELATED"
    | "BEHAVIORALLY_RELATED"
    | "STRONGLY_SUPPORTED"
    | "INSUFFICIENT_EVIDENCE";

export type SignalLevel = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export interface EvidenceDimensions {
    temporalAlignment: SignalLevel;
    serviceIntersection: SignalLevel;
    fileIntersection: SignalLevel;
    lineIntersection: SignalLevel | "UNAVAILABLE";
    behavioralDivergence: SignalLevel | "INSUFFICIENT_EVIDENCE";
    deploymentLinkage: SignalLevel | "NOT_OBSERVED";
    directCausalEvidence: "NOT_OBSERVED" | "OBSERVED";
}

export interface ChangeEvidenceExplanation {
    matchingSignals: string[];
    missingSignals: string[];
    contradictingSignals: string[];
    evidenceReferences: string[];
    explanation: string;
}

export interface ChangedFileItem {
    filePath: string;
    status?: "added" | "modified" | "deleted" | "renamed" | string;
    additions?: number;
    deletions?: number;
    patch?: string;
    intersectsFailingPath: boolean;
    lineIntersection: SignalLevel | "UNAVAILABLE";
    declaredOwner?: string;
    ownerSource?: string;
}

export interface AnalyzedChangeCandidate {
    id: string;
    projectId: string;
    organizationId: string;
    changeKey: string;
    sourceType: ChangeSourceType;
    sourceVersion?: string | null;
    repository?: string | null;
    commitSha?: string | null;
    parentCommitSha?: string | null;
    commitMessage?: string | null;
    authorIdentity?: string | null; // Strictly historical metadata. Author != owner != culprit
    authorTimestamp?: Date | null;
    branch?: string | null;
    ref?: string | null;
    deploymentReference?: string | null;
    pullRequestReference?: string | null;
    serviceAssociation?: string | null;
    codePathAssociation?: string | null;
    changedFiles: ChangedFileItem[];
    additions?: number | null;
    deletions?: number | null;
    observedAt: Date;
    relationship: ChangeRelationshipType;
    evidenceDimensions: EvidenceDimensions;
    explanation: ChangeEvidenceExplanation;
    declaredOwner?: string | null;
    ownershipSource?: string | null;
    topologyImpact?: {
        affectedServices: string[];
        originService?: string;
    };
    historicalContext?: {
        matchingPattern?: string;
        similarIncidentsCount?: number;
    };
    metadata?: Record<string, any> | null;
}

export interface ChangeTimelineEntry {
    id: string;
    timestamp: Date;
    type:
        | "COMMIT"
        | "DEPLOYMENT"
        | "CONFIGURATION"
        | "FEATURE_FLAG"
        | "FAILURE_ONSET"
        | "REPLAY_ACTION"
        | "ERROR_SPIKE";
    title: string;
    description: string;
    source: string;
    referenceId?: string;
    service?: string;
    relationship?: ChangeRelationshipType;
}

export interface InvestigationChangeContext {
    investigationId: string;
    projectId: string;
    organizationId: string;
    investigationWindow: {
        start: Date;
        end: Date;
        failureOnset?: Date;
    } | null;
    changes: AnalyzedChangeCandidate[];
    timeline: ChangeTimelineEntry[];
    hasGitIntegration: boolean;
    hasDeploymentData: boolean;
    failingLocation?: {
        filePath?: string;
        lineNumber?: number;
        functionName?: string;
    };
    affectedServices: string[];
    rootCauseService?: string;
    contradictions: string[];
    uncertainties: string[];
}

export interface IngestChangeObservationInput {
    organizationId: string;
    projectId: string;
    sourceType: ChangeSourceType;
    repository?: string;
    commitSha?: string;
    parentCommitSha?: string;
    commitMessage?: string;
    authorIdentity?: string;
    authorTimestamp?: Date | string;
    sourceVersion?: string;
    deploymentReference?: string;
    pullRequestReference?: string;
    changedFiles?: Array<string | { filePath: string; status?: string; additions?: number; deletions?: number; patch?: string }>;
    additions?: number;
    deletions?: number;
    branch?: string;
    ref?: string;
    serviceAssociation?: string;
    codePathAssociation?: string;
    evidenceReferences?: string[];
    observedAt?: Date | string;
    metadata?: Record<string, any>;
}
