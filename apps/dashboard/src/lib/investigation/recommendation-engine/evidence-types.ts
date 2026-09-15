/**
 * Halo Active Investigation & Repair Engine — Evidence Types & Sensitivity Classification
 *
 * Implements Phase 1, Phase 2, Phase 7, Phase 9:
 * 1. 40+ distinct evidence types across telemetry, source, AST, tests, releases, and replay.
 * 2. Strict 4-tier sensitivity classification (SAFE, REDACTABLE, SENSITIVE, FORBIDDEN).
 * 3. EvidenceAcquisitionPlan schema.
 * 4. Explicit investigation terminal states.
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* 1. Complete Evidence Types Inventory (40+ types)                           */
/* -------------------------------------------------------------------------- */

export const EvidenceTypeEnum = z.enum([
    // Telemetry & Runtime Errors
    "ERROR_EVENT",
    "STACK_TRACE",
    "EXCEPTION_CAUSE",
    "REQUEST",
    "RESPONSE",
    "HTTP_STATUS",
    "TRACE",
    "SPAN",
    "BREADCRUMB",
    "CONSOLE",
    "FETCH_XHR",
    "SESSION_REPLAY",
    "USER_ACTION",
    "PERFORMANCE_DATA",

    // Source Code & AST
    "SOURCE_FILE",
    "SOURCE_MAP",
    "GENERATED_BUNDLE",
    "AST",
    "CALL_GRAPH",
    "IMPORT_GRAPH",
    "TYPE_INFORMATION",
    "FUNCTION_SIGNATURE",
    "PARAMETER_FLOW",
    "RETURN_VALUE",
    "PROMISE_REJECTION",
    "ERROR_CONSTRUCTION",
    "ERROR_PROPAGATION",

    // Git, Releases & Deployment
    "CONFIGURATION_METADATA",
    "RELEASE",
    "DEPLOYMENT",
    "COMMIT",
    "COMMIT_DIFF",

    // Tests & Contracts
    "TESTS",
    "TEST_FIXTURES",
    "HISTORICAL_BEHAVIOR",
    "CURRENT_BEHAVIOR",
    "API_CONTRACT",
    "SCHEMA",
    "DATABASE_QUERY",
    "EXTERNAL_SERVICE_RESULT",
    "RETRY_BEHAVIOR",
    "FEATURE_FLAG_STATE",
    "ENVIRONMENT_CLASSIFICATION",
    "REPRODUCTION_RESULT",
]);

export type ComprehensiveEvidenceType = z.infer<typeof EvidenceTypeEnum>;

/* -------------------------------------------------------------------------- */
/* 2. Strict 4-Tier Sensitivity Boundary (Phase 7)                            */
/* -------------------------------------------------------------------------- */

export type SensitivityClassification = "SAFE" | "REDACTABLE" | "SENSITIVE" | "FORBIDDEN";

export interface EvidenceClassification {
    type: ComprehensiveEvidenceType;
    status: "AVAILABLE" | "UNAVAILABLE" | "STALE" | "PARTIAL";
    sensitivity: SensitivityClassification;
    acquisitionPossible: boolean;
    acquisitionMethod?: string;
    sourceRef?: string;
    summary?: string;
}

/* -------------------------------------------------------------------------- */
/* 3. Targeted Runtime Acquisition Actions (Phase 6)                          */
/* -------------------------------------------------------------------------- */

export type TargetedAcquisitionActionType =
    | "RESOLVE_DYNAMIC_CALLEE"
    | "CAPTURE_ARGUMENT_SHAPE"
    | "CAPTURE_SAFE_ARGUMENT_FIELDS"
    | "CAPTURE_RETURN_SHAPE"
    | "CAPTURE_PROMISE_REJECTION"
    | "CAPTURE_EXCEPTION_CAUSE"
    | "CORRELATE_REQUEST"
    | "CORRELATE_TRACE"
    | "CORRELATE_REPLAY"
    | "CAPTURE_EXTERNAL_RESPONSE_METADATA"
    | "CAPTURE_FEATURE_FLAG_STATE"
    | "CAPTURE_NON_SECRET_RUNTIME_CONFIGURATION"
    | "REPRODUCE_EXECUTION_PATH"
    | "CAPTURE_STATE_TRANSITION"
    | "RESOLVE_SOURCE_MAP"
    | "TRACE_REPOSITORY_CALLERS"
    | "EXTRACT_TEST_BEHAVIORAL_CONTRACT";

export interface TargetedAcquisitionAction {
    id: string;
    actionType: TargetedAcquisitionActionType;
    targetLocation: string;
    targetSymbol?: string;
    requiredFact: string;
    expectedInformationGain: "LOW" | "HIGH" | "CRITICAL";
    sensitivity: SensitivityClassification;
    estimatedOverhead: "NEGLIGIBLE" | "LOW" | "MEDIUM";
    isAutomated: boolean;
    requiresUserAuthorization: boolean;
    description: string;
}

/* -------------------------------------------------------------------------- */
/* 4. Evidence Acquisition Plan (Phase 1)                                     */
/* -------------------------------------------------------------------------- */

export interface EvidenceAcquisitionPlan {
    planId: string;
    createdAt: Date;
    requiredFacts: string[];
    alreadyKnownFacts: string[];
    missingFacts: string[];
    acquisitionOptions: TargetedAcquisitionAction[];
    selectedActions: TargetedAcquisitionAction[];
    blockedActions: Array<{
        action: TargetedAcquisitionAction;
        reason: string;
    }>;
    expectedInformationGain: "HIGH" | "CRITICAL";
    sensitivityClassification: SensitivityClassification;
    estimatedCost: "ZERO" | "LOW" | "MEDIUM";
    authorizationRequirement: "NONE_REQUIRED" | "DEVELOPER_APPROVAL_REQUIRED";
    completionState: "IN_PROGRESS" | "COMPLETED" | "BLOCKED" | "EXHAUSTED";
}

/* -------------------------------------------------------------------------- */
/* 5. Explicit Terminal States (Phase 9)                                      */
/* -------------------------------------------------------------------------- */

export type ActiveInvestigationTerminalState =
    | "REPAIR_CONFIRMED"
    | "NON_CODE_REMEDIATION_CONFIRMED"
    | "REPRODUCTION_CONFIRMED"
    | "REQUIRES_USER_ACTION"
    | "BLOCKED_BY_FORBIDDEN_DATA"
    | "BLOCKED_BY_UNAVAILABLE_SYSTEM"
    | "NO_SAFE_REPAIR_ESTABLISHED";

/* -------------------------------------------------------------------------- */
/* 6. Real Investigation Completed Step (Phase 20)                            */
/* -------------------------------------------------------------------------- */

export interface CompletedInvestigationStep {
    stepId: string;
    label: string;
    detail: string;
    timestamp: Date;
    status: "COMPLETED" | "ACTIVE" | "SKIPPED";
    evidenceId?: string;
}
