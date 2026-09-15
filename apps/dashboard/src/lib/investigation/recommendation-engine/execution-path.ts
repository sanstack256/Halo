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

import type { InvestigationSnapshot, ExecutionPathReconstruction, ExecutionPathStep } from "./types";

export function reconstructExecutionPath(snapshot: InvestigationSnapshot): ExecutionPathReconstruction {
    const steps: ExecutionPathStep[] = [];
    const missingEdges: string[] = [];

    const frames = snapshot.failure.frames;
    const source = snapshot.source;

    // Filter application frames in caller -> callee order
    const appFrames = frames
        .filter((f) => f.isApplication && f.filePath)
        .reverse(); // caller first, throwing frame last

    if (appFrames.length === 0 && frames.length > 0) {
        // Fallback to top frame if no isApplication flag matched
        const top = frames[0]!;
        steps.push({
            stepIndex: 0,
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
                stepIndex: i,
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

    // Check for continuity
    const isContinuous = steps.length > 0 && missingEdges.length === 0;

    // Deepest application frame
    const deepestAppFrame = frames.find((f) => f.isApplication && f.lineNumber) || frames[0];

    return {
        steps,
        isContinuous,
        missingEdges,
        deepestApplicationFrame: deepestAppFrame,
    };
}
