import type { Evidence } from "../types/evidence";

export function normalizeEvidence(
    evidence: Evidence[]
): Evidence[] {

    return [...evidence].sort(
        (a, b) =>
            a.timestamp.getTime() -
            b.timestamp.getTime()
    );
}