/**
 * Halo Repair Intelligence Engine — Failure Model Builder
 *
 * Constructs the deterministic, provenance-aware FailureModel from an EvidenceSnapshot.
 * Enforces Section 8 & Section 9:
 *   - Categorizes facts into KNOWN, DERIVED, SUPPORTED, UNKNOWN.
 *   - Explicitly represents uncaptured runtime values as NOT_CAPTURED (never inferred).
 */

import type { EvidenceSnapshot } from "../evidence-snapshot";
import type {
    FailureModel,
    FailureFact,
    ExecutionPathStep,
    FailureBoundary,
    RuntimeValueStatus,
} from "./types";

/**
 * Builds the canonical FailureModel from an EvidenceSnapshot.
 */
export function buildFailureModel(snapshot: EvidenceSnapshot): FailureModel {
    const anchor = snapshot.runtime.anchorError || snapshot.evidence.find(e => e.type === "ERROR");
    const frame = snapshot.runtime.primaryFailingFrame;
    const callChain = snapshot.runtime.callChain || [];
    const source = snapshot.source;

    const errorTitle = anchor?.title || "Unknown runtime failure";
    const errorMessage = anchor?.description || "";
    const service = snapshot.scope.service || anchor?.service || "unknown-service";
    const occurrenceTimestamp = snapshot.scope.anchorTimestamp || anchor?.timestamp;

    const failingFile = source?.filePath || frame?.filePath;
    const failingLineNumber = source?.failingLineNumber || frame?.lineNumber;
    const containingFunction = source?.containingFunction || frame?.functionName || snapshot.runtime.containingFunction;
    const failingExpression = source?.failingExpression || snapshot.runtime.failingExpression;
    const failingStatement =
        source?.failingStatement ||
        snapshot.runtime.failingStatement ||
        source?.lines?.find(l => l.lineNumber === failingLineNumber)?.content.trim();



    // Check if telemetry captured an explicit runtime value for the failing expression
    let runtimeValueStatus: RuntimeValueStatus = "NOT_CAPTURED";
    let runtimeValue: string | undefined = undefined;

    // Search evidence for explicit captured runtime values (e.g. from debug session, local variable capture)
    for (const ev of snapshot.evidence) {
        const payload = ((ev as any).payload || ev.metadata || (ev as any).data) as Record<string, any> | undefined;


        if (payload?.capturedVariables && failingExpression && payload.capturedVariables[failingExpression] !== undefined) {
            runtimeValueStatus = "CAPTURED";
            runtimeValue = String(payload.capturedVariables[failingExpression]);
            break;
        }
        if (payload?.evaluatedValue !== undefined && payload?.evaluatedExpression === failingExpression) {
            runtimeValueStatus = "CAPTURED";
            runtimeValue = String(payload.evaluatedValue);
            break;
        }
    }

    // Determine failure boundary
    let failureBoundary: FailureBoundary = "UNKNOWN";
    if (failingExpression) {
        if (failingExpression.includes("fetch(") || failingExpression.includes("http") || failingExpression.includes("axios")) {
            failureBoundary = "DOWNSTREAM_DEPENDENCY";
        } else if (failingExpression.includes("db.") || failingExpression.includes("prisma.") || failingExpression.includes("query(")) {
            failureBoundary = "DOWNSTREAM_DEPENDENCY";
        } else if (frame && !frame.isApplication) {
            failureBoundary = "THIRD_PARTY";
        } else if (frame?.isApplication) {
            failureBoundary = "LOCAL_FUNCTION";
        }
    } else if (frame?.isApplication) {
        failureBoundary = "LOCAL_FUNCTION";
    }

    // Build execution path
    const executionPath: ExecutionPathStep[] = [];
    if (callChain.length > 0) {
        callChain.forEach((step, idx) => {
            executionPath.push({
                step: idx + 1,
                symbol: step.functionName || "anonymous",
                file: step.filePath,
                line: step.lineNumber,
                isAnchor: idx === 0,
            });
        });
    } else if (frame) {
        executionPath.push({
            step: 1,
            symbol: frame.functionName || "anonymous",
            file: frame.filePath,
            line: frame.lineNumber,
            isAnchor: true,
        });
    }

    // Categorize facts
    const knownFacts: FailureFact[] = [];
    const derivedFacts: FailureFact[] = [];
    const supportedFacts: FailureFact[] = [];
    const unknowns: FailureFact[] = [];

    // KNOWN FACTS (directly observed in telemetry)
    if (anchor) {
        knownFacts.push({
            id: `fact-known-anchor-${anchor.id}`,
            category: "KNOWN",
            claim: `Exception '${errorTitle}' was observed in service '${service}' at ${occurrenceTimestamp ? new Date(occurrenceTimestamp).toISOString() : "unknown time"}`,
            evidenceIds: [anchor.id],
        });
    }

    if (failingFile && failingLineNumber) {
        knownFacts.push({
            id: "fact-known-location",
            category: "KNOWN",
            claim: `Execution reached '${failingFile}' at line ${failingLineNumber}${containingFunction ? ` inside function '${containingFunction}'` : ""}`,
            evidenceIds: anchor ? [anchor.id] : [],
        });
    }

    if (runtimeValueStatus === "CAPTURED" && runtimeValue !== undefined) {
        knownFacts.push({
            id: "fact-known-runtime-value",
            category: "KNOWN",
            claim: `Runtime value of '${failingExpression}' was captured as: ${runtimeValue}`,
            evidenceIds: anchor ? [anchor.id] : [],
        });
    }

    // Correlated trace / request evidence
    const relatedTraces = snapshot.evidence.filter(e => e.type === "TRACE" || (e.type as string) === "REQUEST");

    if (relatedTraces.length > 0) {
        knownFacts.push({
            id: "fact-known-traces",
            category: "KNOWN",
            claim: `Found ${relatedTraces.length} correlated trace/request events linked to this failure`,
            evidenceIds: relatedTraces.map(t => t.id),
        });
    }

    // DERIVED FACTS (deterministically computed from observed evidence)
    if (failingExpression) {
        derivedFacts.push({
            id: "fact-derived-expression",
            category: "DERIVED",
            claim: `Failing AST expression identified from source context as '${failingExpression}'`,
            evidenceIds: anchor ? [anchor.id] : [],
        });
    }

    if (failingStatement) {
        derivedFacts.push({
            id: "fact-derived-statement",
            category: "DERIVED",
            claim: `Failing statement identified as '${failingStatement}'`,
            evidenceIds: anchor ? [anchor.id] : [],
        });
    }

    if (executionPath.length > 0) {
        derivedFacts.push({
            id: "fact-derived-callchain",
            category: "DERIVED",
            claim: `Call chain reconstructed with ${executionPath.length} step(s) leading to the failure point`,
            evidenceIds: anchor ? [anchor.id] : [],
        });
    }

    // SUPPORTED FACTS (supported by hypotheses / multi-evidence correlation)
    const rootCause = snapshot.investigation.rootCause;
    if (rootCause && rootCause.evidenceIds && rootCause.evidenceIds.length > 0) {
        supportedFacts.push({
            id: `fact-supported-hypothesis-${rootCause.id}`,
            category: "SUPPORTED",
            claim: rootCause.title,
            evidenceIds: rootCause.evidenceIds,
        });
    }

    snapshot.investigation.hypotheses.forEach(h => {
        if (h.id !== rootCause?.id && h.confidence >= 0.7 && h.evidenceIds.length > 0) {
            supportedFacts.push({
                id: `fact-supported-hypothesis-${h.id}`,
                category: "SUPPORTED",
                claim: `${h.title} (confidence: ${(h.confidence * 100).toFixed(0)}%)`,
                evidenceIds: h.evidenceIds,
            });
        }
    });

    // UNKNOWNS (critical missing context that must NOT be inferred)
    if (runtimeValueStatus === "NOT_CAPTURED" && failingExpression) {
        unknowns.push({
            id: "fact-unknown-runtime-value",
            category: "UNKNOWN",
            claim: `Runtime value of '${failingExpression}' was NOT captured in telemetry`,
            evidenceIds: [],
            whyUnknownMatters: `Telemetry establishes that execution reached '${failingExpression}', but does not establish whether the value was undefined/null, or if invoking it threw an exception internally. Repair intelligence must not assume it was undefined.`,
        });
    }

    // Check for missing request body / arguments
    const hasRequestBody = snapshot.evidence.some(e => {
        const d = ((e as any).payload || e.metadata || (e as any).data) as Record<string, any> | undefined;


        return d?.requestBody || d?.arguments || d?.params;
    });
    if (!hasRequestBody) {
        unknowns.push({
            id: "fact-unknown-request-payload",
            category: "UNKNOWN",
            claim: "Invocation arguments and request payload were not captured",
            evidenceIds: [],
            whyUnknownMatters: "Cannot verify whether the failure was triggered by unexpected input parameters from upstream callers.",
        });
    }

    // Check if source code resolution is exact
    if (!source || source.resolutionStatus !== "exact_file") {
        unknowns.push({
            id: "fact-unknown-source-exactness",
            category: "UNKNOWN",
            claim: `Source code resolution is ${source?.resolutionStatus || "UNRESOLVED"}`,
            evidenceIds: [],
            whyUnknownMatters: "Cannot prove the exact historical source matches what executed in production for this release.",
        });
    }

    return {
        errorTitle,
        errorMessage,
        service,
        occurrenceTimestamp,
        failingFile,
        failingLineNumber,
        containingFunction,
        failingExpression,
        failingStatement,
        runtimeValueStatus,
        runtimeValue,
        executionPath,
        failureBoundary,
        knownFacts,
        derivedFacts,
        supportedFacts,
        unknowns,
    };
}
