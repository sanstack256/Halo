"use client";

import type { LongTermTrendData } from "@/lib/metrics/types";

interface ProjectTrendViewProps {
  data: LongTermTrendData;
}

export function ProjectTrendView({ data }: ProjectTrendViewProps) {
  const { rows } = data;

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-3">
      <div className="border-b border-border/50 pb-2.5">
        <h3 className="text-base font-semibold text-foreground tracking-tight">
          PROJECT TREND
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Current period compared with the previous equivalent period
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-border/50 text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="py-2.5 font-medium">METRIC</th>
              <th className="py-2.5 font-medium text-right">CURRENT</th>
              <th className="py-2.5 font-medium text-right">PREVIOUS</th>
              <th className="py-2.5 font-medium text-right">DELTA</th>
              <th className="py-2.5 font-medium text-right">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {rows.map((row) => (
              <tr key={row.metricName} className="h-12 hover:bg-secondary/15 transition-colors">
                <td className="py-3 font-semibold text-foreground">
                  {row.metricName}
                </td>
                <td className="py-3 text-right text-foreground">
                  {row.current}
                </td>
                <td className="py-3 text-right text-muted-foreground">
                  {row.previous}
                </td>
                <td className="py-3 text-right">
                  {row.delta !== "—" ? (
                    <span className={row.delta.startsWith("↑") ? "text-rose-400" : "text-emerald-400"}>
                      {row.delta}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-3 text-right font-sans">
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded ${
                      row.status === "Improving"
                        ? "text-emerald-400 bg-emerald-500/10 font-medium"
                        : row.status === "Degrading"
                        ? "text-rose-400 bg-rose-500/10 font-medium"
                        : "text-muted-foreground bg-secondary/30"
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
