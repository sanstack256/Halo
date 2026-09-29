/**
 * Autonomous Repair Search Loop & Failure Feedback Test Suite (§28, §29, §30, §70)
 *
 * Verifies that:
 * 1. A candidate that fails validation records failure evidence (§70)
 * 2. That failure evidence feeds into the generation of Candidate B (§28, §29)
 * 3. Semantically identical candidates are deduplicated (§30)
 * 4. The search loop terminates safely without infinite loops or hardcoded bounds
 */

import { describe, it, expect } from "vitest";
import {
    executeRepairSearchLoop,
    computeCandidateSemanticKey,
    SearchLoopCandidate,
} from "../proof-engine";
import { buildInvestigationSnapshot } from "../investigation-snapshot";

describe("Autonomous Repair Search Loop (§28, §29, §30, §70)", () => {
    it("deduplicates candidates that differ textually but perform the same transformation (§30)", () => {
        const candidate1 = {
            changes: [{
                filePath: "src/calc.ts",
                proposedCode: "function add(a, b) { return a + b; }",
            }],
        };

        const candidate2 = {
            changes: [{
                filePath: "src/calc.ts",
                proposedCode: "function  add ( a,  b )  {\n  // Add two numbers\n  return  a + b ;\n}",
            }],
        };

        const key1 = computeCandidateSemanticKey(candidate1);
        const key2 = computeCandidateSemanticKey(candidate2);

        expect(key1).toBe(key2);
    });

    it("runs multi-candidate search loop with failure feedback from Candidate A to Candidate B (§28, §29, §70)", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "search-loop-01",
                title: "TypeError: Cannot read properties of undefined (reading 'taxRate')",
                firstSeen: new Date(),
                lastSeen: new Date(),
            },
            rawEvidence: [],
            stackFrames: [{ filePath: "src/tax/calculator.ts", lineNumber: 42, functionName: "calculateTax" }],
        });

        // Candidate A: naive error-suppression masking (swallow exception and return default)
        const candidateA: SearchLoopCandidate = {
            candidateId: "cand-A",
            description: "Wrap in try-catch and return 0 (symptom masking)",
            changes: [{
                filePath: "src/tax/calculator.ts",
                currentCode: "return subtotal * config.taxRate;",
                proposedCode: "try { return subtotal * config.taxRate; } catch (e) { return 0; }",
                explanation: "Catch error",
            }],
            hypothesis: "Swallow error to prevent crash",
        };

        let feedbackTriggered = false;
        let generatedCandidateB: SearchLoopCandidate | null = null;

        const result = executeRepairSearchLoop({
            snapshot,
            candidatePool: [candidateA],
            onCandidateFailureFeedback: (failureEvidence, priorCandidate) => {
                if (priorCandidate.candidateId === "cand-A") {
                    feedbackTriggered = true;
                    expect(failureEvidence).toBeDefined();

                    // Candidate B is informed by Candidate A's failure reason
                    generatedCandidateB = {
                        candidateId: "cand-B",
                        description: "Proper null guard on config before tax calculation",
                        changes: [{
                            filePath: "src/tax/calculator.ts",
                            currentCode: "return subtotal * config.taxRate;",
                            proposedCode: "const rate = config?.taxRate ?? defaultTaxRate; return subtotal * rate;",
                            explanation: "Restore invariant by providing verified tax rate",
                        }],
                        hypothesis: `Addressed failure from ${priorCandidate.candidateId}: ${failureEvidence?.reason}`,
                    };
                    return generatedCandidateB;
                }
                return null;
            },
        });

        expect(feedbackTriggered).toBe(true);
        expect(generatedCandidateB).not.toBeNull();
        expect(result.iterations.length).toBeGreaterThanOrEqual(2);
        expect(result.iterations[0].candidate.candidateId).toBe("cand-A");
        expect(result.iterations[0].status).toBe("REJECTED_PROCEEDING");
        expect(result.iterations[1].candidate.candidateId).toBe("cand-B");
        expect(result.rejectedCandidateCount).toBeGreaterThanOrEqual(1);
    });

    it("terminates with EVIDENCE_EXHAUSTED when no candidate survives validation", () => {
        const snapshot = buildInvestigationSnapshot({
            incident: {
                issueId: "search-loop-02",
                title: "Error: DB connection lost",
                firstSeen: new Date(),
                lastSeen: new Date(),
            },
            rawEvidence: [],
            stackFrames: [{ filePath: "src/db/pool.ts", lineNumber: 10, functionName: "connect" }],
        });

        // 2 candidates that both fail
        const candidate1: SearchLoopCandidate = {
            candidateId: "cand-1",
            description: "Comment only",
            changes: [{
                filePath: "src/db/pool.ts",
                proposedCode: "// Comment change only",
                explanation: "Does not change AST",
            }],
            hypothesis: "Comment hypothesis",
        };

        const result = executeRepairSearchLoop({
            snapshot,
            candidatePool: [candidate1],
        });

        expect(result.terminalOutcome).toBe("EVIDENCE_EXHAUSTED");
        expect(result.verifiedCandidate).toBeUndefined();
    });
});
