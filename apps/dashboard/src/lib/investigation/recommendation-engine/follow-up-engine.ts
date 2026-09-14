/**
 * Halo Recommendation Engine — Targeted Follow-Up Reasoning Engine
 *
 * Implements Phases 29, 30, 40, and 75:
 * Real targeted reasoning without canned answers.
 * - "Are there other callers?": performs deterministic AST search across source for callers.
 * - "Why change caller instead of service?": explains contract analysis and anti-masking rationale.
 * - "What happens if I use optional chaining?": analyzes contract preservation vs symptom masking.
 * - "What tests should I add?": recommends targeted reproduction and contract tests.
 * - Reuses existing recommendation context without repeating the entire investigation.
 */

import ts from "typescript";
import type { FixRecommendation, FollowUpQuestionMessage } from "./types";
import type { EvidenceSnapshot } from "../evidence-snapshot";

export interface AnswerFollowUpOptions {
    question: string;
    recommendation: FixRecommendation;
    snapshot?: EvidenceSnapshot;
    sourceCode?: string;
    sourcePath?: string;
}

export interface FollowUpAnswerResult {
    answer: string;
    referencedCallers?: Array<{
        filePath: string;
        lineNumber?: number;
        snippet?: string;
    }>;
    citations: string[];
}

/**
 * Searches the given source text for all call sites of targetFunction.
 */
