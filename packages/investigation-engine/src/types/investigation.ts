import type { Change } from "./change";
import type { Evidence } from "./evidence";
import type { EvidenceGraph } from "./graph";
import type { Finding } from "./finding";
import type { Hypothesis } from "./hypothesis";
import type { Impact } from "./impact";
import type { Recommendation } from "./recommendation";
import type { Timeline } from "./timeline";

export type InvestigationStatus =
    | "INVESTIGATING"
    | "CONCLUDED"
    | "UNCERTAIN";

export interface InvestigationReport {
    summary: string;

    rootCause: {
        title: string;
        confidence: number;
        explanation: string;
    } | null;

    alternatives: {
        title: string;
        confidence: number;
    }[];

    uncertainties: string[];

    nextSteps: string[];
}

export interface Investigation {
    status: InvestigationStatus;

    evidence: Evidence[];

    graph: EvidenceGraph;

    timeline: Timeline;

    changes: Change[];

    findings: Finding[];

    hypotheses: Hypothesis[];

    rootCause: Hypothesis | null;

    impact: Impact | null;

    recommendations: Recommendation[];

    report: InvestigationReport;

    nextInvestigation?: {
        question: string;
        reason: string;
        evidenceIds: string[];
    };
}