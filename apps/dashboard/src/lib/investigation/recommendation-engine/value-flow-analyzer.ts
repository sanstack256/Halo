/**
 * Halo Trace — Value and Data-Flow Analyzer
 *
 * Implements Phase 40 Phase E:
 * Tracks interprocedural data flow, returned-value flow, variable live ranges,
 * parameter bindings, and ownership transfers across AST control flow.
 */

import ts from "typescript";

export interface ValueLiveRange {
    variableName: string;
    declarationLine: number;
    terminalLine: number;
    scopeStartLine: number;
    scopeEndLine: number;
    allUsages: Array<{
        line: number;
        character: number;
        usageType: "READ" | "WRITE" | "ARGUMENT_PASSING" | "METHOD_INVOCATION" | "RETURN";
        contextSnippet: string;
    }>;
    isPassedToExternalManager: boolean;
    externalManagerCall?: {
        managerExpression: string;
        methodName: string;
        line: number;
    };
    hasEscapedScope: boolean;
}

export interface OwnershipHandoffRecord {
    resourceIdentifier: string;
    originatingExpression: string;
    originatingLine: number;
    handoffCall?: {
        callee: string;
        argumentIndex: number;
        line: number;
        isInFinallyBlock: boolean;
        isGuardedByTryCatch: boolean;
    };
    exitPathsWithoutHandoff: Array<{
        exitType: "RETURN" | "THROW" | "BREAK" | "FALLTHROUGH";
        line: number;
        scopeDescription: string;
    }>;
    isFullySafeguarded: boolean;
}

/**
 * Traces the physical live range and usage points of a variable within an AST block.
 */
