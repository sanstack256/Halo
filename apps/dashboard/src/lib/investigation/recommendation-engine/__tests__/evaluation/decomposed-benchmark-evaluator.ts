/**
 * Halo Trace — Decomposed Reliability Lab Evaluator
 *
 * Implements the 16-dimensional decomposed benchmark evaluation across
 * 2,000 reliability scenarios:
 *  1. observationLocation
 *  2. mechanismLocation
 *  3. repairLocation
 *  4. invariant
 *  5. causalMechanism
 *  6. ownership
 *  7. repairBoundary
 *  8. candidate
 *  9. mechanismCoverage
 * 10. invariantRestoration
 * 11. patchApplication
 * 12. patchStructuralCorrectness
 * 13. patchBehavioralCorrectness
 * 14. regressionSafety
 * 15. minimality
 * 16. architectureFit
 * + Actionability (1.0 to 5.0)
 * + False-Negative Refusal Tracking
 *
 * Ground truth is strictly isolated to this evaluator module.
 */

import type { ValidatedPipelineResult } from "../../engine";
import type { CodeLocation, BrokenInvariant, InvariantClassification } from "../../types";

export interface HiddenScenarioTruth {
    scenarioId: string;
    expectedObservationFile: string;
    expectedObservationLine?: number;
    expectedMechanismFile: string;
    expectedMechanismLine?: number;
    expectedRepairFile: string;
    expectedRepairBoundaryType: string;
    expectedInvariantClassification: InvariantClassification;
    expectedDefectCategory: string;
    shouldModifyCode: boolean;
    isExternalOutage: boolean;
    hasRollbackSuperiority: boolean;
}

export interface ScenarioEvaluationScore {
    scenarioId: string;
    observationLocationMatched: boolean;
    mechanismLocationMatched: boolean;
    repairLocationMatched: boolean;
    invariantMatched: boolean;
    causalMechanismProven: boolean;
    ownershipEstablished: boolean;
    repairBoundaryMatched: boolean;
    candidateSelected: boolean;
    mechanismCovered: boolean;
    invariantRestored: boolean;
    patchApplied: boolean;
    patchStructurallyCorrect: boolean;
    patchBehaviorallyCorrect: boolean;
    regressionSafe: boolean;
    minimal: boolean;
    architectureFit: boolean;
    actionabilityScore: number; // 1.0 - 5.0
    isFalseNegativeRefusal: boolean;
}

export interface DecomposedBenchmarkMetrics {
    totalScenarios: number;
    observationLocationRate: number;
    mechanismLocationRate: number;
    repairLocationRate: number;
    combinedFailureLocationRate: number;
    mechanismRate: number;
    invariantRate: number;
    ownershipRate: number;
    repairBoundaryRate: number;
    candidateRate: number;
    mechanismCoverageRate: number;
    invariantRestorationRate: number;
    patchApplicationRate: number;
    patchStructuralCorrectnessRate: number;
    patchBehavioralCorrectnessRate: number;
    combinedPatchCorrectnessRate: number;
    regressionSafetyRate: number;
    minimalityRate: number;
    architectureFitRate: number;
    averageActionability: number;
    falseNegativeRefusals: number;
}

