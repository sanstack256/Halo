import { prisma } from "../prisma";
import {
    assessMetricShapeSufficiency,
    type EvidenceSufficiencyVerdict,
} from "./evidence-sufficiency";
import type {
    AnalyticalResultProvenance,
} from "./evidence-types";

export type MetricKey = "errors" | "latency" | "throughput";

export type MatchQuality =
    | "STRONG MATCH"
    | "MODERATE MATCH"
    | "WEAK MATCH"
    | "NO MEANINGFUL MATCH"
    | "INSUFFICIENT SHAPE DATA";

export interface MetricDataPoint {
    timestamp: Date;
    value: number;
}

export interface MetricShapeTwinMatch {
    intervalId: string;
    startTime: Date;
    endTime: Date;
    points: MetricDataPoint[];
    similarity: MatchQuality;
    contourDistance: number;
    explanation: string;
    correlatedEventsCount: number;
    correlatedReleases: string[];
}

export interface MetricShapeFeatures {
    baseline: number;
    trend: "Ascending" | "Descending" | "Stationary" | "Volatile";
    peakProminence: number;
    volatility: number;
    recoveryRate: number;
    description: string;
}

export interface MetricShapeTwinResult {
    metricKey: MetricKey;
    metricLabel: string;
    unit: string;
    currentWindow: {
        startTime: Date;
        endTime: Date;
        points: MetricDataPoint[];
        features: MetricShapeFeatures | null;
        peakValue: number;
        avgValue: number;
    };
    bestTwin: MetricShapeTwinMatch | null;
    historicalTwins: MetricShapeTwinMatch[];
    sufficiency: EvidenceSufficiencyVerdict;
    provenance: AnalyticalResultProvenance;
}

