"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";
import type { ErrorBehaviorData, TimeSeriesBucket } from "@/lib/metrics/types";

interface ErrorBehaviorViewProps {
  projectId: string;
  data: ErrorBehaviorData;
}

export function ErrorBehaviorView({ projectId, data }: ErrorBehaviorViewProps) {
  const { timeSeries, topIssues, totalErrors, hasTelemetry } = data;
  const [hoveredBucket, setHoveredBucket] = useState<TimeSeriesBucket | null>(null);

  if (!hasTelemetry && totalErrors === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <AlertTriangle className="mx-auto h-6 w-6 text-muted-foreground/60" />
        <h3 className="mt-2 text-sm font-medium text-foreground">No Error Telemetry Recorded</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Zero error events or failed requests were captured in this time window.
        </p>
      </div>
    );
  }

  const maxErrorsInBucket = Math.max(1, ...timeSeries.map((b) => b.errorCount));

  return (
    <div className="space-y-6">
      {/* Top operational summary & chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground tracking-tight">
                Error Volume Over Time
              </h3>
              <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-400">
                {totalErrors} errors logged
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Bucket-by-bucket distribution of caught exceptions and failed requests
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
              <span className="text-muted-foreground">Observed Errors</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-border border border-dashed border-muted-foreground/40" />
              <span className="text-muted-foreground">No Telemetry Interval</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/40" />
              <span className="text-muted-foreground">Zero Errors (Observed)</span>
            </div>
          </div>
        </div>

        {/* Time-series SVG Chart */}
        <div className="mt-4 relative">
          <div className="h-40 w-full overflow-hidden flex items-end gap-[2px]">
            {timeSeries.map((bucket) => {
              const isZeroObserved = bucket.hasTelemetry && bucket.errorCount === 0;
              const isNoTelemetry = !bucket.hasTelemetry;
              const heightPercent = bucket.hasTelemetry && bucket.errorCount > 0
                ? Math.max(8, Math.round((bucket.errorCount / maxErrorsInBucket) * 100))
                : 0;

              return (
                <div
                  key={bucket.timestamp}
                  className="group relative flex-1 h-full flex items-end justify-center cursor-pointer"
                  onMouseEnter={() => setHoveredBucket(bucket)}
                  onMouseLeave={() => setHoveredBucket(null)}
                >
                  {isNoTelemetry ? (
                    <div className="w-full h-full bg-repeating-linear-gradient opacity-30 border-x border-border/20" />
                  ) : isZeroObserved ? (
                    <div className="w-full h-1 bg-emerald-500/30 rounded-t-sm transition-all group-hover:h-2 group-hover:bg-emerald-400" />
                  ) : (
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full bg-rose-500/80 hover:bg-rose-400 rounded-t-sm transition-all"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Hover details badge */}
          {hoveredBucket && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-background/90 px-3 py-2 text-xs backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground">
                  {new Date(hoveredBucket.timestamp).toLocaleString()}
                </span>
                {!hoveredBucket.hasTelemetry ? (
                  <span className="rounded bg-secondary/50 px-1.5 py-0.5 font-medium text-muted-foreground">
                    NO OBSERVED TELEMETRY
                  </span>
                ) : hoveredBucket.errorCount === 0 ? (
                  <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-400">
                    ZERO ERRORS OBSERVED ({hoveredBucket.requestCount} requests captured)
                  </span>
                ) : (
                  <span className="rounded bg-rose-500/10 px-1.5 py-0.5 font-medium text-rose-400">
                    {hoveredBucket.errorCount} errors ({hoveredBucket.errorRate}% rate)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-muted-foreground font-mono text-[11px]">
                <span>Req: {hoveredBucket.requestCount}</span>
                <span>Failed: {hoveredBucket.failedRequestCount}</span>
                {hoveredBucket.p95LatencyMs !== null && <span>P95: {hoveredBucket.p95LatencyMs}ms</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Error Issues Breakdown Table */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between pb-4 border-b border-border/60">
          <div>
            <h3 className="text-base font-semibold text-foreground tracking-tight">
              Top Error Groups & Regressions
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Highest-frequency issue groupings observed in this active window
            </p>
          </div>
          <Link
            href={`/projects/${projectId}/issues`}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            View All Issues <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {topIssues.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No active grouped issues mapped to these error events.
          </div>
        ) : (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/40 text-muted-foreground">
                  <th className="py-2.5 font-medium">Issue Title</th>
                  <th className="py-2.5 font-medium">Severity</th>
                  <th className="py-2.5 font-medium text-right">Errors</th>
                  <th className="py-2.5 font-medium text-right">Users</th>
                  <th className="py-2.5 font-medium text-right">Sessions</th>
                  <th className="py-2.5 font-medium">First Seen</th>
                  <th className="py-2.5 font-medium">Last Seen</th>
                  <th className="py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {topIssues.map((issue) => (
                  <tr key={issue.id} className="group hover:bg-secondary/10 transition-colors">
                    <td className="py-3 font-medium text-foreground max-w-xs truncate">
                      <Link
                        href={`/projects/${projectId}/issues/${issue.id}`}
                        className="hover:text-primary transition-colors flex items-center gap-1.5"
                      >
                        <span className="truncate">{issue.title}</span>
                      </Link>
                    </td>
                    <td className="py-3">
                      <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-400">
                        {issue.severity}
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono font-medium text-foreground">
                      {issue.errorCount.toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-mono text-muted-foreground">
                      {issue.affectedUsers > 0 ? issue.affectedUsers : "—"}
                    </td>
                    <td className="py-3 text-right font-mono text-muted-foreground">
                      {issue.affectedSessions > 0 ? issue.affectedSessions : "—"}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(issue.firstSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {new Date(issue.lastSeen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/projects/${projectId}/issues/${issue.id}`}
                        className="inline-flex items-center gap-1 rounded border border-border bg-secondary/30 px-2 py-1 text-[11px] font-medium text-primary hover:bg-secondary/60 transition-colors"
                      >
                        Investigate <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
