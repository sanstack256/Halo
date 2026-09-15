/**
 * Halo Recommendation Engine — Contract & Value Flow Analysis
 *
 * Implements Phase C (Section 13) and Enforces Section 9:
 * Traces value flow from producer to consumer without inventing contracts.
 * Strictly distinguishes STATIC CONTRACT DIFFERENCE from RUNTIME CONTRACT VIOLATION.
 */

import type { InvestigationSnapshot, ContractAnalysisResult, ValueFlowStep, SourceAstAnalysis } from "./types";

export function analyzeContractsAndValueFlow(
    snapshot: InvestigationSnapshot,
    sourceAst: SourceAstAnalysis
): ContractAnalysisResult {
    const valueFlow: ValueFlowStep[] = [];
    let hasStaticContractDifference = false;
    let hasRuntimeContractViolation = false;
    let description: string | undefined = undefined;
    let callerContract: string | undefined = undefined;
    let calleeContract: string | undefined = undefined;

    const source = snapshot.source;
    const failingExpr = sourceAst.failingExpression || source?.failingExpression;

    // 1. Trace Value Flow across the incident path
    if (snapshot.failure.primaryFrame) {
        valueFlow.push({
            role: "OPERATION",
            symbol: snapshot.failure.executingFunction,
            file: snapshot.failure.primaryFrame.filePath,
            line: snapshot.failure.primaryFrame.lineNumber,
            epistemicStatus: "OBSERVED_RUNTIME",
        });
    }

    if (failingExpr) {
        valueFlow.push({
            role: "FAILURE",
            expression: failingExpr,
            file: source?.filePath,
            line: source?.failingLineNumber,
            epistemicStatus: "STATICALLY_ESTABLISHED",
        });
    }

    // 2. Inspect whether the exception message or type demonstrates a runtime contract violation
    const excMessage = (snapshot.failure.exceptionMessage || "").toLowerCase();
    const excType = (snapshot.failure.exceptionType || "").toLowerCase();

    const isNullishAccess =
        excMessage.includes("cannot read properties of undefined") ||
        excMessage.includes("cannot read property") ||
        excMessage.includes("is not a function") ||
        excMessage.includes("null pointer") ||
        excType.includes("nullpointer") ||
        (excType.includes("typeerror") &&
            (excMessage.includes("undefined") ||
                excMessage.includes("null") ||
                excMessage.includes("is not a function") ||
                excMessage.includes("reading")));

    if (isNullishAccess && failingExpr) {
        // Runtime failure observed at property access or call
        hasRuntimeContractViolation = true;
        description = `Runtime value accessed by '${failingExpr}' violated the expected contract (nullish or non-callable).`;
        calleeContract = `Expected non-nullish object or callable value for '${failingExpr}'`;
    }


    // Check if investigation hypotheses or findings established caller contract mismatch
    const isCallerContractMismatch = Boolean(
        snapshot.investigation.hypotheses.some(
            (h) =>
                h.title?.toLowerCase().includes("contract") ||
                h.title?.toLowerCase().includes("caller") ||
                h.description?.toLowerCase().includes("contract") ||
                h.description?.toLowerCase().includes("caller") ||
                (h as any).explanation?.toLowerCase().includes("caller")
        ) ||
        snapshot.investigation.findings.some(
            (f) =>
                f.title?.toLowerCase().includes("contract") ||
                f.title?.toLowerCase().includes("caller") ||
                f.description?.toLowerCase().includes("contract") ||
                f.description?.toLowerCase().includes("caller")
        )
    );

    if (isCallerContractMismatch) {
        hasRuntimeContractViolation = true;
        callerContract = "Caller omitted or supplied invalid required parameter";
        calleeContract = calleeContract ? `${calleeContract} (Required parameter)` : "Required parameter";
    }

    // 3. Inspect if source code has runtime parameter validation
    if (sourceAst.guards.length > 0) {
        hasStaticContractDifference = true;
        const priorGuards = sourceAst.guards.filter((g) => g.isPriorToFailure);
        if (priorGuards.length > 0) {
            callerContract = callerContract || `Guarded by: ${priorGuards.map((g) => g.expression).join(", ")}`;
        }
    }

    return {
        hasStaticContractDifference,
        hasRuntimeContractViolation,
        description,
        callerContract,
        calleeContract,
        valueFlow,
    };
}

export const analyzeContractViolations = analyzeContractsAndValueFlow;
