import { prisma } from "../prisma";
import {
    getEventById,
    getEventsInTimeRange,
    getEventsByTraceId,
    getEventsByRequestId,
    getEventsBySessionId,
    type CanonicalQueryFilter,
} from "./canonical-evidence-access";
import type {
    CanonicalEvidenceRecord,
    EvidenceProvenance,
    RelationshipType,
    EvidenceState,
} from "./evidence-types";

export interface ParsedSearchQuery {
    raw: string;
    text: string;
    eventId?: string;
    traceId?: string;
    requestId?: string;
    sessionId?: string;
    service?: string;
    release?: string;
    errorType?: string;
}

export function parseSearchQuery(queryStr: string): ParsedSearchQuery {
    const raw = queryStr.trim();
    let text = raw;
    const result: ParsedSearchQuery = { raw, text: "" };

    const eventMatch = text.match(/\bevent:([^\s]+)/i);
    if (eventMatch) {
        result.eventId = eventMatch[1];
        text = text.replace(eventMatch[0], "");
    }

    const traceMatch = text.match(/\btrace:([^\s]+)/i);
    if (traceMatch) {
        result.traceId = traceMatch[1];
        text = text.replace(traceMatch[0], "");
    }

    const reqMatch = text.match(/\brequest:([^\s]+)/i);
    if (reqMatch) {
        result.requestId = reqMatch[1];
        text = text.replace(reqMatch[0], "");
    }

    const sessionMatch = text.match(/\bsession:([^\s]+)/i);
    if (sessionMatch) {
        result.sessionId = sessionMatch[1];
        text = text.replace(sessionMatch[0], "");
    }

    const serviceMatch = text.match(/\bservice:([^\s]+)/i);
    if (serviceMatch) {
        result.service = serviceMatch[1];
        text = text.replace(serviceMatch[0], "");
    }

    const releaseMatch = text.match(/\brelease:([^\s]+)/i);
    if (releaseMatch) {
        result.release = releaseMatch[1];
        text = text.replace(releaseMatch[0], "");
    }

    const errorMatch = text.match(/\berror:([^\s]+)/i);
    if (errorMatch) {
        result.errorType = errorMatch[1];
        text = text.replace(errorMatch[0], "");
    }

    result.text = text.trim();
    return result;
}

export interface CategorizedSearchResults {
    errors: CanonicalEvidenceRecord[];
    requests: CanonicalEvidenceRecord[];
    traces: CanonicalEvidenceRecord[];
    logs: CanonicalEvidenceRecord[];
    database: CanonicalEvidenceRecord[];
    sessions: Array<{
        id: string;
        projectId: string;
        userKey: string | null;
        release: string | null;
        startedAt: Date;
        lastSeenAt: Date;
        crashedAt: Date | null;
    }>;
    totalMatches: number;
}

