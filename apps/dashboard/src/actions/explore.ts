"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getOrganization } from "@/lib/organization";
import {
    searchEvidenceCategories,
    constructEvidenceNeedle,
    type CategorizedSearchResults,
    type EvidenceNeedleResult,
} from "@/lib/explore/evidence-needle";
import {
    constructLogThreads,
    type LogThread,
} from "@/lib/explore/log-threader";
import {
    computeTraceDivergence,
    type TraceDivergenceResult,
} from "@/lib/explore/trace-divergence";
import {
    generateErrorReproductionRecipe,
    type ErrorReproductionRecipe,
} from "@/lib/explore/error-recipe";
import {
    computeMetricShapeTwins,
    type MetricKey,
    type MetricShapeTwinResult,
} from "@/lib/explore/metric-twin";
import {
    reconstructRequest,
    diffRequests,
    type RequestReconstruction,
    type RequestDiffResult,
} from "@/lib/explore/request-reconstruction";
import {
    computeDatabaseWaitAttribution,
    type DatabaseWaitAttributionResult,
} from "@/lib/explore/db-attribution";
import {
    compareRuntimeFingerprint,
    type RuntimeFingerprintResult,
} from "@/lib/explore/runtime-fingerprint";
import {
    getEventsInTimeRange,
    type CanonicalQueryFilter,
} from "@/lib/explore/canonical-evidence-access";
import type { CanonicalEvidenceRecord } from "@/lib/explore/evidence-types";

interface AuthorizedContext {
    orgId: string;
    projectIds: string[];
    projects: Array<{ id: string; name: string }>;
}

async function getAuthorizedContext(projectIdOption?: string): Promise<AuthorizedContext> {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");

    const organization = await getOrganization(session.user.id);
    if (!organization) return { orgId: "", projectIds: [], projects: [] };

    const projects = await prisma.project.findMany({
        where: { organizationId: organization.id },
        select: { id: true, name: true },
    });

    if (projects.length === 0) return { orgId: organization.id, projectIds: [], projects: [] };

    const projectIds = projectIdOption ? [projectIdOption] : projects.map((p) => p.id);
    return { orgId: organization.id, projectIds, projects };
}

function parseTimeRange(key: string): { from: Date; to: Date } {
    const to = new Date();
    let from = new Date(to.getTime() - 24 * 60 * 60 * 1000);

    if (key === "15m") from = new Date(to.getTime() - 15 * 60 * 1000);
    else if (key === "1h") from = new Date(to.getTime() - 60 * 60 * 1000);
    else if (key === "6h") from = new Date(to.getTime() - 6 * 60 * 60 * 1000);
    else if (key === "7d") from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (key === "30d") from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    return { from, to };
}

// 1. Search — Evidence Needle
export async function getEvidenceNeedleData(
    rawQuery: string,
    anchorEventId?: string,
    timeRangeKey: string = "24h",
    projectIdOption?: string
): Promise<{
    searchResults: CategorizedSearchResults;
    needle: EvidenceNeedleResult | null;
}> {
    const { orgId, projectIds } = await getAuthorizedContext(projectIdOption);
    if (!orgId || projectIds.length === 0) {
        return {
            searchResults: {
                errors: [],
                requests: [],
                traces: [],
                logs: [],
                database: [],
                sessions: [],
                totalMatches: 0,
            },
            needle: null,
        };
    }

    const timeRange = parseTimeRange(timeRangeKey);

    const searchResults = await searchEvidenceCategories(
        orgId,
        rawQuery,
        timeRange,
        projectIds
    );

    let needle: EvidenceNeedleResult | null = null;
    const targetAnchorId =
        anchorEventId ||
        searchResults.errors[0]?.id ||
        searchResults.traces[0]?.id ||
        searchResults.requests[0]?.id ||
        searchResults.logs[0]?.id;

    if (targetAnchorId) {
        needle = await constructEvidenceNeedle(targetAnchorId, orgId);
    }

    return { searchResults, needle };
}

