/**
 * Halo Repair Intelligence Engine — Repository Pattern Analyzer
 *
 * Inspects resolved source code to identify repository-native idioms:
 *   - Error handling style (throws, early return, Result types, logging)
 *   - Defensive style (optional chaining vs explicit guards)
 *   - Available imports and declared symbols (so patches never invent imports)
 *
 * Implements Section 15 & Section 16 of the specification.
 */

import ts from "typescript";
import type { SourceContext } from "../runtime/types";
import type { RepositoryPattern } from "./types";

/**
 * Analyzes repository patterns from the source context.
 */
export function analyzeRepositoryPatterns(source?: SourceContext): RepositoryPattern {
    if (!source || !source.lines || source.lines.length === 0) {
        return {
            errorHandlingPattern: "UNKNOWN (Source unavailable)",
            stylePattern: "STANDARD_TYPESCRIPT",
            observedSymbols: [],
            relevantImports: [],
        };
    }

    const sourceText = source.lines.map(l => l.content).join("\n");
    const sourceFile = ts.createSourceFile(
        source.filePath || "source.ts",
        sourceText,
        ts.ScriptTarget.Latest,
        true
    );

    const observedSymbols = new Set<string>();
    const relevantImports: string[] = [];
    let throwCount = 0;
    let earlyReturnCount = 0;
    let optionalChainingCount = 0;
    let explicitNullCheckCount = 0;

    function visit(node: ts.Node) {
        // Track imports
        if (ts.isImportDeclaration(node)) {
            const moduleSpecifier = node.moduleSpecifier.getText(sourceFile).replace(/['"]/g, "");
            relevantImports.push(moduleSpecifier);
        }

        // Track declared identifiers
        if (ts.isIdentifier(node)) {
            const name = node.text;
            if (name.length > 2 && !["const", "let", "var", "function", "return", "import"].includes(name)) {
                observedSymbols.add(name);
            }
        }

        // Track error handling styles
        if (ts.isThrowStatement(node)) {
            throwCount++;
        }

        // Track early returns
        if (ts.isIfStatement(node) && (ts.isReturnStatement(node.thenStatement) || (ts.isBlock(node.thenStatement) && node.thenStatement.statements.some(ts.isReturnStatement)))) {
            earlyReturnCount++;
        }

        // Track optional chaining
        if (ts.isPropertyAccessChain(node) || ts.isCallChain(node)) {
            optionalChainingCount++;
        }

        // Track explicit null checks
        if (ts.isBinaryExpression(node)) {
            const op = node.operatorToken.kind;
            if (op === ts.SyntaxKind.EqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsToken || op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsEqualsToken) {
                const right = node.right.getText(sourceFile);
                if (right === "null" || right === "undefined") {
                    explicitNullCheckCount++;
                }
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    // Determine idioms
    let errorHandlingPattern = "Explicit error throwing";
    if (throwCount === 0 && earlyReturnCount > 0) {
        errorHandlingPattern = "Defensive early returns without throwing";
    } else if (throwCount > 0 && earlyReturnCount > 0) {
        errorHandlingPattern = "Hybrid: Early return on invalid preconditions, explicit throw on internal errors";
    }

    let stylePattern = "Standard TypeScript/JavaScript";
    if (optionalChainingCount > explicitNullCheckCount && optionalChainingCount > 0) {
        stylePattern = "Idiomatic optional chaining (?.) preferred over explicit null checks";
    } else if (explicitNullCheckCount > 0) {
        stylePattern = "Explicit null/undefined equality comparisons preferred";
    } else if (earlyReturnCount > 1) {
        stylePattern = "Guard-clause pattern with early returns";
    }

    return {
        errorHandlingPattern,
        stylePattern,
        observedSymbols: Array.from(observedSymbols).slice(0, 50),
        relevantImports,
    };
}
