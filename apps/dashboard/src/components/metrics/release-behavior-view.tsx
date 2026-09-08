"use client";

import { Tag, ArrowRight } from "lucide-react";
import type { ReleaseBehaviorData } from "@/lib/metrics/types";

interface ReleaseBehaviorViewProps {
  data: ReleaseBehaviorData;
  onSelectRelease: (version: string) => void;
}

export function ReleaseBehaviorView({
  data,
  onSelectRelease,
}: ReleaseBehaviorViewProps) {
  const { releases, timelineMarkers, hasTelemetry } = data;

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="border-b border-border/50 pb-2.5">
        <h3 className="text-base font-semibold text-foreground tracking-tight">
          RELEASE BEHAVIOR
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Observed telemetry across releases (correlations reflect observed timestamps, not inferred causation)
        </p>
      </div>

      {!hasTelemetry || releases.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No releases with captured telemetry found in this interval.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Horizontal Release Timeline (~120px) */}
          <div className="relative rounded-md border border-border/40 bg-background/30 p-3 h-[110px] flex flex-col justify-between">
            <div className="text-[11px] text-muted-foreground font-mono">
              Observed Release Markers on Timeline
            </div>

            <div className="relative w-full h-8 flex items-center">
              <div className="absolute w-full h-[1px] bg-border/60" />
              <div className="relative w-full flex justify-around items-center">
                {timelineMarkers.slice(0, 6).map((marker) => (
                  <div key={marker.version} className="flex flex-col items-center group cursor-pointer" onClick={() => onSelectRelease(marker.version)}>
                    <div className="h-2.5 w-2.5 rounded-full bg-primary border-2 border-background ring-2 ring-primary/20 group-hover:scale-125 transition-transform" />
                    <span className="mt-1 font-mono text-[10px] text-foreground font-medium group-hover:text-primary transition-colors">
                      {marker.version}
                    </span>
                    <span className="text-[9px] text-muted-foreground hidden sm:block">
                      {marker.deployedAt}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[10px] text-muted-foreground/70 text-right italic">
              Observed after release
            </div>
          </div>

          {/* Compact Release Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2.5 font-medium">RELEASE</th>
                  <th className="py-2.5 font-medium">DEPLOYED</th>
                  <th className="py-2.5 font-medium text-right">REQUESTS</th>
                  <th className="py-2.5 font-medium text-right">FAILED REQ</th>
                  <th className="py-2.5 font-medium text-right">ERROR EVENTS</th>
                  <th className="py-2.5 font-medium text-right">ERROR RATE</th>
                  <th className="py-2.5 font-medium text-right">P95</th>
                  <th className="py-2.5 font-medium text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {releases.slice(0, 6).map((rel) => (
                  <tr key={rel.version} className="h-12 hover:bg-secondary/15 transition-colors font-mono">
                    <td className="py-2.5 font-semibold text-foreground">
                      <div className="flex items-center gap-1.5">
                        <Tag className="h-3 w-3 text-primary" />
                        <span>{rel.version}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      {rel.deployedAt}
                    </td>
                    <td className="py-2.5 text-right text-foreground">
                      {rel.requestCount.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right text-rose-400 font-semibold">
                      {rel.failedRequestCount.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right text-amber-400">
                      {rel.errorCount.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right">
                      {rel.errorRate !== null ? `${rel.errorRate}%` : "—"}
                    </td>
                    <td className="py-2.5 text-right">
                      {rel.p95LatencyMs !== null ? `${rel.p95LatencyMs}ms` : "—"}
                    </td>
                    <td className="py-2.5 text-right font-sans">
                      <button
                        type="button"
                        onClick={() => onSelectRelease(rel.version)}
                        className="text-primary hover:underline text-xs font-medium inline-flex items-center gap-1"
                      >
                        Filter <ArrowRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
