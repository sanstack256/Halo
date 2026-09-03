import { prisma } from "../prisma";
import {
    getEventsByRequestId,
    getEventsByTraceId,
} from "./canonical-evidence-access";
import type {
    CanonicalEvidenceRecord,
    AnalyticalResultProvenance,
} from "./evidence-types";

export interface ReconstructedIngress {
    timestamp: Date;
    method: string;
    url: string;
    host: string | null;
    headersCaptured: boolean;
    capturedHeaders: Record<string, string>;
    clientMetadata: {
        ip?: string;
        userAgent?: string;
        referer?: string;
    };
    bodyCaptured: boolean;
    bodySummary: string | null;
}

export interface ReconstructedProcessing {
    service: string;
    handler: string | null;
    durationMs: number | null;
    status: string | null;
    environment: string;
    release: string | null;
}

export interface OutboundExecutionCall {
    id: string;
    type: "HTTP" | "DATABASE" | "INTERNAL_SPAN";
    target: string;
    operation: string;
    durationMs: number | null;
    status: string | null;
    timestamp: Date;
}

export interface ReconstructedResponse {
    status: string | number;
    durationMs: number | null;
    bodyCaptured: boolean;
    bodySummary: string | null;
    headersCaptured: boolean;
    capturedHeaders: Record<string, string>;
}

export interface RequestExecutionGap {
    stageBefore: string;
    stageAfter: string;
    durationMs: number;
    description: string;
}

export interface RequestReconstruction {
    requestId: string;
    traceId: string | null;
    primaryEvent: CanonicalEvidenceRecord;
    ingress: ReconstructedIngress;
    processing: ReconstructedProcessing;
    outboundCalls: OutboundExecutionCall[];
    response: ReconstructedResponse;
    gaps: RequestExecutionGap[];
    comparableRequestId: string | null;
    provenance: AnalyticalResultProvenance;
}

export interface RequestDiffField {
    field: string;
    currentValue: string;
    referenceValue: string;
    isIdentical: boolean;
}

export interface RequestDiffResult {
    currentRequestId: string;
    referenceRequestId: string;
    diffs: RequestDiffField[];
}

