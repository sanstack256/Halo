import { prisma } from "../prisma";
import type { Prisma } from "../../generated/prisma/client";

export type LinkageType =
    | "TRACE_LINK"
    | "REQUEST_LINK"
    | "SESSION_LINK"
    | "TEMPORAL_CONTEXT"
    | "NO_DIRECT_LINK";

export interface CanonicalExploreRecord {
    id: string;
    type: "ERROR" | "LOG" | "MESSAGE" | "TRACE";
    severity: "INFO" | "WARNING" | "ERROR" | "FATAL";
    title: string;
    message: string | null;
    timestamp: Date;
    projectId: string;
    projectName: string;
    environmentId: string;
    environmentName: string;
    service: string | null;
    release: string | null;
    operation: string | null;
    resource: string | null;
    status: string | null;
    durationMs: number | null;
    traceId: string | null;
    requestId: string | null;
    sessionId: string | null;
    issueId: string | null;
    fingerprint: string | null;
    stack: string | null;
    metadata: Record<string, unknown>;
    tags: Record<string, string>;
    breadcrumbs: Array<Record<string, unknown>>;
    user: Record<string, unknown> | null;
    sdkName: string | null;
    sdkVersion: string | null;
}

export interface ExploreQueryFilter {
    projectIds: string[];
    environment?: string;
    service?: string;
    release?: string;
    traceId?: string;
    requestId?: string;
    sessionId?: string;
    issueId?: string;
    types?: Array<"ERROR" | "LOG" | "MESSAGE" | "TRACE">;
    severities?: Array<"INFO" | "WARNING" | "ERROR" | "FATAL">;
    from?: Date;
    to?: Date;
    search?: string;
    limit?: number;
    offset?: number;
}

function parseJsonField<T>(field: unknown, defaultValue: T): T {
    if (!field) return defaultValue;
    if (typeof field === "object") return field as T;
    try {
        if (typeof field === "string") return JSON.parse(field) as T;
    } catch {
        // Return default on parse failure
    }
    return defaultValue;
}

export function parseTimeRange(rangeKey: string = "24h"): { from: Date; to: Date } {
    const to = new Date();
    const from = new Date();
    switch (rangeKey) {
        case "15m":
            from.setMinutes(from.getMinutes() - 15);
            break;
        case "1h":
            from.setHours(from.getHours() - 1);
            break;
        case "6h":
            from.setHours(from.getHours() - 6);
            break;
        case "24h":
            from.setHours(from.getHours() - 24);
            break;
        case "7d":
            from.setDate(from.getDate() - 7);
            break;
        case "30d":
            from.setDate(from.getDate() - 30);
            break;
        default:
            from.setHours(from.getHours() - 24);
    }
    return { from, to };
}

