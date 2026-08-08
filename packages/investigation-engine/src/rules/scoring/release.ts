import type { Evidence } from "../../types/evidence";

export function scoreSameService(
    left: Evidence,
    right: Evidence
): number {

    if (left.service !== right.service) {
        return 0;
    }

    return 15;
}