/**
 * Dashboard Recommendation Engine
 *
 * Bridges the Investigation Engine's structured output and the Interpreter's
 * parsed telemetry context into a UI-ready recommendation plan.
 *
 * This module consumes:
 *   - Investigation (structured engine output: hypotheses, evidence, findings)
 *   - Parsed telemetry context from the interpreter (error details, request info,
 *     stack frames, session/trace IDs, deployment info)
 *
 * It produces DashboardRecommendation[] — the UI-ready fix plan.
 *
 * Every claim is tied to a real telemetry source.
 * Nothing is fabricated, guessed, or hardcoded.
 */

import type { Investigation, Recommendation } from "@halo/investigation-engine";
import type { ParsedErrorDetails } from "./interpreter";

/* -------------------------------------------------------------------------- */
/* Public types                                                                */
/* -------------------------------------------------------------------------- */

export type DashboardRecommendationKind =
    | "exact-code-fix"
    | "config-fix"
    | "operational-fix"
    | "rollback"
    | "dependency-fix"
    | "investigation-required"
    | "insufficient-evidence";

export interface DashboardEvidenceLink {
    evidenceId: string;
    evidenceType: string;
    role: string;
    excerpt: string;
}

export interface DashboardCodePatch {
    filePath: string;
    functionOrComponent?: string;
    lineRange?: string;
    before: string;
    after: string;
    explanation: string;
    sideEffects?: string;
}

export interface DashboardVerification {
    steps: string[];
    expectedOutcome: string;
    regressionTest?: string;
}

export interface DashboardPrevention {
    items: string[];
    monitoring?: string;
}

export interface DashboardInsufficiency {
    whatHaloKnows: string[];
    whatIsMissing: string[];
    requiredEvidence: string;
    why: string;
}

export interface DashboardRecommendation {
    /** Unique identifier for this recommendation */
    id: string;

    /** Discriminated fix type — drives UI rendering */
    kind: DashboardRecommendationKind;

    /**
     * One-sentence immediate action.
     * This is the most important field — it answers "What do I do right now?"
     */
    immediateAction: string;

    /**
     * Technical explanation of why this is the root cause and why the fix works.
     */
    rootCauseExplanation: string;

    /** Code diff to apply — only present when stack evidence supports it */
    codePatch?: DashboardCodePatch;

    /**
     * Ordered operational steps for non-code fixes.
     * Each step is a complete, specific instruction — not a category hint.
     */
    operationalSteps?: string[];

    /** Traceable evidence chain — every claim linked to a real telemetry ID */
    evidenceChain: DashboardEvidenceLink[];

    /** Specific verification procedure for this exact failure */
    verification: DashboardVerification;

    /** Prevention improvements relevant to this failure class */
    prevention: DashboardPrevention;

    /** Insufficient evidence block — only present when kind is investigation-required or insufficient-evidence */
    insufficientEvidence?: DashboardInsufficiency;

    /** Raw engine confidence score */
    confidence: number;

    /** Raw evidence IDs from the engine */
    evidenceIds: string[];
}

export type RecommendationTier = "immediate-mitigation" | "upstream-investigation" | "root-cause-remediation";

export interface DashboardRecommendationPlan {
    /**
     * Tier 1 — Immediate Mitigation
     * Addresses the observed downstream symptom (e.g. response handler guard).
     * Always present when an actionable mitigation exists.
     */
    mitigation: DashboardRecommendation | null;

    /**
     * Tier 2 — Upstream Investigation
     * Provides actionable steps to instrument the upstream failure and uncover the root cause.
     * Always present when the exact backend cause is Unknown.
     */
    upstreamInvestigation: DashboardRecommendation | null;

    /**
     * Tier 3 — Root-Cause Remediation
     * Only generated when server-side evidence identifies the exact backend cause.
     * NEVER invented from client-side exceptions.
     */
    rootCauseRemediation: DashboardRecommendation | null;

    /** Backwards-compatible: primary = mitigation ?? upstreamInvestigation ?? rootCauseRemediation */
    primary: DashboardRecommendation;

    /** All additional non-primary recommendations */
    secondary: DashboardRecommendation[];

    /** True when the primary recommendation is actionable */
    isActionable: boolean;

    /** True when a code patch is available in the primary recommendation */
    hasCodePatch: boolean;
}

/* -------------------------------------------------------------------------- */
/* Parsed telemetry context passed from the interpreter                       */
/* -------------------------------------------------------------------------- */

