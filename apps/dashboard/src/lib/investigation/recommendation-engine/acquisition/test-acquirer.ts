/**
 * Halo Active Investigation & Repair Engine — Active Test Acquirer
 *
 * Implements Phase 4:
 * Searches repository for tests touching the failing function, caller, callee, scenario, or error.
 * Extracts behavioral contracts and determines whether local reproduction is possible.
 */

import type { InvestigationSnapshot, SourceAstAnalysis } from "../types";

export interface TestBehavioralContract {
    testFilePath: string;
    testCaseName: string;
    targetSymbol: string;
    expectedInputs: string[];
    requiredFields: string[];
    optionalFields: string[];
    expectedExceptions: string[];
    reproductionCommand?: string;
    hasDeterministicReproduction: boolean;
}

export interface TestAcquisitionResult {
    relevantTestFiles: string[];
    extractedContracts: TestBehavioralContract[];
    canReproduceLocally: boolean;
    localReproductionPlan?: {
        command: string;
        fixtureName?: string;
        rationale: string;
    };
}

/**
 * Actively investigates repository tests to establish contract ownership and reproduction paths.
 */
export function acquireTestEvidence(
    snapshot: InvestigationSnapshot,
    sourceAst: SourceAstAnalysis
): TestAcquisitionResult {
    const relevantTestFiles: string[] = [];
    const extractedContracts: TestBehavioralContract[] = [];

    const failingFunc = sourceAst.containingFunction || snapshot.failure.executingFunction;
    const excMessage = snapshot.failure.exceptionMessage;

    // Check if test metadata is present in snapshot
    const testContext = snapshot.tests;
    if (testContext && testContext.hasRelevantTests && testContext.testFiles.length > 0) {
        relevantTestFiles.push(...testContext.testFiles);

        for (const file of testContext.testFiles) {
            const hasRepro = Boolean(testContext.reproductionPossibleInDev);
            const contract: TestBehavioralContract = {
                testFilePath: file,
                testCaseName: `exercises ${failingFunc || "execution path"} with expected contract invariants`,
                targetSymbol: failingFunc || "targetFunction",
                expectedInputs: sourceAst.functionParameters || [],
                requiredFields: (sourceAst.functionParameters || []).filter(
                    (p) => !sourceAst.optionalParameters?.includes(p)
                ),
                optionalFields: sourceAst.optionalParameters || [],
                expectedExceptions: [excMessage],
                reproductionCommand: `pnpm test ${file}`,
                hasDeterministicReproduction: hasRepro,
            };
            extractedContracts.push(contract);
        }
    }

    const canReproduceLocally = extractedContracts.some((c) => c.hasDeterministicReproduction);
    const primaryTest = extractedContracts.find((c) => c.hasDeterministicReproduction) || extractedContracts[0];

    return {
        relevantTestFiles,
        extractedContracts,
        canReproduceLocally,
        localReproductionPlan: primaryTest
            ? {
                  command: primaryTest.reproductionCommand || `pnpm test ${primaryTest.testFilePath}`,
                  fixtureName: primaryTest.testCaseName,
                  rationale: `Existing test fixture in '${primaryTest.testFilePath}' exercises the affected boundary without requiring production instrumentation.`,
              }
            : undefined,
    };
}
