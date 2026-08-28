import ts from "typescript";

export interface AstResolutionResult {
    failingExpression?: string;
    failingStatement?: string;
    containingFunction?: string;
    astNodeType?: string;
    startLine?: number;
    startColumn?: number;
    endLine?: number;
    endColumn?: number;
}

/**
 * Deterministic AST-based source expression and function resolver.
 *
 * Uses the TypeScript/JavaScript AST parser to:
 * - Locate the exact AST node at (line, column)
 * - Extract the smallest meaningful failing expression (e.g. `profile.settings`, `results.find`)
 * - Extract the containing statement
 * - Extract the containing function / method / arrow function name
 *
 * Returns undefined when the position cannot be resolved deterministically (never guesses).
 */
export function resolveAstFromSource(
    sourceText: string,
    lineNumber: number,
    columnNumber?: number,
    filePath: string = "source.ts"
): AstResolutionResult {
    if (!sourceText || lineNumber <= 0) {
        return {};
    }

    try {
        const isTs = /\.tsx?$/i.test(filePath);
        const scriptKind = filePath.endsWith(".tsx")
            ? ts.ScriptKind.TSX
            : filePath.endsWith(".jsx")
            ? ts.ScriptKind.JSX
            : isTs
            ? ts.ScriptKind.TS
            : ts.ScriptKind.JS;

        const sourceFile = ts.createSourceFile(
            filePath,
            sourceText,
            ts.ScriptTarget.Latest,
            /*setParentNodes*/ true,
            scriptKind
        );

        // Convert 1-indexed (line, column) to character offset in sourceFile
        const lineStarts = sourceFile.getLineStarts();
        const lineIdx = lineNumber - 1;

        if (lineIdx < 0 || lineIdx >= lineStarts.length) {
            return {};
        }

        const lineStartPos = lineStarts[lineIdx];
        const lineEndPos =
            lineIdx + 1 < lineStarts.length
                ? lineStarts[lineIdx + 1] - 1
                : sourceText.length;
        const lineText = sourceText.slice(lineStartPos, lineEndPos);

        // Determine target character position
        let targetPos = lineStartPos;
        if (columnNumber !== undefined && columnNumber > 0) {
            // column is 1-indexed
            targetPos = Math.min(lineStartPos + columnNumber - 1, lineEndPos);
        } else {
            // Find first non-whitespace character on the line
            const nonWsMatch = lineText.search(/\S/);
            targetPos = lineStartPos + (nonWsMatch >= 0 ? nonWsMatch : 0);
        }

        // Find the deepest AST node containing targetPos
        let targetNode: ts.Node | undefined;

        function findDeepestNode(node: ts.Node) {
            if (node.pos <= targetPos && targetPos < node.end) {
                targetNode = node;
                ts.forEachChild(node, findDeepestNode);
            }
        }

        findDeepestNode(sourceFile);

        if (!targetNode) {
            return {};
        }

        // 1. Containing Function Detection
        const containingFunction = findContainingFunctionName(targetNode);

        // 2. Containing Statement Extraction
        const statementNode = findEnclosingStatement(targetNode);
        const failingStatement = statementNode
            ? statementNode.getText(sourceFile).trim()
            : lineText.trim();

        // 3. Failing Expression Resolution
        const exprResult = findFailingExpressionFromNode(targetNode, sourceFile, lineStartPos, lineEndPos);

        return {
            failingExpression: exprResult?.text,
            failingStatement,
            containingFunction,
            astNodeType: exprResult?.nodeType,
            startLine: exprResult?.startLine,
            startColumn: exprResult?.startColumn,
            endLine: exprResult?.endLine,
            endColumn: exprResult?.endColumn,
        };
    } catch {
        // Syntax or parse error — fallback to non-AST
        return {};
    }
}

/**
 * Traverse upward from the target node to find the containing function name.
 */