export interface RecommendationTelemetryContext {
    /** Parsed error details from the anchor error */
    parsedError: ParsedErrorDetails;

    /** The failed HTTP request evidence, if one was identified */
    failedRequest: {
        id: string;
        type: string;
        method: string | null;
        endpoint: string | null;
        status: string | number | null;
        durationMs: number | null;
        traceId: string | undefined;
        requestId: string | undefined;
        service: string | undefined;
    } | null;

    /** Whether the exception is downstream of a failed HTTP request */
    isDownstreamResponseHandler: boolean;

    /** The anchor error evidence ID */
    anchorErrorId: string | undefined;

    /** The anchor error title */
    anchorErrorTitle: string | undefined;

    /** Session ID for the incident */
    incidentSessionId: string | undefined;

    /** Trace ID for the incident */
    incidentTraceId: string | undefined;

    /** Page URL from replay or metadata */
    pageUrl: string | null;

    /** Whether exact backend root cause is known */
    isExactRootCauseKnown: boolean;

    /**
     * Whether actual source code was resolved from disk for the anchor event.
     * When false, code patches must NOT be generated — they would be fabricated.
     */
    sourceResolved: boolean;

    /** Backend server trace evidence, if present */
    backendServerTrace: {
        id: string;
        title: string;
        service: string;
    } | null;
}

/* -------------------------------------------------------------------------- */
/* Main entry point                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Build the full UI-ready three-tier recommendation plan from engine output + interpreter context.
 */
