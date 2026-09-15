/**
 * Halo Recommendation Engine — Repair Location Determination
 *
 * Implements Phase C (Section 12):
 * Identifies the true repair location independently from the failing line.
 * Evaluates caller, callee, producer, adapter, validation boundary, config,
 * external integration, dependency, and no-code-change.
 */

import type {
    InvestigationSnapshot,
    CausalEpistemicState,
    ContractAnalysisResult,
    DeterminedRepairLocation,
    SourceAstAnalysis,
    ReleaseRegressionContext,
} from "./types";

export function determineRepairLocation(
    snapshot: InvestigationSnapshot,
    causalState: CausalEpistemicState,
    contractAnalysis: ContractAnalysisResult,
    sourceAst: SourceAstAnalysis,
    regressionContext: ReleaseRegressionContext
): DeterminedRepairLocation {
    const excMessage = (snapshot.failure.exceptionMessage || "").toLowerCase();
    const failingFile = causalState.failureLocation.filePath;
    const failingLine = causalState.failureLocation.lineNumber;
    const failingSymbol = causalState.failureLocation.symbol;
    const failingExpr = (sourceAst.failingExpression || causalState.failureLocation.expression || "").trim();

    // 1. External / Infrastructure Outage (Case H)
    if (
        excMessage.includes("econnrefused") ||
        excMessage.includes("etimedout") ||
        excMessage.includes("504 gateway") ||
        excMessage.includes("502 bad gateway") ||
        excMessage.includes("enotfound") ||
        excMessage.includes("network error") ||
        excMessage.includes("fetch failed") ||
        excMessage.includes("socket hang up")
    ) {
        // Discover the application client file making the external call
        // The application-layer client code is the correct repair boundary for resilience changes
        const appFrames = snapshot.failure.frames.filter(f => f.isApplication && f.filePath);
        const clientFrame = appFrames.length > 0 ? appFrames[0] : undefined;
        const clientFile = clientFrame?.filePath;
        const clientSymbol = clientFrame?.functionName;

        return {
            type: "EXTERNAL_INTEGRATION",
            targetFile: clientFile,
            targetSymbol: clientSymbol,
            ownershipEstablished: true,
            rationale: clientFile
                ? `Application client code in '${clientFile}' is the repair boundary for external integration resilience. Adding retry policy, timeout, and circuit breaker handles transient network failures without requiring upstream changes.`
                : "Failure was caused by an upstream service or network infrastructure outage. Application client code (retry, timeout, circuit breaker) is the repair boundary.",
            whyNotFailingLine: clientFile
                ? `The failing socket/HTTP call is in '${clientFile}'; changing only the call signature will not prevent failures. Adding retry and circuit breaker logic makes the application resilient to transient outages.`
                : "The failing line is merely an HTTP/socket client call; changing it without retry logic would mask connectivity errors without preventing them.",
        };
    }

    // 2. Vendor / Dependency Code
    if (failingFile && (failingFile.includes("node_modules") || failingFile.includes("vendor/") || failingFile.includes(".min.js"))) {
        return {
            type: "DEPENDENCY",
            targetFile: failingFile,
            targetSymbol: failingSymbol,
            ownershipEstablished: true,
            rationale: "Failure occurred inside third-party dependency code. Modifying vendor bundles directly in production is prohibited.",
            whyNotFailingLine: "Changing third-party vendor code creates unmaintainable forks; the fix belongs in dependency version pinning or adapter wrapper.",
        };
    }

    // 3. Configuration / Environment Variable Issue (Case I)
    if (
        excMessage.includes("missing environment variable") ||
        excMessage.includes("configuration error") ||
        excMessage.includes("is not configured") ||
        excMessage.includes("missing config")
    ) {
        return {
            type: "CONFIGURATION",
            targetFile: failingFile,
            targetSymbol: failingSymbol,
            ownershipEstablished: true,
            rationale: "Failure was caused by missing or invalid configuration/environment variables rather than application code defects.",
            whyNotFailingLine: "The failing line correctly expected configuration to be present; fixing belongs in service configuration or deployment environment.",
        };
    }

    // 4. Regression Candidate Reversion / Investigation (Case F)
    if (regressionContext.stronglySupportedCandidate && regressionContext.stronglySupportedCandidate.classification === "STRONGLY_SUPPORTED_REGRESSION") {
        const cand = regressionContext.stronglySupportedCandidate;
        const candLocations: DeterminedRepairLocation["candidateLocations"] = [
            {
                type: "DEPLOYMENT",
                targetFile: failingFile,
                targetSymbol: failingSymbol,
                rationale: `Revert commit ${cand.shortSha} to restore known-good deployment state.`,
            },
        ];
        if (sourceAst.hasExactSource && failingFile) {
            candLocations.push({
                type: "CALLEE",
                targetFile: failingFile,
                targetSymbol: failingSymbol,
                rationale: `Fix regressed code directly in '${failingFile}'.`,
            });
        }
        return {
            type: "DEPLOYMENT",
            targetFile: failingFile,
            targetSymbol: failingSymbol,
            ownershipEstablished: true,
            rationale: `Commit ${cand.shortSha} ("${cand.message}") modified '${failingSymbol || failingFile}' immediately prior to the regression. Reverting or inspecting this commit restores verified pre-incident behavior.`,
            whyNotFailingLine: `The failure site at line ${failingLine || "?"} was introduced or modified by commit ${cand.shortSha}. Restoring the known-good revision is the safest immediate repair.`,
            candidateLocations: candLocations.length > 1 ? candLocations : undefined,
        };
    }

    // 5. Inspect Caller vs Callee Responsibility
    const appFrames = snapshot.failure.frames.filter((f) => f.isApplication && f.filePath);
    const failingFrameIndex = appFrames.findIndex((f) => f.filePath === failingFile);
    const callerFrame =
        failingFrameIndex >= 0 && failingFrameIndex + 1 < appFrames.length
            ? appFrames[failingFrameIndex + 1]
            : failingFrameIndex > 0
            ? appFrames[failingFrameIndex - 1]
            : appFrames.length >= 2
            ? appFrames[appFrames.length - 2]
            : undefined;
    const params = sourceAst.functionParameters || [];
    const optionalParams = sourceAst.optionalParameters || [];

    // Identify which parameter is accessed by the failing expression
    const accessedParam = params.find(
        (p) =>
            failingExpr === p ||
            failingExpr.startsWith(`${p}.`) ||
            failingExpr.startsWith(`${p}[`) ||
            failingExpr.startsWith(`${p}(`)
    );
    const accessesCallerParam = Boolean(accessedParam);

    // Case D: Callee parameter is explicitly optional or defaulted, but dereferenced without check
    if (accessedParam && optionalParams.includes(accessedParam) && sourceAst.hasExactSource && failingFile) {
        return {
            type: "CALLEE",
            targetFile: failingFile,
            targetSymbol: failingSymbol,
            lineRange: failingLine ? { start: Math.max(1, failingLine - 2), end: failingLine + 2 } : undefined,
            ownershipEstablished: true,
            contractEvidence: `Parameter '${accessedParam}' is explicitly declared optional or has default value, but was dereferenced without guard at '${failingExpr}'.`,
            rationale: `Callee '${failingSymbol}' in '${failingFile}' explicitly allows parameter '${accessedParam}' to be optional, but dereferenced it without checking. Repair belongs inside '${failingFile}'.`,
            whyNotFailingLine: `The throwing line (${failingLine || "?"}) executed an unguarded dereference on optional input; callee must handle its declared optional contract.`,
        };
    }

    // Callee with existing validation guard: Function is explicitly designed as a validation boundary
    const hasPriorGuard = sourceAst.guards.some((g) => g.isPriorToFailure);
    if (hasPriorGuard && sourceAst.hasExactSource && failingFile) {
        return {
            type: "VALIDATION_BOUNDARY",
            targetFile: failingFile,
            targetSymbol: failingSymbol,
            lineRange: failingLine ? { start: Math.max(1, failingLine - 2), end: failingLine + 2 } : undefined,
            ownershipEstablished: true,
            contractEvidence: `Function '${failingSymbol}' contains existing validation guards prior to failure site; validation boundary must be extended.`,
            rationale: `Function '${failingSymbol}' in '${failingFile}' contains validation guards, but failed to validate nested property access at line ${failingLine || "?"}.`,
            whyNotFailingLine: `The throwing line (${failingLine || "?"}) executed an unguarded property access; validation belongs with existing entrypoint guards.`,
        };
    }

    // Case B: Failing expression operates on an INTERNAL local variable or transformation
    if (params.length > 0 && !accessesCallerParam && sourceAst.hasExactSource && failingFile) {
        return {
            type: "CALLEE",
            targetFile: failingFile,
            targetSymbol: failingSymbol,
            lineRange: failingLine ? { start: Math.max(1, failingLine - 2), end: failingLine + 2 } : undefined,
            ownershipEstablished: true,
            contractEvidence: `Failing expression '${failingExpr}' operates on an internal local variable or internal transformation inside '${failingSymbol}'. Caller is not causal.`,
            rationale: `Failing expression '${failingExpr}' operates on an internal local variable or unhandled internal operation inside '${failingSymbol}'. Upstream caller '${callerFrame?.functionName || "caller"}' is on the call stack but did not supply this value.`,
            whyNotFailingLine: `The throwing line (${failingLine || "?"}) executed an unhandled operation on internal state; repair belongs inside '${failingFile}'.`,
        };
    }

    // Case A / Case E: Caller violates explicit required contract
    if (callerFrame && callerFrame.filePath && callerFrame.filePath !== failingFile && accessesCallerParam) {
        if (contractAnalysis.hasRuntimeContractViolation && contractAnalysis.calleeContract?.includes("Required")) {
            return {
                type: "CALLER",
                targetFile: callerFrame.filePath,
                targetSymbol: callerFrame.functionName,
                lineRange: callerFrame.lineNumber ? { start: callerFrame.lineNumber, end: callerFrame.lineNumber } : undefined,
                ownershipEstablished: true,
                contractEvidence: `Caller '${callerFrame.functionName}' violated documented required callee contract for parameter '${accessedParam}'.`,
                rationale: `Upstream caller '${callerFrame.functionName}' in '${callerFrame.filePath}' passed invalid/undefined argument '${accessedParam}' to '${failingSymbol}' which requires valid input.`,
                whyNotFailingLine: `Altering '${failingFile}' would mask the caller's contract violation; the fix belongs at the data producer/caller '${callerFrame.filePath}'.`,
            };
        }

        // Case C: Both caller and callee remain plausible (Ambiguous contract ownership)
        const callerCand = {
            type: "CALLER" as const,
            targetFile: callerFrame.filePath,
            targetSymbol: callerFrame.functionName,
            rationale: `Upstream caller '${callerFrame.functionName}' in '${callerFrame.filePath}' passed invalid/undefined argument '${accessedParam}' to '${failingSymbol}'.`,
        };
        const calleeCand = {
            type: "VALIDATION_BOUNDARY" as const,
            targetFile: failingFile,
            targetSymbol: failingSymbol,
            rationale: `Callee '${failingSymbol}' in '${failingFile}' lacks defensive entrypoint validation for parameter '${accessedParam}'.`,
        };

        return {
            type: "CALLER",
            targetFile: callerFrame.filePath,
            targetSymbol: callerFrame.functionName,
            lineRange: callerFrame.lineNumber ? { start: callerFrame.lineNumber, end: callerFrame.lineNumber } : undefined,
            rationale: `Contract boundary ambiguity between caller '${callerFrame.functionName}' and callee '${failingSymbol}': caller supplied invalid argument, while callee lacks entrypoint validation.`,
            whyNotFailingLine: `Applying a superficial nullish check at '${failingFile}:${failingLine || "?"}' would merely suppress the symptom. The decision requires determining whether caller contract correction or callee input validation is the intended design.`,
            isAmbiguous: true,
            ownershipEstablished: false,
            candidateLocations: [callerCand, calleeCand],
        };
    }

    // Case J: Parameter accessed, but caller is not in stack or contract ownership is unknown
    if (accessesCallerParam && sourceAst.hasExactSource && failingFile) {
        const callerCand = {
            type: "CALLER" as const,
            targetFile: undefined,
            targetSymbol: "caller/producer",
            rationale: `Ensure callers supply a valid non-null '${accessedParam}' value to '${failingSymbol}'.`,
        };
        const calleeCand = {
            type: "VALIDATION_BOUNDARY" as const,
            targetFile: failingFile,
            targetSymbol: failingSymbol,
            rationale: `Add entrypoint input validation for '${accessedParam}' in '${failingSymbol}' if nullish inputs are permissible.`,
        };

        return {
            type: "CALLEE",
            targetFile: failingFile,
            targetSymbol: failingSymbol,
            rationale: `Failure mechanism confirmed at '${failingExpr}', but ownership of the contract is unproven: repository evidence does not establish whether callers must guarantee non-null '${accessedParam}' or callee '${failingSymbol}' must provide defensive handling.`,
            whyNotFailingLine: `Adding a patch at line ${failingLine || "?"} without contract evidence risks masking producer bugs or violating caller intent.`,
            isAmbiguous: true,
            ownershipEstablished: false,
            candidateLocations: [callerCand, calleeCand],
        };
    }

    // Zero-parameter function throwing an unhandled operation inside itself
    if (params.length === 0 && sourceAst.hasExactSource && failingFile) {
        return {
            type: "CALLEE",
            targetFile: failingFile,
            targetSymbol: failingSymbol,
            lineRange: failingLine ? { start: Math.max(1, failingLine - 2), end: failingLine + 2 } : undefined,
            ownershipEstablished: true,
            rationale: `Function '${failingSymbol || "handler"}' in '${failingFile}' takes no arguments; unhandled operation is internal to this function.`,
            whyNotFailingLine: `The throwing line (${failingLine || "?"}) executed invalid operations on internal state; repair belongs inside '${failingFile}'.`,
        };
    }

    // Default: No code change justified without source or ownership
    return {
        type: "NO_CODE_CHANGE",
        ownershipEstablished: false,
        rationale: "Evidence does not currently establish a verified code modification target.",
        whyNotFailingLine: "Exact source code is unavailable or failure mechanism remains unproven.",
    };
}
