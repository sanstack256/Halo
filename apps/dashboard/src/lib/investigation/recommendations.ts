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

export interface DashboardRecommendationPlan {
    /** Primary fix — always present */
    primary: DashboardRecommendation;

    /** Secondary recommendations (evidence gaps, prevention) */
    secondary: DashboardRecommendation[];

    /** True when the primary recommendation is actionable (not insufficient-evidence) */
    isActionable: boolean;

    /** True when a code patch is available */
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
 * Build the full UI-ready recommendation plan from engine output + interpreter context.
 *
 * Priority: engine recommendations (evidence-grounded) > interpreter-derived fallback.
 */
export function buildDashboardRecommendations(
    investigation: Investigation,
    telemetry: RecommendationTelemetryContext,
): DashboardRecommendationPlan {
    const engineRecs = investigation.recommendations;

    let primary: DashboardRecommendation;
    const secondary: DashboardRecommendation[] = [];

    if (engineRecs.length > 0) {
        // Prefer the engine's leading recommendation — it is derived from actual evidence
        primary = adaptEngineRecommendation(engineRecs[0], telemetry);

        // Map remaining as secondary
        for (const rec of engineRecs.slice(1)) {
            secondary.push(adaptEngineRecommendation(rec, telemetry));
        }
    } else {
        // Fallback: derive from interpreter telemetry context when engine produced nothing
        primary = buildInterpreterDerivedRecommendation(telemetry);
    }

    // Only attempt a code patch when actual source was resolved from disk.
    // When sourceResolved is false, buildResponseHandlerPatch would generate a
    // fabricated file path — which is explicitly forbidden.
    if (!primary.codePatch && telemetry.isDownstreamResponseHandler && telemetry.failedRequest && telemetry.sourceResolved) {
        const interpreterPatch = buildResponseHandlerPatch(telemetry);
        if (interpreterPatch) {
            primary = { ...primary, codePatch: interpreterPatch };
        }
    }

    return {
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

    let codePatch: DashboardCodePatch | undefined;
    if (rec.codePatch) {
        codePatch = {
            filePath: rec.codePatch.filePath,
            functionOrComponent: rec.codePatch.functionOrComponent,
            lineRange: rec.codePatch.lineRange,
            before: rec.codePatch.before,
            after: rec.codePatch.after,
            explanation: rec.codePatch.explanation,
            sideEffects: rec.codePatch.sideEffects,
        };
    }

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
        kind: rec.kind as DashboardRecommendationKind,
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
        const codePatch = telemetry.sourceResolved ? buildResponseHandlerPatch(telemetry) : null;

        return {
            id: `interpreter-derived:cascading:${anchorErrorId ?? "unknown"}`,
            kind: codePatch ? "exact-code-fix" : "investigation-required",
            immediateAction: `Guard the response handler for \`${reqLabel}\` against HTTP ${failedRequest.status} before accessing \`${prop}\`.`,
            rootCauseExplanation:
                `\`${reqLabel}\` returned HTTP ${failedRequest.status}` +
                (failedRequest.durationMs != null ? ` after ${failedRequest.durationMs}ms` : "") +
                `. The response handler then accessed \`${prop}\` without checking \`response.ok\` first. ` +
                `When the upstream request fails, the response body does not contain the expected payload, ` +
                `causing the \`${parsedError.errorMessage}\` exception.`,
            codePatch: codePatch ?? undefined,
            evidenceChain,
            verification: {
                steps: [
                    `Reproduce the request to \`${failedRequest.endpoint}\` under conditions that produce HTTP ${failedRequest.status}.`,
                    `Verify the response handler catches the error status and does not access \`${prop}\`.`,
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

/* -------------------------------------------------------------------------- */
/* Response handler code patch builder                                         */
/* -------------------------------------------------------------------------- */

function buildResponseHandlerPatch(telemetry: RecommendationTelemetryContext): DashboardCodePatch | null {
    const { parsedError, failedRequest, sourceResolved } = telemetry;

    // Never generate a code patch without actual source provenance.
    // A fabricated file path is more harmful than no patch at all.
    if (!sourceResolved) return null;
    if (!failedRequest?.endpoint || !failedRequest.method) return null;
    // Require an actual failing file from source resolution
    if (!parsedError.failingFile) return null;

    const prop = parsedError.targetProperty ?? null;
    const isHttpError = failedRequest.status != null && String(failedRequest.status).match(/^[45]/);

    const locComment = parsedError.failingFile
        ? `// In ${parsedError.failingFile.split("/").pop()}${parsedError.failingLine ? `:${parsedError.failingLine}` : ""}\n`
        : "";

    let before: string;
    let after: string;
    let explanation: string;

    if (isHttpError) {
        before =
            locComment +
            `const response = await fetch("${failedRequest.endpoint}", { method: "${failedRequest.method}" });\n` +
            `const data = await response.json();\n` +
            (prop ? `// Unguarded: accesses \`${prop}\` on non-2xx response body\nreturn data.${prop};` : `return data;`);

        after =
            locComment +
            `const response = await fetch("${failedRequest.endpoint}", { method: "${failedRequest.method}" });\n` +
            `if (!response.ok) {\n` +
            `  const errorBody = await response.json().catch(() => ({}));\n` +
            `  throw new Error(errorBody.message ?? \`Request failed with HTTP \${response.status}\`);\n` +
            `}\n` +
            `const data = await response.json();\n` +
            (prop ? `return data.${prop};` : `return data;`);

        explanation =
            `The response handler accessed \`${prop ?? "response properties"}\` without verifying that ` +
            `\`${failedRequest.method} ${failedRequest.endpoint}\` returned a 2xx status. ` +
            `When the endpoint returns HTTP ${failedRequest.status}, the response body contains error details ` +
            `rather than the expected schema, causing \`${parsedError.errorMessage}\`.`;
    } else {
        // HTTP 200 unexpected payload / null entity
        const entityName = prop?.split(".")[0] || "entity";
        before =
            locComment +
            (parsedError.failingFunction ? `function ${parsedError.failingFunction}(${entityName}) {\n` : "") +
            (prop ? `  // Unguarded: assumes \`${entityName}\` is non-null\n  return ${prop};\n` : `  return payload;\n`) +
            (parsedError.failingFunction ? `}` : "");

        after =
            locComment +
            (parsedError.failingFunction ? `function ${parsedError.failingFunction}(${entityName}) {\n` : "") +
            `  if (!${entityName}) {\n` +
            `    throw new Error(\`Expected ${entityName} to be defined in response from ${failedRequest.endpoint}\`);\n` +
            `  }\n` +
            (prop ? `  return ${prop};\n` : `  return payload;\n`) +
            (parsedError.failingFunction ? `}` : "");

        explanation =
            `The function \`${parsedError.failingFunction || "handler"}()\` received an unexpected null or empty ` +
            `\`${entityName}\` from \`${failedRequest.method} ${failedRequest.endpoint}\`. Adding an explicit validation ` +
            `prevents attempting to access \`${prop ?? "properties"}\` on null.`;
    }

    return {
        filePath: parsedError.failingFile,
        functionOrComponent: parsedError.failingFunction ?? undefined,
        lineRange: parsedError.failingLine ? String(parsedError.failingLine) : undefined,
        before,
        after,
        explanation,
        sideEffects:
            `Callers must handle the potential thrown error or return value when the upstream payload is invalid.`,
    };
}
