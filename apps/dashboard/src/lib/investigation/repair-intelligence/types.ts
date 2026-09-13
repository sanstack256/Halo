/**
 * Halo Repair Intelligence Engine — Type Definitions
 *
 * Core domain types for the evidence-driven Repair Case architecture.
 * Implements strict boundaries:
 *   - KNOWN / DERIVED / SUPPORTED / UNKNOWN fact separation
 *   - Explicit NOT_CAPTURED for missing runtime values (never guessed)
 *   - Cross-file broken contract boundary representation
 *   - Protection analysis outcomes & anti-masking validation
 *   - Deterministic 7-outcome repair classification
 *   - Multi-file structured changes with verified diffs
 *   - Real execution validation status
 */

import type {
    RepairCaseStatus,
    RepairOutcome,
    RepairConfidenceLevel,
    ValidationRunStatus,
} from "@/generated/prisma/enums";

export {
    RepairCaseStatus,
    RepairOutcome,
    RepairConfidenceLevel,
    ValidationRunStatus,
};

export type FactCategory = "KNOWN" | "DERIVED" | "SUPPORTED" | "UNKNOWN";

export interface FailureFact {
    id: string;
    category: FactCategory;
    claim: string;
    evidenceIds: string[];
    whyUnknownMatters?: string;
}

export type RuntimeValueStatus = "CAPTURED" | "NOT_CAPTURED";

export type FailureBoundary =
    | "LOCAL_FUNCTION"
    | "UPSTREAM_CALLER"
    | "DOWNSTREAM_DEPENDENCY"
    | "THIRD_PARTY"
    | "UNKNOWN";

export interface ExecutionPathStep {
    step: number;
    symbol: string;
    file?: string;
    line?: number;
    isAnchor?: boolean;
}

export interface FailureModel {
    errorTitle: string;
    errorMessage: string;
    service: string;
    occurrenceTimestamp?: Date | string;
    failingFile?: string;
    failingLineNumber?: number;
    containingFunction?: string;
    failingExpression?: string;
    failingStatement?: string;
    runtimeValueStatus: RuntimeValueStatus;
    runtimeValue?: string;
    executionPath: ExecutionPathStep[];
    failureBoundary: FailureBoundary;
    knownFacts: FailureFact[];
    derivedFacts: FailureFact[];
    supportedFacts: FailureFact[];
    unknowns: FailureFact[];
}

export type ProtectionStatus =
    | "PROTECTION_PRESENT_AND_RELEVANT"
    | "PROTECTION_PRESENT_BUT_INSUFFICIENT"
    | "PROTECTION_BYPASSED"
    | "PROTECTION_EXECUTION_UNKNOWN"
    | "NO_PROTECTION_FOUND";

export type GuardType =
    | "NULL_UNDEFINED_CHECK"
    | "OPTIONAL_CHAINING"
    | "TYPE_CHECK"
    | "TRY_CATCH"
    | "ASSERTION"
    | "EARLY_RETURN"
    | "FALLBACK";

export interface ExistingGuard {
    guardType: GuardType;
    line: number;
    text: string;
    protectsSymbol: string;
    protectsTargetExpression: boolean;
}

export interface ProtectionAnalysisResult {
    status: ProtectionStatus;
    guards: ExistingGuard[];
    targetExpression: string;
    summary: string;
    detailedReasoning: string;
    executionStatus:
        | "CONFIRMED_EXECUTED"
        | "CONFIRMED_BYPASSED"
        | "EXECUTION_UNPROVEN";
    isSymptomSuppressionOnly?: boolean;
}

export interface RepositoryPattern {
    errorHandlingPattern: string;
    stylePattern: string;
    observedSymbols: string[];
    relevantImports: string[];
}

export type RepairEligibilityState =
    | "REPAIR_READY"
    | "REPAIR_PLAUSIBLE"
    | "REPAIR_UNDERDETERMINED"
    | "REPAIR_BLOCKED"
    | "REPAIR_REFUTED";

