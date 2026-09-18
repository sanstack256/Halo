/**
 * Halo Trace — Contract and Invariant Extractor
 *
 * Implements Phase 40 Phase F:
 * Extracts behavioral invariants, contracts, schemas, preconditions,
 * and postconditions from AST, TypeScript type signatures, and test assertions.
 */

import ts from "typescript";

export type InvariantType =
    | "LIFECYCLE_CLEANUP"
    | "NON_NULL_FIELD"
    | "IDEMPOTENCY"
    | "STATE_TRANSITION"
    | "RESOURCE_HOLDING_SCOPE"
    | "API_PRECONDITION";

export interface ReconstructedInvariant {
    id: string;
    invariantType: InvariantType;
    governingEntity: string;
    formalStatement: string;
    derivedFrom: "TEST_ASSERTION" | "TYPESCRIPT_TYPE_SYSTEM" | "RUNTIME_GUARD" | "CALLER_ASSUMPTION";
    isViolatedInIncident: boolean;
    violationEvidence?: string;
    evidenceId: string;
}

export function extractContractsAndInvariants(
    sourceCode: string,
    filePath: string,
    failingExpression?: string,
    exceptionMessage?: string,
    testCode?: string
): ReconstructedInvariant[] {
    const sourceFile = ts.createSourceFile(
        filePath,
        sourceCode,
        ts.ScriptTarget.Latest,
        true
    );

    const invariants: ReconstructedInvariant[] = [];
    const excMsgLower = (exceptionMessage || "").toLowerCase();

    // 1. Extract invariants from TypeScript types and parameter signatures
    function scanParametersAndTypes(node: ts.Node) {
        if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
            const funcName = node.name?.getText(sourceFile) || "function";
            for (const param of node.parameters) {
                const paramName = param.name.getText(sourceFile);
                const isOptional = Boolean(param.questionToken || param.initializer);
                const typeText = param.type?.getText(sourceFile) || "";

                if (!isOptional && typeText && !typeText.includes("undefined") && !typeText.includes("null")) {
                    // Non-null required parameter invariant
                    const isViolated = Boolean(
                        failingExpression?.includes(paramName) &&
                        (excMsgLower.includes("undefined") || excMsgLower.includes("null") || excMsgLower.includes("cannot read"))
                    );

                    invariants.push({
                        id: `inv_type_${funcName}_${paramName}`,
                        invariantType: "NON_NULL_FIELD",
                        governingEntity: `${funcName}(${paramName})`,
                        formalStatement: `Parameter '${paramName}' of '${funcName}' must be non-null and provided by caller.`,
                        derivedFrom: "TYPESCRIPT_TYPE_SYSTEM",
                        isViolatedInIncident: isViolated,
                        violationEvidence: isViolated ? `Runtime dereference of '${paramName}' threw '${exceptionMessage}'.` : undefined,
                        evidenceId: `ev_type_${funcName}_${paramName}`,
                    });
                }
            }
        }

        // 2. Extract invariants from try/finally or try/catch blocks
        if (ts.isTryStatement(node)) {
            if (node.finallyBlock) {
                invariants.push({
                    id: `inv_finally_${node.getStart(sourceFile)}`,
                    invariantType: "LIFECYCLE_CLEANUP",
                    governingEntity: filePath,
                    formalStatement: "Resources acquired prior to try block must be released in finally block on all exit paths.",
                    derivedFrom: "RUNTIME_GUARD",
                    isViolatedInIncident: excMsgLower.includes("timeout") || excMsgLower.includes("exhaust"),
                    evidenceId: `ev_finally_${node.getStart(sourceFile)}`,
                });
            }
        }

        ts.forEachChild(node, scanParametersAndTypes);
    }

    scanParametersAndTypes(sourceFile);

    // 3. Extract invariants from test assertions if tests are provided
    if (testCode) {
        const testFile = ts.createSourceFile("test.ts", testCode, ts.ScriptTarget.Latest, true);
        function scanTests(node: ts.Node) {
            if (ts.isCallExpression(node)) {
                const text = node.getText(testFile);
                if (text.includes("expect(") && text.includes(".toBe(")) {
                    invariants.push({
                        id: `inv_test_${node.getStart(testFile)}`,
                        invariantType: "API_PRECONDITION",
                        governingEntity: "TestSuite",
                        formalStatement: `Test assertion specifies behavioral constraint: ${text.slice(0, 80)}.`,
                        derivedFrom: "TEST_ASSERTION",
                        isViolatedInIncident: true,
                        evidenceId: `ev_test_${node.getStart(testFile)}`,
                    });
                }
            }
            ts.forEachChild(node, scanTests);
        }
        scanTests(testFile);
    }

    return invariants;
}
