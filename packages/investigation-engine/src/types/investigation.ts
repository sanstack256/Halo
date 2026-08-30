import type { Change } from "./change";
import type { Evidence } from "./evidence";
import type { EvidenceGraph, CausalChain } from "./graph";
import type { Finding } from "./finding";
import type { Hypothesis } from "./hypothesis";
import type { Impact } from "./impact";
import type { Recommendation } from "./recommendation";
import type { Timeline } from "./timeline";
import type { ConfidenceLevel } from "./confidence";
import type { AnomalySignal } from "./anomaly";
import type { StructuralTemplate } from "./template";
import type { EngineTelemetry } from "./telemetry";

export type InvestigationStatus =
    | "INVESTIGATING"
    | "ANALYSIS_COMPLETE"
    | "CONCLUDED"
    | "UNCERTAIN";

export interface InvestigationReport {
    summary: string;

    rootCause: {
        title: string;
        confidence: number;
        confidenceLevel: ConfidenceLevel;
        explanation: string;
        supportingReasons: string[];
        contradictingReasons: string[];
        missingReasons: string[];
        propagationPath?: string[];
        causalChainId?: string;
    } | null;

    alternatives: {
        title: string;
        confidence: number;
        confidenceLevel: ConfidenceLevel;
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

    causalChains?: CausalChain[];

    impact: Impact | null;

    recommendations: Recommendation[];

    report: InvestigationReport;

    nextInvestigation:
        | {
              question: string;
              reason: string;
              evidenceIds: string[];
          }
        | null;

    anomalies?: AnomalySignal[];

    templates?: StructuralTemplate[];

    telemetry?: EngineTelemetry;
}