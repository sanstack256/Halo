import { prisma } from "../prisma";
import {
    getEventsByTraceId,
    getEventsInTimeRange,
} from "./canonical-evidence-access";
import {
    assessTraceComparisonSufficiency,
    type EvidenceSufficiencyVerdict,
} from "./evidence-sufficiency";
import type {
    CanonicalEvidenceRecord,
    AnalyticalResultProvenance,
} from "./evidence-types";

export type DivergenceType =
    | "MISSING_SPAN"
    | "ADDITIONAL_SPAN"
    | "OPERATION_MISMATCH"
    | "STATUS_DIVERGENCE"
    | "DURATION_REGRESSION"
    | "ERROR_OCCURRED"
    | "DATABASE_DIVERGENCE"
    | "NONE";

export interface AlignedTraceNode {
    index: number;
    operation: string;
    spanA: CanonicalEvidenceRecord | null;
    spanB: CanonicalEvidenceRecord | null;
    isFirstDivergence: boolean;
    divergenceType: DivergenceType;
    divergenceExplanation: string | null;
    basisEvidenceIds: string[];
}

export type ReferenceQuality = "Strong" | "Moderate" | "Limited" | "Unavailable";

export interface TraceDivergenceResult {
    selectedTraceId: string;
    referenceTraceId: string | null;
    service: string;
    operation: string;
    referenceQuality: ReferenceQuality;
    referenceQualityReasons: string[];
    traceA: {
        id: string;
        spans: CanonicalEvidenceRecord[];
        totalDurationMs: number;
        hasError: boolean;
        environment: string;
        release: string | null;
    };
    traceB: {
        id: string;
        spans: CanonicalEvidenceRecord[];
        totalDurationMs: number;
        hasError: boolean;
        environment: string;
        release: string | null;
    } | null;
    alignedNodes: AlignedTraceNode[];
    firstDivergence: AlignedTraceNode | null;
    sufficiency: EvidenceSufficiencyVerdict;
    provenance: AnalyticalResultProvenance;
}

export async function findReferenceTrace(
    targetSpans: CanonicalEvidenceRecord[],
    orgId: string
): Promise<{ referenceTraceId: string | null; quality: ReferenceQuality; reasons: string[] }> {
    if (targetSpans.length === 0) {
        return { referenceTraceId: null, quality: "Unavailable", reasons: ["Target trace has no spans."] };
    }

    const rootSpan = targetSpans[0];
    const targetTraceId = rootSpan.traceId || rootSpan.id;

    // Search for actual successful candidate executions with matching service & operation
    const candidates = await prisma.event.findMany({
        where: {
            project: { organizationId: orgId },
            type: "TRACE",
            service: rootSpan.service ?? undefined,
            operation: rootSpan.operation ?? undefined,
            traceId: { not: targetTraceId },
            severity: "INFO",
            status: { in: ["200", "201", "success", "OK", "0"] },
        },
        orderBy: { timestamp: "desc" },
        take: 10,
        select: {
            traceId: true,
            id: true,
            environmentId: true,
            release: true,
        },
    });

    if (candidates.length === 0) {
        return {
            referenceTraceId: null,
            quality: "Unavailable",
            reasons: ["No successful execution matching service and root operation was observed."],
        };
    }

    // Score reference candidate quality
    for (const c of candidates) {
        const candidateId = c.traceId || c.id;
        if (!candidateId) continue;

        const isSameEnv = c.environmentId === rootSpan.environmentId;
        const isSameRelease = Boolean(rootSpan.release && c.release === rootSpan.release);

        if (isSameEnv && isSameRelease) {
            return {
                referenceTraceId: candidateId,
                quality: "Strong",
                reasons: ["Matching service, operation, environment, and release."],
            };
        }

        if (isSameEnv) {
            return {
                referenceTraceId: candidateId,
                quality: "Moderate",
                reasons: ["Matching service, operation, and environment; release differs or unrecorded."],
            };
        }
    }

    const fallbackId = candidates[0].traceId || candidates[0].id;
    return {
        referenceTraceId: fallbackId,
        quality: "Limited",
        reasons: ["Matching service and operation; environment or release differs."],
    };
}

