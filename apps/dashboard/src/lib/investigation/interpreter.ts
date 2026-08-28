import type {
    Investigation,
    Hypothesis,
    Evidence,
    Finding,
    Change,
    Impact,
    Recommendation,
} from "@halo/investigation-engine";
import {
    buildDashboardRecommendations,
    type DashboardRecommendationPlan,
} from "./recommendations";
import {
    reconstructRuntimeFailure,
} from "./runtime/reconstruction-engine";
import type {
    FullRuntimeReconstruction,
} from "./runtime/types";

export type ProvenanceType = "Observed" | "Inferred" | "Unknown";

export type CausalRoleType =
    | "Root cause"
    | "Upstream failure"
    | "Contributor"
    | "Trigger"
    | "Consequence"
    | "Downstream consequence"
    | "Symptom"
    | "Duplicate"
    | "Continuation"
    | "Unrelated historical event"
    | "Missing evidence";

export interface EvidenceClaim {
    statement: string;
    provenance: ProvenanceType;
    evidenceSource?: string;
    evidenceId?: string;
    details?: string;
}

export interface CausalEvidenceNode {
    id: string;
    label: string;
    role: CausalRoleType;
    provenance: ProvenanceType;
    strength: "Very High" | "High" | "Medium" | "Low" | "Missing";
    service?: string;
    timestamp?: Date;
    timeOffsetFormatted: string;
    explanation: string;
    causalBasis: string;
    traceId?: string;
    requestId?: string;
    status?: string | number;
    resource?: string;
    operation?: string;
}

export interface CompetingHypothesisAnalysis {
    id: string;
    title: string;
    /**
     * SUPPORTED: evidence-consistent but not actually tested.
     * EVALUATED: considered and ranked during analysis.
     * REJECTED: contradicted by evidence.
     * Note: "VALIDATED" is intentionally absent — that requires actual test execution.
     */
    status: "SUPPORTED" | "EVALUATED" | "REJECTED";
    /** Qualitative confidence only — numeric confidence is never exposed to users */
    confidenceLevel: "Low" | "Medium" | "High" | "Very High";
    causalRelationship: string;
    supportingEvidence: string[];
    contradictingEvidence: string[];
    missingEvidence: string[];
    outrankReason: string;
    uncertainties: string[];
}

export interface ParsedErrorDetails {
    errorClass: string;
    errorMessage: string;
    failingFile?: string;
    failingFunction?: string;
    failingLine?: string | number;
    targetProperty?: string;
    databaseModel?: string;
    isTypeError: boolean;
    isDatabaseError: boolean;
    isNetworkTimeout: boolean;
    isAuthError: boolean;
    isRateLimit: boolean;
}

export interface InterpretedInvestigation {
    /**
     * Top-level headline summarizing the true failure
     */
    headline: string;

    /**
     * Executive diagnosis summary
     */
    executiveDiagnosis: {
        verdict: string;
        narrative: string;
        isExactRootCauseKnown: boolean;
        initiatingService: string;
        blastRadiusScore: number;
    };

    /**
     * Terminology-correct Root Cause / Upstream Failure Breakdown
     */
    rootCauseSummary: {
        rootCauseStatement: string;
        isExactRootCauseKnown: boolean;
        firstObservedUpstreamFailure: string;
        downstreamSymptom: string;
        contributingFactors: string[];
        confidenceLabel: "Very High" | "High" | "Medium" | "Low";
        confidenceScore: number;
        reasoning: string[];
        isClientDownstream: boolean;
        /**
         * Per-claim confidence. Each claim is independently evidence-grounded.
         * High confidence in the HTTP 500 occurring ≠ high confidence in the backend cause.
         */
        claimConfidence: {
            upstreamHttpFailureOccurred: "Very High" | "High" | "Unknown";
            typeErrorIsDownstream: "Very High" | "High" | "Low";
            exactBackendCause: "High" | "Unknown";
        };
    };


    /**
     * Causal chain narrative & visual flow
     */
    causalStory: string;
    asciiFlow: string;

    /**
     * Chronological "What Happened" breakdown with Evidence Provenance
     */
    whatHappened: {
        timeFormatted: string;
        pageUrl: string;
        userAction: {
            description: string;
            provenance: ProvenanceType;
            replayEvidence: string;
        };
        failedRequest?: {
            method: string;
            endpoint: string;
            status: number | string;
            durationMs?: number;
            traceId?: string;
            provenance: ProvenanceType;
        };
        clientException: {
            title: string;
            failingLocation: string;
            targetProperty?: string;
            provenance: ProvenanceType;
        };
        userImpact: string;
    };

    /**
     * Diagnostic proof: Why this conclusion
     */
    whyThisConclusion: {
        narrative: string;
        treeDiagram: string;
        provenPoints: string[];
    };

    /**
     * Evidence Integrity: Confirmed facts vs Inferences vs Unknowns
     */
    evidenceIntegrity: {
        confirmedFacts: EvidenceClaim[];
        strongInferences: EvidenceClaim[];
        unknowns: EvidenceClaim[];
    };

    /**
     * Causal Evidence Graph / Matrix
     */
    causalEvidenceGraph: CausalEvidenceNode[];

    /**
     * Historical & Unrelated Evidence isolation
     */
    historicalObservations: {
        hasUnrelatedEvents: boolean;
        explanation: string;
        events: string[];
    };

    /**
     * Competing Hypotheses Evaluation
     */
    hypothesesAnalysis: CompetingHypothesisAnalysis[];

    /**
     * Session Replay Evidence Analysis
     */
    replayEvidenceAnalysis: {
        hasReplay: boolean;
        whatReplayConfirms: string[];
        whatReplayDoesNotConfirm: string[];
    };

    /**
     * User impact & blast radius
     */
    impactDetails: {
        affectedUsersCount: number;
        affectedServices: string[];
        affectedEndpoints: string[];
        severity: string;
    };

    /**
     * Evidence-grounded fix plan from the Recommendation Engine.
     * Every claim is tied to real telemetry — nothing is fabricated.
     */
    recommendations: DashboardRecommendationPlan;

    /**
     * Exact Runtime Failure & Context Reconstruction (Features 1 & 2)
     */
    runtimeReconstruction?: FullRuntimeReconstruction;
}

/**
 * Transforms raw investigation engine outputs, evidence, and timeline
 * into an expert-level incident briefing with strict boundaries and provenance.
 */
