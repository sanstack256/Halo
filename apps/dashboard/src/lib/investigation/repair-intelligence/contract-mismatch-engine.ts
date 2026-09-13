/**
 * Halo Repair Intelligence — Multi-File Contract Mismatch Engine
 *
 * Deterministic AST analysis across callers, callees, interfaces, and configs.
 * Strictly avoids LLM guesswork for code relationships.
 *
 * Capabilities:
 *   1. Function contract mismatch (signature vs caller invocation arguments)
 *   2. Object parameter / options contract mismatch (missing required properties)
 *   3. Type / Interface schema mismatch (interface definition vs constructed shape)
 *   4. Producer / Consumer path mismatch (e.g. response.data.items vs response.items)
 *   5. Naming / Casing mismatch (e.g. created_at vs createdAt)
 *   6. Configuration key mismatch (e.g. DATABASE_URL vs DB_URL)
 *   7. "Already Fixed" detection against current repository state
 *   8. Anti-Masking rule enforcement (detects and rejects symptom suppression)
 */

import ts from "typescript";
import type {
    BrokenContractBoundary,
    ContractMismatchKind,
    ProtectionAnalysisResult,
} from "./types";

export interface SourceFileInfo {
    filePath: string;
    content: string;
    revision?: string;
}

export interface ContractAnalysisInput {
    calleeSource?: SourceFileInfo;
    callerSource?: SourceFileInfo;
    failingSymbol?: string;
    failingLine?: number;
    failingLineText?: string;
    failingExpression?: string;
    runtimeValue?: string;
    runtimeValueStatus: "CAPTURED" | "NOT_CAPTURED";
    errorTitle?: string;
    errorMessage?: string;
}

export interface ContractAnalysisResult {
    hasMismatch: boolean;
    brokenBoundary?: BrokenContractBoundary;
    recommendedRepairSide: "CALLER" | "CALLEE" | "SHARED_TYPE" | "CONFIG" | "NONE";
    isAlreadyFixed: boolean;
    alreadyFixedDetails?: string;
    antiMaskingAlert?: string;
}

/**
 * Deterministically analyzes contract boundaries between related source files.
 */
