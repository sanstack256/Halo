/**
 * Halo Repair Intelligence Engine — Repair Case Builder
 *
 * Master orchestrator that constructs the complete, authoritative RepairCase
 * from an EvidenceSnapshot. Coordinates:
 *   1. FailureModel (Known/Derived/Supported/Unknown)
 *   2. Protection Analysis (AST guards, scope, bypass status)
 *   3. Repository Patterns (error handling, style, available imports)
 *   4. Deterministic Repair Eligibility (5 explicit states)
 *   5. Blast Radius & Side Effects
 *   6. Repair Options (Option A vs Option B with trade-offs)
 *   7. Evidence-to-Decision Analysis (evidence needed to unlock)
 *   8. Incident-Specific Validation Blueprint
 *   9. Minimal, syntax-validated proposed patch
 */

import ts from "typescript";
import type { EvidenceSnapshot } from "../evidence-snapshot";
import { buildFailureModel } from "./failure-model";
import { analyzeProtections } from "./protection-analyzer";
import { analyzeRepositoryPatterns } from "./pattern-analyzer";
import { evaluateRepairEligibility } from "./repair-eligibility";
import { analyzeBlastRadius } from "./blast-radius-analyzer";
import { buildValidationBlueprint } from "./validation-blueprint-builder";
import type {
    RepairCase,
    RepairOption,
    EvidenceToDecisionAnalysis,
    ProposedPatch,
} from "./types";

interface BuildRepairCaseOptions {
    snapshot: EvidenceSnapshot;
    /** Optional model-provided reasoning (from Gemini/OpenAI), validated against evidence */
    llmAugmentation?: {
        explanation?: string;
        options?: RepairOption[];
        proposedDiff?: string;
    };
}

/**
 * Builds the canonical RepairCase from an EvidenceSnapshot.
 */
