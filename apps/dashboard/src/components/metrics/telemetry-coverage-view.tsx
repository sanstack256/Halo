"use client";

import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import type { TelemetryCoverageData, CoverageStatus } from "@/lib/metrics/types";

interface TelemetryCoverageViewProps {
  data: TelemetryCoverageData;
}

function StatusBadge({ status }: { status: CoverageStatus }) {
  switch (status) {
    case "OBSERVED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
          <CheckCircle2 className="h-3 w-3" /> OBSERVED
        </span>
      );
    case "PARTIAL":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-400">
          <Info className="h-3 w-3" /> PARTIAL
        </span>
      );
    case "LIMITED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
          <AlertTriangle className="h-3 w-3" /> LIMITED
        </span>
      );
    case "NOT CAPTURED":
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800/80 px-2 py-0.5 text-[11px] font-semibold text-zinc-400">
          <XCircle className="h-3 w-3" /> NOT CAPTURED
        </span>
      );
  }
}

export function TelemetryCoverageView({ data }: TelemetryCoverageViewProps) {
  const { dimensions, overallObservationTier, observedTelemetryGaps } = data;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground tracking-tight">
              Telemetry Coverage & Evidence Quality
            </h3>
            <StatusBadge status={overallObservationTier} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit of observable signals to prevent mistaking &ldquo;No evidence&rdquo; for &ldquo;No problem&rdquo;
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {dimensions.map((dim) => (
          <div
            key={dim.name}
            className="flex flex-col justify-between rounded-lg border border-border/60 bg-background/50 p-3.5 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">{dim.name}</span>
              <StatusBadge status={dim.status} />
            </div>

            <p className="text-[11px] text-muted-foreground">{dim.description}</p>

            <div className="border-t border-border/40 pt-2 font-mono text-[11px] text-muted-foreground">
              {dim.details}
            </div>
          </div>
        ))}
      </div>

      {observedTelemetryGaps.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-medium text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Identified Telemetry Observation Gaps:</span>
          </div>
          <ul className="list-inside list-disc text-muted-foreground space-y-0.5 text-[11px]">
            {observedTelemetryGaps.map((gap, i) => (
              <li key={i}>{gap}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
