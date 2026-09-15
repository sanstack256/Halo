/**
 * Halo Recommendation Engine — Symptom Masking Detection
 *
 * Implements Phase C (Section 15):
 * Deterministically checks proposed code diffs and action justifications for
 * symptom-suppression anti-patterns:
 *   - Blind optional chaining `?.` applied at callee when caller contract violation is established
 *   - Nullish coalescing `?? {}`, `|| []`, `|| ""` used to hide missing caller contracts
 *   - Catch-and-ignore / swallowing rejected promises
 *   - Blind early returns that bypass business logic
 *
 * Enforces Section 15: "Do not ban these patterns categorically.
 * Determine whether the proposed change restores the intended contract or merely hides the symptom."
 */

export interface SymptomMaskingEvaluation {
    isSymptomMasking: boolean;
    detectedPatterns: string[];
    explanation?: string;
}

export function detectSymptomMasking(
    codeDiffOrProposal: string,
    isCallerContractViolated: boolean = false
): SymptomMaskingEvaluation {
    const detectedPatterns: string[] = [];

    // 1. Catch and ignore (empty catch blocks)
    if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(codeDiffOrProposal) || /catch\s*\{\s*\}/.test(codeDiffOrProposal)) {
        detectedPatterns.push("Empty catch block swallowing unhandled exceptions");
    }

    // 2. Catch and return undefined/null
    if (/catch\s*\([^)]*\)\s*\{\s*return(\s+undefined|\s+null)?;\s*\}/.test(codeDiffOrProposal)) {
        detectedPatterns.push("Catch block returning null/undefined to silence error reporting");
    }

    // 3. Blind early returns bypassing work
    if (/if\s*\(\s*!\w+\s*\)\s*return\s*;/.test(codeDiffOrProposal)) {
        detectedPatterns.push("Early return bypassing required downstream processing");
    }

    // 4. Defensive suppression at callee when caller contract violation is established
    if (isCallerContractViolated) {
        if (/\w+\?\.\w+/.test(codeDiffOrProposal)) {
            detectedPatterns.push("Optional chaining ('?.') applied at callee when caller contract violation is established");
        }
        if (/\|\|\s*\{\}/.test(codeDiffOrProposal) || /\?\?\s*\{\}/.test(codeDiffOrProposal)) {
            detectedPatterns.push("Empty object fallback ('|| {}' or '?? {}') masking missing caller contract");
        }
        if (/\|\|\s*\[\]/.test(codeDiffOrProposal) || /\?\?\s*\[\]/.test(codeDiffOrProposal)) {
            detectedPatterns.push("Empty array fallback ('|| []' or '?? []') masking missing caller contract");
        }
        if (/\|\|\s*""/.test(codeDiffOrProposal) || /\?\?\s*""/.test(codeDiffOrProposal)) {
            detectedPatterns.push("Empty string fallback ('|| \"\"') masking missing caller contract");
        }
    }

    const isSymptomMasking = detectedPatterns.length > 0;
    const explanation = isSymptomMasking
        ? `Proposed change exhibits symptom suppression: ${detectedPatterns.join("; ")}. This hides broken contracts instead of repairing the root cause.`
        : undefined;

    return {
        isSymptomMasking,
        detectedPatterns,
        explanation,
    };
}
