"use client";

import { ArrowDownRight, ArrowUpRight, Minus, CheckCircle2, AlertCircle } from "lucide-react";
import type { ProjectHealthSnapshot as HealthSnapshotData, MetricComparison } from "@/lib/metrics/types";

interface ProjectHealthSnapshotProps {
  snapshot: HealthSnapshotData;
  timeRangeLabel: string;
}

function MetricCard({
  title,
  formattedCurrent,
  unit = "",
  comparison,
  isRateMetric = false,
  insufficientSample = false,
  sampleDetail,
}: {
  title: string;
  formattedCurrent: string;
  unit?: string;
  comparison: MetricComparison;
  isRateMetric?: boolean;
  insufficientSample?: boolean;
  sampleDetail?: string;
}) {
  const hasBaseline = comparison.sufficientBaseline && comparison.previous !== null;
  const delta = isRateMetric
    ? comparison.percentagePointsDiff
    : comparison.relativeDiffPct;

  const isGood = comparison.isImprovement;

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all hover:border-border/80">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {insufficientSample && (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
            Limited Sample
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {formattedCurrent}
        </span>
        {unit && <span className="text-xs font-normal text-muted-foreground">{unit}</span>}
      </div>

      <div className="mt-3 border-t border-border/40 pt-2 text-xs">
        {hasBaseline && delta !== null && delta !== undefined ? (
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center font-medium ${
                comparison.direction === "flat"
                  ? "text-muted-foreground"
                  : isGood
                  ? "text-emerald-400"
                  : "text-rose-400"
              }`}
            >
              {comparison.direction === "up" ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : comparison.direction === "down" ? (
                <ArrowDownRight className="h-3.5 w-3.5" />
              ) : (
                <Minus className="h-3.5 w-3.5" />
              )}
              {Math.abs(delta)}
              {isRateMetric ? " pp" : "%"}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {comparison.timeWindowLabel}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Minus className="h-3 w-3" />
            <span>Not enough observed telemetry</span>
          </div>
        )}

        {sampleDetail && (
          <div className="mt-1 text-[10px] text-muted-foreground/70">
            {sampleDetail}
          </div>
        )}
      </div>
    </div>
  );
}

export function ProjectHealthSnapshotView({ snapshot, timeRangeLabel }: ProjectHealthSnapshotProps) {
  const { errorRate, requestVolume, p95LatencyMs, failedRequests, affectedUsers, activeIssues } =
    snapshot;

  return (
    <section aria-labelledby="health-snapshot-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="health-snapshot-heading" className="text-base font-semibold text-foreground tracking-tight">
            Operational Health Snapshot
          </h2>
          <p className="text-xs text-muted-foreground">
            Live telemetry state evaluated against previous equivalent window ({timeRangeLabel})
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/20 px-2.5 py-1 text-xs text-muted-foreground">
          {snapshot.hasSufficientSample ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Sufficient telemetry captured</span>
            </>
          ) : (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
              <span>Sparse observation window</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          title="Error Rate"
          formattedCurrent={errorRate.current !== null ? `${errorRate.current.toFixed(1)}%` : "0%"}
          comparison={errorRate}
          isRateMetric={true}
          insufficientSample={!errorRate.sufficientBaseline && requestVolume.current < 5}
          sampleDetail={`${failedRequests.current} failed / ${requestVolume.current} requests`}
        />

        <MetricCard
          title="Request Volume"
          formattedCurrent={requestVolume.current.toLocaleString()}
          unit="req"
          comparison={requestVolume}
          sampleDetail={`${snapshot.totalEventsObserved} total events logged`}
        />

        <MetricCard
          title="P95 Latency"
          formattedCurrent={p95LatencyMs.current > 0 ? `${p95LatencyMs.current}` : "—"}
          unit="ms"
          comparison={p95LatencyMs}
          insufficientSample={!p95LatencyMs.sufficientBaseline}
          sampleDetail={p95LatencyMs.current > 0 ? "Observed tail duration" : "No duration traces"}
        />

        <MetricCard
          title="Failed Requests"
          formattedCurrent={failedRequests.current.toLocaleString()}
          unit="errors"
          comparison={failedRequests}
        />

        <MetricCard
          title="Affected Users"
          formattedCurrent={affectedUsers.current.toLocaleString()}
          unit="identities"
          comparison={affectedUsers}
          sampleDetail={affectedUsers.current > 0 ? "Unique users impacted" : "No user impacted"}
        />

        <MetricCard
          title="Active Issues"
          formattedCurrent={activeIssues.current.toLocaleString()}
          unit="open"
          comparison={activeIssues}
          sampleDetail="Unresolved bug groups"
        />
      </div>
    </section>
  );
}
