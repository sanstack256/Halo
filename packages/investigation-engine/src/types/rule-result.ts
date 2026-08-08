import type { Reason } from "./reason";

export interface RuleResult {
    hypothesis: string;

    reason: Reason;
}