export async function reconstructRequest(
    targetRequestId: string,
    orgId: string,
    comparableRequestIdInput?: string
): Promise<RequestReconstruction | null> {
    const events = await getEventsByRequestId(targetRequestId, orgId);
    if (events.length === 0) return null;

    // Sort strictly by real timestamp
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const primaryEvent =
        events.find(
            (e) =>
                e.operation?.toLowerCase().includes("http") ||
                e.resource?.startsWith("/") ||
                e.type === "TRACE"
        ) || events[0];

    const metadata = primaryEvent.metadata || {};
    const tags = primaryEvent.tags || {};

    // 1. INGRESS STAGE
    const method =
        (tags["http.method"] as string) ||
        (metadata["http.method"] as string) ||
        (metadata.method as string) ||
        "GET";

    const url =
        primaryEvent.resource ||
        (tags["http.url"] as string) ||
        (metadata["http.url"] as string) ||
        (metadata.url as string) ||
        "/";

    let host: string | null = null;
    try {
        if (url.startsWith("http")) host = new URL(url).host;
    } catch {
        // Fallback
    }

    const rawHeaders = (metadata.headers || tags.headers || {}) as Record<string, unknown>;
    const capturedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawHeaders)) {
        if (typeof v === "string") capturedHeaders[k] = v;
    }
    const headersCaptured = Object.keys(capturedHeaders).length > 0;

    const hasReqBody = Boolean(metadata.requestBody || metadata.body);
    const reqBodySummary = hasReqBody ? "Captured payload present in event metadata" : null;

    const ingress: ReconstructedIngress = {
        timestamp: primaryEvent.timestamp,
        method,
        url,
        host,
        headersCaptured,
        capturedHeaders,
        clientMetadata: {
            ip: (metadata.ip as string) || undefined,
            userAgent: (metadata.userAgent as string) || undefined,
            referer: (metadata.referer as string) || undefined,
        },
        bodyCaptured: hasReqBody,
        bodySummary: reqBodySummary,
    };

    // 2. PROCESSING STAGE
    const processing: ReconstructedProcessing = {
        service: primaryEvent.service || "web-service",
        handler: primaryEvent.operation,
        durationMs: primaryEvent.durationMs,
        status: primaryEvent.status || (primaryEvent.severity === "ERROR" ? "500" : "200"),
        environment: primaryEvent.environmentName,
        release: primaryEvent.release,
    };

    // 3. OUTBOUND STAGE (Child HTTP spans & DB spans)
    const outboundCalls: OutboundExecutionCall[] = [];
    for (const ev of events) {
        if (ev.id === primaryEvent.id) continue;

        const op = (ev.operation || "").toLowerCase();
        const res = (ev.resource || "").toLowerCase();
        const isDb =
            op.startsWith("db.") ||
            op.includes("query") ||
            res.startsWith("select ") ||
            res.startsWith("insert ");

        outboundCalls.push({
            id: ev.id,
            type: isDb ? "DATABASE" : ev.type === "TRACE" ? "HTTP" : "INTERNAL_SPAN",
            target: ev.service || "downstream",
            operation: ev.operation || ev.title,
            durationMs: ev.durationMs,
            status: ev.status || (ev.severity === "ERROR" ? "error" : "200"),
            timestamp: ev.timestamp,
        });
    }

    // 4. RESPONSE STAGE
    const hasResBody = Boolean(metadata.responseBody || metadata.response);
    const response: ReconstructedResponse = {
        status: primaryEvent.status || (primaryEvent.severity === "ERROR" ? "500" : "200"),
        durationMs: primaryEvent.durationMs,
        bodyCaptured: hasResBody,
        bodySummary: hasResBody ? "Captured response payload present in metadata" : null,
        headersCaptured: false,
        capturedHeaders: {},
    };

    // 5. DETECT EXECUTION GAPS
    const gaps: RequestExecutionGap[] = [];
    if (primaryEvent.durationMs && outboundCalls.length > 0) {
        const outboundTotalMs = outboundCalls.reduce((acc, c) => acc + (c.durationMs || 0), 0);
        const unattributed = Math.max(0, primaryEvent.durationMs - outboundTotalMs);
        if (unattributed > 100) {
            gaps.push({
                stageBefore: "Processing",
                stageAfter: "Response",
                durationMs: unattributed,
                description: `${unattributed}ms unattributed telemetry gap between measured execution spans`,
            });
        }
    }

    // Resolve comparable request
    let comparableRequestId = comparableRequestIdInput || null;
    if (!comparableRequestId) {
        const peer = await prisma.event.findFirst({
            where: {
                project: { organizationId: orgId },
                requestId: { not: targetRequestId },
                service: primaryEvent.service ?? undefined,
                severity: "INFO",
                AND: [{ requestId: { not: null } }],
            },
            orderBy: { timestamp: "desc" },
            select: { requestId: true },
        });
        comparableRequestId = peer?.requestId || null;
    }

    const provenance: AnalyticalResultProvenance = {
        basisEvidenceIds: events.map((e) => e.id),
        relationshipType: "REQUEST_LINK",
        derivationType: "Request Monotonic Lifecycle Reconstruction",
        evidenceState: "OBSERVED",
        summary: `Reconstructed request ${targetRequestId} across ${events.length} observed events and ${outboundCalls.length} outbound calls.`,
        canBeEstablished: [
            "HTTP ingress method, route, and measured response status.",
            "Child dependency and database execution order.",
            "Honest reporting of missing request/response bodies and headers.",
        ],
        cannotBeEstablished: [
            "Internal CPU time inside uninstrumented execution gaps.",
            "Uncaptured request or response body content.",
        ],
    };

    return {
        requestId: targetRequestId,
        traceId: primaryEvent.traceId,
        primaryEvent,
        ingress,
        processing,
        outboundCalls,
        response,
        gaps,
        comparableRequestId,
        provenance,
    };
}

export async function diffRequests(
    reqA: RequestReconstruction,
    reqBId: string,
    orgId: string
): Promise<RequestDiffResult | null> {
    const reqB = await reconstructRequest(reqBId, orgId);
    if (!reqB) return null;

    const diffs: RequestDiffField[] = [
        {
            field: "HTTP Method",
            currentValue: reqA.ingress.method,
            referenceValue: reqB.ingress.method,
            isIdentical: reqA.ingress.method === reqB.ingress.method,
        },
        {
            field: "Target Route",
            currentValue: reqA.ingress.url,
            referenceValue: reqB.ingress.url,
            isIdentical: reqA.ingress.url === reqB.ingress.url,
        },
        {
            field: "Response Status",
            currentValue: String(reqA.response.status),
            referenceValue: String(reqB.response.status),
            isIdentical: String(reqA.response.status) === String(reqB.response.status),
        },
        {
            field: "Total Duration",
            currentValue: reqA.processing.durationMs ? `${reqA.processing.durationMs}ms` : "Unmeasured",
            referenceValue: reqB.processing.durationMs ? `${reqB.processing.durationMs}ms` : "Unmeasured",
            isIdentical: reqA.processing.durationMs === reqB.processing.durationMs,
        },
        {
            field: "Outbound Calls Count",
            currentValue: String(reqA.outboundCalls.length),
            referenceValue: String(reqB.outboundCalls.length),
            isIdentical: reqA.outboundCalls.length === reqB.outboundCalls.length,
        },
        {
            field: "Deployment Release",
            currentValue: reqA.processing.release || "unspecified",
            referenceValue: reqB.processing.release || "unspecified",
            isIdentical: reqA.processing.release === reqB.processing.release,
        },
    ];

    return {
        currentRequestId: reqA.requestId,
        referenceRequestId: reqBId,
        diffs,
    };
}
