/**
 * Clock skew and timestamp normalizer.
 *
 * Real-world distributed systems frequently suffer from clock drift, out-of-order logs,
 * and future-dated timestamps. This module detects skew and provides monotonic sequence
 * ordering.
 */

export interface ClockAnalysis {
    hasFutureTimestamps: boolean;
    hasSkew: boolean;
    earliest: Date;
    latest: Date;
    spanMs: number;
}

export function analyzeTimestamps(timestamps: Date[]): ClockAnalysis {
    if (timestamps.length === 0) {
        const now = new Date();
        return {
            hasFutureTimestamps: false,
            hasSkew: false,
            earliest: now,
            latest: now,
            spanMs: 0,
        };
    }

    const now = Date.now();
    let min = timestamps[0].getTime();
    let max = timestamps[0].getTime();
    let futureCount = 0;

    for (const ts of timestamps) {
        const time = ts.getTime();
        if (time < min) min = time;
        if (time > max) max = time;
        if (time > now + 60_000) {
            // More than 1 minute in the future
            futureCount++;
        }
    }

    return {
        hasFutureTimestamps: futureCount > 0,
        hasSkew: futureCount > 0 || (max - min > 30 * 24 * 60 * 60 * 1000), // > 30 days span in single investigation
        earliest: new Date(min),
        latest: new Date(max),
        spanMs: max - min,
    };
}