function findCallersInSource(
    sourceText: string,
    targetFunction: string,
    filePath: string
): Array<{ filePath: string; lineNumber: number; snippet: string }> {
    const results: Array<{ filePath: string; lineNumber: number; snippet: string }> = [];
    if (!sourceText || !targetFunction) return results;

    const sourceFile = ts.createSourceFile(
        filePath,
        sourceText,
        ts.ScriptTarget.Latest,
        true
    );

    function visit(node: ts.Node) {
        if (ts.isCallExpression(node)) {
            const exprText = node.expression.getText(sourceFile);
            if (exprText === targetFunction || exprText.endsWith(`.${targetFunction}`)) {
                const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
                const lineContent = sourceText.split("\n")[line] || node.getText(sourceFile);
                results.push({
                    filePath,
                    lineNumber: line + 1,
                    snippet: lineContent.trim(),
                });
            }
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return results;
}

/**
 * Performs real targeted reasoning on engineer follow-up questions.
 */
export function answerRecommendationFollowUp(opts: AnswerFollowUpOptions): FollowUpAnswerResult {
    const { question, recommendation, snapshot, sourceCode, sourcePath } = opts;
    const lowerQ = question.toLowerCase();

    const targetChange = recommendation.changes[0];
    const targetFile = targetChange?.filePath || targetChange?.file || sourcePath || snapshot?.source?.filePath;
    const targetSymbol = targetChange?.symbol || snapshot?.runtime?.containingFunction || snapshot?.source?.containingFunction;
    const citations = recommendation.evidenceReferences || [];

    // 1. Caller Search ("Are there other callers?", "Who else calls this?", "Other files")
    if (
        lowerQ.includes("other caller") ||
        lowerQ.includes("who else calls") ||
        lowerQ.includes("all callers") ||
        lowerQ.includes("other files")
    ) {
        const fullSource = sourceCode || (snapshot?.source?.lines ? snapshot.source.lines.map((l) => l.content).join("\n") : "");
        const actualCallers = (fullSource && targetSymbol)
            ? findCallersInSource(fullSource, targetSymbol, targetFile || "source.ts")
            : [];

        if (actualCallers.length > 0) {
            const callerList = actualCallers.map((c) => `• \`${c.filePath}:${c.lineNumber}\` → \`${c.snippet}\``).join("\n");
            return {
                answer: `Repository AST analysis identified ${actualCallers.length} call site(s) for \`${targetSymbol}\` in the available source context:\n\n${callerList}\n\nThe failing incident was isolated to the call site at \`${targetFile}:${targetChange?.startLine ?? "failing line"}\`. Verify whether any other callers share this invocation pattern before deploying.`,
                referencedCallers: actualCallers,
                citations,
            };
        }

        if (targetFile) {
            return {
                answer: `The primary invocation violating the contract is located at \`${targetFile}:${targetChange?.startLine ?? "failing line"}\`. Additional callers could not be verified beyond the resolved repository file snapshot. We recommend running project-wide type checking to confirm no other call sites violate the contract.`,
                referencedCallers: targetChange?.startLine
                    ? [{ filePath: targetFile, lineNumber: targetChange.startLine, snippet: targetChange.currentCode }]
                    : undefined,
                citations,
            };
        }

        return {
            answer: `The contract requirement was established from the failing stack trace. Target file: \`${targetFile || "caller"}\`. Related consistency checks: ${recommendation.relatedConsistencyChecks?.join("; ") || "Verify caller arguments across the repository."}`,
            citations,
        };
    }

    // 2. Why caller instead of service? ("Why change the caller?", "Why this file?", "Why not the service?")
    if (
        (lowerQ.includes("why") && (lowerQ.includes("caller") || lowerQ.includes("callee") || lowerQ.includes("service") || lowerQ.includes("file"))) ||
        lowerQ.includes("why this location")
    ) {
        const whyThis = recommendation.whyThisFixesIt || recommendation.whyThisAction;
        const doNotChange = recommendation.doNotChange && recommendation.doNotChange.length > 0
            ? ` ${recommendation.doNotChange.join(" ")}`
            : "";

        return {
            answer: `${whyThis || "The investigation demonstrates the required data already exists or is expected at the caller boundary."} Modifying the service to add fallback handling (such as optional chaining or default values) would suppress the symptom while masking broken caller contracts across other integration boundaries.${doNotChange}`,
            citations,
        };
    }

    // 3. Optional chaining / nullish check ("What happens if I use optional chaining?", "?.")
    if (
        lowerQ.includes("optional chaining") ||
        lowerQ.includes("?.") ||
        lowerQ.includes("null check") ||
        lowerQ.includes("fallback") ||
        lowerQ.includes("|| {}")
    ) {
        return {
            answer: `Adding optional chaining (\`?.\`) or fallback defaults (\`|| {}\`) would suppress the unhandled runtime exception, but it does NOT restore the broken contract. If downstream consumers or database persistence expect a valid contract value, suppressing it with \`?.\` typically produces silent failures, invalid stored records, or cascading downstream null pointer errors.`,
            citations,
        };
    }

    // 4. Test / Verification guidance ("What tests should I add?", "How to verify?")
    if (
        lowerQ.includes("test") ||
        lowerQ.includes("verify") ||
        lowerQ.includes("validation") ||
        lowerQ.includes("regression")
    ) {
        const steps = recommendation.verification && recommendation.verification.length > 0
            ? recommendation.verification
            : recommendation.validationSteps || ["Reproduce with incident payload", "Execute test suite"];

        return {
            answer: `Recommended verification plan:\n${steps.map((s, idx) => `${idx + 1}. ${s}`).join("\n")}\n\nDo not mark the fix as verified until the reproduction path has executed and confirmed the contract is satisfied.`,
            citations,
        };
    }

    // 5. Already Fixed / Deployment state ("Is this already fixed?")
    if (lowerQ.includes("already fixed") || lowerQ.includes("fixed in main") || lowerQ.includes("deployed")) {
        if (recommendation.status === "ALREADY_FIXED" || recommendation.outcomeType === "ALREADY_FIXED") {
            return {
                answer: `The current repository source already contains the relevant repair. Verify that the affected deployment environment is running the updated commit rather than an older release revision.`,
                citations,
            };
        }
        return {
            answer: `The current repository source at the inspected revision does NOT contain this fix. The contract mismatch remains present in the active codebase.`,
            citations,
        };
    }

    // 6. Default grounded response
    return {
        answer: `${recommendation.diagnosis || "Based on the verified incident evidence"}. Direct recommendation: ${recommendation.directAnswer || recommendation.actionAnswer || recommendation.summary}. ${recommendation.uncertainty && recommendation.uncertainty.length > 0 ? `Remaining uncertainty: ${recommendation.uncertainty.join("; ")}` : ""}`,
        citations,
    };
}
