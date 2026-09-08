"use client";

import { GitBranch, Tag, Calendar, ArrowRight } from "lucide-react";
import type { ReleaseImpactData } from "@/lib/metrics/types";

interface ReleaseImpactViewProps {
  data: ReleaseImpactData;
  selectedRelease?: string;
  onSelectRelease: (version: string) => void;
}

export function ReleaseImpactView({
  data,
  selectedRelease,
  onSelectRelease,
}: ReleaseImpactViewProps) {
  const { releases, hasTelemetry } = data;

  if (!hasTelemetry || releases.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <GitBranch className="mx-auto h-6 w-6 text-muted-foreground/60" />
        <h3 className="mt-2 text-sm font-medium text-foreground">No Releases Tagged</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Telemetry events have not been tagged with release identifiers (e.g. git commit SHA or version string).
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground tracking-tight">
              Release & Deployment Telemetry Correlation
            </h3>
            <span className="rounded-full bg-secondary/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {releases.length} recent releases
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Telemetry observed with associated release tags (correlations strictly reflect observed timestamps, not inferred causation)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {releases.map((rel) => {
          const isSelected = selectedRelease === rel.version;
          const hasErrors = rel.errorCountObserved > 0;

          return (
            <div
              key={rel.version}
              onClick={() => onSelectRelease(isSelected ? "ALL" : rel.version)}
              className={`group flex flex-col justify-between rounded-lg border p-4 cursor-pointer transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                  : "border-border bg-background/50 hover:border-border/80 hover:bg-secondary/15"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm text-foreground font-mono truncate max-w-[170px]">
                      {rel.version}
                    </span>
                  </div>
                  {hasErrors ? (
                    <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400">
                      {rel.errorCountObserved} errors
                    </span>
                  ) : (
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                      0 errors
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  <span>Created {new Date(rel.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="rounded bg-secondary/20 border border-border/30 px-2 py-1 text-[10px] text-muted-foreground">
                  {rel.observationContext}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/40 pt-3 text-center text-xs font-mono">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Requests</div>
                  <div className="font-medium text-foreground">{rel.requestCountObserved.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Fail Rate</div>
                  <div className={`font-medium ${hasErrors ? "text-rose-400" : "text-emerald-400"}`}>
                    {rel.errorRateObserved !== null ? `${rel.errorRateObserved}%` : "0%"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">P95 Tail</div>
                  <div className="font-medium text-foreground">
                    {rel.p95LatencyMsObserved !== null ? `${rel.p95LatencyMsObserved}ms` : "—"}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-primary group-hover:underline pt-1">
                <span>{isSelected ? "Clear release filter" : "Filter metrics by release"}</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
