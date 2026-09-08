"use client";

import { useState } from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type {
  PrimaryTelemetryOverviewData,
  PrimaryChartBucket,
  PrimaryChartMetric,
} from "@/lib/metrics/types";

interface PrimaryTelemetryOverviewProps {
  overview: PrimaryTelemetryOverviewData;
  buckets: PrimaryChartBucket[];
  timeRangeLabel: string;
}

export function PrimaryTelemetryOverview({
  overview,
  buckets,
  timeRangeLabel,
}: PrimaryTelemetryOverviewProps) {
  const [activeMetric, setActiveMetric] = useState<PrimaryChartMetric>("error_rate");
  const [hoveredBucket, setHoveredBucket] = useState<PrimaryChartBucket | null>(null);

  const metricsList = [
    overview.errorRate,
    overview.requests,
    overview.p95Latency,
    overview.affectedUsers,
  ];

  // Derive metric value for each bucket
  const getBucketValue = (b: PrimaryChartBucket, m: PrimaryChartMetric): number | null => {
    switch (m) {
      case "error_rate":
        return b.errorRate;
      case "requests":
        return b.requestCount;
      case "p95_latency":
        return b.p95LatencyMs;
      case "failed_requests":
        return b.failedRequestCount;
    }
  };

  const values = buckets
    .map((b) => getBucketValue(b, activeMetric))
    .filter((v): v is number => typeof v === "number" && !isNaN(v));

  const maxValue = values.length > 0 ? Math.max(1, ...values) : 1;

  const metricTitle =
    activeMetric === "error_rate"
      ? "Error Rate"
      : activeMetric === "requests"
      ? "Requests"
      : activeMetric === "p95_latency"
      ? "P95 Latency"
      : "Failed Requests";

  const metricUnit =
    activeMetric === "error_rate"
      ? "%"
      : activeMetric === "p95_latency"
      ? "ms"
      : "";

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-5">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          TELEMETRY OVERVIEW
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          {timeRangeLabel}
        </span>
      </div>

      {/* Exactly 4 Primary Metrics in One Horizontal Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border/40">
        {metricsList.map((m, idx) => {
          const isGood = m.isImprovement;
          const isUnavailable = m.delta === "Baseline unavailable";

          return (
            <div key={m.label} className={idx > 0 ? "pt-3 lg:pt-0 lg:pl-4" : ""}>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {m.label}
              </div>

              <div className="mt-1 font-mono text-[28px] font-semibold tracking-tight text-foreground leading-none">
                {m.value}
              </div>

              <div className="mt-2 flex items-center justify-between text-xs">
                <span
                  className={`inline-flex items-center gap-0.5 font-mono text-[11px] ${
                    isUnavailable || m.deltaDirection === null || m.deltaDirection === "flat"
                      ? "text-muted-foreground"
                      : isGood
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {m.deltaDirection === "up" && <ArrowUpRight className="h-3 w-3" />}
                  {m.deltaDirection === "down" && <ArrowDownRight className="h-3 w-3" />}
                  {m.deltaDirection === "flat" && <Minus className="h-3 w-3" />}
                  {m.delta}
                </span>

                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    m.qualityState === "OBSERVED"
                      ? "text-muted-foreground/80 bg-secondary/30"
                      : m.qualityState === "LIMITED"
                      ? "text-amber-400 bg-amber-500/10"
                      : m.qualityState === "INSUFFICIENT"
                      ? "text-rose-400 bg-rose-500/10"
                      : "text-zinc-400 bg-zinc-800"
                  }`}
                >
                  {m.qualityLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Primary Chart Area (~300px height) */}
      <div className="border-t border-border/40 pt-4 space-y-3">
        {/* Metric Selector Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center rounded-md border border-border bg-background p-0.5 text-xs">
            {(
              [
                { key: "error_rate", label: "Error rate" },
                { key: "requests", label: "Requests" },
                { key: "p95_latency", label: "P95 latency" },
                { key: "failed_requests", label: "Failed requests" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setActiveMetric(opt.key)}
                className={`rounded px-3 py-1 font-medium transition-all ${
                  activeMetric === opt.key
                    ? "bg-secondary text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" /> Observed value
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500/50" /> Zero observed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-border border border-dashed border-muted-foreground/60" /> Unobserved
            </span>
          </div>
        </div>

        {/* Time Series Canvas */}
        <div className="relative h-[260px] w-full rounded-md border border-border/50 bg-background/40 p-3 flex flex-col justify-end">
          <div className="h-full w-full flex items-end gap-[3px] overflow-hidden">
            {buckets.map((bucket) => {
              const val = getBucketValue(bucket, activeMetric);
              const isNoTelemetry = bucket.state === "NO_TELEMETRY";
              const isZero = bucket.state === "OBSERVED_ZERO" || val === 0;
              const hasVal = typeof val === "number" && val > 0;
              const heightPct = hasVal ? Math.max(6, Math.round((val / maxValue) * 100)) : 0;

              return (
                <div
                  key={bucket.timestamp}
                  className="group relative flex-1 h-full flex items-end justify-center cursor-pointer"
                  onMouseEnter={() => setHoveredBucket(bucket)}
                  onMouseLeave={() => setHoveredBucket(null)}
                >
                  {isNoTelemetry ? (
                    <div className="w-full h-full bg-repeating-linear-gradient opacity-20 border-x border-border/10" />
                  ) : isZero ? (
                    <div className="w-full h-1 bg-emerald-500/40 rounded-t-sm group-hover:h-2 group-hover:bg-emerald-400 transition-all" />
                  ) : (
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-sm transition-all ${
                        activeMetric === "error_rate" || activeMetric === "failed_requests"
                          ? "bg-rose-500/80 group-hover:bg-rose-400"
                          : activeMetric === "p95_latency"
                          ? "bg-blue-500/80 group-hover:bg-blue-400"
                          : "bg-emerald-500/70 group-hover:bg-emerald-400"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Persistent / Hover Tooltip */}
          <div className="mt-2 min-h-[28px] border-t border-border/30 pt-2 flex items-center justify-between text-xs font-mono">
            {hoveredBucket ? (
              <>
                <span className="text-muted-foreground">{hoveredBucket.formattedTime}</span>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-foreground">
                    {metricTitle}: {getBucketValue(hoveredBucket, activeMetric) !== null ? `${getBucketValue(hoveredBucket, activeMetric)}${metricUnit}` : "—"}
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    ({hoveredBucket.dataStateLabel})
                  </span>
                </div>
              </>
            ) : (
              <span className="text-[11px] text-muted-foreground italic">
                Hover over interval buckets to inspect exact timestamps and sample telemetry.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
