/**
 * Halo Recommendation Eligibility Gate
 *
 * Deterministic gate that evaluates the Canonical Evidence Snapshot BEFORE model invocation.
 * Enforces Halo's core truth boundary:
 *   - Prohibits generating code patches without verified source and exact line bounds.
 *   - Prohibits strong causal recommendations when evidence is insufficient or contradictory.
 *   - Refuses immediately on empty intervals or unanchored incidents.
 */

import type { EvidenceSnapshot } from "../evidence-snapshot";
import type { RecommendationEligibilityVerdict } from "./types";

const PATCHABLE_EXTENSIONS = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".py",
    ".go",
    ".json",
    ".rb",
    ".rs",
    ".java",
]);

export function evaluateRecommendationEligibility(
    snapshot: EvidenceSnapshot
): RecommendationEligibilityVerdict {
    // 1. Check basic telemetry presence
    if (snapshot.counts.total === 0) {
        return {
            canGenerateRecommendation: false,
            recommendationReason:
                "Zero telemetry events were observed in the investigated incident window.",
            patchEligibility: "NOT_APPLICABLE",
            patchReason: "No telemetry exists to investigate.",
        };
    }

    // 2. Check anchor error presence
    const anchor = snapshot.runtime.anchorError;
    if (!anchor && snapshot.counts.errors === 0) {
        // Operational interval without errors
        return {
            canGenerateRecommendation: true,
            recommendationReason:
                "Operational telemetry is present, but no errors were recorded.",
            patchEligibility: "NOT_APPLICABLE",
            patchReason:
                "No errors were observed; code patch generation is not applicable.",
        };
    }

    // 3. Check for non-code / infrastructure / network errors
    const titleLower = (anchor?.title ?? "").toLowerCase();
    const isNetworkOrInfra =
        titleLower.includes("econnrefused") ||
        titleLower.includes("etimedout") ||
        titleLower.includes("dns") ||
        titleLower.includes("504 gateway") ||
        titleLower.includes("502 bad gateway") ||
        titleLower.includes("socket hang up");

    if (isNetworkOrInfra) {
        return {
            canGenerateRecommendation: true,
            recommendationReason:
                "Network or infrastructure failure observed. Operational recommendation is permitted.",
            patchEligibility: "NOT_APPLICABLE",
            patchReason:
                "Network connection and gateway errors cannot be remedied with a direct application code patch.",
        };
    }

    // 4. Evaluate Patch Eligibility
    const source = snapshot.source;
    if (!source || source.resolutionStatus !== "exact_file") {
        const reason =
            source?.unavailabilityReason ??
            "Source code could not be resolved from repository at the exact execution commit.";
        return {
            canGenerateRecommendation: true,
            recommendationReason:
                "Telemetry is sufficient for technical explanation, but source code is unavailable.",
            patchEligibility: "UNSAFE_MISSING_SOURCE",
            patchReason: reason,
        };
    }

    // Check lines and failing line number
    if (!source.lines || source.lines.length === 0 || !source.failingLineNumber || source.failingLineNumber <= 0) {
        return {
            canGenerateRecommendation: true,
            recommendationReason:
                "Source file was resolved, but failing line could not be mapped.",
            patchEligibility: "UNSAFE_MISSING_SOURCE",
            patchReason:
                "Stack trace does not contain a verified application line number in the source file.",
        };
    }

    // Check file extension
    const ext = source.filePath.slice(source.filePath.lastIndexOf(".")).toLowerCase();
    if (!PATCHABLE_EXTENSIONS.has(ext)) {
        return {
            canGenerateRecommendation: true,
            recommendationReason:
                "Telemetry and source are resolved, but file type is not supported for patch generation.",
            patchEligibility: "NOT_APPLICABLE",
            patchReason: `File extension "${ext}" is not supported for automatic patch proposal.`,
        };
    }

    // Check for ambiguous root cause or critical unknown runtime mechanism
    const leadingHypothesis = snapshot.investigation.hypotheses[0];
    if (leadingHypothesis && leadingHypothesis.status === "UNCERTAIN" && !snapshot.runtime.failingExpression) {
        return {
            canGenerateRecommendation: true,
            recommendationReason:
                "Telemetry indicates multiple competing hypotheses and exact failing expression is unobserved.",
            patchEligibility: "UNSAFE_MISSING_RUNTIME_VALUE",
            patchReason:
                "Failing runtime expression could not be deterministically resolved from AST; generating a patch would require guessing.",
        };
    }

    // All 5 prerequisites met!
    return {
        canGenerateRecommendation: true,
        recommendationReason:
            "Sufficient telemetry and exact verified source context are available.",
        patchEligibility: "CAN_GENERATE_PATCH",
        patchReason:
            `Source resolved from ${source.filePath}:${source.failingLineNumber} with verified AST expression.`,
    };
}
