/**
 * Halo Recommendation Engine — Source & AST Analysis
 *
 * Implements Phase C (Section 10) and Enforces Section 9:
 * Analyzes exact source code, AST nodes, surrounding context, guards, error handling,
 * and async boundaries. Retains epistemic separation: static structure != runtime execution.
 */

import ts from "typescript";
import type { InvestigationSnapshot, SourceAstAnalysis, CalleeOpacity, InvocationAnalysis } from "./types";

export function analyzeSourceAst(snapshot: InvestigationSnapshot): SourceAstAnalysis {
    const source = snapshot.source;

    if (!source || source.resolutionStatus !== "exact_file" || !source.lines || source.lines.length === 0) {
        return {
            hasExactSource: false,
            surroundingLines: [],
            guards: [],
            hasOptionalChaining: false,
            hasFallbackCoalescing: false,
            hasCatchBlock: false,
            errorPropagation: {
                originatesHere: false,
                isTransformed: false,
                isRethrown: false,
            },
        };
    }

    const fullCode = source.lines.map((l) => l.content).join("\n");
    const failingLine = source.failingLineNumber;
    const surroundingLines = source.lines;

    // Parse AST
    const sourceFile = ts.createSourceFile(
        source.filePath || "source.ts",
        fullCode,
        ts.ScriptTarget.Latest,
        true
    );

    const guards: SourceAstAnalysis["guards"] = [];
    const declaredFunctionNames: string[] = [];

    const sourceLines = source.lines;
    const lineOffset = (source.startLineNumber || sourceLines[0]?.lineNumber || 1) - 1;

    interface AstScanState {
        hasOptionalChaining: boolean;
        hasFallbackCoalescing: boolean;
        hasCatchBlock: boolean;
        originatesHere: boolean;
        isTransformed: boolean;
        isRethrown: boolean;
        discoveredFailingExpression?: string;
        functionParameters?: string[];
        optionalParameters?: string[];
        callNodeAtFailure?: ts.CallExpression;
        containsErrorConstructionMatchingMessage: boolean;
    }

    const scan: AstScanState = {
        hasOptionalChaining: false,
        hasFallbackCoalescing: false,
        hasCatchBlock: false,
        originatesHere: false,
        isTransformed: false,
        isRethrown: false,
        containsErrorConstructionMatchingMessage: false,
    };

    function visit(node: ts.Node) {
        const lineInSnippet = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
        const line = sourceLines[lineInSnippet - 1]?.lineNumber ?? (lineInSnippet + lineOffset);

        // Record declared functions in this source file
        if (ts.isFunctionDeclaration(node) && node.name) {
            declaredFunctionNames.push(node.name.getText(sourceFile));
        }

        // Check if this is the containing function/method of the failure site
        if (
            ts.isFunctionDeclaration(node) ||
            ts.isMethodDeclaration(node) ||
            ts.isArrowFunction(node) ||
            ts.isFunctionExpression(node)
        ) {
            const startPos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
            const endPos = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
            const funcStartLine = sourceLines[startPos - 1]?.lineNumber ?? (startPos + lineOffset);
            const funcEndLine = sourceLines[endPos - 1]?.lineNumber ?? (endPos + lineOffset);
            if (failingLine >= funcStartLine && failingLine <= funcEndLine) {
                scan.functionParameters = node.parameters.map((p) => p.name.getText(sourceFile));
                scan.optionalParameters = node.parameters
                    .filter((p) => {
                        if (p.questionToken || p.initializer) return true;
                        if (p.type) {
                            const typeText = p.type.getText(sourceFile);
                            if (typeText.includes("undefined") || typeText.includes("null")) return true;
                        }
                        return false;
                    })
                    .map((p) => p.name.getText(sourceFile));
            }
        }

        // Discover failing expression if at failingLine
        if (line === failingLine) {
            if (ts.isCallExpression(node) && !scan.callNodeAtFailure) {
                scan.callNodeAtFailure = node;
            }
            if (!scan.discoveredFailingExpression) {
                if (ts.isPropertyAccessExpression(node) || ts.isCallExpression(node) || ts.isElementAccessExpression(node)) {
                    scan.discoveredFailingExpression = node.getText(sourceFile);
                }
            }
        }

        // Check for throw statements
        if (ts.isThrowStatement(node)) {
            if (line === failingLine) {
                scan.originatesHere = true;
                if (!scan.discoveredFailingExpression && node.expression) {
                    scan.discoveredFailingExpression = node.expression.getText(sourceFile);
                }
            }
            const throwText = node.getText(sourceFile);
            if (snapshot.failure.exceptionMessage && throwText.includes(snapshot.failure.exceptionMessage)) {
                scan.containsErrorConstructionMatchingMessage = true;
            }
        }

        // Check for catch blocks
        if (ts.isCatchClause(node)) {
            scan.hasCatchBlock = true;
            // Check if rethrowing inside catch
            node.forEachChild((child) => {
                if (ts.isBlock(child)) {
                    child.statements.forEach((stmt) => {
                        if (ts.isThrowStatement(stmt)) {
                            scan.isRethrown = true;
                        }
                    });
                }
            });
        }

        // Check for optional chaining: `?.`
        if (ts.isPropertyAccessChain(node) || ts.isElementAccessChain(node) || ts.isCallChain(node)) {
            scan.hasOptionalChaining = true;
            guards.push({
                type: "optional_chaining",
                line,
                expression: node.getText(sourceFile),
                isPriorToFailure: line <= failingLine,
            });
        }

        // Check for nullish coalescing `??` or logical OR fallback `||`
        if (ts.isBinaryExpression(node)) {
            if (
                node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
                node.operatorToken.kind === ts.SyntaxKind.BarBarToken
            ) {
                scan.hasFallbackCoalescing = true;
            }
        }

        // Check for if conditions (guards)
        if (ts.isIfStatement(node)) {
            const condText = node.expression.getText(sourceFile);
            guards.push({
                type: condText.includes("typeof")
                    ? "typeof"
                    : condText.includes("null") || condText.includes("undefined")
                    ? "null_check"
                    : "truthy_check",
                line,
                expression: condText,
                isPriorToFailure: line <= failingLine,
            });
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    // Deep Invocation Analysis & Callee Opacity Determination
    let invocationAnalysis: SourceAstAnalysis["invocationAnalysis"] = undefined;
    const finalExpr = source.failingExpression || scan.discoveredFailingExpression || "";

    if (scan.callNodeAtFailure || finalExpr.includes("(") || finalExpr.includes("await ")) {
        const calleeText = scan.callNodeAtFailure
            ? scan.callNodeAtFailure.expression.getText(sourceFile)
            : finalExpr.replace(/^await\s+/, "").replace(/\(.*$/, "");
        const args = scan.callNodeAtFailure
            ? scan.callNodeAtFailure.arguments.map((a) => a.getText(sourceFile))
            : [];

        // Check if callee is a property access on an unconstrained parameter (e.g. scenario.fn)
        const rootIdentifier = calleeText.split(".")[0]?.split("[")[0]?.trim();
        const isParamCall = Boolean(rootIdentifier && scan.functionParameters?.includes(rootIdentifier));
        const isDeclaredLocally = Boolean(calleeText && declaredFunctionNames.includes(calleeText));

        let calleeOpacity: CalleeOpacity = "CALLEE_OPAQUE_UNRESOLVABLE";
        if (scan.containsErrorConstructionMatchingMessage) {
            calleeOpacity = "CALLEE_IMPLEMENTATION_AND_FAILURE_SURFACE_NARROWED";
        } else if (isDeclaredLocally) {
            calleeOpacity = "CALLEE_IMPLEMENTATION_IDENTIFIED_ARGUMENTS_UNKNOWN";
        } else if (isParamCall) {
            calleeOpacity = "CALLEE_OPAQUE_UNRESOLVABLE";
        } else {
            calleeOpacity = "CALLEE_OPAQUE_UNRESOLVABLE";
        }

        // Context fields analysis
        const contextFields: InvocationAnalysis["contextFields"] = args.map((arg) => {
            const isParam = scan.functionParameters?.includes(arg);
            return {
                name: arg,
                constraint: isParam ? "RUNTIME_UNKNOWN" : "STATICALLY_UNKNOWN",
                source: isParam ? `Parameter passed to '${source.containingFunction || "caller"}'` : "Local variable or expression",
            };
        });

        invocationAnalysis = {
            isInvocation: true,
            calleeExpression: calleeText,
            arguments: args,
            calleeOpacity,
            reachableImplementations: isDeclaredLocally
                ? [
                      {
                          name: calleeText,
                          filePath: source.filePath,
                          reachability: "DIRECTLY_REACHABLE",
                          canProduceObservedError: scan.containsErrorConstructionMatchingMessage,
                      },
                  ]
                : [],
            calleeErrorOrigin: scan.containsErrorConstructionMatchingMessage
                ? "CONSTRUCTED_IN_CALLEE"
                : "UNKNOWN",
            contextFields,
        };
    }

    // Source vs Dist Mapping Analysis
    const isDistFile = Boolean(
        source.filePath?.startsWith("dist/") ||
        source.filePath?.startsWith("build/") ||
        source.filePath?.includes("/dist/") ||
        source.filePath?.includes("/build/")
    );
    const sourceFileCounterpart = (source as any).sourceFileCounterpart || (snapshot as any).sourceFileCounterpart;
    const sourceMapAvailable = Boolean((source as any).sourceMapAvailable || (snapshot as any).sourceMapAvailable);

    const sourceDistMapping: SourceAstAnalysis["sourceDistMapping"] = isDistFile
        ? {
              isGeneratedOrDist: true,
              sourceFileCounterpart,
              sourceMapAvailable,
          }
        : undefined;

    // Relevant Tests Contract Evidence
    const snapshotTests = (snapshot as any).tests || (snapshot as any).relevantTests;
    const testsContractEvidence: SourceAstAnalysis["testsContractEvidence"] = snapshotTests
        ? {
              hasRelevantTests: Boolean(snapshotTests.hasRelevantTests ?? (snapshotTests.testFiles?.length > 0)),
              testFiles: snapshotTests.testFiles || [],
              reproductionPossibleInDev: Boolean(snapshotTests.reproductionPossibleInDev),
          }
        : undefined;

    return {
        hasExactSource: true,
        filePath: source.filePath,
        failingLine,
        containingFunction: source.containingFunction,
        functionParameters: scan.functionParameters,
        optionalParameters: scan.optionalParameters,
        failingExpression: source.failingExpression || scan.discoveredFailingExpression,
        surroundingLines,
        guards,
        hasOptionalChaining: scan.hasOptionalChaining,
        hasFallbackCoalescing: scan.hasFallbackCoalescing,
        hasCatchBlock: scan.hasCatchBlock,
        errorPropagation: {
            originatesHere: scan.originatesHere,
            isTransformed: scan.isTransformed,
            isRethrown: scan.isRethrown,
        },
        invocationAnalysis,
        sourceDistMapping,
        testsContractEvidence,
    };
}
