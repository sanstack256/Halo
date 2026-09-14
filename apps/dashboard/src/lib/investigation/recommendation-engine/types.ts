/**
 * Halo Trace — Senior Engineering Recommendation Engine Types
 *
 * Implements the Epistemic model, 12 Decision States, Structured Output Contract,
 * and deterministic validation schemas for Phase 0 - 102.
 */

import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Epistemic Model                                                            */
/* -------------------------------------------------------------------------- */

export const EpistemicCategorySchema = z.enum([
    "FACT",
    "SUPPORTED_INFERENCE",
    "RECOMMENDATION",
    "UNKNOWN",
]);
export type EpistemicCategory = z.infer<typeof EpistemicCategorySchema>;

export const ClaimCategorySchema = z.enum([
    "OBSERVED",
    "DERIVED",
    "SUPPORTED",
    "UNKNOWN",
]);
export type ClaimCategory = z.infer<typeof ClaimCategorySchema>;

/* -------------------------------------------------------------------------- */
/* 12 Conceptual Decision States                                              */
/* -------------------------------------------------------------------------- */

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
    // Compatible aliases
    "CODE_CHANGE_RECOMMENDED",
    "MULTI_FILE_CHANGE_RECOMMENDED",
    "CONFIGURATION_CHANGE_RECOMMENDED",
    "TEST_CHANGE_RECOMMENDED",
    "AMBIGUOUS_ROOT_CAUSE",
    "OBSERVABILITY_STEP_REQUIRED_BEFORE_REPAIR",
]);
export type DecisionState = z.infer<typeof DecisionStateSchema>;

export const FixOutcomeTypeSchema = DecisionStateSchema;
export type FixOutcomeType = DecisionState;

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

/* -------------------------------------------------------------------------- */
/* AI Provider Infrastructure                                                 */
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
/* Recommendation Code Changes & Alternatives                                 */
/* -------------------------------------------------------------------------- */

export const CodeSnippetTypeSchema = z.enum([
    "EXISTING_AND_PROPOSED",
    "PROPOSED_ONLY",
    "CONCEPTUAL",
]);
export type CodeSnippetType = z.infer<typeof CodeSnippetTypeSchema>;

export const RecommendedChangeSchema = z.object({
    file: z.string().optional(),
    filePath: z.string().optional(),
    symbol: z.string().optional(),
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
    codeType: CodeSnippetTypeSchema.default("CONCEPTUAL"),
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

export const ModelClaimSchema = z.object({
    statement: z.string().min(1),
    category: ClaimCategorySchema,
    evidenceIds: z.array(z.string()).default([]),
});
export type ModelClaim = z.infer<typeof ModelClaimSchema>;

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
export type ModelAction = z.infer<typeof ModelActionSchema>;

export const ModelPatchFileSchema = z.object({
    path: z.string().min(1),
    diff: z.string().min(1),
    explanation: z.string().min(1),
});
export type ModelPatchFile = z.infer<typeof ModelPatchFileSchema>;

export const ModelProposedPatchSchema = z.object({
    status: PatchStatusSchema,
    files: z.array(ModelPatchFileSchema).default([]),
    refusalReason: z.string().optional(),
});
export type ModelProposedPatch = z.infer<typeof ModelProposedPatchSchema>;

/* -------------------------------------------------------------------------- */
/* Canonical Structured Recommendation Contract                               */
/* -------------------------------------------------------------------------- */

export const QualitativeConfidenceSchema = z.enum(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]);
export type QualitativeConfidence = z.infer<typeof QualitativeConfidenceSchema>;

export const FixRecommendationSchema = z.object({
    directAnswer: z.string().optional(),
    actionAnswer: z.string().min(1).default("Review investigation evidence to formulate a targeted repair."),
    status: DecisionStateSchema.optional(),
    outcomeType: FixOutcomeTypeSchema.default("CODE_CHANGE"),
    summary: z.string().min(1),
    diagnosis: z.string().min(1),
    whyThisFixesIt: z.string().optional(),
    whyThisAction: z.string().optional(),
    whyNotSymptomFix: z.string().optional(),
    alternatives: z.array(CompetingAlternativeSchema).default([]),
    doNotChange: z.array(z.string()).default([]),
    verification: z.array(z.string()).default([]),
    validationSteps: z.array(z.string()).default([]),
    missingEvidence: z.array(z.string()).default([]),
    nextActionBeforeRepair: z.string().optional(),
    uncertainty: z.array(z.string()).default([]),
    confidence: QualitativeConfidenceSchema.default("MEDIUM"),
    evidenceReferences: z.array(z.string()).default([]),
    changes: z.array(RecommendedChangeSchema).default([]),
    relatedConsistencyChecks: z.array(z.string()).default([]),
    followUpSuggestions: z.array(z.string()).default([]),
    hasInsufficientEvidence: z.boolean().default(false),
    refusalReason: z.string().optional(),
    isStale: z.boolean().default(false),
});
export type FixRecommendation = z.infer<typeof FixRecommendationSchema>;

export interface EngineeringRecommendation extends FixRecommendation {
    status: DecisionState;
    directAnswer: string;
}

export const StructuredModelRecommendationSchema = z.object({
    status: RecommendationStatusSchema,
    whatHappened: z.string().min(1),
    claims: z.array(ModelClaimSchema).min(1),
    recommendation: ModelActionSchema.optional(),
    proposedPatch: ModelProposedPatchSchema.optional(),
    unknowns: z.array(z.string()).default([]),
    limitations: z.array(z.string()).default([]),
    confidenceLevel: z.enum(["Low", "Medium", "High", "Very High"]).default("Medium"),
    fixRecommendation: FixRecommendationSchema.optional(),
});
export type StructuredModelRecommendation = z.infer<
    typeof StructuredModelRecommendationSchema
>;

/* -------------------------------------------------------------------------- */
/* Audit & Fact-Check Metadata                                                */
/* -------------------------------------------------------------------------- */

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
    repairCase?: import("../repair-intelligence/types").RepairCase | import("../repair-intelligence/types").LegacyRepairCase;
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
/* Follow-Up Q&A Message                                                      */
/* -------------------------------------------------------------------------- */

export interface FollowUpQuestionMessage {
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    citations?: string[];
    referencedCallers?: Array<{
        filePath: string;
        lineNumber?: number;
        snippet?: string;
    }>;
}
