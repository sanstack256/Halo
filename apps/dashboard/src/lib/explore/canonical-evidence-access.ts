import { prisma } from "../prisma";
import type { Prisma } from "../../generated/prisma/client";
import type {
    CanonicalEvidenceRecord,
    EvidenceProvenance,
    RelationshipType,
} from "./evidence-types";

export interface CanonicalQueryFilter {
    projectIds?: string[];
    environmentId?: string;
    environmentName?: string;
    service?: string;
    release?: string;
    traceId?: string;
    requestId?: string;
    sessionId?: string;
    fingerprint?: string;
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
        // Safe fallback
    }
    return defaultValue;
}

function toCanonicalRecord(
    e: any,
    projectName: string = "Unknown",
    environmentName: string = "Unknown",
    provenance?: EvidenceProvenance
): CanonicalEvidenceRecord {
    return {
        id: e.id,
        type: e.type,
        severity: e.severity,
        title: e.title,
        message: e.message,
        timestamp: e.timestamp,
        projectId: e.projectId,
        projectName: e.project?.name || projectName,
        environmentId: e.environmentId,
        environmentName: e.environment?.name || environmentName,
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
        provenance,
    };
}

/**
 * Ensures queries never cross organization boundaries.
 */
async function getOrgProjectIds(orgId: string, requestedProjectIds?: string[]): Promise<string[]> {
    const projects = await prisma.project.findMany({
        where: {
            organizationId: orgId,
            ...(requestedProjectIds && requestedProjectIds.length > 0
                ? { id: { in: requestedProjectIds } }
                : {}),
        },
        select: { id: true },
    });
    return projects.map((p) => p.id);
}

export async function getEventById(
    eventId: string,
    orgId: string
): Promise<CanonicalEvidenceRecord | null> {
    const orgProjectIds = await getOrgProjectIds(orgId);
    if (orgProjectIds.length === 0) return null;

    const event = await prisma.event.findFirst({
        where: {
            id: eventId,
            projectId: { in: orgProjectIds },
        },
        include: {
            project: { select: { id: true, name: true } },
            environment: { select: { id: true, name: true } },
        },
    });

    if (!event) return null;
    return toCanonicalRecord(event);
}

export async function getEventsByIds(
    eventIds: string[],
    orgId: string
): Promise<CanonicalEvidenceRecord[]> {
    if (eventIds.length === 0) return [];
    const orgProjectIds = await getOrgProjectIds(orgId);
    if (orgProjectIds.length === 0) return [];

    const events = await prisma.event.findMany({
        where: {
            id: { in: eventIds },
            projectId: { in: orgProjectIds },
        },
        include: {
            project: { select: { id: true, name: true } },
            environment: { select: { id: true, name: true } },
        },
        orderBy: { timestamp: "asc" },
    });

    return events.map((e) => toCanonicalRecord(e));
}

export async function getEventsByTraceId(
    traceId: string,
    orgId: string,
    bounds?: { from?: Date; to?: Date; limit?: number }
): Promise<CanonicalEvidenceRecord[]> {
    const orgProjectIds = await getOrgProjectIds(orgId);
    if (orgProjectIds.length === 0) return [];

    const events = await prisma.event.findMany({
        where: {
            traceId,
            projectId: { in: orgProjectIds },
            ...(bounds?.from || bounds?.to
                ? {
                      timestamp: {
                          gte: bounds.from,
                          lte: bounds.to,
                      },
                  }
                : {}),
        },
        include: {
            project: { select: { id: true, name: true } },
            environment: { select: { id: true, name: true } },
        },
        orderBy: { timestamp: "asc" },
        take: Math.min(bounds?.limit ?? 150, 200),
    });

    return events.map((e) =>
        toCanonicalRecord(e, undefined, undefined, {
            sourceEventIds: [e.id],
            sourceSpanIds: [e.id],
            sourceRequestIds: e.requestId ? [e.requestId] : [],
            sourceTraceIds: [traceId],
            relationshipType: "TRACE_LINK",
            derivationType: "Trace Member",
            evidenceState: "OBSERVED",
            description: `Direct distributed trace member for trace ${traceId}`,
        })
    );
}

