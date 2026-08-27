import type { InvestigationContext } from "../types/context";
import type { Hypothesis } from "../types/hypothesis";
import type { Reason } from "../types/reason";

export function generateRuntimeExceptionHypotheses(
    context: InvestigationContext
): Hypothesis[] {
    const hypotheses: Hypothesis[] = [];
    const errors = context.errors || [];
    const deployments = context.deployments || [];

    for (const ev of errors) {
        // If a recent deployment on the same service exists, the deployment is the primary root cause
        const hasRecentDeployment = deployments.some(
            (d) => d.service === ev.service && Math.abs(ev.timestamp.getTime() - d.timestamp.getTime()) <= 30 * 60 * 1000
        );
        if (hasRecentDeployment) {
            continue;
        }

        const text = [
            ev.title || "",
            ev.description || "",
            typeof ev.metadata?.error === "string" ? ev.metadata.error : "",
            typeof ev.metadata?.message === "string" ? ev.metadata.message : "",
            typeof ev.metadata?.stack === "string" ? ev.metadata.stack : "",
        ].join(" ");

        const isTypeError = /TypeError|Cannot read properties of undefined|Cannot read properties of null|is not a function|undefined is not/i.test(text);
        const isReferenceError = /ReferenceError|is not defined/i.test(text);
        const isSyntaxOrJsonError = /SyntaxError|Unexpected token|JSON\.parse/i.test(text);
        const isUnhandledRejection = /UnhandledPromiseRejection|unhandled rejection/i.test(text);

        if (isTypeError) {
            const propMatch = /reading\s+['"]?([a-zA-Z0-9_$]+)['"]?/i.exec(text);
            const targetProp = propMatch ? propMatch[1] : undefined;

            hypotheses.push({
                id: `runtime-exception:type-error:${ev.id}`,
                title: targetProp
                    ? `Null/Undefined Property Dereference (\`${targetProp}\`)`
                    : "Unhandled TypeError (Null/Undefined Dereference)",
                description: `Application threw a TypeError while accessing ${targetProp ? `\`${targetProp}\`` : "properties on an undefined object"}.`,
                score: {
                    positive: 2.2,
                    negative: 0,
                    unknown: 0,
                },
                confidence: 85,
                status: "CANDIDATE",
                supportingReasons: [
                    {
                        type: "SUPPORTING",
                        causalRole: "CAUSE",
                        title: "TypeError in stack trace",
                        description: `Stack trace captured property dereference failure on undefined state.`,
                        strength: 0.85,
                        evidenceIds: [ev.id],
                    },
                ],
                contradictingReasons: [],
                missingReasons: [],
                findingIds: [],
                evidenceIds: [ev.id],
                alternativeIds: [],
            });
        } else if (isReferenceError) {
            hypotheses.push({
                id: `runtime-exception:reference-error:${ev.id}`,
                title: "Undeclared Variable Reference (ReferenceError)",
                description: "Application referenced an undeclared or out-of-scope variable.",
                score: {
                    positive: 2.2,
                    negative: 0,
                    unknown: 0,
                },
                confidence: 85,
                status: "CANDIDATE",
                supportingReasons: [
                    {
                        type: "SUPPORTING",
                        causalRole: "CAUSE",
                        title: "ReferenceError in execution context",
                        description: "Attempted to evaluate an undefined variable name in code scope.",
                        strength: 0.85,
                        evidenceIds: [ev.id],
                    },
                ],
                contradictingReasons: [],
                missingReasons: [],
                findingIds: [],
                evidenceIds: [ev.id],
                alternativeIds: [],
            });
        } else if (isSyntaxOrJsonError) {
            hypotheses.push({
                id: `runtime-exception:json-syntax:${ev.id}`,
                title: "Malformed Payload / JSON Parse Error",
                description: "JSON parsing failed due to unexpected token or truncated response body.",
                score: {
                    positive: 2.2,
                    negative: 0,
                    unknown: 0,
                },
                confidence: 85,
                status: "CANDIDATE",
                supportingReasons: [
                    {
                        type: "SUPPORTING",
                        causalRole: "CAUSE",
                        title: "JSON parsing failure",
                        description: "Payload did not conform to valid JSON syntax.",
                        strength: 0.88,
                        evidenceIds: [ev.id],
                    },
                ],
                contradictingReasons: [],
                missingReasons: [],
                findingIds: [],
                evidenceIds: [ev.id],
                alternativeIds: [],
            });
        } else if (isUnhandledRejection) {
            hypotheses.push({
                id: `runtime-exception:unhandled-rejection:${ev.id}`,
                title: "Unhandled Asynchronous Promise Rejection",
                description: "An asynchronous operation rejected without an active .catch() or try/catch boundary.",
                score: {
                    positive: 2.2,
                    negative: 0,
                    unknown: 0,
                },
                confidence: 85,
                status: "CANDIDATE",
                supportingReasons: [
                    {
                        type: "SUPPORTING",
                        causalRole: "CAUSE",
                        title: "Uncaught Promise Rejection",
                        description: "Async rejection propagated to the global process unhandled handler.",
                        strength: 0.85,
                        evidenceIds: [ev.id],
                    },
                ],
                contradictingReasons: [],
                missingReasons: [],
                findingIds: [],
                evidenceIds: [ev.id],
                alternativeIds: [],
            });
        }
    }

    return hypotheses;
}
