import type { Change } from "./change";
import type { Evidence } from "./evidence";
import type { Finding } from "./finding";

export interface InvestigationContext {
    evidence: Evidence[];

    changes: Change[];

    findings: Finding[];

    deployments: Evidence[];

    errors: Evidence[];

    logs: Evidence[];

    traces: Evidence[];

    metrics: Evidence[];

    configs: Evidence[];

    featureFlags: Evidence[];

    infrastructure: Evidence[];

    thirdParty: Evidence[];

    services: string[];

    releases: string[];

    environments: string[];

    firstError?: Evidence;

    latestError?: Evidence;

    latestDeployment?: Evidence;

    earliestChange?: Change;

    latestChange?: Change;
}