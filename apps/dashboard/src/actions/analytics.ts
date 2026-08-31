"use server";

import { getSession } from "@/lib/session";
import { getOrganization } from "@/lib/organization";
import { prisma } from "@/lib/prisma";

import {
    fetchSystemExplorerAnalytics,
    type SystemExplorerParams,
} from "@/lib/analytics/system-explorer";

import {
    fetchServiceLandscapeAnalytics,
    fetchServiceDetailedContext,
    type ServiceLandscapeParams,
} from "@/lib/analytics/service-landscape";

import {
    fetchChangeIntelligenceAnalytics,
    fetchChangeImpactDeepAnalysis,
    type ChangeIntelligenceParams,
} from "@/lib/analytics/change-intelligence";

import {
    fetchDependencyIntelligenceAnalytics,
    type DependencyIntelligenceParams,
} from "@/lib/analytics/dependency-intelligence";

import {
    fetchReliabilityLabAnalytics,
    type ReliabilityLabParams,
} from "@/lib/analytics/reliability-lab";

export interface DashboardFilterContext {
    projects: Array<{ id: string; name: string }>;
    environments: string[];
}

export async function getDashboardFilterContext(): Promise<DashboardFilterContext> {
    const session = await getSession();
    if (!session) return { projects: [], environments: [] };

    const organization = await getOrganization(session.user.id);
    if (!organization) return { projects: [], environments: [] };

    const [projects, envRows] = await Promise.all([
        prisma.project.findMany({
            where: { organizationId: organization.id },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        }),
        prisma.environment.findMany({
            where: { project: { organizationId: organization.id } },
            select: { name: true },
            distinct: ["name"],
        }),
    ]);

    const environments = Array.from(new Set(envRows.map((e) => e.name).filter(Boolean)));
    if (environments.length === 0) {
        environments.push("production", "staging", "development");
    }

    return {
        projects,
        environments,
    };
}

export async function getSystemExplorerAnalytics(params: Omit<SystemExplorerParams, "organizationId">) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) throw new Error("No organization found");

    return fetchSystemExplorerAnalytics({
        ...params,
        organizationId: organization.id,
    });
}

export async function getServiceLandscapeAnalytics(params: Omit<ServiceLandscapeParams, "organizationId">) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) throw new Error("No organization found");

    return fetchServiceLandscapeAnalytics({
        ...params,
        organizationId: organization.id,
    });
}

export async function getServiceDetailedContextAction(serviceName: string, projectId: string, timeRangeKey?: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    return fetchServiceDetailedContext(serviceName, projectId, timeRangeKey);
}

export async function getChangeIntelligenceAnalytics(params: Omit<ChangeIntelligenceParams, "organizationId">) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) throw new Error("No organization found");

    return fetchChangeIntelligenceAnalytics({
        ...params,
        organizationId: organization.id,
    });
}

export async function getChangeImpactDeepAnalysisAction(releaseId: string, projectId: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    return fetchChangeImpactDeepAnalysis(releaseId, projectId);
}

export async function getDependencyIntelligenceAnalytics(params: Omit<DependencyIntelligenceParams, "organizationId">) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) throw new Error("No organization found");

    return fetchDependencyIntelligenceAnalytics({
        ...params,
        organizationId: organization.id,
    });
}

export async function getReliabilityLabAnalytics(params: Omit<ReliabilityLabParams, "organizationId">) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) throw new Error("No organization found");

    return fetchReliabilityLabAnalytics({
        ...params,
        organizationId: organization.id,
    });
}
