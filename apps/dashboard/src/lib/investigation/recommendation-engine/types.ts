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

export type FormalEpistemicConcept =
    | "OBSERVED_FACT"
    | "DERIVED_FACT"
    | "HYPOTHESIS"
    | "SUPPORTED_HYPOTHESIS"
    | "CONFIRMED_MECHANISM"
    | "CONFIRMED_INVARIANT"
    | "CONFIRMED_CAUSAL_LINK"
    | "REPAIR_BOUNDARY_CANDIDATE"
    | "SUPPORTED_REPAIR_BOUNDARY"
    | "VERIFIED_REPAIR"
    | "UNRESOLVED"
    | "EVIDENCE_ACQUISITION_REQUIRED"
    | "BLOCKED_BY_UNAVAILABLE_EVIDENCE";

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
/* 2. Separated Epistemic Locations, Invariants & Causal Determination         */
/* -------------------------------------------------------------------------- */

export type FailureLocationStatus = "CONFIRMED" | "UNRESOLVED" | "OBSERVED" | "ESTABLISHED" | "CANDIDATE";
export type FailureMechanismStatus = "CONFIRMED" | "PLAUSIBLE" | "UNKNOWN";
export type UpstreamCauseStatus = "CONFIRMED" | "REGRESSION_SUSPECTED" | "UNKNOWN";

export interface CodeLocation {
    filePath?: string;
    lineNumber?: number;
    columnNumber?: number;
    symbol?: string;
    expression?: string;
    provenance: string;
    status: FailureLocationStatus;
}

export interface SeparatedLocations {
    /** WHERE the failure becomes observable (e.g. exception thrown / caught in stack frame) */
    observationLocation: CodeLocation;
    /** WHERE the invalid state or abnormal value originated */
    originLocation?: CodeLocation;
    /** WHERE the broken invariant is violated or abnormal state is produced */
    mechanismLocation: CodeLocation;
    /** WHERE the caller/callee contract was breached */
    contractViolationLocation?: CodeLocation;
    /** WHERE the defect can be corrected with the smallest safe architectural change */
    repairLocation: CodeLocation;
}

export type CanonicalEpistemicState =
    | "OBSERVED"
    | "DERIVED"
    | "HYPOTHESIS"
    | "SUPPORTED"
    | "CONFIRMED"
    | "REJECTED"
    | "UNKNOWN"
    | "BLOCKED";

export type CanonicalFindingType =
    | "ObservedFailure"
    | "ExecutionPath"
    | "ObservationLocation"
    | "OriginLocation"
    | "MechanismLocation"
    | "ContractViolationLocation"
    | "ValueOrigin"
    | "ResourceOrigin"
    | "BrokenInvariant"
    | "Contract"
    | "ContractOwner"
    | "CausalRelationship"
    | "RepairBoundary"
    | "CandidateRepair"
    | "ValidationResult"
    | "RegressionResult";

export interface CanonicalFinding<T = unknown> {
    id: string;
    type: CanonicalFindingType;
    status: CanonicalEpistemicState;
    title: string;
    description: string;
    evidenceRefs: string[];
    evidenceIds?: string[];
    derivedFrom?: string[];
    confidence: "CONFIRMED" | "SUPPORTED" | "PLAUSIBLE" | "UNKNOWN";
    payload?: T;
    createdAt: Date;
}

export type InvariantClassification =
    | "precondition"
    | "state_invariant"
    | "data_invariant"
    | "resource_invariant"
    | "api_contract"
    | "ordering_invariant"
    | "lifecycle_invariant"
    | "concurrency_invariant"
    | "configuration_invariant"
    | "deployment_invariant"
    | "external_service_assumption"
    | "custom_invariant";

export interface BrokenInvariant {
    id: string;
    classification: InvariantClassification;
    description: string;
    expectedCondition: string;
    actualViolation: string;
    governingEntity?: string;
    evidenceIds: string[];
    isConfirmed: boolean;
    formalStatement?: string;
    violatedState?: string;
    restoredState?: string;
}

export type DynamicDispatchState =
    | "UNIQUELY_RESOLVED"
    | "MULTIPLE_POSSIBLE_IMPLEMENTATIONS"
    | "UNRESOLVED_OPAQUE";

export interface DynamicDispatchResolution {
    callSiteExpression: string;
    interfaceOrBaseType?: string;
    state: DynamicDispatchState;
    possibleImplementations: Array<{
        name: string;
        filePath?: string;
        resolutionEvidence: string;
        isRuntimeConfirmed: boolean;
    }>;
    uncertaintyRationale?: string;
}

export interface CausalProofRecord {
    defectExists: boolean;
    defectExistsEvidence: string[];
    executionPathReachesDefect: boolean;
    executionPathEvidence: string[];
    stateOrValueOccurs: boolean;
    stateOrValueEvidence: string[];
    defectParticipated: boolean;
    defectParticipatedEvidence: string[];
    defectCausedFailure: boolean;
    defectCausedEvidence: string[];
    causalChain: string[];
}

export interface DefectMechanismCause {
    defect: {
        description: string;
        location?: CodeLocation;
        status: "CONFIRMED" | "SUSPECTED" | "UNKNOWN";
        provenance: string;
    };
    mechanism: {
        description: string;
        location?: CodeLocation;
        status: FailureMechanismStatus;
        provenance: string;
    };
    cause: {
        description: string;
        status: UpstreamCauseStatus;
        provenance: string;
    };
    proof: CausalProofRecord;
}

