import type { TimeRangeKey, ComparisonMode } from "./types";

export interface ResolvedTimeRange {
    key: TimeRangeKey;
    start: Date;
    end: Date;
    comparisonStart: Date | null;
    comparisonEnd: Date | null;
    bucketCount: number;
    bucketIntervalMs: number;
}

export function parseTimeRange(
    key?: string | null,
    compareMode: ComparisonMode = "PREVIOUS_PERIOD",
    customEnd?: Date
): ResolvedTimeRange {
    const validKey: TimeRangeKey =
        key === "1h" || key === "6h" || key === "24h" || key === "7d" || key === "30d"
            ? (key as TimeRangeKey)
            : "24h";

    const end = customEnd ? new Date(customEnd) : new Date();
    let durationMs: number;
    let bucketCount: number;

    switch (validKey) {
        case "1h":
            durationMs = 60 * 60 * 1000;
            bucketCount = 12; // 5m buckets
            break;
        case "6h":
            durationMs = 6 * 60 * 60 * 1000;
            bucketCount = 18; // 20m buckets
            break;
        case "24h":
            durationMs = 24 * 60 * 60 * 1000;
            bucketCount = 24; // 1h buckets
            break;
        case "7d":
            durationMs = 7 * 24 * 60 * 60 * 1000;
            bucketCount = 28; // 6h buckets
            break;
        case "30d":
            durationMs = 30 * 24 * 60 * 60 * 1000;
            bucketCount = 30; // 1d buckets
            break;
    }

    const start = new Date(end.getTime() - durationMs);
    const bucketIntervalMs = Math.floor(durationMs / bucketCount);

    let comparisonStart: Date | null = null;
    let comparisonEnd: Date | null = null;

    if (compareMode === "PREVIOUS_PERIOD") {
        comparisonEnd = new Date(start.getTime());
        comparisonStart = new Date(start.getTime() - durationMs);
    }

    return {
        key: validKey,
        start,
        end,
        comparisonStart,
        comparisonEnd,
        bucketCount,
        bucketIntervalMs,
    };
}

export function generateTimeBuckets(
    start: Date,
    end: Date,
    bucketCount: number
): Array<{ start: Date; end: Date; formattedTime: string }> {
    const totalDurationMs = end.getTime() - start.getTime();
    const intervalMs = totalDurationMs / bucketCount;
    const buckets: Array<{ start: Date; end: Date; formattedTime: string }> = [];

    for (let i = 0; i < bucketCount; i++) {
        const bStart = new Date(start.getTime() + i * intervalMs);
        const bEnd = new Date(start.getTime() + (i + 1) * intervalMs);
        buckets.push({
            start: bStart,
            end: bEnd,
            formattedTime: formatBucketTime(bStart, totalDurationMs),
        });
    }

    return buckets;
}

export function formatBucketTime(date: Date, totalRangeMs: number): string {
    const hours24 = 24 * 60 * 60 * 1000;
    if (totalRangeMs <= hours24) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    } else {
        return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`;
    }
}

export function calculateMetricComparison(
    current: number,
    previous: number | null,
    isRateMetric: boolean = false,
    lowerIsBetter: boolean = true
): {
    current: number;
    previous: number | null;
    absoluteDiff: number | null;
    relativeDiffPct: number | null;
    percentagePointsDiff: number | null;
    isImprovement: boolean | null;
} {
    if (previous === null || previous === undefined) {
        return {
            current,
            previous: null,
            absoluteDiff: null,
            relativeDiffPct: null,
            percentagePointsDiff: null,
            isImprovement: null,
        };
    }

    const absoluteDiff = Math.round((current - previous) * 100) / 100;
    let relativeDiffPct: number | null = null;
    let percentagePointsDiff: number | null = null;

    if (previous !== 0) {
        relativeDiffPct = Math.round(((current - previous) / previous) * 1000) / 10;
    }
    // When previous === 0, there is no finite relative change:
    // any positive current value is an infinite multiplier over zero.
    // We return null to signal "no meaningful ratio" rather than fabricating 100%.
    // absoluteDiff still reflects the raw magnitude change.

    if (isRateMetric) {
        percentagePointsDiff = Math.round((current - previous) * 10) / 10;
    }

    let isImprovement: boolean | null = null;
    if (absoluteDiff !== 0) {
        isImprovement = lowerIsBetter ? absoluteDiff < 0 : absoluteDiff > 0;
    }

    return {
        current: Math.round(current * 100) / 100,
        previous: Math.round(previous * 100) / 100,
        absoluteDiff,
        relativeDiffPct,
        percentagePointsDiff,
        isImprovement,
    };
}