export function traceVariableLiveRange(
    sourceFile: ts.SourceFile,
    variableName: string,
    enclosingFunctionOrBlock: ts.Node
): ValueLiveRange {
    const usages: ValueLiveRange["allUsages"] = [];
    let declarationLine = 0;
    let terminalLine = 0;
    let isPassedToExternalManager = false;
    let externalManagerCall: ValueLiveRange["externalManagerCall"] = undefined;
    let hasEscapedScope = false;

    const startPos = enclosingFunctionOrBlock.getStart(sourceFile);
    const endPos = enclosingFunctionOrBlock.getEnd();
    const scopeStartLine = sourceFile.getLineAndCharacterOfPosition(startPos).line + 1;
    const scopeEndLine = sourceFile.getLineAndCharacterOfPosition(endPos).line + 1;

    function visit(node: ts.Node) {
        if (ts.isIdentifier(node) && node.text === variableName) {
            const pos = node.getStart(sourceFile);
            const line = sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
            const character = sourceFile.getLineAndCharacterOfPosition(pos).character;
            const parent = node.parent;

            let usageType: ValueLiveRange["allUsages"][0]["usageType"] = "READ";

            if (ts.isVariableDeclaration(parent) && parent.name === node) {
                usageType = "WRITE";
                if (!declarationLine) declarationLine = line;
            } else if (ts.isBinaryExpression(parent) && parent.left === node && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                usageType = "WRITE";
            } else if (ts.isCallExpression(parent) && parent.arguments.includes(node as any)) {
                usageType = "ARGUMENT_PASSING";
                // Check if passing to a manager (e.g. pool.release(conn) or manager.unregister(handle))
                if (ts.isPropertyAccessExpression(parent.expression)) {
                    isPassedToExternalManager = true;
                    externalManagerCall = {
                        managerExpression: parent.expression.expression.getText(sourceFile),
                        methodName: parent.expression.name.getText(sourceFile),
                        line,
                    };
                }
            } else if (ts.isPropertyAccessExpression(parent) && parent.expression === node) {
                usageType = "METHOD_INVOCATION";
            } else if (ts.isReturnStatement(parent) || (ts.isArrowFunction(parent) && parent.body === node)) {
                usageType = "RETURN";
                hasEscapedScope = true;
            }

            usages.push({
                line,
                character,
                usageType,
                contextSnippet: parent.getText(sourceFile).slice(0, 80),
            });

            if (line > terminalLine) {
                terminalLine = line;
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(enclosingFunctionOrBlock);

    return {
        variableName,
        declarationLine: declarationLine || scopeStartLine,
        terminalLine: terminalLine || declarationLine || scopeStartLine,
        scopeStartLine,
        scopeEndLine,
        allUsages: usages,
        isPassedToExternalManager,
        externalManagerCall,
        hasEscapedScope,
    };
}

/**
 * Traces whether a resource variable undergoes proper ownership handoff across all exit paths.
 */
export function traceOwnershipHandoff(
    sourceFile: ts.SourceFile,
    resourceIdentifier: string,
    allocationNode: ts.Node,
    enclosingFunction: ts.Node
): OwnershipHandoffRecord {
    const allocLine = sourceFile.getLineAndCharacterOfPosition(allocationNode.getStart(sourceFile)).line + 1;
    let handoffCall: OwnershipHandoffRecord["handoffCall"] = undefined;
    const exitPathsWithoutHandoff: OwnershipHandoffRecord["exitPathsWithoutHandoff"] = [];

    // Pre-pass: Check for any disposal/handoff within a finally block
    let finallyHandoffCall: OwnershipHandoffRecord["handoffCall"] = undefined;
    function preScanFinally(node: ts.Node) {
        if (ts.isTryStatement(node) && node.finallyBlock) {
            function checkFinallyNode(childNode: ts.Node) {
                if (ts.isCallExpression(childNode)) {
                    const isMethodCallOnResource =
                        ts.isPropertyAccessExpression(childNode.expression) &&
                        childNode.expression.expression.getText(sourceFile) === resourceIdentifier;
                    const isArgumentToCall = childNode.arguments.some(
                        (arg) => arg.getText(sourceFile) === resourceIdentifier
                    );
                    if (isMethodCallOnResource || isArgumentToCall) {
                        const line = sourceFile.getLineAndCharacterOfPosition(childNode.getStart(sourceFile)).line + 1;
                        if (line > allocLine) {
                            finallyHandoffCall = {
                                callee: childNode.expression.getText(sourceFile),
                                argumentIndex: isArgumentToCall
                                    ? childNode.arguments.findIndex((a) => a.getText(sourceFile) === resourceIdentifier)
                                    : -1,
                                line,
                                isInFinallyBlock: true,
                                isGuardedByTryCatch: true,
                            };
                        }
                    }
                }
                ts.forEachChild(childNode, checkFinallyNode);
            }
            checkFinallyNode(node.finallyBlock);
        }
        ts.forEachChild(node, preScanFinally);
    }
    preScanFinally(enclosingFunction);

    if (finallyHandoffCall) {
        handoffCall = finallyHandoffCall;
    }

    // Scan for calls involving the identifier
    function findHandoff(node: ts.Node, inFinally = false, inTryCatch = false, inTryWithFinally = false) {
        if (ts.isTryStatement(node)) {
            const hasGuaranteedFinally = Boolean(node.finallyBlock && finallyHandoffCall);
            if (node.tryBlock) {
                node.tryBlock.forEachChild((child) =>
                    findHandoff(child, inFinally, true, inTryWithFinally || hasGuaranteedFinally)
                );
            }
            if (node.catchClause) {
                node.catchClause.forEachChild((child) =>
                    findHandoff(child, inFinally, true, inTryWithFinally || hasGuaranteedFinally)
                );
            }
            if (node.finallyBlock) {
                node.finallyBlock.forEachChild((child) =>
                    findHandoff(child, true, inTryCatch, inTryWithFinally)
                );
            }
            return;
        }

        if (ts.isCallExpression(node)) {
            const isMethodCallOnResource =
                ts.isPropertyAccessExpression(node.expression) &&
                node.expression.expression.getText(sourceFile) === resourceIdentifier;
            const isArgumentToCall = node.arguments.some((arg) => arg.getText(sourceFile) === resourceIdentifier);

            if (isMethodCallOnResource || isArgumentToCall) {
                const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
                // If it is later than allocation and in a finally block or at the end of scope
                if (line > allocLine && (!handoffCall || inFinally)) {
                    handoffCall = {
                        callee: node.expression.getText(sourceFile),
                        argumentIndex: isArgumentToCall
                            ? node.arguments.findIndex((a) => a.getText(sourceFile) === resourceIdentifier)
                            : -1,
                        line,
                        isInFinallyBlock: inFinally,
                        isGuardedByTryCatch: inTryCatch,
                    };
                }
            }
        }

        // Check for return / throw statements that exit before handoff
        if (ts.isReturnStatement(node)) {
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
            if (line > allocLine && !inFinally && !inTryWithFinally && (!handoffCall || line < handoffCall.line)) {
                exitPathsWithoutHandoff.push({
                    exitType: "RETURN",
                    line,
                    scopeDescription: "Return statement prior to resource handoff",
                });
            }
        }

        if (ts.isThrowStatement(node)) {
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
            if (line > allocLine && !inFinally && !inTryWithFinally && (!handoffCall || !handoffCall.isInFinallyBlock)) {
                exitPathsWithoutHandoff.push({
                    exitType: "THROW",
                    line,
                    scopeDescription: "Throw statement without finally-block handoff",
                });
            }
        }

        ts.forEachChild(node, (child) => findHandoff(child, inFinally, inTryCatch, inTryWithFinally));
    }

    findHandoff(enclosingFunction);

    const capturedHandoff = handoffCall as OwnershipHandoffRecord["handoffCall"];

    return {
        resourceIdentifier,
        originatingExpression: allocationNode.getText(sourceFile),
        originatingLine: allocLine,
        handoffCall: capturedHandoff,
        exitPathsWithoutHandoff,
        isFullySafeguarded: Boolean(capturedHandoff && capturedHandoff.isInFinallyBlock && exitPathsWithoutHandoff.length === 0),
    };
}
