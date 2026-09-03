/**
 * Halo Trace Explore — Shared Evidence Provenance & States
 * Defines canonical data contracts for all Explore analyzers and UI components.
 */

export type EvidenceState =
    | "OBSERVED"
    | "DERIVED"
    | "CORRELATED"
    | "UNKNOWN"
    | "NOT_CAPTURED"
    | "NOT_APPLICABLE"
    | "INSUFFICIENT";

export type RelationshipType =
    | "DIRECT"
    | "TRACE_LINK"
    | "REQUEST_LINK"
    | "SESSION_LINK"
    | "PARENT_SPAN"
    | "CHILD_SPAN"
    | "TEMPORAL_CONTEXT"
    | "CORRELATED"
    | "COMPARATIVE"
    | "NO_DIRECT_LINK";

export interface EvidenceProvenance {
    sourceEventIds: string[];
    sourceSpanIds: string[];
    sourceRequestIds: string[];
    sourceTraceIds: string[];
    timeRange?: { from: Date; to: Date };
    relationshipType: RelationshipType;
    derivationType: string;
    evidenceState: EvidenceState;
    description: string;
}

export interface CanonicalEvidenceRecord {
    id: string;
    type: "ERROR" | "LOG" | "MESSAGE" | "TRACE";
    severity: "INFO" | "WARNING" | "ERROR" | "FATAL";
    title: string;
    message: string | null;
    timestamp: Date;
    projectId: string;
    projectName: string;
    environmentId: string;
    environmentName: string;
    service: string | null;
    release: string | null;
    operation: string | null;
    resource: string | null;
    status: string | null;
    durationMs: number | null;
    traceId: string | null;
    requestId: string | null;
    sessionId: string | null;
    issueId: string | null;
    fingerprint: string | null;
    stack: string | null;
    metadata: Record<string, unknown>;
    tags: Record<string, string>;
    breadcrumbs: Array<Record<string, unknown>>;
    user: Record<string, unknown> | null;
    sdkName: string | null;
    sdkVersion: string | null;
    provenance?: EvidenceProvenance;
}

export interface AnalyticalResultProvenance {
    basisEvidenceIds: string[];
    relationshipType: RelationshipType;
    derivationType: string;
    evidenceState: EvidenceState;
    summary: string;
    canBeEstablished: string[];
    cannotBeEstablished: string[];
}