export async function searchEvidenceCategories(
    orgId: string,
    rawQuery: string,
    timeRange?: { from: Date; to: Date },
    projectIds?: string[]
): Promise<CategorizedSearchResults> {
    const parsed = parseSearchQuery(rawQuery);

    // 1. Exact ID direct match check
    if (parsed.eventId) {
        const exact = await getEventById(parsed.eventId, orgId);
        if (exact) {
            return {
                errors: exact.type === "ERROR" ? [exact] : [],
                requests: exact.requestId ? [exact] : [],
                traces: exact.type === "TRACE" ? [exact] : [],
                logs: exact.type === "LOG" || exact.type === "MESSAGE" ? [exact] : [],
                database: [],
                sessions: [],
                totalMatches: 1,
            };
        }
    }

    const baseFilter: CanonicalQueryFilter = {
        projectIds,
        service: parsed.service,
        release: parsed.release,
        from: timeRange?.from,
        to: timeRange?.to,
        search: parsed.text || undefined,
    };

    // Query canonical sources
    const [errorRes, traceRes, logRes, allRes, sessions] = await Promise.all([
        getEventsInTimeRange({ ...baseFilter, types: ["ERROR"], limit: 12 }, orgId),
        getEventsInTimeRange({ ...baseFilter, types: ["TRACE"], limit: 12 }, orgId),
        getEventsInTimeRange({ ...baseFilter, types: ["LOG", "MESSAGE"], limit: 12 }, orgId),
        getEventsInTimeRange({ ...baseFilter, limit: 30 }, orgId),
        prisma.telemetrySession.findMany({
            where: {
                project: { organizationId: orgId },
                ...(parsed.sessionId
                    ? { id: parsed.sessionId }
                    : parsed.text
                    ? {
                          OR: [
                              { id: { contains: parsed.text, mode: "insensitive" } },
                              { userKey: { contains: parsed.text, mode: "insensitive" } },
                          ],
                      }
                    : {}),
                ...(timeRange ? { lastSeenAt: { gte: timeRange.from, lte: timeRange.to } } : {}),
            },
            take: 6,
            orderBy: { lastSeenAt: "desc" },
        }),
    ]);

    // Rank results by evidence strength (exact ID match > exact identifier match > token match)
    const rankRecord = (r: CanonicalEvidenceRecord): number => {
        if (parsed.eventId && r.id === parsed.eventId) return 100;
        if (parsed.traceId && r.traceId === parsed.traceId) return 90;
        if (parsed.requestId && r.requestId === parsed.requestId) return 90;
        if (parsed.sessionId && r.sessionId === parsed.sessionId) return 80;
        if (parsed.text && (r.title.toLowerCase() === parsed.text.toLowerCase())) return 70;
        return 50;
    };

    const sortByRank = (a: CanonicalEvidenceRecord, b: CanonicalEvidenceRecord) => rankRecord(b) - rankRecord(a);

    // Extract requests from all records
    const requestRecords = allRes.records
        .filter((r) => r.requestId)
        .sort(sortByRank)
        .slice(0, 10);

    // Extract database operations
    const databaseRecords = allRes.records
        .filter((r) => {
            const op = (r.operation || "").toLowerCase();
            const res = (r.resource || "").toLowerCase();
            const dbSys = r.metadata["db.system"] || r.tags["db.system"];
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
        })
        .slice(0, 8);

    const totalMatches =
        errorRes.records.length +
        requestRecords.length +
        traceRes.records.length +
        logRes.records.length +
        databaseRecords.length +
        sessions.length;

    return {
        errors: errorRes.records.sort(sortByRank),
        requests: requestRecords,
        traces: traceRes.records.sort(sortByRank),
        logs: logRes.records.sort(sortByRank),
        database: databaseRecords,
        sessions: sessions.map((s) => ({
            id: s.id,
            projectId: s.projectId,
            userKey: s.userKey,
            release: s.release,
            startedAt: s.startedAt,
            lastSeenAt: s.lastSeenAt,
            crashedAt: s.crashedAt,
        })),
        totalMatches,
    };
}

export interface NeedleEvidenceItem {
    record: CanonicalEvidenceRecord;
    isAnchor: boolean;
    offsetMs: number;
    relationshipType: RelationshipType;
    linkReason: string;
    executionCategory: "SELECTED_SIGNAL" | "DIRECTLY_LINKED" | "EXECUTION_CONTEXT" | "TEMPORAL_CONTEXT";
}

export interface TelemetryGap {
    fromEventId: string;
    toEventId: string;
    durationMs: number;
    description: string;
}

export interface EvidenceNeedleResult {
    anchor: CanonicalEvidenceRecord;
    items: NeedleEvidenceItem[];
    gaps: TelemetryGap[];
    windowSeconds: number;
    summary: {
        totalSurrounding: number;
        directTraceCount: number;
        directRequestCount: number;
        directSessionCount: number;
        temporalCount: number;
    };
}

/**
 * CONSTRUCT THE EVIDENCE NEEDLE
 * Follows strict priority order:
 * 1. Retrieve exact event
 * 2. Inspect traceId & fetch directly linked spans
 * 3. Inspect requestId & fetch directly linked request events
 * 4. Inspect sessionId & fetch session breadcrumbs
 * 5. Only then fetch bounded temporal context as fallback
 * 6. Detect gaps between contiguous execution steps
 */