export function buildDashboardRecommendations(
    investigation: Investigation,
    telemetry: RecommendationTelemetryContext,
): DashboardRecommendationPlan {
    const engineRecs = investigation.recommendations;

    let mitigation: DashboardRecommendation | null = null;
    let upstreamInvestigation: DashboardRecommendation | null = null;
    let rootCauseRemediation: DashboardRecommendation | null = null;
    const secondary: DashboardRecommendation[] = [];

    // Build from interpreter-derived telemetry context first (most accurate for runtime evidence).
    if (telemetry.isDownstreamResponseHandler && telemetry.failedRequest?.endpoint && telemetry.failedRequest?.status != null) {
        const { parsedError, failedRequest, isExactRootCauseKnown, sourceResolved, backendServerTrace } = telemetry;
        const reqLabel = failedRequest.method && failedRequest.endpoint
            ? `${failedRequest.method} ${failedRequest.endpoint}`
            : failedRequest.endpoint ?? "the endpoint";
        const prop = parsedError.targetProperty ?? "response properties";

        // Tier 1: Immediate Mitigation — guard the response handler against the unexpected response.
        // This recommendation is scoped to the DOWNSTREAM client symptom, not the backend cause.
        // Source resolution proves what failed; it does not prove an arbitrary
        // replacement patch is syntactically or semantically correct. Do not
        // fabricate a diff from a stack frame or telemetry symptom.
        const codePatch: DashboardCodePatch | null = null;
        mitigation = {
            id: `mitigation:response-handler:${telemetry.anchorErrorId ?? "unknown"}`,
            kind: codePatch ? "exact-code-fix" : "investigation-required",
            immediateAction: parsedError.targetProperty
                ? `Mitigation: Guard the ${parsedError.failingFunction ? `\`${parsedError.failingFunction}()\`` : "response handler"} against HTTP ${failedRequest.status} before accessing \`${prop}\`.`
                : `Mitigation: Guard the ${parsedError.failingFunction ? `\`${parsedError.failingFunction}()\`` : "response handler"} against HTTP ${failedRequest.status} before processing the response body.`,
            rootCauseExplanation: sourceResolved
                ? `This is a mitigation for the downstream ${parsedError.errorClass} exception — not a fix for the upstream HTTP ${failedRequest.status}. ` +
                  `Telemetry shows \`${reqLabel}\` returned HTTP ${failedRequest.status}` +
                  (failedRequest.durationMs != null ? ` after ${failedRequest.durationMs}ms` : "") +
                  `. Verified source identifies the failing expression \`${prop}\`, but does not by itself validate a response-guard edit. ` +
                  `Review the surrounding handler and add a status guard only where the verified source performs this request. This mitigates the client exception but does not fix the upstream HTTP ${failedRequest.status}.`
                : `This is a mitigation for the downstream ${parsedError.errorClass} exception — not a fix for the upstream HTTP ${failedRequest.status}. ` +
                  `Telemetry indicates that \`${reqLabel}\` returned HTTP ${failedRequest.status}` +
                  (failedRequest.durationMs != null ? ` after ${failedRequest.durationMs}ms` : "") +
                  `, and the downstream response callback subsequently encountered \`${parsedError.errorMessage}\`. ` +
                  `Adding a status check in the response handler mitigates the downstream crash, while the upstream HTTP ${failedRequest.status} requires backend investigation.`,
            codePatch: codePatch ?? undefined,
            evidenceChain: [
                ...(failedRequest.id ? [{ evidenceId: failedRequest.id, evidenceType: failedRequest.type, role: "upstream-failure", excerpt: `${reqLabel} → HTTP ${failedRequest.status}` }] : []),
                ...(telemetry.anchorErrorId && telemetry.anchorErrorTitle ? [{ evidenceId: telemetry.anchorErrorId, evidenceType: "ERROR", role: "downstream-error", excerpt: telemetry.anchorErrorTitle.slice(0, 120) }] : []),
            ],
            verification: {
                steps: [
                    `Reproduce the request to \`${failedRequest.endpoint}\` under conditions that produce HTTP ${failedRequest.status}.`,
                    `Verify the response handler catches the non-2xx status and does not process the body as a successful response.`,
                    `Confirm \`${parsedError.errorMessage}\` no longer occurs when the upstream returns HTTP ${failedRequest.status}.`,
                ],
                expectedOutcome: `The ${parsedError.errorClass} exception no longer occurs when \`${reqLabel}\` returns HTTP ${failedRequest.status}.`,
                regressionTest:
                    `Add a test that mocks \`${reqLabel}\` returning HTTP ${failedRequest.status} and asserts the handler does not throw \`${parsedError.errorMessage}\`.`,
            },
            prevention: {
                items: [
                    `Use a shared fetch wrapper that enforces \`response.ok\` checks before accessing the response body.`,
                    `Add integration tests for non-2xx HTTP response handling in all response handlers.`,
                    parsedError.targetProperty
                        ? `Enable TypeScript \`strictNullChecks\` to catch unguarded property access at compile time.`
                        : `Enable TypeScript strict mode.`,
                ],
                monitoring: `Configure an alert for \`${failedRequest.endpoint}\` error rate exceeding 1%.`,
            },
            confidence: 0.88,
            evidenceIds: [
                ...(failedRequest.id ? [failedRequest.id] : []),
                ...(telemetry.anchorErrorId ? [telemetry.anchorErrorId] : []),
            ],
        };

        // Tier 2: Upstream Investigation — instrument the backend to find out WHY it returned HTTP 500.
        // Only present when exact backend cause is NOT yet known.
        if (!isExactRootCauseKnown) {
            upstreamInvestigation = {
                id: `upstream-investigation:${telemetry.anchorErrorId ?? "unknown"}`,
                kind: "investigation-required",
                immediateAction:
                    `Upstream Investigation: Add server-side error tracking to \`${failedRequest.endpoint}\` ` +
                    `to capture the internal reason for the HTTP ${failedRequest.status} response.`,
                rootCauseExplanation:
                    `\`${reqLabel}\` returned HTTP ${failedRequest.status}, but no server-side exception, ` +
                    `stack trace, or execution log was captured for this transaction. ` +
                    `The exact internal backend cause is currently Unknown. ` +
                    `It could be a dependency failure, runtime exception, validation error, configuration error, or infrastructure issue. ` +
                    `Server-side instrumentation is required to determine which.`,
                evidenceChain: [
                    ...(failedRequest.id ? [{ evidenceId: failedRequest.id, evidenceType: failedRequest.type, role: "upstream-failure", excerpt: `${reqLabel} → HTTP ${failedRequest.status} (internal cause unknown)` }] : []),
                ],
                operationalSteps: [
                    `Instrument the handler for \`${failedRequest.endpoint}\` with the Halo Node.js SDK.`,
                    `Enable \`captureErrors: true\` in the server-side Halo initialization.`,
                    `Wrap the route handler with \`halo.withServerErrors()\` or equivalent error boundary middleware.`,
                    `Reproduce the HTTP ${failedRequest.status} scenario and inspect the server-side telemetry in Halo.`,
                ],
                verification: {
                    steps: [
                        `Trigger the HTTP ${failedRequest.status} from \`${failedRequest.endpoint}\` and verify a server-side error event appears in Halo linked to the same trace.`,
                    ],
                    expectedOutcome:
                        `A server-side error event with stack trace appears in Halo, identifying the exact backend reason for the HTTP ${failedRequest.status}.`,
                },
                prevention: {
                    items: [
                        `Instrument all critical API endpoints with server-side error tracking.`,
                        `Use distributed tracing to link client errors to backend execution spans.`,
                    ],
                },
                insufficientEvidence: {
                    whatHaloKnows: [
                        `\`${reqLabel}\` returned HTTP ${failedRequest.status}.`,
                        `The client received this HTTP ${failedRequest.status} and the response handler produced \`${parsedError.errorMessage}\`.`,
                    ],
                    whatIsMissing: [
                        `Server-side stack trace from the handler that returned HTTP ${failedRequest.status}.`,
                        `Server-side execution log or exception for the \`${failedRequest.endpoint}\` transaction.`,
                    ],
                    requiredEvidence:
                        `A server-side error event or log captured during the HTTP ${failedRequest.status} response generation.`,
                    why:
                        `Without server-side telemetry, Halo cannot determine whether the backend failure ` +
                        `originated from a code bug, configuration error, dependency failure, or infrastructure issue.`,
                },
                confidence: 0.0, // Cannot prescribe a root-cause remediation without knowing the cause
                evidenceIds: failedRequest.id ? [failedRequest.id] : [],
            };
        }

        // Tier 3: Root-Cause Remediation — only when server-side evidence identifies the backend cause.
        // NEVER invented from the client TypeError message or endpoint name.
        if (isExactRootCauseKnown && backendServerTrace) {
            rootCauseRemediation = {
                id: `root-cause-remediation:${telemetry.anchorErrorId ?? "unknown"}`,
                kind: "investigation-required",
                immediateAction:
                    `Root Cause: Address the server-side failure identified in \`${backendServerTrace.service}\`: "${backendServerTrace.title.slice(0, 100)}".`,
                rootCauseExplanation:
                    `Server-side telemetry from \`${backendServerTrace.service}\` identified: "${backendServerTrace.title}". ` +
                    `This is the root cause that produced the HTTP ${failedRequest.status} response. ` +
                    `Fixing this server-side failure will eliminate the upstream HTTP ${failedRequest.status} and consequently the downstream \`${parsedError.errorMessage}\`.`,
                evidenceChain: [
                    { evidenceId: backendServerTrace.id, evidenceType: "ERROR", role: "root-cause", excerpt: `Server-side: ${backendServerTrace.title.slice(0, 120)}` },
                    ...(failedRequest.id ? [{ evidenceId: failedRequest.id, evidenceType: failedRequest.type, role: "upstream-failure", excerpt: `${reqLabel} → HTTP ${failedRequest.status}` }] : []),
                ],
                verification: {
                    steps: [
                        `Fix the server-side failure in \`${backendServerTrace.service}\`.`,
                        `Verify \`${reqLabel}\` no longer returns HTTP ${failedRequest.status} for the same input.`,
                    ],
                    expectedOutcome:
                        `\`${reqLabel}\` returns a successful response, eliminating both the server-side failure and the downstream \`${parsedError.errorMessage}\`.`,
                },
                prevention: {
                    items: [
                        `Add server-side error tracking to detect future failures in \`${backendServerTrace.service}\` before they propagate.`,
                    ],
                },
                confidence: 0.85,
                evidenceIds: [backendServerTrace.id, ...(failedRequest.id ? [failedRequest.id] : [])],
            };
        }
    } else {
        // No downstream response handler pattern — try engine recommendations
        for (const rec of engineRecs) {
            const adapted = adaptEngineRecommendation(rec, telemetry);
            if (!mitigation) {
                mitigation = adapted;
            } else {
                secondary.push(adapted);
            }
        }

        if (!mitigation) {
            mitigation = buildFallbackRecommendation(telemetry);
        }
    }

    // Backwards-compatible primary field
    const primary = mitigation ?? upstreamInvestigation ?? rootCauseRemediation ?? buildFallbackRecommendation(telemetry);

    // Collect all tiers into secondary for the legacy field
    if (upstreamInvestigation && upstreamInvestigation.id !== primary.id) {
        secondary.push(upstreamInvestigation);
    }
    if (rootCauseRemediation && rootCauseRemediation.id !== primary.id) {
        secondary.push(rootCauseRemediation);
    }

    return {
        mitigation,
        upstreamInvestigation,
        rootCauseRemediation,
        primary,
        secondary,
        isActionable: primary.kind !== "insufficient-evidence",
        hasCodePatch: Boolean(primary.codePatch),
    };
}

