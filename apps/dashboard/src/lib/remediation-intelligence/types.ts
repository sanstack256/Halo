/**
 * HALO TRACE — PILLAR H DOMAIN TYPES
 * Evidence-Backed Remediation Intelligence
 *
 * Deterministic domain representations for evidence-backed remediation recommendations,
 * human audit tracking, status transitions, risk categorization, and validation criteria.
 */

export type RemediationType =
    | "CODE_CHANGE"
    | "CONFIGURATION_REVIEW"
    | "DEPENDENCY_REVIEW"
    | "DEPLOYMENT_REVIEW"
    | "FEATURE_FLAG_REVIEW"
    | "DATA_VALIDATION"
    | "OBSERVABILITY_GAP"
    | "REGRESSION_TEST"
    | "ROLLBACK_REVIEW"
    | "DOCUMENTATION_UPDATE"
    | "RUNBOOK_REVIEW";

export type RemediationStatus =
    | "ACTIONABLE"
    | "NEEDS_VALIDATION"
    | "INSUFFICIENT_EVIDENCE"
    | "BLOCKED"
    | "COMPLETED"
    | "DISMISSED";

export type RemediationSupportLevel =
    | "EVIDENCE_BACKED"
    | "PARTIALLY_SUPPORTED"
    | "INSUFFICIENT_EVIDENCE";

export type RemediationRiskLevel =
    | "LOW"
    | "MEDIUM"
    | "HIGH";

export interface RemediationOwnerContext {
    declaredOwner?: string;
    source?: string;
    confidence?: string;
    conflict?: boolean;
    conflictDetails?: string;
}

export interface HistoricalRemediationContext {
    historicalIncidentId?: string;
    historicalRecommendation: string;
    similarity: string;
    difference: string;
    mismatchNote?: string;
}

export interface RemediationNoteDomain {
    id: string;
    recommendationId: string;
    userId: string;
    userEmail?: string | null;
    userName?: string | null;
    content: string;
    createdAt: string;
}

export interface RemediationRecommendationDomain {
    id: string;
    organizationId: string;
    projectId: string;
    investigationId: string;
    recommendationKey: string;
    type: RemediationType;
    status: RemediationStatus;
    supportLevel: RemediationSupportLevel;
    riskLevel: RemediationRiskLevel;
    title: string;
    summary?: string | null;
    action: string;
    rationale?: string | null;
    expectedOutcome?: string | null;
    validationMethod?: string | null;
    prerequisites: string[];
    evidenceReferences: string[];
    supportingClaimIds: string[];
    affectedServices: string[];
    affectedOperations: string[];
    affectedCodePaths: string[];
    ownerContext?: RemediationOwnerContext | null;
    uncertainty?: string | null;
    completedAt?: string | null;
    completedBy?: string | null;
    dismissedAt?: string | null;
    dismissedBy?: string | null;
    dismissalReason?: string | null;
    historicalContext?: HistoricalRemediationContext | null;
    contradictionNotes?: string | null;
    notes?: RemediationNoteDomain[];
    metadata?: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
}

export interface GenerateRemediationsParams {
    investigationId: string;
    organizationId: string;
    projectId: string;
    forceFresh?: boolean;
}

export interface RemediationPlanResult {
    investigationId: string;
    projectId: string;
    organizationId: string;
    generatedAt: string;
    recommendations: RemediationRecommendationDomain[];
    hasInsufficientEvidence: boolean;
    insufficientEvidenceReason?: string;
    contradictionsPresent: boolean;
}
