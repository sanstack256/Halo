/**
 * Halo Repair Intelligence Engine — Validation Blueprint Builder
 *
 * Implements Section 38:
 *   - Builds incident-specific validation blueprints:
 *     - Exact reproduction conditions
 *     - Failure assertion (what must disappear)
 *     - Preservation assertions (what must remain working)
 *     - Edge cases
 *     - Regression test recommendation based on real source context
 */

import type { EvidenceSnapshot } from "../evidence-snapshot";
import type { FailureModel, ValidationBlueprint } from "./types";

interface BuildValidationBlueprintOptions {
    snapshot: EvidenceSnapshot;
    failureModel: FailureModel;
}

/**
 * Builds the ValidationBlueprint for an incident.
 */
export function buildValidationBlueprint(opts: BuildValidationBlueprintOptions): ValidationBlueprint {
    const { snapshot, failureModel } = opts;

    const errorTitle = failureModel.errorTitle;
    const failingExpr = failureModel.failingExpression || "target expression";
    const containingFn = failureModel.containingFunction || "target function";
    const failingFile = failureModel.failingFile || "source file";

    // 1. Reproduction Condition
    const reproductionCondition = `Invoke '${containingFn}' under the conditions that caused '${errorTitle}'. In particular, trigger the execution path reaching '${failingExpr}' in '${failingFile}'.`;

    // 2. Failure Assertion
    const failureAssertion = `The unhandled exception '${errorTitle}' at '${failingFile}:${failureModel.failingLineNumber || ""}' must no longer occur.`;

    // 3. Preservation Assertions
    const preservationAssertions = [
        `Valid invocations of '${containingFn}' must continue returning expected results with identical performance.`,
        `Downstream callers must not receive unexpected null/undefined values unless explicitly defined in the contract.`,
        `Existing error boundaries and metrics reporting must remain functional.`,
    ];

    // 4. Edge Cases
    const edgeCases = [
        `Pass null or undefined for the parameter providing '${failingExpr}'.`,
        `Pass a valid object where '${failingExpr}' throws an internal error during execution.`,
        `Invoke '${containingFn}' concurrently to verify no race conditions in state handling.`,
    ];

    // 5. Relevant Existing Tests
    const relevantExistingTests: string[] = [];
    if (failingFile.includes("/")) {
        const baseName = failingFile.split("/").pop()?.replace(/\.[^.]+$/, "");
        if (baseName) {
            relevantExistingTests.push(`${baseName}.test.ts`, `${baseName}.spec.ts`);
        }
    }

    // 6. New Test Recommendation (Regression Test)
    let newTestRecommendation = undefined;
    if (failureModel.failingLineNumber && failureModel.containingFunction) {
        newTestRecommendation = {
            testName: `should handle missing or invalid ${failingExpr} in ${containingFn}`,
            testCode: `it("should safely handle ${failingExpr} without unhandled error in ${containingFn}", async () => {
    // Arrange: set up invocation where ${failingExpr} is guarded or null
    // Act & Assert: verify graceful handling rather than '${errorTitle}'
    await expect(async () => {
        // invoke ${containingFn}
    }).not.toThrow();
});`,
            testFile: failingFile.replace(/\.(ts|js|tsx|jsx)$/, ".test.$1"),
        };
    }

    return {
        reproductionCondition,
        failureAssertion,
        preservationAssertions,
        edgeCases,
        relevantExistingTests,
        newTestRecommendation,
    };
}
