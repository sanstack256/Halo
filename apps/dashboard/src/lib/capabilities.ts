/**
 * Centralized semantic capability registry for Halo Trace.
 *
 * Distinctly separates:
 * 1. RESOURCE LIMITS (maxProjects, maxMembers, maxEventsPerMonth, retentionDays)
 * 2. PRODUCT CAPABILITIES (semantic business capabilities unlocked by plans)
 *
 * Never scatter raw string checks like `if (plan === "TEAM")` across UI and routes.
 */

import { type PlanId } from "./plans";

export type TeamCapability =
    | "TEAM_INVESTIGATION_ROOMS"
    | "TEAM_COLLABORATIVE_INVESTIGATION"
    | "TEAM_DIFFERENTIAL_ANALYSIS"
    | "TEAM_INCIDENT_COORDINATION"
    | "TEAM_OWNERSHIP_INTELLIGENCE"
    | "TEAM_ORGANIZATIONAL_MEMORY"
    | "TEAM_CHANGE_INTELLIGENCE"
    | "TEAM_EVIDENCE_SYNTHESIS"
    | "TEAM_CROSS_SERVICE_TOPOLOGY"
    | "TEAM_EVIDENCE_AUTOMATION"
    | "SHARED_DASHBOARDS"
    | "AUDIT_LOG"
    | "CUSTOM_INTEGRATIONS"
    | "ADVANCED_NOTIFICATIONS"
    | "ORG_ANALYTICS";

export const CAPABILITY_METADATA: Record<
    TeamCapability,
    {
        name: string;
        description: string;
        minimumPlan: PlanId;
    }
> = {
    TEAM_INVESTIGATION_ROOMS: {
        name: "Collaborative Investigation Rooms",
        description: "Shared live causal graph workspace with peer verdicts and annotations.",
        minimumPlan: "TEAM",
    },
    TEAM_COLLABORATIVE_INVESTIGATION: {
        name: "Collaborative Live Investigation Rooms",
        description: "Shared live causal graph workspace with peer verdicts, presence, and annotations.",
        minimumPlan: "TEAM",
    },
    TEAM_DIFFERENTIAL_ANALYSIS: {
        name: "Differential Trace Analysis",
        description: "Contrast failing executions against baseline runs to isolate anomalies and divergence.",
        minimumPlan: "TEAM",
    },
    TEAM_INCIDENT_COORDINATION: {
        name: "Incident Coordination & Command",
        description: "Multi-service incident room, blast radius calculation, and mitigation timeline.",
        minimumPlan: "TEAM",
    },
    TEAM_OWNERSHIP_INTELLIGENCE: {
        name: "Ownership & Code Attribution",
        description: "Automatic service mapping, suspect commit attribution, and escalation routing.",
        minimumPlan: "TEAM",
    },
    TEAM_ORGANIZATIONAL_MEMORY: {
        name: "Organizational Failure Memory",
        description: "Cross-incident pattern matching, recurring failure graphs, and automated postmortems.",
        minimumPlan: "TEAM",
    },
    TEAM_CHANGE_INTELLIGENCE: {
        name: "Change Intelligence & Causal Change Analysis",
        description: "Correlate git commits, deployments, and configuration changes with failure timelines and code execution paths.",
        minimumPlan: "TEAM",
    },
    TEAM_EVIDENCE_SYNTHESIS: {
        name: "Evidence Synthesis & Investigation Reasoning",
        description: "Deterministic synthesis of cross-pillar evidence into inspectable claims, independent verification, and investigation narratives.",
        minimumPlan: "TEAM",
    },
    TEAM_CROSS_SERVICE_TOPOLOGY: {
        name: "Cross-Service Topology & Heatmaps",
        description: "Dynamic microservice dependency graphs and bottleneck heatmaps derived from W3C traces.",
        minimumPlan: "TEAM",
    },
    TEAM_EVIDENCE_AUTOMATION: {
        name: "Evidence-Backed Automation",
        description: "Autonomous reproduction payloads, curl fixtures, and regression test suites.",
        minimumPlan: "TEAM",
    },
    SHARED_DASHBOARDS: {
        name: "Shared Team Dashboards",
        description: "Cross-organization shared telemetry dashboards and monitor views.",
        minimumPlan: "TEAM",
    },
    AUDIT_LOG: {
        name: "Organization Audit Log",
        description: "Immutable compliance log of all configuration mutations and security actions.",
        minimumPlan: "TEAM",
    },
    CUSTOM_INTEGRATIONS: {
        name: "Custom Webhooks & Integrations",
        description: "Direct outbound webhooks and third-party incident management connectors.",
        minimumPlan: "TEAM",
    },
    ADVANCED_NOTIFICATIONS: {
        name: "Advanced Notification Controls",
        description: "Tiered escalation matrices, PagerDuty routing, and team Slack channels.",
        minimumPlan: "TEAM",
    },
    ORG_ANALYTICS: {
        name: "Organization-Wide Analytics",
        description: "Aggregated MTTD/MTTR metrics, service health index, and incident volume.",
        minimumPlan: "TEAM",
    },
};

const PLAN_HIERARCHY: Record<PlanId, number> = {
    FREE: 0,
    DEVELOPER: 1,
    TEAM: 2,
};

/**
 * Authoritatively check if a plan unlocks a specific semantic capability.
 */
export function planHasCapability(plan: PlanId, capability: TeamCapability): boolean {
    const meta = CAPABILITY_METADATA[capability];
    if (!meta) return false;
    return PLAN_HIERARCHY[plan] >= PLAN_HIERARCHY[meta.minimumPlan];
}
