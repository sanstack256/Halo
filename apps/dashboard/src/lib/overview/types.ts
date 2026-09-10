import {
    CanonicalOverviewData,
    OverviewObservedState,
} from "./overview-service";
import {
    AttentionItem,
    AttentionType,
    AttentionSeverity,
    AttentionSummary,
} from "./attention-model";

export type {
    AttentionItem,
    AttentionType,
    AttentionSeverity,
    AttentionSummary,
    CanonicalOverviewData,
    OverviewObservedState,
};

export type ActiveIncident = {
    id: string;
    title: string;
    severity: "FATAL" | "ERROR" | "WARNING" | "INFO";
    eventCount: number;
    occurrenceDescription: string;
    service: string | null;
    projectName: string;
    projectId: string;
    lastSeen: Date;
    status: string;
};

export type RecentChange = {
    id: string;
    version: string;
    type: "deployment";
    projectName: string;
    projectId: string;
    timestamp: Date;
    correlatedErrors: number;
    status: "suspicious" | "stable";
};

export type RecentInvestigation = {
    id: string;
    title: string;
    issueId: string | null;
    projectId: string;
    projectName: string;
    status: string;
    hasRootCause: boolean;
    rootCauseTitle: string | null;
    confidenceScore: number | null;
    updatedAt: Date;
};

export type SystemState = OverviewObservedState;

export type OverviewData = CanonicalOverviewData & {
    activeIncidents: ActiveIncident[];
    recentChanges: RecentChange[];
    recentInvestigations: RecentInvestigation[];
    needsAttention: {
        openIssuesCount: number;
        fatalCount: number;
        criticalServiceCount: number;
        suspiciousChangeCount: number;
        primaryAlert: {
            title: string;
            service: string | null;
            severity: string;
            occurrenceDescription: string;
            suspectedCause: string;
            issueId: string;
            projectId: string;
        } | null;
    };
    systemHealth: {
        apdexScore: number;
        apdexRating: "Satisfied" | "Tolerating" | "Frustrated";
        errorRate24h: number;
        crashFreeRate: number;
        impactedUsers24h: number;
        totalErrors24h: number;
        activeServiceCount: number;
    };
    systemState: SystemState;
};
