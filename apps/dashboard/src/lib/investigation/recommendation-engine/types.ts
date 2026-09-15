/**
 * Halo Trace — Senior Engineering Recommendation Engine Types
 *
 * Implements the Epistemic model, 3 Separated Questions (Location, Mechanism, Upstream Cause),
 * 7 Evidence Sufficiency States, Evidence Provenance, Execution Path Reconstruction,
 * Repair Location Determination, Candidate Actions, and Deterministic Fact-Checking Schemas.
 */

import { z } from "zod";
import type { Evidence, Hypothesis, Finding, CausalChain, Investigation } from "@halo/investigation-engine";
import type { SourceContext, StackFrame } from "../runtime/types";

/* -------------------------------------------------------------------------- */
/* 1. Epistemic Model & Provenance                                            */
/* -------------------------------------------------------------------------- */

export type EpistemicProvenance =
    | "OBSERVED_RUNTIME"          // Directly captured in verified runtime telemetry/stack
    | "STATICALLY_ESTABLISHED"     // Verified via repository source / AST analysis
    | "INFERRED_SOURCE_STRUCTURE"  // Deduced from code structure (not observed at runtime)
    | "UNRESOLVED";                // Unknown or missing

export type EpistemicCategory =
    | "FACT"
    | "SUPPORTED_INFERENCE"
    | "RECOMMENDATION"
    | "UNKNOWN"
    | "OBSERVED"
    | "DERIVED"
    | "UNRESOLVED";

export interface EvidenceFact {
    id: string;
    type:
        | "EXCEPTION"
        | "STACK_FRAME"
        | "SPAN"
        | "REQUEST"
        | "BREADCRUMB"
        | "SOURCE_LINE"
        | "AST_NODE"
        | "COMMIT"
        | "RELEASE"
        | "REPLAY_EVENT"
        | "METRIC"
        | "LOG";
    value: string;
    source:
        | "telemetry"
        | "stack_trace"
        | "source_repository"
        | "git_history"
        | "session_replay"
        | "static_ast";
    sourceRef?: string;
    confidenceLevel: "OBSERVED" | "STATICALLY_VERIFIED" | "INFERRED" | "UNPROVEN";
    temporalContext?: {
        timestamp?: Date;
        relativeToIncident?: string;
    };
    provenance: string;
}

/* -------------------------------------------------------------------------- */
/* 2. Three Separated Epistemic Questions                                      */
/* -------------------------------------------------------------------------- */

export type FailureLocationStatus = "CONFIRMED" | "UNRESOLVED";
export type FailureMechanismStatus = "CONFIRMED" | "PLAUSIBLE" | "UNKNOWN";
export type UpstreamCauseStatus = "CONFIRMED" | "REGRESSION_SUSPECTED" | "UNKNOWN";

export interface CausalEpistemicState {
    /** (A) WHERE did it fail? */
    failureLocation: {
        status: FailureLocationStatus;
        filePath?: string;
        lineNumber?: number;
        symbol?: string;
        expression?: string;
        provenance: string;
    };
    /** (B) WHAT failure mechanism produced the exception? */
    failureMechanism: {
        status: FailureMechanismStatus;
        description: string;
        isRuntimeConfirmed: boolean;
        provenance: string;
    };
    /** (C) WHY did that failure mechanism occur? */
    upstreamCause: {
        status: UpstreamCauseStatus;
        description: string;
        isRuntimeConfirmed: boolean;
        provenance: string;
    };
}

/* -------------------------------------------------------------------------- */
/* 3. Execution Path Reconstruction                                           */
/* -------------------------------------------------------------------------- */

export type ExecutionEdgeClassification =
    | "RUNTIME_OBSERVED"
    | "STATICALLY_ESTABLISHED"
    | "INFERRED_FROM_SOURCE"
    | "UNRESOLVED";

export interface ExecutionPathStep {
    stepIndex: number;
    callerSymbol?: string;
    calleeSymbol?: string;
    expression?: string;
    filePath?: string;
    lineNumber?: number;
    classification: ExecutionEdgeClassification;
    provenance: string;
    isFailingSite: boolean;
}