export interface RepairPrerequisites {
    failureVerified: boolean;
    mechanismValidated: boolean;
    exactSourceResolved: boolean;
    runtimeEvidenceSufficient: boolean;
    noContradictions: boolean;
    singleDecisiveRepair: boolean;
}

export interface RepairEligibilityResult {
    state: RepairEligibilityState;
    evidenceConfidence: number; // 0 to 1
    repairConfidence: number; // 0 to 1
    reason: string;
    blockers: string[];
    prerequisitesMet: RepairPrerequisites;
}

/* -------------------------------------------------------------------------- */
/* Contract Mismatch Intelligence                                              */
/* -------------------------------------------------------------------------- */

export type ContractMismatchKind =
    | "FUNCTION_SIGNATURE_MISMATCH"
    | "TYPE_SCHEMA_MISMATCH"
    | "PRODUCER_CONSUMER_MISMATCH"
    | "API_REQUEST_MISMATCH"
    | "IMPORT_EXPORT_MISMATCH"
    | "CONFIG_MISMATCH"
    | "FEATURE_FLAG_MISMATCH"
    | "VERSION_MISMATCH"
    | "STATE_MISMATCH"
    | "SERIALIZATION_MISMATCH"
    | "NAMING_MISMATCH"
    | "ERROR_HANDLING_MISMATCH"
    | "ASYNC_CONTRACT_MISMATCH"
    | "ENVIRONMENT_MISMATCH"
    | "UNKNOWN_MISMATCH";

export interface BrokenContractBoundary {
    callerFile: string;
    callerSymbol?: string;
    callerLine?: number;
    callerSnippet?: string;
    calleeFile: string;
    calleeSymbol?: string;
    calleeLine?: number;
    calleeSnippet?: string;
    expectedContract: string;
    receivedValue: string;
    contractMismatchKind: ContractMismatchKind;
    discrepancyExplanation: string;
    upstreamOriginConfirmed: boolean;
    upstreamOriginDetails?: string;
}

/* -------------------------------------------------------------------------- */
/* Structured Changes & Patches                                                */
/* -------------------------------------------------------------------------- */

export interface SourceRange {
    startLine: number;
    endLine: number;
    startColumn?: number;
    endColumn?: number;
}

export interface StructuredRepairChange {
    id: string;
    filePath: string;
    symbol?: string;
    sourceRange?: SourceRange;
    reason: string;
    whyThisFile: string;
    beforeSnippet: string;
    afterSnippet: string;
    unifiedDiff: string;
    confidence: RepairConfidenceLevel;
    evidenceIds: string[];
    order: number;
    applied?: boolean;
    appliedAt?: Date | string;
}

export interface ProposedPatchValidationChecks {
    targetVerified: boolean;
    historicalCommitVerified: boolean;
    contextMatched: boolean;
    syntaxValid: boolean;
    minimalChanges: boolean;
    noInventedSymbols: boolean;
}

export interface ProposedPatch {
    targetFile: string;
    originalSourceSnippet: string;
    proposedSourceSnippet: string;
    unifiedDiff: string;
    validationStatus: "VALID" | "REJECTED" | "UNVALIDATED";
    validationChecks: ProposedPatchValidationChecks;
    validationErrors: string[];
    isApplied: boolean;
}

/* -------------------------------------------------------------------------- */
/* Validation Blueprint & Execution                                            */
/* -------------------------------------------------------------------------- */

export interface ExecutionValidationResult {
    id: string;
    status: ValidationRunStatus;
    typecheckPassed?: boolean;
    typecheckOutput?: string;
    testsPassed?: boolean;
    testOutput?: string;
    buildPassed?: boolean;
    buildOutput?: string;
    reproductionPassed?: boolean;
    reproductionOutput?: string;
    telemetryVerified?: boolean;
    telemetryOutput?: string;
    patchAppliesCleanly?: boolean;
    errors: string[];
    durationMs?: number;
    executedAt?: Date | string;
}

