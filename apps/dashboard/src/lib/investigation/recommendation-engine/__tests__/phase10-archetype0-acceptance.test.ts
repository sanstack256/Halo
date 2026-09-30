import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import { buildUnseenBenchmarkCorpus } from "./evaluation/unseen-benchmark-corpus";
import { generateEngineeringRecommendation } from "../engine";
import { buildCompleteVerifiedRepairProofChain } from "../proof-engine";
import {
    registerAuthoritativeCommit,
    clearRegisteredCommits,
    clearSourceCache,
} from "../../runtime/source-provenance";

describe("Phase 10 — Archetype-0 Acceptance Suite (§60 - §64)", () => {
    const corpus = buildUnseenBenchmarkCorpus(105);

    const ARCHETYPE_0_SCENARIO_IDS = [
        "BENCHMARK_SCENARIO_0001",
        "BENCHMARK_SCENARIO_0011",
        "BENCHMARK_SCENARIO_0021",
        "BENCHMARK_SCENARIO_0031",
        "BENCHMARK_SCENARIO_0041",
        "BENCHMARK_SCENARIO_0051",
        "BENCHMARK_SCENARIO_0061",
        "BENCHMARK_SCENARIO_0071",
        "BENCHMARK_SCENARIO_0081",
        "BENCHMARK_SCENARIO_0091",
        "BENCHMARK_SCENARIO_0101",
    ];

    beforeEach(() => {
        clearRegisteredCommits();
        clearSourceCache();
    });

    it("verifies the test corpus contains all 11 Archetype-0 scenarios (§60)", () => {
        expect(ARCHETYPE_0_SCENARIO_IDS.length).toBe(11);
        for (const id of ARCHETYPE_0_SCENARIO_IDS) {
            const item = corpus.find(c => c.id === id);
            expect(item).toBeDefined();
            expect(item?.hiddenTruth.expectedDefectCategory).toBe("CALLER_CONTRACT_VIOLATION");
            expect(item?.hiddenTruth.expectedRepairBoundaryType).toBe("CALLER");
        }
    });

    for (const scenarioId of ARCHETYPE_0_SCENARIO_IDS) {
        it(`proves end-to-end causal repair on ${scenarioId} (§61, §62)`, async () => {
            const item = corpus.find(c => c.id === scenarioId)!;
            expect(item).toBeDefined();

            const service = item.snapshot.incident.service;
            const commitSha = `commit-${item.id}`;
            const callerFile = item.hiddenTruth.expectedRepairFile;
            const calleeFile = item.hiddenTruth.expectedObservationFile;

            const calleeSource = item.snapshot.source!.lines.map(l => l.content).join("\n");
            const frames = item.snapshot.failure?.frames || (item.snapshot as any).stackFrames || [];
            const callerFrame = frames.find((f: any) => f.filePath === callerFile);
            const callerFunctionName = callerFrame?.functionName || "dispatch";
            const calleeBase = path.basename(calleeFile);

            const callerSource = `
import { requireTenant } from "./${calleeBase}";

export function ${callerFunctionName}(request: any) {
    const context = {
        userId: request.user?.id || "user-1",
    };
    requireTenant(context);
    return { status: "dispatched", userId: context.userId };
}
`.trim();

            // 1. Authoritative Repository Registration at exact incident commit (§7, §14)
            registerAuthoritativeCommit(service, commitSha, {
                [calleeFile]: calleeSource,
                [callerFile]: callerSource,
            });

            // 2. Run Halo Recommendation Pipeline
            const recResult = await generateEngineeringRecommendation({
                snapshot: item.snapshot,
            });

            expect(recResult.success).toBe(true);
            const rec = recResult.recommendation;

            expect(rec.repairLocation?.type).toBe("CALLER");
            expect(rec.changes).toBeDefined();
            expect(rec.changes?.length).toBeGreaterThan(0);
            expect(rec.changes![0].filePath).toBe(callerFile);
            expect(rec.changes![0].proposedCode).toContain("tenantId:");
            expect(rec.changes![0].isExactSourceVerified).toBe(true);

            // 3. Hermetic Sandbox Proof Chain Execution (§30 - §37)
            const chainResult = buildCompleteVerifiedRepairProofChain({
                snapshot: item.snapshot,
                changes: rec.changes!,
                candidateId: `cand-${item.id}`,
            });

            // 4. Verify all proof gates (§32 - §37, §63)
            expect(chainResult.proofChain.baselineProof?.status).toBe("VERIFIED");
            expect(chainResult.proofChain.patchProof?.status).toBe("VERIFIED");
            expect(chainResult.proofChain.behaviorProof?.status).toBe("VERIFIED");
            expect(chainResult.proofChain.invariantProof?.status).toBe("VERIFIED");
            expect(chainResult.proofChain.regressionProof?.status).toBe("VERIFIED");
            expect(chainResult.proofChain.counterexampleProof?.status).toBe("VERIFIED");
            expect(chainResult.gateResult.isVerified).toBe(true);
        });
    }
});
