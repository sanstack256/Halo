/**
 * Halo Active Investigation & Repair Engine — Active Runtime Acquirer & Privacy Boundary
 *
 * Implements Phase 6 & Phase 7:
 * 1. Targeted runtime acquisition actions (RESOLVE_DYNAMIC_CALLEE, CAPTURE_ARGUMENT_SHAPE, etc.).
 * 2. Strict 4-tier privacy/sensitivity boundary (SAFE, REDACTABLE, SENSITIVE, FORBIDDEN).
 * 3. Never collects passwords, auth headers, private keys, or credentials.
 * 4. Extracts only minimal necessary structural shape.
 */

import type { InvestigationSnapshot, SourceAstAnalysis } from "../types";
import type { TargetedAcquisitionAction, SensitivityClassification } from "../evidence-types";

export interface RuntimeAcquisitionPlan {
    actions: TargetedAcquisitionAction[];
    redactedFields: string[];
    forbiddenFieldsEncountered: string[];
    isSafeToExecute: boolean;
}

const FORBIDDEN_FIELD_PATTERNS = [
    /password/i,
    /secret/i,
    /token/i,
    /key$/i,
    /auth/i,
    /bearer/i,
    /cookie/i,
    /session_?id/i,
    /ssn/i,
    /credit_?card/i,
];

const REDACTABLE_FIELD_PATTERNS = [
    /email/i,
    /user_?id/i,
    /username/i,
    /phone/i,
    /ip_?address/i,
    /customer_?id/i,
    /account_?id/i,
];

export function classifyFieldSensitivity(fieldName: string): SensitivityClassification {
    if (FORBIDDEN_FIELD_PATTERNS.some((p) => p.test(fieldName))) {
        return "FORBIDDEN";
    }
    if (REDACTABLE_FIELD_PATTERNS.some((p) => p.test(fieldName))) {
        return "REDACTABLE";
    }
    return "SAFE";
}

/**
 * Formulates the narrowest, decision-specific runtime acquisition plan.
 */
export function formulateRuntimeAcquisitionPlan(
    snapshot: InvestigationSnapshot,
    sourceAst: SourceAstAnalysis
): RuntimeAcquisitionPlan {
    const actions: TargetedAcquisitionAction[] = [];
    const redactedFields: string[] = [];
    const forbiddenFieldsEncountered: string[] = [];

    const failingExpr = sourceAst.failingExpression || snapshot.source?.failingExpression || "operation";
    const failingLoc = `${snapshot.failure.sourceLocation?.file || "unknown"}:${snapshot.failure.sourceLocation?.line || "?"}`;
    const inv = sourceAst.invocationAnalysis;

    // Check existing telemetry to correlate before prescribing new capture
    const hasReplay = Boolean(snapshot.replay?.isAvailable);
    const hasRequest = Boolean(snapshot.runtimeContext.requestId || snapshot.runtimeContext.route);
    const hasTrace = Boolean(snapshot.runtimeContext.traceId);

    if (hasReplay && !snapshot.replay?.eventsSummary?.length) {
        actions.push({
            id: "act-correlate-replay",
            actionType: "CORRELATE_REPLAY",
            targetLocation: failingLoc,
            requiredFact: "Correlated DOM and user actions from existing session replay",
            expectedInformationGain: "HIGH",
            sensitivity: "SAFE",
            estimatedOverhead: "NEGLIGIBLE",
            isAutomated: true,
            requiresUserAuthorization: false,
            description: "Correlate recorded session replay events preceding the unhandled error.",
        });
    }

    if (hasRequest && !snapshot.runtimeContext.httpMethod) {
        actions.push({
            id: "act-correlate-request",
            actionType: "CORRELATE_REQUEST",
            targetLocation: failingLoc,
            requiredFact: "Incoming HTTP request method and route parameters",
            expectedInformationGain: "HIGH",
            sensitivity: "SAFE",
            estimatedOverhead: "NEGLIGIBLE",
            isAutomated: true,
            requiresUserAuthorization: false,
            description: "Extract non-sensitive route metadata from correlated request headers.",
        });
    }

    // If dynamic callee is unresolvable (e.g. `await scenario.fn(context)`):
    if (inv && inv.calleeOpacity === "CALLEE_OPAQUE_UNRESOLVABLE") {
        actions.push({
            id: "act-resolve-dynamic-callee",
            actionType: "RESOLVE_DYNAMIC_CALLEE",
            targetLocation: failingLoc,
            targetSymbol: inv.calleeExpression,
            requiredFact: `Resolved callee identifier and object type for '${inv.calleeExpression}'`,
            expectedInformationGain: "CRITICAL",
            sensitivity: "SAFE",
            estimatedOverhead: "LOW",
            isAutomated: true,
            requiresUserAuthorization: false,
            description: `Observe the resolved runtime class or function identifier passed to '${inv.calleeExpression}'.`,
        });

        actions.push({
            id: "act-capture-rejection",
            actionType: "CAPTURE_PROMISE_REJECTION",
            targetLocation: failingLoc,
            targetSymbol: inv.calleeExpression,
            requiredFact: `Rejection value and inner cause rejected by '${inv.calleeExpression}'`,
            expectedInformationGain: "CRITICAL",
            sensitivity: "SAFE",
            estimatedOverhead: "LOW",
            isAutomated: true,
            requiresUserAuthorization: false,
            description: `Capture the specific rejection reason and inner error at the '${failingExpr}' boundary.`,
        });
    }

    // If arguments are missing:
    if (inv && inv.arguments.length > 0) {
        for (const arg of inv.arguments) {
            const sens = classifyFieldSensitivity(arg);
            if (sens === "FORBIDDEN") {
                forbiddenFieldsEncountered.push(arg);
            } else if (sens === "REDACTABLE") {
                redactedFields.push(arg);
            }
        }

        actions.push({
            id: "act-capture-argument-shape",
            actionType: "CAPTURE_ARGUMENT_SHAPE",
            targetLocation: failingLoc,
            targetSymbol: inv.arguments.join(", "),
            requiredFact: `Non-sensitive structural shape of arguments (${inv.arguments.join(", ")})`,
            expectedInformationGain: "HIGH",
            sensitivity: redactedFields.length > 0 ? "REDACTABLE" : "SAFE",
            estimatedOverhead: "LOW",
            isAutomated: true,
            requiresUserAuthorization: false,
            description: `Record structural types and non-sensitive keys for arguments passed to '${failingExpr}' with credentials masked.`,
        });
    }

    return {
        actions,
        redactedFields,
        forbiddenFieldsEncountered,
        isSafeToExecute: forbiddenFieldsEncountered.length === 0,
    };
}
