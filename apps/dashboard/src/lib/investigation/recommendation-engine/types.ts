/**
 * Halo Recommendation & Patch Engine Types
 *
 * Defines machine-validatable schemas and strict types for LLM generation,
 * claim verification, patch proposal, and audit logging.
 */

import { z } from "zod";

export const ClaimCategorySchema = z.enum([
    "OBSERVED",
    "DERIVED",
    "SUPPORTED",
    "UNKNOWN",
]);
export type ClaimCategory = z.infer<typeof ClaimCategorySchema>;

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

export const CodeSnippetTypeSchema = z.enum([
    "EXISTING_AND_PROPOSED",
    "PROPOSED_ONLY",
    "CONCEPTUAL",
]);
export type CodeSnippetType = z.infer<typeof CodeSnippetTypeSchema>;

export const RecommendedChangeSchema = z.object({
    filePath: z.string().optional(),
    symbol: z.string().optional(),
    startLine: z.number().int().positive().optional(),
    endLine: z.number().int().positive().optional(),
    codeType: CodeSnippetTypeSchema.default("CONCEPTUAL"),
    explanation: z.string().min(1),
    whyHere: z.string().min(1),
    currentCode: z.string().optional(),
    proposedCode: z.string().optional(),
    unifiedDiff: z.string().optional(),
    isExactSourceVerified: z.boolean().default(false),
});
export type RecommendedChange = z.infer<typeof RecommendedChangeSchema>;

export const FixOutcomeTypeSchema = z.enum([
    "CODE_CHANGE_RECOMMENDED",
    "MULTI_FILE_CHANGE_RECOMMENDED",
    "CONFIGURATION_CHANGE_RECOMMENDED",
    "TEST_CHANGE_RECOMMENDED",
    "NO_CODE_CHANGE_REQUIRED",
    "ALREADY_FIXED",
    "INSUFFICIENT_EVIDENCE",
    "AMBIGUOUS_ROOT_CAUSE",
    "EXTERNAL_DEPENDENCY_ACTION",
    "OBSERVABILITY_STEP_REQUIRED_BEFORE_REPAIR",
]);
export type FixOutcomeType = z.infer<typeof FixOutcomeTypeSchema>;

export const FixRecommendationSchema = z.object({
    actionAnswer: z.string().min(1).default("Review investigation evidence to formulate a targeted repair."),
    outcomeType: FixOutcomeTypeSchema.default("CODE_CHANGE_RECOMMENDED"),
    summary: z.string().min(1),
    diagnosis: z.string().min(1),
    whyThisAction: z.string().optional(),
    whyNotSymptomFix: z.string().optional(),
    missingEvidence: z.array(z.string()).default([]),
    nextActionBeforeRepair: z.string().optional(),
    confidence: z.enum(["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]).default("MEDIUM"),
    evidenceReferences: z.array(z.string()).default([]),
    changes: z.array(RecommendedChangeSchema).default([]),
    relatedConsistencyChecks: z.array(z.string()).default([]),
    validationSteps: z.array(z.string()).default([]),
    uncertainty: z.array(z.string()).default([]),
    followUpSuggestions: z.array(z.string()).default([]),
    hasInsufficientEvidence: z.boolean().default(false),
    refusalReason: z.string().optional(),
});
export type FixRecommendation = z.infer<typeof FixRecommendationSchema>;

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

/**
 * Gate classification verdict determining whether LLM invocation and patch generation
 * are permitted under Halo's truth constraints.
 */
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

/**
 * Output of the deterministic claim and patch validation pipeline.
 */
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

/**
 * Final production recommendation result delivered to the UI.
 */
export interface ValidatedRecommendationResult {
    /** Whether an LLM recommendation was successfully generated and passed deterministic validation */
    success: boolean;

    /** Source of recommendation */
    source: "LLM_VERIFIED" | "DETERMINISTIC_FALLBACK" | "REFUSAL_INSUFFICIENT_EVIDENCE";

    /** Qualitative user-facing confidence */
    confidence: "Low" | "Medium" | "High" | "Very High";

    /** Core headline explanation */
    whatHappened: string;

    /** Claims with verified provenance and jump-to-evidence IDs */
    claims: Array<{
        statement: string;
        category: ClaimCategory;
        evidenceIds: string[];
        isDirectlyObserved: boolean;
    }>;

    /** Immediate developer action */
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

    /** Proposed patch — labeled "Proposed patch — not applied" */
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

    /** Explicitly stated unknowns */
    unknowns: string[];

    /** Limitations and caveats */
    limitations: string[];

    /** Full evidence-driven Repair Case */
    repairCase?: import("../repair-intelligence/types").RepairCase | import("../repair-intelligence/types").LegacyRepairCase;

    /** Audit and inspectability metadata */
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