export interface ExecutionPathReconstruction {
    steps: ExecutionPathStep[];
    isContinuous: boolean;
    missingEdges: string[];
    deepestApplicationFrame?: StackFrame;
}

/* -------------------------------------------------------------------------- */
/* 4. Release & Regression Analysis                                           */
/* -------------------------------------------------------------------------- */

export type RegressionCandidateClassification =
    | "UNRELATED"
    | "TEMPORALLY_ASSOCIATED"
    | "PATH_ASSOCIATED"
    | "BEHAVIOR_ASSOCIATED"
    | "STRONGLY_SUPPORTED_REGRESSION"
    | "CONFIRMED_REGRESSION";

export interface EvaluatedRegressionCandidate {
    commitSha: string;
    shortSha: string;
    message: string;
    author: string;
    commitDate: Date;
    deploymentDate?: Date;
    classification: RegressionCandidateClassification;
    classificationReason: string;
    modifiesFailingFile: boolean;
    modifiesFailingSymbol: boolean;
    diffSnippet?: string;
    changedFiles: string[];
}

export interface ReleaseRegressionContext {
    deployedRelease?: string;
    deployedCommitSha?: string;
    previousKnownGoodRelease?: string;
    previousKnownGoodCommitSha?: string;
    candidates: EvaluatedRegressionCandidate[];
    stronglySupportedCandidate?: EvaluatedRegressionCandidate;
}

/* -------------------------------------------------------------------------- */
/* 5. Source Analysis & AST                                                   */
/* -------------------------------------------------------------------------- */

export interface SourceAstAnalysis {
    hasExactSource: boolean;
    filePath?: string;
    failingLine?: number;
    containingFunction?: string;
    functionParameters?: string[];
    optionalParameters?: string[];
    failingExpression?: string;
    surroundingLines: Array<{ lineNumber: number; content: string; isFailingLine: boolean }>;
    guards: Array<{
        type: "null_check" | "truthy_check" | "typeof" | "optional_chaining" | "assertion";
        line: number;
        expression: string;
        isPriorToFailure: boolean;
    }>;
    hasOptionalChaining: boolean;
    hasFallbackCoalescing: boolean;
    hasCatchBlock: boolean;
    errorPropagation: {
        originatesHere: boolean;
        isTransformed: boolean;
        isRethrown: boolean;
    };
    invocationAnalysis?: InvocationAnalysis;
    sourceDistMapping?: {
        isGeneratedOrDist: boolean;
        sourceFileCounterpart?: string;
        sourceMapAvailable: boolean;
    };
    testsContractEvidence?: {
        hasRelevantTests: boolean;
        testFiles: string[];
        reproductionPossibleInDev: boolean;
    };
}

export type CalleeOpacity =
    | "CALLEE_OPAQUE_UNRESOLVABLE"
    | "CALLEE_IMPLEMENTATION_IDENTIFIED_ARGUMENTS_UNKNOWN"
    | "CALLEE_IMPLEMENTATION_AND_FAILURE_SURFACE_NARROWED"
    | "NOT_AN_INVOCATION";

export type CalleeReachability = "DIRECTLY_REACHABLE" | "POSSIBLY_REACHABLE" | "UNRELATED" | "UNKNOWN";

export interface ReachableCalleeImplementation {
    name: string;
    filePath?: string;
    lineNumber?: number;
    reachability: CalleeReachability;
    canProduceObservedError: boolean;
    errorConstructionSnippet?: string;
}

export interface InvocationAnalysis {
    isInvocation: boolean;
    calleeExpression?: string;
    arguments: string[];
    calleeOpacity: CalleeOpacity;
    reachableImplementations: ReachableCalleeImplementation[];
    calleeErrorOrigin?: "CONSTRUCTED_IN_CALLEE" | "PROPAGATED_FROM_EXTERNAL" | "UNKNOWN";
    contextFields?: Array<{
        name: string;
        constraint: "OBSERVED" | "STATISTICALLY_CONSTRAINED" | "STATICALLY_UNKNOWN" | "RUNTIME_UNKNOWN";
        source?: string;
    }>;
}

