import { parseTimeRange, type ResolvedTimeRange } from "../analytics/time";
import type { TimeRangeKey } from "../analytics/types";
import type { MetricsFilterParams, TimeBucketState } from "./types";

export interface ErrorRateResult {
  value: number | null;
  state: TimeBucketState;
  label: string;
}

export function calculateErrorRate(
  requestCount: number,
  failedRequestCount: number,
  errorCount: number = 0,
  hasTelemetry: boolean = true
): ErrorRateResult {
  if (!hasTelemetry && requestCount === 0 && errorCount === 0) {
    return {
      value: null,
      state: "NO_TELEMETRY",
      label: "No telemetry observed",
    };
  }

  // Denominator is 0: mathematically UNDEFINED
  if (requestCount === 0) {
    if (errorCount > 0 || failedRequestCount > 0) {
      return {
        value: null,
        state: "INVALID_DENOMINATOR",
        label: "Undefined — 0 requests observed",
      };
    }
    return {
      value: null,
      state: "NO_TELEMETRY",
      label: "No observed requests",
    };
  }

  // Denominator > 0
  if (failedRequestCount === 0) {
    return {
      value: 0.0,
      state: "OBSERVED_ZERO",
      label: `0 failed of ${requestCount} requests (0.0%)`,
    };
  }

  const rate = (failedRequestCount / requestCount) * 100;
  const clampedRate = Math.min(100, Math.max(0, rate));
  const rounded = Math.round(clampedRate * 10) / 10;

  return {
    value: rounded,
    state: requestCount < 3 ? "INSUFFICIENT_SAMPLE" : "OBSERVED_VALUE",
    label: `${failedRequestCount} failed of ${requestCount} requests (${rounded.toFixed(1)}%)`,
  };
}

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

export type BaselineStatus = "AVAILABLE" | "UNAVAILABLE" | "INSUFFICIENT";

export interface FormatMetricDeltaOptions {
  diff: number | null;
  baseline: BaselineStatus;
  unit?: "pp" | "%" | "ms" | "";
  precision?: number;
}

/**
 * Canonical metric delta formatter.
 * Produces EXACTLY one directional indicator:
 *   - positive: "↑ 0.2 pp"
 *   - negative: "↓ 0.2 pp"
 *   - zero: "No change"
 *   - unavailable baseline: "Baseline unavailable"
 *   - insufficient baseline: "Insufficient baseline"
 */
export function formatMetricDelta({
  diff,
  baseline,
  unit = "",
  precision = 1,
}: FormatMetricDeltaOptions): string {
  if (baseline === "UNAVAILABLE") {
    return "Baseline unavailable";
  }

  if (baseline === "INSUFFICIENT") {
    return "Insufficient baseline";
  }

  if (diff === null || diff === undefined || isNaN(diff)) {
    return "Baseline unavailable";
  }

  const absDiff = Math.abs(diff);
  const rounded = precision === 0 ? Math.round(absDiff) : Number(absDiff.toFixed(precision));
  if (rounded === 0 || absDiff < 0.0001) {
    return "No change";
  }

  const arrow = diff > 0 ? "↑" : "↓";
  const formattedVal =
    precision === 0
      ? Math.round(absDiff).toString()
      : unit === "%" && absDiff % 1 === 0
      ? absDiff.toString()
      : absDiff.toFixed(precision);

  const unitSuffix = unit === "pp" ? " pp" : unit;

  return `${arrow} ${formattedVal}${unitSuffix}`;
}

/**
 * Resolves pure mathematical direction ("up", "down", "flat", null).
 * Independent of health/sentiment.
 */
export function resolveDeltaDirection(
  diff: number | null,
  baseline: BaselineStatus,
  precision: number = 1
): "up" | "down" | "flat" | null {
  if (baseline !== "AVAILABLE" || diff === null || isNaN(diff)) {
    return null;
  }
  const absDiff = Math.abs(diff);
  const rounded = precision === 0 ? Math.round(absDiff) : Number(absDiff.toFixed(precision));
  if (rounded === 0 || absDiff < 0.0001) {
    return "flat";
  }
  return diff > 0 ? "up" : "down";
}

/**
 * Resolves health sentiment (isImprovement: true/false/null).
 * Higher is better (e.g. requests): diff > 0 => true
 * Lower is better (e.g. error rate, latency, failures): diff < 0 => true
 */
export function resolveIsImprovement(
  diff: number | null,
  baseline: BaselineStatus,
  lowerIsBetter: boolean,
  precision: number = 1
): boolean | null {
  if (baseline !== "AVAILABLE" || diff === null || isNaN(diff)) {
    return null;
  }
  const absDiff = Math.abs(diff);
  const rounded = precision === 0 ? Math.round(absDiff) : Number(absDiff.toFixed(precision));
  if (rounded === 0 || absDiff < 0.0001) {
    return null;
  }
  return lowerIsBetter ? diff < 0 : diff > 0;
}

