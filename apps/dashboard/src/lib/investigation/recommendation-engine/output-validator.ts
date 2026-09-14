/**
 * Halo Deterministic Output Validator & Fact-Checker
 *
 * Implements Phases 32, 56, 65, 85, and 86:
 * Verifies LLM output against the Canonical Evidence Snapshot before any content is shown.
 * Enforces:
 *   1. Strict JSON schema validation via Zod.
 *   2. Evidence Reference Validation: Every cited evidenceId must exist in the snapshot.
 *   3. Source Location Validation: Mentioned file paths and line numbers must match verified source.
 *   4. Factual Consistency: No fabricated tests, builds, or conflicting HTTP statuses.
 *   5. Patch Validation: Diffs must apply cleanly and pass AST syntax checks.
 *   6. Anti-Placeholder Check: Strictly rejects "caller", "callee", "target file", "service".
 *   7. Anti-Symptom-Masking Check: Strictly rejects blind `?.`, `|| {}`, or empty catches when caller contract is violated.
 *   8. Unsupported Root Cause Check: Rejects database or external claims unsupported by telemetry.
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
import { analyzeContractMismatch, evaluateAntiMasking } from "../repair-intelligence/contract-mismatch-engine";

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
    const claimsLower = combinedClaimsText.toLowerCase();

    // Check for fabricated test/build claims
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

    // Check for unsupported database failure claims
    if (claimsLower.includes("database connection pool exhausted") || claimsLower.includes("database timeout")) {
        const hasDbEvidence = snapshot.evidence.some(
            (e) => (e.title && e.title.toLowerCase().includes("database")) || (e.service && e.service.toLowerCase().includes("db"))
        );
        if (!hasDbEvidence) {
            factualConsistencyValid = false;
            rejectionReasons.push(
                "Model claimed a database failure occurred, but zero database evidence was observed in the incident snapshot."
            );
        }
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

    // 6. Proposed Patch Fact-Checking
    let patchValid = true;
    if (data.proposedPatch?.status === "AVAILABLE") {
        const patchResult = validateProposedPatch(data.proposedPatch, snapshot, gateVerdict);
        if (!patchResult.isValid) {
            patchValid = false;
            rejectionReasons.push(patchResult.validationNote);
        }
    }

    // 7. Structured FixRecommendation Fact-Checking
    const fixRec = (data as any).fixRecommendation;
    if (fixRec) {
        if (Array.isArray(fixRec.evidenceReferences)) {
            for (const evId of fixRec.evidenceReferences) {
                if (!snapshot.evidenceMap[evId]) {
                    rejectionReasons.push(`Fix recommendation cites non-existent evidence ID "${evId}".`);
                    evidenceCitationsValid = false;
                }
            }
        }

        const FORBIDDEN_PLACEHOLDERS = [
            "caller",
            "callee",
            "target file",
            "the target file",
            "the relevant file",
            "target_file",
            "relevant file",
            "the service",
            "service",
            "somefunction",
        ];

        // Ensure actionAnswer and directAnswer are synchronized
        if (!fixRec.actionAnswer && fixRec.directAnswer) {
            fixRec.actionAnswer = fixRec.directAnswer;
        } else if (!fixRec.directAnswer && fixRec.actionAnswer) {
            fixRec.directAnswer = fixRec.actionAnswer;
        } else if (!fixRec.actionAnswer && fixRec.summary) {
            fixRec.actionAnswer = fixRec.summary;
            fixRec.directAnswer = fixRec.summary;
        }

        // Verify changes against actual files and source lines
        if (Array.isArray(fixRec.changes)) {
            for (const change of fixRec.changes) {
                const filePath = change.filePath || change.file;
                if (filePath) {
                    const normalized = filePath.toLowerCase().trim();

                    if (FORBIDDEN_PLACEHOLDERS.includes(normalized)) {
                        rejectionReasons.push(
                            `Recommended change uses forbidden placeholder "${filePath}" as a repository path. Placeholders are strictly forbidden.`
                        );
                        sourceLocationsValid = false;
                    }

                    const knownFiles = [
                        snapshot.source?.filePath?.toLowerCase(),
                        ...snapshot.runtime.callChain.map((c) => c.filePath?.toLowerCase()),
                    ].filter(Boolean);

                    const fileFound = knownFiles.some(
                        (kf) => kf && (kf.endsWith(normalized) || normalized.endsWith(kf))
                    );

                    if (!fileFound && knownFiles.length > 0) {
                        rejectionReasons.push(
                            `Recommended change references file "${filePath}" which was not discovered in the repository or runtime call chain.`
                        );
                        sourceLocationsValid = false;
                    }
                }

                if (change.symbol) {
                    const normSym = change.symbol.toLowerCase().trim();
                    if (FORBIDDEN_PLACEHOLDERS.includes(normSym)) {
                        warnings.push(`Symbol "${change.symbol}" resembles a placeholder name.`);
                    }
                }

                // Verify line number ranges
                if (change.startLine && snapshot.source?.lines && snapshot.source.lines.length > 0) {
                    const minLine = snapshot.source.lines[0].lineNumber;
                    const maxLine = snapshot.source.lines[snapshot.source.lines.length - 1].lineNumber;
                    if (change.startLine < minLine - 5 || change.startLine > maxLine + 5) {
                        rejectionReasons.push(
                            `Recommended change references line ${change.startLine}, which is outside the verified source context range (${minLine}-${maxLine}).`
                        );
                        sourceLocationsValid = false;
                    }
                }

                // Verify currentCode against actual source
                if (change.currentCode && snapshot.source?.lines) {
                    const fullSourceText = snapshot.source.lines.map((l) => l.content).join("\n");
                    const snippet = change.currentCode.trim();
                    if (snippet && !fullSourceText.includes(snippet)) {
                        warnings.push(
                            `Proposed currentCode in ${filePath ?? "file"} does not match exact source text. Downgrading to conceptual snippet.`
                        );
                        change.codeType = "CONCEPTUAL";
                        change.isExactSourceVerified = false;
                    } else if (snippet) {
                        change.isExactSourceVerified = true;
                    }
                }

                // Anti-symptom-masking check: Reject blind optional chaining or empty try/catch when caller contract is violated
                if (change.proposedCode) {
                    const code = change.proposedCode;
                    const calleeContent = snapshot.source?.lines ? snapshot.source.lines.map((l) => l.content).join("\n") : "";
                    const contractMismatch = analyzeContractMismatch({
                        calleeSource: snapshot.source ? { filePath: snapshot.source.filePath, content: calleeContent } : undefined,
                        failingSymbol: snapshot.runtime.containingFunction,
                        failingLine: snapshot.runtime.primaryFailingFrame?.lineNumber,
                        failingExpression: snapshot.runtime.failingExpression,
                        runtimeValueStatus: failureModel.runtimeValueStatus,
                        runtimeValue: failureModel.runtimeValue,
                        errorTitle: snapshot.runtime.anchorError?.title,
                        errorMessage: snapshot.runtime.anchorError?.description,
                    });
                    const antiMask = evaluateAntiMasking(code, contractMismatch);
                    if (antiMask.isSymptomSuppression) {
                        rejectionReasons.push(
                            `Proposed change applies defensive symptom-masking (${code.trim()}) at the callee when caller contract violation is established. Caller must be repaired.`
                        );
                        factualConsistencyValid = false;
                    }
                }
            }
        }

        // Epistemic certainty check: Prevent claiming VERY_HIGH root cause when upstream cause is unresolved
        if (
            failureModel.runtimeValueStatus === "NOT_CAPTURED" &&
            fixRec.confidence === "VERY_HIGH"
        ) {
            fixRec.confidence = "MEDIUM";
            warnings.push("Confidence downgraded from VERY_HIGH to MEDIUM because upstream dynamic values were not captured in telemetry.");
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