export interface InformationFrontier {
    knownFacts: string[];
    unknownFacts: string[];
    staticallyResolvable: string[];
    runtimeOnly: string[];
}

export interface HighestInformationNextActionExplanation {
    whatWeKnow: string;
    whatWeDontKnow: string;
    whyThatMatters: string;
    whatWasAlreadyInvestigated: string;
    whatShouldHappenNext: string;
    whyThatActionHasHighestValue: string;
}

/* -------------------------------------------------------------------------- */
/* 6. Contract & Value Flow Analysis                                          */
/* -------------------------------------------------------------------------- */

export interface ValueFlowStep {
    role: "PRODUCER" | "TRANSFORMATION" | "ARGUMENT" | "CALLEE_PARAMETER" | "OPERATION" | "FAILURE";
    symbol?: string;
    expression?: string;
    file?: string;
    line?: number;
    epistemicStatus: EpistemicProvenance;
}

export interface ContractAnalysisResult {
    hasStaticContractDifference: boolean;
    hasRuntimeContractViolation: boolean;
    description?: string;
    callerContract?: string;
    calleeContract?: string;
    valueFlow: ValueFlowStep[];
}

/* -------------------------------------------------------------------------- */
/* 7. Repair Location Determination                                           */
/* -------------------------------------------------------------------------- */

export type RepairLocationType =
    | "CALLER"
    | "CALLEE"
    | "PRODUCER"
    | "CONSUMER"
    | "ADAPTER"
    | "VALIDATION_BOUNDARY"
    | "CONFIGURATION"
    | "DEPLOYMENT"
    | "DATA_PIPELINE"
    | "EXTERNAL_INTEGRATION"
    | "DEPENDENCY"
    | "TEST"
    | "NO_CODE_CHANGE";

export interface DeterminedRepairLocation {
    type: RepairLocationType;
    targetFile?: string;
    targetSymbol?: string;
    lineRange?: { start: number; end: number };
    rationale: string;
    whyNotFailingLine: string;
    isAmbiguous?: boolean;
    ownershipEstablished?: boolean;
    contractEvidence?: string;
    candidateLocations?: Array<{
        type: RepairLocationType;
        targetFile?: string;
        targetSymbol?: string;
        rationale: string;
    }>;
}

/* -------------------------------------------------------------------------- */
/* 8. Candidate Actions & Scoring                                             */
/* -------------------------------------------------------------------------- */

export type ActionCategory =
    | "MAKE_CODE_CHANGE"
    | "MULTI_FILE_CODE_CHANGE"
    | "APPLICATION_RESILIENCE_CHANGE"
    | "INSPECT_SOURCE_BEFORE_CHANGING"
    | "REVERT_OR_INVESTIGATE_REGRESSION"
    | "FIX_CONFIGURATION_OR_DEPLOYMENT"
    | "DO_NOT_MODIFY_CODE_YET"
    | "COLLECT_MISSING_RUNTIME_SIGNAL"
    | "REPRODUCE_EXECUTION_PATH"
    | "INVESTIGATE_EXTERNAL_DEPENDENCY"
    | "NO_CODE_CHANGE_JUSTIFIED";

export interface CandidateAction {
    id: string;
    category: ActionCategory;
    title: string;
    description: string;
    repairLocation: DeterminedRepairLocation;
    evidenceSupport: string[];
    justification: string;
    regressionRisk: "LOW" | "MEDIUM" | "HIGH";
    blastRadius: "LOCAL_ONLY" | "CALLERS_AFFECTED" | "BROAD";
    reversibility: "IMMEDIATE" | "NEEDS_MIGRATION" | "HIGH_EFFORT";
    informationGain: "NONE" | "HIGH" | "CRITICAL";
    uncertainty: string[];
    validationPlan: string[];
    score: number; // Internal ranking score
}

/* -------------------------------------------------------------------------- */
/* 9. Evidence Sufficiency States                                             */
/* -------------------------------------------------------------------------- */