export interface CausalEpistemicState {
    /** (A) WHERE did it fail? Legacy single failure location */
    failureLocation: {
        status: FailureLocationStatus;
        filePath?: string;
        lineNumber?: number;
        symbol?: string;
        expression?: string;
        provenance: string;
    };
    /** Separated observation, mechanism, and repair locations (Rule 3) */
    locations?: SeparatedLocations;
    /** (B) WHAT failure mechanism produced the exception? */
    failureMechanism: {
        status: FailureMechanismStatus;
        description: string;
        isRuntimeConfirmed: boolean;
        provenance: string;
    };
    /** Reconstructed broken invariant (Rule 6) */
    brokenInvariant?: BrokenInvariant;
    /** (C) WHY did that failure mechanism occur? */
    upstreamCause: {
        status: UpstreamCauseStatus;
        description: string;
        isRuntimeConfirmed: boolean;
        provenance: string;
    };
    /** Defect vs Mechanism vs Cause with explicit causal proof (Rules 7 & 8) */
    defectMechanismCause?: DefectMechanismCause;
    /** Dynamic dispatch resolution states (Rule 5) */
    dynamicDispatch?: DynamicDispatchResolution[];
    causalRelationships?: Array<{ from?: string; to?: string; confidence: string }>;
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

export type TemporalAssociation =
    | "PRE_INCIDENT_IMMEDIATE"
    | "PRE_INCIDENT_WINDOW"
    | "POST_INCIDENT"
    | "UNKNOWN";

export type SourceAssociation =
    | "FAILING_FILE"
    | "CALLER"
    | "CALLEE"
    | "PRODUCER"
    | "CONSUMER"
    | "ADAPTER"
    | "CONFIGURATION"
    | "DEPENDENCY"
    | "BUILD_ARTIFACT"
    | "UNRELATED";

export type ExecutionRelevance =
    | "ACTIVE_EXECUTION_PATH_PROVEN"
    | "CALL_GRAPH_REACHABLE"
    | "DEFINITIVE_ON_PATH"
    | "STATICALLY_DISCONNECTED"
    | "RUNTIME_CONTRADICTED"
    | "UNKNOWN";

export type BehavioralRelevance =
    | "CONTROL_FLOW_ALTERED"
    | "RETURN_VALUE_ALTERED"
    | "CONTRACT_ALTERED"
    | "RESOURCE_LIFECYCLE_ALTERED"
    | "ERROR_HANDLING_ALTERED"
    | "CONFIGURATION_ALTERED"
    | "ALTERS_OBSERVED_BEHAVIOR"
    | "NO_BEHAVIORAL_CHANGE"
    | "UNKNOWN";

export type MechanismRelevance =
    | "CAN_PRODUCE_MECHANISM"
    | "CANNOT_PRODUCE_MECHANISM"
    | "MECHANISM_UNKNOWN"
    | "CONTRADICTS_MECHANISM";

export type CausalSupport =
    | "CAUSALLY_PROVEN"
    | "PLAUSIBLE_CANDIDATE"
    | "UNPROVEN_ASSOCIATION"
    | "CONTRADICTED";

export interface RollbackAuditRecord {
    behaviorIntroducedProven: boolean;
    rollbackRemovesBehavior: boolean;
    previousRevisionHealthy: boolean;
    unrelatedChangesBlastRadius: "MINIMAL" | "MODERATE" | "HIGH" | "UNKNOWN";
    invariantRestored: boolean;
    reintroducesKnownDefect: boolean;
    migrationOrDataImplications: boolean;
    safeForDeploymentState: boolean;
    targetedRepairSmallerBlastRadius: boolean;
    behaviorallyValidated: boolean;
    auditPassed: boolean;
    refusalReason?: string;
}

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
    // Strict multi-dimensional regression semantics
    temporalAssociation?: TemporalAssociation;
    sourceAssociation?: SourceAssociation;
    executionRelevance?: ExecutionRelevance;
    behavioralRelevance?: BehavioralRelevance;
    mechanismRelevance?: MechanismRelevance;
    causalSupport?: CausalSupport;
    regressionConfidence?: QualitativeConfidence;
    repairConfidence?: QualitativeConfidence;
    semanticDiffSummary?: string;
    rollbackAudit?: RollbackAuditRecord;
}

