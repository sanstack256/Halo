/**
 * Halo Repair Intelligence Engine — Protection Analysis Engine
 *
 * Inspects historical source code AST surrounding the failure to identify
 * existing defensive protections (null checks, try/catch, optional chaining,
 * type guards, early returns) and deterministically evaluates whether the
 * failing execution passed through, bypassed, or lacked those protections.
 *
 * Implements Section 10 & Section 11 of the specification.
 */

import ts from "typescript";
import type { SourceContext } from "../runtime/types";
import type {
    ProtectionAnalysisResult,
    ProtectionStatus,
    ExistingGuard,
    GuardType,
} from "./types";

interface ProtectionAnalysisOptions {
    source?: SourceContext;
    failingExpression?: string;
    failingLineNumber?: number;
    containingFunction?: string;
}

/**
 * Deterministically analyzes existing protections around the failing expression.
 */
export function analyzeProtections(opts: ProtectionAnalysisOptions): ProtectionAnalysisResult {
    const { source, failingExpression, failingLineNumber, containingFunction } = opts;

    const targetExpr = failingExpression?.trim() || "unknown expression";

    if (!source || !source.lines || source.lines.length === 0 || !failingLineNumber) {
        return {
            status: "NO_PROTECTION_FOUND",
            guards: [],
            targetExpression: targetExpr,
            summary: "Source context is unavailable to inspect AST protections.",
            detailedReasoning: "Without resolved historical source code, existing guards cannot be determined.",
            executionStatus: "EXECUTION_UNPROVEN",
        };
    }

    const sourceText = source.lines.map(l => l.content).join("\n");
    const sourceFile = ts.createSourceFile(
        source.filePath || "source.ts",
        sourceText,
        ts.ScriptTarget.Latest,
        true
    );

    const guards: ExistingGuard[] = [];
    const lineStart = source.startLineNumber ?? 1;

    // Helper to map 0-based character pos to 1-based original line number
    function getOriginalLine(pos: number): number {
        const { line } = sourceFile.getLineAndCharacterOfPosition(pos);
        return lineStart + line;
    }

    // Extract root symbols from target expression (e.g. for "await scenario.fn(...)" -> root: "scenario", member: "scenario.fn")
    const cleanedExpr = targetExpr.replace(/^await\s+/, "").replace(/\(.*$/, "").trim();
    const parts = cleanedExpr.split(".");
    const rootSymbol = parts[0] || "";
    const memberSymbol = parts.length > 1 ? `${parts[0]}.${parts[1]}` : "";

    // Walk AST looking for guards preceding or wrapping the failing line
    function visit(node: ts.Node) {
        // 1. If statement guards
        if (ts.isIfStatement(node)) {
            const condText = node.expression.getText(sourceFile).trim();
            const guardLine = getOriginalLine(node.getStart(sourceFile));

            // Only consider guards that precede or include the failing line
            if (guardLine <= failingLineNumber!) {
                let guardType: GuardType = "NULL_UNDEFINED_CHECK";
                if (condText.includes("typeof ")) {
                    guardType = "TYPE_CHECK";
                } else if (condText.includes("instanceof ")) {
                    guardType = "TYPE_CHECK";
                }

                // Check which symbol is protected
                let protectsSymbol = "";
                let protectsTargetExpression = false;

                if (memberSymbol && (condText.includes(memberSymbol) || condText.includes(`!${memberSymbol}`) || condText.includes(`${memberSymbol} == null`) || condText.includes(`${memberSymbol} === undefined`))) {
                    protectsSymbol = memberSymbol;
                    protectsTargetExpression = true;
                } else if (rootSymbol && (condText.includes(rootSymbol) || condText.includes(`!${rootSymbol}`) || condText.includes(`${rootSymbol} == null`))) {
                    protectsSymbol = rootSymbol;
                    protectsTargetExpression = false;
                } else {
                    protectsSymbol = condText;
                }

                // Check if it's an early return
                let isEarlyExit = false;
                if (ts.isReturnStatement(node.thenStatement) || ts.isThrowStatement(node.thenStatement)) {
                    isEarlyExit = true;
                    guardType = "EARLY_RETURN";
                } else if (ts.isBlock(node.thenStatement)) {
                    const stmts = node.thenStatement.statements;
                    if (stmts.length > 0 && (ts.isReturnStatement(stmts[stmts.length - 1]!) || ts.isThrowStatement(stmts[stmts.length - 1]!))) {
                        isEarlyExit = true;
                        guardType = "EARLY_RETURN";
                    }
                }

                guards.push({
                    guardType,
                    line: guardLine,
                    text: `if (${condText}) ${isEarlyExit ? "{ return; }" : "{ ... }"}`,
                    protectsSymbol,
                    protectsTargetExpression,
                });
            }
        }

        // 2. Try-catch blocks
        if (ts.isTryStatement(node)) {
            const tryStart = getOriginalLine(node.getStart(sourceFile));
            const tryEnd = getOriginalLine(node.getEnd());
            if (failingLineNumber! >= tryStart && failingLineNumber! <= tryEnd) {
                guards.push({
                    guardType: "TRY_CATCH",
                    line: tryStart,
                    text: "try { ... } catch (error) { ... }",
                    protectsSymbol: targetExpr,
                    protectsTargetExpression: true,
                });
            }
        }

        // 3. Optional chaining on target expression
        if (ts.isPropertyAccessChain(node) || ts.isCallChain(node)) {
            const chainText = node.getText(sourceFile);
            const chainLine = getOriginalLine(node.getStart(sourceFile));
            if (chainLine === failingLineNumber) {
                guards.push({
                    guardType: "OPTIONAL_CHAINING",
                    line: chainLine,
                    text: chainText,
                    protectsSymbol: chainText,
                    protectsTargetExpression: true,
                });
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    // Also inspect raw lines if AST didn't capture simple textual guards
    if (guards.length === 0) {
        for (const lineObj of source.lines) {
            if (lineObj.lineNumber < failingLineNumber) {
                const trimmed = lineObj.content.trim();
                if (rootSymbol && (trimmed.startsWith(`if (!${rootSymbol})`) || trimmed.startsWith(`if (${rootSymbol} == null)`) || trimmed.startsWith(`if (!${rootSymbol} ||`))) {
                    guards.push({
                        guardType: "EARLY_RETURN",
                        line: lineObj.lineNumber,
                        text: trimmed,
                        protectsSymbol: rootSymbol,
                        protectsTargetExpression: false,
                    });
                }
            }
        }
    }

    // Determine ProtectionStatus
    let status: ProtectionStatus = "NO_PROTECTION_FOUND";
    let summary = "";
    let detailedReasoning = "";
    let executionStatus: "CONFIRMED_EXECUTED" | "CONFIRMED_BYPASSED" | "EXECUTION_UNPROVEN" = "EXECUTION_UNPROVEN";

    const guardProtectingTarget = guards.find(g => g.protectsTargetExpression);
    const guardProtectingRootOnly = guards.find(g => !g.protectsTargetExpression && g.protectsSymbol === rootSymbol);

    if (guardProtectingTarget) {
        if (guardProtectingTarget.guardType === "TRY_CATCH") {
            status = "PROTECTION_PRESENT_AND_RELEVANT";
            summary = `Failing expression is wrapped in a try/catch block at line ${guardProtectingTarget.line}, but the error still propagated or was unhandled.`;
            detailedReasoning = `Execution reached line ${failingLineNumber} inside a try block. The catch handler either re-threw the exception or was insufficient to recover.`;
            executionStatus = "CONFIRMED_EXECUTED";
        } else if (guardProtectingTarget.guardType === "OPTIONAL_CHAINING") {
            status = "PROTECTION_PRESENT_BUT_INSUFFICIENT";
            summary = `Optional chaining exists at line ${guardProtectingTarget.line}, but failure still occurred.`;
            detailedReasoning = `The expression uses optional chaining (${guardProtectingTarget.text}), but an unhandled exception occurred, suggesting the failure was an internal throw rather than an undefined dereference.`;
            executionStatus = "CONFIRMED_EXECUTED";
        } else {
            status = "PROTECTION_BYPASSED";
            summary = `Guard '${guardProtectingTarget.text}' exists for line ${guardProtectingTarget.line}, but was bypassed during execution.`;
            detailedReasoning = `A guard was found on line ${guardProtectingTarget.line}, but runtime execution proceeded into the failing line ${failingLineNumber}.`;
            executionStatus = "CONFIRMED_BYPASSED";
        }
    } else if (guardProtectingRootOnly) {
        status = "PROTECTION_PRESENT_BUT_INSUFFICIENT";
        summary = `An existing guard at line ${guardProtectingRootOnly.line} protects '${guardProtectingRootOnly.protectsSymbol}', but does NOT protect '${targetExpr}'.`;
        detailedReasoning = `The source contains '${guardProtectingRootOnly.text}' guarding '${guardProtectingRootOnly.protectsSymbol}'. However, '${targetExpr}' dereferences '${cleanedExpr}' without verifying its existence. Execution successfully passed the root check, then failed on member invocation.`;
        executionStatus = "CONFIRMED_EXECUTED";
    } else if (guards.length > 0) {
        status = "PROTECTION_EXECUTION_UNKNOWN";
        summary = `Guards exist in the surrounding function, but telemetry cannot confirm whether execution passed through them.`;
        detailedReasoning = `Found ${guards.length} guard(s) in the source context, but without branch-level telemetry coverage, their execution status remains unproven.`;
        executionStatus = "EXECUTION_UNPROVEN";
    } else {
        status = "NO_PROTECTION_FOUND";
        summary = `No defensive guards, null/undefined checks, or try/catch blocks were found protecting '${targetExpr}'.`;
        detailedReasoning = `Neither the target expression nor its parent object is protected by null checks, assertions, or exception handling in '${containingFunction || "the containing scope"}'.`;
        executionStatus = "EXECUTION_UNPROVEN";
    }

    return {
        status,
        guards,
        targetExpression: targetExpr,
        summary,
        detailedReasoning,
        executionStatus,
    };
}
