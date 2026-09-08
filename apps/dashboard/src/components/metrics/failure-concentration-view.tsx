"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { FailureConcentrationData } from "@/lib/metrics/types";

interface FailureConcentrationViewProps {
  data: FailureConcentrationData;
}

export function FailureConcentrationView({ data }: FailureConcentrationViewProps) {
  const [activeDimension, setActiveDimension] = useState<"endpoint" | "service" | "error_type">(
    "endpoint"
  );

  const { endpointAttributionAvailable, totalErrors, byEndpoint, byService, byErrorType } = data;

  const rows =
    activeDimension === "endpoint"
      ? byEndpoint
      : activeDimension === "service"
      ? byService
      : byErrorType;

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      {/* Header and Dimension Control */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div>
          <h3 className="text-base font-semibold text-foreground tracking-tight">
            FAILURE CONCENTRATION
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Where observed failures are concentrated
          </p>
        </div>

        <div className="flex items-center rounded-md border border-border bg-background p-0.5 text-xs">
          {(
            [
              { key: "endpoint", label: "Endpoint" },
              { key: "service", label: "Service" },
              { key: "error_type", label: "Error type" },
            ] as const
          ).map((dim) => (
            <button
              key={dim.key}
              type="button"
              onClick={() => setActiveDimension(dim.key)}
              className={`rounded px-3 py-1 font-medium transition-all ${
                activeDimension === dim.key
                  ? "bg-secondary text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {dim.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      {activeDimension === "endpoint" && !endpointAttributionAvailable ? (
        <div className="rounded-md border border-border/40 bg-secondary/10 p-6 text-center space-y-1.5">
          <div className="text-xs font-semibold text-foreground">
            Endpoint unavailable in captured telemetry
          </div>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Captured error events in this interval lack route, operation, or resource attributes.
            Switch to <strong>Service</strong> or <strong>Error type</strong> above to inspect failure distribution.
          </p>
        </div>
      ) : totalErrors === 0 || rows.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          Zero error events captured in this interval.
        </div>
      ) : (
        <div className="space-y-2.5 pt-1">
          {rows.map((row) => (
            <div key={row.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2 max-w-[65%] truncate">
                  <span className="text-muted-foreground text-[11px] w-5">
                    #{row.rank}
                  </span>
                  <span className="font-semibold text-foreground truncate">
                    {row.name}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <span className="text-muted-foreground">
                    {row.errorCount.toLocaleString()} errors
                  </span>
                  <span className="text-rose-400 font-semibold w-12">
                    {row.percentageOfTotalErrors}%
                  </span>
                  {row.affectedUsers !== null && (
                    <span className="text-muted-foreground text-[11px] hidden sm:inline">
                      {row.affectedUsers} users
                    </span>
                  )}
                  <Link
                    href={row.actionHref}
                    className="text-primary hover:underline text-[11px] font-sans font-medium inline-flex items-center gap-0.5"
                  >
                    View <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {/* Proportional Bar */}
              <div className="h-1.5 w-full rounded-full bg-secondary/30 overflow-hidden">
                <div
                  style={{ width: `${Math.max(2, row.percentageOfTotalErrors)}%` }}
                  className="h-full rounded-full bg-rose-500/80 transition-all duration-300"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
