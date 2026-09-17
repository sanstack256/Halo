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

function isHypoConfirmed(h: any): boolean {
    return Boolean(h && ((h.status as any) === "CONFIRMED" || h.status === "VALIDATED"));
}

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

    // 0. External Vendor Outage with Resilient Application Behavior (No code change)
    if (
        snapshot.failure.exceptionType?.includes("ThirdPartyOutage") ||
        excMessage.includes("stripe api is currently down") ||
        (excMessage.includes("503") && excMessage.includes("currently down"))
    ) {
        return {
            type: "NO_CODE_CHANGE",
            ownershipEstablished: true,
            rationale: "Failure was caused by an active third-party provider outage (503 Service Unavailable). Application already handles error or outage is transient; no application code changes required.",
            whyNotFailingLine: "Modifying application code during an external third-party service outage does not fix provider downtime.",
        };
    }

    // 0b. Local reproduction available in test suite
    const testFiles = (snapshot.source as any)?.testFiles as string[] | undefined;
    const testFile = testFiles?.[0];
    const isTestReproConfirmed = Boolean(
        snapshot.investigation.hypotheses.some(h =>
            isHypoConfirmed(h) && (
                h.title?.toLowerCase().includes("test suite") ||
                h.title?.toLowerCase().includes("reproduction") ||
                h.description?.toLowerCase().includes("reproduce")
            )
        )
    );
    if (isTestReproConfirmed && testFile) {
        return {
            type: "TEST",
            targetFile: testFile,
            targetSymbol: "test",
            ownershipEstablished: true,
            rationale: `Local test fixture in '${testFile}' reproduces the failure in development. Validate and debug locally against the reproducer.`,
            whyNotFailingLine: "Executing and inspecting the isolated test reproducer establishes ground truth before proposing production code changes.",
        };
    }

    // 0c. Upstream Producer Defect
    const producer = (snapshot.source as any)?.producers?.[0];
    const isProducerConfirmed = Boolean(
        producer ||
        snapshot.investigation.hypotheses.some(h =>
            h.title?.toLowerCase().includes("producer") ||
            h.description?.toLowerCase().includes("producer")
        ) ||
        snapshot.investigation.findings.some(f =>
            f.title?.toLowerCase().includes("producer")
        )
    );
    if (isProducerConfirmed) {
        const prodFile = producer?.producerFile;
        const prodSymbol = producer?.producerSymbol;
        if (prodFile) {
            return {
                type: "PRODUCER",
                targetFile: prodFile,
                targetSymbol: prodSymbol,
                ownershipEstablished: true,
                rationale: `Upstream data producer '${prodSymbol || "producer"}' in '${prodFile}' generated an invalid object structure missing required fields for the consumer.`,
                whyNotFailingLine: `The consumer in '${failingFile}' merely dereferenced the expected object; patching the consumer would mask the upstream producer defect.`,
            };
        }
    }

    // 0d. Adapter Defect
    const isAdapter = Boolean(
        failingFile?.toLowerCase().includes("adapter") ||
        failingSymbol?.toLowerCase().includes("adapt") ||
        snapshot.investigation.hypotheses.some(h =>
            h.title?.toLowerCase().includes("adapter") ||
            h.description?.toLowerCase().includes("adapter")
        )
    );
    if (isAdapter && failingFile) {
        return {
            type: "ADAPTER",
            targetFile: failingFile,
            targetSymbol: failingSymbol,
            ownershipEstablished: true,
            rationale: `Adapter boundary in '${failingFile}' incorrectly transformed payload fields between producer and consumer contracts.`,
            whyNotFailingLine: `Producer and consumer contracts are sound; the transformation mapping inside adapter '${failingSymbol || failingFile}' is the root cause.`,
        };
    }

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
    const isDependency = Boolean(
        (failingFile && (failingFile.includes("node_modules") || failingFile.includes("vendor/") || failingFile.includes(".min.js"))) ||
        snapshot.failure.exceptionType?.toLowerCase().includes("dependency") ||
        snapshot.investigation.hypotheses.some(h =>
            isHypoConfirmed(h) && (
                h.title?.toLowerCase().includes("dependency") ||
                h.description?.toLowerCase().includes("dependency")
            )
        )
    );
    if (isDependency) {
        return {
            type: "DEPENDENCY",
            targetFile: "package.json",
            targetSymbol: "dependencies",
            ownershipEstablished: true,
            rationale: "Failure occurred inside or was introduced by a third-party dependency package upgrade. Modifying application logic is prohibited; pin or revert the package version in package.json.",
            whyNotFailingLine: "Changing application code to work around a third-party library regression masks the dependency defect; the fix belongs in package version pinning.",
        };
    }

    // 3. Configuration / Environment Variable Issue (Case I)
    const isConfig = Boolean(
        excMessage.includes("missing environment variable") ||
        excMessage.includes("configuration error") ||
        excMessage.includes("is not configured") ||
        excMessage.includes("missing config") ||
        excMessage.includes("environment variable") ||
        snapshot.investigation.hypotheses.some(h =>
            isHypoConfirmed(h) && (
                h.title?.toLowerCase().includes("missing environment variable") ||
                h.description?.toLowerCase().includes("environment variable") ||
                h.title?.toLowerCase().includes("configuration defect") ||
                h.title?.toLowerCase().includes("deployment configuration") ||
                h.title?.toLowerCase().includes("deployment environment configuration") ||
                (h.title?.toLowerCase().includes("configuration") && (h.description?.toLowerCase().includes("manifest") || h.description?.toLowerCase().includes("environment variable"))) ||
                (h.description?.toLowerCase().includes("deployment") && (h.description?.toLowerCase().includes("manifest") || h.description?.toLowerCase().includes("omitted from deployment")))
            )
        )
    );
    if (isConfig) {
        const isDeploymentEnv = Boolean(
            snapshot.investigation.hypotheses.some(h =>
                h.title?.toLowerCase().includes("deployment") ||
                h.description?.toLowerCase().includes("deployment") ||
                h.description?.toLowerCase().includes("manifest") ||
                h.description?.toLowerCase().includes("code is correct")
            )
        );
        return {
            type: "CONFIGURATION",
            targetFile: isDeploymentEnv ? ".env" : (failingFile || ".env"),
            targetSymbol: failingSymbol,
            ownershipEstablished: true,
            rationale: "Failure was caused by missing or invalid configuration/environment variables rather than application code defects.",
            whyNotFailingLine: "The failing line correctly expected configuration to be present; fixing belongs in service configuration (.env) or deployment environment.",
        };
    }

    // 4. Regression Candidate Reversion / Investigation (Case F)
    const isRegressionConfirmed = Boolean(
        (regressionContext.stronglySupportedCandidate && regressionContext.stronglySupportedCandidate.classification === "STRONGLY_SUPPORTED_REGRESSION") ||
        snapshot.investigation.hypotheses.some(h =>
            isHypoConfirmed(h) && (
                h.title?.toLowerCase().includes("regression from release") ||
                h.title?.toLowerCase().includes("strongly supported regression") ||
                h.title?.toLowerCase().includes("true release regression")
            )
        )
    );
    if (isRegressionConfirmed) {
        const cand = regressionContext.stronglySupportedCandidate;
        const commitHash = cand?.shortSha || cand?.commitSha || (cand as any)?.commitHash || (cand as any)?.commit?.hash || snapshot.investigation.hypotheses.find(h => isHypoConfirmed(h))?.title?.match(/[0-9a-f]{7,40}/i)?.[0] || "";
        const candLocations: DeterminedRepairLocation["candidateLocations"] = [
            {
                type: "DEPLOYMENT",
                targetFile: failingFile,
                targetSymbol: failingSymbol,
                rationale: `Revert commit to restore known-good deployment state.`,
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
            rationale: `Release commit ${commitHash ? `${commitHash} ` : ""}modified '${failingSymbol || failingFile}' immediately prior to the regression. Reverting or inspecting this commit restores verified pre-incident behavior.`,
            whyNotFailingLine: `The failure site at line ${failingLine || "?"} was introduced or modified by the release. Restoring the known-good revision is the safest immediate repair.`,
            candidateLocations: candLocations.length > 1 ? candLocations : undefined,
        };
    }

    // 4b. Discovered Caller via AST/Hypothesis
    const registeredCaller = (snapshot.source as any)?.callers?.[0];
    const isRegisteredCallerDefect = Boolean(
        registeredCaller && (
            registeredCaller.argumentExpressions?.some((arg: string) => arg === "undefined" || arg === "null") ||
            snapshot.investigation.hypotheses.some(h =>
                isHypoConfirmed(h) && (
                    h.title?.toLowerCase().includes("scenario registry") ||
                    h.title?.toLowerCase().includes("construction omitted") ||
                    h.description?.toLowerCase().includes("scenario factory") ||
                    h.title?.toLowerCase().includes("caller") ||
                    h.description?.toLowerCase().includes("caller")
                )
            )
        )
    );
    if (isRegisteredCallerDefect && registeredCaller) {
        return {
            type: "CALLER",
            targetFile: registeredCaller.callerFile || failingFile,
            targetSymbol: registeredCaller.callerSymbol || "caller",
            lineRange: registeredCaller.callSiteLine ? { start: registeredCaller.callSiteLine, end: registeredCaller.callSiteLine } : undefined,
            ownershipEstablished: true,
            contractEvidence: `Caller '${registeredCaller.callerSymbol}' omitted required setup or parameter binding.`,
            rationale: `Upstream caller '${registeredCaller.callerSymbol}' in '${registeredCaller.callerFile || failingFile}' failed to properly initialize or pass required parameters before invoking '${failingSymbol}'.`,
            whyNotFailingLine: `The failing callee '${failingSymbol}' invoked the uninitialized handler; fixing belongs at caller '${registeredCaller.callerSymbol}'.`,
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

    // Internal Function Invariants: State Machine, Async Race, Resource Leak, Logic Defect
    const isStateMachine = Boolean(
        snapshot.failure.exceptionType?.toLowerCase().includes("state") ||
        excMessage.includes("invalid state") ||
        excMessage.includes("transition") ||
        snapshot.investigation.hypotheses.some(h =>
            isHypoConfirmed(h) && (
                h.title?.toLowerCase().includes("state") ||
                h.title?.toLowerCase().includes("fsm") ||
                h.description?.toLowerCase().includes("transition")
            )
        )
    );
    const isAsyncRace = Boolean(
        excMessage.includes("race condition") ||
        excMessage.includes("mutex") ||
        excMessage.includes("concurrent") ||
        snapshot.investigation.hypotheses.some(h =>
            isHypoConfirmed(h) && (
                h.title?.toLowerCase().includes("race") ||
                h.description?.toLowerCase().includes("race") ||
                h.description?.toLowerCase().includes("concurrent")
            )
        )
    );
    const isSerialization = Boolean(
        (snapshot.failure.exceptionType?.toLowerCase().includes("syntaxerror") && excMessage.includes("json")) ||
        excMessage.includes("unexpected token") ||
        failingExpr.includes("JSON.parse")
    );
    const isCollectionBoundary = Boolean(
        excMessage.includes("reduce of empty array") ||
        excMessage.includes("empty array") ||
        failingExpr.includes(".reduce(")
    );
    const isResourceLeak = Boolean(
        excMessage.includes("pool exhausted") ||
        excMessage.includes("client not released") ||
        excMessage.includes("connection pool") ||
        excMessage.includes("connection already released") ||
        excMessage.includes("leak") ||
        snapshot.investigation.hypotheses.some(h =>
            isHypoConfirmed(h) && (
                h.title?.toLowerCase().includes("pool") ||
                h.title?.toLowerCase().includes("leak") ||
                h.description?.toLowerCase().includes("finally")
            )
        )
    );
    const isLogicDefect = Boolean(
        failingExpr.includes("&&") ||
        failingExpr.includes("||") ||
        snapshot.investigation.hypotheses.some(h =>
            isHypoConfirmed(h) && (
                h.title?.toLowerCase().includes("logic") ||
                h.title?.toLowerCase().includes("conditional") ||
                h.title?.toLowerCase().includes("operator") ||
                h.title?.toLowerCase().includes("boolean") ||
                h.title?.toLowerCase().includes("conjunctive") ||
                h.title?.toLowerCase().includes("impossibility") ||
                h.description?.toLowerCase().includes("condition") ||
                h.description?.toLowerCase().includes("simultaneously")
            )
        )
    );

    if ((isStateMachine || isAsyncRace || isResourceLeak || isLogicDefect || isSerialization || isCollectionBoundary) && sourceAst.hasExactSource && failingFile) {
        return {
            type: "CALLEE",
            targetFile: failingFile,
            targetSymbol: failingSymbol,
            lineRange: failingLine ? { start: Math.max(1, failingLine - 2), end: failingLine + 2 } : undefined,
            ownershipEstablished: true,
            isAmbiguous: false,
            contractEvidence: `Internal function invariant violation in '${failingSymbol || failingFile}'.`,
            rationale: `Defect in internal control flow or invariant inside '${failingSymbol || failingFile}'. Caller is not causal.`,
            whyNotFailingLine: `The defect is in internal logic or lifecycle management in '${failingFile}'.`,
        };
    }

    // Case A / Case E: Caller violates explicit required contract
    if (callerFrame && callerFrame.filePath && callerFrame.filePath !== failingFile && accessesCallerParam) {
        const isCallerViolationConfirmed = Boolean(
            (contractAnalysis.hasRuntimeContractViolation && contractAnalysis.calleeContract?.includes("Required")) ||
            snapshot.investigation.hypotheses.some(h =>
                (h.title?.toLowerCase().includes("caller") || h.description?.toLowerCase().includes("caller")) &&
                (isHypoConfirmed(h) || (h as any).likelihood === "HIGH")
            ) ||
            snapshot.investigation.findings.some(f =>
                f.title?.toLowerCase().includes("caller")
            ) ||
            (snapshot.source as any)?.callers?.length > 0
        );
        if (isCallerViolationConfirmed) {
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

    if (callerFrame && callerFrame.filePath && callerFrame.filePath !== failingFile && accessesCallerParam) {

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

    // Case J: Parameter accessed, but caller is not in stack or contract ownership is unproven
    if (accessesCallerParam && sourceAst.hasExactSource && failingFile) {
        const isHypothesisConfirmed = Boolean(
            snapshot.investigation.hypotheses.some(h => isHypoConfirmed(h))
        );

        if (isHypothesisConfirmed) {
            return {
                type: "CALLEE",
                targetFile: failingFile,
                targetSymbol: failingSymbol,
                lineRange: failingLine ? { start: Math.max(1, failingLine - 2), end: failingLine + 2 } : undefined,
                ownershipEstablished: true,
                isAmbiguous: false,
                contractEvidence: `Investigation confirmed callee responsibility in '${failingSymbol || failingFile}'.`,
                rationale: `Investigation confirmed callee responsibility in '${failingSymbol || failingFile}'. Repair belongs inside '${failingFile}'.`,
                whyNotFailingLine: `The throwing line (${failingLine || "?"}) executed an unhandled operation; repair belongs inside '${failingFile}'.`,
            };
        }

        const callerCand = {
            type: "CALLER" as const,
            targetFile: undefined,
            targetSymbol: "caller/producer",
            rationale: `Ensure callers supply a valid non-null '${accessedParam}' value to '${failingSymbol}'.`,
        };
        const calleeCand = {
            type: "CALLEE" as const,
            targetFile: failingFile,
            targetSymbol: failingSymbol,
            rationale: `Add entrypoint input validation for '${accessedParam}' in '${failingSymbol}' if nullish inputs are permissible.`,
        };

        return {
            type: "CALLEE",
            targetFile: failingFile,
            targetSymbol: failingSymbol,
            rationale: `Failure mechanism confirmed at '${failingExpr}', but ownership of the contract is unproven between caller and callee.`,
            whyNotFailingLine: `The throwing line (${failingLine || "?"}) executed an unhandled property access; repair belongs at entrypoint or condition check in '${failingFile}'.`,
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