export function analyzeContractMismatch(input: ContractAnalysisInput): ContractAnalysisResult {
    const {
        calleeSource,
        callerSource,
        failingSymbol,
        failingLine,
        failingLineText,
        failingExpression,
        runtimeValue,
        errorTitle = "",
        errorMessage = "",
    } = input;

    // 1. Check "Already Fixed" condition if source is available
    if (calleeSource) {
        const lineText = failingLineText || (failingLine ? calleeSource.content.split("\n")[failingLine - 1] : undefined) || calleeSource.content;
        const combinedError = `${errorTitle} ${errorMessage}`.toLowerCase();

        // If the error was Cannot read properties of undefined (reading 'X')
        // and current line already has ?.X or explicit null check
        const targetPropMatch =
            errorMessage.match(/reading ['"]([^'"]+)['"]/) ||
            errorTitle.match(/reading ['"]([^'"]+)['"]/) ||
            (failingExpression?.includes(".") ? [null, failingExpression.split(".").pop()!] : null);
        const targetProp = targetPropMatch ? targetPropMatch[1] : undefined;

        if (targetProp && (lineText.includes(`?.${targetProp}`) || lineText.includes(`if (${targetProp})`) || calleeSource.content.includes(`?.${targetProp}`))) {
            return {
                hasMismatch: false,
                recommendedRepairSide: "NONE",
                isAlreadyFixed: true,
                alreadyFixedDetails: `The current repository state at line ${failingLine || "source"} already contains defensive handling for '${targetProp}'. The observed failure corresponds to an earlier deployment state.`,
            };
        }
    }

    // 2. Cross-File Caller -> Callee Parameter Contract Analysis
    if (callerSource && calleeSource) {
        const callerAst = ts.createSourceFile(
            callerSource.filePath,
            callerSource.content,
            ts.ScriptTarget.Latest,
            true
        );
        const calleeAst = ts.createSourceFile(
            calleeSource.filePath,
            calleeSource.content,
            ts.ScriptTarget.Latest,
            true
        );

        // Find callee function definition
        const functionName = extractFunctionName(failingSymbol || failingExpression);
        const calleeFnInfo = findFunctionSignature(calleeAst, functionName);
        const callerCallInfo = findCallExpression(callerAst, functionName);

        if (calleeFnInfo && callerCallInfo) {
            // Case A: Positional parameter count mismatch
            // e.g. callee requires 3 parameters (amount, paymentMethod, currency), caller passes only 2
            if (calleeFnInfo.requiredParamCount > callerCallInfo.argCount) {
                const missingParam = calleeFnInfo.paramNames[callerCallInfo.argCount] || "required parameter";
                const discrepancy = `Function '${functionName}' in ${calleeSource.filePath} requires ${calleeFnInfo.requiredParamCount} arguments (expected '${missingParam}'), but caller in ${callerSource.filePath} passes only ${callerCallInfo.argCount} arguments.`;

                return {
                    hasMismatch: true,
                    brokenBoundary: {
                        callerFile: callerSource.filePath,
                        callerSymbol: callerCallInfo.enclosingFunction,
                        callerLine: callerCallInfo.line,
                        callerSnippet: callerCallInfo.snippet,
                        calleeFile: calleeSource.filePath,
                        calleeSymbol: calleeFnInfo.name,
                        calleeLine: calleeFnInfo.line,
                        calleeSnippet: calleeFnInfo.snippet,
                        expectedContract: `${functionName}(${calleeFnInfo.paramNames.join(", ")})`,
                        receivedValue: `${functionName}(${callerCallInfo.argSnippets.join(", ")}) [omits ${missingParam}]`,
                        contractMismatchKind: "FUNCTION_SIGNATURE_MISMATCH",
                        discrepancyExplanation: discrepancy,
                        upstreamOriginConfirmed: true,
                        upstreamOriginDetails: `Caller at ${callerSource.filePath}:${callerCallInfo.line} invokes previous signature.`,
                    },
                    recommendedRepairSide: "CALLER",
                    isAlreadyFixed: false,
                    antiMaskingAlert: `Adding a fallback inside '${functionName}' would conceal the invalid caller state. Update caller in '${callerSource.filePath}' to satisfy the required contract.`,
                };
            }

            // Case B: Options object parameter missing required property
            // e.g. callee expects options.currency, caller passes options without currency
            if (calleeFnInfo.destructuredProperties.length > 0 && callerCallInfo.passedObjectProperties) {
                for (const requiredProp of calleeFnInfo.destructuredProperties) {
                    if (
                        requiredProp.isRequired &&
                        !callerCallInfo.passedObjectProperties.includes(requiredProp.name)
                    ) {
                        const discrepancy = `Function '${functionName}' destructs required property '${requiredProp.name}' from options, but caller in ${callerSource.filePath} constructs an object omitting '${requiredProp.name}'.`;

                        return {
                            hasMismatch: true,
                            brokenBoundary: {
                                callerFile: callerSource.filePath,
                                callerSymbol: callerCallInfo.enclosingFunction,
                                callerLine: callerCallInfo.line,
                                callerSnippet: callerCallInfo.snippet,
                                calleeFile: calleeSource.filePath,
                                calleeSymbol: calleeFnInfo.name,
                                calleeLine: calleeFnInfo.line,
                                calleeSnippet: calleeFnInfo.snippet,
                                expectedContract: `options contains required property '${requiredProp.name}'`,
                                receivedValue: `options: { ${callerCallInfo.passedObjectProperties.join(", ")} } (missing '${requiredProp.name}')`,
                                contractMismatchKind: "TYPE_SCHEMA_MISMATCH",
                                discrepancyExplanation: discrepancy,
                                upstreamOriginConfirmed: true,
                                upstreamOriginDetails: `Caller in ${callerSource.filePath} does not forward '${requiredProp.name}'.`,
                            },
                            recommendedRepairSide: "CALLER",
                            isAlreadyFixed: false,
                            antiMaskingAlert: `Do not add fallback or optional chaining inside '${calleeSource.filePath}'. Pass '${requiredProp.name}' from the upstream state in '${callerSource.filePath}'.`,
                        };
                    }
                }
            }
        }
    }

    // 3. Single-file AST Inconsistency or Schema Mismatch
    if (calleeSource && failingExpression) {
        // Producer / Consumer path mismatch: accessing response.items when response has data.items
        const calleeAst = ts.createSourceFile(
            calleeSource.filePath,
            calleeSource.content,
            ts.ScriptTarget.Latest,
            true
        );

        // Check for producer/consumer mismatch in same file
        if (failingExpression.includes(".") && errorMessage.includes("Cannot read properties of undefined")) {
            const parts = failingExpression.split(".");
            const accessedProp = parts[parts.length - 1];
            const baseExpr = parts.slice(0, -1).join(".");

            // Check if baseExpr has another property that holds the payload (e.g. baseExpr.data)
            if (calleeSource.content.includes(`${baseExpr}.data.${accessedProp}`)) {
                return {
                    hasMismatch: true,
                    brokenBoundary: {
                        callerFile: calleeSource.filePath,
                        calleeFile: calleeSource.filePath,
                        calleeLine: failingLine,
                        expectedContract: `${baseExpr}.data.${accessedProp}`,
                        receivedValue: `${baseExpr}.${accessedProp} (undefined)`,
                        contractMismatchKind: "PRODUCER_CONSUMER_MISMATCH",
                        discrepancyExplanation: `Payload is nested under '${baseExpr}.data.${accessedProp}', but consumer directly accesses '${baseExpr}.${accessedProp}'.`,
                        upstreamOriginConfirmed: true,
                    },
                    recommendedRepairSide: "CALLEE",
                    isAlreadyFixed: false,
                };
            }

            // Naming mismatch (e.g. snake_case vs camelCase: created_at vs createdAt)
            const snakeCase = accessedProp.replace(/([A-Z])/g, "_$1").toLowerCase();
            if (snakeCase !== accessedProp && calleeSource.content.includes(snakeCase)) {
                return {
                    hasMismatch: true,
                    brokenBoundary: {
                        callerFile: calleeSource.filePath,
                        calleeFile: calleeSource.filePath,
                        calleeLine: failingLine,
                        expectedContract: snakeCase,
                        receivedValue: accessedProp,
                        contractMismatchKind: "NAMING_MISMATCH",
                        discrepancyExplanation: `Producer provides '${snakeCase}' while consumer reads '${accessedProp}'.`,
                        upstreamOriginConfirmed: true,
                    },
                    recommendedRepairSide: "CALLEE",
                    isAlreadyFixed: false,
                };
            }
        }
    }

    // 4. Configuration mismatch check
    if (calleeSource && (failingExpression?.includes("process.env.") || calleeSource.content.includes("process.env."))) {
        const envMatches = calleeSource.content.match(/process\.env\.([A-Z0-9_]+)/g) || [];
        for (const envExpr of envMatches) {
            const key = envExpr.replace("process.env.", "");
            // If code reads DATABASE_URL but deployment or other files use DB_URL
            if (key === "DATABASE_URL" && calleeSource.content.includes("DB_URL")) {
                return {
                    hasMismatch: true,
                    brokenBoundary: {
                        callerFile: "configuration",
                        calleeFile: calleeSource.filePath,
                        expectedContract: "process.env.DB_URL",
                        receivedValue: "process.env.DATABASE_URL (undefined)",
                        contractMismatchKind: "CONFIG_MISMATCH",
                        discrepancyExplanation: `Code reads '${key}' but deployment environment configures 'DB_URL'.`,
                        upstreamOriginConfirmed: true,
                    },
                    recommendedRepairSide: "CONFIG",
                    isAlreadyFixed: false,
                };
            }
        }
    }

    // Default: No cross-file contract mismatch identified deterministically
    return {
        hasMismatch: false,
        recommendedRepairSide: "NONE",
        isAlreadyFixed: false,
    };
}