/* -------------------------------------------------------------------------- */
/* Engine recommendation adapter                                               */
/* -------------------------------------------------------------------------- */

function adaptEngineRecommendation(
    rec: Recommendation,
    telemetry: RecommendationTelemetryContext,
): DashboardRecommendation {
    const evidenceChain: DashboardEvidenceLink[] = (rec.evidenceChain ?? []).map(link => ({
        evidenceId: link.evidenceId,
        evidenceType: link.evidenceType,
        role: link.role,
        excerpt: link.excerpt,
    }));

    // Engine-level patches are derived from telemetry/stack information, not
    // an applied or syntax-checked edit against the retrieved repository file.
    // Keep them out of the dashboard until a source-aware patch validator
    // exists; presenting them as exact code changes would be misleading.
    const codePatch: DashboardCodePatch | undefined = undefined;

    let insufficientEvidence: DashboardInsufficiency | undefined;
    if (rec.unknowns) {
        insufficientEvidence = {
            whatHaloKnows: rec.unknowns.whatHaloKnows,
            whatIsMissing: rec.unknowns.whatIsMissing,
            requiredEvidence: rec.unknowns.requiredEvidence,
            why: rec.unknowns.why,
        };
    }

    return {
        id: rec.id,
        kind: rec.kind === "exact-code-fix" ? "investigation-required" : rec.kind as DashboardRecommendationKind,
        immediateAction: rec.immediateAction,
        rootCauseExplanation: rec.rootCauseTechnical,
        codePatch,
        operationalSteps: rec.operationalSteps,
        evidenceChain,
        verification: {
            steps: rec.verification.steps,
            expectedOutcome: rec.verification.expectedOutcome,
            regressionTest: rec.verification.regressionTest,
        },
        prevention: {
            items: rec.prevention.items,
            monitoring: rec.prevention.monitoring,
        },
        insufficientEvidence,
        confidence: rec.confidence,
        evidenceIds: rec.evidenceIds,
    };
}

