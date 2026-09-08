/**
 * Halo Recommendation & Patch Engine Orchestrator
 *
 * Coordinates the full evidence-bound recommendation workflow:
 *   1. Evaluates Eligibility Gate
 *   2. Builds Minimal Redacted Context & Injection-Proof Prompt
 *   3. Dispatches to Configured Model Provider (Temp = 0)
 *   4. Runs Deterministic Output Validation (Claims, Source, Patch)
 *   5. Fallbacks gracefully if LLM fails or is rejected
 */

import type { EvidenceSnapshot } from "../evidence-snapshot";
import type {
    RecommendationModel,
} from "./provider";
import { getRecommendationModel } from "./provider";
import { evaluateRecommendationEligibility } from "./eligibility-gate";
import { buildSystemPrompt, buildUserPrompt } from "./prompt-builder";
import { validateModelOutput } from "./output-validator";
import { buildRepairCase } from "../repair-intelligence/repair-case-builder";
import type {
    ValidatedRecommendationResult,
    RecommendationEligibilityVerdict,
} from "./types";

export interface GenerateRecommendationOptions {
    snapshot: EvidenceSnapshot;
    customModel?: RecommendationModel;
}

export async function generateEvidenceBoundRecommendation(
    options: GenerateRecommendationOptions
): Promise<ValidatedRecommendationResult> {
    const { snapshot, customModel } = options;

    // 1. Evaluate Eligibility Gate & Deterministic Repair Case
    const gateVerdict = evaluateRecommendationEligibility(snapshot);
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
    const system = buildSystemPrompt(gateVerdict);
    const user = buildUserPrompt(snapshot, gateVerdict);

    // 3. Resolve Model
    const model = getRecommendationModel(customModel);

    // 4. Query Model
    let rawResponse: { rawText: string; durationMs: number };
    try {
        rawResponse = await model.generate({ system, user, snapshot, gateVerdict });
    } catch (err: any) {
        // Graceful error fallback
        return buildFallbackResult(
            snapshot,
            gateVerdict,
            model.name,
            `Model execution failed: ${err?.message || "unknown error"}`
        );
    }

    // 5. Run Deterministic Validation Layer
    const validationResult = validateModelOutput(
        rawResponse.rawText,
        snapshot,
        gateVerdict
    );

    if (!validationResult.isValid || !validationResult.data) {
        return buildFallbackResult(
            snapshot,
            gateVerdict,
            model.name,
            `Model output rejected by deterministic validation: ${validationResult.audit.rejectionReasons.join(
                "; "
            )}`,
            validationResult.audit
        );
    }

    const data = validationResult.data;

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

function buildFallbackResult(
    snapshot: EvidenceSnapshot,
    gateVerdict: RecommendationEligibilityVerdict,
    modelName: string,
    fallbackReason: string,
    validationAudit?: any
): ValidatedRecommendationResult {
    const anchor = snapshot.runtime.anchorError;
    const headline = anchor
        ? `Observed ${anchor.title} in service "${anchor.service ?? "unknown"}".`
        : "Incident observed in telemetry.";

    return {
        success: false,
        source: "DETERMINISTIC_FALLBACK",
        confidence: "Medium",
        whatHappened: `${headline} AI recommendation is unavailable: ${fallbackReason}`,
        claims: (snapshot.investigation.findings || []).slice(0, 3).map((f) => ({
            statement: f.title,
            category: "OBSERVED" as const,
            evidenceIds: f.evidenceIds || [],
            isDirectlyObserved: true,
        })),
        action: snapshot.investigation.rootCause
            ? {
                  instruction: `Investigate root cause hypothesis: ${snapshot.investigation.rootCause.title}`,
                  reasoning: snapshot.investigation.rootCause.description,
              }
            : undefined,
        patch: {
            status: "NOT_SAFE_TO_GENERATE",
            files: [],
            validationNote: "Patch generation withheld in fallback mode.",
            refusalReason: fallbackReason,
        },
        unknowns: ["LLM-synthesized resolution steps"],
        limitations: [fallbackReason],
        repairCase: buildRepairCase({ snapshot }),
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
                rejectionReasons: [fallbackReason],
                warnings: [],
            },
            modelInfo: {
                provider: "fallback",
                model: modelName,
                durationMs: 0,
            },
        },
    };
}