export async function getEventsByRequestId(
    requestId: string,
    orgId: string,
    bounds?: { from?: Date; to?: Date; limit?: number }
): Promise<CanonicalEvidenceRecord[]> {
    const orgProjectIds = await getOrgProjectIds(orgId);
    if (orgProjectIds.length === 0) return [];

    const events = await prisma.event.findMany({
        where: {
            requestId,
            projectId: { in: orgProjectIds },
            ...(bounds?.from || bounds?.to
                ? {
                      timestamp: {
                          gte: bounds.from,
                          lte: bounds.to,
                      },
                  }
                : {}),
        },
        include: {
            project: { select: { id: true, name: true } },
            environment: { select: { id: true, name: true } },
        },
        orderBy: { timestamp: "asc" },
        take: Math.min(bounds?.limit ?? 100, 200),
    });

    return events.map((e) =>
        toCanonicalRecord(e, undefined, undefined, {
            sourceEventIds: [e.id],
            sourceSpanIds: [e.id],
            sourceRequestIds: [requestId],
            sourceTraceIds: e.traceId ? [e.traceId] : [],
            relationshipType: "REQUEST_LINK",
            derivationType: "Request Execution Step",
            evidenceState: "OBSERVED",
            description: `Correlated request event for request ${requestId}`,
        })
    );
}

export async function getEventsBySessionId(
    sessionId: string,
    orgId: string,
    bounds?: { limit?: number }
): Promise<CanonicalEvidenceRecord[]> {
    const orgProjectIds = await getOrgProjectIds(orgId);
    if (orgProjectIds.length === 0) return [];

    const events = await prisma.event.findMany({
        where: {
            sessionId,
            projectId: { in: orgProjectIds },
        },
        include: {
            project: { select: { id: true, name: true } },
            environment: { select: { id: true, name: true } },
        },
        orderBy: { timestamp: "asc" },
        take: Math.min(bounds?.limit ?? 100, 200),
    });

    return events.map((e) =>
        toCanonicalRecord(e, undefined, undefined, {
            sourceEventIds: [e.id],
            sourceSpanIds: [e.id],
            sourceRequestIds: e.requestId ? [e.requestId] : [],
            sourceTraceIds: e.traceId ? [e.traceId] : [],
            relationshipType: "SESSION_LINK",
            derivationType: "Session Breadcrumb",
            evidenceState: "OBSERVED",
            description: `Correlated client session event for session ${sessionId}`,
        })
    );
}

export async function getEventsInTimeRange(
    filter: CanonicalQueryFilter,
    orgId: string
): Promise<{ records: CanonicalEvidenceRecord[]; totalCount: number }> {
    const orgProjectIds = await getOrgProjectIds(orgId, filter.projectIds);
    if (orgProjectIds.length === 0) return { records: [], totalCount: 0 };

    const where: Prisma.EventWhereInput = {
        projectId: { in: orgProjectIds },
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
    if (filter.fingerprint) {
        where.fingerprint = filter.fingerprint;
    }
    if (filter.environmentId) {
        where.environmentId = filter.environmentId;
    } else if (filter.environmentName) {
        where.environment = { name: { equals: filter.environmentName, mode: "insensitive" } };
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
            { fingerprint: { contains: query, mode: "insensitive" } },
        ];
    }

    const [events, count] = await Promise.all([
        prisma.event.findMany({
            where,
            include: {
                project: { select: { id: true, name: true } },
                environment: { select: { id: true, name: true } },
            },
            orderBy: { timestamp: "desc" },
            take: Math.min(filter.limit ?? 100, 200),
            skip: filter.offset ?? 0,
        }),
        prisma.event.count({ where }),
    ]);

    return {
        records: events.map((e) => toCanonicalRecord(e)),
        totalCount: count,
    };
}

export async function getTraceSpans(
    traceId: string,
    orgId: string
): Promise<CanonicalEvidenceRecord[]> {
    return getEventsByTraceId(traceId, orgId);
}

export async function getRequestEvidence(
    requestId: string,
    orgId: string
): Promise<CanonicalEvidenceRecord[]> {
    return getEventsByRequestId(requestId, orgId);
}

