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

import { compareFailureOccurrences } from "@/lib/analytics/occurrence-comparison";

export async function getOccurrenceComparisonAction(fingerprint: string, projectId: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    return compareFailureOccurrences(fingerprint, projectId);
}

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

    // Return only real environment names from the database.
    // Do NOT inject fabricated defaults — callers must handle an empty array
    // by showing an appropriate "No environments recorded" UI state.
    const environments = Array.from(new Set(envRows.map((e) => e.name).filter(Boolean)));

    return {
        projects,
        environments,
    };
}

import { getServerTimezone } from "@/lib/timezone-server";

export async function getSystemExplorerAnalytics(params: Omit<SystemExplorerParams, "organizationId">) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) throw new Error("No organization found");

    const userTimezone = await getServerTimezone();

    return fetchSystemExplorerAnalytics({
        ...params,
        organizationId: organization.id,
        userTimezone,
    });
}

export async function getServiceLandscapeAnalytics(params: Omit<ServiceLandscapeParams, "organizationId">) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) throw new Error("No organization found");

    const userTimezone = await getServerTimezone();

    return fetchServiceLandscapeAnalytics({
        ...params,
        organizationId: organization.id,
        userTimezone,
    });
}

export async function getServiceDetailedContextAction(serviceName: string, projectId: string, timeRangeKey?: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const userTimezone = await getServerTimezone();
    return fetchServiceDetailedContext(serviceName, projectId, timeRangeKey, userTimezone);
}

export async function getChangeIntelligenceAnalytics(params: Omit<ChangeIntelligenceParams, "organizationId">) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) throw new Error("No organization found");

    const userTimezone = await getServerTimezone();

    return fetchChangeIntelligenceAnalytics({
        ...params,
        organizationId: organization.id,
        userTimezone,
    });
}

export async function getChangeImpactDeepAnalysisAction(releaseId: string, projectId: string) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const userTimezone = await getServerTimezone();
    return fetchChangeImpactDeepAnalysis(releaseId, projectId, userTimezone);
}

export async function getDependencyIntelligenceAnalytics(params: Omit<DependencyIntelligenceParams, "organizationId">) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) throw new Error("No organization found");

    const userTimezone = await getServerTimezone();

    return fetchDependencyIntelligenceAnalytics({
        ...params,
        organizationId: organization.id,
        userTimezone,
    });
}

export async function getReliabilityLabAnalytics(params: Omit<ReliabilityLabParams, "organizationId">) {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) throw new Error("No organization found");

    const userTimezone = await getServerTimezone();

    return fetchReliabilityLabAnalytics({
        ...params,
        organizationId: organization.id,
        userTimezone,
    });
}
