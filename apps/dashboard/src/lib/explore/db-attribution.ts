import { prisma } from "../prisma";
import {
    getEventsByRequestId,
    getEventsByTraceId,
    getEventsInTimeRange,
    getDatabaseSpans,
    type CanonicalQueryFilter,
} from "./canonical-evidence-access";
import {
    assessDatabaseWaitSufficiency,
    type EvidenceSufficiencyVerdict,
} from "./evidence-sufficiency";
import type {
    CanonicalEvidenceRecord,
    AnalyticalResultProvenance,
} from "./evidence-types";

export type WaitCategory = "query execution" | "connection acquisition" | "transaction" | "lock/wait";

export interface DatabaseQueryRecord {
    id: string;
    statement: string;
    durationMs: number;
    databaseSystem: string;
    waitCategory: WaitCategory;
    status: string;
    operation: string;
    timestamp: Date;
    parentSpanId: string | null;
}

export interface DatabaseWaitAttributionResult {
    targetRequestId: string | null;
    traceId: string | null;
    service: string;
    requestDurationMs: number | null;
    totalDbWaitMs: number;
    dbWaitPercentage: number | null;
    appProcessingMs: number | null;
    unattributedMs: number | null;
    telemetryObserved: boolean;
    queries: DatabaseQueryRecord[];
    categoryBreakdown: Record<WaitCategory, number>;
    slowVsFastComparison: {
        referenceRequestId: string;
        targetQueryCount: number;
        referenceQueryCount: number;
        targetDbDurationMs: number;
        referenceDbDurationMs: number;
        queryDiffExplanation: string;
    } | null;
    sufficiency: EvidenceSufficiencyVerdict;
    provenance: AnalyticalResultProvenance;
}

