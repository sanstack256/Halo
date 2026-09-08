"use client";

import { useState } from "react";
import { Layers, Network, Server, Bug } from "lucide-react";
import type { ErrorConcentrationData, ErrorConcentrationItem } from "@/lib/metrics/types";

interface ErrorConcentrationViewProps {
  data: ErrorConcentrationData;
}

export function ErrorConcentrationView({ data }: ErrorConcentrationViewProps) {
  const { byEndpoint, byService, byErrorType, totalErrorsObserved, hasTelemetry } = data;
  const [activeTab, setActiveTab] = useState<"endpoint" | "service" | "error_type">("endpoint");

  if (!hasTelemetry || totalErrorsObserved === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <Layers className="mx-auto h-6 w-6 text-muted-foreground/60" />
        <h3 className="mt-2 text-sm font-medium text-foreground">No Error Concentration</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Zero errors were observed in this time window to analyze failure distribution.
        </p>
      </div>
    );
  }

  const items: ErrorConcentrationItem[] =
    activeTab === "endpoint"
      ? byEndpoint
      : activeTab === "service"
      ? byService
      : byErrorType;

  const maxErrorCount = Math.max(1, ...items.map((i) => i.errorCount));

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground tracking-tight">
              Failure Concentration & Hotspots
            </h3>
            <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-medium text-rose-400">
              {totalErrorsObserved} total errors
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ranked distribution answering &ldquo;Where are most failures happening?&rdquo;
          </p>
        </div>

        {/* Dimension selector tabs */}
        <div className="flex items-center rounded-lg border border-border bg-background p-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("endpoint")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeTab === "endpoint"
                ? "bg-secondary text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Network className="h-3.5 w-3.5" />
            <span>By Endpoint</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("service")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeTab === "service"
                ? "bg-secondary text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Server className="h-3.5 w-3.5" />
            <span>By Service</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("error_type")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
              activeTab === "error_type"
                ? "bg-secondary text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bug className="h-3.5 w-3.5" />
            <span>By Error Type</span>
          </button>
        </div>
      </div>

      {/* Ranked Horizontal Bars */}
      <div className="space-y-3 pt-1">
        {items.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No failures mapped to this dimension in current window.
          </div>
        ) : (
          items.map((item, idx) => {
            const barWidthPct = Math.max(8, Math.round((item.errorCount / maxErrorCount) * 100));

            return (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 max-w-[70%]">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <span className="font-mono font-medium text-foreground truncate">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <span className="font-semibold text-foreground">
                      {item.errorCount.toLocaleString()} errors
                    </span>
                    <span className="text-muted-foreground text-[11px] w-12 text-right">
                      {item.percentageOfTotalErrors}%
                    </span>
                  </div>
                </div>

                <div className="h-2 w-full rounded-full bg-secondary/30 overflow-hidden">
                  <div
                    style={{ width: `${barWidthPct}%` }}
                    className="h-full rounded-full bg-gradient-to-r from-rose-500/80 to-rose-400 transition-all duration-300"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
