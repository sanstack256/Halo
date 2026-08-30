/**
 * Canonical Data-Driven Activity & Frequency Trend Calculator for Halo Issues.
 *
 * Implements dynamic temporal bucketing and trend classification strictly
 * derived from the issue's real occurrence timestamps.
 */

export type ActivityState =
    | "ACTIVE"
    | "INCREASING"
    | "DECREASING"
    | "BURST"
    | "RECURRING"
    | "DORMANT"
    | "RESOLVED"
    | "REGRESSED"
    | "INSUFFICIENT_DATA";

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
 * Determine dynamic bucket count K based on observation span and occurrence count.
 */
function getOptimalBucketCount(spanMs: number, eventCount: number): number {
    const MIN_BUCKETS = 5;
    const MAX_BUCKETS = 12;

    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;

    if (spanMs <= 5 * 60 * 1000) {
        // Less than 5 minutes: 5 buckets (1 min each)
        return 5;
    }
    if (spanMs <= oneHour) {
        // Up to 1 hour: 6 buckets (10 min each)
        return 6;
    }
    if (spanMs <= oneDay) {
        // Up to 24 hours: 8 buckets (3 hours each)
        return 8;
    }
    if (spanMs <= oneWeek) {
        // Up to 7 days: 7 buckets (1 day each)
        return 7;
    }
    if (spanMs <= oneMonth) {
        // Up to 30 days: 10 buckets (3 days each)
        return 10;
    }

    // Greater than a month: 12 buckets
    return MAX_BUCKETS;
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

    // 1. Status Check: Resolved
    if (status === "RESOLVED") {
        return {
            state: "RESOLVED",
            label: "Resolved",
            description: "Issue has been resolved and is not actively firing.",
            badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
            totalOccurrences,
            observationSpanMs,
            firstSeen,
            lastSeen,
            hasSparkline: false,
            buckets: [],
            maxBucketCount: 0,
            bucketDurationMs: 0,
        };
    }

    // 2. Insufficient History: 0 or 1 occurrence
    if (totalOccurrences <= 1) {
        const isOld = msSinceLast > 72 * 60 * 60 * 1000;
        return {
            state: "INSUFFICIENT_DATA",
            label: totalOccurrences === 1 ? "1 Occurrence" : "No Events",
            description: "Single occurrence recorded. Insufficient historical data for frequency trend.",
            badgeClass: isOld
                ? "bg-zinc-800 text-zinc-400 border-zinc-700"
                : "bg-surface text-zinc-300 border-border",
            totalOccurrences,
            observationSpanMs,
            firstSeen,
            lastSeen,
            hasSparkline: false,
            buckets: [],
            maxBucketCount: totalOccurrences,
            bucketDurationMs: 0,
        };
    }

    // 3. Clustered Burst: Multiple occurrences in a short window (<= 2 minutes)
    if (observationSpanMs <= 2 * 60 * 1000 && totalOccurrences >= 3) {
        return {
            state: "BURST",
            label: "Failure Burst",
            description: `${totalOccurrences} occurrences clustered within ${Math.round(observationSpanMs / 1000)} seconds.`,
            badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
            totalOccurrences,
            observationSpanMs,
            firstSeen,
            lastSeen,
            hasSparkline: false,
            buckets: [],
            maxBucketCount: totalOccurrences,
            bucketDurationMs: observationSpanMs,
        };
    }

    // 4. If span is 0 ms (all events happened at the exact same millisecond)
    if (observationSpanMs === 0) {
        return {
            state: "INSUFFICIENT_DATA",
            label: `${totalOccurrences} Events (Simultaneous)`,
            description: `${totalOccurrences} events occurred at the same timestamp.`,
            badgeClass: "bg-surface text-zinc-300 border-border",
            totalOccurrences,
            observationSpanMs,
            firstSeen,
            lastSeen,
            hasSparkline: false,
            buckets: [],
            maxBucketCount: totalOccurrences,
            bucketDurationMs: 0,
        };
    }

    // 5. Build Dynamic Time Buckets
    const numBuckets = getOptimalBucketCount(observationSpanMs, totalOccurrences);
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
        const heightPercent = count > 0 ? Math.max(18, Math.round((count / maxBucketCount) * 100)) : 4;

        return {
            index: idx,
            startTime: bStart,
            endTime: bEnd,
            count,
            heightPercent,
            isNewest: idx === numBuckets - 1,
        };
    });

    // 6. Calculate Trend: Compare 1st half of observation period to 2nd half
    const half = Math.floor(numBuckets / 2);
    const firstHalfSum = bucketCounts.slice(0, half).reduce((a, b) => a + b, 0);
    const secondHalfSum = bucketCounts.slice(half).reduce((a, b) => a + b, 0);

    // Recency threshold: Dormant if no occurrence in > 72 hours
    const isDormant = msSinceLast > 72 * 60 * 60 * 1000;

    let state: ActivityState = "ACTIVE";
    let label = "Active";
    let badgeClass = "bg-blue-500/10 text-blue-400 border-blue-500/20";
    let description = "Regular occurrences across the observation interval.";

    if (isDormant) {
        state = "DORMANT";
        label = "Dormant";
        badgeClass = "bg-zinc-800/60 text-zinc-400 border-zinc-700";
        description = `No occurrences in the last ${Math.round(msSinceLast / (1000 * 60 * 60))} hours.`;
    } else if (totalOccurrences >= 4 && secondHalfSum >= firstHalfSum * 1.6 && secondHalfSum >= 3) {
        state = "INCREASING";
        label = "Increasing";
        badgeClass = "bg-red-500/10 text-red-400 border-red-500/20";
        description = `Occurrence frequency is increasing (${secondHalfSum} in 2nd half vs ${firstHalfSum} in 1st half).`;
    } else if (totalOccurrences >= 4 && secondHalfSum <= firstHalfSum * 0.4 && firstHalfSum >= 3) {
        state = "DECREASING";
        label = "Decreasing";
        badgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        description = `Occurrence frequency is declining (${secondHalfSum} in 2nd half vs ${firstHalfSum} in 1st half).`;
    } else if (totalOccurrences >= 10) {
        state = "RECURRING";
        label = "Recurring";
        badgeClass = "bg-amber-500/10 text-amber-400 border-amber-500/20";
        description = `High recurrence volume (${totalOccurrences} total occurrences).`;
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
