/**
 * Halo Recommendation Engine — Causal Epistemic Determination
 *
 * Implements Phase C (Section 7):
 * Strictly separates three epistemic questions:
 *   (A) WHERE did it fail? (Location)
 *   (B) WHAT failure mechanism produced the exception? (Mechanism)
 *   (C) WHY did that failure mechanism occur? (Upstream Cause)
 */

import type {
    InvestigationSnapshot,
    CausalEpistemicState,
    SourceAstAnalysis,
    ContractAnalysisResult,
    ReleaseRegressionContext,
} from "./types";

export function determineCausalEpistemicState(
    snapshot: InvestigationSnapshot,
    sourceAst: SourceAstAnalysis,
    contractAnalysis: ContractAnalysisResult,
    regressionContext: ReleaseRegressionContext
): CausalEpistemicState {
    const primaryFrame = snapshot.failure.primaryFrame;
    const source = snapshot.source;

    // (A) WHERE did it fail?
    const hasConfirmedLocation = Boolean(
        primaryFrame?.filePath &&
        primaryFrame.lineNumber &&
        source &&
        source.resolutionStatus === "exact_file"
    );

    const failureLocation: CausalEpistemicState["failureLocation"] = {
        status: hasConfirmedLocation ? "CONFIRMED" : "UNRESOLVED",
        filePath: source?.filePath || primaryFrame?.filePath,
        lineNumber: source?.failingLineNumber || primaryFrame?.lineNumber,
        symbol: source?.containingFunction || primaryFrame?.functionName,
        expression: source?.failingExpression || sourceAst.failingExpression,
        provenance: hasConfirmedLocation
            ? `Verified repository source at ${source?.filePath}:${source?.failingLineNumber}`
            : primaryFrame?.filePath
            ? `Observed in stack trace at ${primaryFrame.filePath}:${primaryFrame.lineNumber || "?"}`
            : "Stack frame location unavailable",
    };

    // (B) WHAT failure mechanism produced the exception?
    const excMessage = snapshot.failure.exceptionMessage;
    const excType = snapshot.failure.exceptionType;
    const failingExpr = sourceAst.failingExpression;

    let mechanismStatus: CausalEpistemicState["failureMechanism"]["status"] = "UNKNOWN";
    let mechanismDesc = `An unhandled ${excType} occurred (${excMessage}).`;
    let mechanismRuntimeConfirmed = false;

    if (sourceAst.hasExactSource && failingExpr) {
        if (snapshot.investigation.hypotheses.some(h => (h.status as any) === "CONFIRMED")) {
            mechanismStatus = "CONFIRMED";
            mechanismRuntimeConfirmed = true;
            const confirmedHypo = snapshot.investigation.hypotheses.find(h => (h.status as any) === "CONFIRMED");
            mechanismDesc = `${confirmedHypo?.title || "Confirmed failure mechanism"}: ${confirmedHypo?.description || excMessage}`;
        } else if (sourceAst.errorPropagation.originatesHere) {
            mechanismStatus = "CONFIRMED";
            mechanismRuntimeConfirmed = true;
            mechanismDesc = `Explicit throw statement encountered at '${failingExpr}': ${excMessage}.`;
        } else if (contractAnalysis.hasRuntimeContractViolation) {
            mechanismStatus = "CONFIRMED";
            mechanismRuntimeConfirmed = true;
            mechanismDesc = `Runtime invocation or property evaluation of '${failingExpr}' threw: ${excMessage}.`;
        } else {
            const inv = sourceAst.invocationAnalysis;
            if (inv && inv.calleeOpacity === "CALLEE_IMPLEMENTATION_AND_FAILURE_SURFACE_NARROWED") {
                mechanismStatus = "CONFIRMED";
                mechanismRuntimeConfirmed = true;
                mechanismDesc = `Concrete callee implementation identified ('${inv.calleeExpression}') and error construction matching '${excMessage}' was located in repository source.`;
            } else if (inv && inv.calleeOpacity === "CALLEE_IMPLEMENTATION_IDENTIFIED_ARGUMENTS_UNKNOWN") {
                mechanismStatus = "PLAUSIBLE";
                mechanismDesc = `Concrete callee implementation identified ('${inv.calleeExpression}'), but runtime argument values were not recorded.`;
            } else if (inv && inv.calleeOpacity === "CALLEE_OPAQUE_UNRESOLVABLE") {
                mechanismStatus = "UNKNOWN";
                mechanismDesc = `Execution reached invocation '${failingExpr}' resulting in ${excType} (${excMessage}), but callee internals or dynamic argument values were not recorded.`;
            } else if (snapshot.investigation.hypotheses.some(h => h.status === "CONFIRMED") || sourceAst.hasExactSource) {
                mechanismStatus = "CONFIRMED";
                mechanismRuntimeConfirmed = true;
                mechanismDesc = `Execution evaluated '${failingExpr}' producing ${excType}: ${excMessage}.`;
            } else {
                mechanismStatus = "PLAUSIBLE";
                mechanismDesc = `Execution reached '${failingExpr}' resulting in ${excType} (${excMessage}).`;
            }
        }
    } else if (hasConfirmedLocation) {
        mechanismStatus = "UNKNOWN";
        mechanismDesc = `Failure location is confirmed at '${failureLocation.filePath}:${failureLocation.lineNumber || "?"}', but exact failure mechanism remains unproven without verified AST expression.`;
    }

    const failureMechanism: CausalEpistemicState["failureMechanism"] = {
        status: mechanismStatus,
        description: mechanismDesc,
        isRuntimeConfirmed: mechanismRuntimeConfirmed,
        provenance: mechanismRuntimeConfirmed
            ? "Corroborated by runtime exception message and verified AST statement"
            : "Deduced from exception type and stack trace; exact mechanism unconfirmed",
    };

    // (C) WHY did that failure mechanism occur?
    let upstreamStatus: CausalEpistemicState["upstreamCause"]["status"] = "UNKNOWN";
    let upstreamDesc = "Upstream causal origin has not been conclusively established by runtime telemetry.";
    let upstreamConfirmed = false;

    if (regressionContext.stronglySupportedCandidate) {
        upstreamStatus = "REGRESSION_SUSPECTED";
        upstreamDesc = `Suspected regression: Commit ${regressionContext.stronglySupportedCandidate.shortSha} modified '${failureLocation.symbol || failureLocation.filePath}' before the incident first appeared.`;
    }

    const upstreamCause: CausalEpistemicState["upstreamCause"] = {
        status: upstreamStatus,
        description: upstreamDesc,
        isRuntimeConfirmed: upstreamConfirmed,
        provenance: regressionContext.stronglySupportedCandidate
            ? `Release regression analysis: ${regressionContext.stronglySupportedCandidate.classificationReason}`
            : "No preceding deployment or contract evidence conclusively proves the upstream origin",
    };

    return {
        failureLocation,
        failureMechanism,
        upstreamCause,
    };
}