export async function getDatabaseSpans(
    filter: CanonicalQueryFilter,
    orgId: string
): Promise<CanonicalEvidenceRecord[]> {
    const orgProjectIds = await getOrgProjectIds(orgId, filter.projectIds);
    if (orgProjectIds.length === 0) return [];

    const events = await prisma.event.findMany({
        where: {
            projectId: { in: orgProjectIds },
            type: "TRACE",
            service: filter.service ?? undefined,
            ...(filter.from || filter.to
                ? {
                      timestamp: {
                          gte: filter.from,
                          lte: filter.to,
                      },
                  }
                : {}),
        },
        include: {
            project: { select: { id: true, name: true } },
            environment: { select: { id: true, name: true } },
        },
        orderBy: { timestamp: "desc" },
        take: Math.min(filter.limit ?? 100, 200),
    });

    // Filter strictly to database operations (where operation starts with db., or SQL statement present)
    return events
        .map((e) => toCanonicalRecord(e))
        .filter((rec) => {
            const op = (rec.operation || "").toLowerCase();
            const res = (rec.resource || "").toLowerCase();
            const dbSys = rec.metadata["db.system"] || rec.tags["db.system"];
            return (
                op.startsWith("db.") ||
                op.includes("query") ||
                op.includes("sql") ||
                res.startsWith("select ") ||
                res.startsWith("insert ") ||
                res.startsWith("update ") ||
                res.startsWith("delete ") ||
                Boolean(dbSys)
            );
        });
}

/**
 * BATCH RELATIONSHIP FETCHER (ZERO N+1)
 * Given a list of events, collects all traceIds, requestIds, and sessionIds,
 * and fetches all related spans in bounded batch queries.
 */
export async function batchFetchLinkedEvidence(
    records: CanonicalEvidenceRecord[],
    orgId: string
): Promise<{
    traceMap: Map<string, CanonicalEvidenceRecord[]>;
    requestMap: Map<string, CanonicalEvidenceRecord[]>;
    sessionMap: Map<string, CanonicalEvidenceRecord[]>;
}> {
    const traceIds = Array.from(new Set(records.map((r) => r.traceId).filter((t): t is string => Boolean(t))));
    const requestIds = Array.from(new Set(records.map((r) => r.requestId).filter((r): r is string => Boolean(r))));
    const sessionIds = Array.from(new Set(records.map((r) => r.sessionId).filter((s): s is string => Boolean(s))));

    const orgProjectIds = await getOrgProjectIds(orgId);
    if (orgProjectIds.length === 0) {
        return { traceMap: new Map(), requestMap: new Map(), sessionMap: new Map() };
    }

    const [traceEvents, requestEvents, sessionEvents] = await Promise.all([
        traceIds.length > 0
            ? prisma.event.findMany({
                  where: { traceId: { in: traceIds }, projectId: { in: orgProjectIds } },
                  include: {
                      project: { select: { id: true, name: true } },
                      environment: { select: { id: true, name: true } },
                  },
                  orderBy: { timestamp: "asc" },
                  take: 300,
              })
            : Promise.resolve([]),
        requestIds.length > 0
            ? prisma.event.findMany({
                  where: { requestId: { in: requestIds }, projectId: { in: orgProjectIds } },
                  include: {
                      project: { select: { id: true, name: true } },
                      environment: { select: { id: true, name: true } },
                  },
                  orderBy: { timestamp: "asc" },
                  take: 300,
              })
            : Promise.resolve([]),
        sessionIds.length > 0
            ? prisma.event.findMany({
                  where: { sessionId: { in: sessionIds }, projectId: { in: orgProjectIds } },
                  include: {
                      project: { select: { id: true, name: true } },
                      environment: { select: { id: true, name: true } },
                  },
                  orderBy: { timestamp: "asc" },
                  take: 200,
              })
            : Promise.resolve([]),
    ]);

    const traceMap = new Map<string, CanonicalEvidenceRecord[]>();
    for (const te of traceEvents) {
        if (!te.traceId) continue;
        const list = traceMap.get(te.traceId) || [];
        list.push(toCanonicalRecord(te));
        traceMap.set(te.traceId, list);
    }

    const requestMap = new Map<string, CanonicalEvidenceRecord[]>();
    for (const re of requestEvents) {
        if (!re.requestId) continue;
        const list = requestMap.get(re.requestId) || [];
        list.push(toCanonicalRecord(re));
        requestMap.set(re.requestId, list);
    }

    const sessionMap = new Map<string, CanonicalEvidenceRecord[]>();
    for (const se of sessionEvents) {
        if (!se.sessionId) continue;
        const list = sessionMap.get(se.sessionId) || [];
        list.push(toCanonicalRecord(se));
        sessionMap.set(se.sessionId, list);
    }

    return { traceMap, requestMap, sessionMap };
}
