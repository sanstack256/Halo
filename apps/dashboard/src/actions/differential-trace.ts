"use server";

import { prisma } from "@/lib/prisma";
import { requireProjectAccess, requireCapability, AuthorizationError } from "@/lib/authorization";

export type TraceSpanSummary = {
    id: string;
    operation: string;
    service: string;
    durationMs: number | null;
    status: string | null;
    tags: Record<string, any>;
    metadata: Record<string, any>;
    timestamp: Date;
    breadcrumbsCount: number;
};

export type DivergentTag = {
    key: string;
    failingValue: any;
    baselineCommonValue: any;
    significance: "HIGH" | "MEDIUM" | "LOW";
};

export type DifferentialTraceAnalysis = {
    hasBaseline: boolean;
    baselineCount: number;
    operation: string;
    service: string;
    failingTrace: TraceSpanSummary;
    baselineAverageDurationMs: number | null;
    durationDeltaMs: number | null;
    durationMultiplier: number | null;
    divergentTags: DivergentTag[];
    structuralAnomalies: string[];
    uncertainty: "NONE" | "LOW" | "HIGH";
    evidenceNotes: string[];
};

export async function computeDifferentialTrace(
    projectId: string,
    failingEventId: string,
    providedUserId?: string
): Promise<DifferentialTraceAnalysis> {
    // 1. Authoritative Phase 1 check: Authenticate and verify user belongs to project organization
    const { organization } = await requireProjectAccess(projectId, providedUserId);

    // 2. Authoritative Phase 1 check: Verify organization has Team capability
    await requireCapability(organization.id, "TEAM_DIFFERENTIAL_ANALYSIS");

    // 3. Fetch the failing event
    const failingEvent = await prisma.event.findUnique({
        where: { id: failingEventId },
    });

    if (!failingEvent || failingEvent.projectId !== projectId) {
        throw new AuthorizationError(
            "FORBIDDEN",
            "Event not found or does not belong to this project"
        );
    }

    const operation = failingEvent.operation || failingEvent.title || "unknown-operation";
    const service = failingEvent.service || "unknown-service";
    const breadcrumbs = Array.isArray(failingEvent.breadcrumbs) ? failingEvent.breadcrumbs : [];

    // Sanitize metadata & tags
    const failingTags = (failingEvent.tags as Record<string, any>) || {};
    const failingMetadata = (failingEvent.metadata as Record<string, any>) || {};

    const failingSummary: TraceSpanSummary = {
        id: failingEvent.id,
        operation,
        service,
        durationMs: failingEvent.durationMs,
        status: failingEvent.status,
        tags: failingTags,
        metadata: failingMetadata,
        timestamp: failingEvent.timestamp,
        breadcrumbsCount: breadcrumbs.length,
    };

    const evidenceNotes: string[] = [];
    evidenceNotes.push(`Analyzed failing execution for ${service}::${operation} (ID: ${failingEvent.id}).`);

    // 4. Query successful baseline runs for the same service and operation in the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const baselineEvents = await prisma.event.findMany({
        where: {
            projectId,
            operation,
            service,
            type: { in: ["TRACE", "LOG"] },
            severity: "INFO",
            timestamp: { gte: sevenDaysAgo },
            NOT: { id: failingEvent.id },
            OR: [
                { status: "200" },
                { status: "ok" },
                { status: "OK" },
                { status: "success" },
                { status: null },
            ],
        },
        take: 30,
        orderBy: { timestamp: "desc" },
    });

    // Zero-hallucination check: if no baselines exist, report honest uncertainty
    if (baselineEvents.length === 0) {
        evidenceNotes.push(
            `No successful baseline traces found for ${service}::${operation} in the last 7 days.`
        );
        return {
            hasBaseline: false,
            baselineCount: 0,
            operation,
            service,
            failingTrace: failingSummary,
            baselineAverageDurationMs: null,
            durationDeltaMs: null,
            durationMultiplier: null,
            divergentTags: [],
            structuralAnomalies: [
                "Baseline unavailable: Cannot compute differential metrics without successful comparison runs in the last 7 days."
            ],
            uncertainty: "HIGH",
            evidenceNotes,
        };
    }

    evidenceNotes.push(`Retrieved ${baselineEvents.length} successful baseline traces for comparison.`);

    // Compute baseline latency
    const validBaselineDurations = baselineEvents
        .map((e) => e.durationMs)
        .filter((d): d is number => d !== null && d !== undefined && d >= 0);

    let baselineAvgDuration: number | null = null;
    let durationDelta: number | null = null;
    let durationMultiplier: number | null = null;

    if (validBaselineDurations.length > 0 && failingEvent.durationMs !== null && failingEvent.durationMs !== undefined) {
        baselineAvgDuration = Math.round(
            validBaselineDurations.reduce((a, b) => a + b, 0) / validBaselineDurations.length
        );
        durationDelta = failingEvent.durationMs - baselineAvgDuration;
        durationMultiplier = baselineAvgDuration > 0
            ? Math.round((failingEvent.durationMs / baselineAvgDuration) * 10) / 10
            : null;
    }

    // Identify divergent tags / parameters
    const divergentTags: DivergentTag[] = [];
    const baselineTagCounts: Record<string, Record<string, number>> = {};

    for (const b of baselineEvents) {
        const bTags = (b.tags as Record<string, any>) || {};
        for (const [k, v] of Object.entries(bTags)) {
            if (!baselineTagCounts[k]) baselineTagCounts[k] = {};
            const strVal = String(v);
            baselineTagCounts[k][strVal] = (baselineTagCounts[k][strVal] || 0) + 1;
        }
    }

    for (const [k, v] of Object.entries(failingTags)) {
        const strVal = String(v);
        const baselineDistribution = baselineTagCounts[k];
        if (!baselineDistribution) {
            divergentTags.push({
                key: k,
                failingValue: v,
                baselineCommonValue: "(not present in baseline)",
                significance: "MEDIUM",
            });
        } else if (!baselineDistribution[strVal]) {
            // Find most common baseline value
            const mostCommon = Object.entries(baselineDistribution).sort((a, b) => b[1] - a[1])[0][0];
            divergentTags.push({
                key: k,
                failingValue: v,
                baselineCommonValue: mostCommon,
                significance: "HIGH",
            });
        }
    }

    const structuralAnomalies: string[] = [];
    if (durationMultiplier && durationMultiplier > 3) {
        structuralAnomalies.push(
            `Extreme latency divergence: execution took ${durationMultiplier}x longer than baseline average (${failingEvent.durationMs}ms vs ${baselineAvgDuration}ms).`
        );
    }

    if (breadcrumbs.length > 0) {
        structuralAnomalies.push(`Execution path halted after ${breadcrumbs.length} breadcrumb events.`);
    }

    return {
        hasBaseline: true,
        baselineCount: baselineEvents.length,
        operation,
        service,
        failingTrace: failingSummary,
        baselineAverageDurationMs: baselineAvgDuration,
        durationDeltaMs: durationDelta,
        durationMultiplier,
        divergentTags,
        structuralAnomalies,
        uncertainty: validBaselineDurations.length < 3 ? "LOW" : "NONE",
        evidenceNotes,
    };
}