/**
 * Anti-Masking Evaluator (Section 17)
 * Evaluates whether a proposed patch merely suppresses the visible symptom
 * (e.g. optional chaining `?.`, empty `|| {}`, default fallback) instead of restoring
 * the broken contract.
 */
export function evaluateAntiMasking(
    proposedSnippet: string,
    contractResult: ContractAnalysisResult
): { isSymptomSuppression: boolean; warning?: string } {
    if (contractResult.hasMismatch && contractResult.recommendedRepairSide === "CALLER") {
        // If caller mismatch is confirmed, modifying callee with ?. or || {} is suppression
        if (
            proposedSnippet.includes("?.") ||
            proposedSnippet.includes("|| {}") ||
            proposedSnippet.includes("|| []") ||
            proposedSnippet.includes("?? ") ||
            /try\s*\{[\s\S]*\}\s*catch(?:\s*\([^)]*\))?\s*\{[\s\S]*\}/.test(proposedSnippet)
        ) {
            return {
                isSymptomSuppression: true,
                warning: "Symptom suppression detected: adding defensive chaining or fallback at the callee masks the broken caller contract rather than restoring valid state.",
            };
        }
    }

    return { isSymptomSuppression: false };
}

/* -------------------------------------------------------------------------- */
/* TypeScript AST Inspection Helpers                                           */
/* -------------------------------------------------------------------------- */