export async function computeMetricShapeTwins(
    metricKey: MetricKey = "errors",
    timeWindowKey: string = "24h",
    orgId: string,
    projectIds?: string[]
): Promise<MetricShapeTwinResult> {
    const metricLabel =
        metricKey === "errors"
            ? "Error Frequency"
            : metricKey === "latency"
            ? "P95 Latency"
            : "Request Throughput";

    const unit = metricKey === "latency" ? "ms" : "events";

    const now = new Date();
    let currentDurationMs = 24 * 60 * 60 * 1000;
    if (timeWindowKey === "1h") currentDurationMs = 60 * 60 * 1000;
    if (timeWindowKey === "6h") currentDurationMs = 6 * 60 * 60 * 1000;
    if (timeWindowKey === "7d") currentDurationMs = 7 * 24 * 60 * 60 * 1000;

    const currentStart = new Date(now.getTime() - currentDurationMs);
    const historicalLookbackStart = new Date(now.getTime() - currentDurationMs * 4);

    // Fetch actual telemetry for current and historical lookback
    const events = await prisma.event.findMany({
        where: {
            project: { organizationId: orgId },
            ...(projectIds && projectIds.length > 0 ? { projectId: { in: projectIds } } : {}),
            timestamp: { gte: historicalLookbackStart, lte: now },
            ...(metricKey === "errors" ? { type: "ERROR" } : {}),
            ...(metricKey === "latency" ? { durationMs: { not: null } } : {}),
        },
        select: {
            id: true,
            timestamp: true,
            durationMs: true,
            release: true,
            type: true,
        },
        orderBy: { timestamp: "asc" },
        take: 1200,
    });

    const sliceCount = 12;
    const sliceDurationMs = currentDurationMs / sliceCount;

    // Bucket current window
    const currentPoints: MetricDataPoint[] = [];
    for (let i = 0; i < sliceCount; i++) {
        const sliceStart = new Date(currentStart.getTime() + i * sliceDurationMs);
        const sliceEnd = new Date(sliceStart.getTime() + sliceDurationMs);

        const sliceEvents = events.filter(
            (e) => e.timestamp >= sliceStart && e.timestamp < sliceEnd
        );

        let val = sliceEvents.length;
        if (metricKey === "latency" && sliceEvents.length > 0) {
            const durations = sliceEvents
                .map((e) => e.durationMs || 0)
                .sort((a, b) => a - b);
            const p95Idx = Math.floor(durations.length * 0.95);
            val = durations[p95Idx] || durations[0];
        }

        currentPoints.push({ timestamp: sliceStart, value: val });
    }

    const nonZeroPoints = currentPoints.filter((p) => p.value > 0).length;

    // Check sample sufficiency
    const sufficiency = assessMetricShapeSufficiency({
        sampleCount: nonZeroPoints,
        minRequiredSamples: 4,
        historicalWindowCount: 3,
    });

    // If insufficient, STOP and return INSUFFICIENT SHAPE DATA without guessing similarity
    if (sufficiency.status === "INSUFFICIENT") {
        return {
            metricKey,
            metricLabel,
            unit,
            currentWindow: {
                startTime: currentStart,
                endTime: now,
                points: currentPoints,
                features: null,
                peakValue: Math.max(...currentPoints.map((p) => p.value), 0),
                avgValue: 0,
            },
            bestTwin: null,
            historicalTwins: [],
            sufficiency,
            provenance: {
                basisEvidenceIds: events.map((e) => e.id),
                relationshipType: "COMPARATIVE",
                derivationType: "Shape Contour Analysis",
                evidenceState: "INSUFFICIENT",
                summary: "Insufficient shape telemetry to perform mathematical contour extraction.",
                canBeEstablished: sufficiency.whatCanBeEstablished,
                cannotBeEstablished: sufficiency.whatCannotBeEstablished,
            },
        };
    }

    // Extract shape features
    const peakVal = Math.max(...currentPoints.map((p) => p.value), 0);
    const avgVal =
        currentPoints.reduce((acc, p) => acc + p.value, 0) / (currentPoints.length || 1);
    const startVal = currentPoints[0]?.value || 0;
    const endVal = currentPoints[currentPoints.length - 1]?.value || 0;

    let trend: MetricShapeFeatures["trend"] = "Stationary";
    if (endVal > startVal * 1.5 && peakVal > 2) trend = "Ascending";
    else if (startVal > endVal * 1.5 && peakVal > 2) trend = "Descending";

    const features: MetricShapeFeatures = {
        baseline: currentPoints[0]?.value || 0,
        trend,
        peakProminence: peakVal > avgVal * 1.6 ? peakVal - avgVal : 0,
        volatility: Math.round(peakVal / (avgVal || 1) * 10) / 10,
        recoveryRate: endVal < peakVal ? Math.round(((peakVal - endVal) / (peakVal || 1)) * 100) : 0,
        description:
            peakVal > avgVal * 1.8 && peakVal > 2
                ? "Sharp elevated surge followed by stabilization"
                : trend === "Ascending"
                ? "Steady ascending trend"
                : "Stable baseline with minimal variance",
    };

    // Historical candidate intervals (lookbacks 1, 2, 3 periods back)
    const historicalTwins: MetricShapeTwinMatch[] = [];

    for (let shift = 1; shift <= 3; shift++) {
        const hStart = new Date(currentStart.getTime() - shift * currentDurationMs);
        const hEnd = new Date(currentStart.getTime() - (shift - 1) * currentDurationMs);

        const hPoints: MetricDataPoint[] = [];
        const hReleases = new Set<string>();
        let hTotalEvents = 0;

        for (let i = 0; i < sliceCount; i++) {
            const sStart = new Date(hStart.getTime() + i * sliceDurationMs);
            const sEnd = new Date(sStart.getTime() + sliceDurationMs);

            const sEvents = events.filter(
                (e) => e.timestamp >= sStart && e.timestamp < sEnd
            );

            hTotalEvents += sEvents.length;
            for (const ev of sEvents) {
                if (ev.release) hReleases.add(ev.release);
            }

            let val = sEvents.length;
            if (metricKey === "latency" && sEvents.length > 0) {
                const durations = sEvents
                    .map((e) => e.durationMs || 0)
                    .sort((a, b) => a - b);
                const p95Idx = Math.floor(durations.length * 0.95);
                val = durations[p95Idx] || durations[0];
            }
            hPoints.push({ timestamp: sStart, value: val });
        }

        // Real normalized distance
        const distance = computeNormalizedDistance(
            currentPoints.map((p) => p.value),
            hPoints.map((p) => p.value)
        );

        let similarity: MatchQuality = "WEAK MATCH";
        let explanation = "General baseline curvature with low structural overlap.";

        if (distance < 0.18) {
            similarity = "STRONG MATCH";
            explanation = "Closely mirrors the elevated spike velocity and subsequent stabilization slope.";
        } else if (distance < 0.38) {
            similarity = "MODERATE MATCH";
            explanation = "Exhibits comparable directional trajectory and variance bounds.";
        } else if (distance >= 0.7) {
            similarity = "NO MEANINGFUL MATCH";
            explanation = "Inverse or uncorrelated directional contour.";
        }

        historicalTwins.push({
            intervalId: `twin-shift-${shift}`,
            startTime: hStart,
            endTime: hEnd,
            points: hPoints,
            similarity,
            contourDistance: distance,
            explanation,
            correlatedEventsCount: hTotalEvents,
            correlatedReleases: Array.from(hReleases),
        });
    }

    historicalTwins.sort((a, b) => a.contourDistance - b.contourDistance);

    const provenance: AnalyticalResultProvenance = {
        basisEvidenceIds: events.slice(0, 15).map((e) => e.id),
        relationshipType: "COMPARATIVE",
        derivationType: "Normalized Metric Contour Distance",
        evidenceState: "DERIVED",
        summary: `Computed contour distance between current ${timeWindowKey} interval and ${historicalTwins.length} candidate historical intervals.`,
        canBeEstablished: sufficiency.whatCanBeEstablished,
        cannotBeEstablished: sufficiency.whatCannotBeEstablished,
    };

    return {
        metricKey,
        metricLabel,
        unit,
        currentWindow: {
            startTime: currentStart,
            endTime: now,
            points: currentPoints,
            features,
            peakValue: peakVal,
            avgValue: Math.round(avgVal * 10) / 10,
        },
        bestTwin: historicalTwins[0] || null,
        historicalTwins,
        sufficiency,
        provenance,
    };
}

function computeNormalizedDistance(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) return 1.0;

    const maxA = Math.max(...a, 1);
    const maxB = Math.max(...b, 1);

    const normA = a.map((v) => v / maxA);
    const normB = b.map((v) => v / maxB);

    let diffSum = 0;
    for (let i = 0; i < normA.length; i++) {
        diffSum += Math.abs(normA[i] - normB[i]);
    }

    return Math.round((diffSum / normA.length) * 100) / 100;
}