export interface NewTestRecommendation {
    testName: string;
    testCode: string;
    testFile?: string;
    assertion?: string;
}

export interface ValidationBlueprint {
    reproductionCondition: string;
    failureAssertion: string;
    preservationAssertions: string[];
    edgeCases: string[];
    relevantExistingTests: string[];
    newTestRecommendation?: NewTestRecommendation;
}

export interface RuntimeUsageItem {
    endpoint: string;
    percentage: number;
    sampleCount: number;
}

export interface BlastRadius {
    staticCallers: string[];
    runtimeUsage: RuntimeUsageItem[];
    behavioralImpact: string[];
}

export interface SideEffectAnalysis {
    behavioralSideEffects: string[];
    performanceSideEffects: string[];
    contractBreaks: string[];
}

export interface EvidenceToDecisionAnalysis {
    criticalUnknowns: string[];
    evidenceNeededToUnlock: string[];
    whatWouldRefuteRepair: string[];
}

export interface RepairOption {
    id: string;
    title: string;
    approach: string;
    pros: string[];
    tradeoffs: string[];
    evidenceReferences: string[];
    isRecommended: boolean;
    selectionRationale?: string;
    patch?: ProposedPatch;
    changes?: StructuredRepairChange[];
    validationAssertion?: string;
    regressionTestSnippet?: string;
    brokenBoundary?: BrokenContractBoundary;
}

/* -------------------------------------------------------------------------- */
/* Canonical Repair Case Domain Model                                          */
/* -------------------------------------------------------------------------- */

export interface CanonicalRepairCase {
    id: string;
    projectId: string;
    issueId: string;
    investigationId?: string;
    status: RepairCaseStatus;
    outcome: RepairOutcome;
    evidenceSnapshotId: string;
    snapshotId?: string;
    repositorySnapshotId?: string;
    version: number;

    title: string;
    whatBroke: string;
    whyItBroke: string;
    failureMechanism: string;
    upstreamReasonStatus: "CONFIRMED" | "UNRESOLVED" | "NOT_CAPTURED";
    upstreamReason?: string;

    brokenBoundary?: BrokenContractBoundary;
    confidenceLevel: RepairConfidenceLevel;
    confidenceReason: string;
    remainingUncertainty?: string;

    changes: StructuredRepairChange[];
    validation: ExecutionValidationResult;
    validationBlueprint: ValidationBlueprint;

    // Detailed analytical metadata
    failureModel: FailureModel;
    protectionAnalysis: ProtectionAnalysisResult;
    repositoryPatterns: RepositoryPattern;
    repairEligibility: RepairEligibilityResult;
    repairOptions: RepairOption[];
    selectedOptionId?: string;
    proposedPatch?: ProposedPatch;
    blastRadius: BlastRadius;
    sideEffects: SideEffectAnalysis;
    evidenceGaps: EvidenceToDecisionAnalysis;

    auditEvents: Array<{
        eventType: string;
        message: string;
        createdAt: Date | string;
        payload?: Record<string, unknown>;
    }>;

    createdAt: Date | string;
    updatedAt: Date | string;
}

export interface LegacyRepairCase {
    id: string;
    snapshotId: string;
    createdAt: Date | string;
    failureModel: FailureModel;
    protectionAnalysis: ProtectionAnalysisResult;
    repositoryPatterns: RepositoryPattern;
    repairEligibility: RepairEligibilityResult;
    repairOptions: RepairOption[];
    selectedOptionId?: string;
    proposedPatch?: ProposedPatch;
    blastRadius: BlastRadius;
    sideEffects: SideEffectAnalysis;
    evidenceGaps: EvidenceToDecisionAnalysis;
    validationBlueprint: ValidationBlueprint;
}

// Retain RepairCase alias for backwards compatibility
export type RepairCase = CanonicalRepairCase;
