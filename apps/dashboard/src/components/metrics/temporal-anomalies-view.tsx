"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { TemporalAnomaliesData } from "@/lib/metrics/types";

interface TemporalAnomaliesViewProps {
  data: TemporalAnomaliesData;
}

export function TemporalAnomaliesView({ data }: TemporalAnomaliesViewProps) {
  const { anomalies, detectionPeriodLabel, evaluationNote } = data;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground tracking-tight">
              Temporal Anomalies & Observed Deviations
            </h3>
            <span className="rounded-full bg-secondary/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {anomalies.length} deviations detected
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{detectionPeriodLabel}</p>
        </div>
      </div>

      {anomalies.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <div>
            <div className="font-medium text-emerald-400">No Statistical Deviations Observed</div>
            <div className="text-muted-foreground mt-0.5">
              Observed error rates, request throughput, and latency percentiles remained within expected variance relative to baseline.
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {anomalies.map((anom) => (
            <div
              key={anom.id}
              className="flex flex-col justify-between rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 space-y-2 sm:flex-row sm:items-center sm:space-y-0"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span className="text-sm font-semibold text-foreground">{anom.title}</span>
                  <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-300">
                    {anom.severity}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{anom.description}</p>
                <div className="font-mono text-[11px] text-muted-foreground">
                  <span className="text-rose-400 font-semibold">Evidence: </span>
                  {anom.evidenceValue} vs <span className="text-foreground">{anom.baselineValue}</span>
                </div>
              </div>

              <div className="text-right text-[11px] font-mono text-muted-foreground sm:pl-4">
                <div className="text-[10px] uppercase">Rule Triggered</div>
                <div className="text-xs text-muted-foreground/80">{anom.ruleTriggered}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-[11px] text-muted-foreground/80 italic">
        {evaluationNote}
      </div>
    </div>
  );
}
