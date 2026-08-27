import type {
    Investigation,
    Hypothesis,
    Evidence,
    Finding,
    Change,
    Impact,
    Recommendation,
} from "@halo/investigation-engine";

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
    status: "VALIDATED" | "EVALUATED" | "REJECTED";
    confidence: number;
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
     * Actionable Engineering Remediation Plan
     */
    recommendations: {
        immediateInvestigation: {
            title: string;
            description: string;
            checklist: string[];
        };
        likelyRemediation?: {
            title: string;
            description: string;
            codeSnippet: string;
        };
        verificationSteps: string[];
        preventionGuardrails: string[];
    };
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

    // Separate active incident telemetry from historical / unrelated occurrences
    const activeIncidentEvidence: Evidence[] = [];
    const historicalUnrelatedEvidence: Evidence[] = [];

    for (const ev of evidence) {
        const evTime = new Date(ev.timestamp).getTime();
        const deltaMs = Math.abs(evTime - anchorTimeMs);

        const hasDirectLink =
            (incidentSessionId && ev.sessionId === incidentSessionId) ||
            (incidentTraceId && ev.traceId === incidentTraceId) ||
            (incidentRequestId && ev.requestId === incidentRequestId);

        const isTemporallyCoincident = deltaMs <= 30000; // within 30s cascade window

        if (hasDirectLink || isTemporallyCoincident) {
            activeIncidentEvidence.push(ev);
        } else {
            historicalUnrelatedEvidence.push(ev);
        }
    }

    // Sort active evidence chronologically
    const sortedActive = [...activeIncidentEvidence].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // 2. Parse exact error details from the incident anchor
    const parsedError = parseErrorDetails(anchorError, rootCause);

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
    });


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
    // A downstream pattern: TypeError that follows an observed failed HTTP request.
    const isDownstreamResponseHandler =
        parsedError.isTypeError && Boolean(failedRequestEvent);

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

    const propRef: string = parsedError.targetProperty ?? "expected property";

    // 5. Causal Terminology Alignment — everything derived from real telemetry.
    let headline = "";
    let verdict = "";
    let rootCauseStatement = "";
    let firstObservedUpstreamFailure = "";
    let downstreamSymptom = "";
    const contributingFactors: string[] = [];

    if (isDownstreamResponseHandler && requestEndpoint && requestStatus != null) {
        const durationSuffix = requestDuration != null ? ` (${requestDuration} ms)` : "";
        headline = `${parsedError.errorClass} after ${reqLabel} → ${requestStatus}`;
        firstObservedUpstreamFailure = `${reqLabel} returned HTTP ${requestStatus}${durationSuffix}`;
        downstreamSymptom = parsedError.errorMessage;
        contributingFactors.push(
            "The response handler accessed properties on the response body without first checking the HTTP status code."
        );
        if (isExactRootCauseKnown && backendServerTrace) {
            rootCauseStatement = `The server failed with "${backendServerTrace.title}" during execution of ${requestEndpoint}, causing the HTTP ${requestStatus} response.`;
        } else {
            rootCauseStatement = `\`${reqLabel}\` returned HTTP ${requestStatus}. The response handler then accessed \`${propRef}\` without validating the HTTP status first, producing the \`${parsedError.errorMessage}\` exception.`;
        }
        verdict = `The client-side exception is a downstream symptom. The first observed upstream failure in this cascade is the HTTP ${requestStatus} response from \`${requestEndpoint}\`.`;
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

    // 6. Visual Causal Flowchart — derived purely from evidence.
    const userTriggerLine =
        replaySession
            ? `User interaction on ${pageUrl ?? "unknown page"}`
            : `Event on ${pageUrl ?? anchorError?.service ?? "unknown context"}`;

    const statusLine =
        requestStatus != null
            ? `HTTP ${requestStatus}${requestDuration != null ? ` (${requestDuration} ms)` : ""}`
            : "Request failed";

    const asciiFlow =
        isDownstreamResponseHandler && requestEndpoint
            ? `${userTriggerLine}\n       ↓\n${reqLabel}\n       ↓\n${statusLine}\n       ↓\nResponse handler accessed \`${propRef}\` without status check\n       ↓\n${parsedError.errorMessage}`
            : `${userTriggerLine}\n       ↓\n${reqLabel}\n       ↓\n${parsedError.errorMessage}`;

    // 7. Causal Story Narrative — derived from real evidence.
    const pageCtx = pageUrl ? `\`${pageUrl}\`` : anchorError?.service ?? "the application";
    const durationPhrase = requestDuration != null ? ` after ${requestDuration} ms` : "";

    const causalStory =
        isDownstreamResponseHandler && requestEndpoint && requestStatus != null
            ? `At ${timeFormatted}, an incident was captured${pageUrl ? ` on ${pageCtx}` : ""}. ` +
              `A request to \`${reqLabel}\` returned HTTP ${requestStatus}${durationPhrase}. ` +
              `The response handler then accessed \`${propRef}\` without validating the HTTP status, producing \`${parsedError.errorMessage}\`. ` +
              (replaySession ? `Replay confirms user interaction immediately before the request. ` : "") +
              `The exact server-side reason for the ${requestStatus} is unknown — no backend exception or dependency failure was captured for this transaction.`
            : `At ${timeFormatted}, an incident occurred${pageUrl ? ` on ${pageCtx}` : ""}. ${rootCauseStatement}`;

    // 8. Causal Tree Diagram — derived from real evidence.
    const treeDiagram =
        isDownstreamResponseHandler && requestEndpoint
            ? `${reqLabel} → ${requestStatus ?? "error"}\n        │\n        └── response handler accesses \`${propRef}\` without status guard\n                    │\n                    └── ${parsedError.errorMessage}`
            : `${reqLabel} → ${parsedError.errorMessage}`;

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
        confirmedFacts.push({
            statement: `\`${parsedError.errorMessage}\`${parsedError.failingFile ? ` thrown in \`${parsedError.failingFile}\`` : ""}.`,
            provenance: "Observed",
            evidenceSource: `Error event (${anchorError.id})`,
            evidenceId: anchorError.id,
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
        hypothesesAnalysis.push({
            id: "hyp-upstream-api",
            title: `Upstream Request Failure on \`${reqLabel}\` (HTTP ${requestStatus})`,
            status: "VALIDATED",
            confidence: 0.92,
            confidenceLevel: "Very High",
            causalRelationship: `HTTP ${requestStatus} from \`${requestEndpoint}\` preceded and induced the client-side exception.`,
            supportingEvidence: [
                `Request returned HTTP ${requestStatus} immediately before the client exception.`,
                `Client exception and request share the same session${incidentTraceId ? " and trace" : ""} context.`,
                ...(replaySession ? [`Replay confirms user interaction immediately before the network call.`] : []),
                `Client exception is consistent with accessing response properties on an error response body.`,
            ],
            contradictingEvidence: [],
            missingEvidence: [
                `Server-side logs explaining the backend reason for HTTP ${requestStatus}.`,
            ],
            outrankReason: `Outranks a standalone client bug hypothesis because the request failure is chronologically upstream and induced the unexpected response body.`,
            uncertainties: [
                `Exact backend cause (dependency, configuration, validation, runtime) is not yet observed.`,
            ],
        });

        hypothesesAnalysis.push({
            id: "hyp-client-only",
            title: `Isolated Client Exception (\`${parsedError.errorClass}\`)`,
            status: "REJECTED",
            confidence: 0.2,
            confidenceLevel: "Low",
            causalRelationship: "Rejected as primary root cause.",
            supportingEvidence: [
                parsedError.failingFile
                    ? `Client stack trace points to \`${parsedError.failingFile}\`.`
                    : `A client-side exception was captured.`,
            ],
            contradictingEvidence: [
                `The exception only occurred after \`${reqLabel}\` returned HTTP ${requestStatus}.`,
                `If the request had succeeded with a valid response body, the dereference would not have failed.`,
            ],
            missingEvidence: [],
            outrankReason: "Loses to the upstream request failure hypothesis: the client exception is a consequence of the failed response, not an independent bug.",
            uncertainties: [],
        });
    }

    // Add any additional hypotheses from the engine.
    for (const alt of hypotheses) {
        if (alt.id !== rootCause?.id && !hypothesesAnalysis.some((h) => h.title === alt.title)) {
            hypothesesAnalysis.push({
                id: alt.id,
                title: alt.title,
                status: alt.status === "VALIDATED" ? "EVALUATED" : "REJECTED",
                confidence: alt.confidence,
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

    // 15. Actionable Developer Recommendations — tied to actual evidence.
    const targetLoc = parsedError.failingFile
        ? `${parsedError.failingFile}${parsedError.failingLine ? `:${parsedError.failingLine}` : ""}`
        : null;

    const immediateTitle = requestEndpoint && requestStatus != null
        ? `Inspect server-side execution of \`${reqLabel}\` for the HTTP ${requestStatus} response`
        : `Inspect the execution context of \`${parsedError.errorClass}\` in ${anchorError?.service ?? "the application"}`;

    const immediateDesc = requestEndpoint
        ? `The originating failure is in the backend handler for \`${requestEndpoint}\`. Review server telemetry:`
        : `Review the execution context for this error:`;

    const immediateChecklist: string[] = requestEndpoint
        ? [
              `Uncaught backend exception or error log in \`${requestEndpoint}\``,
              `Failed downstream dependency call (database, cache, external service)`,
              `Missing or invalid environment configuration`,
              `Request payload or authentication validation failure`,
              `Recent deployment or configuration change coinciding with this occurrence`,
          ]
        : [
              `Stack frame at \`${targetLoc ?? parsedError.errorClass}\``,
              `Variable or property state at the point of the exception`,
              `Any preceding breadcrumbs or log entries in the same session`,
          ];

    type RemediationBlock = {
        title: string;
        description: string;
        codeSnippet: string;
    };

    let likelyRemediation: RemediationBlock | undefined;

    if (isDownstreamResponseHandler && requestEndpoint && requestMethod) {
        const locComment = targetLoc ? `// In ${targetLoc}\n` : "";
        likelyRemediation = {
            title: targetLoc
                ? `Guard the response handler in \`${targetLoc}\` against non-2xx responses`
                : `Guard the response handler against non-2xx HTTP responses`,
            description:
                `The response handler accesses \`${propRef}\` without first verifying the HTTP status. ` +
                `Add a non-2xx guard before accessing the response body:`,
            codeSnippet:
                `${locComment}const response = await fetch("${requestEndpoint}", {\n` +
                `  method: "${requestMethod}",\n` +
                `  headers: { "Content-Type": "application/json" },\n` +
                `  body: JSON.stringify(payload),\n` +
                `});\n\n` +
                `if (!response.ok) {\n` +
                `  const errorBody = await response.json().catch(() => ({}));\n` +
                `  // Handle the error — do not access ${propRef} here.\n` +
                `  displayError(errorBody.message ?? "Request failed.");\n` +
                `  return;\n` +
                `}\n\n` +
                `const result = await response.json();\n` +
                `// ${propRef} is now safe to access after the 2xx guard.`,
        };
    }

    const reasoningPoints: string[] = [];
    if (failedRequestEvent && requestStatus != null) {
        reasoningPoints.push(`\`${reqLabel}\` returned HTTP ${requestStatus}, which precedes the client exception in chronological order.`);
    }
    if (incidentSessionId) {
        reasoningPoints.push(`The request and error share the same session context (${incidentSessionId.slice(0, 8)}…).`);
    }
    if (incidentTraceId) {
        reasoningPoints.push(`Shared trace ID (${incidentTraceId.slice(0, 8)}…) links request and error as part of the same distributed transaction.`);
    }
    if (replaySession) {
        reasoningPoints.push(`Session replay confirms user interaction immediately before the network call.`);
    }
    if (isDownstreamResponseHandler) {
        reasoningPoints.push(`The client exception stack frame is consistent with accessing a property on an undefined response body.`);
    }
    if (reasoningPoints.length === 0) {
        reasoningPoints.push(`Available telemetry was insufficient to establish a high-confidence causal chain.`);
    }

    const userActionDescription = replaySession
        ? pageUrl
            ? `User interacted on \`${pageUrl}\` immediately before the incident.`
            : `A user session was recorded for this occurrence.`
        : pageUrl
        ? `Activity was recorded on \`${pageUrl}\`.`
        : `Activity was recorded in ${anchorError?.service ?? "the application"}.`;

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

    const hasRequestAndError = Boolean(failedRequestEvent && anchorError);
    const hasSharedId = Boolean(incidentSessionId || incidentTraceId || incidentRequestId);
    const confidenceScore =
        hasRequestAndError && hasSharedId ? 90
        : hasRequestAndError ? 72
        : 45;
    const confidenceLabel = getConfidenceLevel(confidenceScore);

    const executiveNarrative =
        `At ${timeFormatted}, an incident was captured` +
        (pageUrl ? ` on \`${pageUrl}\`` : ` in ${anchorError?.service ?? "the application"}`) +
        `. Halo correlated ${activeIncidentEvidence.length} telemetry point${activeIncidentEvidence.length !== 1 ? "s" : ""} to reconstruct the causal sequence.`;

    const verificationSteps: string[] = [
        requestEndpoint
            ? `Reproduce the conditions under which \`${reqLabel}\` was called.`
            : `Reproduce the conditions that triggered \`${parsedError.errorClass}\`.`,
        ...(requestEndpoint && requestStatus != null
            ? [`Confirm \`${requestEndpoint}\` returns HTTP 2xx under identical inputs.`]
            : []),
        ...(isDownstreamResponseHandler
            ? [`Confirm the client \`${parsedError.errorMessage}\` no longer occurs after the response guard is in place.`]
            : [`Confirm the \`${parsedError.errorMessage}\` no longer occurs.`]),
        ...(replaySession ? [`Verify the session replay for this occurrence shows a successful user journey.`] : []),
    ];

    const preventionGuardrails: string[] = [
        `Enforce strict response schema validation across all API endpoints.`,
        ...(requestEndpoint
            ? [`Add integration tests asserting correct error handling when \`${requestEndpoint}\` returns a non-2xx status.`]
            : []),
        `Enable TypeScript \`strictNullChecks\` to surface unchecked property access at build time.`,
        ...(requestEndpoint && requestStatus != null
            ? [`Configure a monitor alert for \`${requestEndpoint}\` error rate exceeding threshold.`]
            : []),
    ];

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
            confidenceLabel,
            confidenceScore,
            reasoning: reasoningPoints,
            isClientDownstream: isDownstreamResponseHandler,
        },
        causalStory,
        asciiFlow,
        whatHappened: {
            timeFormatted,
            pageUrl: pageUrl ?? "",
            userAction: {
                description: userActionDescription,
                provenance: "Observed",
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
        recommendations: {
            immediateInvestigation: {
                title: immediateTitle,
                description: immediateDesc,
                checklist: immediateChecklist,
            },
            likelyRemediation,
            verificationSteps,
            preventionGuardrails,
        },
    };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function parseErrorDetails(
    primaryError: Evidence | undefined,
    rootCause: Hypothesis | null
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
    const targetProperty = propMatch ? propMatch[1] : undefined;

    const isTypeError = /TypeError|ReferenceError|NullPointer|Cannot read properties|undefined is not|is not a function/i.test(fullText);
    const isDatabaseError = /Prisma|Postgres|Sequelize|TypeORM|Deadlock|Unique constraint|P2002|P2024|P2025|connection pool/i.test(fullText);
    const isNetworkTimeout = /ETIMEDOUT|ECONNREFUSED|504|Gateway Timeout|FetchError|AbortError|network timeout/i.test(fullText);
    const isAuthError = /JWT|token|Unauthorized|401|403|Forbidden|CSRF|signature/i.test(fullText);
    const isRateLimit = /429|Too Many Requests|rate limit|quota exceeded/i.test(fullText);

    const dbModelMatch = /prisma\.([a-zA-Z0-9_$]+)\./i.exec(stack + " " + fullText);
    const databaseModel = dbModelMatch ? dbModelMatch[1] : undefined;

    const classMatch = /([A-Z][a-zA-Z0-9_]*(?:Error|Exception))/i.exec(fullText);
    const errorClass = classMatch ? classMatch[1] : isTypeError ? "TypeError" : "RuntimeError";

    return {
        errorClass,
        errorMessage: primaryError?.title || rootCause?.title || "Unhandled Exception",
        failingFile: firstFrame?.file,
        failingFunction: firstFrame?.func,
        failingLine: firstFrame?.line,
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
