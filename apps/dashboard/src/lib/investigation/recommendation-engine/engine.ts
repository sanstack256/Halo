/**
 * Halo Recommendation & Patch Engine Orchestrator
 *
 * Implements Phases 4, 8, 25, 27, 32, and 33:
 * Coordinates the full evidence-bound recommendation workflow:
 *   1. Evaluates Decision Sufficiency Gate
 *   2. Builds Minimal Provenance Context (Epistemic separation) & Injection-Proof Prompt
 *   3. Dispatches to Configured Model Provider (Temp = 0)
 *   4. Runs Deterministic Output Validation (Claims, Source, AST match, Anti-masking)
 *   5. Real failure state if model fails — zero canned responses
 */

import type { EvidenceSnapshot } from "../evidence-snapshot";
import type { RecommendationModel } from "./provider";
import { getRecommendationModel } from "./provider";
import { evaluateRecommendationEligibility, evaluateDecisionSufficiency } from "./eligibility-gate";
import { buildRecommendationContext } from "./context-builder";
import { buildRecommendationPrompts } from "./prompt-builder";
import { validateModelOutput } from "./output-validator";
import { buildRepairCase } from "../repair-intelligence/repair-case-builder";
import type {
    ValidatedRecommendationResult,
    RecommendationEligibilityVerdict,
    FixRecommendation,
} from "./types";

export interface GenerateRecommendationOptions {
    snapshot: EvidenceSnapshot;
    customModel?: RecommendationModel;
}

