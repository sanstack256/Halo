import type { ConfidenceLevel } from "./confidence";
import type { EvidenceScore } from "./evidence-score";
import type { CausalChain } from "./graph";
import type { Reason } from "./reason";

export type HypothesisStatus =
    | "CANDIDATE"
    | "LEADING"
    | "VALIDATED"
    | "REJECTED"
    | "UNCERTAIN";

export interface HypothesisSupportingEvidence {
    evidenceId: string;
    reason: string;
    role: string;
    strength: number;
}

export interface HypothesisContradictingEvidence {
    evidenceId: string;
    reason: string;
    strength: number;
}

export interface HypothesisMissingEvidence {
    what: string;
    why: string;
    impact: string;
}

export interface Hypothesis {
    id: string;

    title: string;

    description: string;

    score: EvidenceScore;

    confidence: number;

    confidenceLevel?: ConfidenceLevel;

    confidenceExplanation?: string;

    rankingExplanation?: string;

    causalExplanation?: string;

    causalChainId?: string;

    causalChain?: CausalChain;

    provenance?: string;

    status: HypothesisStatus;

    supportingReasons: Reason[];

    contradictingReasons: Reason[];

    missingReasons: Reason[];

    detailedSupportingEvidence?: HypothesisSupportingEvidence[];

    detailedContradictingEvidence?: HypothesisContradictingEvidence[];

    detailedMissingEvidence?: HypothesisMissingEvidence[];

    findingIds: string[];

    evidenceIds: string[];

    alternativeIds: string[];

    validation?: {
        validated: boolean;

        confidence: number;

        evidenceIds: string[];
    };
}