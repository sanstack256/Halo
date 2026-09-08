"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { ProjectTrendsData } from "@/lib/metrics/types";

interface ProjectTrendsViewProps {
  data: ProjectTrendsData;
}

export function ProjectTrendsView({ data }: ProjectTrendsViewProps) {
  const { comparisons } = data;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <h3 className="text-base font-semibold text-foreground tracking-tight">
            Longitudinal Project Trajectory
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Holistic direction answering &ldquo;Is this project getting healthier or degrading?&rdquo;
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {comparisons.map((comp) => {
          const isImproving = comp.trendDirection === "improving";
          const isDegrading = comp.trendDirection === "degrading";
          const isInsufficient = comp.trendDirection === "not_enough_telemetry";

          return (
            <div
              key={comp.metricName}
              className="flex flex-col justify-between rounded-lg border border-border/60 bg-background/50 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  {comp.metricName}
                </span>

                {isInsufficient ? (
                  <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Insufficient Baseline
                  </span>
                ) : isImproving ? (
                  <span className="flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                    <TrendingDown className="h-3 w-3" /> Improving
                  </span>
                ) : isDegrading ? (
                  <span className="flex items-center gap-1 rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-400">
                    <TrendingUp className="h-3 w-3" /> Degrading
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <Minus className="h-3 w-3" /> Neutral
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 border-y border-border/40 py-2.5 font-mono text-xs">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Current Window</div>
                  <div className="font-semibold text-foreground text-sm">{comp.currentValue}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">Prior Window</div>
                  <div className="text-muted-foreground text-sm">{comp.previousValue}</div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground leading-snug">
                {comp.commentary}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