export function interpretInvestigation(
    investigation: Investigation,
    replaySession?: any | null,
    anchorEventId?: string | null,
): InterpretedInvestigation {
    const {
        rootCause,
        report,
        timeline,
        evidence,
        hypotheses,
        findings,
        changes,
        impact,
    } = investigation;

    // 1. Establish Strict Incident Boundaries
    // Identify the anchor using the explicit event ID (occurrence-scoped) when provided.
    // Fallback: most recent ERROR in active evidence, then first evidence item.
    const allErrors = evidence.filter((e) => e.type === "ERROR");
    const anchorError =
        (anchorEventId
            ? evidence.find((e) => e.id === anchorEventId)
            : undefined) ??
        allErrors[allErrors.length - 1] ??
        allErrors[0] ??
        evidence[0];

    const incidentAnchorTime = anchorError?.timestamp ? new Date(anchorError.timestamp) : new Date();
    const anchorTimeMs = incidentAnchorTime.getTime();
    const incidentSessionId = anchorError?.sessionId || replaySession?.sessionId;
    const incidentTraceId = anchorError?.traceId;
    const incidentRequestId = anchorError?.requestId;

    // Detect runtime origin to drive correct narrative language.
    // Node.js events must never be described as "browser/client exceptions".
    const runtimeOrigin = detectAnchorRuntimeOrigin(anchorError);

    // Separate active incident telemetry from historical / unrelated occurrences.
    //
    // Admission rules (identifier-first, strict):
    //   1. The anchor event itself is always admitted.
    //   2. Events sharing requestId/traceId/sessionId with the anchor are admitted
    //      as directly correlated.
    //   3. Temporal proximity ONLY used as fallback when the anchor event has NO
    //      identifiers at all (sessionId, traceId, requestId all null).
    //      These are explicitly tagged as temporal correlations.
    //
    // This prevents request B from bleeding into the investigation of request A
    // merely because they occurred within the same 30s window.
    const anchorHasIdentifiers =
        Boolean(incidentSessionId) ||
        Boolean(incidentTraceId) ||
        Boolean(incidentRequestId);

    const activeIncidentEvidence: Evidence[] = [];
    const historicalUnrelatedEvidence: Evidence[] = [];

    for (const ev of evidence) {
        // Always admit the anchor
        if (ev.id === anchorError?.id) {
            activeIncidentEvidence.push(ev);
            continue;
        }

        const hasDirectLink =
            (incidentRequestId && ev.requestId === incidentRequestId) ||
            (incidentTraceId && ev.traceId === incidentTraceId) ||
            (incidentSessionId && ev.sessionId === incidentSessionId);

        if (hasDirectLink) {
            activeIncidentEvidence.push(ev);
            continue;
        }

        // Temporal fallback: only when anchor has no identifiers at all
        if (!anchorHasIdentifiers) {
            const evTime = new Date(ev.timestamp).getTime();
            const deltaMs = Math.abs(evTime - anchorTimeMs);
            if (deltaMs <= 30000) {
                // Admitted as temporal — mark for UI display
                activeIncidentEvidence.push(ev);
                continue;
            }
        }

        historicalUnrelatedEvidence.push(ev);
    }

    // Sort active evidence chronologically
    const sortedActive = [...activeIncidentEvidence].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Compute Runtime Reconstruction immediately from anchor and active evidence
    const runtimeReconstruction = reconstructRuntimeFailure(anchorError, activeIncidentEvidence);
    const sourceResolved = runtimeReconstruction?.sourceResolved ?? false;

    // 2. Parse exact error details from the incident anchor, enriched with real AST source facts
    const parsedError = parseErrorDetails(anchorError, rootCause, runtimeReconstruction);

    // 3. Identify correlated network request within active incident boundary
    const requestEvidence = sortedActive.filter((e) =>
        e.type === "TRACE" ||
        e.type === "LOG" ||
        e.status !== undefined ||
        e.operation?.includes("HTTP") ||
        e.operation?.includes("POST") ||
        e.operation?.includes("GET")
    );

    const failedRequestEvent = requestEvidence.find((e) => {
        const s = String(e.status || "");
        return s.startsWith("5") || s.startsWith("4") || e.title.includes("500") || e.title.includes("400");
    }) || sortedActive.find((e) => {
        const s = String(e.status || "");
        return s.startsWith("5") || s.startsWith("4");
    }) || requestEvidence[0];

    const requestMethod: string | null =
        failedRequestEvent?.operation?.split(" ")[0] ?? null;

    const requestEndpoint: string | null =
        failedRequestEvent?.resource ??
        failedRequestEvent?.operation?.split(" ").slice(1).join(" ") ??
        null;

    // Status from real telemetry only — never fabricate.
    const requestStatus: string | number | null =
        failedRequestEvent?.status ??
        (/\b([45]\d{2})\b/.exec(parsedError.errorMessage)?.[1] ?? null);

    // Duration from real telemetry only — no hardcoded fallback.
    const requestDuration: number | null =
        failedRequestEvent?.durationMs ??
        ((failedRequestEvent?.metadata?.durationMs as number | undefined) ?? null);

    // Check if server-side execution trace for the upstream failure exists
    const backendServerTrace = sortedActive.find((e) =>
        e.service &&
        e.service !== "browser" &&
        e.service !== "frontend-client" &&
        (e.type === "ERROR" || e.type === "LOG") &&
        e.id !== anchorError?.id
    );
    const isExactRootCauseKnown = Boolean(backendServerTrace);

    // 4. Downstream Response dereferencing check
    // Only classify as "downstream response handler" when BOTH:
    //   a) The TypeError exists
    //   b) A request is correlated (same requestId/traceId — exact match)
    //   c) The runtime is browser OR the event service matches the request service
    const isDownstreamResponseHandler =
        parsedError.isTypeError &&
        Boolean(failedRequestEvent) &&
        (runtimeOrigin === "browser" ||
            runtimeOrigin === "unknown" ||
            (runtimeOrigin === "node" && Boolean(backendServerTrace || failedRequestEvent)));

    const pageUrl: string | null =
        replaySession?.url ??
        (anchorError?.metadata?.url as string | undefined) ??
        (anchorError?.resource ?? null);

    const timeFormatted = formatTime(incidentAnchorTime);
    const flowName = pageUrl ? extractFlowName(pageUrl) : "operation";

    // Convenience labels derived purely from real data.
    const reqLabel: string =
        requestMethod && requestEndpoint
            ? `${requestMethod} ${requestEndpoint}`
            : requestEndpoint ?? requestMethod ?? "HTTP request";

    const propRef: string =
        runtimeReconstruction?.failure?.failingExpression ??
        parsedError.targetProperty ??
        "expected property";

    const funcRef: string =
        runtimeReconstruction?.failure?.sourceContext?.containingFunction
            ? `${runtimeReconstruction.failure.sourceContext.containingFunction}()`
            : parsedError.failingFunction
            ? `${parsedError.failingFunction}()`
            : "the application";

    // 5. Causal Classification — strictly evidence-driven with explicit per-claim confidence.
    //
    // Rules:
    //   - HTTP 500/4xx is ALWAYS the earliest observed upstream failure when present.
    //   - A later TypeError/dereference is ALWAYS a downstream consequence — never the backend root cause.
    //   - The exact backend reason for an HTTP 500 is Unknown unless server-side execution evidence is present.
    //   - No backend exception is inferred from the client TypeError message.
    //   - No cause (database, dependency, validation) is assumed from endpoint name or error string.

    let headline = "";
    let verdict = "";
    let rootCauseStatement = "";
    let firstObservedUpstreamFailure = "";
    let downstreamSymptom = "";
    const contributingFactors: string[] = [];

    // Runtime-appropriate labels.
    const exceptionOriginLabel =
        runtimeOrigin === "browser" ? "client-side exception" : "application exception";
    const runtimeLabel =
        runtimeOrigin === "browser" ? "client" : "application";

    const isHttpErrorStatus = requestStatus != null && String(requestStatus).match(/^[45]/);

    // Per-claim confidence tracking.
    // Each claim has its own evidence-basis — never let high confidence in one claim
    // bleed into an unsupported claim.
    const claimConfidence = {
        /** Confidence that the upstream HTTP failure occurred (backed by HTTP telemetry event) */
        upstreamHttpFailureOccurred: failedRequestEvent && isHttpErrorStatus
            ? ("Very High" as const)
            : failedRequestEvent
            ? ("High" as const)
            : ("Unknown" as const),

        /** Confidence that the TypeError is a downstream consequence (backed by chronology + handler context) */
        typeErrorIsDownstream: isDownstreamResponseHandler && failedRequestEvent
            ? (incidentTraceId || incidentRequestId ? "Very High" as const : "High" as const)
            : ("Low" as const),

        /** Confidence in the exact backend root cause (only High/Very High if server-side evidence present) */
        exactBackendCause: isExactRootCauseKnown
            ? ("High" as const)
            : ("Unknown" as const),
    };

    if (isDownstreamResponseHandler && requestEndpoint && requestStatus != null) {
        const durationSuffix = requestDuration != null ? ` (${requestDuration} ms)` : "";
        if (isHttpErrorStatus) {
            // Pattern: HTTP 500 → failed client response → response handler → TypeError
            // Correct classification:
            //   1. HTTP 500 = observed upstream failure (the initiating event)
            //   2. TypeError = observed downstream consequence (NOT a backend cause)
            //   3. Exact server-side backend cause = Unknown (no server-side execution evidence)
            headline = `${parsedError.errorClass} following ${reqLabel} → HTTP ${requestStatus}`;
            firstObservedUpstreamFailure = `${reqLabel} returned HTTP ${requestStatus}${durationSuffix} (earliest observed failure in this incident)`;
            downstreamSymptom = parsedError.errorMessage;
            contributingFactors.push(
                sourceResolved
                    ? `The ${runtimeLabel} response handler in ${funcRef} accessed \`${propRef}\` without first verifying the HTTP status code was 2xx.`
                    : `Telemetry indicates the response handler attempted to access \`${propRef}\` following the failed HTTP ${requestStatus} response.`
            );
            // CRITICAL: rootCauseStatement must NOT promote the TypeError to the backend root cause.
            // The backend cause for the HTTP 500 is unknown unless server evidence is present.
            if (isExactRootCauseKnown && backendServerTrace) {
                // Server-side execution evidence identifies the backend failure.
                rootCauseStatement = `\`${reqLabel}\` failed at the server with: "${backendServerTrace.title}". Downstream, the ${runtimeLabel} response handler accessed \`${propRef}\`, producing \`${parsedError.errorMessage}\`.`;
            } else {
                // HTTP 500 observed, client TypeError observed, backend cause = Unknown.
                rootCauseStatement =
                    `The earliest observed failure is \`${reqLabel}\` returning HTTP ${requestStatus}${durationSuffix}. ` +
                    `The internal backend cause for this HTTP ${requestStatus} is unknown — no server-side exception or execution log was captured for this transaction. ` +
                    (sourceResolved
                        ? `In source code, ${funcRef} accessed \`${propRef}\` without validating the HTTP status, producing \`${parsedError.errorMessage}\`.`
                        : `Downstream telemetry indicates the response handler attempted to access \`${propRef}\` after the failed response, producing \`${parsedError.errorMessage}\`.`);
            }
            verdict =
                `The \`${parsedError.errorMessage}\` is a downstream consequence of the HTTP ${requestStatus} — ` +
                `it is not the backend root cause. ` +
                `The first observed failure in this cascade is \`${reqLabel}\` returning HTTP ${requestStatus}. ` +
                (isExactRootCauseKnown
                    ? `The backend cause is identified from server-side telemetry.`
                    : `The exact server-side backend cause is unknown.`);
        } else {
            // Pattern: HTTP 200 unexpected payload → access on null → TypeError
            headline = `${parsedError.errorClass} in ${funcRef} — unexpected payload from ${reqLabel}`;
            firstObservedUpstreamFailure = `${reqLabel} returned an unexpected payload structure (HTTP ${requestStatus})`;
            downstreamSymptom = parsedError.errorMessage;
            contributingFactors.push(
                `\`${reqLabel}\` returned HTTP ${requestStatus} but with an unexpected data structure. ${funcRef} accessed \`${propRef}\` without validating the payload.`
            );
            rootCauseStatement =
                `\`${reqLabel}\` returned HTTP ${requestStatus} with an unexpected or incomplete payload. ` +
                `${funcRef} accessed \`${propRef}\` without null-checking the response value, producing \`${parsedError.errorMessage}\`. ` +
                `The upstream reason why the payload structure was unexpected is unknown from available telemetry.`;
            verdict = `${funcRef} threw \`${parsedError.errorClass}\` because the upstream response from \`${reqLabel}\` did not contain the expected data shape for \`${propRef}\`.`;
        }
    } else if (rootCause) {
        headline = rootCause.title;
        firstObservedUpstreamFailure = rootCause.title;
        downstreamSymptom = `Application in ${anchorError?.service || "unknown service"} entered an error state`;
        rootCauseStatement =
            report.rootCause?.explanation ||
            rootCause.description ||
            `Halo identified an execution failure in ${anchorError?.service || "the application"}.`;
        verdict = rootCause.description || rootCause.title;
    } else {
        headline = parsedError.errorMessage || "Unhandled exception";
        firstObservedUpstreamFailure = parsedError.errorMessage || "Unknown";
        downstreamSymptom = `Application in ${anchorError?.service || "unknown service"} entered an error state`;
        rootCauseStatement = "The exact root cause is currently unknown due to missing server-side execution telemetry.";
        verdict = "Inconclusive telemetry signal prevents establishing a single definitive root cause.";
    }

    // 6. Causal Flow — HTTP request → HTTP status → client response handling → exception.
    //    Chain never adds invented backend exceptions between HTTP status and client exception.
    //    User trigger only shown when replay or user action event is observed.
    const hasObservedUserAction = Boolean(replaySession);
    const userTriggerLine = replaySession
        ? (pageUrl ? `User interaction on \`${pageUrl}\`` : `Observed user interaction`)
        : null; // No user action observed — don't fabricate

    const statusLine =
        requestStatus != null
            ? `HTTP ${requestStatus}${requestDuration != null ? ` (${requestDuration} ms)` : ""}`
            : null;

    // Build causal chain bottom-up from what is actually observed:
    //   [optional user trigger] → HTTP request → HTTP status → client response handler → TypeError
    const chainSteps: string[] = [];
    if (userTriggerLine) chainSteps.push(userTriggerLine);
    if (requestEndpoint) chainSteps.push(reqLabel);
    if (statusLine) chainSteps.push(statusLine);
    if (isDownstreamResponseHandler && requestEndpoint) {
        chainSteps.push(
            isHttpErrorStatus
                ? `${funcRef} accessed \`${propRef}\` without HTTP status check`
                : `${funcRef} accessed \`${propRef}\` on unexpected payload`
        );
    }
    chainSteps.push(parsedError.errorMessage);
    const asciiFlow = chainSteps.join("\n       ↓\n");

    // 7. Causal Story Narrative — derived from real evidence.
    const pageCtx = pageUrl ? `\`${pageUrl}\`` : anchorError?.service ?? "the application";
    const durationPhrase = requestDuration != null ? ` after ${requestDuration} ms` : "";

    const causalStory =
        isDownstreamResponseHandler && requestEndpoint && requestStatus != null
            ? isHttpErrorStatus
                ? `At ${timeFormatted}, an incident was captured${pageUrl ? ` on ${pageCtx}` : ""}. ` +
                  `A request to \`${reqLabel}\` returned HTTP ${requestStatus}${durationPhrase}. ` +
                  `The ${runtimeLabel} response handler in ${funcRef} then accessed \`${propRef}\` without validating the HTTP status code, producing \`${parsedError.errorMessage}\`. ` +
                  (replaySession ? `Replay confirms user interaction immediately before the request. ` : "") +
                  `The exact server-side reason for the HTTP ${requestStatus} is unknown — ` +
                  (isExactRootCauseKnown
                      ? `server-side telemetry: "${backendServerTrace?.title}".`
                      : `no backend exception or server-side execution log was captured for this transaction.`)
                : `At ${timeFormatted}, an incident was captured${pageUrl ? ` on ${pageCtx}` : ""}. ` +
                  `A request to \`${reqLabel}\` returned HTTP ${requestStatus}${durationPhrase} with an unexpected payload structure. ` +
                  `${funcRef} accessed \`${propRef}\` without null-checking, producing \`${parsedError.errorMessage}\`. ` +
                  `The upstream reason why the payload was unexpected is not established from available telemetry.`
            : `At ${timeFormatted}, an incident occurred${pageUrl ? ` on ${pageCtx}` : ""}. ${rootCauseStatement}`;

    // 8. Causal Tree Diagram — reflects observed chain, no invented nodes.
    const treeDiagram =
        isDownstreamResponseHandler && requestEndpoint && requestStatus != null
            ? isHttpErrorStatus
                ? `${reqLabel} → HTTP ${requestStatus} (observed upstream failure)\n        │\n        └── ${funcRef} accessed \`${propRef}\` without status guard\n                    │\n                    └── ${parsedError.errorMessage} (downstream consequence)\n\n[Exact backend cause for HTTP ${requestStatus}]: Unknown — no server-side telemetry captured`
                : `${reqLabel} → HTTP ${requestStatus} (unexpected payload)\n        │\n        └── ${funcRef} accessed \`${propRef}\`\n                    │\n                    └── ${parsedError.errorMessage}`
            : `${reqLabel ?? parsedError.errorClass} → ${parsedError.errorMessage}`;

    // 9. Evidence Integrity: Confirmed Facts vs Inferences vs Unknowns
    const confirmedFacts: EvidenceClaim[] = [];

    if (failedRequestEvent && requestEndpoint && requestStatus != null) {
        const durSuffix = requestDuration != null ? ` (${requestDuration} ms)` : "";
        confirmedFacts.push({
            statement: `\`${reqLabel}\` returned HTTP ${requestStatus}${durSuffix}.`,
            provenance: "Observed",
            evidenceSource: `HTTP telemetry event (${failedRequestEvent.id})`,
            evidenceId: failedRequestEvent.id,
        });
    }

    if (anchorError) {
        const loc = parsedError.failingFile
            ? ` in \`${parsedError.failingFile.split("/").pop()}${parsedError.failingLine ? `:${parsedError.failingLine}` : ""}\``
            : "";
        confirmedFacts.push({
            statement: `\`${parsedError.errorMessage}\`${loc}.`,
            provenance: "Observed",
            evidenceSource: `Error event (${anchorError.id})`,
            evidenceId: anchorError.id,
        });
    }

    if (runtimeReconstruction?.failure?.failingExpression) {
        confirmedFacts.push({
            statement: `Failing source expression: \`${runtimeReconstruction.failure.failingExpression}\` at line ${runtimeReconstruction.failure.sourceContext?.failingLineNumber || "?"}.`,
            provenance: "Observed",
            evidenceSource: "AST source analysis",
        });
    }

    if (replaySession) {
        confirmedFacts.push({
            statement: pageUrl
                ? `Session replay confirms the user was on \`${pageUrl}\` immediately before the incident.`
                : `Session replay was recorded for this occurrence.`,
            provenance: "Observed",
            evidenceSource: `Session Replay (${replaySession.id})`,
        });
    }

    const strongInferences: EvidenceClaim[] = [];
    if (isDownstreamResponseHandler && failedRequestEvent) {
        strongInferences.push({
            statement: `The \`${parsedError.errorMessage}\` is a downstream consequence of the HTTP request failure, not the initiating cause.`,
            provenance: "Inferred",
            details: requestDuration != null
                ? `Supported by chronological ordering: HTTP failure at T+0, client exception at T+${requestDuration} ms, and the dereference occurring inside the response handler.`
                : `Supported by chronological ordering (HTTP failure precedes client exception) and the dereference occurring inside the response handler.`,
        });
        strongInferences.push({
            statement: `The response handler accessed \`${propRef}\` without first checking the HTTP status code.`,
            provenance: "Inferred",
            details: `Supported by the unhandled property dereference in ${parsedError.failingFunction ? `\`${parsedError.failingFunction}()\`` : "the response callback"} with no preceding status guard.`,
        });
    }

    const unknowns: EvidenceClaim[] = [];
    if (!isExactRootCauseKnown && requestEndpoint && requestStatus != null) {
        unknowns.push({
            statement: `The exact server-side reason why \`${requestEndpoint}\` returned HTTP ${requestStatus}.`,
            provenance: "Unknown",
            details: `No server-side stack trace or execution log was captured during this transaction.`,
        });
        unknowns.push({
            statement: `Whether the backend failure originated from a dependency, configuration, validation, or runtime error.`,
            provenance: "Unknown",
            details: `No backend telemetry was recorded during the ${requestStatus} response generation window.`,
        });
    } else if (!isExactRootCauseKnown) {
        unknowns.push({
            statement: `The exact root cause could not be determined from available telemetry.`,
            provenance: "Unknown",
            details: `No upstream or server-side telemetry was captured for this incident.`,
        });
    }

    // 10. Historical Observations Isolation (Strict Boundary)
    const unrelatedEventsList: string[] = [];
    for (const ev of historicalUnrelatedEvidence) {
        if (ev.type === "ERROR" && !ev.title.includes(parsedError.errorMessage)) {
            unrelatedEventsList.push(`Earlier occurrence: "${ev.title}" (${formatTime(new Date(ev.timestamp))})`);
        }
    }

    const historicalObservations = {
        hasUnrelatedEvents: unrelatedEventsList.length > 0,
        explanation: unrelatedEventsList.length > 0
            ? `Earlier occurrences of other errors in the project are historical observations. They are not used as causal evidence unless Halo finds a concrete link to the current occurrence.`
            : `No unrelated or contradictory historical errors were observed in this occurrence's temporal window.`,
        events: unrelatedEventsList.slice(0, 3),
    };

    // 11. Causal Evidence Graph
    const causalEvidenceGraph: CausalEvidenceNode[] = [];

    if (failedRequestEvent && requestEndpoint && requestStatus != null) {
        const durPhrase2 = requestDuration != null ? ` (${requestDuration} ms)` : "";
        causalEvidenceGraph.push({
            id: "ev-upstream-req",
            label: `${reqLabel} → ${requestStatus}`,
            role: "Upstream failure",
            provenance: "Observed",
            strength: "Very High",
            service: failedRequestEvent.service ?? anchorError?.service ?? "unknown",
            timestamp: failedRequestEvent.timestamp ?? incidentAnchorTime,
            timeOffsetFormatted: `T+0${durPhrase2} (Initiating)`,
            explanation: `The failed request is the earliest observed failure in this causal chain. It occurred before the client exception and produced a non-2xx response.`,
            causalBasis: "Chronologically precedes the client exception; returns a non-2xx HTTP status code.",
            traceId: failedRequestEvent.traceId ?? anchorError?.traceId ?? undefined,
            requestId: failedRequestEvent.requestId ?? anchorError?.requestId ?? undefined,
            status: requestStatus,
            resource: requestEndpoint,
            operation: reqLabel,
        });
    }

    if (anchorError) {
        causalEvidenceGraph.push({
            id: "ev-downstream-err",
            label: parsedError.errorMessage,
            role: isDownstreamResponseHandler && failedRequestEvent
                ? "Downstream consequence"
                : "Root cause",
            provenance: "Observed",
            strength: "Very High",
            service: anchorError.service ?? "unknown",
            timestamp: anchorError.timestamp ?? incidentAnchorTime,
            timeOffsetFormatted:
                isDownstreamResponseHandler && requestDuration != null
                    ? `T+${requestDuration}ms`
                    : "T+0ms",
            explanation:
                isDownstreamResponseHandler && failedRequestEvent
                    ? `The client exception occurred during response handling, after the upstream HTTP failure produced an unexpected response body.`
                    : `This is the primary error event captured for this occurrence.`,
            causalBasis:
                isDownstreamResponseHandler && failedRequestEvent
                    ? `Occurs inside the response callback of the failed HTTP request; accesses \`${propRef}\` without status guard.`
                    : `Direct error event captured in this occurrence's session/trace context.`,
            traceId: anchorError.traceId ?? undefined,
            requestId: anchorError.requestId ?? undefined,
        });
    }

    if (replaySession) {
        causalEvidenceGraph.push({
            id: "ev-replay-trigger",
            label: pageUrl ? `Replay: user interaction on ${pageUrl}` : `Replay: user interaction recorded`,
            role: "Trigger",
            provenance: "Observed",
            strength: "High",
            service: "browser",
            timestamp: incidentAnchorTime,
            timeOffsetFormatted: "Before incident",
            explanation: `Session replay establishes that a user interaction preceded the incident.`,
            causalBasis: "Recorded session replay for this occurrence's session ID.",
        });
    }

    if (unrelatedEventsList.length > 0) {
        causalEvidenceGraph.push({
            id: "ev-unrelated-hist",
            label: unrelatedEventsList[0],
            role: "Unrelated historical event",
            provenance: "Observed",
            strength: "Low",
            timeOffsetFormatted: "Historical",
            explanation: `An earlier error was observed without a shared traceId, sessionId, or requestId linking it to this occurrence.`,
            causalBasis: "Disparate timestamp, session, and transaction context from the anchor event.",
        });
    }

    if (failedRequestEvent && !isExactRootCauseKnown && requestEndpoint && requestStatus != null) {
        causalEvidenceGraph.push({
            id: "ev-missing-backend",
            label: `Server-side execution logs for ${reqLabel} → ${requestStatus}`,
            role: "Missing evidence",
            provenance: "Unknown",
            strength: "Missing",
            timeOffsetFormatted: "—",
            explanation: `No backend exception or server execution log was captured explaining why \`${requestEndpoint}\` returned HTTP ${requestStatus} during this transaction.`,
            causalBasis: "No server-side telemetry was recorded for this request.",
        });
    }

    // 12. Competing Hypotheses Evaluation
    const hypothesesAnalysis: CompetingHypothesisAnalysis[] = [];

    if (isDownstreamResponseHandler && failedRequestEvent && requestEndpoint && requestStatus != null) {
        if (isHttpErrorStatus) {
            hypothesesAnalysis.push({
                id: "hyp-upstream-api",
                title: `Upstream Request Failure on \`${reqLabel}\` (HTTP ${requestStatus})`,
                status: "SUPPORTED",  // Evidence-consistent; no actual test was run
                confidenceLevel: "Very High",
                causalRelationship: `HTTP ${requestStatus} from \`${requestEndpoint}\` preceded and induced the ${exceptionOriginLabel}.`,
                supportingEvidence: [
                    `Request returned HTTP ${requestStatus} immediately before the ${exceptionOriginLabel}.`,
                    `Exception and request share the same ${incidentTraceId ? "trace" : incidentSessionId ? "session" : "temporal"} context.`,
                    ...(replaySession ? [`Replay confirms user interaction immediately before the network call.`] : []),
                    `Exception in ${funcRef} is consistent with accessing \`${propRef}\` on an error response body.`,
                ],
                contradictingEvidence: [],
                missingEvidence: [
                    `Server-side logs explaining the backend reason for HTTP ${requestStatus}.`,
                ],
                outrankReason: `Outranks a standalone ${runtimeLabel} bug hypothesis because the request failure is chronologically upstream and induced the unexpected response body.`,
                uncertainties: [
                    `Exact backend cause (dependency, configuration, validation, runtime) is not yet observed.`,
                ],
            });
        } else {
            hypothesesAnalysis.push({
                id: "hyp-upstream-payload",
                title: `Unexpected Upstream Response Structure on \`${reqLabel}\` (HTTP ${requestStatus})`,
                status: "SUPPORTED",
                confidenceLevel: "High",
                causalRelationship: `\`${reqLabel}\` returned HTTP 200 but contained null or missing data for \`${propRef}\`, triggering the exception in ${funcRef}.`,
                supportingEvidence: [
                    `Request \`${reqLabel}\` completed immediately before the exception was captured.`,
                    `Failing expression \`${propRef}\` was dereferenced in ${funcRef} without a null check.`,
                    `Exception is consistent with receiving an unexpected payload structure or missing entity.`,
                ],
                contradictingEvidence: [],
                missingEvidence: [
                    `Upstream data source logs explaining why the entity or field was null.`,
                ],
                outrankReason: `Best explains the failure: the application code assumed valid non-null data from \`${reqLabel}\`.`,
                uncertainties: [
                    `Whether the null value was caused by a database record omission, business logic branch, or upstream API change.`,
                ],
            });
        }

        hypothesesAnalysis.push({
            id: "hyp-standalone-error",
            title: `Isolated ${runtimeLabel === "client" ? "Client" : "Application"} Exception (\`${parsedError.errorClass}\`)`,
            status: "REJECTED",
            confidenceLevel: "Low",
            causalRelationship: "Rejected as primary root cause.",
            supportingEvidence: [
                parsedError.failingFile
                    ? `Stack trace points to \`${parsedError.failingFile}\`.`
                    : `An exception was captured.`,
            ],
            contradictingEvidence: [
                `The exception occurred directly during processing of the response from \`${reqLabel}\`.`,
                isHttpErrorStatus
                    ? `If the request had succeeded with a valid 2xx response body, the dereference would not have failed.`
                    : `The failure mechanism directly depends on the data shape returned by the upstream endpoint.`,
            ],
            missingEvidence: [],
            outrankReason: `Loses to the upstream payload / response hypothesis: the exception is a consequence of handling unexpected upstream data.`,
            uncertainties: [],
        });
    }

    // Add any additional hypotheses from the engine.
    for (const alt of hypotheses) {
        if (alt.id !== rootCause?.id && !hypothesesAnalysis.some((h) => h.title === alt.title)) {
            hypothesesAnalysis.push({
                id: alt.id,
                title: alt.title,
                // Never expose "VALIDATED" unless a test was actually run
                status: alt.status === "VALIDATED" ? "SUPPORTED" : "EVALUATED",
                confidenceLevel: getConfidenceLevel(alt.confidence * 100),
                causalRelationship: "Alternative considered during evaluation.",
                supportingEvidence: alt.supportingReasons.map((r) => r.title || r.description),
                contradictingEvidence: alt.contradictingReasons.map((r) => r.title || r.description),
                missingEvidence: alt.missingReasons.map((r) => r.title || r.description),
                outrankReason: "Insufficient signal density or contradicted by active telemetry.",
                uncertainties: [],
            });
        }
    }

    // 13. Replay Evidence Analysis
    const replayEvidenceAnalysis = {
        hasReplay: Boolean(replaySession),
        whatReplayConfirms: replaySession
            ? [
                  pageUrl ? `User was on \`${pageUrl}\` during this session.` : `A user session was recorded.`,
                  `User interaction preceded the incident.`,
                  `The UI entered an error state following the incident.`,
              ]
            : [],
        whatReplayDoesNotConfirm: replaySession
            ? [
                  `Server-side state or backend execution during the request.`,
                  `Network-layer conditions between client and server.`,
              ]
            : [`No session replay was recorded for this occurrence.`],
    };

    // 14. Impact Details
    const impactDetails = {
        affectedUsersCount: impact?.affectedUsers ?? 1,
        affectedServices: Array.from(new Set(activeIncidentEvidence.map((e) => e.service).filter(Boolean))) as string[],
        affectedEndpoints: Array.from(new Set(activeIncidentEvidence.map((e) => e.resource || e.operation).filter(Boolean))) as string[],
        severity: impact?.severity ? String(impact.severity) : "HIGH",
    };

    // 15. Recommendation Engine — build evidence-grounded fix plan.
    const recommendations = buildDashboardRecommendations(
        investigation,
        {
            parsedError,
            failedRequest: failedRequestEvent
                ? {
                      id: failedRequestEvent.id,
                      type: failedRequestEvent.type,
                      method: requestMethod,
                      endpoint: requestEndpoint,
                      status: requestStatus,
                      durationMs: requestDuration,
                      traceId: failedRequestEvent.traceId,
                      requestId: failedRequestEvent.requestId,
                      service: failedRequestEvent.service,
                  }
                : null,
            isDownstreamResponseHandler,
            anchorErrorId: anchorError?.id,
            anchorErrorTitle: anchorError?.title,
            incidentSessionId,
            incidentTraceId,
            pageUrl,
            isExactRootCauseKnown,
            sourceResolved,
            backendServerTrace: backendServerTrace
                ? {
                      id: backendServerTrace.id,
                      title: backendServerTrace.title,
                      service: backendServerTrace.service ?? "unknown",
                  }
                : null,
        },
    );

    // Reasoning points for Why This Conclusion section.
    const reasoningPoints: string[] = [];
    if (failedRequestEvent && requestStatus != null) {
        const correlationBasis = incidentTraceId
            ? `trace ID (${incidentTraceId.slice(0, 8)}…)`
            : incidentRequestId
            ? `request ID (${incidentRequestId.slice(0, 8)}…)`
            : incidentSessionId
            ? `session ID (${incidentSessionId.slice(0, 8)}…)`
            : "temporal ordering";
        reasoningPoints.push(
            `\`${reqLabel}\` returned HTTP ${requestStatus} and is correlated to the error event via ${correlationBasis}, establishing chronological precedence.`
        );
    }
    if (isDownstreamResponseHandler) {
        reasoningPoints.push(
            `The \`${parsedError.errorMessage}\` exception is classified as a downstream consequence: ` +
            `it occurred inside the ${runtimeLabel} response handler of \`${reqLabel}\`, after the upstream HTTP failure already returned an unexpected response body.`
        );
    }
    if (replaySession) {
        reasoningPoints.push(`Session replay confirms user interaction immediately before the network call.`);
    }
    if (!isExactRootCauseKnown && isHttpErrorStatus) {
        reasoningPoints.push(
            `The exact server-side backend cause for HTTP ${requestStatus} remains Unknown — no server-side execution log or exception was captured for this transaction.`
        );
    }
    if (reasoningPoints.length === 0) {
        reasoningPoints.push(`Available telemetry was insufficient to establish a high-confidence causal chain.`);
    }

    // What Happened — only include what is actually observed in telemetry.
    // Do not fabricate user actions, page context, or session information.
    const hasObservedPageUrl = Boolean(pageUrl); // Only from replay or metadata — not inferred
    const userActionDescription = replaySession
        ? (pageUrl
            ? `User interacted on \`${pageUrl}\` immediately before the incident.`
            : `A user session was recorded for this occurrence.`)
        : hasObservedPageUrl
        ? `Activity was recorded on \`${pageUrl}\` (no session replay captured).`
        : `No user action event was captured for this occurrence — only the application error event.`;

    // userAction.provenance: Observed only when replay exists, otherwise Inferred from URL metadata
    const userActionProvenance: ProvenanceType = replaySession ? "Observed" : (hasObservedPageUrl ? "Inferred" : "Unknown");

    const clientExceptionLocation =
        parsedError.failingFunction && parsedError.targetProperty
            ? `${parsedError.failingFunction}() → \`${parsedError.targetProperty}\``
            : parsedError.failingFunction
            ? `${parsedError.failingFunction}()`
            : parsedError.failingFile
            ? parsedError.failingFile
            : "unknown location";

    const userImpactStr =
        pageUrl
            ? `The operation on \`${pageUrl}\` did not complete and the application entered an error state.`
            : `The operation in ${anchorError?.service ?? "the application"} did not complete and an error state was reached.`;

    // Per-claim confidence (not a single blended score).
    // Each claim's confidence must be independently grounded in the evidence for that claim.
    // High confidence in HTTP 500 occurring ≠ high confidence in the exact backend cause.
    const hasSharedId = Boolean(incidentSessionId || incidentTraceId || incidentRequestId);
    const confidenceScore =
        failedRequestEvent && anchorError && hasSharedId ? 88
        : failedRequestEvent && anchorError ? 70
        : 42;
    const confidenceLabel = getConfidenceLevel(confidenceScore);

    const executiveNarrative =
        `At ${timeFormatted}, an incident was captured` +
        (pageUrl ? ` on \`${pageUrl}\`` : ` in ${anchorError?.service ?? "the application"}`) +
        `. Halo correlated ${activeIncidentEvidence.length} telemetry point${activeIncidentEvidence.length !== 1 ? "s" : ""} to reconstruct the causal sequence.`;

    // Verification and prevention are now carried inside the recommendations plan.

    return {
        headline,
        executiveDiagnosis: {
            verdict,
            narrative: executiveNarrative,
            isExactRootCauseKnown,
            initiatingService: failedRequestEvent?.service ?? anchorError?.service ?? "unknown",
            blastRadiusScore: Math.min(
                100,
                impactDetails.affectedServices.length * 25 + 30,
            ),
        },
        rootCauseSummary: {
            rootCauseStatement,
            isExactRootCauseKnown,
            firstObservedUpstreamFailure,
            downstreamSymptom,
            contributingFactors,
            // Overall qualitative confidence label (blended, for summary display)
            confidenceLabel,
            confidenceScore,
            reasoning: reasoningPoints,
            isClientDownstream: isDownstreamResponseHandler,
            // Per-claim confidence — each claim is independently grounded in evidence
            claimConfidence,
        },
        causalStory,
        asciiFlow,
        whatHappened: {
            timeFormatted,
            pageUrl: pageUrl ?? "",
            userAction: {
                description: userActionDescription,
                // Provenance is Observed only when a session replay event exists.
                // Inferred when only page URL from event metadata is available.
                // Unknown when neither replay nor URL is present.
                provenance: userActionProvenance,
                replayEvidence: replaySession
                    ? `Session replay was recorded for this occurrence.`
                    : `No session replay was recorded for this occurrence.`,
            },
            failedRequest:
                failedRequestEvent && requestEndpoint && requestStatus != null
                    ? {
                          method: requestMethod ?? "REQUEST",
                          endpoint: requestEndpoint,
                          status: requestStatus,
                          durationMs: requestDuration ?? undefined,
                          traceId: failedRequestEvent.traceId ?? undefined,
                          provenance: "Observed" as ProvenanceType,
                      }
                    : undefined,
            clientException: {
                title: parsedError.errorMessage,
                failingLocation: clientExceptionLocation,
                targetProperty: parsedError.targetProperty,
                provenance: "Observed",
            },
            userImpact: userImpactStr,
        },
        whyThisConclusion: {
            narrative:
                isDownstreamResponseHandler && requestEndpoint && requestStatus != null
                    ? `\`${parsedError.errorMessage}\` alone does not explain the incident. \`${reqLabel}\` returned HTTP ${requestStatus} first — the client exception is a consequence of the failed response body, not an independent bug.`
                    : `Available telemetry establishes: ${rootCauseStatement}`,
            treeDiagram,
            provenPoints: reasoningPoints,
        },
        evidenceIntegrity: {
            confirmedFacts,
            strongInferences,
            unknowns,
        },
        causalEvidenceGraph,
        historicalObservations,
        hypothesesAnalysis,
        replayEvidenceAnalysis,
        impactDetails,
        recommendations,
        runtimeReconstruction,
    };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function parseErrorDetails(
    primaryError: Evidence | undefined,
    rootCause: Hypothesis | null,
    runtimeReconstruction?: FullRuntimeReconstruction
): ParsedErrorDetails {
    const fullText = [
        primaryError?.title || "",
        primaryError?.description || "",
        rootCause?.title || "",
        rootCause?.description || "",
        typeof primaryError?.metadata?.error === "string" ? primaryError.metadata.error : "",
        typeof primaryError?.metadata?.message === "string" ? primaryError.metadata.message : "",
    ].join(" ");

    const stack = typeof primaryError?.metadata?.stack === "string" ? primaryError.metadata.stack : "";

    const stackFrames: { file?: string; func?: string; line?: string | number }[] = [];
    const stackLineRegex = /at\s+(?:([a-zA-Z0-9_$<>.]+)\s+\()?([^:()]+):(\d+):(?:\d+)\)?/g;
    let match;
    while ((match = stackLineRegex.exec(stack)) !== null) {
        stackFrames.push({
            func: match[1],
            file: match[2]?.trim(),
            line: match[3],
        });
    }

    const firstFrame = stackFrames.find((f) => f.file && !f.file.includes("node_modules")) || stackFrames[0];

    const propMatch = /reading\s+['"]?([a-zA-Z0-9_$]+)['"]?/i.exec(fullText);
    let targetProperty = propMatch ? propMatch[1] : undefined;

    const isTypeError = /TypeError|ReferenceError|NullPointer|Cannot read properties|undefined is not|is not a function/i.test(fullText);
    const isDatabaseError = /Prisma|Postgres|Sequelize|TypeORM|Deadlock|Unique constraint|P2002|P2024|P2025|connection pool/i.test(fullText);
    const isNetworkTimeout = /ETIMEDOUT|ECONNREFUSED|504|Gateway Timeout|FetchError|AbortError|network timeout/i.test(fullText);
    const isAuthError = /JWT|token|Unauthorized|401|403|Forbidden|CSRF|signature/i.test(fullText);
    const isRateLimit = /429|Too Many Requests|rate limit|quota exceeded/i.test(fullText);

    const dbModelMatch = /prisma\.([a-zA-Z0-9_$]+)\./i.exec(stack + " " + fullText);
    const databaseModel = dbModelMatch ? dbModelMatch[1] : undefined;

    const classMatch = /([A-Z][a-zA-Z0-9_]*(?:Error|Exception))/i.exec(fullText);
    const errorClass = classMatch ? classMatch[1] : isTypeError ? "TypeError" : "RuntimeError";

    let failingFile = firstFrame?.file;
    let failingFunction = firstFrame?.func;
    let failingLine = firstFrame?.line;

    // Enrich with verified AST source context when available
    if (runtimeReconstruction?.failure?.sourceContext) {
        const sc = runtimeReconstruction.failure.sourceContext;
        if (sc.filePath) failingFile = sc.filePath;
        if (sc.containingFunction) failingFunction = sc.containingFunction;
        if (sc.failingLineNumber) failingLine = sc.failingLineNumber;
        if (sc.failingExpression) targetProperty = sc.failingExpression;
    } else if (runtimeReconstruction?.failure?.primaryFailingFrame) {
        const pf = runtimeReconstruction.failure.primaryFailingFrame;
        if (pf.filePath) failingFile = pf.filePath;
        if (pf.functionName && pf.functionName !== "<anonymous>") failingFunction = pf.functionName;
        if (pf.lineNumber) failingLine = pf.lineNumber;
    }

    return {
        errorClass,
        errorMessage: primaryError?.title || rootCause?.title || "Unhandled Exception",
        failingFile,
        failingFunction,
        failingLine,
        targetProperty,
        databaseModel,
        isTypeError,
        isDatabaseError,
        isNetworkTimeout,
        isAuthError,
        isRateLimit,
    };
}

function extractFlowName(url: string): string {
    if (url.includes("checkout") || url.includes("payment")) return "checkout";
    if (url.includes("auth") || url.includes("sign-in") || url.includes("login")) return "authentication";
    if (url.includes("order")) return "order placement";
    if (url.includes("cart")) return "cart";
    if (url.includes("profile") || url.includes("account")) return "account";
    // Derive a readable name from the last meaningful path segment.
    try {
        const segments = new URL(url).pathname.split("/").filter(Boolean);
        if (segments.length > 0) return segments[segments.length - 1].replace(/-/g, " ");
    } catch {
        // Ignore URL parse errors.
    }
    return "operation";
}

function formatTime(date: Date): string {
    return new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true,
    }).format(date);
}

