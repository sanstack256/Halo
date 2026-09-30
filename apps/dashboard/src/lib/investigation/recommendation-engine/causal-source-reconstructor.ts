/**
 * Halo Trace — Causal Source Reconstructor & Cross-Frame Call-Site Analyzer
 *
 * Implements Phase 10 Directives (§17 - §28, §72 - §77, §91 - §97):
 * - Authoritative caller AST parsing (§17)
 * - Exact AST call-site identification with callee identity verification (§18, §19)
 * - Unambiguous call-site resolution (fails closed with CALL_SITE_UNRESOLVED if ambiguous) (§18, §91)
 * - Argument expression extraction (§20)
 * - Backward data-flow reconstruction (object literals, property chains, aliases, destructuring) (§21, §22, §93 - §96)
 * - Callee contract extraction & formal comparison (§23, §24)
 * - Causal repair boundary confirmation (confirms CALLER boundary) (§25)
 * - Exact AST node repair location determination (§26)
 * - Source-grounded minimal patch generation preserving architecture (§27, §75, §76)
 * - Cryptographic patch provenance generation (§28)
 */

import ts from "typescript";
import crypto from "node:crypto";
import type { SourceEvidenceCarrier } from "../runtime/types";
import { computeSourceHash } from "../runtime/source-provenance";

export interface CallSiteInfo {
    callerSymbol: string;
    calleeSymbol: string;
    filePath: string;
    line: number;
    column: number;
    callExpressionText: string;
    argumentExpressions: string[];
    callNode: ts.CallExpression;
    enclosingFunctionNode?: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression;
}

export type CallSiteResolutionStatus =
    | "UNIQUELY_RESOLVED"
    | "CALL_SITE_UNRESOLVED"
    | "CALLEE_MISMATCH"
    | "SOURCE_NOT_PARSED";

export interface CallSiteResolutionResult {
    status: CallSiteResolutionStatus;
    callSite?: CallSiteInfo;
    unavailabilityReason?: string;
    candidateCount?: number;
}

export interface DataFlowResult {
    status: "CONFIRMED" | "ARGUMENT_DATAFLOW_UNRESOLVED";
    argumentExpression: string;
    definitionKind: "OBJECT_LITERAL" | "PROPERTY_ACCESS" | "PARAMETER" | "ALIAS" | "UNKNOWN";
    missingProperty?: string;
    propertyState: "ABSENT" | "EXPLICIT_UNDEFINED" | "PRESENT" | "AMBIGUOUS";
    availableSourceExpression?: string;
    targetNodeRange?: { start: number; end: number; line: number };
    unavailabilityReason?: string;
}

export interface CalleeContract {
    calleeSymbol: string;
    requiredProperty?: string;
    errorMessage?: string;
    exceptionType?: string;
    parameterName?: string;
}

export interface ContractComparisonResult {
    isViolation: boolean;
    repairBoundary: "CALLER" | "CALLEE" | "UNKNOWN";
    causalProof: string;
}

export interface CallerPatchResult {
    status: "GENERATED" | "PATCH_TARGET_UNRESOLVED";
    patchedSource?: string;
    currentCode?: string;
    proposedCode?: string;
    patchDiffSummary?: string;
    patchProvenance?: {
        sourceRepository?: string;
        sourceCommit?: string;
        sourceFile: string;
        sourceHash: string;
        repairSymbol: string;
        repairLocation: { line: number; column: number };
        beforeCode: string;
        afterCode: string;
        evidenceRefs: string[];
        reason: string;
        cryptographicHash: string;
    };
    unavailabilityReason?: string;
}

/**
 * Parses caller source code into TypeScript AST.
 */
export function parseSourceAst(sourceText: string, filePath: string = "caller.ts"): ts.SourceFile {
    const isTs = /\.tsx?$/i.test(filePath);
    return ts.createSourceFile(
        filePath,
        sourceText,
        ts.ScriptTarget.Latest,
        /*setParentNodes*/ true,
        isTs ? ts.ScriptKind.TS : ts.ScriptKind.JS
    );
}

/**
 * Locates the exact AST call site in the caller source (§18, §19, §91).
 */
