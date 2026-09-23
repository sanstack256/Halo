import type {
    InvestigationSnapshot,
    CausalEpistemicState,
    SourceAstAnalysis,
    ContractAnalysisResult,
    ReleaseRegressionContext,
    SeparatedLocations,
    BrokenInvariant,
    DefectMechanismCause,
    CausalProofRecord,
    CodeLocation,
    InvariantClassification,
} from "./types";

export function determineCausalEpistemicState(
    snapshot: InvestigationSnapshot,
    sourceAst: SourceAstAnalysis,
    contractAnalysis: ContractAnalysisResult,
    regressionContext: ReleaseRegressionContext
): CausalEpistemicState {
    const primaryFrame = snapshot.failure.primaryFrame;
    const source = snapshot.source;

    // (A) WHERE was it observed? (Observation Location)
    const hasConfirmedLocation = Boolean(
        primaryFrame?.filePath &&
        primaryFrame.lineNumber &&
        source &&
        source.resolutionStatus === "exact_file"
    );

    const observationLocation: CodeLocation = {
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

    // Legacy failureLocation pointing to observation
    const failureLocation = { ...observationLocation };

    // (B) WHAT failure mechanism produced the exception?
    const excMessage = snapshot.failure.exceptionMessage || "";
    const excType = snapshot.failure.exceptionType || "Error";
    const failingExpr = (sourceAst.failingExpression || "").trim();

    let mechanismStatus: CausalEpistemicState["failureMechanism"]["status"] = "UNKNOWN";
    let mechanismDesc = `An unhandled ${excType} occurred (${excMessage}).`;
    let mechanismRuntimeConfirmed = false;

    // Check confirmed hypothesis first
    const confirmedHypo = snapshot.investigation.hypotheses.find(
        (h) => (h.status as any) === "CONFIRMED" || h.status === "VALIDATED"
    );

    if (confirmedHypo) {
        mechanismStatus = "CONFIRMED";
        mechanismRuntimeConfirmed = true;
        mechanismDesc = `${confirmedHypo.title}: ${confirmedHypo.description || excMessage}`;
    } else if (regressionContext.causallyProvenCandidate) {
        mechanismStatus = "CONFIRMED";
        mechanismRuntimeConfirmed = true;
        mechanismDesc = `Causally proven release regression: commit ${regressionContext.causallyProvenCandidate.shortSha} introduced failure mechanism at '${failingExpr}': ${excMessage}`;
    } else if (sourceAst.hasExactSource && failingExpr) {
        if (sourceAst.errorPropagation.originatesHere) {
            mechanismStatus = "CONFIRMED";
            mechanismRuntimeConfirmed = true;
            mechanismDesc = `Explicit throw statement encountered at '${failingExpr}': ${excMessage}.`;
        } else if (contractAnalysis.hasRuntimeContractViolation) {
            mechanismStatus = "CONFIRMED";
            mechanismRuntimeConfirmed = true;
            mechanismDesc = `Runtime invocation or property evaluation of '${failingExpr}' threw: ${excMessage}.`;
        } else if (
            excMessage.toLowerCase().includes("504") ||
            excMessage.toLowerCase().includes("502") ||
            excMessage.toLowerCase().includes("econnrefused") ||
            excMessage.toLowerCase().includes("etimedout") ||
            excMessage.toLowerCase().includes("timeout") ||
            excMessage.toLowerCase().includes("network error")
        ) {
            mechanismStatus = "CONFIRMED";
            mechanismRuntimeConfirmed = true;
            mechanismDesc = `External network/service timeout encountered during '${failingExpr}': ${excMessage}.`;
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
            } else {
                mechanismStatus = "CONFIRMED";
                mechanismRuntimeConfirmed = true;
                mechanismDesc = `Execution evaluated '${failingExpr}' producing ${excType}: ${excMessage}.`;
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

    // (C) WHY did that failure mechanism occur? (Cause)
    let upstreamStatus: CausalEpistemicState["upstreamCause"]["status"] = "UNKNOWN";
    let upstreamDesc = "Upstream causal origin has not been conclusively established by runtime telemetry.";
    let upstreamConfirmed = false;

    if (regressionContext.causallyProvenCandidate) {
        upstreamStatus = "CONFIRMED";
        upstreamConfirmed = true;
        upstreamDesc = `Causally proven release regression: Commit ${regressionContext.causallyProvenCandidate.shortSha} introduced the defect causing '${mechanismDesc}'.`;
    } else if (regressionContext.stronglySupportedCandidate) {
        upstreamStatus = "REGRESSION_SUSPECTED";
        upstreamDesc = `Suspected regression: Commit ${regressionContext.stronglySupportedCandidate.shortSha} modified '${failureLocation.symbol || failureLocation.filePath}' before the incident first appeared.`;
    }

    const upstreamCause: CausalEpistemicState["upstreamCause"] = {
        status: upstreamStatus,
        description: upstreamDesc,
        isRuntimeConfirmed: upstreamConfirmed,
        provenance: regressionContext.causallyProvenCandidate
            ? `Causally verified commit ${regressionContext.causallyProvenCandidate.shortSha}`
            : regressionContext.stronglySupportedCandidate
            ? `Release regression analysis: ${regressionContext.stronglySupportedCandidate.classificationReason}`
            : "No preceding deployment or contract evidence conclusively proves the upstream origin",
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // (D) RECONSTRUCT BROKEN INVARIANT (Rule 6)
    // ─────────────────────────────────────────────────────────────────────────────
    const msgLower = excMessage.toLowerCase();
    const typeLower = excType.toLowerCase();
    let invClassification: InvariantClassification = "precondition";
    let invDescription = "Input condition violated at invocation site.";
    let expectedCondition = "Valid input satisfying interface contract.";
    let actualViolation = excMessage;
    const invEvidenceIds: string[] = snapshot.investigation.rawEvidence.map((e) => e.id);

    // 1. External service assumption
    if (
        msgLower.includes("503") ||
        msgLower.includes("currently down") ||
        typeLower.includes("thirdpartyoutage") ||
        confirmedHypo?.title?.toLowerCase().includes("outage")
    ) {
        invClassification = "external_service_assumption";
        invDescription = "Application assumes external third-party API availability, but external service is experiencing downtime.";
        expectedCondition = "External service is operational and returning valid responses.";
        actualViolation = "External service returned 503 / unavailable.";
    }
    // 2. Resource invariant (lifecycle cleanup / leak)
    else if (
        msgLower.includes("pool exhausted") ||
        msgLower.includes("leak") ||
        msgLower.includes("not released") ||
        msgLower.includes("already disposed") ||
        failingExpr.includes(".release(") ||
        failingExpr.includes(".close(") ||
        confirmedHypo?.title?.toLowerCase().includes("resource leak") ||
        confirmedHypo?.title?.toLowerCase().includes("pool")
    ) {
        invClassification = "resource_invariant";
        invDescription = "Resources acquired during execution must be released on all normal and error exit paths.";
        expectedCondition = "Acquired resource handle is returned to pool or disposed in finally block.";
        actualViolation = "Resource handle was held or leaked across execution boundary.";
    }
    // 3. State machine transition invariant
    else if (
        msgLower.includes("invalid state") ||
        msgLower.includes("transition") ||
        typeLower.includes("statemachine") ||
        confirmedHypo?.title?.toLowerCase().includes("state")
    ) {
        invClassification = "state_invariant";
        invDescription = "State machine transitions must only proceed when required prerequisite conditions are satisfied.";
        expectedCondition = "Current state permits transition to target state.";
        actualViolation = `Invalid transition attempted (${excMessage}).`;
    }
    // 4. Concurrency / Async invariant
    else if (
        msgLower.includes("race condition") ||
        msgLower.includes("concurrent") ||
        msgLower.includes("unhandled promise") ||
        confirmedHypo?.title?.toLowerCase().includes("race") ||
        confirmedHypo?.title?.toLowerCase().includes("concurrent")
    ) {
        invClassification = "concurrency_invariant";
        invDescription = "Concurrent operations sharing mutable state must synchronize access and coordinate promise resolution.";
        expectedCondition = "Operations are sequenced or guarded against race conditions.";
        actualViolation = "Concurrent execution produced unsynchronized race or unhandled rejection.";
    }
    // 5. Configuration invariant
    else if (
        msgLower.includes("environment variable") ||
        msgLower.includes("configuration error") ||
        msgLower.includes("missing config") ||
        confirmedHypo?.title?.toLowerCase().includes("configuration") ||
        confirmedHypo?.title?.toLowerCase().includes("environment variable")
    ) {
        invClassification = "configuration_invariant";
        invDescription = "Required environment variables and service configurations must be present at startup.";
        expectedCondition = "Configuration key is set in environment or deployment manifest.";
        actualViolation = "Configuration key is undefined or missing in active environment.";
    }
    // 6. Upstream Producer / Consumer Data Invariant
    else if (
        (snapshot.source as any)?.producers?.[0] ||
        confirmedHypo?.title?.toLowerCase().includes("producer") ||
        confirmedHypo?.description?.toLowerCase().includes("producer")
    ) {
        invClassification = "data_invariant";
        invDescription = "Upstream data producer must construct and emit complete object conforming to consumer schema.";
        expectedCondition = "Producer initializes all required schema fields before passing object to consumer.";
        actualViolation = "Producer omitted required field, causing downstream dereference failure in consumer.";
    }
    // 7. Adapter Contract Invariant
    else if (
        observationLocation.filePath?.toLowerCase().includes("adapter") ||
        confirmedHypo?.title?.toLowerCase().includes("adapter")
    ) {
        invClassification = "api_contract";
        invDescription = "Adapter layer must transform external payload fields into domain model contracts without loss.";
        expectedCondition = "Adapter maps external payload keys to domain object keys.";
        actualViolation = "Adapter dropped or incorrectly transformed payload field.";
    }
    // 8. Ordering invariant (e.g. setup before invocation)
    else if (
        (snapshot.source as any)?.callers?.[0] ||
        confirmedHypo?.title?.toLowerCase().includes("setup") ||
        confirmedHypo?.title?.toLowerCase().includes("caller")
    ) {
        invClassification = "ordering_invariant";
        invDescription = "Caller must initialize and supply required arguments before invoking callee.";
        expectedCondition = "Caller provides valid non-null parameters to callee.";
        actualViolation = "Caller invoked callee without required initialization or arguments.";
    }
    // 9. Deployment Invariant
    else if (
        regressionContext.causallyProvenCandidate ||
        (confirmedHypo && (confirmedHypo.title?.toLowerCase().includes("regression from release") || confirmedHypo.title?.toLowerCase().includes("release regression")))
    ) {
        invClassification = "deployment_invariant";
        invDescription = "Production releases must preserve backward compatibility and adhere to schema contracts established in previous releases.";
        expectedCondition = "Release changes maintain backward-compatible contracts.";
        actualViolation = `Release introduced breaking change (${excMessage}).`;
    }
    // 9. Precondition (Default)
    else {
        invClassification = "precondition";
        invDescription = `Precondition for '${failingExpr || observationLocation.symbol || "operation"}' was violated.`;
        expectedCondition = `Operand '${failingExpr || "value"}' must be defined and valid prior to operation.`;
        actualViolation = excMessage;
    }

    const brokenInvariant: BrokenInvariant = {
        id: `inv_${Date.now()}`,
        classification: invClassification,
        description: invDescription,
        expectedCondition,
        actualViolation,
        governingEntity: observationLocation.symbol || observationLocation.filePath,
        evidenceIds: invEvidenceIds,
        isConfirmed: mechanismRuntimeConfirmed,
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // (E) DISTINGUISH OBSERVATION, MECHANISM, AND REPAIR LOCATIONS (Rule 3)
    // ─────────────────────────────────────────────────────────────────────────────
    const callerMeta = (snapshot.source as any)?.callers?.[0];
    const callerFileFromMeta = typeof callerMeta === "string" ? callerMeta : callerMeta?.callerFile;
    const appFrames = snapshot.failure.frames.filter((f) => f.isApplication);
    const callerFrame = appFrames.find((f) => f.filePath && f.filePath !== observationLocation.filePath);
    const effectiveCallerFile = callerFileFromMeta || callerFrame?.filePath;
    const producerMeta = (snapshot.source as any)?.producers?.[0];

    let mechanismLocation: CodeLocation = { ...observationLocation };
    let repairLocationLoc: CodeLocation = { ...observationLocation };

    if (producerMeta?.producerFile) {
        // Producer defect: mechanism and repair belong at producer
        mechanismLocation = {
            filePath: producerMeta.producerFile,
            symbol: producerMeta.producerSymbol || "producer",
            status: "CONFIRMED",
            provenance: `Upstream data producer at ${producerMeta.producerFile}`,
        };
        repairLocationLoc = { ...mechanismLocation };
    } else if (effectiveCallerFile && (invClassification === "ordering_invariant" || invClassification === "api_contract" || invClassification === "precondition")) {
        // Caller defect: mechanism and repair belong at caller
        mechanismLocation = {
            filePath: effectiveCallerFile,
            lineNumber: callerFrame?.lineNumber || callerMeta?.callSiteLine || callerMeta?.callerLineNumber,
            symbol: callerFrame?.functionName || callerMeta?.callerSymbol || "caller",
            status: "CONFIRMED",
            provenance: `Upstream caller at ${effectiveCallerFile}`,
        };
        repairLocationLoc = { ...mechanismLocation };
    } else if (invClassification === "configuration_invariant") {
        repairLocationLoc = {
            filePath: ".env",
            status: "CONFIRMED",
            provenance: "Deployment environment configuration",
        };
    } else if (invClassification === "external_service_assumption") {
        repairLocationLoc = {
            status: "CONFIRMED",
            provenance: "External third-party service",
        };
    }

    // Compute originLocation and contractViolationLocation
    const originLocation: CodeLocation = producerMeta?.producerFile
        ? {
              filePath: producerMeta.producerFile,
              lineNumber: producerMeta.producerLine,
              symbol: producerMeta.producerSymbol || "producer",
              status: "CONFIRMED",
              provenance: `Value origin at ${producerMeta.producerFile}`,
          }
        : effectiveCallerFile
        ? {
              filePath: effectiveCallerFile,
              lineNumber: callerFrame?.lineNumber || callerMeta?.callSiteLine || callerMeta?.callerLineNumber,
              symbol: callerFrame?.functionName || callerMeta?.callerSymbol || "origin",
              status: "CONFIRMED",
              provenance: `Execution origin at ${effectiveCallerFile}`,
          }
        : { ...observationLocation };

    const contractViolationLocation: CodeLocation = effectiveCallerFile
        ? {
              filePath: effectiveCallerFile,
              lineNumber: callerFrame?.lineNumber || callerMeta?.callSiteLine || callerMeta?.callerLineNumber,
              symbol: callerFrame?.functionName || callerMeta?.callerSymbol || "caller",
              status: "CONFIRMED",
              provenance: `Contract breach at ${effectiveCallerFile} calling ${observationLocation.symbol || "callee"}`,
          }
        : { ...observationLocation };

    const separatedLocations: SeparatedLocations = {
        observationLocation,
        originLocation,
        mechanismLocation,
        contractViolationLocation,
        repairLocation: repairLocationLoc,
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // (F) DEFECT vs MECHANISM vs CAUSE with EXPLICIT CAUSAL PROOF (Rules 7 & 8)
    // ─────────────────────────────────────────────────────────────────────────────
    const defectExists = Boolean(sourceAst.hasExactSource || confirmedHypo || producerMeta || callerMeta);
    const executionPathReachesDefect = Boolean(snapshot.failure.frames.length > 0);
    const stateOrValueOccurs = Boolean(snapshot.failure.exceptionMessage);
    const defectParticipated = Boolean(defectExists && executionPathReachesDefect);
    const defectCausedFailure = Boolean(defectParticipated && (mechanismRuntimeConfirmed || Boolean(confirmedHypo)));

    const causalProof: CausalProofRecord = {
        defectExists,
        defectExistsEvidence: [observationLocation.provenance],
        executionPathReachesDefect,
        executionPathEvidence: snapshot.failure.frames.map((f) => `${f.filePath}:${f.lineNumber}`),
        stateOrValueOccurs,
        stateOrValueEvidence: [excMessage],
        defectParticipated,
        defectParticipatedEvidence: [mechanismDesc],
        defectCausedFailure,
        defectCausedEvidence: [upstreamCause.provenance],
        causalChain: [
            `Defect in ${repairLocationLoc.filePath || "code"}`,
            `Execution reached ${mechanismLocation.filePath || "operation"}`,
            `Broken invariant (${invClassification}): ${actualViolation}`,
            `Failure observed at ${observationLocation.filePath}:${observationLocation.lineNumber || "?"}`,
        ],
    };

    const defectMechanismCause: DefectMechanismCause = {
        defect: {
            description: invDescription,
            location: repairLocationLoc,
            status: defectExists ? "CONFIRMED" : "SUSPECTED",
            provenance: repairLocationLoc.provenance,
        },
        mechanism: {
            description: mechanismDesc,
            location: mechanismLocation,
            status: mechanismStatus,
            provenance: failureMechanism.provenance,
        },
        cause: {
            description: upstreamDesc,
            status: upstreamStatus,
            provenance: upstreamCause.provenance,
        },
        proof: causalProof,
    };

    return {
        failureLocation,
        locations: separatedLocations,
        failureMechanism,
        brokenInvariant,
        upstreamCause,
        defectMechanismCause,
    };
}