export async function generateEvidenceBoundRecommendation(
    options: GenerateRecommendationOptions
): Promise<ValidatedRecommendationResult> {
    const { snapshot, customModel } = options;

    // 1. Evaluate Decision Sufficiency Gate & Deterministic Repair Case
    const gateVerdict = evaluateRecommendationEligibility(snapshot);
    const sufficiency = evaluateDecisionSufficiency(snapshot);
    const repairCase = buildRepairCase({ snapshot });

    if (!gateVerdict.canGenerateRecommendation) {
        return {
            success: false,
            source: "REFUSAL_INSUFFICIENT_EVIDENCE",
            confidence: "Low",
            whatHappened: gateVerdict.recommendationReason,
            claims: [
                {
                    statement:
                        "Available telemetry is insufficient to establish an evidence-backed failure explanation.",
                    category: "UNKNOWN",
                    evidenceIds: [],
                    isDirectlyObserved: false,
                },
            ],
            unknowns: [
                "Incident failure mechanism",
                "Root cause telemetry",
                "Affected execution path",
            ],
            limitations: ["Refused by Halo deterministic eligibility gate."],
            repairCase,
            fixRecommendation: {
                directAnswer: `Do not modify production code yet. ${gateVerdict.recommendationReason}`,
                actionAnswer: `Do not modify production code yet. ${gateVerdict.recommendationReason}`,
                status: sufficiency.decisionState,
                outcomeType: sufficiency.decisionState,
                summary: `Do not modify production code yet. ${gateVerdict.recommendationReason}`,
                diagnosis: gateVerdict.recommendationReason,
                whyThisAction: "Insufficient telemetry to safely identify a repair target.",
                whyThisFixesIt: "Refusing speculative modifications preserves system stability until concrete observability is available.",
                whyNotSymptomFix: "Do not apply defensive symptom masking without understanding the root failure cause.",
                alternatives: [],
                doNotChange: [],
                verification: ["Capture correlated telemetry or reproduce in development before modifying code."],
                missingEvidence: sufficiency.missingEvidence,
                nextActionBeforeRepair: sufficiency.nextActionBeforeRepair,
                confidence: "LOW",
                evidenceReferences: [],
                changes: [],
                validationSteps: ["Capture correlated telemetry or reproduce in development before modifying code."],
                uncertainty: ["Incident failure mechanism"],
                relatedConsistencyChecks: [],
                followUpSuggestions: [],
                hasInsufficientEvidence: true,
                refusalReason: gateVerdict.recommendationReason,
                isStale: false,
            },
            audit: {
                snapshotId: snapshot.snapshotId,
                gateVerdict,
                validation: {
                    passed: true,
                    schemaValid: true,
                    evidenceCitationsValid: true,
                    sourceLocationsValid: true,
                    patchValid: true,
                    factualConsistencyValid: true,
                    rejectionReasons: [],
                    warnings: [],
                },
                modelInfo: {
                    provider: "gate",
                    model: "deterministic-eligibility-gate",
                    durationMs: 0,
                },
            },
        };
    }

    // 2. Build Context & Prompts
    const context = buildRecommendationContext(snapshot);
    const { systemPrompt, userPrompt } = buildRecommendationPrompts(snapshot);

    // 3. Resolve Model
    const model = getRecommendationModel(customModel);

    // 4. Query Model
    let rawResponse: { rawText: string; durationMs: number };
    try {
        rawResponse = await model.generate({
            system: systemPrompt,
            user: userPrompt,
            snapshot,
            gateVerdict,
        });
    } catch (err: any) {
        return buildModelFailureResult(
            snapshot,
            gateVerdict,
            model.name,
            `AI recommendation is unavailable: ${err?.message || "LLM provider execution failed"}`
        );
    }

    // 5. Run Deterministic Validation Layer
    const validationResult = validateModelOutput(
        rawResponse.rawText,
        snapshot,
        gateVerdict
    );

    if (!validationResult.isValid || !validationResult.data) {
        return buildModelFailureResult(
            snapshot,
            gateVerdict,
            model.name,
            `Model output rejected by deterministic fact-checker: ${validationResult.audit.rejectionReasons.join(
                "; "
            )}`,
            validationResult.audit
        );
    }

    const data = validationResult.data;

    const fixRecommendation: FixRecommendation = (data as any).fixRecommendation || {
        directAnswer: data.recommendation?.action || data.whatHappened,
        actionAnswer: data.recommendation?.action || data.whatHappened,
        status: sufficiency.decisionState,
        outcomeType: sufficiency.decisionState,
        summary: data.recommendation?.action || data.whatHappened,
        diagnosis: data.whatHappened,
        whyThisAction: data.recommendation?.reasoning,
        whyThisFixesIt: data.recommendation?.reasoning,
        whyNotSymptomFix: "Do not apply defensive nullish checks or symptom suppression at the callee when caller contracts are violated.",
        missingEvidence: data.unknowns,
        nextActionBeforeRepair: sufficiency.nextActionBeforeRepair,
        confidence: (data.confidenceLevel?.toUpperCase() as any) || "MEDIUM",
        evidenceReferences: Array.from(new Set(data.claims.flatMap((c) => c.evidenceIds))),
        changes: data.proposedPatch?.files?.map((f) => ({
            file: f.path,
            filePath: f.path,
            codeType: "PROPOSED_ONLY" as const,
            explanation: f.explanation,
            whyHere: "Target identified from failing stack trace and application call chain.",
            whyThisLocation: "Target identified from failing stack trace and application call chain.",
            proposedCode: f.diff,
            isExactSourceVerified: false,
        })) || [],
        alternatives: [],
        doNotChange: [],
        verification: ["Reproduce with verified incident payload", "Execute test suite"],
        relatedConsistencyChecks: [],
        validationSteps: ["Reproduce with verified incident payload", "Execute test suite"],
        uncertainty: data.unknowns,
        followUpSuggestions: [
            "Why do you recommend changing the caller instead of the service?",
            "Which evidence led to this recommendation?",
            "What happens if we only add optional chaining?",
            "Are there other callers that need the same change?",
            "What tests should I add?",
        ],
        hasInsufficientEvidence: sufficiency.decisionState === "INSUFFICIENT_EVIDENCE" || sufficiency.decisionState === "OBSERVABILITY_REQUIRED_BEFORE_REPAIR",
        isStale: false,
    };

    // 6. Return Validated Production Result
    return {
        success: true,
        source: "LLM_VERIFIED",
        confidence: data.confidenceLevel,
        whatHappened: data.whatHappened,
        claims: data.claims.map((c) => ({
            statement: c.statement,
            category: c.category,
            evidenceIds: c.evidenceIds,
            isDirectlyObserved: c.category === "OBSERVED",
        })),
        action: data.recommendation
            ? {
                  instruction: data.recommendation.action,
                  reasoning: data.recommendation.reasoning,
                  location: data.recommendation.affectedLocation,
              }
            : undefined,
        patch: data.proposedPatch
            ? {
                  status: data.proposedPatch.status,
                  files: data.proposedPatch.files,
                  validationNote:
                      data.proposedPatch.status === "AVAILABLE"
                          ? `Proposed patch verified: Syntax validated against resolved source.`
                          : "Patch not generated (safe refusal).",
                  refusalReason: data.proposedPatch.refusalReason,
              }
            : undefined,
        unknowns: data.unknowns,
        limitations: data.limitations,
        repairCase,
        fixRecommendation,
        audit: {
            snapshotId: snapshot.snapshotId,
            gateVerdict,
            validation: validationResult.audit,
            modelInfo: {
                provider: model.id,
                model: model.name,
                durationMs: rawResponse.durationMs,
            },
        },
    };
}

