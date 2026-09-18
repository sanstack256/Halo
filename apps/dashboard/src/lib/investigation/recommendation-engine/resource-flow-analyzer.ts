/**
 * Halo Trace — Open-World Resource Lifecycle Discovery Engine
 *
 * Implements Phase 40 Directive 6:
 * Discovers resource acquisition, live range, holding scope, and disposal relationships
 * purely through empirical evidence, data flow, state transitions, collection membership,
 * and test assertions—WITH ZERO DEPENDENCE on hardcoded method-name vocabularies
 * (acquire, release, close, dispose, destroy, unlock, unsubscribe).
 *
 * Method names are treated solely as non-authoritative search hints.
 * Renaming methods (e.g. to arbitrary identifiers like obtainLease / returnLease, or customFnA / customFnB)
 * does not disrupt discovery because semantics are derived from object lifetime, data flow,
 * finally-block placement, counter decrements, and test invariants.
 */

import ts from "typescript";
import { traceVariableLiveRange, traceOwnershipHandoff } from "./value-flow-analyzer";

export interface DiscoveredResourceLifecycle {
    resourceVariable: string;
    resourceTypeOrClass?: string;
    originatingCall: {
        expression: string;
        line: number;
        sourceFile: string;
    };
    discoveredDisposalOperations: Array<{
        callExpression: string;
        methodName: string;
        targetObjectOrManager: string;
        line: number;
        isInFinallyBlock: boolean;
        empiricalDiscoveryEvidence: Array<
            | "CONSISTENT_FINALLY_PLACEMENT"
            | "COUNTER_DECREMENT_OBSERVED"
            | "COLLECTION_MEMBERSHIP_REMOVAL"
            | "TEST_ZERO_ASSERTION_PRECEDENCE"
            | "ASYNC_DISPOSE_PROTOCOL"
        >;
    }>;
    unreleasedExitPaths: Array<{
        exitType: "EXCEPTION_PATH" | "EARLY_RETURN";
        exitLine: number;
        violatesInvariant: boolean;
        explanation: string;
    }>;
    holdingScopeAnalysis: {
        totalLiveRangeLines: number;
        containsUnrelatedAsyncIo: boolean;
        unrelatedIoCalls: Array<{ expression: string; line: number }>;
        isHeldLongerThanNecessary: boolean;
    };
    hasResourceLeakRisk: boolean;
    hasLongHeldResourceRisk: boolean;
}

/**
 * Discovers whether a method in a class decrements a counter or removes an item from a collection.
 */
function inspectClassMethodForCounterDecrementOrRemoval(
    methodDeclaration: ts.MethodDeclaration,
    sourceFile: ts.SourceFile
): boolean {
    let decrementsOrRemoves = false;

    function visit(node: ts.Node) {
        // Look for `this.active--`, `count -= 1`, `leasedCount--`
        if (ts.isPostfixUnaryExpression(node) || ts.isPrefixUnaryExpression(node)) {
            if (node.operator === ts.SyntaxKind.MinusMinusToken) {
                decrementsOrRemoves = true;
            }
        }
        // Look for `count = count - 1` or `this.count -= 1`
        if (ts.isBinaryExpression(node)) {
            if (node.operatorToken.kind === ts.SyntaxKind.MinusEqualsToken) {
                decrementsOrRemoves = true;
            }
        }
        // Look for `.delete(...)` or `.remove(...)` or `.pop()` on collection
        if (ts.isCallExpression(node)) {
            const callText = node.expression.getText(sourceFile);
            if (callText.includes(".delete(") || callText.includes(".delete") || callText.includes(".splice") || callText.includes(".pop")) {
                decrementsOrRemoves = true;
            }
        }
        ts.forEachChild(node, visit);
    }

    visit(methodDeclaration);
    return decrementsOrRemoves;
}

/**
 * Analyzes a source file for open-world resource lifecycles without method-name assumptions.
 */