export interface ReleaseRegressionContext {
    deployedRelease?: string;
    deployedCommitSha?: string;
    previousKnownGoodRelease?: string;
    previousKnownGoodCommitSha?: string;
    candidates: EvaluatedRegressionCandidate[];
    stronglySupportedCandidate?: EvaluatedRegressionCandidate;
    causallyProvenCandidate?: EvaluatedRegressionCandidate;
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
    | "STATE_TRANSITION"
    | "RESOURCE_OWNER"
    | "SHARED_ABSTRACTION"
    | "CONFIGURATION"
    | "DEPLOYMENT"
    | "DATA_PIPELINE"
    | "EXTERNAL_INTEGRATION"
    | "DEPENDENCY"
    | "TEST"
    | "CUSTOM_BOUNDARY"
    | "NO_CODE_CHANGE";

export type RemediationCategory =
    | "REPAIR"
    | "MITIGATION"
    | "WORKAROUND"
    | "OBSERVABILITY_IMPROVEMENT"
    | "CONFIGURATION_CHANGE"
    | "ROLLBACK"
    | "NO_CODE_CHANGE";

export interface DeterminedRepairLocation {
    type: RepairLocationType;
    remediationCategory?: RemediationCategory;
    targetFile?: string;
    targetSymbol?: string;
    targetLineNumber?: number;
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
        remediationCategory?: RemediationCategory;
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
    changes?: Array<{ file?: string; original?: string; replacement?: string; line?: number }>;
    confidence?: string;
}

/* -------------------------------------------------------------------------- */
/* 9. Evidence Sufficiency States                                             */
/* -------------------------------------------------------------------------- */

export const FormalRecommendationStateSchema = z.enum([
    "VERIFIED_REPAIR",
    "SUPPORTED_REPAIR_REQUIRES_VALIDATION",
    "DIAGNOSIS_COMPLETE_REPAIR_UNRESOLVED",
    "NO_CODE_CHANGE_JUSTIFIED",
    "EVIDENCE_ACQUISITION_REQUIRED",
    "BLOCKED_BY_UNAVAILABLE_EVIDENCE",
]);
export type FormalRecommendationState = z.infer<typeof FormalRecommendationStateSchema>;

export const EvidenceSufficiencyStateSchema = z.enum([
    // Six formal recommendation states
    "VERIFIED_REPAIR",
    "SUPPORTED_REPAIR_REQUIRES_VALIDATION",
    "DIAGNOSIS_COMPLETE_REPAIR_UNRESOLVED",
    "NO_CODE_CHANGE_JUSTIFIED",
    "EVIDENCE_ACQUISITION_REQUIRED",
    "BLOCKED_BY_UNAVAILABLE_EVIDENCE",
    // Backwards-compatible investigation states
    "SUFFICIENT_FOR_REPAIR",
    "SUFFICIENT_FOR_DIAGNOSIS_BUT_NOT_REPAIR",
    "PARTIALLY_SUFFICIENT",
    "INSUFFICIENT",
    "BLOCKED_BY_MISSING_SOURCE",
    "BLOCKED_BY_MISSING_RUNTIME_EVIDENCE",
    "BLOCKED_BY_AMBIGUITY",
]);
export type EvidenceSufficiencyState = z.infer<typeof EvidenceSufficiencyStateSchema>;

export const DecomposedConfidenceSchema = z.object({
    failureLocation: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]).default("UNKNOWN"),
    observationLocation: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]).default("UNKNOWN").optional(),
    mechanismLocation: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]).default("UNKNOWN").optional(),
    repairLocation: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]).default("UNKNOWN").optional(),
    failureMechanism: z.enum(["CONFIRMED", "PLAUSIBLE", "UNKNOWN"]).default("UNKNOWN"),
    brokenInvariant: z.enum(["CONFIRMED", "PLAUSIBLE", "UNKNOWN"]).default("UNKNOWN").optional(),
    causalCause: z.enum(["PROVEN", "SUPPORTED", "UNKNOWN", "CONTRADICTED"]).default("UNKNOWN"),
    regressionAssociation: z.enum(["HIGH", "MEDIUM", "LOW", "NONE"]).default("NONE"),
    repairOwnership: z.enum(["ESTABLISHED", "AMBIGUOUS", "UNKNOWN"]).default("UNKNOWN"),
    repairBoundary: z.enum(["VERIFIED", "CANDIDATE", "UNKNOWN"]).default("UNKNOWN"),
    repairCorrectness: z.enum(["PROVEN", "PLAUSIBLE", "UNVALIDATED"]).default("UNVALIDATED"),
    behavioralValidation: z.enum(["EXECUTED_PASSED", "REPRODUCED", "UNTESTED", "REGRESSION_DETECTED"]).default("UNTESTED"),
});
export type DecomposedConfidence = z.infer<typeof DecomposedConfidenceSchema>;

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
    behavioralValidationStatus?: "EXECUTED_PASSED" | "REPRODUCED" | "UNTESTED" | "REGRESSION_DETECTED";
    decisionGap?: any;
    acquisitionPlan?: any;
    diagnosisProof?: any;
    repairProof?: any;
    behavioralProof?: any;
    validationResult?: any;
    consequences?: any;
    sourceDistMapping?: {
        isGeneratedOrDist: boolean;
        sourceFileCounterpart?: string;
        sourceMapAvailable: boolean;
    };
    evidenceStore?: any;
}

/* -------------------------------------------------------------------------- */
/* 11. Structured Recommendation Schema                                       */
/* -------------------------------------------------------------------------- */

export const CodeTypeSchema = z.enum([
    "EXISTING_AND_PROPOSED",
    "PROPOSED_ONLY",
    "CONCEPTUAL_ONLY",
]);
export type CodeType = z.infer<typeof CodeTypeSchema>;

export const QualitativeConfidenceSchema = z.enum(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]);
export type QualitativeConfidence = z.infer<typeof QualitativeConfidenceSchema>;

