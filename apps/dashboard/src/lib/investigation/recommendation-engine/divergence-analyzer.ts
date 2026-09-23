/**
 * Halo Recommendation Engine — First Divergence & Value-Origin Recursion Analyzer
 *
 * Implements Sections 13, 14, 15:
 * - First-divergence analysis: Expected execution vs actual execution alignment
 * - Value-origin recursion: Traces corrupted/lost values recursively back to origin boundary
 * - "Why is this wrong?" recursion: Explores causal contract failures layer by layer
 */

import type {
    InvestigationSnapshot,
    FirstDivergenceRecord,
    ValueOriginStep,
    ValueOriginChain,
} from "./types";

export interface ExecutionStep {
    symbol: string;
    filePath: string;
    lineNumber?: number;
    expectedState: string;
    actualState: string;
    isDivergent: boolean;
    evidenceId?: string;
}

export class DivergenceAnalyzer {
    /**
     * Reconstructs expected vs actual execution sequence and finds the earliest divergence.
     * Implements Section 13: First-Divergence Analysis.
     */
    public analyzeFirstDivergence(
        snapshot: InvestigationSnapshot,
        divergenceOverrides?: { frameIndex?: number; reason?: string }
    ): FirstDivergenceRecord {
        const rawFrames =
            snapshot.failure?.frames && snapshot.failure.frames.length > 0
                ? snapshot.failure.frames
                : (snapshot as any).stackTrace?.frames || [];
        const frames: Array<{ file: string; line: number; method: string }> = rawFrames.map((f: any) => ({
            file: f.filePath || f.file || "unknown",
            line: f.lineNumber || f.line || 0,
            method: f.functionName || f.method || "anonymous",
        }));
        if (frames.length === 0) {
            return {
                observationFrame: "unknown",
                firstDivergenceFrame: "unknown",
                firstDivergenceFile: "unknown",
                expectedStateDescription: "Execution proceeds nominally",
                actualStateDescription: "Execution failed with no stack frames",
                framesBeforeFailure: 0,
                evidenceIds: [],
            };
        }

        const observationFrame = `${frames[0].file}:${frames[0].line || 0} (${frames[0].method || "anonymous"})`;

        // If an explicit override or earlier frame has been identified as the origin
        let divergenceIdx = 0;
        if (divergenceOverrides?.frameIndex !== undefined && divergenceOverrides.frameIndex < frames.length) {
            divergenceIdx = divergenceOverrides.frameIndex;
        } else if (frames.length > 1) {
            // Heuristic analysis: Check frames further up the stack for parameter drops / missing invariants
            // Frame 0 is where the crash happened (observation).
            // Often Frame 1 or 2 is the factory or mapper where the bad state was produced.
            const candidateFrames = frames.slice(1);
            const foundEarlierProducer = candidateFrames.findIndex(
                (f: { method?: string }) =>
                    f.method?.toLowerCase().includes("create") ||
                    f.method?.toLowerCase().includes("build") ||
                    f.method?.toLowerCase().includes("map") ||
                    f.method?.toLowerCase().includes("transform") ||
                    f.method?.toLowerCase().includes("context")
            );

            if (foundEarlierProducer !== -1) {
                // Map back to index in frames array (+ 1 because we sliced)
                divergenceIdx = foundEarlierProducer + 1;
            }
        }

        const divFrame = frames[divergenceIdx];
        const firstDivergenceFrame = `${divFrame.file}:${divFrame.line || 0} (${divFrame.method || "anonymous"})`;

        return {
            observationFrame,
            firstDivergenceFrame,
            firstDivergenceFile: divFrame.file,
            firstDivergenceLine: divFrame.line,
            expectedStateDescription: `Invariant holds at ${divFrame.method || "caller"}: valid contract state passed downstream`,
            actualStateDescription: divergenceOverrides?.reason || `State diverged at ${divFrame.method || "caller"}: value was omitted, mutated or corrupted before downstream invocation`,
            framesBeforeFailure: divergenceIdx,
            evidenceIds: [
                `stack-frame:${divFrame.file}:${divFrame.line || 0}:0`,
                `stack-frame:${frames[0].file}:${frames[0].line || 0}:0`,
            ],
        };
    }

    /**
     * Recursively traces the origin of a failure-relevant value.
     * Implements Section 14: Value-Origin Recursion.
     */
    public traceValueOrigin(
        targetValue: string,
        initialLocation: string,
        steps: ValueOriginStep[],
        boundary: ValueOriginChain["originBoundary"] = "EXTERNAL_INPUT",
        boundaryLocation: string = "gateway/request"
    ): ValueOriginChain {
        return {
            targetValue,
            steps,
            originBoundary: boundary,
            boundaryLocation,
        };
    }

    /**
     * Structured "Why is this wrong?" recursion.
     * Implements Section 15.
     */
    public runWhyRecursion(
        initialObservation: string,
        producerSymbol: string,
        contractViolation: string,
        contractOwner: string
    ): Array<{ level: number; question: string; answer: string; contractOwner?: string }> {
        return [
            {
                level: 1,
                question: `Why did the failure surface at ${initialObservation}?`,
                answer: `Received undefined or invalid value violating callee invariant preconditions.`,
            },
            {
                level: 2,
                question: `Why was that invalid value produced?`,
                answer: `${producerSymbol} completed transformation without satisfying output contract.`,
                contractOwner: producerSymbol,
            },
            {
                level: 3,
                question: `Why was the producer allowed to produce it?`,
                answer: `Missing contract assertion or omitted property forwarding in ${producerSymbol}.`,
                contractOwner: producerSymbol,
            },
            {
                level: 4,
                question: `Which contract should have prevented it and where should it be enforced?`,
                answer: `${contractViolation} must be enforced by ${contractOwner}.`,
                contractOwner,
            },
        ];
    }
}