export const EvidenceSufficiencyStateSchema = z.enum([
    "SUFFICIENT_FOR_REPAIR",
    "SUFFICIENT_FOR_DIAGNOSIS_BUT_NOT_REPAIR",
    "PARTIALLY_SUFFICIENT",
    "INSUFFICIENT",
    "BLOCKED_BY_MISSING_SOURCE",
    "BLOCKED_BY_MISSING_RUNTIME_EVIDENCE",
    "BLOCKED_BY_AMBIGUITY",
]);
export type EvidenceSufficiencyState = z.infer<typeof EvidenceSufficiencyStateSchema>;

export interface EvidenceSufficiencyEvaluation {
    state: EvidenceSufficiencyState;
    unresolvedDecision: string;
    establishedFacts: string[];
    inferredFacts: string[];
    contradictingFacts: string[];
    canSourceOrReleaseResolve: boolean;
    isAdditionalRuntimeTelemetryNecessary: boolean;
    minimumAdditionalEvidenceNeeded: string[];
    blockingReason?: string;
    informationFrontier?: InformationFrontier;
    actionExplanation?: HighestInformationNextActionExplanation;
}

/* -------------------------------------------------------------------------- */
/* 10. Investigation Snapshot (Immutable)                                     */
/* -------------------------------------------------------------------------- */

export interface InvestigationSnapshot {
    snapshotId: string;
    createdAt: Date;
    incident: {
        issueId: string;
        title: string;
        fingerprint?: string;
        firstSeen: Date;
        lastSeen: Date;
        eventCount: number;
        environment: string;
        service: string;
        release?: string;
    };
    failure: {
        exceptionType: string;
        exceptionMessage: string;
        stack: string;
        frames: readonly StackFrame[];
        primaryFrame?: StackFrame;
        sourceLocation?: { file: string; line?: number };
        executingFunction?: string;
    };
    runtimeContext: {
        anchorErrorId?: string;
        requestId?: string;
        traceId?: string;
        httpMethod?: string;
        route?: string;
        status?: string;
        breadcrumbs: readonly any[];
        precedingEvents: readonly any[];
        runtimeOrigin: "node" | "browser" | "unknown";
    };
    replay?: {
        isAvailable: boolean;
        sessionId?: string;
        eventsSummary: readonly string[];
    };
    investigation: {
        hypotheses: readonly Hypothesis[];
        findings: readonly Finding[];
        causalChains: readonly CausalChain[];
        rootCause: Hypothesis | null;
        rawEvidence: readonly Evidence[];
        evidenceMap: Record<string, Evidence>;
    };
    source?: SourceContext;
    release: ReleaseRegressionContext;
    tests?: {
        hasRelevantTests: boolean;
        testFiles: string[];
        reproductionPossibleInDev: boolean;
    };
    sourceDistMapping?: {
        isGeneratedOrDist: boolean;
        sourceFileCounterpart?: string;
        sourceMapAvailable: boolean;
    };
}

/* -------------------------------------------------------------------------- */
/* 11. Code Change & Structured Recommendation Schemas                        */
/* -------------------------------------------------------------------------- */

export const QualitativeConfidenceSchema = z.enum(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]);
export type QualitativeConfidence = z.infer<typeof QualitativeConfidenceSchema>;

export const RecommendedChangeSchema = z.object({
    file: z.string().optional(),
    filePath: z.string().optional(),
    symbol: z.string().optional(),
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
    codeType: z.enum(["EXISTING_AND_PROPOSED", "PROPOSED_ONLY", "CONCEPTUAL"]).default("PROPOSED_ONLY"),
    explanation: z.string().min(1),
    whyHere: z.string().min(1),
    whyThisLocation: z.string().optional(),
    currentCode: z.string().optional(),
    proposedCode: z.string().optional(),
    unifiedDiff: z.string().optional(),
    evidenceIds: z.array(z.string()).default([]),
    isExactSourceVerified: z.boolean().default(false),
});
export type RecommendedChange = z.infer<typeof RecommendedChangeSchema>;

export const CompetingAlternativeSchema = z.object({
    description: z.string().min(1),
    whyNotPreferred: z.string().min(1),
});
export type CompetingAlternative = z.infer<typeof CompetingAlternativeSchema>;

