"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ObservedChangesData } from "@/lib/metrics/types";

interface ObservedChangesViewProps {
  data: ObservedChangesData;
}

export function ObservedChangesView({ data }: ObservedChangesViewProps) {
  const { state, message, changes } = data;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          OBSERVED CHANGES
        </h3>
        <span className="text-[11px] text-muted-foreground">
          Deterministic shifts evaluated against baseline
        </span>
      </div>

      {state === "insufficient_baseline" ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/70" />
          <span>{message || "Changes not evaluated — insufficient baseline telemetry."}</span>
        </div>
      ) : state === "no_changes" || changes.length === 0 ? (
        <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/70" />
          <span>{message || "No significant observed changes in this interval."}</span>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {changes.map((row, idx) => (
            <div
              key={idx}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs font-mono"
            >
              <div className="flex items-center gap-4">
                <span className="font-semibold text-foreground w-36">
                  {row.metric}
                </span>
                <span className="text-rose-400 font-medium">
                  {row.change}
                </span>
              </div>

              <div className="flex items-center gap-6">
                <span className="text-muted-foreground text-[11px]">
                  {row.time}
                </span>
                <Link
                  href={row.actionHref}
                  className="halo-action-btn"
                >
                  {row.actionLabel}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