// 2. Logs — Log Threader
export async function getLogThreadsData(options?: {
    projectId?: string;
    environment?: string;
    service?: string;
    timeRange?: string;
    search?: string;
    limit?: number;
}): Promise<{ threads: LogThread[]; unthreadedCount: number }> {
    const { orgId, projectIds } = await getAuthorizedContext(options?.projectId);
    if (!orgId || projectIds.length === 0) return { threads: [], unthreadedCount: 0 };

    const { from, to } = parseTimeRange(options?.timeRange || "24h");

    return constructLogThreads(
        {
            projectIds,
            service: options?.service,
            from,
            to,
            search: options?.search,
            limit: options?.limit ?? 150,
        },
        orgId
    );
}

// 3. Traces — Divergence Finder
export async function getTraceDivergenceData(
    traceId?: string,
    referenceTraceId?: string,
    options?: { projectId?: string }
): Promise<{ divergence: TraceDivergenceResult | null; recentTraces: CanonicalEvidenceRecord[] }> {
    const { orgId, projectIds } = await getAuthorizedContext(options?.projectId);
    if (!orgId || projectIds.length === 0) return { divergence: null, recentTraces: [] };

    // Fetch recent traces for selector
    const { records: recentTraces } = await getEventsInTimeRange(
        {
            projectIds,
            types: ["TRACE"],
            limit: 15,
        },
        orgId
    );

    const activeTraceId = traceId || recentTraces[0]?.traceId || recentTraces[0]?.id;
    if (!activeTraceId) {
        return { divergence: null, recentTraces };
    }

    const divergence = await computeTraceDivergence(
        activeTraceId,
        orgId,
        referenceTraceId
    );

    return { divergence, recentTraces };
}

// 4. Errors — Reproduction Recipe
export async function getErrorReproductionData(
    target: { fingerprint?: string; eventId?: string; issueId?: string },
    options?: { projectId?: string }
): Promise<{ recipe: ErrorReproductionRecipe | null; recentErrors: CanonicalEvidenceRecord[] }> {
    const { orgId, projectIds } = await getAuthorizedContext(options?.projectId);
    if (!orgId || projectIds.length === 0) return { recipe: null, recentErrors: [] };

    const { records: recentErrors } = await getEventsInTimeRange(
        {
            projectIds,
            types: ["ERROR"],
            limit: 15,
        },
        orgId
    );

    const recipe = await generateErrorReproductionRecipe(
        target.eventId || target.fingerprint || target.issueId ? target : { eventId: recentErrors[0]?.id },
        orgId
    );

    return { recipe, recentErrors };
}

// 5. Metrics — Shape Twin
export async function getMetricShapeTwinData(
    metricKey: MetricKey = "errors",
    timeRange: string = "24h",
    options?: { projectId?: string }
): Promise<MetricShapeTwinResult> {
    const { orgId, projectIds } = await getAuthorizedContext(options?.projectId);
    return computeMetricShapeTwins(metricKey, timeRange, orgId, projectIds);
}

// 6. Requests — Request Reconstruction
export async function getRequestReconstructionData(
    targetRequestId?: string,
    compareRequestId?: string,
    options?: { projectId?: string; service?: string }
): Promise<{
    reconstruction: RequestReconstruction | null;
    diff: RequestDiffResult | null;
    recentRequests: CanonicalEvidenceRecord[];
}> {
    const { orgId, projectIds } = await getAuthorizedContext(options?.projectId);
    if (!orgId || projectIds.length === 0) {
        return { reconstruction: null, diff: null, recentRequests: [] };
    }

    const { records: recentRequests } = await getEventsInTimeRange(
        {
            projectIds,
            service: options?.service,
            limit: 20,
        },
        orgId
    );

    const activeRequestId =
        targetRequestId ||
        recentRequests.find((r) => r.requestId)?.requestId;

    if (!activeRequestId) {
        return { reconstruction: null, diff: null, recentRequests };
    }

    const reconstruction = await reconstructRequest(
        activeRequestId,
        orgId,
        compareRequestId
    );

    let diff: RequestDiffResult | null = null;
    if (reconstruction && compareRequestId) {
        diff = await diffRequests(reconstruction, compareRequestId, orgId);
    }

    return { reconstruction, diff, recentRequests };
}