export const FixRecommendationSchema = z.object({
    actionAnswer: z.string().optional(),
    directAnswer: z.string().optional(),
    status: EvidenceSufficiencyStateSchema.optional(),
    outcomeType: z.string().default("CODE_CHANGE"),
    summary: z.string().min(1),
    diagnosis: z.string().min(1),
    whyThisAction: z.string().optional(),
    whyThisFixesIt: z.string().optional(),
    whyNotSymptomFix: z.string().optional(),
    repairLocation: z.object({
        type: z.string(),
        targetFile: z.string().optional(),
        targetSymbol: z.string().optional(),
        rationale: z.string(),
    }).optional(),
    changes: z.array(RecommendedChangeSchema).default([]),
    alternatives: z.array(CompetingAlternativeSchema).default([]),
    doNotChange: z.array(z.string()).default([]),
    verification: z.array(z.string()).default([]),
    validationSteps: z.array(z.string()).default([]),
    missingEvidence: z.array(z.string()).default([]),
    nextActionBeforeRepair: z.string().optional(),
    uncertainty: z.array(z.string()).default([]),
    confidence: QualitativeConfidenceSchema.default("MEDIUM"),
    evidenceReferences: z.array(z.string()).default([]),
    relatedConsistencyChecks: z.array(z.string()).default([]).optional(),
    followUpSuggestions: z.array(z.string()).default([]).optional(),
    hasInsufficientEvidence: z.boolean().default(false),
    refusalReason: z.string().optional(),
    isStale: z.boolean().default(false),
    blockedBy: z.string().optional(),
    informationFrontier: z.object({
        knownFacts: z.array(z.string()).default([]),
        unknownFacts: z.array(z.string()).default([]),
        staticallyResolvable: z.array(z.string()).default([]),
        runtimeOnly: z.array(z.string()).default([]),
    }).optional(),
    actionExplanation: z.object({
        whatWeKnow: z.string(),
        whatWeDontKnow: z.string(),
        whyThatMatters: z.string(),
        whatWasAlreadyInvestigated: z.string(),
        whatShouldHappenNext: z.string(),
        whyThatActionHasHighestValue: z.string(),
    }).optional(),
    completedSteps: z.array(z.object({
        stepId: z.string(),
        label: z.string(),
        detail: z.string(),
        status: z.string(),
    })).optional().default([]),
    isCodeModification: z.boolean().optional().default(true),
    nonCodeRemediationDetails: z.object({
        type: z.string(),
        remediationInstruction: z.string(),
        operationalAction: z.string(),
    }).optional(),
    activeInvestigationDetails: z.object({
        requiredFacts: z.array(z.string()).default([]),
        attemptedAcquisitions: z.array(z.string()).default([]),
        remainingBlocker: z.string().optional(),
    }).optional(),
});
export type FixRecommendation = z.infer<typeof FixRecommendationSchema>;

/* -------------------------------------------------------------------------- */
/* 12. Structured LLM Generation Contract                                     */
/* -------------------------------------------------------------------------- */

export const StructuredLlmOutputSchema = z.object({
    action: z.string().min(1),
    summary: z.string().min(1),
    why: z.string().min(1),
    repairLocationRationale: z.string().min(1),
    whyNotSymptomFix: z.string().optional(),
    claims: z.array(
        z.object({
            claim: z.string().min(1),
            factId: z.string().optional(),
            category: z.enum(["CONFIRMED", "SUPPORTED", "POSSIBLE", "UNKNOWN"]),
        })
    ).min(1),
    changes: z.array(
        z.object({
            file: z.string(),
            symbol: z.string().optional(),
            lines: z.string().optional(),
            existingCode: z.string().optional(),
            proposedCode: z.string().optional(),
            rationale: z.string().min(1),
        })
    ).default([]),
    alternatives: z.array(
        z.object({
            description: z.string(),
            whyNotPreferred: z.string(),
        })
    ).default([]),
    validationPlan: z.array(z.string()).default([]),
    uncertainty: z.array(z.string()).default([]),
    status: z.string().optional(),
    outcomeType: z.string().optional(),
    confidenceLevel: QualitativeConfidenceSchema.default("MEDIUM"),
    blockedBy: z.string().optional(),
});
export type StructuredLlmOutput = z.infer<typeof StructuredLlmOutputSchema>;

