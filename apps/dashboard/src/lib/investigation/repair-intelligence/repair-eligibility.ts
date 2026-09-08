/**
 * Halo Repair Intelligence Engine — Deterministic Repair Eligibility Gate
 *
 * Implements Section 18, 19, and 22 of the specification:
 *   - 5 explicit repair states: REPAIR_READY, REPAIR_PLAUSIBLE, REPAIR_UNDERDETERMINED, REPAIR_BLOCKED, REPAIR_REFUTED
 *   - Separates evidence confidence from repair confidence
 *   - Model can NEVER override repair eligibility; Halo determines it deterministically
 *   - Explicitly handles the Section 74 bad example: If runtime value of `scenario.fn`
 *     is NOT_CAPTURED, it CANNOT be marked REPAIR_READY for an automatic optional chaining patch!
 */

import type { EvidenceSnapshot } from "../evidence-snapshot";
import type {
    FailureModel,
    ProtectionAnalysisResult,
    RepairEligibilityResult,
    RepairEligibilityState,
    RepairPrerequisites,
} from "./types";

interface EvaluateEligibilityOptions {
    snapshot: EvidenceSnapshot;
    failureModel: FailureModel;
    protectionAnalysis: ProtectionAnalysisResult;
}

/**
 * Deterministically evaluates the Repair Eligibility of an incident.
 */
