import type { CausalRole } from "./finding";

export type ReasonType =
    | "SUPPORTING"
    | "CONTRADICTING"
    | "MISSING";

export interface Reason {
    type: ReasonType;

    causalRole: CausalRole;

    title: string;

    description: string;

    strength: number;

    evidenceIds: string[];
}