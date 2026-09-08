"use client";

import type { TelemetryCoverageData, CoverageState } from "@/lib/metrics/types";

interface TelemetryCoverageMatrixProps {
  data: TelemetryCoverageData;
}

function CoverageBadge({ state }: { state: CoverageState }) {
  switch (state) {
    case "OBSERVED":
      return (
        <span className="text-[11px] font-mono font-medium text-muted-foreground bg-secondary/30 px-2 py-0.5 rounded">
          OBSERVED
        </span>
      );
    case "PARTIAL":
      return (
        <span className="text-[11px] font-mono font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
          PARTIAL
        </span>
      );
    case "LIMITED":
      return (
        <span className="text-[11px] font-mono font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
          LIMITED
        </span>
      );
    case "NOT CAPTURED":
      return (
        <span className="text-[11px] font-mono font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
          NOT CAPTURED
        </span>
      );
    case "UNAVAILABLE":
    default:
      return (
        <span className="text-[11px] font-mono font-medium text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
          UNAVAILABLE
        </span>
      );
  }
}

export function TelemetryCoverageMatrix({ data }: TelemetryCoverageMatrixProps) {
  const { signals } = data;

  // Split into 2 columns (4 items each)
  const col1 = signals.slice(0, 4);
  const col2 = signals.slice(4, 8);

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="border-b border-border/50 pb-2.5">
        <h3 className="text-base font-semibold text-foreground tracking-tight">
          TELEMETRY COVERAGE
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Audit of observable telemetry signals to prevent mistaking absence of evidence for absence of issues
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Column 1 */}
        <div className="divide-y divide-border/30">
          {col1.map((item) => (
            <div
              key={item.signal}
              className="flex items-center justify-between py-2.5 text-xs font-mono"
            >
              <div className="space-y-0.5">
                <div className="font-medium text-foreground">{item.signal}</div>
                <div className="text-[11px] text-muted-foreground font-sans">
                  {item.detail}
                </div>
              </div>
              <div className="text-right">
                <CoverageBadge state={item.state} />
              </div>
            </div>
          ))}
        </div>

        {/* Column 2 */}
        <div className="divide-y divide-border/30">
          {col2.map((item) => (
            <div
              key={item.signal}
              className="flex items-center justify-between py-2.5 text-xs font-mono"
            >
              <div className="space-y-0.5">
                <div className="font-medium text-foreground">{item.signal}</div>
                <div className="text-[11px] text-muted-foreground font-sans">
                  {item.detail}
                </div>
              </div>
              <div className="text-right">
                <CoverageBadge state={item.state} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