export async function fetchCanonicalEvents(
    filter: ExploreQueryFilter
): Promise<{ records: CanonicalExploreRecord[]; totalCount: number }> {
    if (filter.projectIds.length === 0) {
        return { records: [], totalCount: 0 };
    }

    const where: Prisma.EventWhereInput = {
        projectId: { in: filter.projectIds },
    };

    if (filter.types && filter.types.length > 0) {
        where.type = { in: filter.types };
    }

    if (filter.severities && filter.severities.length > 0) {
        where.severity = { in: filter.severities };
    }

    if (filter.service) {
        where.service = filter.service;
    }

    if (filter.release) {
        where.release = filter.release;
    }

    if (filter.traceId) {
        where.traceId = filter.traceId;
    }

    if (filter.requestId) {
        where.requestId = filter.requestId;
    }

    if (filter.sessionId) {
        where.sessionId = filter.sessionId;
    }

    if (filter.issueId) {
        where.issueId = filter.issueId;
    }

    if (filter.from || filter.to) {
        where.timestamp = {};
        if (filter.from) where.timestamp.gte = filter.from;
        if (filter.to) where.timestamp.lte = filter.to;
    }

    if (filter.search && filter.search.trim()) {
        const query = filter.search.trim();
        where.OR = [
            { title: { contains: query, mode: "insensitive" } },
            { message: { contains: query, mode: "insensitive" } },
            { operation: { contains: query, mode: "insensitive" } },
            { resource: { contains: query, mode: "insensitive" } },
            { service: { contains: query, mode: "insensitive" } },
            { traceId: { contains: query, mode: "insensitive" } },
            { requestId: { contains: query, mode: "insensitive" } },
        ];
    }

    const [events, count, projects, environments] = await Promise.all([
        prisma.event.findMany({
            where,
            orderBy: { timestamp: "desc" },
            take: Math.min(filter.limit ?? 100, 200),
            skip: filter.offset ?? 0,
        }),
        prisma.event.count({ where }),
        prisma.project.findMany({
            where: { id: { in: filter.projectIds } },
            select: { id: true, name: true },
        }),
        prisma.environment.findMany({
            where: { projectId: { in: filter.projectIds } },
            select: { id: true, name: true },
        }),
    ]);

    const projectMap = new Map(projects.map((p) => [p.id, p.name]));
    const envMap = new Map(environments.map((e) => [e.id, e.name]));

    const records: CanonicalExploreRecord[] = events.map((e) => ({
        id: e.id,
        type: e.type,
        severity: e.severity,
        title: e.title,
        message: e.message,
        timestamp: e.timestamp,
        projectId: e.projectId,
        projectName: projectMap.get(e.projectId) ?? "Unknown",
        environmentId: e.environmentId,
        environmentName: envMap.get(e.environmentId) ?? "Unknown",
        service: e.service,
        release: e.release,
        operation: e.operation,
        resource: e.resource,
        status: e.status,
        durationMs: e.durationMs,
        traceId: e.traceId,
        requestId: e.requestId,
        sessionId: e.sessionId,
        issueId: e.issueId,
        fingerprint: e.fingerprint,
        stack: e.stack,
        metadata: parseJsonField<Record<string, unknown>>(e.metadata, {}),
        tags: parseJsonField<Record<string, string>>(e.tags, {}),
        breadcrumbs: parseJsonField<Array<Record<string, unknown>>>(e.breadcrumbs, []),
        user: parseJsonField<Record<string, unknown> | null>(e.user, null),
        sdkName: e.sdkName,
        sdkVersion: e.sdkVersion,
    }));

    return { records, totalCount: count };
}

export async function fetchEventById(
    eventId: string,
    projectIds: string[]
): Promise<CanonicalExploreRecord | null> {
    const event = await prisma.event.findFirst({
        where: {
            id: eventId,
            projectId: { in: projectIds },
        },
        include: {
            project: { select: { id: true, name: true } },
            environment: { select: { id: true, name: true } },
        },
    });

    if (!event) return null;

    return {
        id: event.id,
        type: event.type,
        severity: event.severity,
        title: event.title,
        message: event.message,
        timestamp: event.timestamp,
        projectId: event.projectId,
        projectName: event.project.name,
        environmentId: event.environmentId,
        environmentName: event.environment.name,
        service: event.service,
        release: event.release,
        operation: event.operation,
        resource: event.resource,
        status: event.status,
        durationMs: event.durationMs,
        traceId: event.traceId,
        requestId: event.requestId,
        sessionId: event.sessionId,
        issueId: event.issueId,
        fingerprint: event.fingerprint,
        stack: event.stack,
        metadata: parseJsonField<Record<string, unknown>>(event.metadata, {}),
        tags: parseJsonField<Record<string, string>>(event.tags, {}),
        breadcrumbs: parseJsonField<Array<Record<string, unknown>>>(event.breadcrumbs, []),
        user: parseJsonField<Record<string, unknown> | null>(event.user, null),
        sdkName: event.sdkName,
        sdkVersion: event.sdkVersion,
    };
}
