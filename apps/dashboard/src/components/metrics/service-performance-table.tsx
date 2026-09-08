"use client";

import { ArrowRight } from "lucide-react";
import type { ServicePerformanceData } from "@/lib/metrics/types";

interface ServicePerformanceTableProps {
  data: ServicePerformanceData;
  onSelectService: (serviceName: string) => void;
}

export function ServicePerformanceTable({
  data,
  onSelectService,
}: ServicePerformanceTableProps) {
  const { services, hasTelemetry } = data;

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-3">
      <div className="border-b border-border/50 pb-2.5">
        <h3 className="text-base font-semibold text-foreground tracking-tight">
          SERVICE PERFORMANCE
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Observed request and failure behavior by service
        </p>
      </div>

      {!hasTelemetry || services.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          Zero service operations captured in this interval.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/50 text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2.5 font-medium">SERVICE</th>
                <th className="py-2.5 font-medium text-right">REQUESTS</th>
                <th className="py-2.5 font-medium text-right">ERRORS</th>
                <th className="py-2.5 font-medium text-right">ERROR RATE</th>
                <th className="py-2.5 font-medium text-right">P95</th>
                <th className="py-2.5 font-medium text-right">AFFECTED USERS</th>
                <th className="py-2.5 font-medium text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {services.map((row) => (
                <tr
                  key={row.service}
                  className="h-[52px] hover:bg-secondary/15 transition-colors font-mono"
                >
                  <td className="py-3 font-semibold text-foreground max-w-[200px] truncate">
                    {row.service}
                  </td>
                  <td className="py-3 text-right text-foreground">
                    {row.requests > 0 ? row.requests.toLocaleString() : "—"}
                  </td>
                  <td className="py-3 text-right text-rose-400 font-semibold">
                    {row.errors > 0 ? row.errors.toLocaleString() : "0"}
                  </td>
                  <td className="py-3 text-right">
                    {row.errorRate !== null ? `${row.errorRate}%` : "—"}
                  </td>
                  <td className="py-3 text-right">
                    {row.p95LatencyMs !== null ? `${row.p95LatencyMs}ms` : "—"}
                  </td>
                  <td className="py-3 text-right text-muted-foreground">
                    {row.affectedUsers !== null ? row.affectedUsers : "—"}
                  </td>
                  <td className="py-3 text-right font-sans">
                    <button
                      type="button"
                      onClick={() => onSelectService(row.service)}
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
      )}
    </div>
  );
}