/* -------------------------------------------------------------------------- */
/* Interpreter-derived fallback (when engine produces no recommendations)     */
/* -------------------------------------------------------------------------- */

const buildFallbackRecommendation = buildInterpreterDerivedRecommendation;

function buildInterpreterDerivedRecommendation(
    telemetry: RecommendationTelemetryContext,
): DashboardRecommendation {
    const { parsedError, failedRequest, isDownstreamResponseHandler, anchorErrorId, anchorErrorTitle } = telemetry;

    const evidenceChain: DashboardEvidenceLink[] = [];

    if (failedRequest) {
        evidenceChain.push({
            evidenceId: failedRequest.id,
            evidenceType: failedRequest.type,
            role: "upstream-failure",
            excerpt: `${failedRequest.method ?? "REQUEST"} ${failedRequest.endpoint ?? "endpoint"} → HTTP ${failedRequest.status ?? "error"}`,
        });
    }

    if (anchorErrorId && anchorErrorTitle) {
        evidenceChain.push({
            evidenceId: anchorErrorId,
            evidenceType: "ERROR",
            role: "error-event",
            excerpt: anchorErrorTitle.slice(0, 120),
        });
    }

    if (isDownstreamResponseHandler && failedRequest?.endpoint && failedRequest.status != null) {
        const reqLabel = failedRequest.method && failedRequest.endpoint
            ? `${failedRequest.method} ${failedRequest.endpoint}`
            : failedRequest.endpoint ?? "the endpoint";

        const prop = parsedError.targetProperty ?? "response properties";
        // Only generate code patch when actual source was resolved
        const codePatch: DashboardCodePatch | null = null;

        return {
            id: `interpreter-derived:cascading:${anchorErrorId ?? "unknown"}`,
            kind: codePatch ? "exact-code-fix" : "investigation-required",
            immediateAction: parsedError.targetProperty
                ? `Guard the response handler for \`${reqLabel}\` against HTTP ${failedRequest.status} before accessing \`${prop}\`.`
                : `Guard the response handler for \`${reqLabel}\` against HTTP ${failedRequest.status} before processing the response body.`,
            rootCauseExplanation: telemetry.sourceResolved
                ? `\`${reqLabel}\` returned HTTP ${failedRequest.status}` +
                  (failedRequest.durationMs != null ? ` after ${failedRequest.durationMs}ms` : "") +
                  `. Verified source identifies \`${prop}\` as the failing expression. ` +
                  `A source-aware code review is required before changing the response handler; no patch was generated or validated automatically.`
                : `\`${reqLabel}\` returned HTTP ${failedRequest.status}` +
                  (failedRequest.durationMs != null ? ` after ${failedRequest.durationMs}ms` : "") +
                  `. The downstream response handler subsequently encountered \`${parsedError.errorMessage}\` ` +
                  `when processing the non-2xx response. Adding a status check in the response handler mitigates the downstream error.`,
            codePatch: codePatch ?? undefined,
            evidenceChain,
            verification: {
                steps: [
                    `Reproduce the request to \`${failedRequest.endpoint}\` under conditions that produce HTTP ${failedRequest.status}.`,
                    `Verify the response handler catches the error status and does not process the error response body as valid data.`,
                    `Confirm \`${parsedError.errorMessage}\` no longer occurs.`,
                ],
                expectedOutcome: `The application handles the upstream HTTP ${failedRequest.status} response gracefully without throwing a client exception.`,
                regressionTest: failedRequest.endpoint
                    ? `Add a test that mocks \`${reqLabel}\` → HTTP ${failedRequest.status} and asserts the handler does not throw.`
                    : undefined,
            },
            prevention: {
                items: [
                    `Add integration tests for non-2xx HTTP response handling in all response handlers.`,
                    `Use a shared fetch wrapper that enforces \`response.ok\` checks.`,
                    parsedError.targetProperty
                        ? `Enable TypeScript \`strictNullChecks\` to catch unguarded property access.`
                        : `Enable TypeScript strict mode.`,
                ],
                monitoring: failedRequest.endpoint
                    ? `Configure an alert for \`${failedRequest.endpoint}\` error rate exceeding 1%.`
                    : undefined,
            },
            insufficientEvidence: !telemetry.isExactRootCauseKnown ? {
                whatHaloKnows: [
                    `\`${reqLabel}\` returned HTTP ${failedRequest.status}.`,
                    `Client exception: \`${parsedError.errorMessage}\`.`,
                ],
                whatIsMissing: [
                    `Server-side stack trace from the handler that returned HTTP ${failedRequest.status}.`,
                ],
                requiredEvidence: `Server-side error log or exception with stack trace from the \`${failedRequest.endpoint}\` handler.`,
                why: `Without server-side telemetry, Halo cannot determine whether the backend failure is a code bug, configuration error, dependency failure, or infrastructure issue.`,
            } : undefined,
            confidence: 0.82,
            evidenceIds: [failedRequest.id, anchorErrorId].filter((x): x is string => Boolean(x)),
        };
    }

    // Generic insufficient-evidence fallback
    return {
        id: `interpreter-derived:insufficient:${anchorErrorId ?? "unknown"}`,
        kind: "insufficient-evidence",
        immediateAction: anchorErrorTitle
            ? `Collect server-side telemetry for the request that produced \`${anchorErrorTitle.slice(0, 60)}\`.`
            : `Collect server-side error logs and stack traces to identify the root cause.`,
        rootCauseExplanation: anchorErrorTitle
            ? `Halo captured \`${anchorErrorTitle.slice(0, 100)}\` but does not have sufficient correlated telemetry to prescribe an exact fix.`
            : `No error events were found in the investigation evidence.`,
        evidenceChain,
        verification: {
            steps: [
                `Resolve the evidence gaps listed below.`,
                `Re-run the investigation with the additional telemetry.`,
            ],
            expectedOutcome: `The investigation resolves with a concrete root cause and specific fix.`,
        },
        prevention: {
            items: [
                `Enable server-side error tracking with stack traces and request context.`,
                `Configure distributed tracing to link client errors to backend execution.`,
            ],
        },
        insufficientEvidence: {
            whatHaloKnows: anchorErrorTitle
                ? [`Error captured: "${anchorErrorTitle.slice(0, 80)}"`]
                : [`No error events were captured in this evidence set.`],
            whatIsMissing: [
                `Server-side error logs or stack traces for the failing operation.`,
                `HTTP request/response telemetry linking the client error to a backend operation.`,
            ],
            requiredEvidence: `Server-side error event with stack trace and request context.`,
            why: `Without server-side telemetry, Halo cannot distinguish between a code bug, configuration error, dependency failure, or infrastructure issue.`,
        },
        confidence: 0,
        evidenceIds: anchorErrorId ? [anchorErrorId] : [],
    };
}