/**
 * Builds a clean failure result for provider errors or fact-checker rejection.
 * NEVER returns a canned or generic fake recommendation (Phase 33 & Phase 67).
 */
function buildModelFailureResult(
    snapshot: EvidenceSnapshot,
    gateVerdict: RecommendationEligibilityVerdict,
    modelName: string,
    failureReason: string,
    validationAudit?: any
): ValidatedRecommendationResult {
    const anchor = snapshot.runtime?.anchorError || snapshot.evidence[0];
    const headline = anchor
        ? `Observed ${anchor.title} in service "${anchor.service ?? "unknown"}".`
        : "Incident observed in telemetry.";

    return {
        success: false,
        source: "DETERMINISTIC_FALLBACK",
        confidence: "Low",
        whatHappened: `${headline} Recommendation could not be safely generated: ${failureReason}`,
        claims: (snapshot.investigation.findings || []).slice(0, 3).map((f) => ({
            statement: f.title,
            category: "OBSERVED" as const,
            evidenceIds: f.evidenceIds || [],
            isDirectlyObserved: true,
        })),
        patch: {
            status: "NOT_SAFE_TO_GENERATE",
            files: [],
            validationNote: "Patch withheld due to recommendation generation failure.",
            refusalReason: failureReason,
        },
        unknowns: [failureReason],
        limitations: [failureReason],
        repairCase: buildRepairCase({ snapshot }),
        fixRecommendation: {
            directAnswer: `Recommendation could not be generated: ${failureReason}. Please retry or inspect investigation evidence.`,
            actionAnswer: `Recommendation could not be generated: ${failureReason}. Please retry or inspect investigation evidence.`,
            status: "INSUFFICIENT_EVIDENCE",
            outcomeType: "INSUFFICIENT_EVIDENCE",
            summary: failureReason,
            diagnosis: headline,
            whyThisAction: failureReason,
            whyThisFixesIt: "AI recommendation unavailable. Inspect raw telemetry or retry.",
            whyNotSymptomFix: "Do not blindly apply defensive symptom masking.",
            alternatives: [],
            doNotChange: [],
            verification: [],
            missingEvidence: [failureReason],
            confidence: "LOW",
            evidenceReferences: [],
            changes: [],
            validationSteps: [],
            uncertainty: [failureReason],
            relatedConsistencyChecks: [],
            followUpSuggestions: [],
            hasInsufficientEvidence: true,
            refusalReason: failureReason,
            isStale: false,
        },
        audit: {
            snapshotId: snapshot.snapshotId,
            gateVerdict,
            validation: validationAudit || {
                passed: false,
                schemaValid: false,
                evidenceCitationsValid: false,
                sourceLocationsValid: false,
                patchValid: false,
                factualConsistencyValid: false,
                rejectionReasons: [failureReason],
                warnings: [],
            },
            modelInfo: {
                provider: "error",
                model: modelName,
                durationMs: 0,
            },
        },
    };
}
