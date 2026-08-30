/**
 * Canonical Data-Driven Activity & Frequency Trend Calculator for Halo Issues.
 *
 * All states and temporal buckets are strictly derived from real occurrence timestamps.
 * Standard states: ACTIVE, DORMANT, INCREASING, DECREASING, RESOLVED.
 */

import { formatDeterministicDateTime } from "@/lib/date-format";

export type ActivityState =
    | "ACTIVE"
    | "DORMANT"
    | "INCREASING"
    | "DECREASING"
    | "RESOLVED";

export interface TimeBucket {
    index: number;
    startTime: Date;
    endTime: Date;
    count: number;
    heightPercent: number; // 0 - 100
    isNewest: boolean;
}

export interface ActivityResult {
    state: ActivityState;
    label: string;
    description: string;
    badgeClass: string;
    totalOccurrences: number;
    observationSpanMs: number;
    firstSeen: Date;
    lastSeen: Date;
    hasSparkline: boolean;
    buckets: TimeBucket[];
    maxBucketCount: number;
    bucketDurationMs: number;
}

/**
 * Determine dynamic bucket count K based on observation span.
 */
function getOptimalBucketCount(spanMs: number): number {
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;

    if (spanMs <= 10 * 60 * 1000) return 4;
    if (spanMs <= oneHour) return 6;
    if (spanMs <= oneDay) return 8;
    if (spanMs <= oneWeek) return 7;
    if (spanMs <= oneMonth) return 10;
    return 12;
}

export function calculateIssueActivity(
    firstSeenInput: Date | string,
    lastSeenInput: Date | string,
    eventTimestamps: (Date | string)[],
    status?: string,
    now: number = Date.now()
): ActivityResult {
    // Parse timestamps and sort ascending
    const timestamps = eventTimestamps
        .map((t) => new Date(t).getTime())
        .filter((t) => !isNaN(t))
        .sort((a, b) => a - b);

    const totalOccurrences = timestamps.length;
    const firstMs = timestamps.length > 0 ? timestamps[0] : new Date(firstSeenInput).getTime();
    const lastMs = timestamps.length > 0 ? timestamps[timestamps.length - 1] : new Date(lastSeenInput).getTime();
    const firstSeen = new Date(firstMs);
    const lastSeen = new Date(lastMs);

    const observationSpanMs = Math.max(0, lastMs - firstMs);
    const msSinceLast = Math.max(0, now - lastMs);
    const isDormant = msSinceLast > 72 * 60 * 60 * 1000;

    // 1. Canonical State Derivation
    let state: ActivityState = "ACTIVE";
    let label = "Active";
    let badgeClass = "bg-blue-500/10 text-blue-400 border-blue-500/20";
    let description = "Active occurrences within the observation window.";

    if (status === "RESOLVED") {
        state = "RESOLVED";
        label = "Resolved";
        badgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        description = "Issue marked resolved.";
    } else if (isDormant) {
        state = "DORMANT";
        label = "Dormant";
        badgeClass = "bg-zinc-800 text-zinc-400 border-zinc-700";
        description = "No occurrences in the last 72 hours.";
    }

    // 2. Frequency Buckets for Single Occurrence
    if (totalOccurrences <= 1) {
        const singleBucket: TimeBucket = {
            index: 0,
            startTime: firstSeen,
            endTime: lastSeen,
            count: totalOccurrences,
            heightPercent: 100,
            isNewest: true,
        };

        return {
            state,
            label,
            description,
            badgeClass,
            totalOccurrences,
            observationSpanMs: 0,
            firstSeen,
            lastSeen,
            hasSparkline: true,
            buckets: [singleBucket],
            maxBucketCount: totalOccurrences,
            bucketDurationMs: 0,
        };
    }

    // 3. Frequency Buckets for Simultaneous occurrences (span = 0)
    if (observationSpanMs === 0) {
        const singleBucket: TimeBucket = {
            index: 0,
            startTime: firstSeen,
            endTime: lastSeen,
            count: totalOccurrences,
            heightPercent: 100,
            isNewest: true,
        };

        return {
            state,
            label,
            description,
            badgeClass,
            totalOccurrences,
            observationSpanMs: 0,
            firstSeen,
            lastSeen,
            hasSparkline: true,
            buckets: [singleBucket],
            maxBucketCount: totalOccurrences,
            bucketDurationMs: 0,
        };
    }

    // 4. Multi-occurrence Dynamic Bucketing across [firstMs, lastMs]
    const numBuckets = getOptimalBucketCount(observationSpanMs);
    const bucketDurationMs = Math.max(1, Math.ceil(observationSpanMs / numBuckets));
    const bucketCounts = new Array(numBuckets).fill(0);

    for (const t of timestamps) {
        let bIdx = Math.floor((t - firstMs) / bucketDurationMs);
        if (bIdx >= numBuckets) bIdx = numBuckets - 1;
        if (bIdx < 0) bIdx = 0;
        bucketCounts[bIdx]++;
    }

    const maxBucketCount = Math.max(...bucketCounts, 1);

    const buckets: TimeBucket[] = bucketCounts.map((count, idx) => {
        const bStart = new Date(firstMs + idx * bucketDurationMs);
        const bEnd = new Date(Math.min(lastMs, firstMs + (idx + 1) * bucketDurationMs));
        const heightPercent = count > 0 ? Math.max(20, Math.round((count / maxBucketCount) * 100)) : 0;

        return {
            index: idx,
            startTime: bStart,
            endTime: bEnd,
            count,
            heightPercent,
            isNewest: idx === numBuckets - 1,
        };
    });

    // 5. Trend Classification (only when unresolved, non-dormant, and >= 3 occurrences)
    if (state === "ACTIVE" && totalOccurrences >= 3) {
        const half = Math.floor(numBuckets / 2);
        const firstHalfSum = bucketCounts.slice(0, half).reduce((a, b) => a + b, 0);
        const secondHalfSum = bucketCounts.slice(half).reduce((a, b) => a + b, 0);

        if (secondHalfSum >= firstHalfSum * 1.6 && secondHalfSum >= 2) {
            state = "INCREASING";
            label = "Increasing";
            badgeClass = "bg-red-500/10 text-red-400 border-red-500/20";
            description = `Occurrence rate is increasing (${secondHalfSum} recently vs ${firstHalfSum} earlier).`;
        } else if (secondHalfSum <= firstHalfSum * 0.4 && firstHalfSum >= 2) {
            state = "DECREASING";
            label = "Decreasing";
            badgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            description = `Occurrence rate is decreasing (${secondHalfSum} recently vs ${firstHalfSum} earlier).`;
        }
    }

    return {
        state,
        label,
        description,
        badgeClass,
        totalOccurrences,
        observationSpanMs,
        firstSeen,
        lastSeen,
        hasSparkline: true,
        buckets,
        maxBucketCount,
        bucketDurationMs,
    };
}
