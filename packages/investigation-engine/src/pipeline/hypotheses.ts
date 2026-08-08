import type { Evidence } from "../types/evidence";
import type { Hypothesis } from "../types/hypothesis";

import { rules } from "../rules";
import { aggregateHypotheses } from "./aggregate";

export function generateHypotheses(
    evidence: Evidence[]
): Hypothesis[] {

    const results = rules.flatMap(rule =>
        rule(evidence)
    );

    return aggregateHypotheses(
        results
    );
}