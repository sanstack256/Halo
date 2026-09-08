"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { RefreshCw, FilterX, Globe, Server, Tag } from "lucide-react";
import type {
  RedesignedProjectMetricsIntelligence,
  TimeRangePreset,
} from "@/lib/metrics/types";

import { PrimaryTelemetryOverview } from "./primary-telemetry-overview";
import { ObservedChangesView } from "./observed-changes-view";
import { FailureConcentrationView } from "./failure-concentration-view";
import { ServicePerformanceTable } from "./service-performance-table";
import { ReleaseBehaviorView } from "./release-behavior-view";
import { UserImpactView } from "./user-impact-view";
import { TelemetryCoverageMatrix } from "./telemetry-coverage-matrix";
import { ProjectTrendView } from "./project-trend-view";

interface ProjectMetricsDashboardProps {
  metrics: RedesignedProjectMetricsIntelligence;
}

const TIME_RANGES: { key: TimeRangePreset; label: string }[] = [
  { key: "1h", label: "1 Hour" },
  { key: "6h", label: "6 Hours" },
  { key: "24h", label: "24 Hours" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "custom", label: "Custom" },
];

export function ProjectMetricsDashboard({ metrics }: ProjectMetricsDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentRange =
    (searchParams.get("range") as TimeRangePreset) ||
    metrics.filterApplied.timeRange ||
    "24h";
  const currentEnv = searchParams.get("env") || metrics.filterApplied.environment || "ALL";
  const currentService = searchParams.get("service") || metrics.filterApplied.service || "ALL";
  const currentRelease = searchParams.get("release") || metrics.filterApplied.release || "ALL";

  function updateFilter(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === "ALL") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleResetFilters() {
    startTransition(() => {
      router.push(pathname);
    });
  }

  function handleRefresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  const hasActiveCustomFilters =
    currentEnv !== "ALL" ||
    currentService !== "ALL" ||
    currentRelease !== "ALL" ||
    currentRange !== "24h";

  // Truthful Empty State if project has literally zero telemetry ever recorded
  if (metrics.totalHistoricalEvents === 0) {
    return (
      <div className="mx-auto max-w-[1440px] px-4 md:px-10 py-6 space-y-6">
        {/* 1. Page Header */}
        <div className="flex h-14 items-center justify-between border-b border-border/50 pb-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Metrics
            </h1>
            <p className="text-[13px] text-muted-foreground">
              Quantitative telemetry for this project
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/20 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Clean Empty State */}
        <div className="rounded-lg border border-border bg-card p-12 text-center space-y-3">
          <h2 className="text-base font-semibold text-foreground">
            No telemetry observed
          </h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            No project telemetry was captured for the selected interval. Send requests or instrument the Halo SDK to view operational telemetry.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 md:px-10 py-6 space-y-5">
      {/* 1. Project Metrics Header */}
      <div className="flex h-14 items-center justify-between border-b border-border/50 pb-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground leading-none">
            Metrics
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Quantitative telemetry for this project
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 2. Global Filter Bar (Height: 36-40px) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Range Selector */}
          <div className="flex items-center rounded-md border border-border bg-background p-0.5">
            {TIME_RANGES.map((r) => {
              const isActive = currentRange === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => updateFilter({ range: r.key })}
                  className={`rounded px-2.5 py-1 font-medium transition-all ${
                    isActive
                      ? "bg-secondary text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          {/* Environment Filter */}
          {metrics.availableEnvironments.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={currentEnv}
                onChange={(e) => updateFilter({ env: e.target.value })}
                className="bg-transparent text-foreground focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Environments</option>
                {metrics.availableEnvironments.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Service Filter */}
          {metrics.availableServices.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1">
              <Server className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={currentService}
                onChange={(e) => updateFilter({ service: e.target.value })}
                className="bg-transparent text-foreground focus:outline-none cursor-pointer max-w-[130px] truncate"
              >
                <option value="ALL">All Services</option>
                {metrics.availableServices.map((svc) => (
                  <option key={svc} value={svc}>
                    {svc}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Release Filter */}
          {metrics.availableReleases.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={currentRelease}
                onChange={(e) => updateFilter({ release: e.target.value })}
                className="bg-transparent text-foreground focus:outline-none cursor-pointer max-w-[120px] truncate"
              >
                <option value="ALL">All Releases</option>
                {metrics.availableReleases.map((rel) => (
                  <option key={rel} value={rel}>
                    {rel}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reset Filters */}
          {hasActiveCustomFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1 rounded-md border border-border/80 bg-secondary/30 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
            >
              <FilterX className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {isPending && (
          <span className="text-[11px] text-muted-foreground font-mono animate-pulse pr-2">
            Requerying telemetry...
          </span>
        )}
      </div>

      {/* 3. Primary Telemetry Overview (4 metrics + 300px switchable chart) */}
      <PrimaryTelemetryOverview
        overview={metrics.telemetryOverview}
        buckets={metrics.primaryChart.buckets}
        timeRangeLabel={metrics.timeWindow.label}
      />

      {/* 4. Observed Changes (Max 3 rows) */}
      <ObservedChangesView data={metrics.observedChanges} />

      {/* 5. Failure Concentration (Segmented control + ranked proportional bars) */}
      <FailureConcentrationView data={metrics.failureConcentration} />

      {/* 6. Service Performance (Dense table sorted by errors) */}
      <ServicePerformanceTable
        data={metrics.servicePerformance}
        onSelectService={(svc) => updateFilter({ service: svc })}
      />

      {/* 7. Release Behavior (Horizontal timeline + table) */}
      <ReleaseBehaviorView
        data={metrics.releaseBehavior}
        onSelectRelease={(rel) => updateFilter({ release: rel })}
      />

      {/* 8. User Impact (4 compact metrics + factual sentence) */}
      <UserImpactView data={metrics.userImpact} />

      {/* 9. Telemetry Coverage (Compact 2-column matrix) */}
      <TelemetryCoverageMatrix data={metrics.telemetryCoverage} />

      {/* 10. Long-Term Trend (3 rows: ERROR RATE, P95 LATENCY, REQUEST VOLUME) */}
      <ProjectTrendView data={metrics.longTermTrend} />
    </div>
  );
}
