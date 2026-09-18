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
    isCausallyValid: boolean;
    isRollbackSuperior: boolean;
    superiorityRationale?: string;
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

    // If no candidate commits exist
    if (!candidate) {
        return {
            isRollbackEligible: false,
            isCausallyValid: false,
            isRollbackSuperior: false,
            unresolvedQuestions: ["No regression candidates identified in repository release history."],
            decisionImpact: "Rollback is not an applicable repair category.",
            dynamicDispatchEvaluation,
        };
    }

    const causalityQuestions: string[] = [];

    // Question 1: What changed?
    if (!candidate.diffSnippet && candidate.changedFiles.length === 0) {
        causalityQuestions.push("Exact diff and changed AST nodes are unavailable.");
    }

    // Question 2: Where did it execute?
    const executesOnFailurePath =
        candidate.executionRelevance === "ACTIVE_EXECUTION_PATH_PROVEN" ||
        Boolean((candidate as any).directlyModifiesFailingLine) ||
        Boolean(candidate.modifiesFailingFile);

    if (!executesOnFailurePath) {
        causalityQuestions.push(
            `Execution relevance is '${candidate.executionRelevance || "UNKNOWN"}'; not proven to execute on the failure call path.`
        );
    }

    // Question 3: What behavior changed?
    const hasBehavioralChange =
        candidate.behavioralRelevance === "CONTROL_FLOW_ALTERED" ||
        candidate.behavioralRelevance === "RETURN_VALUE_ALTERED" ||
        candidate.behavioralRelevance === "CONTRACT_ALTERED" ||
        candidate.behavioralRelevance === "RESOURCE_LIFECYCLE_ALTERED" ||
        candidate.behavioralRelevance === "ERROR_HANDLING_ALTERED" ||
        candidate.behavioralRelevance === "CONFIGURATION_ALTERED" ||
        Boolean((candidate as any).directlyModifiesFailingLine) ||
        candidate.classification === "STRONGLY_SUPPORTED_REGRESSION" ||
        candidate.classification === "CONFIRMED_REGRESSION";

    if (!hasBehavioralChange) {
        causalityQuestions.push(
            "Semantic behavioral changes to control flow, contracts, or errors have not been established."
        );
    }

    // Question 4 & 5: What mechanism does that behavior create, and does it explain this occurrence?
    const isMechanismConfirmed = causalState.failureMechanism.status === "CONFIRMED";
    if (!isMechanismConfirmed) {
        causalityQuestions.push(
            `Failure mechanism is '${causalState.failureMechanism.status}'; a commit cannot be identified as causal while the failure mechanism itself remains unknown.`
        );
    }

    // Dynamic dispatch guard: if failing expression is dynamic (e.g. `await scenario.fn(context)`),
    // and callee is opaque, we cannot blame the commit touching the dispatch harness!
    if (isDynamicDispatch && calleeOpacity === "CALLEE_OPAQUE_UNRESOLVABLE" && !isMechanismConfirmed) {
        causalityQuestions.push(
            `Failing expression '${failingExpr}' invokes dynamic callback/scenario whose concrete runtime implementation is unproven. A commit modifying the dispatch harness cannot be assumed causal.`
        );
    }

    const isCausallyValid =
        causalityQuestions.length === 0 &&
        (candidate.causalSupport === "CAUSALLY_PROVEN" ||
            candidate.classification === "STRONGLY_SUPPORTED_REGRESSION" ||
            candidate.classification === "CONFIRMED_REGRESSION" ||
            Boolean((candidate as any).directlyModifiesFailingLine)) &&
        isMechanismConfirmed;

    if (isCausallyValid) {
        candidate.causalSupport = "CAUSALLY_PROVEN";
    }

    // Phase 14 & 15: Dual-Gate Rollback — Safety & Superiority Gate
    let isRollbackSuperior = false;
    let superiorityRationale: string | undefined;
    const unresolvedQuestions = [...causalityQuestions];

    if (!isCausallyValid) {
        isRollbackSuperior = false;
        superiorityRationale = `Commit ${candidate.shortSha} is not proven causal; rollback is disqualified.`;
    } else {
        const audit = candidate.rollbackAudit;
        const blastRadiusHigh = audit?.unrelatedChangesBlastRadius === "HIGH";
        const hasDataMigration = Boolean((audit as any)?.migrationOrDataImplications);
        const doesNotRemoveBehavior = audit?.rollbackRemovesBehavior === false;

        if (blastRadiusHigh || hasDataMigration || doesNotRemoveBehavior) {
            isRollbackSuperior = false;
            const reasons: string[] = [];
            if (blastRadiusHigh) reasons.push("it contains unrelated changes with high blast radius");
            if (hasDataMigration) reasons.push("it involves database migrations requiring manual data remediation");
            if (doesNotRemoveBehavior) reasons.push("reverting does not eliminate the defect at the failure site");
            if (audit?.refusalReason && !reasons.some(r => audit.refusalReason!.includes(r))) {
                reasons.push(audit.refusalReason);
            }

            superiorityRationale = `Commit ${candidate.shortSha} is causally proven, but broad rollback is disqualified because ${reasons.join(" and ")}. Prefer targeted repair.`;
            if (audit?.refusalReason && !unresolvedQuestions.includes(audit.refusalReason)) {
                unresolvedQuestions.push(audit.refusalReason);
            }
        } else {
            isRollbackSuperior = true;
            superiorityRationale = `Rollback of commit ${candidate.shortSha} is safe, clean, and directly restores the known good invariant without adverse blast radius.`;
        }
    }

    const isRollbackEligible = isCausallyValid && isRollbackSuperior;

    const blockingReason = isRollbackEligible
        ? undefined
        : `Causal regression gate withheld rollback: ${unresolvedQuestions[0] || superiorityRationale || "Causality or rollback superiority unproven"}`;

    const decisionImpact = isRollbackEligible
        ? `Commit ${candidate.shortSha} is proven causal and rollback is superior; eligible for rollback candidate evaluation.`
        : isCausallyValid
        ? `Commit ${candidate.shortSha} is proven causal, but broad rollback has excessive blast radius; targeted repair is superior.`
        : `Commit ${candidate.shortSha} is preserved as an association candidate only; rollback cannot be recommended without causal proof.`;

    return {
        isRollbackEligible,
        isCausallyValid,
        isRollbackSuperior,
        superiorityRationale,
        promotedCandidate: isCausallyValid ? candidate : undefined,
        blockingReason,
        unresolvedQuestions,
        decisionImpact,
        dynamicDispatchEvaluation,
    };
}