function findContainingFunctionName(node: ts.Node): string | undefined {
    let curr: ts.Node | undefined = node;

    while (curr) {
        // Function Declaration: function foo() {}
        if (ts.isFunctionDeclaration(curr) && curr.name) {
            return curr.name.text;
        }

        // Method Declaration: class Foo { bar() {} }
        if (ts.isMethodDeclaration(curr) && curr.name) {
            return curr.name.getText();
        }

        // Variable Declaration with function/arrow initializer: const foo = () => {}
        if (ts.isVariableDeclaration(curr) && curr.name) {
            if (
                curr.initializer &&
                (ts.isArrowFunction(curr.initializer) ||
                    ts.isFunctionExpression(curr.initializer))
            ) {
                return curr.name.getText();
            }
        }

        // Property Assignment with function/arrow initializer: { foo: () => {} }
        if (ts.isPropertyAssignment(curr) && curr.name) {
            if (
                curr.initializer &&
                (ts.isArrowFunction(curr.initializer) ||
                    ts.isFunctionExpression(curr.initializer))
            ) {
                return curr.name.getText();
            }
        }

        // Function Expression with name: const f = function myFunc() {}
        if (ts.isFunctionExpression(curr) && curr.name) {
            return curr.name.text;
        }

        curr = curr.parent;
    }

    return undefined;
}

/**
 * Find the enclosing statement for clean line reporting.
 */
function findEnclosingStatement(node: ts.Node): ts.Statement | undefined {
    let curr: ts.Node | undefined = node;
    while (curr) {
        if (
            ts.isReturnStatement(curr) ||
            ts.isExpressionStatement(curr) ||
            ts.isVariableStatement(curr) ||
            ts.isIfStatement(curr) ||
            ts.isThrowStatement(curr)
        ) {
            return curr as ts.Statement;
        }
        curr = curr.parent;
    }
    return undefined;
}

/**
 * Find the relevant failing expression from the AST node.
 */
function findFailingExpressionFromNode(
    node: ts.Node,
    sourceFile: ts.SourceFile,
    lineStart: number,
    lineEnd: number
): {
    text: string;
    nodeType: string;
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
} | undefined {
    let curr: ts.Node | undefined = node;

    // If target node is an identifier or token, look up to the highest contiguous expression
    // e.g. identifier 'settings' -> PropertyAccessExpression 'profile.settings'
    let bestExpr: ts.Node | undefined;

    while (curr && curr.pos >= lineStart && curr.end <= lineEnd + 1) {
        if (
            ts.isPropertyAccessExpression(curr) ||
            ts.isElementAccessExpression(curr) ||
            ts.isCallExpression(curr) ||
            ts.isBinaryExpression(curr)
        ) {
            bestExpr = curr;

            // If it's a call expression (e.g. results.find(...)), if the callee is a property access,
            // we prefer the property access (results.find) for TypeError method calls
            if (ts.isCallExpression(curr) && ts.isPropertyAccessExpression(curr.expression)) {
                bestExpr = curr.expression;
                break;
            }
        }

        if (
            ts.isReturnStatement(curr) ||
            ts.isVariableDeclaration(curr) ||
            ts.isExpressionStatement(curr)
        ) {
            break;
        }

        curr = curr.parent;
    }

    if (!bestExpr) {
        // If no property/call expression was found via upward traversal, check statement RHS
        const stmt = findEnclosingStatement(node);
        if (stmt) {
            if (ts.isReturnStatement(stmt) && stmt.expression) {
                bestExpr = stmt.expression;
            } else if (ts.isExpressionStatement(stmt)) {
                bestExpr = stmt.expression;
            }
        }
    }

    if (bestExpr) {
        const text = bestExpr.getText(sourceFile).trim();
        const start = sourceFile.getLineAndCharacterOfPosition(bestExpr.getStart(sourceFile));
        const end = sourceFile.getLineAndCharacterOfPosition(bestExpr.getEnd());

        return {
            text,
            nodeType: ts.SyntaxKind[bestExpr.kind] || "Expression",
            startLine: start.line + 1,
            startColumn: start.character + 1,
            endLine: end.line + 1,
            endColumn: end.character + 1,
        };
    }

    return undefined;
}