export async function computeDatabaseWaitAttribution(
    requestId: string | undefined,
    orgId: string,
    filter?: CanonicalQueryFilter
): Promise<DatabaseWaitAttributionResult> {
    let targetEvents: CanonicalEvidenceRecord[] = [];
    if (requestId) {
        targetEvents = await getEventsByRequestId(requestId, orgId);
    }

    if (targetEvents.length === 0) {
        const dbEvents = await getDatabaseSpans(filter || {}, orgId);
        if (dbEvents.length > 0 && dbEvents[0].requestId) {
            targetEvents = await getEventsByRequestId(dbEvents[0].requestId, orgId);
        } else if (dbEvents.length > 0) {
            targetEvents = [dbEvents[0]];
        }
    }

    const primaryEvent = targetEvents.find(
        (e) =>
            e.operation?.toLowerCase().includes("http") ||
            e.resource?.startsWith("/") ||
            e.type === "TRACE"
    ) || targetEvents[0] || null;

    const reqId = primaryEvent?.requestId || requestId || null;
    const traceId = primaryEvent?.traceId || null;
    const service = primaryEvent?.service || "application";
    const requestDurationMs = primaryEvent?.durationMs ?? null;

    // Filter database spans
    const dbSpans = targetEvents.filter((rec) => {
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

    const telemetryObserved = dbSpans.length > 0;
    const totalDbWaitMs = dbSpans.reduce((sum, s) => sum + (s.durationMs || 0), 0);

    const categoryBreakdown: Record<WaitCategory, number> = {
        "query execution": 0,
        "connection acquisition": 0,
        transaction: 0,
        "lock/wait": 0,
    };

    const queries: DatabaseQueryRecord[] = dbSpans.map((span) => {
        const duration = span.durationMs || 0;
        const rawOp = (span.operation || span.title).toLowerCase();
        const statement = span.resource || (span.metadata.statement as string) || span.title;

        let waitCategory: WaitCategory = "query execution";
        if (rawOp.includes("connect") || rawOp.includes("pool")) {
            waitCategory = "connection acquisition";
        } else if (rawOp.includes("transaction") || rawOp.includes("commit")) {
            waitCategory = "transaction";
        } else if (rawOp.includes("lock") || rawOp.includes("wait")) {
            waitCategory = "lock/wait";
        }

        categoryBreakdown[waitCategory] += duration;

        const dbSystem =
            (span.metadata["db.system"] as string) ||
            (span.tags["db.system"] as string) ||
            "PostgreSQL";

        return {
            id: span.id,
            statement,
            durationMs: duration,
            databaseSystem: dbSystem,
            waitCategory,
            status: span.status || (span.severity === "ERROR" ? "error" : "success"),
            operation: span.operation || "query",
            timestamp: span.timestamp,
            parentSpanId: (span.metadata.parentSpanId as string) || null,
        };
    });

    // Partition elapsed request time
    let dbWaitPercentage: number | null = null;
    let appProcessingMs: number | null = null;
    let unattributedMs: number | null = null;

    if (requestDurationMs !== null && telemetryObserved) {
        dbWaitPercentage = requestDurationMs > 0 ? Math.round((totalDbWaitMs / requestDurationMs) * 100) : 0;
        appProcessingMs = Math.max(0, requestDurationMs - totalDbWaitMs);
        unattributedMs = Math.max(0, requestDurationMs - totalDbWaitMs - (appProcessingMs > 0 ? appProcessingMs : 0));
    }

    // Slow vs fast real comparator
    let slowVsFastComparison: DatabaseWaitAttributionResult["slowVsFastComparison"] = null;
    if (reqId) {
        const peer = await prisma.event.findFirst({
            where: {
                project: { organizationId: orgId },
                requestId: { not: reqId },
                service,
                severity: "INFO",
                AND: [{ requestId: { not: null } }],
            },
            orderBy: { durationMs: "asc" },
            select: { requestId: true, durationMs: true },
        });

        if (peer && peer.requestId) {
            const peerEvents = await getEventsByRequestId(peer.requestId, orgId);
            const peerDb = peerEvents.filter((e) => (e.operation || "").toLowerCase().startsWith("db."));
            const peerDbMs = peerDb.reduce((s, e) => s + (e.durationMs || 0), 0);

            slowVsFastComparison = {
                referenceRequestId: peer.requestId,
                targetQueryCount: queries.length,
                referenceQueryCount: peerDb.length,
                targetDbDurationMs: totalDbWaitMs,
                referenceDbDurationMs: peerDbMs,
                queryDiffExplanation:
                    queries.length > peerDb.length
                        ? `Target executed ${queries.length} database operations vs ${peerDb.length} in reference request.`
                        : `Target executed ${queries.length} database operations comparable to reference (${peerDb.length}).`,
            };
        }
    }

    const sufficiency = assessDatabaseWaitSufficiency({
        hasRequestSpan: requestDurationMs !== null,
        hasDatabaseSpans: telemetryObserved,
        dbSpanCount: queries.length,
        requestDurationMs,
        totalDbDurationMs: totalDbWaitMs,
        evidenceIds: targetEvents.map((e) => e.id),
    });

    const provenance: AnalyticalResultProvenance = {
        basisEvidenceIds: targetEvents.map((e) => e.id),
        relationshipType: "REQUEST_LINK",
        derivationType: "Database Span Attribution",
        evidenceState: telemetryObserved ? "OBSERVED" : "NOT_CAPTURED",
        summary: telemetryObserved
            ? `Measured ${queries.length} database operation(s) totaling ${totalDbWaitMs}ms wait duration.`
            : "No database telemetry observed for this execution context. Database wait duration is unobserved.",
        canBeEstablished: sufficiency.whatCanBeEstablished,
        cannotBeEstablished: sufficiency.whatCannotBeEstablished,
    };

    return {
        targetRequestId: reqId,
        traceId,
        service,
        requestDurationMs,
        totalDbWaitMs,
        dbWaitPercentage,
        appProcessingMs,
        unattributedMs,
        telemetryObserved,
        queries,
        categoryBreakdown,
        slowVsFastComparison,
        sufficiency,
        provenance,
    };
}
