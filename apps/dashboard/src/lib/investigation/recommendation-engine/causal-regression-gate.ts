/**
 * Halo Recommendation Engine — Causal Regression Gate
 *
 * Implements Phase 4, Phase 6, Phase 7:
 * Runs a strict causal evaluation before rollback or direct commit repair can become
 * a recommended engineering action.
 *
 * Requirements:
 * 1. Requires evidence answering:
 *    - What changed?
 *    - Where did it execute?
 *    - What behavior changed?
 *    - What mechanism does that behavior create?
 *    - Why does that mechanism explain this occurrence?
 * 2. If mechanism is UNKNOWN:
 *    - Strictly blocks rollback / revert recommendation!
 *    - Preserves commit as association candidate only.
 * 3. Traces failure expressions (e.g. `await scenario.fn(context)`):
 *    - Callee opacity or dynamic dispatch requiring runtime arguments must NOT be
 *      blamed on the commit that modified the dispatch harness.
 */

import type {
    InvestigationSnapshot,
    ReleaseRegressionContext,
    CausalEpistemicState,
    SourceAstAnalysis,
    EvaluatedRegressionCandidate,
} from "./types";

export interface CausalRegressionGateVerdict {
    isRollbackEligible: boolean;
    promotedCandidate?: EvaluatedRegressionCandidate;
    blockingReason?: string;
    unresolvedQuestions: string[];
    decisionImpact: string;
    dynamicDispatchEvaluation?: {
        failingExpression: string;
        isDynamicDispatch: boolean;
        calleeOpacity: string;
        missingDynamicFact?: string;
    };
}

export function evaluateCausalRegressionGate(params: {
    snapshot: InvestigationSnapshot;
    regressionContext: ReleaseRegressionContext;
    causalState: CausalEpistemicState;
    sourceAst: SourceAstAnalysis;
}): CausalRegressionGateVerdict {
    const { snapshot, regressionContext, causalState, sourceAst } = params;

    const candidate =
        regressionContext.causallyProvenCandidate ||
        regressionContext.stronglySupportedCandidate ||
        regressionContext.candidates[0];

    const failingExpr =
        sourceAst.failingExpression ||
        snapshot.source?.failingExpression ||
        causalState.failureLocation.expression ||
        "";

    // Phase 6: Trace the exact failure expression
    const isDynamicDispatch = Boolean(
        failingExpr &&
        (failingExpr.includes(".fn(") ||
            failingExpr.includes(".execute(") ||
            failingExpr.includes(".run(") ||
            failingExpr.includes(".handler(") ||
            failingExpr.includes("scenario.") ||
            failingExpr.includes("callback("))
    );

    const calleeOpacity = sourceAst.invocationAnalysis?.calleeOpacity || (isDynamicDispatch ? "CALLEE_OPAQUE_UNRESOLVABLE" : "RESOLVABLE_OR_STATIC");

    const dynamicDispatchEvaluation = isDynamicDispatch
        ? {
              failingExpression: failingExpr,
              isDynamicDispatch: true,
              calleeOpacity,
              missingDynamicFact:
                  calleeOpacity === "CALLEE_OPAQUE_UNRESOLVABLE"
                      ? `Runtime scenario/callback implementation passed to '${failingExpr}'`
                      : undefined,
          }
        : undefined;

    const unresolvedQuestions: string[] = [];

    // If no candidate commits exist
    if (!candidate) {
        return {
            isRollbackEligible: false,
            unresolvedQuestions: ["No regression candidates identified in repository release history."],
            decisionImpact: "Rollback is not an applicable repair category.",
            dynamicDispatchEvaluation,
        };
    }

    // Question 1: What changed?
    if (!candidate.diffSnippet && candidate.changedFiles.length === 0) {
        unresolvedQuestions.push("Exact diff and changed AST nodes are unavailable.");
    }

    // Question 2: Where did it execute?
    if (candidate.executionRelevance !== "ACTIVE_EXECUTION_PATH_PROVEN") {
        unresolvedQuestions.push(
            `Execution relevance is '${candidate.executionRelevance || "UNKNOWN"}'; not proven to execute on the failure call path.`
        );
    }

    // Question 3: What behavior changed?
    if (candidate.behavioralRelevance === "NO_BEHAVIORAL_CHANGE" || candidate.behavioralRelevance === "UNKNOWN") {
        unresolvedQuestions.push(
            "Semantic behavioral changes to control flow, contracts, or errors have not been established."
        );
    }

    // Question 4 & 5: What mechanism does that behavior create, and does it explain this occurrence?
    const isMechanismConfirmed = causalState.failureMechanism.status === "CONFIRMED";
    if (!isMechanismConfirmed) {
        unresolvedQuestions.push(
            `Failure mechanism is '${causalState.failureMechanism.status}'; a commit cannot be identified as causal while the failure mechanism itself remains unknown.`
        );
    }

    // Dynamic dispatch guard: if failing expression is dynamic (e.g. `await scenario.fn(context)`),
    // and callee is opaque, we cannot blame the commit touching the dispatch harness!
    if (isDynamicDispatch && calleeOpacity === "CALLEE_OPAQUE_UNRESOLVABLE" && !isMechanismConfirmed) {
        unresolvedQuestions.push(
            `Failing expression '${failingExpr}' invokes dynamic callback/scenario whose concrete runtime implementation is unproven. A commit modifying the dispatch harness cannot be assumed causal.`
        );
    }

    // Check Rollback Safety Audit
    if (candidate.rollbackAudit && !candidate.rollbackAudit.auditPassed) {
        if (candidate.rollbackAudit.refusalReason) {
            unresolvedQuestions.push(candidate.rollbackAudit.refusalReason);
        }
    }

    const isRollbackEligible =
        unresolvedQuestions.length === 0 &&
        (candidate.causalSupport === "CAUSALLY_PROVEN" ||
            candidate.classification === "STRONGLY_SUPPORTED_REGRESSION" ||
            candidate.classification === "CONFIRMED_REGRESSION" ||
            Boolean((candidate as any).directlyModifiesFailingLine)) &&
        isMechanismConfirmed;

    if (isRollbackEligible) {
        candidate.causalSupport = "CAUSALLY_PROVEN";
    }

    const blockingReason = isRollbackEligible
        ? undefined
        : `Causal regression gate withheld rollback: ${unresolvedQuestions[0] || "Causality unproven"}`;

    const decisionImpact = isRollbackEligible
        ? `Commit ${candidate.shortSha} is proven causal; eligible for rollback candidate evaluation.`
        : `Commit ${candidate.shortSha} is preserved as an association candidate only; rollback cannot be recommended without causal proof.`;

    return {
        isRollbackEligible,
        promotedCandidate: isRollbackEligible ? candidate : undefined,
        blockingReason,
        unresolvedQuestions,
        decisionImpact,
        dynamicDispatchEvaluation,
    };
}
