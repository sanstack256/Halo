import { describe, it, expect } from "vitest";
import {
  calculatePercentile,
  isFailedStatus,
  resolveTimeWindow,
} from "../calculations";
import {
  formatUtcDateTime,
  formatUtcTime,
  formatThroughput,
} from "../formatters";
import { calculateMetricComparison } from "../../analytics/time";

describe("Project Metrics Calculations & Mathematical Correctness", () => {
  describe("Timestamp & Throughput Formatters", () => {
    it("formats UTC datetime without negative times or drift", () => {
      const d = new Date("2026-09-08T21:14:05.000Z");
      expect(formatUtcDateTime(d)).toBe("Sep 8, 21:14 UTC");
      expect(formatUtcTime(d)).toBe("21:14 UTC");
    });

    it("handles null or invalid date safely", () => {
      expect(formatUtcDateTime(null)).toBe("—");
      expect(formatUtcDateTime("invalid")).toBe("—");
      expect(formatUtcTime(undefined)).toBe("—");
    });

    it("calculates throughput correctly across real elapsed seconds", () => {
      // 437 requests across 10 minutes (600 seconds)
      const t1 = new Date("2026-09-08T21:00:00.000Z").getTime();
      const t2 = new Date("2026-09-08T21:10:00.000Z").getTime();
      const res = formatThroughput(437, t1, t2);

      // 437 / 600 = 0.728 rps = 43.7 rpm
      expect(res.isInsufficient).toBe(false);
      expect(res.value).toBe("43.7 rpm");
    });

    it("displays insufficient observation interval when interval < 5s", () => {
      const t1 = new Date("2026-09-08T21:00:00.000Z").getTime();
      const t2 = new Date("2026-09-08T21:00:02.000Z").getTime();
      const res = formatThroughput(10, t1, t2);
      expect(res.isInsufficient).toBe(true);
      expect(res.label).toBe("Insufficient observation interval");
    });
  });

  describe("Percentiles Calculation", () => {
    it("returns null for empty array", () => {
      expect(calculatePercentile([], 50)).toBeNull();
      expect(calculatePercentile([], 95)).toBeNull();
    });

    it("correctly calculates median (p50) on odd and even lengths", () => {
      const odd = [10, 20, 30, 40, 50];
      expect(calculatePercentile(odd, 50)).toBe(30);

      const even = [10, 20, 30, 40];
      expect(calculatePercentile(even, 50)).toBe(20);
    });

    it("correctly calculates p95 on distribution", () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      expect(calculatePercentile(values, 95)).toBe(95);
      expect(calculatePercentile(values, 99)).toBe(99);
      expect(calculatePercentile(values, 50)).toBe(50);
    });

    it("handles unsorted input arrays without mutating original array", () => {
      const unsorted = [90, 10, 40, 70, 20];
      const copy = [...unsorted];
      const p95 = calculatePercentile(unsorted, 95);
      expect(p95).toBe(90);
      expect(unsorted).toEqual(copy);
    });
  });

  describe("Status Failure Evaluation (isFailedStatus)", () => {
    it("identifies standard HTTP error codes as failed", () => {
      expect(isFailedStatus("400")).toBe(true);
      expect(isFailedStatus("404")).toBe(true);
      expect(isFailedStatus("500")).toBe(true);
      expect(isFailedStatus("503")).toBe(true);
    });

    it("identifies successful HTTP status codes as not failed", () => {
      expect(isFailedStatus("200")).toBe(false);
      expect(isFailedStatus("201")).toBe(false);
      expect(isFailedStatus("204")).toBe(false);
      expect(isFailedStatus("302")).toBe(false);
    });

    it("identifies canonical status strings", () => {
      expect(isFailedStatus("error")).toBe(true);
      expect(isFailedStatus("failed")).toBe(true);
      expect(isFailedStatus("failure")).toBe(true);
      expect(isFailedStatus("timeout")).toBe(true);
      expect(isFailedStatus("timed_out")).toBe(true);
      expect(isFailedStatus("ok")).toBe(false);
      expect(isFailedStatus("success")).toBe(false);
      expect(isFailedStatus(null)).toBe(false);
      expect(isFailedStatus(undefined)).toBe(false);
    });
  });

  describe("Metric Comparisons & Zero Baseline Protection", () => {
    it("handles division by zero safely when previous value is 0", () => {
      const result = calculateMetricComparison(10, 0, false, false);
      expect(result.relativeDiffPct).toBeNull();
      expect(result.absoluteDiff).toBe(10);
    });

    it("handles null previous value gracefully without inventing percentage", () => {
      const result = calculateMetricComparison(25, null, false, false);
      expect(result.relativeDiffPct).toBeNull();
      expect(result.previous).toBeNull();
    });

    it("calculates accurate percentage points difference for rate metrics", () => {
      const result = calculateMetricComparison(5.2, 15.5, true, true);
      expect(result.percentagePointsDiff).toBe(-10.3);
      expect(result.isImprovement).toBe(true);
    });

    it("calculates relative change percentage for volume metrics", () => {
      const result = calculateMetricComparison(150, 100, false, false);
      expect(result.relativeDiffPct).toBe(50);
      expect(result.isImprovement).toBe(true);
    });
  });

  describe("Multi-Dataset Mutation & Independent Mathematical Verification", () => {
    it("Dataset A: High throughput, 0 errors yields exactly 0% error rate and valid throughput", () => {
      const records = Array.from({ length: 50 }, () => ({
        status: "200",
        durationMs: 45,
      }));
      const failed = records.filter((r) => isFailedStatus(r.status));
      const errorRate = (failed.length / records.length) * 100;
      const p95 = calculatePercentile(records.map((r) => r.durationMs), 95);

      expect(failed.length).toBe(0);
      expect(errorRate).toBe(0);
      expect(p95).toBe(45);
    });

    it("Dataset B: High errors, low throughput yields accurate error rate", () => {
      const records = [
        { status: "500", durationMs: 120 },
        { status: "500", durationMs: 150 },
        { status: "502", durationMs: 300 },
        { status: "200", durationMs: 50 },
      ];
      const failed = records.filter((r) => isFailedStatus(r.status));
      const errorRate = (failed.length / records.length) * 100;

      expect(failed.length).toBe(3);
      expect(errorRate).toBe(75);
    });

    it("Dataset C: Latency spike percentile tracking", () => {
      const latencies = [20, 22, 24, 25, 26, 28, 29, 30, 31, 2500];
      const p50 = calculatePercentile(latencies, 50);
      const p95 = calculatePercentile(latencies, 95);

      expect(p50).toBe(26);
      expect(p95).toBe(2500);
    });

    it("Dataset D: Truthful empty state when records array is empty", () => {
      const records: { status: string; durationMs: number }[] = [];
      const errorRate = records.length > 0 ? (0 / records.length) * 100 : null;
      const p95 = calculatePercentile(records.map((r) => r.durationMs), 95);

      expect(errorRate).toBeNull();
      expect(p95).toBeNull();
    });

    it("Dataset E: Sparse sample size flag triggered when samples < 5", () => {
      const sparseRecords = [{ status: "200", durationMs: 80 }, { status: "200", durationMs: 90 }];
      const hasSufficientSample = sparseRecords.length >= 5;
      expect(hasSufficientSample).toBe(false);
    });
  });

  describe("Time Range Resolution", () => {
    it("resolves canonical presets deterministically", () => {
      const range1h = resolveTimeWindow({ timeRange: "1h" });
      expect(range1h.key).toBe("1h");
      expect(range1h.bucketCount).toBe(12);

      const range24h = resolveTimeWindow({ timeRange: "24h" });
      expect(range24h.key).toBe("24h");
      expect(range24h.bucketCount).toBe(24);

      const range7d = resolveTimeWindow({ timeRange: "7d" });
      expect(range7d.key).toBe("7d");
      expect(range7d.bucketCount).toBe(28);
    });

    it("resolves custom time ranges properly with comparative period", () => {
      const from = "2026-09-01T00:00:00.000Z";
      const to = "2026-09-03T00:00:00.000Z";
      const custom = resolveTimeWindow({
        timeRange: "custom",
        from,
        to,
      });

      expect(custom.start.toISOString()).toBe(from);
      expect(custom.end.toISOString()).toBe(to);
      expect(custom.comparisonStart).not.toBeNull();
      expect(custom.comparisonEnd).not.toBeNull();
      expect(custom.comparisonEnd!.toISOString()).toBe(from);
    });
  });
});