/* Legacy & Compatibility Schemas */
export const DecisionStateSchema = z.enum([
    "CODE_CHANGE",
    "MULTI_FILE_CODE_CHANGE",
    "CONFIGURATION_CHANGE",
    "TEST_CHANGE",
    "DEPLOYMENT_ACTION",
    "DEPENDENCY_ACTION",
    "EXTERNAL_INTEGRATION_ACTION",
    "EXTERNAL_DEPENDENCY_ACTION",
    "NO_CODE_CHANGE_REQUIRED",
    "ALREADY_FIXED",
    "INSUFFICIENT_EVIDENCE",
    "AMBIGUOUS",
    "OBSERVABILITY_REQUIRED_BEFORE_REPAIR",
    "CODE_CHANGE_RECOMMENDED",
    "MULTI_FILE_CHANGE_RECOMMENDED",
    "CONFIGURATION_CHANGE_RECOMMENDED",
    "TEST_CHANGE_RECOMMENDED",
    "AMBIGUOUS_ROOT_CAUSE",
    "OBSERVABILITY_STEP_REQUIRED_BEFORE_REPAIR",
]);
export type DecisionState = z.infer<typeof DecisionStateSchema>;

export const RecommendationStatusSchema = z.enum([
    "RECOMMENDATION",
    "INSUFFICIENT_EVIDENCE",
    "NO_SAFE_RECOMMENDATION",
]);
export type RecommendationStatus = z.infer<typeof RecommendationStatusSchema>;

export const PatchStatusSchema = z.enum([
    "AVAILABLE",
    "NOT_SAFE_TO_GENERATE",
    "SOURCE_UNAVAILABLE",
    "NOT_APPLICABLE",
]);
export type PatchStatus = z.infer<typeof PatchStatusSchema>;

export const ClaimCategorySchema = z.enum([
    "OBSERVED",
    "DERIVED",
    "SUPPORTED",
    "UNKNOWN",
]);
export type ClaimCategory = z.infer<typeof ClaimCategorySchema>;

export const ModelClaimSchema = z.object({
    statement: z.string().min(1),
    category: ClaimCategorySchema,
    evidenceIds: z.array(z.string()).default([]),
});

export const ModelActionSchema = z.object({
    action: z.string().min(1),
    reasoning: z.string().min(1),
    affectedLocation: z
        .object({
            file: z.string(),
            line: z.number().int().positive().optional(),
            symbol: z.string().optional(),
            function: z.string().optional(),
        })
        .optional(),
});

export const ModelPatchFileSchema = z.object({
    path: z.string().min(1),
    diff: z.string().min(1),
    explanation: z.string().min(1),
});

export const ModelProposedPatchSchema = z.object({
    status: PatchStatusSchema,
    files: z.array(ModelPatchFileSchema).default([]),
    refusalReason: z.string().optional(),
});
export type ModelProposedPatch = z.infer<typeof ModelProposedPatchSchema>;

export const StructuredModelRecommendationSchema = z.object({
    status: z.string(),
    whatHappened: z.string().optional(),
    claims: z.array(z.any()).default([]),
    recommendation: z.any().optional(),
    proposedPatch: ModelProposedPatchSchema.optional(),
    unknowns: z.array(z.string()).default([]),
    limitations: z.array(z.string()).default([]),
    confidenceLevel: z.string().default("Medium"),
    fixRecommendation: FixRecommendationSchema.optional(),
    action: z.string().optional(),
    summary: z.string().optional(),
    why: z.string().optional(),
    repairLocationRationale: z.string().optional(),
    changes: z.array(z.any()).optional(),
    alternatives: z.array(z.any()).optional(),
    validationPlan: z.array(z.string()).optional(),
    uncertainty: z.array(z.string()).optional(),
    blockedBy: z.string().optional(),
});
export type StructuredModelRecommendation = z.infer<
    typeof StructuredModelRecommendationSchema
>;

