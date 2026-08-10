import type { Reason } from "./reason";

export type FindingType =
    | "TEMPORAL"
    | "RELATIONSHIP"
    | "ANOMALY"
    | "CHANGE_IMPACT"
    | "PATTERN"
    | "RECOVERY"
    | "SCOPE"
    | "DEPENDENCY";

export type CausalRole =
    | "TRIGGER"
    | "CONTRIBUTOR"
    | "CAUSE"
    | "MECHANISM"
    | "SYMPTOM"
    | "CONTEXT"
    | "CONTRADICTION";

export interface Finding {
    id: string;

    type: FindingType;

    causalRole: CausalRole;

    title: string;

    description: string;

    strength: number;

    evidenceIds: string[];

    reasons: Reason[];
}