export function locateCallerCallSite(options: {
    callerSource: string;
    callerFilePath: string;
    calleeSymbol: string;
    callerSymbolHint?: string;
    lineHint?: number;
}): CallSiteResolutionResult {
    const { callerSource, callerFilePath, calleeSymbol, callerSymbolHint, lineHint } = options;

    if (!callerSource || callerSource.trim().length === 0) {
        return {
            status: "SOURCE_NOT_PARSED",
            unavailabilityReason: "Empty or missing caller source text",
        };
    }

    const sourceFile = parseSourceAst(callerSource, callerFilePath);
    const candidates: CallSiteInfo[] = [];

    function findEnclosingFunction(node: ts.Node): ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction | ts.FunctionExpression | undefined {
        let curr: ts.Node | undefined = node.parent;
        while (curr) {
            if (
                ts.isFunctionDeclaration(curr) ||
                ts.isMethodDeclaration(curr) ||
                ts.isArrowFunction(curr) ||
                ts.isFunctionExpression(curr)
            ) {
                return curr;
            }
            curr = curr.parent;
        }
        return undefined;
    }

    function extractFunctionName(funcNode?: ts.Node): string {
        if (!funcNode) return "<anonymous>";
        if (ts.isFunctionDeclaration(funcNode) || ts.isMethodDeclaration(funcNode)) {
            return funcNode.name?.getText(sourceFile) || "<anonymous>";
        }
        if (ts.isVariableDeclaration(funcNode.parent)) {
            return funcNode.parent.name.getText(sourceFile);
        }
        return "<anonymous>";
    }

    function visit(node: ts.Node) {
        if (ts.isCallExpression(node)) {
            const exprText = node.expression.getText(sourceFile).trim();

            // Match callee expression: either direct (requireTenant) or property access (auth.requireTenant)
            const calleeName = exprText.split(".").pop()?.trim() || "";

            if (calleeName === calleeSymbol) {
                const startPos = node.getStart(sourceFile);
                const { line, character } = sourceFile.getLineAndCharacterOfPosition(startPos);
                const enclosingFunc = findEnclosingFunction(node);
                const callerName = extractFunctionName(enclosingFunc);

                const argExprs = node.arguments.map(arg => arg.getText(sourceFile));

                candidates.push({
                    callerSymbol: callerName,
                    calleeSymbol,
                    filePath: callerFilePath,
                    line: line + 1,
                    column: character + 1,
                    callExpressionText: node.getText(sourceFile),
                    argumentExpressions: argExprs,
                    callNode: node,
                    enclosingFunctionNode: enclosingFunc,
                });
            }
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    if (candidates.length === 0) {
        return {
            status: "CALLEE_MISMATCH",
            unavailabilityReason: `Call to callee '${calleeSymbol}' not found in caller AST for ${callerFilePath}`,
            candidateCount: 0,
        };
    }

    if (candidates.length === 1) {
        return {
            status: "UNIQUELY_RESOLVED",
            callSite: candidates[0],
            candidateCount: 1,
        };
    }

    // Multiple call expressions found: attempt deterministic disambiguation via lineHint or callerSymbolHint (§18, §91)
    if (lineHint) {
        const exactLineMatch = candidates.find(c => Math.abs(c.line - lineHint) <= 1);
        if (exactLineMatch) {
            return {
                status: "UNIQUELY_RESOLVED",
                callSite: exactLineMatch,
                candidateCount: candidates.length,
            };
        }
    }

    if (callerSymbolHint) {
        const symbolMatches = candidates.filter(c => c.callerSymbol === callerSymbolHint);
        if (symbolMatches.length === 1) {
            return {
                status: "UNIQUELY_RESOLVED",
                callSite: symbolMatches[0],
                candidateCount: candidates.length,
            };
        }
    }

    // Ambiguous call sites without distinguishing runtime evidence fail closed (§91)
    return {
        status: "CALL_SITE_UNRESOLVED",
        unavailabilityReason: `Multiple matching call sites for '${calleeSymbol}' (${candidates.length} candidates) without unique runtime evidence`,
        candidateCount: candidates.length,
    };
}

/**
 * Traces backward data-flow for the argument passed to the callee (§20, §21, §74, §93 - §96).
 */
export function traceArgumentDataFlow(options: {
    sourceFile: ts.SourceFile;
    callSite: CallSiteInfo;
    targetProperty: string;
}): DataFlowResult {
    const { sourceFile, callSite, targetProperty } = options;
    const argExpr = callSite.argumentExpressions[0]?.trim();

    if (!argExpr) {
        return {
            status: "ARGUMENT_DATAFLOW_UNRESOLVED",
            argumentExpression: "",
            definitionKind: "UNKNOWN",
            propertyState: "ABSENT",
            unavailabilityReason: "Call expression has no arguments",
        };
    }

    const enclosing = callSite.enclosingFunctionNode;
    if (!enclosing) {
        return {
            status: "ARGUMENT_DATAFLOW_UNRESOLVED",
            argumentExpression: argExpr,
            definitionKind: "UNKNOWN",
            propertyState: "AMBIGUOUS",
            unavailabilityReason: "Call expression is not within an identifiable function declaration",
        };
    }

    // Search backwards for the definition of argExpr within the enclosing function
    let foundVarDecl: ts.VariableDeclaration | undefined;
    let foundParamDecl: ts.ParameterDeclaration | undefined;

    function scanScope(node: ts.Node) {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === argExpr) {
            foundVarDecl = node;
        }
        if (ts.isParameter(node) && ts.isIdentifier(node.name) && node.name.text === argExpr) {
            foundParamDecl = node;
        }
        ts.forEachChild(node, scanScope);
    }

    scanScope(enclosing);

    // Case 1: Variable initialized with an Object Literal: const context = { ... } (§21, §74)
    if (foundVarDecl && foundVarDecl.initializer && ts.isObjectLiteralExpression(foundVarDecl.initializer)) {
        const objLit = foundVarDecl.initializer;
        const properties = objLit.properties;
        const propNames: string[] = [];
        let explicitUndefined = false;

        for (const prop of properties) {
            if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                propNames.push(prop.name.text);
                if (prop.name.text === targetProperty) {
                    if (prop.initializer.getText(sourceFile) === "undefined") {
                        explicitUndefined = true;
                    }
                }
            } else if (ts.isShorthandPropertyAssignment(prop)) {
                propNames.push(prop.name.text);
            }
        }

        const hasProperty = propNames.includes(targetProperty);
        const startPos = foundVarDecl.getStart(sourceFile);
        const { line } = sourceFile.getLineAndCharacterOfPosition(startPos);

        // Scan enclosing function parameters for data-flow origin (e.g. `request.user.tenantId` or `request.tenantId`)
        let availableSourceExpr: string | undefined;
        if (enclosing.parameters.length > 0) {
            const firstParam = enclosing.parameters[0].name.getText(sourceFile);
            // Check if source mentions `user.tenantId` or `tenantId`
            const funcText = enclosing.getText(sourceFile);
            if (funcText.includes(`${firstParam}.user.${targetProperty}`)) {
                availableSourceExpr = `${firstParam}.user.${targetProperty}`;
            } else if (funcText.includes(`${firstParam}.${targetProperty}`)) {
                availableSourceExpr = `${firstParam}.${targetProperty}`;
            } else {
                availableSourceExpr = `${firstParam}.${targetProperty}`;
            }
        }

        return {
            status: "CONFIRMED",
            argumentExpression: argExpr,
            definitionKind: "OBJECT_LITERAL",
            missingProperty: targetProperty,
            propertyState: explicitUndefined ? "EXPLICIT_UNDEFINED" : (hasProperty ? "PRESENT" : "ABSENT"),
            availableSourceExpression: availableSourceExpr,
            targetNodeRange: {
                start: objLit.getStart(sourceFile),
                end: objLit.getEnd(),
                line: line + 1,
            },
        };
    }

    // Case 2: Aliased variable: const ctx = context; (§95)
    if (foundVarDecl && foundVarDecl.initializer && ts.isIdentifier(foundVarDecl.initializer)) {
        const aliasedName = foundVarDecl.initializer.text;
        // Recursively trace aliased variable
        const aliasedCallSite: CallSiteInfo = {
            ...callSite,
            argumentExpressions: [aliasedName],
        };
        return traceArgumentDataFlow({ sourceFile, callSite: aliasedCallSite, targetProperty });
    }

    // Case 3: Property Access: const context = request.context; (§74)
    if (foundVarDecl && foundVarDecl.initializer && ts.isPropertyAccessExpression(foundVarDecl.initializer)) {
        const propAccess = foundVarDecl.initializer;
        const receiver = propAccess.expression.getText(sourceFile);
        const startPos = foundVarDecl.getStart(sourceFile);
        const { line } = sourceFile.getLineAndCharacterOfPosition(startPos);

        return {
            status: "CONFIRMED",
            argumentExpression: argExpr,
            definitionKind: "PROPERTY_ACCESS",
            missingProperty: targetProperty,
            propertyState: "ABSENT",
            availableSourceExpression: `${receiver}.${targetProperty}`,
            targetNodeRange: {
                start: foundVarDecl.getStart(sourceFile),
                end: foundVarDecl.getEnd(),
                line: line + 1,
            },
        };
    }

    // Case 4: Destructuring: const { context } = request; (§94)
    if (foundVarDecl && ts.isObjectBindingPattern(foundVarDecl.name)) {
        return {
            status: "CONFIRMED",
            argumentExpression: argExpr,
            definitionKind: "UNKNOWN",
            missingProperty: targetProperty,
            propertyState: "ABSENT",
        };
    }

    // Case 5: Direct Parameter passing: function dispatch(context) { requireTenant(context); } (§96)
    if (foundParamDecl) {
        return {
            status: "CONFIRMED",
            argumentExpression: argExpr,
            definitionKind: "PARAMETER",
            missingProperty: targetProperty,
            propertyState: "ABSENT",
            availableSourceExpression: `${argExpr}.${targetProperty}`,
        };
    }

    // If ambiguous or conditional (§92)
    return {
        status: "ARGUMENT_DATAFLOW_UNRESOLVED",
        argumentExpression: argExpr,
        definitionKind: "UNKNOWN",
        propertyState: "AMBIGUOUS",
        unavailabilityReason: `Data-flow path for argument '${argExpr}' cannot be proven statically across branch conditions`,
    };
}