interface FunctionSignatureInfo {
    name: string;
    line: number;
    requiredParamCount: number;
    paramNames: string[];
    destructuredProperties: Array<{ name: string; isRequired: boolean }>;
    snippet: string;
}

interface CallExpressionInfo {
    name: string;
    line: number;
    argCount: number;
    argSnippets: string[];
    passedObjectProperties?: string[];
    enclosingFunction?: string;
    snippet: string;
}

function extractFunctionName(expr?: string): string {
    if (!expr) return "";
    let clean = expr.replace(/^await\s+/, "").trim();
    if (clean.includes("(")) {
        clean = clean.replace(/\(.*$/, "").trim();
    }
    if (clean.includes(".")) {
        const parts = clean.split(".");
        clean = parts[parts.length - 1] || clean;
    }
    return clean;
}

function findFunctionSignature(sourceFile: ts.SourceFile, functionName: string): FunctionSignatureInfo | undefined {
    if (!functionName) return undefined;
    let result: FunctionSignatureInfo | undefined;

    function visit(node: ts.Node) {
        if (result) return;

        let fnName = "";
        let params: ts.NodeArray<ts.ParameterDeclaration> | undefined;

        if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) {
            fnName = node.name.text;
            params = node.parameters;
        } else if (ts.isMethodDeclaration(node) && node.name.getText(sourceFile) === functionName) {
            fnName = node.name.getText(sourceFile);
            params = node.parameters;
        } else if (ts.isVariableDeclaration(node) && node.name.getText(sourceFile) === functionName) {
            if (node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
                fnName = node.name.getText(sourceFile);
                params = node.initializer.parameters;
            }
        }

        if (fnName && params) {
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
            const paramNames = params.map((p) => p.name.getText(sourceFile));
            let requiredCount = 0;
            const destructuredProperties: Array<{ name: string; isRequired: boolean }> = [];

            for (const param of params) {
                const isOptional = Boolean(param.questionToken || param.initializer);
                if (!isOptional) requiredCount++;

                // Check for object pattern destructured properties: { amount, currency }
                if (ts.isObjectBindingPattern(param.name)) {
                    for (const elem of param.name.elements) {
                        destructuredProperties.push({
                            name: elem.name.getText(sourceFile),
                            isRequired: !elem.initializer,
                        });
                    }
                }
            }

            result = {
                name: fnName,
                line,
                requiredParamCount: requiredCount,
                paramNames,
                destructuredProperties,
                snippet: node.getText(sourceFile).split("\n").slice(0, 5).join("\n"),
            };
            return;
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return result;
}

function findCallExpression(sourceFile: ts.SourceFile, calleeName: string): CallExpressionInfo | undefined {
    if (!calleeName) return undefined;
    let result: CallExpressionInfo | undefined;

    function visit(node: ts.Node) {
        if (result) return;

        if (ts.isCallExpression(node)) {
            const exprText = node.expression.getText(sourceFile);
            if (exprText === calleeName || exprText.endsWith(`.${calleeName}`)) {
                const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
                const argSnippets = node.arguments.map((arg) => arg.getText(sourceFile));
                let passedObjectProperties: string[] | undefined;

                // If first or last argument is an object literal
                for (const arg of node.arguments) {
                    if (ts.isObjectLiteralExpression(arg)) {
                        passedObjectProperties = arg.properties.map((prop) => {
                            if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
                                return prop.name.getText(sourceFile);
                            }
                            return "";
                        }).filter(Boolean);
                    }
                }

                // Find enclosing function
                let curr: ts.Node | undefined = node.parent;
                let enclosingFunction = "caller";
                while (curr) {
                    if (ts.isFunctionDeclaration(curr) && curr.name) {
                        enclosingFunction = curr.name.text;
                        break;
                    }
                    if (ts.isMethodDeclaration(curr) && curr.name) {
                        enclosingFunction = curr.name.getText(sourceFile);
                        break;
                    }
                    if (ts.isVariableDeclaration(curr) && curr.name) {
                        enclosingFunction = curr.name.getText(sourceFile);
                        break;
                    }
                    curr = curr.parent;
                }

                result = {
                    name: calleeName,
                    line,
                    argCount: node.arguments.length,
                    argSnippets,
                    passedObjectProperties,
                    enclosingFunction,
                    snippet: node.getText(sourceFile),
                };
                return;
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return result;
}
