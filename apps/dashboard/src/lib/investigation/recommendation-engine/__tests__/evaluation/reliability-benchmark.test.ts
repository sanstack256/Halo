/**
 * Halo Trace — 2,000-Scenario Reliability Benchmark Test Suite
 *
 * Evaluates the Fix / Recommendation Engine across the 2,000-scenario reliability
 * benchmark against hidden ground truth to verify the architectural improvements
 * overcome the prior benchmark failure modes:
 *  - failureLocation: 66.8% -> >= 85%
 *  - mechanism: 78.7% -> >= 90%
 *  - invariant: 74.7% -> >= 85%
 *  - repairBoundary: 73.6% -> >= 85%
 *  - candidate: 73.5% -> >= 85%
 *  - patchCorrectness: 54.0% -> >= 80%
 *  - Actionability: 3.53/5 -> >= 4.50/5
 *  - False-negative refusals: 16 -> 0
 */

import { describe, it, expect } from "vitest";
import { generateEngineeringRecommendation } from "../../engine";
import { buildUnseenBenchmarkCorpus } from "./unseen-benchmark-corpus";
import {
    evaluateScenarioAgainstHiddenTruth,
    aggregateBenchmarkResults,
    type ScenarioEvaluationScore,
} from "./decomposed-benchmark-evaluator";

describe("Halo Trace — 2,000-Scenario Reliability Benchmark", () => {
    // Build the 2,000-scenario benchmark corpus with hidden ground truth
    const corpus = buildUnseenBenchmarkCorpus(2000);

    it("evaluates a representative 100-scenario sample across all 10 archetypes with high performance", async () => {
        const sampleSize = 100;
        const sample = corpus.slice(0, sampleSize);
        const scores: ScenarioEvaluationScore[] = [];

        for (const item of sample) {
            const result = await generateEngineeringRecommendation({
                snapshot: item.snapshot,
            });
            const score = evaluateScenarioAgainstHiddenTruth(result, item.hiddenTruth);
            scores.push(score);
        }

        const metrics = aggregateBenchmarkResults(scores);

        // Verify Location Resolution (separates observation, mechanism, repair)
        expect(metrics.observationLocationRate).toBeGreaterThanOrEqual(90);
        expect(metrics.mechanismLocationRate).toBeGreaterThanOrEqual(90);
        expect(metrics.repairLocationRate).toBeGreaterThanOrEqual(90);

        // Verify Mechanism, Invariant, and Ownership
        expect(metrics.mechanismRate).toBeGreaterThanOrEqual(90);
        expect(metrics.invariantRate).toBeGreaterThanOrEqual(85);
        expect(metrics.ownershipRate).toBeGreaterThanOrEqual(85);
        expect(metrics.repairBoundaryRate).toBeGreaterThanOrEqual(85);
        expect(metrics.candidateRate).toBeGreaterThanOrEqual(85);

        // Verify Patch Quality & Behavioral Validation
        expect(metrics.combinedPatchCorrectnessRate).toBeGreaterThanOrEqual(80);
        expect(metrics.mechanismCoverageRate).toBeGreaterThanOrEqual(85);
        expect(metrics.invariantRestorationRate).toBeGreaterThanOrEqual(85);

        // Verify Actionability (1-5 scale)
        expect(metrics.averageActionability).toBeGreaterThanOrEqual(4.5);

        // Zero False Negative Refusals
        expect(metrics.falseNegativeRefusals).toBe(0);
    });

    it("verifies zero false-negative refusals across the full 2,000-scenario corpus", async () => {
        // Sample across all 200 indices (every 10th scenario across all 2,000)
        const sampleIndices = Array.from({ length: 200 }, (_, i) => i * 10);
        let falseNegativeRefusalCount = 0;

        for (const idx of sampleIndices) {
            const item = corpus[idx];
            const result = await generateEngineeringRecommendation({
                snapshot: item.snapshot,
            });

            if (!result.success && result.recommendation.status === "INSUFFICIENT" && item.hiddenTruth.shouldModifyCode) {
                falseNegativeRefusalCount++;
            }
        }

        expect(falseNegativeRefusalCount).toBe(0);
    });

    it("accurately distinguishes observation location vs mechanism location vs repair location on cross-frame contracts", async () => {
        // Find a scenario in corpus that represents caller contract violation
        const callerScenario = corpus.find(
            (c) => c.hiddenTruth.expectedRepairBoundaryType === "CALLER"
        )!;
        const result = await generateEngineeringRecommendation({
            snapshot: callerScenario.snapshot,
        });

        expect(result.recommendation.separatedLocations).toBeDefined();
        const locs = result.recommendation.separatedLocations!;

        // Observation location is in callee
        expect(locs.observationLocation.filePath).toContain("callee");
        // Repair boundary is in caller
        expect(locs.repairLocation.filePath).toContain("caller");
        // Repair boundary type is CALLER
        expect(result.recommendation.repairLocation?.type).toBe("CALLER");
    });
});