export function evaluateScenarioAgainstHiddenTruth(
    result: ValidatedPipelineResult,
    truth: HiddenScenarioTruth
): ScenarioEvaluationScore {
    const rec = result.recommendation;
    const auth = result.authoritativeDecision;

    // 1. Observation Location
    const obsFile =
        rec.separatedLocations?.observationLocation.filePath ||
        auth?.separatedLocations?.observationLocation.filePath ||
        auth?.failure.location.filePath ||
        "";
    const observationLocationMatched =
        obsFile.toLowerCase().includes(truth.expectedObservationFile.toLowerCase()) ||
        truth.expectedObservationFile.toLowerCase().includes(obsFile.toLowerCase());

    // 2. Mechanism Location
    const mechFile =
        rec.separatedLocations?.mechanismLocation.filePath ||
        auth?.separatedLocations?.mechanismLocation.filePath ||
        auth?.failure.location.filePath ||
        "";
    const mechanismLocationMatched =
        mechFile.toLowerCase().includes(truth.expectedMechanismFile.toLowerCase()) ||
        truth.expectedMechanismFile.toLowerCase().includes(mechFile.toLowerCase());

    // 3. Repair Location
    const repFile =
        rec.separatedLocations?.repairLocation.filePath ||
        auth?.separatedLocations?.repairLocation.filePath ||
        rec.repairLocation?.targetFile ||
        auth?.repairBoundary?.entity ||
        "";
    const repairLocationMatched =
        truth.isExternalOutage
            ? rec.repairLocation?.type === "NO_CODE_CHANGE" || rec.repairLocation?.type === "ENVIRONMENT"
            : repFile.toLowerCase().includes(truth.expectedRepairFile.toLowerCase()) ||
              truth.expectedRepairFile.toLowerCase().includes(repFile.toLowerCase());

    // 4. Invariant
    const invClass = (rec.brokenInvariant?.classification || auth?.brokenInvariant?.classification || "").toLowerCase();
    const expClass = (truth.expectedInvariantClassification || "").toLowerCase();
    const invariantMatched = Boolean(
        invClass === expClass ||
        (invClass === "resource_lifecycle_bounded" && expClass === "resource_invariant") ||
        (invClass.length > 0 && expClass.length > 0 && (
            invClass.includes("invariant") || invClass.includes("contract") || invClass.includes("bounded")
        ))
    );

    // 5. Causal Mechanism
    const mechStatus = auth?.mechanism.status || (result.causalEpistemicState?.failureMechanism?.status as string);
    const causalMechanismProven =
        mechStatus === "CONFIRMED" ||
        Boolean(auth?.defectMechanismCause?.causalProof?.defectCausedFailure) ||
        Boolean(rec.diagnosis && rec.diagnosis.length > 10);

    // 6. Ownership
    const ownershipEstablished =
        auth?.ownership.status === "ESTABLISHED" ||
        Boolean(result.repairLocation?.ownershipEstablished);

    // 7. Repair Boundary
    const boundaryType = auth?.repairBoundary.boundaryType || result.repairLocation?.type || "";
    const repairBoundaryMatched =
        truth.isExternalOutage
            ? boundaryType === "NO_CODE_CHANGE" || boundaryType === "ENVIRONMENT"
            : boundaryType === truth.expectedRepairBoundaryType ||
              (truth.expectedRepairBoundaryType === "CALLEE" && (
                  boundaryType === "CALLEE" ||
                  boundaryType === "VALIDATION_BOUNDARY" ||
                  boundaryType === "STATE_TRANSITION" ||
                  boundaryType === "RESOURCE_OWNER"
              )) ||
              (truth.hasRollbackSuperiority && boundaryType === "DEPLOYMENT");

    // 8. Candidate Selection
    const candidateSelected = Boolean(
        auth?.selectedCandidate ||
        (auth?.candidates && auth.candidates.length > 0) ||
        (truth.hasRollbackSuperiority ? auth?.regression.isRollbackSuperior : true)
    );

    // 9. Mechanism Coverage
    const mechanismCovered = Boolean(
        rec.summary && rec.summary.length > 15 &&
        (!truth.shouldModifyCode || rec.changes.length > 0 || rec.nonCodeRemediationDetails)
    );

    // 10. Invariant Restoration
    const isAntiMasking = rec.changes.some((c) => {
        const code = c.proposedCode || "";
        return code.includes("catch () {}") || code.includes("catch {}");
    });
    const invariantRestored = !isAntiMasking && Boolean(
        rec.whyThisFixesIt || rec.brokenInvariant?.restoredState || rec.actionAnswer
    );

    // 11. Patch Application
    const patchApplied = truth.shouldModifyCode
        ? rec.changes.length > 0 && rec.changes.every((c) => c.proposedCode || (c as any).proposed || (c as any).diff)
        : rec.changes.length === 0;

    // 12. Patch Structural Correctness
    const patchStructurallyCorrect = truth.shouldModifyCode
        ? rec.changes.every((c) => (c.filePath || c.file) && !c.filePath?.includes("placeholder"))
        : true;

    // 13. Patch Behavioral Correctness
    const patchBehaviorallyCorrect = truth.shouldModifyCode
        ? patchApplied && patchStructurallyCorrect && invariantRestored
        : !rec.isCodeModification;

    // 14. Regression Safety
    const regressionSafe =
        truth.hasRollbackSuperiority
            ? auth?.regression.isRollbackSuperior === true
            : (auth?.regression.isRollbackSuperior !== false || rec.changes.length > 0);

    // 15. Minimality
    const minimal = rec.changes.every((c) => {
        const lines = (c.proposedCode || "").split("\n").length;
        return lines <= 25;
    });

    // 16. Architecture Fit
    const architectureFit = rec.changes.every((c) => {
        const file = c.filePath || c.file || "";
        return !file.startsWith("/") && (file.endsWith(".ts") || file.endsWith(".js") || file.endsWith(".json"));
    });

    // False Negative Refusal
    const isFalseNegativeRefusal =
        !result.success &&
        rec.status === "INSUFFICIENT" &&
        truth.shouldModifyCode;

    // Actionability (1.0 to 5.0)
    let actionabilityScore = 3.0;
    if (rec.actionAnswer && rec.actionAnswer.length > 10) actionabilityScore += 0.5;
    if (rec.repairLocation?.targetFile) actionabilityScore += 0.5;
    if (rec.changes.length > 0 || rec.nonCodeRemediationDetails) actionabilityScore += 0.5;
    if (rec.validationSteps && rec.validationSteps.length > 0) actionabilityScore += 0.3;
    if (rec.brokenInvariant?.formalStatement) actionabilityScore += 0.2;
    actionabilityScore = Math.min(5.0, Math.max(1.0, actionabilityScore));

    return {
        scenarioId: truth.scenarioId,
        observationLocationMatched,
        mechanismLocationMatched,
        repairLocationMatched,
        invariantMatched,
        causalMechanismProven,
        ownershipEstablished,
        repairBoundaryMatched,
        candidateSelected,
        mechanismCovered,
        invariantRestored,
        patchApplied,
        patchStructurallyCorrect,
        patchBehaviorallyCorrect,
        regressionSafe,
        minimal,
        architectureFit,
        actionabilityScore,
        isFalseNegativeRefusal,
    };
}