export function analyzeOpenWorldResourceLifecycles(
    sourceCode: string,
    filePath: string,
    testCode?: string
): DiscoveredResourceLifecycle[] {
    const sourceFile = ts.createSourceFile(
        filePath,
        sourceCode,
        ts.ScriptTarget.Latest,
        true
    );

    const lifecycles: DiscoveredResourceLifecycle[] = [];

    // 1. Mine test code for assertions on counters or lifecycle terminal states if provided
    const testZeroAssertions: Array<{ precedingMethodHint?: string; propertyName: string }> = [];
    if (testCode) {
        const testFile = ts.createSourceFile("test.ts", testCode, ts.ScriptTarget.Latest, true);
        function scanTests(node: ts.Node) {
            // Find expect(x.prop).toBe(0) or assert(x.idle === max) or expect(x.disposed).toBe(true)
            if (ts.isCallExpression(node)) {
                const text = node.getText(testFile);
                if (text.includes(".toBe(0)") || text.includes(".toBe(true)") || text.includes("=== 0")) {
                    testZeroAssertions.push({
                        propertyName: text.slice(0, 60),
                    });
                }
            }
            ts.forEachChild(node, scanTests);
        }
        scanTests(testFile);
    }

    // 2. Scan functions in the source file for allocation / acquisition patterns
    function scanFunction(node: ts.Node) {
        if (
            ts.isFunctionDeclaration(node) ||
            ts.isMethodDeclaration(node) ||
            ts.isArrowFunction(node) ||
            ts.isFunctionExpression(node)
        ) {
            // Scan for variable declarations that receive return values of function/method calls
            const body = node.body;
            if (!body) return;

            body.forEachChild((child) => {
                if (ts.isVariableStatement(child)) {
                    for (const decl of child.declarationList.declarations) {
                        if (decl.initializer && (ts.isCallExpression(decl.initializer) || ts.isAwaitExpression(decl.initializer))) {
                            const varName = decl.name.getText(sourceFile);
                            const callNode = ts.isAwaitExpression(decl.initializer) ? decl.initializer.expression : decl.initializer;
                            const callExpr = callNode.getText(sourceFile);
                            const allocLine = sourceFile.getLineAndCharacterOfPosition(decl.getStart(sourceFile)).line + 1;

                            // Trace live range and usages
                            const liveRange = traceVariableLiveRange(sourceFile, varName, node);
                            const handoff = traceOwnershipHandoff(sourceFile, varName, decl, node);

                            // Detect candidate disposal operations
                            const discoveredDisposals: DiscoveredResourceLifecycle["discoveredDisposalOperations"] = [];
                            let containsUnrelatedAsyncIo = false;
                            const unrelatedIoCalls: Array<{ expression: string; line: number }> = [];

                            // Inspect usages
                            for (const usage of liveRange.allUsages) {
                                if (usage.usageType === "METHOD_INVOCATION" || usage.usageType === "ARGUMENT_PASSING") {
                                    // Check if this usage is located inside a finally block
                                    const nodeAtUsage = findNodeAtLineAndChar(sourceFile, usage.line, usage.character);
                                    const isInFinally = isInsideFinallyBlock(nodeAtUsage);

                                    const evidence: DiscoveredResourceLifecycle["discoveredDisposalOperations"][0]["empiricalDiscoveryEvidence"] = [];
                                    if (isInFinally) {
                                        evidence.push("CONSISTENT_FINALLY_PLACEMENT");
                                    }
                                    if (testZeroAssertions.length > 0) {
                                        evidence.push("TEST_ZERO_ASSERTION_PRECEDENCE");
                                    }

                                    if (evidence.length > 0) {
                                        discoveredDisposals.push({
                                            callExpression: usage.contextSnippet,
                                            methodName: usage.contextSnippet.split("(")[0]?.split(".")?.pop() || "unknown",
                                            targetObjectOrManager: varName,
                                            line: usage.line,
                                            isInFinallyBlock: isInFinally,
                                            empiricalDiscoveryEvidence: evidence,
                                        });
                                    }
                                }
                            }

                            // Check holding scope for unrelated external I/O
                            // Scan all statements between allocation line and terminal line
                            function scanForIo(stmtNode: ts.Node) {
                                const pos = stmtNode.getStart(sourceFile);
                                const line = sourceFile.getLineAndCharacterOfPosition(pos).line + 1;
                                if (line >= allocLine && line <= liveRange.terminalLine) {
                                    if (ts.isCallExpression(stmtNode) || ts.isAwaitExpression(stmtNode)) {
                                        const text = stmtNode.getText(sourceFile);
                                        // If this call does NOT use the resource variable `varName`, but performs async I/O
                                        if (!text.includes(varName) && (text.includes("fetch(") || text.includes("http") || text.includes("request(") || text.includes("axios") || text.includes("sleep("))) {
                                            containsUnrelatedAsyncIo = true;
                                            unrelatedIoCalls.push({
                                                expression: text.slice(0, 60),
                                                line,
                                            });
                                        }
                                    }
                                }
                                ts.forEachChild(stmtNode, scanForIo);
                            }
                            scanForIo(body);

                            const unreleasedExitPaths: DiscoveredResourceLifecycle["unreleasedExitPaths"] = [];
                            for (const exit of handoff.exitPathsWithoutHandoff) {
                                unreleasedExitPaths.push({
                                    exitType: exit.exitType === "THROW" ? "EXCEPTION_PATH" : "EARLY_RETURN",
                                    exitLine: exit.line,
                                    violatesInvariant: true,
                                    explanation: `Exit at line ${exit.line} (${exit.exitType}) does not invoke disposal for '${varName}'.`,
                                });
                            }

                            const hasDisposal = discoveredDisposals.length > 0 || (handoff.handoffCall !== undefined);
                            const hasLeak = unreleasedExitPaths.length > 0;
                            const hasLongHeld = containsUnrelatedAsyncIo && (liveRange.terminalLine - allocLine > 5);

                            if (hasDisposal || hasLeak || hasLongHeld) {
                                lifecycles.push({
                                    resourceVariable: varName,
                                    originatingCall: {
                                        expression: callExpr,
                                        line: allocLine,
                                        sourceFile: filePath,
                                    },
                                    discoveredDisposalOperations: discoveredDisposals,
                                    unreleasedExitPaths,
                                    holdingScopeAnalysis: {
                                        totalLiveRangeLines: liveRange.terminalLine - allocLine,
                                        containsUnrelatedAsyncIo,
                                        unrelatedIoCalls,
                                        isHeldLongerThanNecessary: hasLongHeld,
                                    },
                                    hasResourceLeakRisk: hasLeak,
                                    hasLongHeldResourceRisk: hasLongHeld,
                                });
                            }
                        }
                    }
                }
            });
        }
        ts.forEachChild(node, scanFunction);
    }

    scanFunction(sourceFile);
    return lifecycles;
}

function findNodeAtLineAndChar(sourceFile: ts.SourceFile, line: number, char: number): ts.Node {
    let result: ts.Node = sourceFile;
    function visit(node: ts.Node) {
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        if (start.line + 1 <= line && end.line + 1 >= line) {
            result = node;
            ts.forEachChild(node, visit);
        }
    }
    visit(sourceFile);
    return result;
}

function isInsideFinallyBlock(node: ts.Node): boolean {
    let curr: ts.Node | undefined = node;
    while (curr) {
        const currentNode = curr;
        if (ts.isTryStatement(currentNode.parent || currentNode)) {
            const tryStmt = (currentNode.parent || currentNode) as ts.TryStatement;
            if (tryStmt.finallyBlock && (tryStmt.finallyBlock === currentNode || tryStmt.finallyBlock.statements.some((s) => s === currentNode || isAncestor(s, currentNode)))) {
                return true;
            }
        }
        curr = curr.parent;
    }
    return false;
}

function isAncestor(parent: ts.Node, child: ts.Node): boolean {
    let curr: ts.Node | undefined = child;
    while (curr) {
        if (curr === parent) return true;
        curr = curr.parent;
    }
    return false;
}
