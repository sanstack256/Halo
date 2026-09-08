"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import type { RequestPerformanceData, TimeSeriesBucket } from "@/lib/metrics/types";

interface RequestPerformanceViewProps {
  data: RequestPerformanceData;
}

export function RequestPerformanceView({ data }: RequestPerformanceViewProps) {
  const {
    timeSeries,
    overallThroughputRps,
    overallP50LatencyMs,
    overallP95LatencyMs,
    overallP99LatencyMs,
    sampleSize,
    hasSufficientSample,
  } = data;

  const [activeBucket, setActiveBucket] = useState<TimeSeriesBucket | null>(null);

  const maxLatencyInSeries = Math.max(
    10,
    ...timeSeries
      .map((b) => b.p95LatencyMs)
      .filter((l): l is number => typeof l === "number" && l > 0)
  );

  const maxRequestsInSeries = Math.max(
    1,
    ...timeSeries.map((b) => b.requestCount)
  );

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground tracking-tight">
              Request Performance & Latency Spectrum
            </h3>
            {hasSufficientSample ? (
              <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400">
                {sampleSize} observed requests
              </span>
            ) : (
              <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Insufficient sample size ({sampleSize} requests)
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Throughput (rps) and tail latency percentiles (P50, P75, P95, P99) derived from real trace timings
          </p>
        </div>

        {/* Overall summary stats */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground uppercase">Avg Throughput</div>
            <div className="font-semibold text-foreground">{overallThroughputRps} rps</div>
          </div>
          <div className="h-6 w-[1px] bg-border" />
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground uppercase">P50 Median</div>
            <div className="font-semibold text-foreground">{overallP50LatencyMs !== null ? `${overallP50LatencyMs}ms` : "—"}</div>
          </div>
          <div className="h-6 w-[1px] bg-border" />
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground uppercase">P95 Tail</div>
            <div className="font-semibold text-blue-400">{overallP95LatencyMs !== null ? `${overallP95LatencyMs}ms` : "—"}</div>
          </div>
          <div className="h-6 w-[1px] bg-border" />
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground uppercase">P99 Extreme</div>
            <div className="font-semibold text-purple-400">
              {sampleSize >= 20 && overallP99LatencyMs !== null ? `${overallP99LatencyMs}ms` : "Limited data"}
            </div>
          </div>
        </div>
      </div>

      {/* Latency & Throughput Combined Visualization */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Are requests getting slower? (Latency bars with P95 height)</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-blue-500" /> P95 Latency
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> P50 Median
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500/40" /> Throughput Volume
            </span>
          </div>
        </div>

        <div className="relative h-44 w-full rounded-lg border border-border/40 bg-background/50 p-2 flex items-end gap-1 overflow-hidden">
          {timeSeries.map((bucket) => {
            const hasLat = bucket.p95LatencyMs !== null && bucket.p95LatencyMs > 0;
            const latHeightPct = hasLat ? Math.max(10, Math.min(100, Math.round((bucket.p95LatencyMs! / maxLatencyInSeries) * 100))) : 0;
            const p50HeightPct = bucket.p50LatencyMs !== null ? Math.max(5, Math.min(latHeightPct, Math.round((bucket.p50LatencyMs! / maxLatencyInSeries) * 100))) : 0;
            const reqHeightPct = bucket.requestCount > 0 ? Math.max(4, Math.round((bucket.requestCount / maxRequestsInSeries) * 100)) : 0;

            return (
              <div
                key={bucket.timestamp}
                className="group relative flex-1 h-full flex flex-col justify-end items-center cursor-pointer"
                onMouseEnter={() => setActiveBucket(bucket)}
                onMouseLeave={() => setActiveBucket(null)}
              >
                {/* Volume backdrop column */}
                <div
                  style={{ height: `${reqHeightPct}%` }}
                  className="absolute bottom-0 w-full bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-all rounded-t-sm"
                />

                {/* P95 Latency Bar */}
                {hasLat ? (
                  <div
                    style={{ height: `${latHeightPct}%` }}
                    className="relative w-2/3 max-w-[12px] bg-blue-500/70 group-hover:bg-blue-400 rounded-t-sm transition-all"
                  >
                    {/* Embedded P50 marker */}
                    {p50HeightPct > 0 && (
                      <div
                        style={{ height: `${(p50HeightPct / latHeightPct) * 100}%` }}
                        className="w-full bg-amber-400/80 rounded-t-sm"
                      />
                    )}
                  </div>
                ) : bucket.requestCount > 0 ? (
                  <div className="w-1.5 h-1 bg-muted-foreground/30 rounded-t-sm" />
                ) : (
                  <div className="w-full h-full bg-repeating-linear-gradient opacity-10" />
                )}
              </div>
            );
          })}
        </div>

        {/* Hover inspector */}
        {activeBucket && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono">
            <span className="text-muted-foreground">
              {new Date(activeBucket.timestamp).toLocaleString()}
            </span>
            <div className="flex items-center gap-4">
              <span>Requests: {activeBucket.requestCount}</span>
              <span className="text-amber-400">P50: {activeBucket.p50LatencyMs !== null ? `${activeBucket.p50LatencyMs}ms` : "—"}</span>
              <span className="text-blue-400">P95: {activeBucket.p95LatencyMs !== null ? `${activeBucket.p95LatencyMs}ms` : "—"}</span>
              <span className="text-purple-400">P99: {activeBucket.p99LatencyMs !== null ? `${activeBucket.p99LatencyMs}ms` : "—"}</span>
              <span className={activeBucket.errorRate && activeBucket.errorRate > 0 ? "text-rose-400" : "text-emerald-400"}>
                Fail Rate: {activeBucket.errorRate !== null ? `${activeBucket.errorRate}%` : "0%"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
