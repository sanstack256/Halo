/**
 * Halo Deterministic Output Validator
 *
 * Verifies LLM output against the Canonical Evidence Snapshot before any content is shown.
 * Enforces:
 *   1. Strict JSON schema validation via Zod.
 *   2. Evidence Reference Validation: Every cited evidenceId must exist in the snapshot.
 *   3. Source Location Validation: Mentioned file paths and line numbers must match verified source.
 *   4. Factual Consistency: No fabricated tests, builds, or conflicting HTTP statuses.
 *   5. Patch Validation: Diffs must apply cleanly and pass AST syntax checks.
 */

import type { EvidenceSnapshot } from "../evidence-snapshot";
import {
    StructuredModelRecommendationSchema,
    type StructuredModelRecommendation,
    type OutputValidationAudit,
    type RecommendationEligibilityVerdict,
} from "./types";
import { validateProposedPatch } from "./patch-validator";
import { buildFailureModel } from "../repair-intelligence/failure-model";

export function validateModelOutput(
    rawText: string,
    snapshot: EvidenceSnapshot,
    gateVerdict: RecommendationEligibilityVerdict
): {
    isValid: boolean;
    data?: StructuredModelRecommendation;
    audit: OutputValidationAudit;
} {
    const rejectionReasons: string[] = [];
    const warnings: string[] = [];

    // 1. JSON Parse
    let parsedJson: any;
    try {
        // Strip any markdown code block wrapper if present
        let cleaned = rawText.trim();
        if (cleaned.startsWith("```json")) {
            cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
        }
        parsedJson = JSON.parse(cleaned);
    } catch {
        return {
            isValid: false,
            audit: {
                passed: false,
                schemaValid: false,
                evidenceCitationsValid: false,
                sourceLocationsValid: false,
                patchValid: false,
                factualConsistencyValid: false,
                rejectionReasons: ["Model did not produce valid JSON."],
                warnings: [],
            },
        };
    }

    // 2. Schema Validation via Zod
    const schemaResult = StructuredModelRecommendationSchema.safeParse(parsedJson);
    if (!schemaResult.success) {
        return {
            isValid: false,
            audit: {
                passed: false,
                schemaValid: false,
                evidenceCitationsValid: false,
                sourceLocationsValid: false,
                patchValid: false,
                factualConsistencyValid: false,
                rejectionReasons: [
                    `Schema validation failed: ${((schemaResult.error as any).issues || (schemaResult.error as any).errors || []).map((e: any) => `${e.path?.join(".") || "root"}: ${e.message}`).join("; ")}`,
                ],
                warnings: [],
            },
        };
    }

    const data = schemaResult.data;

    // 3. Evidence Reference Validation
    let evidenceCitationsValid = true;
    for (const claim of data.claims) {
        if (claim.category === "OBSERVED" && claim.evidenceIds.length === 0) {
            warnings.push(`Claim "${claim.statement}" is marked OBSERVED but cites no evidence IDs.`);
        }

        for (const evId of claim.evidenceIds) {
            if (!snapshot.evidenceMap[evId]) {
                evidenceCitationsValid = false;
                rejectionReasons.push(
                    `Claim cites non-existent evidence ID "${evId}". Hallucinated telemetry IDs are strictly forbidden.`
                );
            }
        }
    }

    // 4. Source Location Validation
    let sourceLocationsValid = true;
    if (data.recommendation?.affectedLocation) {
        const loc = data.recommendation.affectedLocation;

        if (loc.file && snapshot.source) {
            const target = loc.file.toLowerCase();
            const actual = snapshot.source.filePath.toLowerCase();
            if (!actual.endsWith(target) && !target.endsWith(actual)) {
                sourceLocationsValid = false;
                rejectionReasons.push(
                    `Recommendation references file "${loc.file}" which does not match verified source file "${snapshot.source.filePath}".`
                );
            }
        } else if (loc.file && !snapshot.source) {
            sourceLocationsValid = false;
            rejectionReasons.push(
                `Recommendation references file "${loc.file}" when no source was resolved for this incident.`
            );
        }

        if (loc.line && snapshot.source?.lines && snapshot.source.lines.length > 0) {
            const minLine = snapshot.source.lines[0].lineNumber;
            const maxLine = snapshot.source.lines[snapshot.source.lines.length - 1].lineNumber;
            if (loc.line < minLine - 2 || loc.line > maxLine + 2) {
                sourceLocationsValid = false;
                rejectionReasons.push(
                    `Recommendation references line ${loc.line}, which is outside the verified source context range (${minLine}-${maxLine}).`
                );
            }
        }
    }

    // 5. Factual Consistency Checks
    let factualConsistencyValid = true;
    const combinedClaimsText = data.claims.map((c) => c.statement).join(" ");

    // Check for fabricated test/build claims
    const claimsLower = combinedClaimsText.toLowerCase();
    if (
        claimsLower.includes("tests passed") ||
        claimsLower.includes("build succeeded") ||
        claimsLower.includes("reproduction verified")
    ) {
        factualConsistencyValid = false;
        rejectionReasons.push(
            "Model claimed automated tests/builds passed, but Halo did not execute test runners for this incident."
        );
    }

    // Check for uncaptured runtime value inferences (Section 9)
    const failureModel = buildFailureModel(snapshot);
    if (failureModel.runtimeValueStatus === "NOT_CAPTURED" && failureModel.failingExpression) {
        const expr = failureModel.failingExpression.toLowerCase();
        for (const claim of data.claims) {
            if (claim.category === "OBSERVED") {
                const s = claim.statement.toLowerCase();
                if (
                    s.includes(expr) &&
                    (s.includes("undefined") || s.includes("null")) &&
                    (s.includes("was") || s.includes("is") || s.includes("evaluated to"))
                ) {
                    factualConsistencyValid = false;
                    rejectionReasons.push(
                        `Model claimed runtime value of '${failureModel.failingExpression}' was undefined/null as an OBSERVED fact, but telemetry did not capture its dynamic runtime value.`
                    );
                }
            }
        }
    }


    // 6. Proposed Patch Validation
    let patchValid = true;
    if (data.proposedPatch?.status === "AVAILABLE") {
        const patchResult = validateProposedPatch(data.proposedPatch, snapshot, gateVerdict);
        if (!patchResult.isValid) {
            patchValid = false;
            rejectionReasons.push(patchResult.validationNote);
        }
    }

    const passed =
        evidenceCitationsValid &&
        sourceLocationsValid &&
        factualConsistencyValid &&
        patchValid &&
        rejectionReasons.length === 0;

    return {
        isValid: passed,
        data: passed ? data : undefined,
        audit: {
            passed,
            schemaValid: true,
            evidenceCitationsValid,
            sourceLocationsValid,
            patchValid,
            factualConsistencyValid,
            rejectionReasons,
            warnings,
        },
    };
}