// 7. Database — Query Wait Attribution
export async function getDatabaseWaitAttributionData(options?: {
    requestId?: string;
    projectId?: string;
    service?: string;
    limit?: number;
}): Promise<DatabaseWaitAttributionResult> {
    const { orgId, projectIds } = await getAuthorizedContext(options?.projectId);
    if (!orgId || projectIds.length === 0) {
        return computeDatabaseWaitAttribution(undefined, orgId, {});
    }

    return computeDatabaseWaitAttribution(options?.requestId, orgId, {
        projectIds,
        service: options?.service,
        limit: options?.limit ?? 100,
    });
}

// 8. Infrastructure — Runtime Fingerprint
export async function getRuntimeFingerprintData(
    failureEventId?: string,
    options?: { projectId?: string }
): Promise<{
    fingerprint: RuntimeFingerprintResult | null;
    recentErrors: CanonicalEvidenceRecord[];
}> {
    const { orgId, projectIds } = await getAuthorizedContext(options?.projectId);
    if (!orgId || projectIds.length === 0) return { fingerprint: null, recentErrors: [] };

    const { records: recentErrors } = await getEventsInTimeRange(
        {
            projectIds,
            types: ["ERROR"],
            limit: 15,
        },
        orgId
    );

    const fingerprint = await compareRuntimeFingerprint(
        failureEventId || recentErrors[0]?.id,
        orgId
    );

    return { fingerprint, recentErrors };
}

// Global Explore Context Options (Projects, Environments, Services, Releases)
export async function getExploreContextOptions() {
    const session = await getSession();
    if (!session) return { projects: [], environments: [], services: [], releases: [] };

    const organization = await getOrganization(session.user.id);
    if (!organization) return { projects: [], environments: [], services: [], releases: [] };

    const projects = await prisma.project.findMany({
        where: { organizationId: organization.id },
        select: { id: true, name: true, slug: true },
    });

    const projectIds = projects.map((p) => p.id);

    const [environments, distinctServices, distinctReleases] = await Promise.all([
        prisma.environment.findMany({
            where: { projectId: { in: projectIds } },
            select: { id: true, name: true, projectId: true },
        }),
        prisma.event.findMany({
            where: { projectId: { in: projectIds }, service: { not: null } },
            distinct: ["service"],
            select: { service: true },
        }),
        prisma.event.findMany({
            where: { projectId: { in: projectIds }, release: { not: null } },
            distinct: ["release"],
            select: { release: true },
        }),
    ]);

    return {
        projects,
        environments: environments.map((e) => ({ id: e.id, name: e.name, projectId: e.projectId })),
        services: distinctServices.map((s) => s.service as string).filter(Boolean),
        releases: distinctReleases.map((r) => r.release as string).filter(Boolean),
    };
}

// Backward-compatible query wrappers for existing legacy pages
export async function getLogs(options?: { projectId?: string; service?: string; limit?: number }) {
    const { orgId, projectIds } = await getAuthorizedContext(options?.projectId);
    if (!orgId || projectIds.length === 0) return [];

    const { records } = await getEventsInTimeRange(
        {
            projectIds,
            types: ["LOG", "MESSAGE"],
            service: options?.service,
            limit: options?.limit ?? 100,
        },
        orgId
    );

    return records;
}

export async function getTraces(options?: { projectId?: string; service?: string; limit?: number }) {
    const { orgId, projectIds } = await getAuthorizedContext(options?.projectId);
    if (!orgId || projectIds.length === 0) return [];

    const { records } = await getEventsInTimeRange(
        {
            projectIds,
            types: ["TRACE"],
            service: options?.service,
            limit: options?.limit ?? 100,
        },
        orgId
    );

    return records;
}

export async function getErrors(options?: { projectId?: string; service?: string; limit?: number }) {
    const { orgId, projectIds } = await getAuthorizedContext(options?.projectId);
    if (!orgId || projectIds.length === 0) return [];

    const { records } = await getEventsInTimeRange(
        {
            projectIds,
            types: ["ERROR"],
            service: options?.service,
            limit: options?.limit ?? 100,
        },
        orgId
    );

    return records;
}

export async function getRequests(options?: { projectId?: string; limit?: number }) {
    const { orgId, projectIds } = await getAuthorizedContext(options?.projectId);
    if (!orgId || projectIds.length === 0) return [];

    const { records } = await getEventsInTimeRange(
        {
            projectIds,
            limit: options?.limit ?? 100,
        },
        orgId
    );

    return records.filter((r) => r.requestId);
}
