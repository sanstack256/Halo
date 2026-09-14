/**
 * Halo Recommendation Eligibility & Decision Sufficiency Gate
 *
 * Implements Phases 6, 27, and 35:
 * Deterministically evaluates the Canonical Evidence Snapshot BEFORE model invocation.
 * Enforces Halo's core truth boundary:
 *   - Prohibits generating code patches without verified source and exact line bounds.
 *   - Detects underdetermined failure mechanisms (async delegate calls without runtime values)
 *     and gates off code patch generation to save LLM credits and prevent speculative fixes.
 *   - Checks source AST, call graph, and contract analysis before declaring telemetry insufficient (Phase 0.5).
 *   - Returns clear missing evidence requirements and targeted next actions before repair.
 */

import type { EvidenceSnapshot } from "../evidence-snapshot";
import type { DecisionState, RecommendationEligibilityVerdict } from "./types";
import { analyzeContractMismatch } from "../repair-intelligence/contract-mismatch-engine";
import { analyzeProtections } from "../repair-intelligence/protection-analyzer";

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

export interface DecisionSufficiencyResult {
    isSufficientForPatch: boolean;
    decisionState: DecisionState;
    reason: string;
    missingEvidence: string[];
    nextActionBeforeRepair?: string;
}

/**
 * Checks whether the failure mechanism is underdetermined.
 *
 * Phase 0.5 compliance: Before declaring telemetry insufficient, checks whether
 * source AST protections, contract mismatch analysis, or call graph evidence
 * can already explain the failure mechanism without runtime capture.
 */
export function isFailureMechanismUnderdetermined(snapshot: EvidenceSnapshot): boolean {
    const expr = snapshot.runtime?.failingExpression || snapshot.source?.failingExpression || "";
    const anchor = snapshot.runtime?.anchorError;
    const runtimeValue = anchor?.metadata?.failingValue;

    // Pattern: await invocation of delegate / callback function
    const isAsyncDelegateCall =
        expr.startsWith("await ") &&
        (expr.includes(".fn(") || expr.includes(".run(") || expr.includes(".handler(") || expr.includes(".execute("));

    // If it's not a delegate call pattern, the mechanism is not underdetermined by this check
    if (!isAsyncDelegateCall || runtimeValue !== undefined) {
        return false;
    }

    // Phase 0.5: Before declaring underdetermined, check if source AST or contract
    // analysis already explains the failure mechanism without runtime capture.
    const source = snapshot.source;
    if (source && source.resolutionStatus === "exact_file" && source.lines && source.lines.length > 0) {
        // Check if source AST protections reveal the mechanism
        const protections = analyzeProtections({
            source,
            failingLineNumber: source.failingLineNumber,
            failingExpression: source.failingExpression || expr,
            containingFunction: source.containingFunction || snapshot.runtime?.containingFunction,
        });

        // If we found guards or the protection analyzer identified the pattern, mechanism is explained
        if (protections.guards.length > 0 || protections.isSymptomSuppressionOnly) {
            return false;
        }

        // Check if contract mismatch analysis can resolve the failure mechanism
        const fullSource = source.lines.map((l) => l.content).join("\n");
        const contractAnalysis = analyzeContractMismatch({
            calleeSource: { filePath: source.filePath, content: fullSource },
            failingSymbol: source.containingFunction,
            failingLine: source.failingLineNumber,
            failingExpression: source.failingExpression || expr,
            runtimeValue: runtimeValue as string | undefined,
            runtimeValueStatus: runtimeValue !== undefined ? "CAPTURED" : "NOT_CAPTURED",
            errorTitle: anchor?.title,
            errorMessage: anchor?.metadata?.message as string | undefined,
        });

        // If contract mismatch was detected, the failure mechanism IS determined
        if (contractAnalysis.hasMismatch) {
            return false;
        }
    }

    // Investigation findings may also resolve the mechanism
    if (snapshot.investigation?.findings) {
        const hasCausalFinding = snapshot.investigation.findings.some(
            (f) => f.causalRole === "CAUSE" || f.causalRole === "TRIGGER"
        );
        if (hasCausalFinding) {
            return false;
        }
    }

    // Truly underdetermined: async delegate call with no runtime value, no AST explanation,
    // no contract mismatch, and no causal investigation finding
    return true;
}

/**
 * Evaluates decision sufficiency for generating code recommendations.
 */