export function evaluateRepairEligibility(opts: EvaluateEligibilityOptions): RepairEligibilityResult {
    const { snapshot, failureModel, protectionAnalysis } = opts;

    const blockers: string[] = [];

    // 1. Prerequisite: Verified Failure
    const failureVerified = Boolean(
        failureModel.errorTitle ||
        snapshot.runtime.anchorError ||
        snapshot.evidence.some(e => e.type === "ERROR")
    );

    if (!failureVerified) {
        blockers.push("No verified error event captured in telemetry.");
    }

    // 2. Prerequisite: Exact Source Resolved
    const exactSourceResolved = Boolean(
        snapshot.source &&
        snapshot.source.resolutionStatus === "exact_file" &&
        snapshot.source.lines &&
        snapshot.source.lines.length > 0 &&
        snapshot.source.failingLineNumber
    );
    if (!exactSourceResolved) {
        blockers.push(
            `Source resolution is ${snapshot.source?.resolutionStatus || "UNRESOLVED"}. Exact historical source matching this release commit is required.`
        );
    }

    // 3. Prerequisite: Validated Mechanism
    const mechanismValidated = Boolean(
        failureModel.failingExpression &&
        failureModel.failingStatement &&
        failureModel.failingLineNumber
    );
    if (!mechanismValidated) {
        blockers.push("Failing AST expression or statement could not be isolated from the stack trace.");
    }

    // 4. Prerequisite: Runtime Evidence Sufficiency
    // Section 9 & Section 74: If the expression involves an invocation (e.g. `await scenario.fn(...)`),
    // and runtime value is NOT_CAPTURED, we cannot prove whether `scenario.fn` was undefined or threw inside.
    const isInvocation = Boolean(
        failureModel.failingExpression &&
        (failureModel.failingExpression.includes("(") || failureModel.failingExpression.includes("await "))
    );

    const runtimeEvidenceSufficient = Boolean(
        failureModel.runtimeValueStatus === "CAPTURED" ||
        (!isInvocation && failureModel.failingExpression)
    );

    // 5. Prerequisite: No Contradictions
    // Check if hypotheses have strong contradicting reasons or refuted status
    const hasContradictions = snapshot.investigation.hypotheses.some((h) => {
        if (!h.contradictingReasons || h.contradictingReasons.length === 0) return false;
        if ((h.status as string) === "REJECTED" || (h.status as string) === "REFUTED") return true;
        if (typeof (h as any).score === "number") return (h as any).score < 0.5;

        if (typeof (h as any).score === "object" && (h as any).score !== null) {
            const pos = (h as any).score.positive || 0;
            const neg = (h as any).score.negative || 0;
            return neg > pos || h.contradictingReasons.length > 0;
        }
        return h.contradictingReasons.length > 0;
    });
    const noContradictions = !hasContradictions;
    if (hasContradictions) {
        blockers.push("Investigation identified conflicting or contradicting telemetry evidence.");
    }


    // 6. Prerequisite: Single Decisive Repair vs Multiple Valid Options
    // If protection analysis found existing protection was insufficient, there are typically multiple options
    // (e.g. Option A: add guard, Option B: reject invalid payload upstream, Option C: provide default).
    const singleDecisiveRepair = Boolean(
        runtimeEvidenceSufficient &&
        protectionAnalysis.status !== "PROTECTION_PRESENT_BUT_INSUFFICIENT" &&
        exactSourceResolved &&
        mechanismValidated
    );

    const prerequisitesMet: RepairPrerequisites = {
        failureVerified,
        mechanismValidated,
        exactSourceResolved,
        runtimeEvidenceSufficient,
        noContradictions,
        singleDecisiveRepair,
    };

    // Calculate Evidence Confidence (How well telemetry establishes WHAT happened)
    let evidenceConfidence = 0.0;
    if (failureVerified) evidenceConfidence += 0.3;
    if (exactSourceResolved) evidenceConfidence += 0.3;
    if (mechanismValidated) evidenceConfidence += 0.2;
    if (snapshot.evidence.length >= 3) evidenceConfidence += 0.1;
    if (noContradictions) evidenceConfidence += 0.1;
    evidenceConfidence = Math.min(1.0, Math.max(0.0, evidenceConfidence));

    // Calculate Repair Confidence (How sure we are that ONE code patch is the intended business fix)
    let repairConfidence = 0.0;
    if (exactSourceResolved && mechanismValidated) {
        if (runtimeEvidenceSufficient && singleDecisiveRepair) {
            repairConfidence = 0.85;
        } else if (protectionAnalysis.status === "PROTECTION_PRESENT_BUT_INSUFFICIENT") {
            // Guard already exists for root, but not member -> multiple plausible fixes
            repairConfidence = 0.55;
        } else if (failureModel.runtimeValueStatus === "NOT_CAPTURED") {
            // We know execution reached the expression, but not whether it was undefined or threw
            repairConfidence = 0.35;
        }
    }

    // Determine 5-state Repair Eligibility
    let state: RepairEligibilityState;
    let reason: string;

    if (!failureVerified || !exactSourceResolved || !noContradictions) {
        state = "REPAIR_BLOCKED";
        reason = blockers.join(" ") || "Critical evidence missing or telemetry contradicts the failure mechanism.";
    } else if (failureModel.runtimeValueStatus === "NOT_CAPTURED" && isInvocation) {
        // Section 74: "await scenario.fn(...)" where runtime value of scenario.fn was NOT captured.
        // MUST NOT be REPAIR_READY. It is REPAIR_UNDERDETERMINED.
        state = "REPAIR_UNDERDETERMINED";
        reason = `Telemetry confirms execution reached '${failureModel.failingExpression}' on line ${failureModel.failingLineNumber}, but the runtime value was NOT captured. Halo cannot prove whether '${failureModel.failingExpression}' evaluated to undefined or if the invoked function threw an internal exception. Intended business behavior requires developer decision.`;
        blockers.push(`Runtime value of '${failureModel.failingExpression}' not captured in telemetry.`);
    } else if (protectionAnalysis.status === "PROTECTION_PRESENT_BUT_INSUFFICIENT") {
        state = "REPAIR_PLAUSIBLE";
        reason = `Failure mechanism identified and localized to line ${failureModel.failingLineNumber}. Existing guard protects '${protectionAnalysis.guards[0]?.protectsSymbol}', but member access remains unguarded. Multiple plausible repair options exist.`;
    } else if (failureVerified && exactSourceResolved && mechanismValidated && runtimeEvidenceSufficient) {
        state = "REPAIR_READY";
        reason = `Root cause and failure mechanism are verified. Exact historical source at commit is resolved. A minimal, targeted patch addressing line ${failureModel.failingLineNumber} can be safely proposed.`;
    } else {
        state = "REPAIR_PLAUSIBLE";
        reason = `Failure localized, but multiple repair alternatives or mild runtime ambiguities remain.`;
    }

    return {
        state,
        evidenceConfidence,
        repairConfidence,
        reason,
        blockers,
        prerequisitesMet,
    };
}
