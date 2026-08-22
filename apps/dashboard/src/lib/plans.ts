/**
 * Centralized plan configuration for Halo.
 *
 * This is the single source of truth for plan names, prices, limits, and
 * feature flags. The UI, API routes, and enforcement logic all read from here.
 * Never hardcode plan values in components.
 */

export type PlanId = "FREE" | "DEVELOPER" | "TEAM";

export type PlanLimits = {
    /** Maximum number of projects allowed */
    maxProjects: number;
    /** Maximum number of team members */
    maxMembers: number;
    /** Maximum telemetry events ingested per month */
    maxEventsPerMonth: number;
    /** Retention window in days */
    retentionDays: number;
    /** Maximum AI investigations per month (null = unlimited) */
    maxAiInvestigationsPerMonth: number | null;
    /** Maximum Autofix usages per month (null = unlimited) */
    maxAutofixPerMonth: number | null;
};

export type PlanFeatures = {
    /** Full error tracking */
    errors: boolean;
    /** Log ingestion */
    logs: boolean;
    /** Distributed tracing */
    traces: boolean;
    /** Metrics explorer */
    metrics: boolean;
    /** Request monitoring */
    requests: boolean;
    /** Service maps */
    serviceMaps: boolean;
    /** Dependency tracking */
    dependencies: boolean;
    /** Full investigation engine with root cause, hypothesis, causal timeline */
    investigationEngine: boolean;
    /** Blast-radius analysis */
    blastRadius: boolean;
    /** Historical incident comparison */
    historicalComparison: boolean;
    /** Deployment regression analysis */
    deploymentRegression: boolean;
    /** Git/code correlation */
    gitCorrelation: boolean;
    /** Autofix AI assistance */
    autofix: boolean;
    /** SLO tracking */
    slos: boolean;
    /** Error budgets */
    errorBudgets: boolean;
    /** Advanced dashboards */
    advancedDashboards: boolean;
    /** Spike protection */
    spikeProtection: boolean;
    /** MCP & CLI access */
    mcpCli: boolean;
    /** Team investigations (shared) */
    teamInvestigations: boolean;
    /** Shared dashboards */
    sharedDashboards: boolean;
    /** Team ownership & alert routing */
    teamOwnership: boolean;
    /** Audit log */
    auditLog: boolean;
    /** Custom integrations */
    customIntegrations: boolean;
    /** Advanced notification controls */
    advancedNotifications: boolean;
    /** Organization-wide analytics */
    orgAnalytics: boolean;
};

export type Plan = {
    id: PlanId;
    name: string;
    tagline: string;
    price: {
        monthly: number;
        yearly: number; // per-month price when billed annually
    };
    limits: PlanLimits;
    features: PlanFeatures;
    /** Highlight on pricing page */
    recommended?: boolean;
};

export const PLANS: Record<PlanId, Plan> = {
    FREE: {
        id: "FREE",
        name: "Free",
        tagline: "For developers trying Halo on personal or small projects.",
        price: { monthly: 0, yearly: 0 },
        limits: {
            maxProjects: 1,
            maxMembers: 2,
            maxEventsPerMonth: 50_000,
            retentionDays: 7,
            maxAiInvestigationsPerMonth: 5,
            maxAutofixPerMonth: 0,
        },
        features: {
            errors: true,
            logs: true,
            traces: false,
            metrics: false,
            requests: false,
            serviceMaps: false,
            dependencies: false,
            investigationEngine: true, // limited by quota
            blastRadius: false,
            historicalComparison: false,
            deploymentRegression: false,
            gitCorrelation: false,
            autofix: false,
            slos: false,
            errorBudgets: false,
            advancedDashboards: false,
            spikeProtection: false,
            mcpCli: false,
            teamInvestigations: false,
            sharedDashboards: false,
            teamOwnership: false,
            auditLog: false,
            customIntegrations: false,
            advancedNotifications: false,
            orgAnalytics: false,
        },
    },

    DEVELOPER: {
        id: "DEVELOPER",
        name: "Developer",
        tagline: "For serious individual developers and small production apps.",
        price: { monthly: 19, yearly: 15 },
        recommended: true,
        limits: {
            maxProjects: 5,
            maxMembers: 1,
            maxEventsPerMonth: 1_000_000,
            retentionDays: 30,
            maxAiInvestigationsPerMonth: null, // unlimited
            maxAutofixPerMonth: 100,
        },
        features: {
            errors: true,
            logs: true,
            traces: true,
            metrics: true,
            requests: true,
            serviceMaps: true,
            dependencies: true,
            investigationEngine: true,
            blastRadius: true,
            historicalComparison: true,
            deploymentRegression: true,
            gitCorrelation: true,
            autofix: true,
            slos: true,
            errorBudgets: true,
            advancedDashboards: true,
            spikeProtection: true,
            mcpCli: true,
            teamInvestigations: false,
            sharedDashboards: false,
            teamOwnership: false,
            auditLog: false,
            customIntegrations: false,
            advancedNotifications: false,
            orgAnalytics: false,
        },
    },

    TEAM: {
        id: "TEAM",
        name: "Team",
        tagline: "For small engineering teams building production systems.",
        price: { monthly: 49, yearly: 39 },
        limits: {
            maxProjects: 10,
            maxMembers: 10,
            maxEventsPerMonth: 5_000_000,
            retentionDays: 90,
            maxAiInvestigationsPerMonth: null, // unlimited
            maxAutofixPerMonth: null, // unlimited
        },
        features: {
            errors: true,
            logs: true,
            traces: true,
            metrics: true,
            requests: true,
            serviceMaps: true,
            dependencies: true,
            investigationEngine: true,
            blastRadius: true,
            historicalComparison: true,
            deploymentRegression: true,
            gitCorrelation: true,
            autofix: true,
            slos: true,
            errorBudgets: true,
            advancedDashboards: true,
            spikeProtection: true,
            mcpCli: true,
            teamInvestigations: true,
            sharedDashboards: true,
            teamOwnership: true,
            auditLog: true,
            customIntegrations: true,
            advancedNotifications: true,
            orgAnalytics: true,
        },
    },
};

/** Minimum plan ID that unlocks a given feature */
export function minimumPlanForFeature(
    feature: keyof PlanFeatures
): PlanId {
    if (PLANS.FREE.features[feature]) return "FREE";
    if (PLANS.DEVELOPER.features[feature]) return "DEVELOPER";
    return "TEAM";
}

/** Human-readable plan display name */
export function planDisplayName(planId: PlanId): string {
    return PLANS[planId].name;
}

/** Ordered list of plan IDs for comparison tables */
export const PLAN_ORDER: PlanId[] = ["FREE", "DEVELOPER", "TEAM"];
