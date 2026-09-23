/**
 * Halo Recommendation Engine — Intent Model & Contradiction Engine
 *
 * Implements Sections 9 & 10:
 * - Intent reconstruction from types, schemas, docstrings, tests, and runtime behavior
 * - Intent contradiction detection (IntentConflict)
 * - Authoritativeness resolution: Executable constraints & tests > Static types > Documentation
 */

import type {
    InvestigationSnapshot,
    IntentConflict,
} from "./types";

export interface IntentHypothesis {
    id: string;
    statement: string;
    targetSymbol: string;
    sourceType: "TYPES" | "SCHEMA" | "TESTS" | "DOCS" | "RUNTIME";
    expectedBehavior: string;
    evidenceId?: string;
}

export class IntentEngine {
    private hypotheses: IntentHypothesis[] = [];
    private conflicts: IntentConflict[] = [];

    public registerIntent(intent: IntentHypothesis): this {
        this.hypotheses.push(intent);
        return this;
    }

    /**
     * Reconstructs initial intent hypotheses from snapshot evidence:
     * - Stacks & error messages
     * - AST signatures and return types
     * - Test assertions
     */
    public analyzeSnapshot(snapshot: InvestigationSnapshot): this {
        const errorMsg = snapshot.failure?.exceptionMessage || (snapshot as any).error?.message || "";
        const rawFrames =
            snapshot.failure?.frames && snapshot.failure.frames.length > 0
                ? snapshot.failure.frames
                : (snapshot as any).stackTrace?.frames || [];
        const frames = rawFrames.map((f: any) => ({
            file: f.filePath || f.file || "unknown",
            line: f.lineNumber || f.line || 0,
            method: f.functionName || f.method || "anonymous",
        }));

        // 1. Reconstruct baseline intent from error semantics
        if (errorMsg) {
            const msg = errorMsg.toLowerCase();
            if (msg.includes("cannot read property") || msg.includes("undefined") || msg.includes("null")) {
                const targetMethod = frames[0]?.method || "callee";
                this.registerIntent({
                    id: `intent:non-null:${targetMethod}`,
                    statement: `${targetMethod} expects required properties to be non-nullish on entry`,
                    targetSymbol: targetMethod,
                    sourceType: "TYPES",
                    expectedBehavior: "Caller passes populated object satisfying contract interface",
                });
            }
        }

        // 2. Detect contradictions between sources
        this.detectConflicts();

        return this;
    }

    /**
     * Cross-checks intent hypotheses from differing sources to identify conflicts.
     * E.g., Type says field is optional, but Runtime callee throws if undefined.
     * Or Schema says field is required, but caller drops it.
     */
    public detectConflicts(): IntentConflict[] {
        this.conflicts = [];

        // Check pairs of hypotheses on the same target symbol
        for (let i = 0; i < this.hypotheses.length; i++) {
            for (let j = i + 1; j < this.hypotheses.length; j++) {
                const h1 = this.hypotheses[i];
                const h2 = this.hypotheses[j];

                if (h1.targetSymbol === h2.targetSymbol && h1.sourceType !== h2.sourceType) {
                    if (this.isContradiction(h1, h2)) {
                        const conflict = this.resolveConflict(h1, h2);
                        this.conflicts.push(conflict);
                    }
                }
            }
        }

        return this.conflicts;
    }

    private isContradiction(h1: IntentHypothesis, h2: IntentHypothesis): boolean {
        const text1 = `${h1.statement} ${h1.expectedBehavior}`.toLowerCase();
        const text2 = `${h2.statement} ${h2.expectedBehavior}`.toLowerCase();

        const hasRequirement1 = text1.includes("require") || text1.includes("non-null") || text1.includes("must exist") || text1.includes("must be");
        const hasOptionality1 = text1.includes("optional") || text1.includes("nullable") || text1.includes("may be omitted") || text1.includes("omitted");

        const hasRequirement2 = text2.includes("require") || text2.includes("non-null") || text2.includes("must exist") || text2.includes("must be");
        const hasOptionality2 = text2.includes("optional") || text2.includes("nullable") || text2.includes("may be omitted") || text2.includes("omitted");

        return (hasRequirement1 && hasOptionality2) || (hasOptionality1 && hasRequirement2);
    }

    /**
     * Resolves authoritativeness according to Section 10:
     * Hierarchy: TESTS / SCHEMA > TYPES > DOCS / COMMENTS
     */
    private resolveConflict(h1: IntentHypothesis, h2: IntentHypothesis): IntentConflict {
        const priority: Record<IntentHypothesis["sourceType"], number> = {
            SCHEMA: 5,
            TESTS: 4,
            RUNTIME: 3,
            TYPES: 2,
            DOCS: 1,
        };

        const authoritative = priority[h1.sourceType] >= priority[h2.sourceType] ? h1 : h2;
        const secondary = authoritative === h1 ? h2 : h1;

        return {
            conflictId: `conflict:${h1.targetSymbol}:${h1.sourceType}_vs_${h2.sourceType}`,
            statement: `Contradiction detected for ${h1.targetSymbol}: ${h1.sourceType} claims '${h1.expectedBehavior}', but ${h2.sourceType} claims '${h2.expectedBehavior}'`,
            sourceA: { source: h1.sourceType, assertion: h1.statement },
            sourceB: { source: h2.sourceType, assertion: h2.statement },
            authoritativeSource: authoritative.sourceType,
            resolutionJustification: `${authoritative.sourceType} is structurally more authoritative than ${secondary.sourceType} in enforcing runtime system invariants.`,
        };
    }

    public getConflicts(): IntentConflict[] {
        return this.conflicts;
    }

    public getHypotheses(): IntentHypothesis[] {
        return this.hypotheses;
    }
}
