/**
 * Halo Trace — Step 8, Step 9 & Step 31: Real Patch Execution Harness & Behavioral Validation
 *
 * Implements Step 8 & Step 9:
 * 1. Creates a clean repository copy in an isolated temp directory.
 * 2. Executes the scenario before applying Halo's patch -> confirms reproduction.
 * 3. Runs the real Halo recommendation engine to obtain proposed changes.
 * 4. Verifies every target file exists.
 * 5. Applies the exact generated changes to disk (no manual correction).
 * 6. Executes syntax/typecheck.
 * 7. Re-runs the operation and regression test.
 * 8. Verifies:
 *    - Original failure disappeared
 *    - Expected behavior returned
 *    - Unrelated behavior preserved
 *
 * Implements Step 31:
 * Validates across hidden evaluation repositories not referenced in production code.
 */

import { describe, it, expect, afterAll } from "vitest";
import { RealPatchExecutionHarness } from "./real-patch-harness";
import { getMultiFileScenarios } from "./multi-file-scenarios";
import { getHiddenEvaluationRepositories } from "./hidden-repositories";

describe("Step 8 & 9 — Real Patch Execution & Behavioral Validation", () => {
    const harness = new RealPatchExecutionHarness();

    afterAll(() => {
        harness.cleanup();
    });

    // 1. EXECUTE REAL PATCHES ON MULTI-FILE SCENARIOS
    describe("Multi-File Real Patch Executions", () => {
        const scenarios = getMultiFileScenarios();

        for (const scenario of scenarios) {
            it(`Executes, reproduces, patches, and resolves: ${scenario.title}`, async () => {
                const repoDir = harness.setupCleanRepo(scenario);

                // Step 8.4: Confirm intended failure exists before patch
                const before = harness.executeBefore(repoDir, scenario);
                expect(before.reproduced).toBe(true);

                // Step 8.5 & 8.6: Run real Halo investigation & generate recommendation
                const snapshot = scenario.snapshotFactory(repoDir);
                const evalResult = await harness.evaluateScenario(scenario);

                expect(evalResult.reproducedBefore).toBe(true);
                expect(evalResult.recommendationGenerated).toBe(true);
                expect(evalResult.changesAppliedCount).toBeGreaterThan(0);
                expect(evalResult.typecheckPassed).toBe(true);
                expect(evalResult.testsPassedAfter).toBe(true);
                expect(evalResult.originalFailureResolved).toBe(true);
                expect(evalResult.expectedBehaviorRestored).toBe(true);
            });
        }
    });

    // 2. EXECUTE REAL PATCHES ON HIDDEN REPOSITORIES (Step 31)
    describe("Hidden Evaluation Repositories (Step 31)", () => {
        const hiddenRepos = getHiddenEvaluationRepositories();

        // Test sample across all archetypes in hidden repositories
        const testSubset = [
            hiddenRepos[0], // NULL_DEREFERENCE
            hiddenRepos[1], // SERIALIZATION
            hiddenRepos[2], // COLLECTION_BOUNDARY
            hiddenRepos[3], // STATE_MACHINE
            hiddenRepos[4], // RESOURCE_LIFECYCLE
            hiddenRepos[5], // EXTERNAL_TIMEOUT
            hiddenRepos[6], // NULL_DEREFERENCE variant
            hiddenRepos[7], // SERIALIZATION variant
            hiddenRepos[8], // COLLECTION_BOUNDARY variant
            hiddenRepos[9], // STATE_MACHINE variant
        ];

        for (const repo of testSubset) {
            it(`Hidden Repo [${repo.id}]: ${repo.title}`, async () => {
                const repoDir = harness.setupCleanRepo(repo);

                // Verify before-reproduction
                const before = harness.executeBefore(repoDir, repo);
                expect(before.reproduced).toBe(true);

                // Run real Halo recommendation
                const snapshot = repo.snapshotFactory(repoDir);
                const evalResult = await harness.evaluateScenario(repo);

                expect(evalResult.reproducedBefore).toBe(true);
                expect(evalResult.recommendationGenerated).toBe(true);
                expect(evalResult.changesAppliedCount).toBeGreaterThan(0);
                expect(evalResult.typecheckPassed).toBe(true);
                expect(evalResult.testsPassedAfter).toBe(true);
                expect(evalResult.originalFailureResolved).toBe(true);
                expect(evalResult.expectedBehaviorRestored).toBe(true);
            });
        }
    });
});