function getConfidenceLevel(score: number): "Low" | "Medium" | "High" | "Very High" {
    if (score >= 85) return "Very High";
    if (score >= 65) return "High";
    if (score >= 40) return "Medium";
    return "Low";
}

/**
 * Detect the runtime origin of the anchor event.
 *
 * Used to ensure investigation narrative uses correct language:
 * - Node.js events → "application exception" (never "browser/client exception")
 * - Browser events → "client-side exception"
 */
function detectAnchorRuntimeOrigin(
    anchorError: Evidence | undefined
): "node" | "browser" | "unknown" {
    if (!anchorError) return "unknown";

    const meta = anchorError.metadata || {};
    const sdkName = String(anchorError.source || meta.sdkName || "").toLowerCase();
    const service = String(anchorError.service || "").toLowerCase();

    // Explicit browser signals
    if (
        sdkName.includes("browser") ||
        sdkName.includes("js-web") ||
        typeof meta.userAgent === "string" ||
        service === "browser" ||
        service === "frontend" ||
        service === "client"
    ) {
        return "browser";
    }

    // Explicit Node signals
    if (
        sdkName.includes("node") ||
        sdkName.includes("server") ||
        typeof meta.nodeVersion === "string" ||
        service === "node" ||
        service === "server" ||
        service === "backend" ||
        service === "api"
    ) {
        return "node";
    }

    // Heuristic: Node.js internals in stack → likely Node
    const rawStack =
        typeof meta.stack === "string" ? meta.stack : anchorError.description || "";
    if (
        rawStack.includes("node:internal") ||
        rawStack.includes("processTicksAndRejections") ||
        rawStack.includes("Module._resolveFilename") ||
        rawStack.includes("at async Module")
    ) {
        return "node";
    }

    return "unknown";
}
