import { parseTimeRange, type ResolvedTimeRange } from "../analytics/time";
import type { TimeRangeKey } from "../analytics/types";
import type { MetricsFilterParams } from "./types";

export function isFailedStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase().trim();
  if (
    normalized === "error" ||
    normalized === "failed" ||
    normalized === "failure" ||
    normalized === "timeout" ||
    normalized === "timed_out" ||
    normalized === "500" ||
    normalized === "502" ||
    normalized === "503" ||
    normalized === "504"
  ) {
    return true;
  }
  const numeric = Number(status);
  if (Number.isFinite(numeric)) {
    return numeric >= 400;
  }
  return false;
}

export function calculatePercentile(values: number[], percentileRank: number): number | null {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileRank / 100) * sorted.length) - 1;
  const clampedIndex = Math.max(0, Math.min(index, sorted.length - 1));
  return sorted[clampedIndex];
}

export function resolveTimeWindow(filter: MetricsFilterParams): ResolvedTimeRange {
  if (filter.timeRange === "custom" && filter.from && filter.to) {
    const start = new Date(filter.from);
    const end = new Date(filter.to);
    const durationMs = Math.max(end.getTime() - start.getTime(), 60 * 1000);
    const comparisonStart = new Date(start.getTime() - durationMs);
    const comparisonEnd = new Date(start.getTime());
    let bucketCount = 24;
    if (durationMs <= 3600 * 1000) bucketCount = 12;
    else if (durationMs <= 86400 * 1000) bucketCount = 24;
    else bucketCount = 30;

    return {
      key: "custom" as unknown as TimeRangeKey,
      start,
      end,
      comparisonStart,
      comparisonEnd,
      bucketCount,
      bucketIntervalMs: Math.floor(durationMs / bucketCount),
    };
  }

  return parseTimeRange(filter.timeRange, "PREVIOUS_PERIOD");
}