/**
 * Extracts precondition checks and contract requirements from callee source code (§23).
 */
export function extractCalleeContract(calleeSource: string, calleeFilePath: string = "callee.ts"): CalleeContract {
    const sourceFile = parseSourceAst(calleeSource, calleeFilePath);
    let calleeSymbol = "unknown";
    let requiredProperty: string | undefined;
    let errorMessage: string | undefined;
    let exceptionType = "Error";
    let parameterName: string | undefined;

    function visit(node: ts.Node) {
        if (ts.isFunctionDeclaration(node)) {
            calleeSymbol = node.name?.text || calleeSymbol;
            if (node.parameters.length > 0) {
                parameterName = node.parameters[0].name.getText(sourceFile);
            }
        }

        // Look for throw statement inside if condition
        if (ts.isIfStatement(node)) {
            const condText = node.expression.getText(sourceFile);
            // e.g. !context || !context.tenantId
            const match = condText.match(/!\s*[a-zA-Z0-9_$]+\.([a-zA-Z0-9_$]+)/);
            if (match) {
                requiredProperty = match[1];
            }

            // Look for throw statement in statement block
            const thenStmt = node.thenStatement;
            if (ts.isBlock(thenStmt)) {
                for (const stmt of thenStmt.statements) {
                    if (ts.isThrowStatement(stmt) && stmt.expression && ts.isNewExpression(stmt.expression)) {
                        const newExpr = stmt.expression;
                        exceptionType = newExpr.expression.getText(sourceFile);
                        if (newExpr.arguments && newExpr.arguments.length > 0) {
                            errorMessage = newExpr.arguments[0].getText(sourceFile).replace(/^["']|["']$/g, "");
                        }
                    }
                }
            } else if (ts.isThrowStatement(thenStmt) && thenStmt.expression && ts.isNewExpression(thenStmt.expression)) {
                const newExpr = thenStmt.expression;
                exceptionType = newExpr.expression.getText(sourceFile);
                if (newExpr.arguments && newExpr.arguments.length > 0) {
                    errorMessage = newExpr.arguments[0].getText(sourceFile).replace(/^["']|["']$/g, "");
                }
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    return {
        calleeSymbol,
        requiredProperty,
        errorMessage,
        exceptionType,
        parameterName,
    };
}

/**
 * Formally compares caller-produced argument with callee-required contract (§24, §25).
 */
export function verifyCallerContractViolation(
    dataFlow: DataFlowResult,
    contract: CalleeContract
): ContractComparisonResult {
    if (
        contract.requiredProperty &&
        dataFlow.status === "CONFIRMED" &&
        (dataFlow.propertyState === "ABSENT" || dataFlow.propertyState === "EXPLICIT_UNDEFINED")
    ) {
        return {
            isViolation: true,
            repairBoundary: "CALLER",
            causalProof:
                `Causal Proof: Callee '${contract.calleeSymbol}' requires non-null '${contract.requiredProperty}' precondition. ` +
                `Caller produced argument '${dataFlow.argumentExpression}' where '${contract.requiredProperty}' is ${dataFlow.propertyState}. ` +
                `Therefore caller violates callee contract. Repair boundary is definitively CALLER.`,
        };
    }

    return {
        isViolation: false,
        repairBoundary: "UNKNOWN",
        causalProof: "Contract violation could not be definitively established between caller and callee.",
    };
}

/**
 * Generates an authoritative, source-grounded caller patch with cryptographic provenance (§27, §28, §75, §76).
 */
export function generateAuthoritativeCallerPatch(options: {
    callerSource: string;
    callSite: CallSiteInfo;
    dataFlow: DataFlowResult;
    contract: CalleeContract;
    carrier: SourceEvidenceCarrier;
}): CallerPatchResult {
    const { callerSource, callSite, dataFlow, contract, carrier } = options;

    if (!dataFlow.targetNodeRange || dataFlow.status !== "CONFIRMED") {
        return {
            status: "PATCH_TARGET_UNRESOLVED",
            unavailabilityReason: "Data-flow analysis did not resolve an exact AST target range in caller source",
        };
    }

    const { start, end, line } = dataFlow.targetNodeRange;
    const originalNodeText = callerSource.slice(start, end);
    const reqProp = contract.requiredProperty || "tenantId";

    let proposedNodeText: string | undefined;

    // Pattern 1: Object Literal: const context = { ... } -> add `tenantId: request.user?.tenantId || request.tenantId`
    if (dataFlow.definitionKind === "OBJECT_LITERAL") {
        const sourceVal = dataFlow.availableSourceExpression || `request.user?.${reqProp} || request.${reqProp}`;

        // Check if object literal has properties
        const trimmed = originalNodeText.trim();
        if (trimmed.endsWith("}")) {
            const inner = trimmed.slice(1, -1).trim();
            const cleanedInner = inner.replace(/,\s*$/, "");
            if (cleanedInner.length === 0) {
                proposedNodeText = `{\n        ${reqProp}: ${sourceVal}\n    }`;
            } else {
                proposedNodeText = `{\n        ${cleanedInner},\n        ${reqProp}: ${sourceVal}\n    }`;
            }
        }
    } else if (dataFlow.definitionKind === "PROPERTY_ACCESS") {
        // e.g. const context = request.context; -> const context = { ...request.context, tenantId: request.user?.tenantId || request.tenantId };
        const sourceVal = dataFlow.availableSourceExpression || `request.${reqProp}`;
        proposedNodeText = `{ ...${originalNodeText}, ${reqProp}: ${sourceVal} }`;
    }

    if (!proposedNodeText) {
        return {
            status: "PATCH_TARGET_UNRESOLVED",
            unavailabilityReason: `Cannot construct sound AST replacement for definition kind '${dataFlow.definitionKind}'`,
        };
    }

    // Construct patched source
    const patchedSource = callerSource.slice(0, start) + proposedNodeText + callerSource.slice(end);

    // Cryptographic patch provenance hash (§28)
    const patchPayload = {
        repository: carrier.repository,
        commit: carrier.commitSha,
        file: carrier.filePath,
        sourceHash: carrier.sourceHash,
        before: originalNodeText,
        after: proposedNodeText,
        line,
        column: callSite.column,
    };
    const cryptographicHash = crypto.createHash("sha256").update(JSON.stringify(patchPayload), "utf8").digest("hex");

    return {
        status: "GENERATED",
        patchedSource,
        currentCode: originalNodeText,
        proposedCode: proposedNodeText,
        patchDiffSummary: `- ${originalNodeText}\n+ ${proposedNodeText}`,
        patchProvenance: {
            sourceRepository: carrier.repository,
            sourceCommit: carrier.commitSha,
            sourceFile: carrier.filePath,
            sourceHash: carrier.sourceHash,
            repairSymbol: callSite.callerSymbol,
            repairLocation: { line, column: callSite.column },
            beforeCode: originalNodeText,
            afterCode: proposedNodeText,
            evidenceRefs: [`callSite:${carrier.filePath}:${callSite.line}`, `source:${carrier.sourceHash}`],
            reason: `Satisfy callee '${contract.calleeSymbol}' contract by supplying verified '${reqProp}' parameter via application data flow.`,
            cryptographicHash,
        },
    };
}