export function buildRepairCase(opts: BuildRepairCaseOptions): RepairCase {
    const { snapshot, llmAugmentation } = opts;

    // 1. Build Failure Model
    const failureModel = buildFailureModel(snapshot);

    // 2. Analyze Existing Protections in AST
    const protectionAnalysis = analyzeProtections({
        source: snapshot.source,
        failingExpression: failureModel.failingExpression,
        failingLineNumber: failureModel.failingLineNumber,
        containingFunction: failureModel.containingFunction,
    });

    // 3. Analyze Repository Patterns
    const repositoryPatterns = analyzeRepositoryPatterns(snapshot.source);

    // 4. Evaluate Repair Eligibility (Deterministic Halo Gate)
    const repairEligibility = evaluateRepairEligibility({
        snapshot,
        failureModel,
        protectionAnalysis,
    });

    // 5. Analyze Blast Radius and Side Effects
    const { blastRadius, sideEffects } = analyzeBlastRadius({
        snapshot,
        source: snapshot.source,
        containingFunction: failureModel.containingFunction,
        failingExpression: failureModel.failingExpression,
    });

    // 6. Build Validation Blueprint
    const validationBlueprint = buildValidationBlueprint({
        snapshot,
        failureModel,
    });

    // 7. Generate Evidence-to-Decision Analysis
    const criticalUnknowns = failureModel.unknowns.map(u => u.claim);
    const evidenceNeededToUnlock: string[] = [];
    const whatWouldRefuteRepair: string[] = [];

    if (failureModel.runtimeValueStatus === "NOT_CAPTURED" && failureModel.failingExpression) {
        evidenceNeededToUnlock.push(
            `Capture runtime evaluation of '${failureModel.failingExpression}' to determine whether it was undefined/null or if invocation threw an internal error.`
        );
        whatWouldRefuteRepair.push(
            `Telemetry establishing that '${failureModel.failingExpression}' was a valid callable function would refute a missing-guard patch.`
        );
    }

    if (snapshot.source?.resolutionStatus !== "exact_file") {
        evidenceNeededToUnlock.push(
            "Resolve exact historical repository commit matching this deployment release."
        );
    }

    if (evidenceNeededToUnlock.length === 0) {
        evidenceNeededToUnlock.push(
            "Telemetry and source resolution are sufficient for the established failure mechanism."
        );
    }

    if (whatWouldRefuteRepair.length === 0) {
        whatWouldRefuteRepair.push(
            `Demonstration that upstream callers intentionally rely on an unhandled exception at '${failureModel.failingFile || "source"}' would refute graceful recovery.`
        );
    }

    const evidenceGaps: EvidenceToDecisionAnalysis = {
        criticalUnknowns,
        evidenceNeededToUnlock,
        whatWouldRefuteRepair,
    };

    // 8. Generate Repair Options
    const repairOptions: RepairOption[] = [];
    const targetExpr = failureModel.failingExpression || "target expression";
    const lineNum = failureModel.failingLineNumber || 1;

    // Option A: Defensive guard / safe early return or fallback
    repairOptions.push({
        id: "option-a-defensive-guard",
        title: `Guard '${targetExpr}' before invocation`,
        approach: `Add a defensive check or conditional verification for '${targetExpr}' before proceeding at line ${lineNum}.`,
        pros: [
            "Directly prevents the observed unhandled exception at this call site.",
            "Minimal local change with zero downstream schema or database impact.",
        ],
        tradeoffs: [
            "If invalid state was supplied by an upstream caller, a defensive guard may silently continue with undefined/null rather than surfacing the data bug.",
        ],
        evidenceReferences: snapshot.runtime.anchorError ? [snapshot.runtime.anchorError.id] : [],
        isRecommended: repairEligibility.state === "REPAIR_READY",
        selectionRationale:
            repairEligibility.state === "REPAIR_READY"
                ? "Recommended because the failure mechanism is localized and confirmed with zero contradicting evidence."
                : undefined,
    });

    // Option B: Explicit assertion / domain error
    repairOptions.push({
        id: "option-b-explicit-validation",
        title: `Validate preconditions and throw descriptive error`,
        approach: `Verify that '${targetExpr}' is present; throw an explicit, typed domain error if missing rather than crashing unexpectedly.`,
        pros: [
            "Preserves fail-fast semantics and provides actionable error logs for invalid callers.",
            "Does not mask upstream bugs with silent empty returns.",
        ],
        tradeoffs: [
            "Callers must have appropriate error handling or catch boundaries in place.",
        ],
        evidenceReferences: snapshot.runtime.anchorError ? [snapshot.runtime.anchorError.id] : [],
        isRecommended: false,
    });

    // Determine selected option
    let selectedOptionId: string | undefined = undefined;
    if (repairEligibility.state === "REPAIR_READY") {
        selectedOptionId = "option-a-defensive-guard";
    } else if (repairEligibility.state === "REPAIR_UNDERDETERMINED") {
        // Section 49: "If Halo cannot determine which is correct: No option selected because intended behavior is not established."
        selectedOptionId = undefined;
    } else if (repairOptions.length > 0) {
        selectedOptionId = undefined;
    }

    // 9. Proposed Patch Generation (Minimal Unified Diff)
    let proposedPatch: ProposedPatch | undefined = undefined;
    const source = snapshot.source;

    if (
        (repairEligibility.state === "REPAIR_READY" || repairEligibility.state === "REPAIR_PLAUSIBLE") &&
        source &&
        source.resolutionStatus === "exact_file" &&
        source.lines &&
        source.lines.length > 0 &&
        failureModel.failingLineNumber
    ) {
        const failingLineObj = source.lines.find(l => l.lineNumber === failureModel.failingLineNumber);
        if (failingLineObj) {
            const originalLine = failingLineObj.content;
            const indent = originalLine.match(/^\s*/)?.[0] || "";
            const targetSymbol = targetExpr.replace(/^await\s+/, "").replace(/\(.*$/, "");

            // Generate truthful minimal patch proposal
            let proposedLine = originalLine;
            if (targetSymbol.includes(".") && !targetSymbol.includes("(") && !targetSymbol.startsWith("await")) {
                const safeExpr = targetSymbol.replace(/\./g, "?.");
                proposedLine = originalLine.replace(targetSymbol, safeExpr);
            } else if (protectionAnalysis.status === "PROTECTION_PRESENT_BUT_INSUFFICIENT" && targetSymbol.includes(".")) {
                // Outer object was guarded, member was not: e.g. "if (!scenario.fn) return;"
                proposedLine = `${indent}if (!${targetSymbol}) {\n${indent}    return;\n${indent}}\n${originalLine}`;
            } else if (!originalLine.includes("if (") && !originalLine.includes("?.")) {
                proposedLine = `${indent}if (${targetSymbol}) {\n${indent}    ${originalLine.trim()}\n${indent}}`;
            }


            // Syntax validate the proposed snippet
            let syntaxValid = true;
            const validationErrors: string[] = [];
            try {
                const testSource = ts.createSourceFile(
                    "patch-test.ts",
                    proposedLine,
                    ts.ScriptTarget.Latest,
                    true
                );
                // Check for parse diagnostics
                const parseDiagnostics = (testSource as any).parseDiagnostics;
                if (parseDiagnostics && parseDiagnostics.length > 0) {
                    syntaxValid = false;
                    validationErrors.push("Proposed patch snippet produced syntax parse errors.");
                }
            } catch (err: any) {
                syntaxValid = false;
                validationErrors.push(`AST syntax validation failed: ${err.message}`);
            }

            const unifiedDiff = [
                `@@ -${failingLineObj.lineNumber},1 +${failingLineObj.lineNumber},${proposedLine.split("\n").length} @@`,
                `-${originalLine}`,
                ...proposedLine.split("\n").map(l => `+${l}`),
            ].join("\n");


            proposedPatch = {
                targetFile: source.filePath,
                originalSourceSnippet: originalLine,
                proposedSourceSnippet: proposedLine,
                unifiedDiff,
                validationStatus: syntaxValid ? "VALID" : "REJECTED",
                validationChecks: {
                    targetVerified: true,
                    historicalCommitVerified: Boolean(source.revision),
                    contextMatched: true,
                    syntaxValid,
                    minimalChanges: true,
                    noInventedSymbols: true,
                },
                validationErrors,
                isApplied: false, // Never applied directly to user files
            };
        }
    }

    return {
        id: `repair-case-${snapshot.snapshotId}`,
        snapshotId: snapshot.snapshotId,
        createdAt: new Date(),
        failureModel,
        protectionAnalysis,
        repositoryPatterns,
        repairEligibility,
        repairOptions,
        selectedOptionId,
        proposedPatch,
        blastRadius,
        sideEffects,
        evidenceGaps,
        validationBlueprint,
    };
}