export const RecommendedChangeSchema = z.object({
    file: z.string().optional(),
    filePath: z.string().optional(),
    symbol: z.string().optional(),
    lines: z.string().optional(),
    startLine: z.number().optional(),
    endLine: z.number().optional(),
    codeType: CodeTypeSchema.default("EXISTING_AND_PROPOSED"),
    explanation: z.string().default("Apply code repair to restore invariant"),
    whyHere: z.string().default("Target boundary where defect occurs"),
    rationale: z.string().optional(),
    currentCode: z.string().optional(),
    proposedCode: z.string().optional(),
    unifiedDiff: z.string().optional(),
    isExactSourceVerified: z.boolean().default(false),
    evidenceIds: z.array(z.string()).default([]),
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
    separatedLocations: z.object({
        observationLocation: z.object({
            filePath: z.string().optional(),
            lineNumber: z.number().optional(),
            symbol: z.string().optional(),
            provenance: z.string().optional(),
            status: z.string().optional(),
        }).optional(),
        mechanismLocation: z.object({
            filePath: z.string().optional(),
            lineNumber: z.number().optional(),
            symbol: z.string().optional(),
            provenance: z.string().optional(),
            status: z.string().optional(),
        }).optional(),
        repairLocation: z.object({
            filePath: z.string().optional(),
            lineNumber: z.number().optional(),
            symbol: z.string().optional(),
            provenance: z.string().optional(),
            status: z.string().optional(),
        }).optional(),
    }).optional(),
    brokenInvariant: z.object({
        classification: z.string(),
        description: z.string(),
        expectedCondition: z.string().default("Invariant satisfied on all valid execution paths"),
        actualViolation: z.string().default("Invariant violated at runtime execution"),
        governingEntity: z.string().optional(),
        evidenceIds: z.array(z.string()).default([]),
        formalStatement: z.string().optional(),
        violatedState: z.string().optional(),
        restoredState: z.string().optional(),
    }).optional(),
    behavioralProof: z.object({
        status: z.string().optional(),
        validationMethod: z.string().optional(),
        summary: z.string().optional(),
        isCleanPass: z.boolean().optional(),
        originalFailureResolved: z.boolean().optional(),
        intendedBehaviorRestored: z.boolean().optional(),
        violatedInvariantRestored: z.boolean().optional(),
        executionLog: z.string().optional(),
    }).optional(),
    changes: z.array(RecommendedChangeSchema).default([]),
    alternatives: z.array(CompetingAlternativeSchema).default([]),
    doNotChange: z.array(
        z.union([
            z.string(),
            z.object({
                target: z.string().optional(),
                reason: z.string().optional(),
            }).transform((o) => (o.reason ? `${o.target ? o.target + ": " : ""}${o.reason}` : o.target || "")),
        ])
    ).default([]),
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
    decomposedConfidence: DecomposedConfidenceSchema.optional(),
    rollbackAudit: z.any().optional(),
    repairEquivalence: z.any().optional(),
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
    authoritativeDecision?: AuthoritativeEngineeringDecision;
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

/* -------------------------------------------------------------------------- */
/* 15. Deep Autonomous Engineering Repair Epistemic Types (Phase 40)           */
/* -------------------------------------------------------------------------- */

export type EngineeringQuestion =
    | "WHAT_ACTUALLY_EXECUTED"
    | "WHAT_SOURCE_IMPLEMENTS_SYMBOL"
    | "WHAT_BEHAVIOR_IS_INTENDED"
    | "WHAT_CONFIG_WAS_ACTIVE"
    | "DID_CODE_CHANGE_CAUSE_INCIDENT"
    | "DID_REPAIR_WORK";

export type EvidenceAuthoritySourceType =
    | "RUNTIME_TRACE"
    | "VERIFIED_SOURCE"
    | "STATIC_AST"
    | "TESTS_AND_CONTRACTS"
    | "DEPLOYMENT_CONFIG"
    | "TEMPORAL_EVIDENCE"
    | "POST_PATCH_EXECUTION"
    | "CODE_CALLERS"
    | "HISTORICAL_COMMITS"
    | "RUNTIME_METRICS";

export interface DecisionAuthorityRule {
    question: EngineeringQuestion;
    primaryAuthorities: EvidenceAuthoritySourceType[];
    supportingAuthorities: EvidenceAuthoritySourceType[];
    deterministicResolutionStrategy: "AUTHORITY_DOMINANCE" | "CORROBORATION_REQUIRED" | "TEMPORAL_CAUSAL_VALIDATION" | "EMPIRICAL_EXECUTION_ONLY";
}

export interface EvidenceContradiction {
    id: string;
    question: EngineeringQuestion;
    conflictingEvidence: {
        source: string;
        claim: string;
        evidenceId: string;
    }[];
    isResolved: boolean;
    resolutionExplanation?: string;
    dominatingEvidenceId?: string;
}

// --- HYPOTHESIS AS CONDITION GRAPH ---
export type ConditionStatus = "CONFIRMED" | "SUPPORTED" | "UNKNOWN" | "CONTRADICTED";

export interface HypothesisCondition {
    id: string;
    description: string;
    requiredFact: string;
    attachedEvidenceIds: string[];
    contradictingEvidenceIds: string[];
    status: ConditionStatus;
    evaluationRationale: string;
}

export type CausalEstablishmentTier =
    | "DEFECT_EXISTS"
    | "DEFECT_CAN_PRODUCE_FAILURE"
    | "DEFECT_PARTICIPATED_IN_OCCURRENCE"
    | "DEFECT_CAUSED_OCCURRENCE";

export interface CausalHypothesis {
    id: string;
    mechanism: string;
    causalEstablishmentTier: CausalEstablishmentTier;
    conditions: HypothesisCondition[];
    supportingEvidenceIds: string[];
    contradictingEvidenceIds: string[];
    missingEvidenceDescriptions: string[];
    causalRelationships: {
        upstreamConditionId: string;
        downstreamEffect: string;
        causalLinkType: "NECESSARY" | "CONTRIBUTORY" | "SUFFICIENT";
    }[];
    affectedExecutionPath: string[];
    affectedResourceOrValue?: string;
    repairImplications: string;
    status: "CONFIRMED" | "STRONGLY_SUPPORTED" | "PLAUSIBLE" | "CONTRADICTED" | "ELIMINATED" | "UNKNOWN";
}

// --- GENERAL DECISION-GAP MODEL ---
export interface DecisionGap {
    id: string;
    decision: string;
    currentConclusion: string;
    unknown: string;
    hypothesesAffected: string[];
    evidenceCurrentlyAvailable: string[];
    evidenceCapableOfResolving: string[];
    acquisitionMethods: {
        mechanismType: "STATIC_CODE_INSPECTION" | "LOCAL_TEST_EXECUTION" | "LOCAL_REPRODUCTION" | "TARGETED_RUNTIME_TELEMETRY" | "DEPLOYMENT_AUDIT";
        description: string;
        acquisitionCost: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "EXPENSIVE";
        privacyRisk: "NONE" | "LOW_ANONYMIZED" | "HIGH_PII";
        operationalRisk: "NONE" | "READ_ONLY" | "PROCESS_RESTART" | "TRAFFIC_MUTATION";
        canExecuteAutonomously: boolean;
    }[];
    expectedDecisionImpact: "CRITICAL_PATH" | "BOUNDARY_DISCRIMINATING" | "CONFIRMATORY" | "MARGINAL";
}

// --- AUTONOMOUS EVIDENCE ACQUISITION LIFECYCLE ---
export interface EvidenceAcquisitionLifecycleRecord {
    gapId: string;
    specification: {
        targetSymbolOrTrace: string;
        requiredFact: string;
        dataScope: string;
    };
    privacyClassification: "SAFE_CODE_METADATA" | "RUNTIME_METRIC" | "POTENTIAL_PII_BLOCKED";
    safetyClassification: "SAFE_READ" | "ISOLATED_CONTAINER" | "UNSAFE_PRODUCTION_MUTATION";
    capabilityStatus: "AUTONOMOUSLY_CAPABLE" | "REQUIRES_DEVELOPER_CONSENT" | "TECHNICALLY_IMPOSSIBLE";
    selectedMechanism?: string;
    executionResult?: {
        success: boolean;
        collectedEvidenceIds: string[];
        executionDurationMs: number;
        logs: string;
    };
    temporaryInstrumentationCleanupVerified: boolean;
    graphUpdateCompleted: boolean;
}

// --- FIRST-CLASS REPRODUCTION ---
export type ReproductionState =
    | "REPRODUCED"
    | "NOT_REPRODUCED"
    | "PARTIALLY_REPRODUCED"
    | "UNREPRODUCIBLE_ENVIRONMENT"
    | "REPRODUCTION_CONTRADICTS_HYPOTHESIS";

export interface ReproductionRecord {
    id: string;
    state: ReproductionState;
    repositoryRevision: string;
    runtimeVersion: string;
    environmentRequirements: string[];
    inputPayloadOrArgs: Record<string, unknown>;
    executionCommand: string;
    observedResult: string;
    expectedResult: string;
    exitCode: number;
    stdout: string;
    stderr: string;
    evidenceReferences: string[];
    hypothesisImpactRationale: string;
}

// --- OPEN REPAIR BOUNDARY & CANDIDATE SEARCH ---
export interface OpenRepairBoundary {
    id: string;
    entity: string;
    entityRoleDescription: string;
    discoveredVia: "INVARIANT_PARTICIPANT" | "DATA_FLOW_MUTATION" | "OWNERSHIP_HANDOFF" | "RESOURCE_CONTROLLER";
    classificationTag?: "CALLER" | "PRODUCER" | "CONSUMER" | "CALLEE" | "ADAPTER" | "SHARED_ABSTRACTION" | "CONFIGURATION" | "DEPENDENCY" | "DEPLOYMENT" | "TEST" | "NO_CODE_CHANGE" | "CUSTOM_BOUNDARY";
    isCapableOfRestoringInvariant: boolean;
    ownershipEvidenceIds: string[];
    eliminationRationale?: string;
}

export interface CandidateRepair {
    id: string;
    boundaryId: string;
    targetedMechanism: string;
    restoredInvariant: string;
    evidenceSupportingRelationship: string[];
    modifications: {
        filePath: string;
        symbol: string;
        startLine: number;
        endLine: number;
        originalCode: string;
        replacementCode: string;
    }[];
    reusedExistingAbstractions: {
        abstractionName: string;
        sourcePath: string;
        roleInRepair: string;
    }[];
}

// --- MECHANISM-COVERAGE & CONSEQUENCE ANALYSIS ---
export type MechanismCoverageType = "DIRECT" | "PARTIAL" | "INDIRECT" | "NONE";

export interface MechanismCoverageRecord {
    candidateId: string;
    coverageType: MechanismCoverageType;
    eliminatesRootMechanism: boolean;
    merelyRaisesFailureThreshold: boolean;
    suppressesSymptomWithoutFix: boolean;
    restoresViolatedInvariant: boolean;
    evaluationRationale: string;
}

export interface ConsequenceAnalysisRecord {
    candidateId: string;
    secondOrderEffects: {
        category: "CONCURRENCY" | "RETRIES" | "RESOURCE_SATURATION" | "IDEMPOTENCY" | "PERFORMANCE" | "SECURITY" | "API_CONTRACT";
        description: string;
        isAcceptable: boolean;
    }[];
    classification: "FIXES_MECHANISM" | "MASKS_SYMPTOM" | "SHIFTS_FAILURE" | "CREATES_NEW_FAILURE_MODE";
    isApprovedForExecution: boolean;
}

// --- BASELINE FAILURE PARTITIONING & EXECUTION ---
export interface BaselineExecutionRecord {
    failingTests: string[];
    buildErrors: string[];
    typeErrors: string[];
    timestamp: number;
}

export interface PostPatchValidationRecord {
    baselineFailures: BaselineExecutionRecord;
    originalFailureResolved: boolean;
    intendedBehaviorRestored: boolean;
    violatedInvariantRestored: boolean;
    unchangedBaselineFailures: string[];
    patchIntroducedFailures: string[];
    patchFixedFailures: string[];
    unrelatedFailures: string[];
    behavioralOutputVerified: boolean;
    isCleanPass: boolean;
}

// --- THREE-TIER PROOF RECORDS ---
export interface DiagnosisProof {
    incidentId: string;
    confirmedMechanism: string;
    violatedInvariant: string;
    causalChainEvidenceIds: string[];
    epistemicTier: "DEFECT_CAUSED_OCCURRENCE";
    cryptographicHash: string;
}

export interface RepairProof {
    candidateId: string;
    targetBoundary: OpenRepairBoundary;
    mechanismCoverage: MechanismCoverageRecord;
    consequenceApproval: ConsequenceAnalysisRecord;
    architecturalReuseEvidenceIds: string[];
    cryptographicHash: string;
}

export interface BehavioralProof {
    candidateId: string;
    postPatchValidation: PostPatchValidationRecord;
    reproductionRecord: ReproductionRecord;
    executionLogExcerpt: string;
    cryptographicHash: string;
}

export interface ComprehensiveProofRecord {
    diagnosisProof: DiagnosisProof;
    repairProof: RepairProof;
    behavioralProof: BehavioralProof;
    verifiedAt: number;
}

// --- CLAIM-LEVEL PROVENANCE ---
export interface ClaimProvenance {
    claimText: string;
    referencedEvidenceIds: string[];
    referencedSourceLocations: string[];
    analysisComponent: string;
    epistemicStatus: "EMPIRICALLY_VERIFIED" | "DERIVED_FROM_AST" | "CONFIRMED_VIA_EXECUTION" | "AMBIGUOUS_UNRESOLVED";
}

export interface InformationFrontierAuditRecord {
    decisionsEvaluated: string[];
    hypothesesEvaluated: string[];
    repositoryAreasSearched: string[];
    sourceAreasSearched: string[];
    testsInspected: string[];
    configurationInspected: string[];
    deploymentEvidenceInspected: string[];
    reproductionAttempted: boolean;
    runtimeEvidenceInspected: string[];
    acquisitionMethodsAttempted: string[];
    remainingUnknown: string;
    whyUnknownChangesRepairDecision: string;
    whyHaloCannotResolve: string;
}

export interface FormalRecommendationContract {
    state: FormalRecommendationState;
    proof?: ComprehensiveProofRecord;
    decisionGap?: DecisionGap;
    informationFrontierRecord?: InformationFrontierAuditRecord;
    claimsWithProvenance: ClaimProvenance[];
    adaptiveSections: {
        title: string;
        contentMarkdown: string;
        prominenceOrder: number;
    }[];
}

// --- REPAIR EQUIVALENCE RECORD (Phase 8) ---
export interface RepairEquivalenceRecord {
    isRepairEquivalent: boolean;
    equivalentHypothesisIds: string[];
    sharedInvariant: string;
    sharedRepairBoundary: string;
    sharedRepairAction: string;
    unresolvedUpstreamCausalityReason: string;
}

// --- SINGLE AUTHORITATIVE ENGINEERING DECISION OBJECT (Phase 2) ---
export interface AuthoritativeEngineeringDecision {
    occurrenceId: string;
    investigationVersion: number;
    failure: {
        location: {
            filePath?: string;
            lineNumber?: number;
            symbol?: string;
            status: FailureLocationStatus;
            provenance: string;
        };
        expression?: string;
        executionContext?: string;
    };
    separatedLocations?: SeparatedLocations;
    defectMechanismCause?: DefectMechanismCause;
    mechanism: {
        status: FailureMechanismStatus;
        description: string;
        evidenceIds: string[];
    };
    causality: {
        status: "PROVEN" | "SUPPORTED" | "PLAUSIBLE" | "COINCIDENTAL" | "REFUTED" | "UNKNOWN";
        causalChain: string[];
        evidenceIds: string[];
    };
    invariant: {
        description: string;
        formalStatement?: string;
        classification?: InvariantClassification;
        evidenceIds: string[];
    };
    brokenInvariant?: BrokenInvariant;
    ownership: {
        status: "ESTABLISHED" | "AMBIGUOUS" | "UNKNOWN";
        owner?: string;
        evidenceIds: string[];
    };
    repairBoundary: {
        status: "VERIFIED" | "CANDIDATE" | "UNKNOWN";
        entity?: string;
        boundaryType: string;
        evidenceIds: string[];
    };
    candidates: CandidateAction[];
    selectedCandidate?: {
        candidateId: string;
        category: ActionCategory;
        title: string;
        justification: string;
    };
    regression: {
        temporalAssociation: TemporalAssociation;
        sourceAssociation: SourceAssociation;
        executionRelevance: ExecutionRelevance;
        behavioralRelevance: BehavioralRelevance;
        mechanismRelevance: MechanismRelevance;
        causalSupport: CausalSupport;
        rollbackAudit?: RollbackAuditRecord;
        isRollbackSuperior?: boolean;
        superiorityReason?: string;
    };
    evidence: {
        supporting: string[];
        contradicting: string[];
        missing: string[];
        stale: string[];
    };
    decisionGap?: DecisionGap;
    acquisitionPlan?: EvidenceAcquisitionLifecycleRecord | any;
    diagnosisProof?: DiagnosisProof;
    repairProof?: RepairProof;
    behavioralProof?: BehavioralProof;
    validation?: {
        steps: string[];
        isExecuted: boolean;
        isCleanPass: boolean;
    };
    consequences?: ConsequenceAnalysisRecord;
    uncertainty: string[];
    finalState: FormalRecommendationState;
    decomposedConfidence: DecomposedConfidence;
    repairEquivalence?: RepairEquivalenceRecord;
    provenance: ClaimProvenance[];
    findings?: CanonicalFinding[];
    evidenceStoreHash?: string;
    // --- 10000/10 ENGINEERING REASONING EXTENSIONS ---
    worldModelSummary?: {
        servicesCount: number;
        symbolsCount: number;
        edgesCount: number;
    };
    reasoningVersion?: string;
    reasoningHistory?: Array<{ version: string; reason: string; timestamp: string }>;
    claimGraphSummary?: {
        totalClaims: number;
        supportedClaims: number;
        invalidatedClaims: number;
    };
    firstDivergence?: FirstDivergenceRecord;
    valueOriginChain?: ValueOriginChain;
    explicitInvariant?: ExplicitInvariant;
    seniorEngineerAnalysis?: SeniorEngineerAnalysis;
    adversarialChallenge?: AdversarialChallengeRecord;
    preventionRecommendation?: PreventionRecommendation;
    systemicDefects?: SystemicDefectRecord[];
}

// ============================================================================
// 10000/10 ENGINEERING REASONING CORE TYPES (Sections 0 - 93)
// ============================================================================

export interface EngineeringWorldNode {
    id: string; // Canonical evidence ID or stable entity key
    type: "SERVICE" | "MODULE" | "FILE" | "FUNCTION" | "CLASS" | "VARIABLE" | "RESOURCE" | "TEST" | "COMMIT" | "DEPLOYMENT" | "CONFIGURATION";
    name: string;
    filePath?: string;
    lineNumber?: number;
    metadata?: Record<string, unknown>;
}

export interface EngineeringWorldEdge {
    sourceId: string;
    targetId: string;
    relation: "CALLS" | "PRODUCES" | "TRANSFORMS" | "CONSUMES" | "ACQUIRES" | "RELEASES" | "MODIFIES" | "VERIFIES" | "ENFORCES" | "DEPENDS_ON";
    evidenceId?: string;
    metadata?: Record<string, unknown>;
}

export interface EngineeringWorldModel {
    id: string;
    snapshotId: string;
    nodes: Map<string, EngineeringWorldNode> | Record<string, EngineeringWorldNode>;
    edges: EngineeringWorldEdge[];
    createdAt: Date;
}

export type ReasoningStateVersion = "R0" | "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7" | "R8" | "R9" | "R10";

export type ClaimType =
    | "FACT"
    | "INVARIANT"
    | "INTENT"
    | "CONTRACT_OWNERSHIP"
    | "FIRST_DIVERGENCE"
    | "CAUSAL_MECHANISM"
    | "REPAIR_BOUNDARY"
    | "CANDIDATE_CORRECTNESS"
    | "BEHAVIORAL_PROOF"
    | "REGRESSION_SAFETY";

export type ClaimStatus = "SUPPORTED" | "UNVERIFIED" | "CONTRADICTED" | "INVALIDATED";

export interface Claim {
    claimId: string;
    statement: string;
    type: ClaimType;
    status: ClaimStatus;
    evidenceRefs: string[]; // Canonical evidence IDs
    reasoningRefs: string[]; // Dependent claim IDs
    counterEvidence?: string[];
    createdAt: Date;
    invalidatedAt?: Date;
    invalidationReason?: string;
}

export interface ClaimDependencyGraph {
    claims: Record<string, Claim>;
    dependencies: Record<string, string[]>; // claimId -> array of child claim IDs that depend on it
}

export interface HypothesisElimination {
    hypothesisId: string;
    statement: string;
    requiredConditions: string[];
    supportingEvidence: string[];
    contradictingEvidence: string[];
    status: "SUPPORTED" | "WEAK" | "CONTRADICTED" | "REJECTED" | "UNRESOLVED" | "CONFIRMED" | "UNKNOWN";
    eliminationReason?: string;
}

export interface EngineeringReasoningState {
    version: ReasoningStateVersion;
    versionHistory: Array<{
        version: ReasoningStateVersion;
        transitionReason: string;
        timestamp: Date;
    }>;
    claims: ClaimDependencyGraph;
    hypotheses: HypothesisElimination[];
    whyRecursion: Array<{
        level: number;
        question: string;
        answer: string;
        contractOwner?: string;
    }>;
    decisionChangingConditions: string[];
}

export interface FirstDivergenceRecord {
    observationFrame: string;
    firstDivergenceFrame: string;
    firstDivergenceFile: string;
    firstDivergenceLine?: number;
    expectedStateDescription: string;
    actualStateDescription: string;
    framesBeforeFailure: number;
    evidenceIds: string[];
}

export interface ValueOriginStep {
    symbol: string;
    location: string;
    producer: string;
    transformation: string;
    consumer: string;
    stateBefore: string;
    stateAfter: string;
    evidenceId?: string;
}

export interface ValueOriginChain {
    targetValue: string;
    steps: ValueOriginStep[];
    originBoundary: "EXTERNAL_INPUT" | "TRUSTED_CONSTANT" | "CONFIGURATION" | "DATABASE" | "USER_INPUT" | "RUNTIME_STATE" | "UNKNOWN";
    boundaryLocation: string;
}

export interface IntentConflict {
    conflictId: string;
    statement: string;
    sourceA: { source: "TYPES" | "SCHEMA" | "TESTS" | "DOCS" | "RUNTIME"; assertion: string };
    sourceB: { source: "TYPES" | "SCHEMA" | "TESTS" | "DOCS" | "RUNTIME"; assertion: string };
    authoritativeSource: "TYPES" | "SCHEMA" | "TESTS" | "DOCS" | "RUNTIME";
    resolutionJustification: string;
}

export interface ExplicitInvariant {
    invariantId: string;
    statement: string;
    scope: string;
    preconditions: string[];
    expectedState: Record<string, unknown>;
    violatedState: Record<string, unknown>;
    evidenceRefs: string[];
    ownerCandidates: string[];
    enforcementPoints: string[];
    violationPoint: string;
    restorationCandidates: string[];
}

export interface ResourceLifecycleRecord {
    resourceType: string;
    acquisitionCall: string;
    releaseCall: string;
    ownerComponent: string;
    isReleasedOnFailure: boolean;
    detectedLeakLocation?: string;
}

export interface StateTransitionRecord {
    stateMachine: string;
    fromState: string;
    toState: string;
    isLegal: boolean;
    violationType?: "ILLEGAL_TRANSITION" | "MISSING_TRANSITION" | "PREMATURE_TRANSITION" | "DUPLICATE_TRANSITION" | "RACE_CONDITION";
    evidenceId?: string;
}

export interface CounterexampleCase {
    caseName: string;
    inputDescription: string;
    expectedBehavior: string;
    actualCandidateBehavior: "PASS" | "FAIL";
    status: "SURVIVED" | "DISPROVED";
    notes?: string;
}

export interface SeniorEngineerAnalysis {
    whyNotObviousFix: string; // e.g. "Why not just add optional chaining `?.` or a null guard?"
    whatJuniorWouldMiss: string;
    whatStaffEngineerWouldNotice: string;
    whatWouldChangeDecision: string;
}

export interface AdversarialChallengeRecord {
    candidateId: string;
    attacksEvaluated: string[];
    symptomMaskingDetected: boolean;
    maskingReason?: string;
    counterexamples: CounterexampleCase[];
    minimalityVerified: boolean;
    necessityVerified: boolean;
    survivedAdversarialChallenge: boolean;
}

export interface StructuralExperienceRecord {
    experienceId: string;
    failureStructure: string;
    executionStructure: string;
    mechanismPattern: string;
    invariantPattern: string;
    contractOwnershipPattern: string;
    successfulRepairBoundary: string;
    relevanceCount: number;
}

export interface SystemicDefectRecord {
    defectClusterId: string;
    sharedBrokenInvariant: string;
    sharedContractBoundary: string;
    affectedOccurrencesCount: number;
    systemicRecommendation: string;
}

export interface PreventionRecommendation {
    immediateRepair: string;
    systemicPrevention: string;
    architecturalEnforcementBoundary: string;
    preventionMechanism: "SCHEMA_VALIDATION" | "TYPE_BOUND" | "GATEWAY_FILTER" | "RESOURCE_RAII" | "INVARIANT_ASSERTION";
}

export * from "./canonical-evidence-store";

