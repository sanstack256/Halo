"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import type {
  PrimaryTelemetryOverviewData,
  PrimaryChartBucket,
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
  // Synchronized hovered bucket index across all 4 charts
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const metricsList = [
    overview.errorRate,
    overview.requests,
    overview.p95Latency,
    overview.affectedUsers,
  ];

  const hoveredBucket = hoveredIndex !== null && buckets[hoveredIndex] ? buckets[hoveredIndex] : null;

  // Global maximums for proportional bar scaling
  const maxRequests = Math.max(1, ...buckets.map((b) => b.requestCount));
  const maxFailed = Math.max(1, ...buckets.map((b) => b.failedRequestCount));
  const latencies = buckets
    .map((b) => b.p95LatencyMs)
    .filter((v): v is number => typeof v === "number" && !isNaN(v));
  const maxLatency = latencies.length > 0 ? Math.max(10, ...latencies) : 100;

  // Compute total failed requests across the interval for summary display
  const totalFailedRequests = buckets.reduce((sum, b) => sum + b.failedRequestCount, 0);

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-6">
      {/* 1. Section Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            TELEMETRY OVERVIEW
          </h2>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {timeRangeLabel}
        </span>
      </div>

      {/* 2. Exactly 4 Primary Metrics in One Horizontal Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border/40">
        {metricsList.map((m, idx) => {
          const isGood = m.isImprovement;
          const isUnavailable =
            m.delta === "Baseline unavailable" || m.delta === "Insufficient baseline";

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
                  className={`font-mono text-[11px] ${
                    isUnavailable || m.isImprovement === null
                      ? "text-muted-foreground"
                      : isGood
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
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

      {/* 3. PROJECT TELEMETRY — FOUR SIMULTANEOUS CORRELATED GRAPHS */}
      <div className="border-t border-border/50 pt-5 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-foreground">
              PROJECT TELEMETRY
            </h3>
            <p className="text-xs text-muted-foreground">
              Correlated temporal behavior across error rate, volume, latency, and failures
            </p>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" /> Observed value
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400/80" /> Zero observed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm border border-dashed border-muted-foreground/60 bg-muted/30" /> Unobserved / No telemetry
            </span>
          </div>
        </div>

        {!overview.hasTelemetry || buckets.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-8 text-center space-y-2 bg-background/30">
            <AlertCircle className="h-6 w-6 text-muted-foreground mx-auto" />
            <div className="text-sm font-semibold text-foreground">NO OBSERVED TELEMETRY</div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No project telemetry was captured in the selected interval.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* GRAPH 1: ERROR RATE */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[11px] uppercase tracking-wider text-muted-foreground">
                    ERROR RATE
                  </span>
                  <span className="font-mono font-semibold text-foreground">
                    {overview.errorRate.value}
                  </span>
                </div>

                <div className="font-mono text-[11px] text-muted-foreground">
                  {hoveredBucket ? (
                    hoveredBucket.errorRate !== null ? (
                      <span className="text-rose-400 font-semibold">
                        {hoveredBucket.formattedTime}: {hoveredBucket.errorRate.toFixed(1)}% ({hoveredBucket.failedRequestCount} failed / {hoveredBucket.requestCount} requests)
                      </span>
                    ) : hoveredBucket.state === "INVALID_DENOMINATOR" ? (
                      <span className="text-amber-400 font-medium">
                        {hoveredBucket.formattedTime}: Undefined ({hoveredBucket.errorCount} standalone errors, 0 requests)
                      </span>
                    ) : hoveredBucket.state === "OBSERVED_ZERO" ? (
                      <span className="text-emerald-400 font-medium">
                        {hoveredBucket.formattedTime}: 0.0% (0 failed of {hoveredBucket.requestCount} requests)
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">
                        {hoveredBucket.formattedTime}: No telemetry observed
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-muted-foreground/70">
                      Hover bucket to inspect rate
                    </span>
                  )}
                </div>
              </div>

              <div className="relative h-[180px] w-full rounded-md border border-border/50 bg-background/40 p-3 flex flex-col justify-end">
                {/* Y-axis indicator */}
                <div className="absolute right-2 top-2 text-[10px] font-mono text-muted-foreground/60 select-none">
                  100%
                </div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground/40 select-none">
                  50%
                </div>
                <div className="absolute right-2 bottom-6 text-[10px] font-mono text-muted-foreground/60 select-none">
                  0%
                </div>

                {/* Horizontal reference lines */}
                <div className="absolute inset-x-3 top-2 border-b border-border/20" />
                <div className="absolute inset-x-3 top-1/2 border-b border-border/15" />
                <div className="absolute inset-x-3 bottom-6 border-b border-border/30" />

                {/* Bar series */}
                <div className="h-[140px] w-full flex items-end gap-[2px] z-10">
                  {buckets.map((b, idx) => {
                    const isHovered = hoveredIndex === idx;
                    const isNoTelem = b.state === "NO_TELEMETRY";
                    const isInvalidDenom = b.state === "INVALID_DENOMINATOR";
                    const isZero = b.state === "OBSERVED_ZERO" || b.errorRate === 0;
                    const hasVal = typeof b.errorRate === "number" && b.errorRate > 0;
                    const heightPct = hasVal ? Math.max(6, Math.min(100, Math.round(b.errorRate!))) : 0;

                    return (
                      <div
                        key={b.timestamp}
                        className={`group relative flex-1 h-full flex items-end justify-center cursor-pointer transition-colors ${
                          isHovered ? "bg-secondary/40 ring-1 ring-primary/40 rounded-sm" : ""
                        }`}
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        {isNoTelem ? (
                          <div className="w-full h-full border-x border-border/10 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.02)_4px,rgba(255,255,255,0.02)_8px)]" />
                        ) : isInvalidDenom ? (
                          <div className="w-full h-3 bg-amber-500/30 border-t border-dashed border-amber-400/60 rounded-t-sm" />
                        ) : isZero ? (
                          <div className="w-full h-1 bg-emerald-400/80 rounded-t-sm group-hover:h-2 transition-all" />
                        ) : (
                          <div
                            style={{ height: `${heightPct}%` }}
                            className="w-full bg-rose-500/80 hover:bg-rose-400 rounded-t-sm transition-all"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SEPARATOR */}
            <div className="border-t border-border/30" />

            {/* GRAPH 2: REQUEST VOLUME */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[11px] uppercase tracking-wider text-muted-foreground">
                    REQUEST VOLUME
                  </span>
                  <span className="font-mono font-semibold text-foreground">
                    {overview.requests.value} requests
                  </span>
                </div>

                <div className="font-mono text-[11px] text-muted-foreground">
                  {hoveredBucket ? (
                    hoveredBucket.state === "NO_TELEMETRY" ? (
                      <span className="text-muted-foreground italic">
                        {hoveredBucket.formattedTime}: No telemetry observed
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-semibold">
                        {hoveredBucket.formattedTime}: {hoveredBucket.requestCount.toLocaleString()} requests observed
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-muted-foreground/70">
                      Hover bucket to inspect volume
                    </span>
                  )}
                </div>
              </div>

              <div className="relative h-[180px] w-full rounded-md border border-border/50 bg-background/40 p-3 flex flex-col justify-end">
                {/* Y-axis indicator */}
                <div className="absolute right-2 top-2 text-[10px] font-mono text-muted-foreground/60 select-none">
                  {maxRequests.toLocaleString()}
                </div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground/40 select-none">
                  {Math.round(maxRequests / 2).toLocaleString()}
                </div>
                <div className="absolute right-2 bottom-6 text-[10px] font-mono text-muted-foreground/60 select-none">
                  0
                </div>

                {/* Horizontal reference lines */}
                <div className="absolute inset-x-3 top-2 border-b border-border/20" />
                <div className="absolute inset-x-3 top-1/2 border-b border-border/15" />
                <div className="absolute inset-x-3 bottom-6 border-b border-border/30" />

                {/* Bar series */}
                <div className="h-[140px] w-full flex items-end gap-[2px] z-10">
                  {buckets.map((b, idx) => {
                    const isHovered = hoveredIndex === idx;
                    const isNoTelem = b.state === "NO_TELEMETRY";
                    const isZero = b.state === "OBSERVED_ZERO" || b.requestCount === 0;
                    const heightPct = b.requestCount > 0 ? Math.max(6, Math.min(100, Math.round((b.requestCount / maxRequests) * 100))) : 0;

                    return (
                      <div
                        key={b.timestamp}
                        className={`group relative flex-1 h-full flex items-end justify-center cursor-pointer transition-colors ${
                          isHovered ? "bg-secondary/40 ring-1 ring-primary/40 rounded-sm" : ""
                        }`}
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        {isNoTelem ? (
                          <div className="w-full h-full border-x border-border/10 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.02)_4px,rgba(255,255,255,0.02)_8px)]" />
                        ) : isZero ? (
                          <div className="w-full h-1 bg-emerald-400/80 rounded-t-sm group-hover:h-2 transition-all" />
                        ) : (
                          <div
                            style={{ height: `${heightPct}%` }}
                            className="w-full bg-emerald-500/80 hover:bg-emerald-400 rounded-t-sm transition-all"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SEPARATOR */}
            <div className="border-t border-border/30" />

            {/* GRAPH 3: P95 LATENCY */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[11px] uppercase tracking-wider text-muted-foreground">
                    P95 LATENCY
                  </span>
                  <span className="font-mono font-semibold text-foreground">
                    {overview.p95Latency.value}
                  </span>
                </div>

                <div className="font-mono text-[11px] text-muted-foreground">
                  {hoveredBucket ? (
                    hoveredBucket.p95LatencyMs !== null ? (
                      <span className="text-blue-400 font-semibold">
                        {hoveredBucket.formattedTime}: {hoveredBucket.p95LatencyMs}ms (P50: {hoveredBucket.p50LatencyMs ?? "—"}ms, P99: {hoveredBucket.p99LatencyMs ?? "—"}ms)
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">
                        {hoveredBucket.formattedTime}: No observed latency samples
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-muted-foreground/70">
                      Hover bucket to inspect latency
                    </span>
                  )}
                </div>
              </div>

              <div className="relative h-[180px] w-full rounded-md border border-border/50 bg-background/40 p-3 flex flex-col justify-end">
                {/* Y-axis indicator */}
                <div className="absolute right-2 top-2 text-[10px] font-mono text-muted-foreground/60 select-none">
                  {maxLatency}ms
                </div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground/40 select-none">
                  {Math.round(maxLatency / 2)}ms
                </div>
                <div className="absolute right-2 bottom-6 text-[10px] font-mono text-muted-foreground/60 select-none">
                  0ms
                </div>

                {/* Horizontal reference lines */}
                <div className="absolute inset-x-3 top-2 border-b border-border/20" />
                <div className="absolute inset-x-3 top-1/2 border-b border-border/15" />
                <div className="absolute inset-x-3 bottom-6 border-b border-border/30" />

                {/* Bar / line point series */}
                <div className="h-[140px] w-full flex items-end gap-[2px] z-10">
                  {buckets.map((b, idx) => {
                    const isHovered = hoveredIndex === idx;
                    const hasP95 = typeof b.p95LatencyMs === "number" && b.p95LatencyMs > 0;
                    const heightPct = hasP95 ? Math.max(6, Math.min(100, Math.round((b.p95LatencyMs! / maxLatency) * 100))) : 0;

                    return (
                      <div
                        key={b.timestamp}
                        className={`group relative flex-1 h-full flex items-end justify-center cursor-pointer transition-colors ${
                          isHovered ? "bg-secondary/40 ring-1 ring-primary/40 rounded-sm" : ""
                        }`}
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        {!hasP95 ? (
                          <div className="w-full h-full border-x border-border/10 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.02)_4px,rgba(255,255,255,0.02)_8px)]" />
                        ) : (
                          <div
                            style={{ height: `${heightPct}%` }}
                            className="w-full bg-blue-500/80 hover:bg-blue-400 rounded-t-sm transition-all"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SEPARATOR */}
            <div className="border-t border-border/30" />

            {/* GRAPH 4: FAILED REQUESTS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[11px] uppercase tracking-wider text-muted-foreground">
                    FAILED REQUESTS
                  </span>
                  <span className="font-mono font-semibold text-foreground">
                    {totalFailedRequests.toLocaleString()} failures
                  </span>
                </div>

                <div className="font-mono text-[11px] text-muted-foreground">
                  {hoveredBucket ? (
                    hoveredBucket.state === "NO_TELEMETRY" ? (
                      <span className="text-muted-foreground italic">
                        {hoveredBucket.formattedTime}: No telemetry observed
                      </span>
                    ) : hoveredBucket.failedRequestCount === 0 ? (
                      <span className="text-emerald-400 font-medium">
                        {hoveredBucket.formattedTime}: 0 failures ({hoveredBucket.requestCount} requests)
                      </span>
                    ) : (
                      <span className="text-rose-400 font-semibold">
                        {hoveredBucket.formattedTime}: {hoveredBucket.failedRequestCount} failed requests of {hoveredBucket.requestCount}
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-muted-foreground/70">
                      Hover bucket to inspect failure count
                    </span>
                  )}
                </div>
              </div>

              <div className="relative h-[180px] w-full rounded-md border border-border/50 bg-background/40 p-3 flex flex-col justify-end">
                {/* Y-axis indicator */}
                <div className="absolute right-2 top-2 text-[10px] font-mono text-muted-foreground/60 select-none">
                  {maxFailed.toLocaleString()}
                </div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground/40 select-none">
                  {Math.round(maxFailed / 2).toLocaleString()}
                </div>
                <div className="absolute right-2 bottom-6 text-[10px] font-mono text-muted-foreground/60 select-none">
                  0
                </div>

                {/* Horizontal reference lines */}
                <div className="absolute inset-x-3 top-2 border-b border-border/20" />
                <div className="absolute inset-x-3 top-1/2 border-b border-border/15" />
                <div className="absolute inset-x-3 bottom-6 border-b border-border/30" />

                {/* Bar series */}
                <div className="h-[140px] w-full flex items-end gap-[2px] z-10">
                  {buckets.map((b, idx) => {
                    const isHovered = hoveredIndex === idx;
                    const isNoTelem = b.state === "NO_TELEMETRY";
                    const isZero = b.state === "OBSERVED_ZERO" || b.failedRequestCount === 0;
                    const heightPct = b.failedRequestCount > 0 ? Math.max(6, Math.min(100, Math.round((b.failedRequestCount / maxFailed) * 100))) : 0;

                    return (
                      <div
                        key={b.timestamp}
                        className={`group relative flex-1 h-full flex items-end justify-center cursor-pointer transition-colors ${
                          isHovered ? "bg-secondary/40 ring-1 ring-primary/40 rounded-sm" : ""
                        }`}
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                        {isNoTelem ? (
                          <div className="w-full h-full border-x border-border/10 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.02)_4px,rgba(255,255,255,0.02)_8px)]" />
                        ) : isZero ? (
                          <div className="w-full h-1 bg-emerald-400/80 rounded-t-sm group-hover:h-2 transition-all" />
                        ) : (
                          <div
                            style={{ height: `${heightPct}%` }}
                            className="w-full bg-rose-500/80 hover:bg-rose-400 rounded-t-sm transition-all"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SHARED TIME AXIS LABELS */}
            {buckets.length > 0 && (
              <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-1 px-3 border-t border-border/40">
                <span>{buckets[0].formattedTime}</span>
                {buckets.length > 2 && (
                  <span>{buckets[Math.floor(buckets.length / 2)].formattedTime}</span>
                )}
                <span>{buckets[buckets.length - 1].formattedTime}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
