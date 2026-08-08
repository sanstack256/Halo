import type { EvidenceScore } from "./evidence-score";
import type { Reason } from "./reason";

export interface Hypothesis {

    id: string;

    title: string;

    description: string;

    score: EvidenceScore;

    confidence: number;

    supportingReasons: Reason[];

    contradictingReasons: Reason[];

    missingReasons: Reason[];

}