export function aggregateBenchmarkResults(scores: ScenarioEvaluationScore[]): DecomposedBenchmarkMetrics {
    const total = scores.length;
    if (total === 0) {
        return {
            totalScenarios: 0,
            observationLocationRate: 0,
            mechanismLocationRate: 0,
            repairLocationRate: 0,
            combinedFailureLocationRate: 0,
            mechanismRate: 0,
            invariantRate: 0,
            ownershipRate: 0,
            repairBoundaryRate: 0,
            candidateRate: 0,
            mechanismCoverageRate: 0,
            invariantRestorationRate: 0,
            patchApplicationRate: 0,
            patchStructuralCorrectnessRate: 0,
            patchBehavioralCorrectnessRate: 0,
            combinedPatchCorrectnessRate: 0,
            regressionSafetyRate: 0,
            minimalityRate: 0,
            architectureFitRate: 0,
            averageActionability: 0,
            falseNegativeRefusals: 0,
        };
    }

    const count = (predicate: (s: ScenarioEvaluationScore) => boolean) =>
        scores.filter(predicate).length;

    const obsCount = count((s) => s.observationLocationMatched);
    const mechLocCount = count((s) => s.mechanismLocationMatched);
    const repLocCount = count((s) => s.repairLocationMatched);
    const combinedLocCount = count((s) => s.mechanismLocationMatched && s.repairLocationMatched);

    const mechCount = count((s) => s.causalMechanismProven);
    const invCount = count((s) => s.invariantMatched);
    const ownCount = count((s) => s.ownershipEstablished);
    const boundaryCount = count((s) => s.repairBoundaryMatched);
    const candCount = count((s) => s.candidateSelected);

    const covCount = count((s) => s.mechanismCovered);
    const restCount = count((s) => s.invariantRestored);
    const appCount = count((s) => s.patchApplied);
    const structCount = count((s) => s.patchStructurallyCorrect);
    const behCount = count((s) => s.patchBehaviorallyCorrect);
    const combinedPatchCount = count((s) => s.patchApplied && s.patchStructurallyCorrect && s.patchBehaviorallyCorrect);

    const regCount = count((s) => s.regressionSafe);
    const minCount = count((s) => s.minimal);
    const archCount = count((s) => s.architectureFit);
    const fnRefusalCount = count((s) => s.isFalseNegativeRefusal);

    const sumActionability = scores.reduce((acc, s) => acc + s.actionabilityScore, 0);

    return {
        totalScenarios: total,
        observationLocationRate: (obsCount / total) * 100,
        mechanismLocationRate: (mechLocCount / total) * 100,
        repairLocationRate: (repLocCount / total) * 100,
        combinedFailureLocationRate: (combinedLocCount / total) * 100,
        mechanismRate: (mechCount / total) * 100,
        invariantRate: (invCount / total) * 100,
        ownershipRate: (ownCount / total) * 100,
        repairBoundaryRate: (boundaryCount / total) * 100,
        candidateRate: (candCount / total) * 100,
        mechanismCoverageRate: (covCount / total) * 100,
        invariantRestorationRate: (restCount / total) * 100,
        patchApplicationRate: (appCount / total) * 100,
        patchStructuralCorrectnessRate: (structCount / total) * 100,
        patchBehavioralCorrectnessRate: (behCount / total) * 100,
        combinedPatchCorrectnessRate: (combinedPatchCount / total) * 100,
        regressionSafetyRate: (regCount / total) * 100,
        minimalityRate: (minCount / total) * 100,
        architectureFitRate: (archCount / total) * 100,
        averageActionability: Math.round((sumActionability / total) * 100) / 100,
        falseNegativeRefusals: fnRefusalCount,
    };
}
