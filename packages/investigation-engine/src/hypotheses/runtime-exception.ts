import type { InvestigationContext } from "../types/context";
import type { Hypothesis, HypothesisMissingEvidence, HypothesisSupportingEvidence } from "../types/hypothesis";
import type { Reason } from "../types/reason";
import { parseStackTrace } from "../runtime/stack-parser";

export function generateRuntimeExceptionHypotheses(
    context: InvestigationContext
): Hypothesis[] {
    const hypotheses: Hypothesis[] = [];
    const errors = context.errors || [];
    const deployments = context.deployments || [];
    const graph = context.graph;

    const seenFingerprints = new Set<string>();

    for (const ev of errors) {
        // If a recent deployment on the same service exists, skip standalone runtime hypothesis to avoid competing duplicates
        const hasRecentDeployment = deployments.some(
            (d) => d.service === ev.service && Math.abs(ev.timestamp.getTime() - d.timestamp.getTime()) <= 30 * 60 * 1000
        );
        if (hasRecentDeployment) {
            continue;
        }

        const rawStack =
            typeof ev.metadata?.stack === "string"
                ? ev.metadata.stack
                : typeof ev.description === "string"
                ? ev.description
                : "";

        const frames = parseStackTrace(rawStack);
        const primaryFrame = frames.find((f) => f.isApplication && f.lineNumber) || frames[0];

        const text = [
            ev.title || "",
            ev.description || "",
            typeof ev.metadata?.error === "string" ? ev.metadata.error : "",
            typeof ev.metadata?.message === "string" ? ev.metadata.message : "",
            rawStack,
        ].join(" ");

        const isTypeError = /TypeError|Cannot read properties of undefined|Cannot read properties of null|is not a function|undefined is not/i.test(text);
        const isReferenceError = /ReferenceError|is not defined/i.test(text);
        const isSyntaxOrJsonError = /SyntaxError|Unexpected token|JSON\.parse/i.test(text);
        const isUnhandledRejection = /UnhandledPromiseRejection|unhandled rejection/i.test(text);

        // Do not generate a runtime exception hypothesis for plain generic errors with no runtime mechanism or stack frames
        if (!isTypeError && !isReferenceError && !isSyntaxOrJsonError && !isUnhandledRejection) {
            continue;
        }

        // Deduplicate identical errors
        const fingerprint = `${ev.service}:${ev.title}:${rawStack.slice(0, 100)}`;
        if (seenFingerprints.has(fingerprint)) {
            continue;
        }
        seenFingerprints.add(fingerprint);

        // Check if this error has an incoming causal edge from an upstream request or dependency in the graph
        const incomingCausalEdge = graph?.edges?.find(
            (e) => e.to === ev.id && (e.relationship === "DOWNSTREAM_FAILURE_OF" || e.relationship === "CAUSES" || e.relationship === "CHILD_SPAN_OF")
        );

        let errorMechanismTitle = "Runtime Exception";
        let errorMechanismDesc = `Exception occurred in ${ev.service}: "${ev.title}".`;
        let mechanismCategory = "runtime-exception";

        if (isTypeError) {
            const propMatch = /reading\s+['"]?([a-zA-Z0-9_$]+)['"]?/i.exec(text);
            const targetProp = propMatch ? propMatch[1] : undefined;
            errorMechanismTitle = targetProp
                ? `Null/Undefined Property Dereference (\`${targetProp}\`)`
                : "Unhandled TypeError (Null/Undefined Dereference)";
            errorMechanismDesc = `Application threw a TypeError while accessing ${targetProp ? `\`${targetProp}\`` : "properties on an undefined object"}${primaryFrame ? ` at ${primaryFrame.functionName} (${primaryFrame.filePath}:${primaryFrame.lineNumber})` : ""}.`;
            mechanismCategory = "type-error";
        } else if (isReferenceError) {
            errorMechanismTitle = "Undeclared Variable Reference (ReferenceError)";
            errorMechanismDesc = `Application referenced an undeclared variable${primaryFrame ? ` in ${primaryFrame.functionName} (${primaryFrame.filePath}:${primaryFrame.lineNumber})` : ""}.`;
            mechanismCategory = "reference-error";
        } else if (isSyntaxOrJsonError) {
            errorMechanismTitle = "Malformed Payload / JSON Parse Error";
            errorMechanismDesc = `JSON parsing failed due to unexpected token or truncated response body in ${ev.service}.`;
            mechanismCategory = "json-syntax";
        } else if (isUnhandledRejection) {
            errorMechanismTitle = "Unhandled Asynchronous Promise Rejection";
            errorMechanismDesc = `Asynchronous promise rejected without an active rejection handler in ${ev.service}.`;
            mechanismCategory = "unhandled-rejection";
        }

        const supportingReasons: Reason[] = [];
        const detailedSupporting: HypothesisSupportingEvidence[] = [];

        supportingReasons.push({
            type: "SUPPORTING",
            causalRole: incomingCausalEdge ? "SYMPTOM" : "CAUSE",
            title: `${ev.title || "Error"} captured in telemetry`,
            description: `Observed exception in ${ev.service} at ${ev.timestamp.toISOString()}.${primaryFrame ? ` Stack frame points to ${primaryFrame.filePath}:${primaryFrame.lineNumber || 0}.` : ""}`,
            strength: primaryFrame ? 0.8 : 0.6,
            evidenceIds: [ev.id],
        });

        detailedSupporting.push({
            evidenceId: ev.id,
            reason: `Direct telemetry recorded error "${ev.title}" in service ${ev.service}`,
            role: incomingCausalEdge ? "Symptom" : "Root cause candidate",
            strength: primaryFrame ? 0.8 : 0.6,
        });

        const missingReasons: Reason[] = [];
        const detailedMissing: HypothesisMissingEvidence[] = [];

        if (!primaryFrame || !primaryFrame.lineNumber) {
            missingReasons.push({
                type: "MISSING",
                causalRole: "CONTEXT",
                title: "Source code stack frame location is unavailable",
                description: "Stack trace does not contain application source line numbers, limiting root-cause localization.",
                evidenceIds: [ev.id],
                strength: 0.3,
            });
            detailedMissing.push({
                what: "Application source stack frames",
                why: "Required to localize the exact code statement responsible for the exception",
                impact: "Reduces precision of code-level diagnosis",
            });
        }

        if (!ev.traceId && !ev.requestId) {
            missingReasons.push({
                type: "MISSING",
                causalRole: "CONTEXT",
                title: "Distributed trace / request correlation ID is absent",
                description: "Telemetry lacks a traceId or requestId linking this error to an upstream HTTP or database request.",
                evidenceIds: [ev.id],
                strength: 0.3,
            });
            detailedMissing.push({
                what: "Trace correlation identifiers",
                why: "Needed to verify whether this exception was induced by an upstream service failure",
                impact: "Cannot rule out upstream causality with certainty",
            });
        }

        if (isTypeError) {
            missingReasons.push({
                type: "MISSING",
                causalRole: "CONTEXT",
                title: "Upstream origin of undefined property value is unobserved",
                description: "Telemetry establishes the immediate dereference crash at this code statement, but does not contain evidence explaining why the parent object was undefined (whether from an API response, database query, local state, or missing parameter).",
                evidenceIds: [ev.id],
                strength: 0.45,
            });
            detailedMissing.push({
                what: "Upstream origin of undefined object/property",
                why: "Required to determine why the dereferenced object was undefined rather than merely observing the runtime failure",
                impact: "The underlying root cause remains unobserved in active telemetry",
            });
        }

        const contradictingReasons: Reason[] = [];

        if (incomingCausalEdge) {
            contradictingReasons.push({
                type: "CONTRADICTING",
                causalRole: "CONTRADICTION",
                title: "Exception is preceded by an upstream failure in the causal graph",
                description: `Causal graph establishes this exception as downstream of an earlier request/span failure (${incomingCausalEdge.from}). Treating this exception as the primary root cause is contradicted.`,
                evidenceIds: [incomingCausalEdge.from, ev.id],
                strength: 0.7,
            });
        }

        const positiveScore = supportingReasons.reduce((acc, r) => acc + r.strength, 0);
        const negativeScore = contradictingReasons.reduce((acc, r) => acc + r.strength, 0);

        hypotheses.push({
            id: `runtime-exception:${mechanismCategory}:${ev.id}`,
            title: errorMechanismTitle,
            description: errorMechanismDesc,
            score: {
                positive: positiveScore,
                negative: negativeScore,
                unknown: missingReasons.reduce((acc, r) => acc + r.strength, 0),
            },
            confidence: 0,
            status: missingReasons.length > 0 ? "UNCERTAIN" : "CANDIDATE",
            supportingReasons,
            contradictingReasons,
            missingReasons,
            detailedSupportingEvidence: detailedSupporting,
            detailedMissingEvidence: detailedMissing,
            findingIds: [],
            evidenceIds: [ev.id],
            alternativeIds: [],
            provenance: ev.source,
            causalExplanation: `Telemetry in ${ev.service} observed ${errorMechanismTitle}. The immediate failure operation is confirmed, while the upstream origin of any missing values remains unobserved.`,
        });
    }

    return hypotheses;
}
