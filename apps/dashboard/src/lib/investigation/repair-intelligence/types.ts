/**
 * Halo Repair Intelligence Engine — Type Definitions
 *
 * Core domain types for the evidence-driven Repair Case architecture.
 * Implements strict boundaries:
 *   - KNOWN / DERIVED / SUPPORTED / UNKNOWN fact separation
 *   - Explicit NOT_CAPTURED for missing runtime values (never guessed)
 *   - Protection analysis outcomes
 *   - 5-state repair eligibility
 *   - Separate evidence confidence vs repair confidence
 *   - Validation blueprint
 */

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
    validationAssertion?: string;
    regressionTestSnippet?: string;
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
    isApplied: false; // Patches are proposals only, NEVER applied directly
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

export interface NewTestRecommendation {
    testName: string;
    testCode: string;
    testFile?: string;
}

export interface ValidationBlueprint {
    reproductionCondition: string;
    failureAssertion: string;
    preservationAssertions: string[];
    edgeCases: string[];
    relevantExistingTests: string[];
    newTestRecommendation?: NewTestRecommendation;
}

export interface RepairCase {
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
