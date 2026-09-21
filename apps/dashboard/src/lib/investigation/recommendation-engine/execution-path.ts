/**
 * Halo Recommendation Engine — Execution Path Reconstruction
 *
 * Implements Phase C (Section 6):
 * Reconstructs the narrowest evidence-backed execution path:
 * caller -> function -> expression -> callee -> downstream operation -> exception.
 * Classifies every edge as:
 *   - RUNTIME_OBSERVED (captured in stack trace or span)
 *   - STATICALLY_ESTABLISHED (verified via source AST)
 *   - INFERRED_FROM_SOURCE (deduced structural caller/callee)
 *   - UNRESOLVED (missing evidence boundary)
 */

import type {
    InvestigationSnapshot,
    ExecutionPathReconstruction,
    ExecutionPathStep,
    DynamicDispatchResolution,
} from "./types";
import { resolveDynamicDispatch } from "./call-graph-resolver";

export interface EnhancedExecutionPathReconstruction extends ExecutionPathReconstruction {
    dynamicDispatchResolutions: DynamicDispatchResolution[];
    deepestSourceLocation?: {
        filePath: string;
        lineNumber?: number;
        symbol?: string;
        provenance: string;
    };
}

export function reconstructExecutionPath(snapshot: InvestigationSnapshot): EnhancedExecutionPathReconstruction {
    const steps: ExecutionPathStep[] = [];
    const missingEdges: string[] = [];
    const dynamicDispatchResolutions: DynamicDispatchResolution[] = [];

    const frames = snapshot.failure.frames;
    const source = snapshot.source;

    // Filter application frames in caller -> callee order
    const appFrames = frames
        .filter((f) => f.isApplication && f.filePath)
        .reverse(); // caller first, throwing frame last

    // 1. Incorporate upstream callers discovered from AST/callers metadata if present
    const sourceCallers = (source as any)?.callers;
    if (Array.isArray(sourceCallers) && sourceCallers.length > 0) {
        for (const c of sourceCallers) {
            const callerFile = c.callerFile || c.callerFilePath;
            const callerSymbol = c.callerSymbol || c.callerFunction;
            const callerLine = c.callSiteLine || c.callerLineNumber;
            if (callerFile && !appFrames.some((f) => f.filePath === callerFile)) {
                steps.push({
                    stepIndex: steps.length,
                    callerSymbol: callerSymbol || "upstream_caller",
                    calleeSymbol: source?.containingFunction || "callee",
                    filePath: callerFile,
                    lineNumber: callerLine,
                    classification: "STATICALLY_ESTABLISHED",
                    provenance: `Upstream caller discovered via AST call graph (${callerSymbol} in ${callerFile})`,
                    isFailingSite: false,
                });
            }
        }
    }

    if (appFrames.length === 0 && frames.length > 0) {
        // Fallback to top frame if no isApplication flag matched
        const top = frames[0]!;
        steps.push({
            stepIndex: steps.length,
            callerSymbol: "external_caller",
            calleeSymbol: top.functionName || "anonymous",
            filePath: top.filePath,
            lineNumber: top.lineNumber,
            classification: "RUNTIME_OBSERVED",
            provenance: `Top stack frame observed at ${top.filePath}:${top.lineNumber || "?"}`,
            isFailingSite: true,
        });
    } else {
        for (let i = 0; i < appFrames.length; i++) {
            const frame = appFrames[i]!;
            const nextFrame = appFrames[i + 1];
            const isFailingSite = i === appFrames.length - 1;

            steps.push({
                stepIndex: steps.length,
                callerSymbol: frame.functionName || "anonymous",
                calleeSymbol: nextFrame?.functionName || (isFailingSite ? snapshot.failure.executingFunction : undefined),
                filePath: frame.filePath,
                lineNumber: frame.lineNumber,
                classification: "RUNTIME_OBSERVED",
                provenance: `Observed application stack frame #${frame.order} (${frame.functionName} in ${frame.filePath})`,
                isFailingSite,
            });
        }
    }

    // Connect throwing expression from AST if source was resolved
    if (source && source.failingExpression) {
        const lastStep = steps[steps.length - 1];
        if (lastStep) {
            lastStep.expression = source.failingExpression;
            lastStep.calleeSymbol = source.containingFunction || lastStep.calleeSymbol;
        }

        // Check for dynamic dispatch on failing expression (Rule 5)
        const isDynamicCall = source.failingExpression.includes("(") && source.failingExpression.includes(".");
        if (isDynamicCall && source.lines) {
            const sourceCode = source.lines.map((l) => l.content).join("\n");
            // Check if runtime telemetry has a hint for the dynamic target
            const runtimeHint = snapshot.failure.executingFunction
                ? { symbol: snapshot.failure.executingFunction, filePath: source.filePath, lineNumber: source.failingLineNumber }
                : undefined;
            const dispatchRes = resolveDynamicDispatch(
                source.failingExpression,
                sourceCode,
                source.filePath,
                runtimeHint
            );
            dynamicDispatchResolutions.push({
                callSiteExpression: source.failingExpression,
                interfaceOrBaseType: dispatchRes.calleeIdentifier,
                state: dispatchRes.classification,
                possibleImplementations: dispatchRes.candidates.map((c) => ({
                    name: c.targetSymbol,
                    filePath: c.filePath,
                    resolutionEvidence: c.resolutionMechanism,
                    isRuntimeConfirmed: c.confidence === "CONFIRMED_RUNTIME",
                })),
                uncertaintyRationale: dispatchRes.reconciliationNotes.join("; "),
            });
        }

        // Add expression execution edge
        steps.push({
            stepIndex: steps.length,
            callerSymbol: source.containingFunction || lastStep?.callerSymbol || "function",
            calleeSymbol: undefined,
            expression: source.failingExpression,
            filePath: source.filePath,
            lineNumber: source.failingLineNumber,
            classification: "STATICALLY_ESTABLISHED",
            provenance: `AST parsed expression '${source.failingExpression}' at ${source.filePath}:${source.failingLineNumber}`,
            isFailingSite: true,
        });
    } else if (snapshot.failure.primaryFrame && !source) {
        missingEdges.push(
            `Exact AST expression in '${snapshot.failure.primaryFrame.filePath}' could not be resolved from repository.`
        );
    }

    // Deepest application frame supported by verified evidence
    const deepestAppFrame = frames.find((f) => f.isApplication && f.lineNumber) || frames[0];

    // Identify deepest source location supported by evidence (Instruction 4)
    let deepestSourceLocation: EnhancedExecutionPathReconstruction["deepestSourceLocation"] = undefined;
    if (source && source.filePath && source.resolutionStatus === "exact_file") {
        deepestSourceLocation = {
            filePath: source.filePath,
            lineNumber: source.failingLineNumber,
            symbol: source.containingFunction,
            provenance: `Verified repository source AST at ${source.filePath}:${source.failingLineNumber || "?"}`,
        };
    } else if (deepestAppFrame && deepestAppFrame.filePath) {
        deepestSourceLocation = {
            filePath: deepestAppFrame.filePath,
            lineNumber: deepestAppFrame.lineNumber,
            symbol: deepestAppFrame.functionName,
            provenance: `Deepest application stack frame observed at ${deepestAppFrame.filePath}:${deepestAppFrame.lineNumber || "?"}`,
        };
    }

    const isContinuous = steps.length > 0 && missingEdges.length === 0;

    return {
        steps,
        isContinuous,
        missingEdges,
        deepestApplicationFrame: deepestAppFrame,
        dynamicDispatchResolutions,
        deepestSourceLocation,
    };
}