export interface RecommendationEligibilityVerdict {
    canGenerateRecommendation: boolean;
    recommendationReason: string;
    patchEligibility:
        | "CAN_GENERATE_PATCH"
        | "UNSAFE_MISSING_SOURCE"
        | "UNSAFE_MISSING_RUNTIME_VALUE"
        | "UNSAFE_AMBIGUOUS_CAUSE"
        | "NOT_APPLICABLE";
    patchReason: string;
}

export interface OutputValidationAudit {
    passed: boolean;
    schemaValid: boolean;
    evidenceCitationsValid: boolean;
    sourceLocationsValid: boolean;
    patchValid: boolean;
    factualConsistencyValid: boolean;
    rejectionReasons: string[];
    warnings: string[];
}

export interface ValidatedRecommendationResult {
    success: boolean;
    source: "LLM_VERIFIED" | "DETERMINISTIC_FALLBACK" | "REFUSAL_INSUFFICIENT_EVIDENCE";
    confidence: "Low" | "Medium" | "High" | "Very High";
    whatHappened: string;
    claims: Array<{
        statement: string;
        category: ClaimCategory;
        evidenceIds: string[];
        isDirectlyObserved: boolean;
    }>;
    action?: {
        instruction: string;
        reasoning: string;
        location?: {
            file: string;
            line?: number;
            symbol?: string;
            function?: string;
        };
    };
    patch?: {
        status: PatchStatus;
        files: Array<{
            path: string;
            diff: string;
            explanation: string;
        }>;
        validationNote: string;
        refusalReason?: string;
    };
    unknowns: string[];
    limitations: string[];
    audit: {
        snapshotId: string;
        gateVerdict: RecommendationEligibilityVerdict;
        validation: OutputValidationAudit;
        modelInfo: {
            provider: string;
            model: string;
            durationMs: number;
        };
    };
    fixRecommendation?: FixRecommendation;
}

/* -------------------------------------------------------------------------- */
/* 13. Fact-Checking Audit Results                                            */
/* -------------------------------------------------------------------------- */

export type ClaimVerificationStatus =
    | "CONFIRMED"
    | "SUPPORTED"
    | "POSSIBLE"
    | "UNKNOWN"
    | "CONTRADICTED";

export interface FactCheckAudit {
    passed: boolean;
    verifiedFiles: string[];
    rejectedFiles: string[];
    verifiedLines: number[];
    rejectedLines: number[];
    verifiedCommits: string[];
    rejectedCommits: string[];
    verifiedEvidenceRefs: string[];
    rejectedEvidenceRefs: string[];
    symptomMaskingDetected: boolean;
    symptomMaskingDetails?: string;
    strippedCodeBlocksCount: number;
    rejectionReasons: string[];
    warnings: string[];
}

export interface ValidatedPipelineResult {
    success: boolean;
    source: "LLM_SYNTHESIZED" | "DETERMINISTIC_ENGINE";
    confidence: QualitativeConfidence;
    recommendation: FixRecommendation;
    causalEpistemicState?: CausalEpistemicState;
    repairLocation?: DeterminedRepairLocation;
    sufficiency?: EvidenceSufficiencyEvaluation;
    audit: FactCheckAudit;
    modelInfo: {
        provider: string;
        model: string;
        durationMs: number;
    };
}

/* -------------------------------------------------------------------------- */
/* 14. AI Provider Types & Config                                             */
/* -------------------------------------------------------------------------- */

export const AiProvider = {
    HALO_MANAGED: "HALO_MANAGED",
    GEMINI: "GEMINI",
    OPENAI: "OPENAI",
} as const;
export type AiProvider = (typeof AiProvider)[keyof typeof AiProvider];

export const AiConnectionStatus = {
    NOT_CONFIGURED: "NOT_CONFIGURED",
    CONNECTED: "CONNECTED",
    FAILED: "FAILED",
} as const;
export type AiConnectionStatus = (typeof AiConnectionStatus)[keyof typeof AiConnectionStatus];

export interface SafeAiConfig {
    provider: AiProvider;
    status: AiConnectionStatus;
    model: string | null;
    maskedKey?: string;
    hasKey: boolean;
    lastTestedAt?: Date | null;
}

export interface AiConnectionTestResult {
    success: boolean;
    provider: AiProvider;
    model?: string;
    errorMessage?: string;
}
