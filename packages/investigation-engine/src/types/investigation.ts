import type { Evidence } from "./evidence";
import type { EvidenceGraph } from "./graph";
import type { Timeline } from "./timeline";
import type { Hypothesis } from "./hypothesis";
import type { Recommendation } from "./recommendation";
import type { Change } from "./change";
import type { Impact } from "./impact";

export interface Investigation {

    evidence: Evidence[];

    graph: EvidenceGraph;

    timeline: Timeline;

    changes: Change[];

    hypotheses: Hypothesis[];

    rootCause: Hypothesis | null;

    impact: Impact | null;

    recommendations: Recommendation[];
}