export async function computeTraceDivergence(
    selectedTraceId: string,
    orgId: string,
    manualReferenceTraceId?: string
): Promise<TraceDivergenceResult | null> {
    const spansA = await getEventsByTraceId(selectedTraceId, orgId);
    if (spansA.length === 0) return null;

    spansA.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const rootA = spansA[0];

    // Find or resolve reference trace
    let referenceTraceId = manualReferenceTraceId || null;
    let refQuality: ReferenceQuality = "Moderate";
    let refReasons: string[] = ["Manually specified reference trace."];

    if (!referenceTraceId) {
        const match = await findReferenceTrace(spansA, orgId);
        referenceTraceId = match.referenceTraceId;
        refQuality = match.quality;
        refReasons = match.reasons;
    }

    let spansB: CanonicalEvidenceRecord[] = [];
    if (referenceTraceId) {
        spansB = await getEventsByTraceId(referenceTraceId, orgId);
        spansB.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }

    // Evaluate sufficiency
    const sufficiency = assessTraceComparisonSufficiency({
        targetSpanCount: spansA.length,
        referenceSpanCount: spansB.length,
        hasReference: Boolean(referenceTraceId),
        referenceQuality: refQuality,
        targetEvidenceIds: spansA.map((s) => s.id),
        referenceEvidenceIds: spansB.map((s) => s.id),
    });

    const alignedNodes: AlignedTraceNode[] = [];
    const maxSpans = Math.max(spansA.length, spansB.length);
    let firstDivergence: AlignedTraceNode | null = null;
    let firstFound = false;

    for (let i = 0; i < maxSpans; i++) {
        const spanA = spansA[i] || null;
        const spanB = spansB[i] || null;

        let divergenceType: DivergenceType = "NONE";
        let explanation: string | null = null;
        const basisIds: string[] = [];
        if (spanA) basisIds.push(spanA.id);
        if (spanB) basisIds.push(spanB.id);

        if (spanA && !spanB) {
            divergenceType = "ADDITIONAL_SPAN";
            explanation = `Span "${spanA.operation || spanA.title}" exists in target execution but was not executed in reference.`;
        } else if (!spanA && spanB) {
            divergenceType = "MISSING_SPAN";
            explanation = `Reference span "${spanB.operation || spanB.title}" was not observed in target execution.`;
        } else if (spanA && spanB) {
            const hasErrorA = spanA.type === "ERROR" || spanA.severity === "ERROR" || spanA.status === "500";
            const hasErrorB = spanB.type === "ERROR" || spanB.severity === "ERROR" || spanB.status === "500";

            if (hasErrorA && !hasErrorB) {
                divergenceType = "ERROR_OCCURRED";
                explanation = `Target span encountered error (status ${spanA.status || "500"}) while reference span succeeded.`;
            } else if (spanA.operation !== spanB.operation) {
                divergenceType = "OPERATION_MISMATCH";
                explanation = `Operation differed: "${spanA.operation || spanA.title}" vs reference "${spanB.operation || spanB.title}".`;
            } else if (
                spanA.durationMs &&
                spanB.durationMs &&
                spanA.durationMs > spanB.durationMs * 2 &&
                spanA.durationMs > 200
            ) {
                divergenceType = "DURATION_REGRESSION";
                explanation = `Execution latency diverged: ${spanA.durationMs}ms in target vs ${spanB.durationMs}ms in reference.`;
            }
        }

        const isFirst = !firstFound && divergenceType !== "NONE";
        if (isFirst) firstFound = true;

        const node: AlignedTraceNode = {
            index: i,
            operation: spanA?.operation || spanB?.operation || spanA?.title || spanB?.title || `span-${i}`,
            spanA,
            spanB,
            isFirstDivergence: isFirst,
            divergenceType,
            divergenceExplanation: explanation,
            basisEvidenceIds: basisIds,
        };

        if (isFirst) firstDivergence = node;
        alignedNodes.push(node);
    }

    const durationA = spansA.reduce((sum, s) => sum + (s.durationMs || 0), 0);
    const durationB = spansB.reduce((sum, s) => sum + (s.durationMs || 0), 0);
    const hasErrorA = spansA.some((s) => s.type === "ERROR" || s.severity === "ERROR");
    const hasErrorB = spansB.some((s) => s.type === "ERROR" || s.severity === "ERROR");

    const provenance: AnalyticalResultProvenance = {
        basisEvidenceIds: firstDivergence?.basisEvidenceIds || spansA.map((s) => s.id),
        relationshipType: "COMPARATIVE",
        derivationType: "Trace Structural Tree Alignment",
        evidenceState: firstDivergence ? "OBSERVED" : "INSUFFICIENT",
        summary: firstDivergence
            ? `First observed divergence detected at span #${firstDivergence.index + 1}: ${firstDivergence.divergenceExplanation}`
            : spansA.length <= 1
            ? "Observed execution paths match within captured span depth. Comparison depth is limited (1 span captured)."
            : "No structural divergence detected between target and reference execution spans.",
        canBeEstablished: sufficiency.whatCanBeEstablished,
        cannotBeEstablished: sufficiency.whatCannotBeEstablished,
    };

    return {
        selectedTraceId,
        referenceTraceId,
        service: rootA.service || "unknown",
        operation: rootA.operation || rootA.title || "request",
        referenceQuality: refQuality,
        referenceQualityReasons: refReasons,
        traceA: {
            id: selectedTraceId,
            spans: spansA,
            totalDurationMs: durationA,
            hasError: hasErrorA,
            environment: rootA.environmentName,
            release: rootA.release,
        },
        traceB: referenceTraceId
            ? {
                  id: referenceTraceId,
                  spans: spansB,
                  totalDurationMs: durationB,
                  hasError: hasErrorB,
                  environment: spansB[0]?.environmentName || "unknown",
                  release: spansB[0]?.release || null,
              }
            : null,
        alignedNodes,
        firstDivergence,
        sufficiency,
        provenance,
    };
}