export function evaluateDecisionSufficiency(snapshot: EvidenceSnapshot): DecisionSufficiencyResult {
    // 1. Zero telemetry
    if (snapshot.counts.total === 0) {
        return {
            isSufficientForPatch: false,
            decisionState: "INSUFFICIENT_EVIDENCE",
            reason: "Zero telemetry events were observed in the investigated incident window.",
            missingEvidence: ["Correlated incident telemetry events", "Execution stack trace"],
            nextActionBeforeRepair: "Ensure the service is reporting telemetry to Halo and reproduce the occurrence.",
        };
    }

    const anchor = snapshot.runtime?.anchorError || snapshot.evidence[0];
    const source = snapshot.source;

    // 2. Network / infrastructure errors
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
            isSufficientForPatch: false,
            decisionState: "EXTERNAL_DEPENDENCY_ACTION",
            reason: "Network or upstream infrastructure outage observed. Application code modification cannot resolve this.",
            missingEvidence: ["Upstream provider status page confirmation", "Network routing health telemetry"],
            nextActionBeforeRepair: "Verify upstream gateway health and external integration provider status.",
        };
    }

    // 3. Source unavailable or unmapped vendor code
    if (!source || source.resolutionStatus !== "exact_file") {
        const reason = source?.unavailabilityReason || "Source code could not be resolved from repository at the exact execution commit.";
        return {
            isSufficientForPatch: false,
            decisionState: "INSUFFICIENT_EVIDENCE",
            reason,
            missingEvidence: ["Exact repository commit source for the failing release", "Application source maps"],
            nextActionBeforeRepair: "Resolve the source commit associated with the affected release or upload production source maps.",
        };
    }

    const lowerPath = (source.filePath ?? "").toLowerCase();
    if (
        lowerPath.endsWith(".min.js") ||
        lowerPath.includes(".min.") ||
        lowerPath.includes("node_modules") ||
        lowerPath.startsWith("vendor") ||
        lowerPath.includes("/vendor")
    ) {
        return {
            isSufficientForPatch: false,
            decisionState: "EXTERNAL_DEPENDENCY_ACTION",
            reason: "Failure originated in vendor or third-party bundle; modifying vendor code is prohibited.",
            missingEvidence: ["Original unminified application caller source", "Vendor package contract documentation"],
            nextActionBeforeRepair: "Verify arguments passed into the library at the application caller boundary.",
        };
    }

    // 4. Underdetermined failure mechanism
    if (isFailureMechanismUnderdetermined(snapshot)) {
        const expr = snapshot.runtime?.failingExpression || snapshot.source?.failingExpression || "";
        const exprLabel = expr || "failing execution path";
        return {
            isSufficientForPatch: false,
            decisionState: "OBSERVABILITY_REQUIRED_BEFORE_REPAIR",
            reason: `Halo cannot prove whether '${exprLabel}' evaluated to undefined, threw an internal error, or rejected with an unhandled promise because runtime values were not captured.`,
            missingEvidence: [
                `Invocation arguments passed to '${exprLabel}'`,
                `Invocation return value or internal rejection payload from '${exprLabel}'`,
                "Caller-side state prior to invocation",
            ],
            nextActionBeforeRepair: `Reproduce the failure with targeted instrumentation around '${exprLabel}' and capture the invocation outcome before modifying production code.`,
        };
    }

    // 5. Sufficient for patch proposal
    return {
        isSufficientForPatch: true,
        decisionState: "CODE_CHANGE",
        reason: "Failure mechanism is established and exact repository source is verified.",
        missingEvidence: [],
    };
}

/**
 * Legacy compatibility wrapper for RecommendationEligibilityVerdict.
 */
export function evaluateRecommendationEligibility(
    snapshot: EvidenceSnapshot
): RecommendationEligibilityVerdict {
    if (snapshot.counts.total === 0) {
        return {
            canGenerateRecommendation: false,
            recommendationReason: "Zero telemetry events were observed in the investigated incident window.",
            patchEligibility: "NOT_APPLICABLE",
            patchReason: "No telemetry exists to investigate.",
        };
    }

    const anchor = snapshot.runtime?.anchorError || snapshot.evidence[0];
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

    const lowerPath = (source.filePath ?? "").toLowerCase();
    if (
        lowerPath.endsWith(".min.js") ||
        lowerPath.includes(".min.") ||
        lowerPath.includes("node_modules") ||
        lowerPath.startsWith("vendor") ||
        lowerPath.includes("/vendor")
    ) {
        return {
            canGenerateRecommendation: false,
            recommendationReason:
                "Source points to a vendor or unmapped minified bundle; cannot generate a safe recommendation without original author source.",
            patchEligibility: "NOT_APPLICABLE",
            patchReason: "Cannot propose patches for vendor or unmapped minified bundle.",
        };
    }

    // Check for ambiguous root cause or critical unknown runtime mechanism
    const leadingHypothesis = snapshot.investigation?.hypotheses?.[0];
    if (leadingHypothesis && leadingHypothesis.status === "UNCERTAIN" && !snapshot.runtime?.failingExpression) {
        return {
            canGenerateRecommendation: true,
            recommendationReason:
                "Telemetry indicates multiple competing hypotheses and exact failing expression is unobserved.",
            patchEligibility: "UNSAFE_MISSING_RUNTIME_VALUE",
            patchReason:
                "Failing runtime expression could not be deterministically resolved from AST; generating a patch would require guessing.",
        };
    }

    const sufficiency = evaluateDecisionSufficiency(snapshot);
    if (sufficiency.decisionState === "OBSERVABILITY_REQUIRED_BEFORE_REPAIR") {
        return {
            canGenerateRecommendation: true,
            recommendationReason: sufficiency.reason,
            patchEligibility: "UNSAFE_MISSING_RUNTIME_VALUE",
            patchReason: sufficiency.reason,
        };
    }

    if (source.filePath) {
        const ext = source.filePath.slice(source.filePath.lastIndexOf(".")).toLowerCase();
        if (!PATCHABLE_EXTENSIONS.has(ext)) {
            return {
                canGenerateRecommendation: true,
                recommendationReason: "File type is not supported for patch generation.",
                patchEligibility: "NOT_APPLICABLE",
                patchReason: `File extension "${ext}" is not supported for automatic patch proposal.`,
            };
        }
    }

    return {
        canGenerateRecommendation: true,
        recommendationReason: "Sufficient telemetry and exact verified source context are available.",
        patchEligibility: "CAN_GENERATE_PATCH",
        patchReason: `Source resolved from ${source?.filePath}:${source?.failingLineNumber} with verified AST expression.`,
    };
}