export async function constructEvidenceNeedle(
    anchorEventId: string,
    orgId: string
): Promise<EvidenceNeedleResult | null> {
    const anchor = await getEventById(anchorEventId, orgId);
    if (!anchor) return null;

    const anchorTime = anchor.timestamp.getTime();

    // 1. Fetch direct trace members
    const traceEvents = anchor.traceId ? await getEventsByTraceId(anchor.traceId, orgId) : [];

    // 2. Fetch direct request members
    const requestEvents = anchor.requestId ? await getEventsByRequestId(anchor.requestId, orgId) : [];

    // 3. Fetch direct session members
    const sessionEvents = anchor.sessionId ? await getEventsBySessionId(anchor.sessionId, orgId) : [];

    // 4. Fetch bounded temporal context (±30s around anchor)
    const temporalRes = await getEventsInTimeRange(
        {
            projectIds: [anchor.projectId],
            from: new Date(anchorTime - 30 * 1000),
            to: new Date(anchorTime + 30 * 1000),
            limit: 40,
        },
        orgId
    );

    // Merge without duplicates
    const itemMap = new Map<string, CanonicalEvidenceRecord>();
    for (const te of traceEvents) itemMap.set(te.id, te);
    for (const re of requestEvents) itemMap.set(re.id, re);
    for (const se of sessionEvents) itemMap.set(se.id, se);
    for (const ce of temporalRes.records) {
        if (!itemMap.has(ce.id)) itemMap.set(ce.id, ce);
    }
    itemMap.set(anchor.id, anchor);

    const merged = Array.from(itemMap.values());
    merged.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    let directTraceCount = 0;
    let directRequestCount = 0;
    let directSessionCount = 0;
    let temporalCount = 0;

    const items: NeedleEvidenceItem[] = merged.map((rec) => {
        const isAnchor = rec.id === anchor.id;
        const offsetMs = rec.timestamp.getTime() - anchorTime;

        let relationshipType: RelationshipType = "NO_DIRECT_LINK";
        let linkReason = "Observed within surrounding temporal window";
        let executionCategory: NeedleEvidenceItem["executionCategory"] = "TEMPORAL_CONTEXT";

        if (isAnchor) {
            relationshipType = "DIRECT";
            linkReason = "Selected investigation signal anchor";
            executionCategory = "SELECTED_SIGNAL";
        } else if (anchor.traceId && rec.traceId && anchor.traceId === rec.traceId) {
            relationshipType = "TRACE_LINK";
            linkReason = `Linked by shared distributed trace (${rec.traceId})`;
            executionCategory = "DIRECTLY_LINKED";
            directTraceCount++;
        } else if (anchor.requestId && rec.requestId && anchor.requestId === rec.requestId) {
            relationshipType = "REQUEST_LINK";
            linkReason = `Linked by shared HTTP request (${rec.requestId})`;
            executionCategory = "DIRECTLY_LINKED";
            directRequestCount++;
        } else if (anchor.sessionId && rec.sessionId && anchor.sessionId === rec.sessionId) {
            relationshipType = "SESSION_LINK";
            linkReason = `Linked by shared client session (${rec.sessionId})`;
            executionCategory = "EXECUTION_CONTEXT";
            directSessionCount++;
        } else if (anchor.service && rec.service && anchor.service === rec.service) {
            relationshipType = "TEMPORAL_CONTEXT";
            linkReason = `Observed on same service (${rec.service}) within ${Math.abs(Math.round(offsetMs / 1000))}s`;
            executionCategory = "TEMPORAL_CONTEXT";
            temporalCount++;
        } else {
            relationshipType = "TEMPORAL_CONTEXT";
            linkReason = `Temporal proximity (${Math.abs(Math.round(offsetMs / 1000))}s offset) without shared identifiers`;
            executionCategory = "TEMPORAL_CONTEXT";
            temporalCount++;
        }

        return {
            record: rec,
            isAnchor,
            offsetMs,
            relationshipType,
            linkReason,
            executionCategory,
        };
    });

    // Detect execution gaps between contiguous directly-linked items (> 500ms)
    const gaps: TelemetryGap[] = [];
    for (let i = 0; i < items.length - 1; i++) {
        const current = items[i];
        const next = items[i + 1];
        const diffMs = next.record.timestamp.getTime() - current.record.timestamp.getTime();

        if (diffMs > 600 && (current.relationshipType === "TRACE_LINK" || current.relationshipType === "REQUEST_LINK")) {
            gaps.push({
                fromEventId: current.record.id,
                toEventId: next.record.id,
                durationMs: diffMs,
                description: `${diffMs}ms gap between observed execution steps`,
            });
        }
    }

    return {
        anchor,
        items,
        gaps,
        windowSeconds: 30,
        summary: {
            totalSurrounding: items.length - 1,
            directTraceCount,
            directRequestCount,
            directSessionCount,
            temporalCount,
        },
    };
}
