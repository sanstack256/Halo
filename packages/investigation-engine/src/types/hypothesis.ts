import type { EvidenceScore } from "./evidence-score";
import type { Reason } from "./reason";

export type HypothesisStatus =
    | "CANDIDATE"
    | "LEADING"
    | "VALIDATED"
    | "REJECTED"
    | "UNCERTAIN";

export interface Hypothesis {
    id: string;

    title: string;

    description: string;

    score: EvidenceScore;

    confidence: number;

    status: HypothesisStatus;

    supportingReasons: Reason[];

    contradictingReasons: Reason[];

    missingReasons: Reason[];

    findingIds: string[];

    evidenceIds: string[];

    alternativeIds: string[];

    validation?: {
        validated: boolean;
        confidence: number;
        evidenceIds: string[];
    };
}